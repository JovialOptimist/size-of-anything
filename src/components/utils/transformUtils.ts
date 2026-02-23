import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import proj4 from "proj4";

/**
 * Utility functions for handling geometric transformations
 * that keeps rotation and translation as separate operations
 */

/**
 * Apply rotation to a feature's coordinates without modifying the original feature
 *
 * @param feature - The GeoJSON feature to rotate
 * @param angleDegrees - Rotation angle in degrees
 * @param baseCoordinates - Base coordinates to use (optional, defaults to feature.geometry.coordinates)
 * @returns A new feature with rotated coordinates
 */
export function applyRotation(
  feature: Feature<Polygon | MultiPolygon>,
  angleDegrees: number,
  baseCoordinates?: any
): Feature<Polygon | MultiPolygon> {
  // Skip if no rotation
  if (!angleDegrees || angleDegrees === 0)
    return JSON.parse(JSON.stringify(feature));

  // Create a deep copy of the feature to avoid modifying the original
  let featureToRotate = JSON.parse(JSON.stringify(feature));

  // Determine which coordinates to use as the base for rotation:
  // 1. Use explicitly provided baseCoordinates if available
  // 2. Use currentCoordinates if available (position after movement)
  // 3. Fall back to the original coordinates otherwise
  if (baseCoordinates) {
    featureToRotate.geometry.coordinates = baseCoordinates;
  } else if (featureToRotate.geometry.currentCoordinates) {
    // Use current position (after any dragging) as base
    featureToRotate.geometry.coordinates =
      featureToRotate.geometry.currentCoordinates;
  } else if (featureToRotate.geometry.originalCoordinates) {
    // Fall back to original coordinates if needed
    featureToRotate.geometry.coordinates =
      featureToRotate.geometry.originalCoordinates;
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

  // Apply the rotation to the coordinates
  const rotatedFeature: Feature<Polygon | MultiPolygon> = JSON.parse(
    JSON.stringify(feature)
  );
  rotatedFeature.geometry.coordinates = rotateCoordinates(
    featureToRotate.geometry.coordinates
  );

  return rotatedFeature;
}

/**
 * Flip a feature's coordinates left-to-right (mirror over the vertical axis through its centroid).
 *
 * @param feature - The GeoJSON feature to flip
 * @param baseCoordinates - Base coordinates to use (optional, defaults to feature.geometry.coordinates or currentCoordinates)
 * @returns A new feature with flipped coordinates
 */
export function applyFlipHorizontal(
  feature: Feature<Polygon | MultiPolygon>,
  baseCoordinates?: any
): Feature<Polygon | MultiPolygon> {
  const featureCopy = JSON.parse(JSON.stringify(feature));
  const coords =
    baseCoordinates ??
    featureCopy.geometry.currentCoordinates ??
    featureCopy.geometry.coordinates;
  featureCopy.geometry.coordinates = coords;

  const centroid = turf.centroid(featureCopy);
  const [centerLng] = centroid.geometry.coordinates;

  function flipCoords(coord: any): any {
    if (typeof coord[0] === "number") {
      return [2 * centerLng - coord[0], coord[1], ...(coord.slice(2) ?? [])];
    }
    return coord.map(flipCoords);
  }

  const flippedFeature: Feature<Polygon | MultiPolygon> = JSON.parse(
    JSON.stringify(feature)
  );
  flippedFeature.geometry.coordinates = flipCoords(coords);
  return flippedFeature;
}
