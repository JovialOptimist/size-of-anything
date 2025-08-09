import L, { LatLng } from "leaflet";
import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";

/**
 * Geometry Utilities for Size of Anything
 *
 * This module provides utilities for handling geometric operations on map elements.
 *
 * The polygon dragging implementation uses a projection-based approach to properly transform
 * geometries across different latitudes. This ensures shapes maintain their proper proportions
 * when moved across the map (e.g., shapes get narrower as they move away from the equator).
 *
 * The approach:
 * 1. Find the centroid of the geometry
 * 2. Create a Lambert Azimuthal Equal Area projection centered on that point
 * 3. Project all coordinates to this flat space
 * 4. Apply the translation in the projected space
 * 5. Project back to WGS84 (lat/lng) coordinates
 *
 * This preserves the true shape and size relationships as they would appear on the actual globe.
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

    const centroids = multi.map((ring) => ringCentroid(ring));
    // Calculate the area of each ring using turf.js
    const areas = multi.map((ring) => {
      const coords = ring.map((pt) => [pt.lng, pt.lat]);
      // Ensure the ring is closed
      if (
        coords.length > 0 &&
        (coords[0][0] !== coords[coords.length - 1][0] ||
          coords[0][1] !== coords[coords.length - 1][1])
      ) {
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
  return (
    Array.isArray(coordinates) &&
    coordinates.every((ring: any) => {
      if (!Array.isArray(ring)) return false;
      return ring.every((pt: any) =>
        Array.isArray(pt)
          ? pt.every((p) => p && p.lat != null && p.lng != null)
          : pt && pt.lat != null && pt.lng != null
      );
    })
  );
}

/**
 * Transform polygon coordinates using the hybrid method.
 * - Horizontal movement (longitude): Direct translation
 * - Vertical movement (latitude): Rotation-based transformation
 *
 * This prevents the "spinning" effect when moving shapes horizontally while
 * still maintaining proper north-south distortion.
 */
export function transformPolygonCoordinates(
  latLngs: any,
  latDiff: number,
  lngDiff: number
): any {
  if (!latLngs || !Array.isArray(latLngs) || latLngs.length === 0) {
    console.warn(
      "Invalid latLngs provided to transformPolygonCoordinates",
      latLngs
    );
    return latLngs;
  }

  try {
    // Convert Leaflet latLngs to GeoJSON coordinates
    const geoJsonCoords = convertLatLngsToCoords(latLngs);

    // Create a simple feature to use with our projection function
    const createFeatureFromCoords = (coords: any): GeoJSON.Feature => {
      // Determine if we're dealing with a Polygon or MultiPolygon
      // This is a simplification - in real code we'd need more robust type checking
      const isMultiPolygon =
        Array.isArray(coords[0]) &&
        Array.isArray(coords[0][0]) &&
        Array.isArray(coords[0][0][0]);

      return {
        type: "Feature",
        properties: {},
        geometry: {
          type: isMultiPolygon ? "MultiPolygon" : "Polygon",
          coordinates: coords,
        },
      } as GeoJSON.Feature;
    };

    // Convert to a feature for transformation
    const feature = createFeatureFromCoords(geoJsonCoords);

    // Calculate target position by moving from the current centroid
    const centroid = turf.centroid(feature);
    if (!centroid || !centroid.geometry || !centroid.geometry.coordinates) {
      throw new Error("Failed to compute centroid");
    }

    // Calculate target coordinates by applying the original lat/lng differences
    const [centroidLng, centroidLat] = centroid.geometry.coordinates;
    const targetCoords: [number, number] = [
      centroidLng + lngDiff,
      centroidLat + latDiff,
    ];

    // Use our hybrid approach to get accurately transformed coordinates
    const transformedFeature = hybridProjectAndTranslateGeometry(
      feature as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
      targetCoords
    );

    // Extract the transformed coordinates
    const transformedCoords = (
      transformedFeature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
    ).coordinates;

    // Convert back to Leaflet latLngs
    return convertCoordsToLatLngs(transformedCoords);
  } catch (error) {
    console.error("Error in transformPolygonCoordinates:", error);

    // Fall back to the original simple translation method if the hybrid approach fails
    function translateCoords(coords: any): any {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        // Base case: single [lng, lat]
        return [coords[0] + lngDiff, coords[1] + latDiff];
      }
      return coords.map(translateCoords);
    }

    // Convert Leaflet latLngs -> GeoJSON coords
    const geoJsonCoords = convertLatLngsToCoords(latLngs);

    // Translate coordinates using the old method
    const translatedCoords = translateCoords(geoJsonCoords);

    // Convert back to Leaflet latLngs
    return convertCoordsToLatLngs(translatedCoords);
  }
}

// Enable click-and-drag on a polygon layer to move it interactively
export function enablePolygonDragging(
  geoJsonLayer: L.GeoJSON,
  map: L.Map | null
) {
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

        try {
          // Get the feature associated with this layer for proper transformation
          const feature = (innerLayer as any).feature as
            | GeoJSON.Feature
            | undefined;
          if (feature && feature.geometry) {
            // Deep clone the feature to avoid modifying the original
            const featureToTransform = JSON.parse(JSON.stringify(feature));

            // Calculate the displacement from the drag start position
            const latDiff = e.latlng.lat - dragStartLatLng.lat;
            const lngDiff = e.latlng.lng - dragStartLatLng.lng;

            // Calculate target coordinates based on the original feature's centroid plus the displacement
            const originalCentroid = turf.centroid(featureToTransform);
            const targetCoordinates: [number, number] = [
              originalCentroid.geometry.coordinates[0] + lngDiff,
              originalCentroid.geometry.coordinates[1] + latDiff,
            ];

            // Use our hybrid transformation for accurate shape preservation
            const transformedFeature = hybridProjectAndTranslateGeometry(
              featureToTransform,
              targetCoordinates
            );

            // Convert GeoJSON coordinates to Leaflet LatLngs and update the polygon
            if (
              transformedFeature.geometry.type === "Polygon" ||
              transformedFeature.geometry.type === "MultiPolygon"
            ) {
              const transformedLatLngs = convertCoordsToLatLngs(
                (
                  transformedFeature.geometry as
                    | GeoJSON.Polygon
                    | GeoJSON.MultiPolygon
                ).coordinates
              );
              (innerLayer as L.Polygon).setLatLngs(transformedLatLngs);

              // Update associated marker position immediately
              if (associatedMarker) {
                const newMarkerPosition = findCenterForMarker(
                  innerLayer as L.Polygon
                );
                associatedMarker.setLatLng(newMarkerPosition);
              }
            }
          } else {
            // Fallback to the legacy method if feature is not available
            const latDiff = e.latlng.lat - dragStartLatLng.lat;
            const lngDiff = e.latlng.lng - dragStartLatLng.lng;
            const transformed = transformPolygonCoordinates(
              originalLatLngs,
              latDiff,
              lngDiff
            );
            (innerLayer as L.Polygon).setLatLngs(transformed);

            // Update associated marker position
            if (associatedMarker) {
              const newMarkerPosition = findCenterForMarker(
                innerLayer as L.Polygon
              );
              associatedMarker.setLatLng(newMarkerPosition);
            }
          }
        } catch (error) {
          console.error("Error during polygon drag:", error);

          // Fallback to simple translation on error
          const latDiff = e.latlng.lat - dragStartLatLng.lat;
          const lngDiff = e.latlng.lng - dragStartLatLng.lng;
          const transformed = transformPolygonCoordinates(
            originalLatLngs,
            latDiff,
            lngDiff
          );
          (innerLayer as L.Polygon).setLatLngs(transformed);

          // Update associated marker position
          if (associatedMarker) {
            const newMarkerPosition = findCenterForMarker(
              innerLayer as L.Polygon
            );
            associatedMarker.setLatLng(newMarkerPosition);
          }
        }
      };

      const onMouseUp = async () => {
        // Clean up event listeners
        map?.off("mousemove", onMouseMove);
        map?.off("mouseup", onMouseUp);
        map?.dragging.enable();

        try {
          // Update the feature and store with the final position
          const feature = (innerLayer as any).feature as
            | GeoJSON.Feature
            | undefined;
          if (feature && feature.properties && feature.geometry) {
            const featureIndex = feature.properties.index;
            if (featureIndex !== undefined) {
              // Save the new coordinates after projection-based transformation
              const currentCoords = innerLayer.getLatLngs();
              const convertedCoords = convertLatLngsToCoords(currentCoords);
              (feature.geometry as any).currentCoordinates = convertedCoords;

              const { useMapStore } = await import("../../state/mapStore");
              const store = useMapStore.getState();
              store.updateCurrentCoordinates(
                `geojson-${featureIndex}`,
                convertedCoords
              );

              // Only set as active if it was a click (not a drag)
              if (!hasMoved) {
                store.setActiveArea(`geojson-${featureIndex}`);
              }

              console.log(
                "Updated area position using projection-based transformation"
              );
            }
          }
        } catch (error) {
          console.error("Error saving projected coordinates:", error);
        } finally {
          // Clean up references
          originalLatLngs = null;
          dragStartLatLng = null;
          associatedMarker = null;
        }
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
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    return L.latLng(coords[1], coords[0]); // Note: GeoJSON is [lng, lat], Leaflet is [lat, lng]
  }

  // Otherwise, recurse into the array
  return coords.map((subArray: any) => convertCoordsToLatLngs(subArray));
};

/**
 * Rotate a GeoJSON shape across the sphere without distorting or rotating it.
 * Includes counter-rotation logic to maintain original orientation during horizontal translation.
 *
 * @param feature - Polygon or MultiPolygon GeoJSON feature
 * @param targetCoordinates - [lng, lat] location for new centroid
 * @returns Transformed GeoJSON feature
 */
/**
 * Rotate a GeoJSON feature by the specified angle (in degrees) around its centroid
 *
 * @param feature - The GeoJSON feature to rotate
 * @param angle - Rotation angle in degrees (positive = clockwise)
 * @returns Rotated GeoJSON feature
 */
import proj4 from "proj4";

export function rotateFeature(
  feature: Feature<Polygon | MultiPolygon>,
  angleDegrees: number
): Feature<Polygon | MultiPolygon> {
  // Use original coordinates if available to prevent distortion from multiple rotations
  let featureToRotate = JSON.parse(JSON.stringify(feature));
  if ((featureToRotate.geometry as any).originalCoordinates) {
    featureToRotate.geometry.coordinates = (
      featureToRotate.geometry as any
    ).originalCoordinates;
  }

  // Compute centroid
  const centroid = turf.centroid(featureToRotate);
  const [centerLng, centerLat] = centroid.geometry.coordinates;

  // Convert angle to radians
  const angleRad = (angleDegrees * Math.PI) / 180;

  // Define a local projection centered at the centroid
  const projName = `+proj=tmerc +lat_0=${centerLat} +lon_0=${centerLng} +units=m +datum=WGS84`;
  proj4.defs("LOCAL", projName);

  // Helper: rotate a 2D point (in meters) around origin
  function rotateXY([x, y]: [number, number]): [number, number] {
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    return [x * cosA - y * sinA, x * sinA + y * cosA];
  }

  // Project → Rotate → Unproject
  function rotateCoordinates(coords: any[]): any[] {
    if (typeof coords[0] === "number") {
      // Project to local XY
      const [x, y] = proj4("WGS84", "LOCAL", coords);
      const [xRot, yRot] = rotateXY([x, y]);
      // Unproject back to lat/lng
      return proj4("LOCAL", "WGS84", [xRot, yRot]);
    }
    return coords.map(rotateCoordinates);
  }

  // Deep clone the feature to avoid mutation
  const rotatedFeature: Feature<Polygon | MultiPolygon> = JSON.parse(
    JSON.stringify(feature)
  );
  rotatedFeature.geometry.coordinates = rotateCoordinates(
    feature.geometry.coordinates
  );

  return rotatedFeature;
}

export function projectAndTranslateGeometry(
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  targetCoordinates: [number, number]
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  const radians = (deg: number) => (deg * Math.PI) / 180;
  const degrees = (rad: number) => (rad * 180) / Math.PI;

  // Convert [lng, lat] to 3D unit vector
  function toCartesian([lng, lat]: [number, number]): [number, number, number] {
    const φ = radians(lat);
    const λ = radians(lng);
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
  }

  // Convert 3D vector to [lng, lat]
  function toLngLat([x, y, z]: [number, number, number]): [number, number] {
    const hyp = Math.sqrt(x * x + y * y);
    const lng = degrees(Math.atan2(y, x));
    const lat = degrees(Math.atan2(z, hyp));
    return [lng, lat];
  }

  // Normalize a 3D vector
  function normalize([x, y, z]: [number, number, number]): [
    number,
    number,
    number
  ] {
    const mag = Math.sqrt(x * x + y * y + z * z);
    return [x / mag, y / mag, z / mag];
  }

  // Cross product of two vectors
  function cross(
    a: [number, number, number],
    b: [number, number, number]
  ): [number, number, number] {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0],
    ];
  }

  // Dot product
  function dot(
    a: [number, number, number],
    b: [number, number, number]
  ): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  }

  // Rodrigues' rotation formula
  function rotateVector(
    v: [number, number, number],
    axis: [number, number, number],
    angle: number
  ): [number, number, number] {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dotAV = dot(axis, v);
    const crossAV = cross(axis, v);

    return [
      v[0] * cosA + crossAV[0] * sinA + axis[0] * dotAV * (1 - cosA),
      v[1] * cosA + crossAV[1] * sinA + axis[1] * dotAV * (1 - cosA),
      v[2] * cosA + crossAV[2] * sinA + axis[2] * dotAV * (1 - cosA),
    ];
  }

  // Transform all coordinates
  function transformCoords(coords: any[]): any[] {
    return coords.map((pt: any) => {
      if (typeof pt[0] === "number" && typeof pt[1] === "number") {
        const cart = toCartesian(pt);
        const rotated = rotateVector(cart, rotationAxis, rotationAngle);
        return toLngLat(rotated);
      } else if (Array.isArray(pt)) {
        return transformCoords(pt);
      } else {
        return pt;
      }
    });
  }

  // Step 1: Get original and target unit vectors
  const originalCentroid = turf.centroid(feature).geometry.coordinates as [
    number,
    number
  ];
  const fromVec = normalize(toCartesian(originalCentroid));
  const toVec = normalize(toCartesian(targetCoordinates));

  // Step 2: Compute rotation axis and angle
  const rotationAxis = normalize(cross(fromVec, toVec));
  const rotationAngle = Math.acos(dot(fromVec, toVec));

  // Step 3: Rotate all points
  const rotated = JSON.parse(JSON.stringify(feature));
  rotated.geometry.coordinates = transformCoords(rotated.geometry.coordinates);

  return rotated;
}

/**
 * Hybrid approach for translating geometries.
 * - Horizontal movement (longitude): Direct translation
 * - Vertical movement (latitude): Rotation-based transformation
 *
 * This prevents the "spinning" effect when moving shapes horizontally while
 * still maintaining proper north-south distortion.
 */
export function hybridProjectAndTranslateGeometry(
  feature: GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  targetCoordinates: [number, number]
): GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon> {
  const originalCentroid = turf.centroid(feature).geometry.coordinates as [
    number,
    number
  ];

  // Calculate longitude and latitude differences
  const lngDiff = targetCoordinates[0] - originalCentroid[0];
  const latDiff = targetCoordinates[1] - originalCentroid[1];

  // Clone feature to avoid modifying original
  const result = JSON.parse(JSON.stringify(feature));

  // First pass: Apply horizontal translation directly
  function applyHorizontalTranslation(coords: any[]): any[] {
    if (typeof coords[0] === "number" && typeof coords[1] === "number") {
      // Base case: single [lng, lat] coordinate
      return [coords[0] + lngDiff, coords[1]];
    }
    // Recursive case for nested arrays
    return coords.map(applyHorizontalTranslation);
  }

  // Apply horizontal translation
  result.geometry.coordinates = applyHorizontalTranslation(
    result.geometry.coordinates
  );

  // We need to create a feature that has the horizontally translated coordinates
  // but only apply the vertical rotation component
  const radians = (deg: number) => (deg * Math.PI) / 180;
  const degrees = (rad: number) => (rad * 180) / Math.PI;

  // Convert [lng, lat] to 3D unit vector
  function toCartesian([lng, lat]: [number, number]): [number, number, number] {
    const φ = radians(lat);
    const λ = radians(lng);
    return [Math.cos(φ) * Math.cos(λ), Math.cos(φ) * Math.sin(λ), Math.sin(φ)];
  }

  // Convert 3D vector to [lng, lat]
  function toLngLat([x, y, z]: [number, number, number]): [number, number] {
    const hyp = Math.sqrt(x * x + y * y);
    const lng = degrees(Math.atan2(y, x));
    const lat = degrees(Math.atan2(z, hyp));
    return [lng, lat];
  }

  // Normalize a 3D vector
  function normalize([x, y, z]: [number, number, number]): [
    number,
    number,
    number
  ] {
    const mag = Math.sqrt(x * x + y * y + z * z);
    return [x / mag, y / mag, z / mag];
  }

  // For vertical-only transformation, we need a special approach
  // We'll create vectors that only differ in their vertical component
  const horizontallyTranslatedCentroid = turf.centroid(result).geometry
    .coordinates as [number, number];

  // Create unit vectors for vertical-only transformation
  const fromVector = normalize(toCartesian(horizontallyTranslatedCentroid));
  // For the target vector, we want to keep the same horizontal component but change the vertical
  const toVector = normalize(
    toCartesian([
      horizontallyTranslatedCentroid[0],
      horizontallyTranslatedCentroid[1] + latDiff,
    ])
  );

  // Only if there's vertical movement to apply
  if (Math.abs(latDiff) > 0.000001) {
    // This is the vertical-only rotation logic

    // Cross product and dot product for rotation
    function cross(
      a: [number, number, number],
      b: [number, number, number]
    ): [number, number, number] {
      return [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
    }

    function dot(
      a: [number, number, number],
      b: [number, number, number]
    ): number {
      return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    }

    // Rodrigues' rotation formula for the vertical component
    function rotateVector(
      v: [number, number, number],
      axis: [number, number, number],
      angle: number
    ): [number, number, number] {
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const dotAV = dot(axis, v);
      const crossAV = cross(axis, v);

      return [
        v[0] * cosA + crossAV[0] * sinA + axis[0] * dotAV * (1 - cosA),
        v[1] * cosA + crossAV[1] * sinA + axis[1] * dotAV * (1 - cosA),
        v[2] * cosA + crossAV[2] * sinA + axis[2] * dotAV * (1 - cosA),
      ];
    }

    // Compute rotation axis (should be mostly east-west for vertical movement)
    const rotationAxis = normalize(cross(fromVector, toVector));
    const rotationAngle = Math.acos(
      Math.min(1, Math.max(-1, dot(fromVector, toVector)))
    );

    // Apply the vertical rotation transformation
    function applyVerticalRotation(coords: any[]): any[] {
      if (typeof coords[0] === "number" && typeof coords[1] === "number") {
        // Convert to cartesian, rotate, then back to lng/lat
        const cartesian = toCartesian([coords[0], coords[1]] as [
          number,
          number
        ]);
        const rotated = rotateVector(cartesian, rotationAxis, rotationAngle);
        return toLngLat(rotated);
      }
      return coords.map(applyVerticalRotation);
    }

    // Apply vertical rotation to already horizontally translated coordinates
    result.geometry.coordinates = applyVerticalRotation(
      result.geometry.coordinates
    );
  }

  return result;
}

export function fixMultiPolygon(feature: GeoJSONFeature): GeoJSONFeature {
  const geom = feature.geometry;

  // If it's labeled MultiPolygon but only a single ring is present, and the innermost element is [lng, lat]
  if (
    geom.type === "MultiPolygon" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length > 0 &&
    Array.isArray(geom.coordinates[0]) &&
    Array.isArray(geom.coordinates[0][0]) &&
    typeof geom.coordinates[0][0][0] === "number"
  ) {
    // It’s actually a single polygon, not a multipolygon
    const corrected: GeoJSONFeature = {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: geom.coordinates as any, // safe to treat as Polygon
        coordinateCount: countCoordinates(geom.coordinates as any),
      },
    };
    return corrected;
  }

  return feature;
}
