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
  if (!latLngs || !Array.isArray(latLngs) || latLngs.length === 0) {
    console.warn("Invalid latLngs provided to transformPolygonCoordinates", latLngs);
    return latLngs;
  }

  try {
    const startLat = latLngs[0]?.[0]?.lat ?? 0;
    const newLat = startLat + latDiff;
    // Account for longitude distortion at different latitudes
    const scale = Math.cos((startLat * Math.PI) / 180) / Math.cos((newLat * Math.PI) / 180);

    const shiftRing = (ring: L.LatLng[]) => {
      if (!Array.isArray(ring) || ring.length === 0) return ring;
      
      const centerLng = ring.reduce((sum, pt) => sum + (pt.lng || 0), 0) / ring.length;
      return ring.map(pt => {
        if (!pt || typeof pt.lat === 'undefined' || typeof pt.lng === 'undefined') {
          console.warn("Invalid point in ring", pt);
          return pt;
        }
        return L.latLng(
          pt.lat + latDiff,
          centerLng + ((pt.lng - centerLng) * scale + lngDiff)
        );
      });
    };

    return latLngs.map((ring: any) => {
      if (!Array.isArray(ring)) return ring;
      return Array.isArray(ring[0]) && ring[0] !== null
        ? ring.map((sub: any) => shiftRing(sub))
        : shiftRing(ring);
    });
  } catch (error) {
    console.error("Error in transformPolygonCoordinates:", error);
    return latLngs; // Return original on error to prevent crashes
  }
}

// Enable click-and-drag on a polygon layer to move it interactively
export function enablePolygonDragging(geoJsonLayer: L.GeoJSON, map: L.Map | null) {
  if (!map) return;

  geoJsonLayer.eachLayer((innerLayer) => {
    if (!(innerLayer instanceof L.Polygon)) return;

    let originalLatLngs: any = null;
    let dragStartLatLng: L.LatLng | null = null;
    let hasMoved = false;
    const moveThreshold = 3; // Pixels to consider a drag vs a click
    let associatedMarker: L.Marker | null = null;

    // Function to find the marker associated with this layer
    const findAssociatedMarker = (): L.Marker | null => {
      const markersGroup = (window as any).markersLayerGroupRef?.current;
      const markerMap = (window as any).markerToLayerMap?.current;
      if (!markersGroup || !markerMap) return null;

      let result: L.Marker | null = null;
      markerMap.forEach((layer: L.GeoJSON, marker: L.Marker) => {
        layer.eachLayer((l) => {
          if (l === innerLayer) {
            result = marker;
          }
        });
      });
      return result;
    };

    innerLayer.on("mousedown", async (event: L.LeafletMouseEvent) => {
      L.DomEvent.stopPropagation(event);
      map.dragging.disable();
      
      // Store the exact starting position
      dragStartLatLng = event.latlng.clone(); // Clone to ensure we have a separate instance
      
      // Store the original shape coordinates
      const latLngs = innerLayer.getLatLngs();
      originalLatLngs = JSON.parse(JSON.stringify(latLngs));
      
      // Find the associated marker
      associatedMarker = findAssociatedMarker();
      
      hasMoved = false;
      
      // Start dragging immediately
      const onMouseMove = (e: L.LeafletMouseEvent) => {
        if (!dragStartLatLng || !originalLatLngs) return;

        // Calculate pixel distance to determine if this is a drag
        const startPoint = map.latLngToContainerPoint(dragStartLatLng);
        const currentPoint = map.latLngToContainerPoint(e.latlng);
        const pixelDistance = startPoint.distanceTo(currentPoint);
        
        if (pixelDistance > moveThreshold) {
          hasMoved = true;
        }
        
        // Move the shape with the mouse - calculate total displacement from start
        const latDiff = e.latlng.lat - dragStartLatLng.lat;
        const lngDiff = e.latlng.lng - dragStartLatLng.lng;
        const transformed = transformPolygonCoordinates(originalLatLngs, latDiff, lngDiff);
        
        // Update the polygon position
        (innerLayer as L.Polygon).setLatLngs(transformed);

        // Update associated marker position immediately
        if (associatedMarker) {
          const newMarkerPosition = findCenterForMarker(innerLayer as L.Polygon);
          associatedMarker.setLatLng(newMarkerPosition);
        }
      };

      const onMouseUp = async () => {
        // Clean up event listeners
        map?.off("mousemove", onMouseMove);
        map?.off("mouseup", onMouseUp);
        map?.dragging.enable();

        // Update the feature and store with the final position
        const feature = (innerLayer as any).feature as GeoJSON.Feature | undefined;
        if (feature && feature.properties && feature.geometry) {
          const featureIndex = feature.properties.index;
          if (featureIndex !== undefined) {
            // Save the new coordinates
            const currentCoords = innerLayer.getLatLngs();
            const convertedCoords = convertLatLngsToCoords(currentCoords);
            (feature.geometry as any).currentCoordinates = convertedCoords;

            const { useMapStore } = await import('../../state/mapStore');
            const store = useMapStore.getState();
            store.updateCurrentCoordinates(`geojson-${featureIndex}`, convertedCoords);

            // Only set as active if it was a click (not a drag)
            if (!hasMoved) {
              store.setActiveArea(`geojson-${featureIndex}`);
            }
          }
        }

        // Clean up references
        originalLatLngs = null;
        dragStartLatLng = null;
        associatedMarker = null;
      };

      // Add event listeners to the map for move and up events
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
    });
  });
}


export function calculateAreaInKm2(feature: GeoJSON.Feature): number {
    if (!feature.geometry || !feature.geometry) {
        console.warn("Feature has no geometry or coordinates:", feature);
        return 0;
    }
    try {
        const area = turf.area(feature);
        return area / 1e6; // Convert to square kilometers
    } catch (error) {
        console.error("Error calculating area for feature:", feature, error);
        return 0;
    }
}

export const convertLatLngsToCoords = (latLngs: any): any => {
  if (!Array.isArray(latLngs) || latLngs.length === 0) return [];

  if (latLngs[0] instanceof L.LatLng) {
    // Ring of LatLngs (e.g. outer ring or hole)
    return latLngs.map((ll: L.LatLng) => [ll.lng, ll.lat]);
  }

  // If the first element is an array, recurse into it
  return latLngs.map((subArray: any) => convertLatLngsToCoords(subArray));
};
