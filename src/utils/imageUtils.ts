// src/utils/imageUtils.ts
/**
 * Utility functions for generating satellite and map images of geographic areas
 */

import type { GeoJSONFeature } from "../state/mapStoreTypes";

// Tile services
const TILE_SERVICES = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  map: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

// Calculate bounding box from GeoJSON coordinates
export function calculateBoundingBox(coordinates: any): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  const processCoordinate = (coord: [number, number]) => {
    const [lng, lat] = coord;
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  };

  const processCoordinates = (coords: any) => {
    if (Array.isArray(coords[0])) {
      if (Array.isArray(coords[0][0])) {
        // MultiPolygon or nested arrays
        coords.forEach((ring: any) => processCoordinates(ring));
      } else {
        // Polygon ring
        coords.forEach(processCoordinate);
      }
    } else {
      // Single coordinate
      processCoordinate(coords);
    }
  };

  processCoordinates(coordinates);

  return { minLat, maxLat, minLng, maxLng };
}

// Convert lat/lng to tile coordinates
export function latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
  const y = Math.floor(
    ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
      Math.pow(2, zoom)
  );
  return { x, y };
}

// Convert tile coordinates to lat/lng
export function tileToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const lng = (x / Math.pow(2, zoom)) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { lat, lng };
}

// Determine appropriate zoom level based on bounding box
export function calculateZoomLevel(
  minLat: number,
  maxLat: number,
  minLng: number,
  maxLng: number,
  imageWidth: number = 400,
  imageHeight: number = 300
): number {
  const latDiff = maxLat - minLat;
  const lngDiff = maxLng - minLng;
  
  // Start with a reasonable zoom level and adjust
  for (let zoom = 18; zoom >= 1; zoom--) {
    const topLeft = latLngToTile(maxLat, minLng, zoom);
    const bottomRight = latLngToTile(minLat, maxLng, zoom);
    
    const tileWidth = (bottomRight.x - topLeft.x + 1) * 256;
    const tileHeight = (bottomRight.y - topLeft.y + 1) * 256;
    
    if (tileWidth >= imageWidth && tileHeight >= imageHeight) {
      return Math.max(1, zoom - 1); // Add some padding
    }
  }
  
  return 1;
}

// Load a single tile image
async function loadTileImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
    img.src = url;
  });
}

// Generate composite image from tiles
export async function generateAreaImage(
  feature: GeoJSONFeature,
  type: 'satellite' | 'map',
  width: number = 400,
  height: number = 300
): Promise<string> {
  const bbox = calculateBoundingBox(feature.geometry.coordinates);
  const zoom = calculateZoomLevel(bbox.minLat, bbox.maxLat, bbox.minLng, bbox.maxLng, width, height);
  
  // Calculate tile bounds
  const topLeft = latLngToTile(bbox.maxLat, bbox.minLng, zoom);
  const bottomRight = latLngToTile(bbox.minLat, bbox.maxLng, zoom);
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Calculate the full tile area bounds in lat/lng
  const tileTopLeft = tileToLatLng(topLeft.x, topLeft.y, zoom);
  const tileBottomRight = tileToLatLng(bottomRight.x + 1, bottomRight.y + 1, zoom);
  
  // Fill background
  ctx.fillStyle = type === 'satellite' ? '#1a1a1a' : '#aad3df';
  ctx.fillRect(0, 0, width, height);
  
  try {
    // Load and draw tiles
    const tilePromises: Promise<{ img: HTMLImageElement; x: number; y: number }>[] = [];
    
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        let tileUrl = TILE_SERVICES[type];
        
        if (type === 'map') {
          // OpenStreetMap requires a subdomain
          const subdomains = ['a', 'b', 'c'];
          const subdomain = subdomains[(x + y) % subdomains.length];
          tileUrl = tileUrl.replace('{s}', subdomain);
        }
        
        tileUrl = tileUrl.replace('{z}', zoom.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString());
        
        tilePromises.push(
          loadTileImage(tileUrl).then(img => ({ img, x, y })).catch(err => {
            console.warn(`Failed to load tile ${x},${y}:`, err);
            return null;
          })
        );
      }
    }
    
    const tiles = (await Promise.all(tilePromises)).filter(Boolean);
    
    // Draw tiles on canvas
    tiles.forEach(tile => {
      if (!tile) return;
      
      // Calculate position on canvas
      const tileLatLng = tileToLatLng(tile.x, tile.y, zoom);
      
      // Map tile coordinates to canvas coordinates
      const canvasX = ((tileLatLng.lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * width;
      const canvasY = ((bbox.maxLat - tileLatLng.lat) / (bbox.maxLat - bbox.minLat)) * height;
      
      // Calculate tile size on canvas
      const nextTileLatLng = tileToLatLng(tile.x + 1, tile.y + 1, zoom);
      const tileCanvasWidth = ((nextTileLatLng.lng - tileLatLng.lng) / (bbox.maxLng - bbox.minLng)) * width;
      const tileCanvasHeight = ((tileLatLng.lat - nextTileLatLng.lat) / (bbox.maxLat - bbox.minLat)) * height;
      
      ctx.drawImage(tile.img, canvasX, canvasY, tileCanvasWidth, tileCanvasHeight);
    });
    
    // Draw area outline
    drawAreaOutline(ctx, feature, bbox, width, height);
    
  } catch (error) {
    console.error('Error generating area image:', error);
    // Draw error placeholder
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'white';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Failed to load image', width / 2, height / 2);
  }
  
  return canvas.toDataURL('image/png');
}

// Draw area outline on canvas
function drawAreaOutline(
  ctx: CanvasRenderingContext2D,
  feature: GeoJSONFeature,
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  width: number,
  height: number
) {
  ctx.strokeStyle = feature.properties.color || '#ff0000';
  ctx.lineWidth = 2;
  ctx.fillStyle = (feature.properties.color || '#ff0000') + '20'; // 20% opacity
  
  const coordsToCanvasPoint = (coord: [number, number]) => {
    const [lng, lat] = coord;
    const x = ((lng - bbox.minLng) / (bbox.maxLng - bbox.minLng)) * width;
    const y = ((bbox.maxLat - lat) / (bbox.maxLat - bbox.minLat)) * height;
    return { x, y };
  };
  
  const drawPolygon = (coordinates: [number, number][]) => {
    if (coordinates.length === 0) return;
    
    ctx.beginPath();
    const firstPoint = coordsToCanvasPoint(coordinates[0]);
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < coordinates.length; i++) {
      const point = coordsToCanvasPoint(coordinates[i]);
      ctx.lineTo(point.x, point.y);
    }
    
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  
  // Handle different geometry types
  if (feature.geometry.type === 'Polygon') {
    feature.geometry.coordinates.forEach((ring: [number, number][]) => {
      drawPolygon(ring);
    });
  } else if (feature.geometry.type === 'MultiPolygon') {
    feature.geometry.coordinates.forEach((polygon: [number, number][][]) => {
      polygon.forEach((ring: [number, number][]) => {
        drawPolygon(ring);
      });
    });
  }
}