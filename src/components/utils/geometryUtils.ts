import L, { LatLng } from "leaflet";
import * as turf from "@turf/turf";

/**
 * Geometry Utilities for Size of Anything
 * 
 * This module provides utilities for handling geometric operations on map elements.
 * 
 * The polygon dragging implementation uses turf.transformTranslate to move polygons on the map.
 * turf.transformTranslate moves any geojson Feature or Geometry along a Rhumb Line on the provided direction angle.
 * 
 * Parameters for turf.transformTranslate:
 * - geojson: GeoJSON | GeometryCollection - object to be translated
 * - distance: number - length of the motion; negative values determine motion in opposite direction
 * - direction: number - angle of the motion; angle from North in decimal degrees, positive clockwise
 * - options?: Object - Optional parameters
 *   - units?: Units - in which distance will be express; miles, kilometers, degrees, or radians (default 'kilometers')
 *   - zTranslation?: number - length of the vertical motion, same unit of distance (default 0)
 *   - mutate?: boolean - allows GeoJSON input to be mutated (significant performance increase if true) (default false)
 * 
 * Returns: GeoJSON | GeometryCollection - the translated GeoJSON object
 */


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

export const countCoordinates = (coords: any[]): number => {
  if (!Array.isArray(coords)) return 0;
  if (
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    return 1; // Base case: this is a coordinate pair [lng, lat]
  }
  // Recursive case: sum up points in nested arrays
  return coords.reduce((sum, item) => sum + countCoordinates(item), 0);
};

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
  } catch (error) {
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

  // Recursively add latDiff and lngDiff to each coordinate
  function translateCoords(coords: any): any {
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      // Base case: single [lng, lat]
      return [coords[0] + lngDiff, coords[1] + latDiff];
    }
    return coords.map(translateCoords);
  }

  // Convert Leaflet latLngs -> GeoJSON coords
  const geoJsonCoords = convertLatLngsToCoords(latLngs);

  // Translate coordinates
  const translatedCoords = translateCoords(geoJsonCoords);

  // Convert back to Leaflet latLngs
  return convertCoordsToLatLngs(translatedCoords);
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
        
        // Use turf.transformTranslate to move the polygon accurately
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

  const isLatLng = (pt: any): pt is { lat: number; lng: number } =>
    pt &&
    typeof pt === "object" &&
    typeof pt.lat === "number" &&
    typeof pt.lng === "number";

  // Case 1: this is a single point (rare in your case, but safe to support)
  if (isLatLng(latLngs)) {
    return [latLngs.lng, latLngs.lat];
  }

  // Case 2: this is an array of point objects
  if (Array.isArray(latLngs) && latLngs.every(isLatLng)) {
    return latLngs.map((pt) => [pt.lng, pt.lat]);
  }

  // Case 3: deeper nesting (e.g., Polygon[], MultiPolygon[])
  return latLngs.map((subArray) => convertLatLngsToCoords(subArray));
};



/**
 * Converts GeoJSON coordinates format back to Leaflet LatLng objects
 * 
 * @param coords - GeoJSON coordinates array [lng, lat] format
 * @returns Coordinates in Leaflet LatLng format
 */
export const convertCoordsToLatLngs = (coords: any): any => {
  if (!Array.isArray(coords) || coords.length === 0) return [];

  // If the first two elements are numbers, this is a single coordinate
  if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
    return L.latLng(coords[1], coords[0]); // Note: GeoJSON is [lng, lat], Leaflet is [lat, lng]
  }

  // Otherwise, recurse into the array
  return coords.map((subArray: any) => convertCoordsToLatLngs(subArray));
};
