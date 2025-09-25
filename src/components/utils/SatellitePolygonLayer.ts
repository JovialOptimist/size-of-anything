// src/components/utils/SatellitePolygonLayer.ts
/**
 * Custom Leaflet layer for rendering polygons filled with satellite imagery
 */

import L from 'leaflet';
import type { GeoJSONFeature } from '../../state/mapStoreTypes';

// Tile services
const TILE_SERVICES = {
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  map: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
};

interface SatellitePolygonOptions {
  feature: GeoJSONFeature;
  type: 'satellite' | 'map';
  isActive?: boolean;
  reuseExistingPattern?: boolean;
}

export class SatellitePolygonLayer extends L.Layer {
  private feature: GeoJSONFeature;
  private type: 'satellite' | 'map';
  private isActive: boolean;
  private polygonLayer: L.GeoJSON | null = null;
  private bounds: L.LatLngBounds | null = null;
  private originalBounds: L.LatLngBounds | null = null; // Store original bounds for satellite imagery
  private reuseExistingPattern: boolean;

  constructor(options: SatellitePolygonOptions) {
    super();
    this.feature = options.feature;
    this.type = options.type;
    this.isActive = options.isActive || false;
    this.reuseExistingPattern = options.reuseExistingPattern || false;
  }

  onAdd(map: L.Map): this {
    this.generateSatelliteOverlay(map);
    return this;
  }

  onRemove(map: L.Map): this {
    if (this.polygonLayer) {
      map.removeLayer(this.polygonLayer);
      this.polygonLayer = null;
    }
    
    // DON'T clean up SVG patterns when removing layer during reuse
    // Only clean up patterns when actually switching away from satellite mode
    // The MapView will handle pattern cleanup when switching view modes
    
    return this;
  }

  private async generateSatelliteOverlay(map: L.Map) {
    try {
      // Calculate bounding box of the actual polygon coordinates
      const tempLayer = L.geoJSON(this.feature);
      this.bounds = tempLayer.getBounds();
      
      if (!this.bounds.isValid()) {
        console.warn('Invalid bounds for satellite overlay');
        return;
      }

      if (this.reuseExistingPattern) {
        // Reuse existing satellite pattern instead of fetching new imagery
        this.polygonLayer = await this.createPolygonWithExistingPattern(map);
      } else {
        // Store the original bounds - this is what the satellite imagery represents
        this.originalBounds = L.latLngBounds(this.bounds.getSouthWest(), this.bounds.getNorthEast());

        // Use a higher zoom level to get detailed satellite imagery
        const zoom = Math.max(12, Math.min(18, map.getZoom() + 4));

        // Generate satellite image that shows the actual geographic area of the polygon
        const imageUrl = await this.generateSatelliteImage(this.originalBounds, zoom, 1024, 1024);
        
        // Create the polygon layer with satellite imagery as fill pattern
        this.polygonLayer = await this.createSatelliteFilledPolygon(map, imageUrl);
      }

      // Add layers to map
      if (map.hasLayer(this)) {
        map.addLayer(this.polygonLayer);
      }

    } catch (error) {
      console.error('Failed to generate satellite overlay:', error);
      // Fallback to regular polygon
      this.createFallbackPolygon(map);
    }
  }

  private async createSatelliteFilledPolygon(map: L.Map, imageUrl: string): Promise<L.GeoJSON> {
    return new Promise((resolve) => {
      // Create a canvas element to hold our satellite texture
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      // Load the satellite image onto the canvas
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Create a data URL from the canvas
        const canvasDataUrl = canvas.toDataURL('image/png');
        
        // Create a unique pattern ID for this polygon
        const patternId = `satellite-pattern-${Math.random().toString(36).substr(2, 9)}`;
        
        // Create the GeoJSON layer with the satellite texture
        const geoLayer = L.geoJSON(this.feature, {
          style: {
            color: this.feature.properties.color || '#ff0000',
            weight: this.isActive ? 4 : 2,
            fillOpacity: 1,
            opacity: this.isActive ? 0.9 : 0.7,
          },
          onEachFeature: (feature, layer) => {
            // When the layer is added to the map, apply the satellite texture
            layer.on('add', () => {
              this.applySatelliteTextureFixed(layer as L.Path, canvasDataUrl, patternId);
            });
          }
        });

        resolve(geoLayer);
      };
      
      img.onerror = () => {
        console.error('Failed to load satellite image');
        // Fallback to regular polygon
        const geoLayer = L.geoJSON(this.feature, {
          style: {
            color: this.feature.properties.color || '#ff0000',
            weight: this.isActive ? 4 : 2,
            fillOpacity: 0.4,
            opacity: this.isActive ? 0.9 : 0.7,
          },
        });
        resolve(geoLayer);
      };
      
      img.src = imageUrl;
    });
  }

  private applySatelliteTextureFixed(layer: L.Path, imageDataUrl: string, patternId: string) {
    try {
      // Get the SVG element from the layer
      const svgElement = (layer as any)._path;
      if (!svgElement) return;

      // Get the map's SVG
      const mapSvg = svgElement.ownerSVGElement;
      if (!mapSvg) return;

      let defs = mapSvg.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        mapSvg.appendChild(defs);
      }

      // Remove existing pattern if it exists
      const existingPattern = defs.querySelector(`#${patternId}`);
      if (existingPattern) {
        existingPattern.remove();
      }

      // Create pattern element that's fixed to the polygon
      const pattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
      pattern.id = patternId;
      pattern.setAttribute('patternUnits', 'objectBoundingBox');
      pattern.setAttribute('x', '0');
      pattern.setAttribute('y', '0');
      pattern.setAttribute('width', '1');
      pattern.setAttribute('height', '1');
      pattern.setAttribute('viewBox', '0 0 1024 1024');
      pattern.setAttribute('preserveAspectRatio', 'xMidYMid slice');

      // Create image element within pattern
      const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
      image.setAttribute('href', imageDataUrl);
      image.setAttribute('x', '0');
      image.setAttribute('y', '0');
      image.setAttribute('width', '1024');
      image.setAttribute('height', '1024');
      image.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      
      pattern.appendChild(image);
      defs.appendChild(pattern);

      // Apply the pattern as fill
      svgElement.setAttribute('fill', `url(#${patternId})`);

      // No event listeners needed - objectBoundingBox makes the pattern stick to the polygon

    } catch (error) {
      console.error('Failed to apply satellite texture:', error);
    }
  }



  private applyClipping(map: L.Map) {
    if (!this.imageOverlay || !this.polygonLayer) return;

    try {
      // Get the polygon path as SVG coordinates relative to the image bounds
      const clipPath = this.generateClipPath(map);
      
      if (clipPath) {
        // Apply CSS clipping to the image overlay
        const imageElement = (this.imageOverlay as any)._image;
        if (imageElement) {
          imageElement.style.clipPath = clipPath;
          imageElement.style.WebkitClipPath = clipPath; // Safari support
        }
      }
    } catch (error) {
      console.error('Failed to apply clipping:', error);
    }
  }

  // This method is no longer needed with the new SVG pattern approach
  private generateClipPath(map: L.Map): string | null {
    // Kept for potential future use or fallback
    return null;
  }

  private async generateSatelliteImage(
    bounds: L.LatLngBounds, 
    zoom: number, 
    width: number, 
    height: number
  ): Promise<string> {
    // Convert bounds to tile coordinates
    const northWest = bounds.getNorthWest();
    const southEast = bounds.getSouthEast();
    
    const topLeft = this.latLngToTile(northWest.lat, northWest.lng, zoom);
    const bottomRight = this.latLngToTile(southEast.lat, southEast.lng, zoom);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Fill background
    ctx.fillStyle = this.type === 'satellite' ? '#1a1a1a' : '#aad3df';
    ctx.fillRect(0, 0, width, height);

    try {
      // Load tiles
      const tiles = await this.loadTiles(topLeft, bottomRight, zoom);
      
      // Draw tiles on canvas
      this.drawTiles(ctx, tiles, topLeft, bottomRight, width, height, zoom);

    } catch (error) {
      console.warn('Failed to load some tiles:', error);
    }

    return canvas.toDataURL('image/png');
  }

  private latLngToTile(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
    const y = Math.floor(
      ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) *
        Math.pow(2, zoom)
    );
    return { x, y };
  }

  private async loadTiles(
    topLeft: { x: number; y: number },
    bottomRight: { x: number; y: number },
    zoom: number
  ): Promise<Array<{ img: HTMLImageElement; x: number; y: number }>> {
    const tilePromises: Array<Promise<{ img: HTMLImageElement; x: number; y: number } | null>> = [];

    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        let tileUrl = TILE_SERVICES[this.type];

        if (this.type === 'map') {
          const subdomains = ['a', 'b', 'c'];
          const subdomain = subdomains[(x + y) % subdomains.length];
          tileUrl = tileUrl.replace('{s}', subdomain);
        }

        tileUrl = tileUrl
          .replace('{z}', zoom.toString())
          .replace('{x}', x.toString())
          .replace('{y}', y.toString());

        tilePromises.push(
          this.loadTileImage(tileUrl).then(img => ({ img, x, y })).catch(() => null)
        );
      }
    }

    const results = await Promise.all(tilePromises);
    return results.filter((tile): tile is { img: HTMLImageElement; x: number; y: number } => tile !== null);
  }

  private loadTileImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load tile: ${url}`));
      img.src = url;
    });
  }

  private drawTiles(
    ctx: CanvasRenderingContext2D,
    tiles: Array<{ img: HTMLImageElement; x: number; y: number }>,
    topLeft: { x: number; y: number },
    bottomRight: { x: number; y: number },
    canvasWidth: number,
    canvasHeight: number,
    zoom: number
  ) {
    const tileSize = 256;
    const totalTileWidth = (bottomRight.x - topLeft.x + 1) * tileSize;
    const totalTileHeight = (bottomRight.y - topLeft.y + 1) * tileSize;

    tiles.forEach(tile => {
      const tileCanvasX = ((tile.x - topLeft.x) * tileSize / totalTileWidth) * canvasWidth;
      const tileCanvasY = ((tile.y - topLeft.y) * tileSize / totalTileHeight) * canvasHeight;
      const tileCanvasWidth = (tileSize / totalTileWidth) * canvasWidth;
      const tileCanvasHeight = (tileSize / totalTileHeight) * canvasHeight;

      ctx.drawImage(tile.img, tileCanvasX, tileCanvasY, tileCanvasWidth, tileCanvasHeight);
    });
  }

  private createFallbackPolygon(map: L.Map) {
    // Create regular polygon as fallback
    this.polygonLayer = L.geoJSON(this.feature, {
      style: {
        color: this.feature.properties.color || '#ff0000',
        weight: this.isActive ? 4 : 2,
        fillOpacity: 0.4,
        opacity: this.isActive ? 0.9 : 0.7,
      },
    });

    if (map.hasLayer(this)) {
      map.addLayer(this.polygonLayer);
    }
  }

  // Update active state
  setActive(isActive: boolean) {
    this.isActive = isActive;
    if (this.polygonLayer) {
      this.polygonLayer.setStyle({
        weight: isActive ? 4 : 2,
        opacity: isActive ? 0.9 : 0.7,
      });
    }
  }

  // Get the polygon layer for event handling
  getPolygonLayer(): L.GeoJSON | null {
    return this.polygonLayer;
  }



  private async createPolygonWithExistingPattern(map: L.Map): Promise<L.GeoJSON> {
    return new Promise((resolve) => {
      // Create the GeoJSON layer with new coordinates
      const geoLayer = L.geoJSON(this.feature, {
        style: {
          color: this.feature.properties.color || '#ff0000',
          weight: this.isActive ? 4 : 2,
          fillOpacity: 1,
          opacity: this.isActive ? 0.9 : 0.7,
        },
        onEachFeature: (feature, layer) => {
          // When the layer is added to the map, apply existing satellite texture
          layer.on('add', () => {
            this.applyExistingSatellitePattern(layer as L.Path);
          });
        }
      });

      resolve(geoLayer);
    });
  }

  private applyExistingSatellitePattern(layer: L.Path) {
    try {
      // Get the SVG element from the layer
      const svgElement = (layer as any)._path;
      if (!svgElement) return;

      // Find existing satellite pattern in the SVG
      const mapSvg = svgElement.ownerSVGElement;
      if (!mapSvg) return;

      const defs = mapSvg.querySelector('defs');
      if (!defs) return;

      // Find an existing satellite pattern (there should be one from a previous layer)
      const existingPattern = defs.querySelector('pattern[id^="satellite-pattern-"]');
      if (existingPattern) {
        const patternId = existingPattern.id;
        svgElement.setAttribute('fill', `url(#${patternId})`);
      } else {
        console.warn('No existing satellite pattern found to reuse');
        // Fallback to regular polygon fill
        svgElement.setAttribute('fill', this.feature.properties.color || '#ff0000');
        svgElement.setAttribute('fill-opacity', '0.4');
      }

    } catch (error) {
      console.error('Failed to apply existing satellite pattern:', error);
    }
  }
}