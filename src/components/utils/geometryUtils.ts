import L, { LatLng } from "leaflet";
import * as turf from "@turf/turf";


// Utility to find the centroid of a ring (used to compare proximity)
function ringCentroid(ring: LatLng[]): LatLng {
  const sum = ring.reduce(
    (acc, pt) => {
      acc.lat += pt.lat;
      acc.lng += pt.lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );
  return L.latLng(sum.lat / ring.length, sum.lng / ring.length);
}

// Utility to measure if all centroids are within ~200km
function centroidsAreClose(centroids: LatLng[], thresholdKm = 200): boolean {
  const EARTH_RADIUS_KM = 6371;

  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);

    const aVal =
      Math.sin(dLat / 2) ** 2 +
      Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(aVal));
  }

  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      if (haversine(centroids[i], centroids[j]) > thresholdKm) {
        return false;
      }
    }
  }
  return true;
}

// There are a couple ways to do this
  // You can use polygon.center() which is a Leaflet method
  // You can use polygon.getBounds().getCenter() which is also a Leaflet method
  // But that doesn't really reflect the real "center" sometimes. Like, if you're trying to move France around, I'm gonna assume you want the marker on the mainland of France, not in the middle of the ocean (trying to use the islands)
  // So for this method, it will:
  // -- Use polygon center for regular (non-multipolygon) areas
  // -- Use the getBounds center for irregular, BUT CLOSELY linked areas (like Hawaii, The World Islands, but not France)
  // -- Use polygon center on the largest of the polygons for a multipolygon for SEPARATED areas
export function findCenterForMarker(polygon: L.Polygon): LatLng {
  try {
    const latLngs = polygon.getLatLngs();

    if (!Array.isArray(latLngs) || latLngs.length === 0) {
      return polygon.getBounds().getCenter(); // fallback
    }

    // Single polygon case (not MultiPolygon)
    if (Array.isArray(latLngs[0]) && !Array.isArray((latLngs[0] as any)[0])) {
      return polygon.getCenter();
    }

    // MultiPolygon
    const multi: LatLng[][] = latLngs as any;

    const centroids = multi.map(ring => ringCentroid(ring));
    // Calculate the area of each ring using turf.js
    const areas = multi.map(ring => {
      const coords = ring.map(pt => [pt.lng, pt.lat]);
      // Ensure the ring is closed
      if (coords.length > 0 && (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1])) {
        coords.push(coords[0]);
      }
      const polygon = turf.polygon([coords]);
      return turf.area(polygon);
    });

    if (centroidsAreClose(centroids)) {
      return polygon.getBounds().getCenter(); // tightly grouped
    } else {
      const maxIndex = areas.indexOf(Math.max(...areas));
      return ringCentroid(multi[maxIndex]); // use largest piece
    }
  } catch (e) {
    console.warn("Fallback marker center due to error:", e);
    return polygon.getBounds().getCenter();
  }
}

export function shouldShowMarkerForPolygon(
  polygon: L.Polygon,
  map: L.Map,
  threshold: number
): boolean {
  const bounds = polygon.getBounds();
  if (!map.getBounds().intersects(bounds)) return false;

  const ne = map.latLngToContainerPoint(bounds.getNorthEast());
  const sw = map.latLngToContainerPoint(bounds.getSouthWest());
  const polygonArea = Math.abs(ne.x - sw.x) * Math.abs(ne.y - sw.y);
  const mapSize = map.getSize();
  const screenArea = mapSize.x * mapSize.y;
  return (polygonArea / screenArea) * 100 < threshold;
}

export function isValidGeometry(coordinates: any[]): boolean {
  return Array.isArray(coordinates) && coordinates.every((ring: any) => {
    if (!Array.isArray(ring)) return false;
    return ring.every((pt: any) =>
      Array.isArray(pt)
        ? pt.every(p => p && p.lat != null && p.lng != null)
        : pt && pt.lat != null && pt.lng != null
    );
  });
}

export function transformPolygonCoordinates(
  latLngs: any,
  latDiff: number,
  lngDiff: number
): any {
  const startLat = latLngs[0]?.[0]?.lat ?? 0;
  const newLat = startLat + latDiff;
  const scale = Math.cos((startLat * Math.PI) / 180) / Math.cos((newLat * Math.PI) / 180);

  const shiftRing = (ring: L.LatLng[]) => {
    const centerLng = ring.reduce((sum, pt) => sum + pt.lng, 0) / ring.length;
    return ring.map(pt =>
      L.latLng(
        pt.lat + latDiff,
        centerLng + ((pt.lng - centerLng) * scale + lngDiff)
      )
    );
  };

  return latLngs.map((ring: any) =>
    Array.isArray(ring[0])
      ? ring.map((sub: any) => shiftRing(sub))
      : shiftRing(ring)
  );
}

// Enable click-and-drag on a polygon layer to move it interactively
export function enablePolygonDragging(geoJsonLayer: L.GeoJSON, map: L.Map | null) {
  if (!map) return;

  geoJsonLayer.eachLayer((innerLayer) => {
    if (!(innerLayer instanceof L.Polygon)) return;

    let originalLatLngs: any = null;
    let dragStart: L.LatLng | null = null;

    innerLayer.on("mousedown", (event: L.LeafletMouseEvent) => {
      // Set this shape as active when it's clicked
      const feature = geoJsonLayer.feature;
      // Type guard: check if feature is a Feature with properties
      if (feature && "properties" in feature && feature.properties) {
        const featureIndex = feature.properties.index;
        if (featureIndex !== undefined) {
          // Dynamically import the store to avoid circular dependencies
          import('../../state/mapStore').then(module => {
            const mapStore = module.useMapStore;
            mapStore.getState().setActiveArea(`geojson-${featureIndex}`);
          });
        }
      }
      
      map.dragging.disable();
      dragStart = event.latlng;

      // Deep clone coordinates
      const latLngs = innerLayer.getLatLngs();
      originalLatLngs = JSON.parse(JSON.stringify(latLngs));

      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!dragStart || !originalLatLngs) return;

        const latDiff = e.latlng.lat - dragStart.lat;
        const lngDiff = e.latlng.lng - dragStart.lng;

        const transformed = transformPolygonCoordinates(originalLatLngs, latDiff, lngDiff);
        (innerLayer as L.Polygon).setLatLngs(transformed);

        // Update marker if one is associated with this polygon
        const markersGroup = (window as any).markersLayerGroupRef?.current;
        const markerMap = (window as any).markerToLayerMap?.current;

        if (markersGroup && markerMap) {
          markerMap.forEach((layer: L.GeoJSON, marker: L.Marker) => {
            layer.eachLayer((l) => {
              if (l === innerLayer) {
                marker.setLatLng(findCenterForMarker(innerLayer));
              }
            });
          });
        }
      };

      const onMouseUp = () => {
        map?.off("mousemove", onMouseMove);
        map?.off("mouseup", onMouseUp);
        map?.dragging.enable();
        
        // Get existing feature and polygon layer
            let pathLayer: L.Polygon | null = null;
            let feature: GeoJSON.Feature | undefined;
            geoJsonLayer.eachLayer((layer) => {
              if (layer instanceof L.Polygon) {
                pathLayer = layer;
                if (layer.feature) {
                  feature = layer.feature as GeoJSON.Feature;
                }
              }
            });
            
            if (pathLayer && feature && feature.properties) {
              const featureIndex = feature.properties.index;
              
              if (featureIndex !== undefined) {
                // Get the current coordinates from the polygon after dragging
                const currentCoords = (pathLayer as L.Polygon).getLatLngs();
                
                // Convert Leaflet LatLngs to GeoJSON coordinates format
                const convertLatLngsToCoords = (latLngs: any): any => {
                  if (latLngs[0] instanceof L.LatLng) {
                    return [latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat])];
                  } else if (Array.isArray(latLngs[0])) {
                    return latLngs.map((ring: any) => convertLatLngsToCoords(ring)[0]);
                  }
                  return JSON.parse(JSON.stringify(latLngs));
                };
                
                const convertedCoords = convertLatLngsToCoords(currentCoords);
                
                // Store the current coordinates in the feature itself
                if (feature.geometry) {
                  (feature.geometry as any).currentCoordinates = convertedCoords;
                }
                
                // Update the store with the new coordinates
                import('../../state/mapStore').then(module => {
                  const mapStore = module.useMapStore;
                  mapStore.getState().updateCurrentCoordinates(`geojson-${featureIndex}`, convertedCoords);
                });
              }
            }
        
        originalLatLngs = null;
        dragStart = null;
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
    });
  });
}


// Convert Leaflet LatLngs to GeoJSON coordinates format
function convertLeafletCoordsToGeoJSON(latLngs: any): any {
  // Handle simple polygon
  if (latLngs[0] instanceof L.LatLng) {
    return [latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat])];
  }
  
  // Handle polygon with holes
  if (Array.isArray(latLngs[0]) && latLngs[0][0] instanceof L.LatLng) {
    return latLngs.map((ring: L.LatLng[]) => 
      ring.map((ll: L.LatLng) => [ll.lng, ll.lat])
    );
  }
  
  // Handle multipolygon
  if (Array.isArray(latLngs[0]) && Array.isArray(latLngs[0][0]) && latLngs[0][0][0] instanceof L.LatLng) {
    return latLngs.map((polygon: L.LatLng[][]) => 
      polygon.map((ring: L.LatLng[]) => 
        ring.map((ll: L.LatLng) => [ll.lng, ll.lat])
      )
    );
  }
  
  // Fallback - try to convert as best as possible
  return JSON.parse(JSON.stringify(latLngs));
}

export function rightClickToRemove(geoJsonLayer: L.GeoJSON, map: L.Map | null) {
  if (!map) return;

  geoJsonLayer.eachLayer((layer) => {
    layer.on("contextmenu", (event) => {
      event.originalEvent.preventDefault();
      geoJsonLayer.removeLayer(layer);
    });
  });
}
