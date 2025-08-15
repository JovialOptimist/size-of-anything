// src/utils/osmFetcher.ts
/**
 * Utility for fetching OSM data by ID for the improved sharing functionality
 * This allows us to store just OSM IDs in the URL and fetch the full geometry when needed
 */
import type { GeoJSONFeature } from "../state/mapStoreTypes";
import { countCoordinates } from "../components/utils/geometryUtils";
import { describeOsmObject } from "../components/utils/describeOsmObject";

// Interface for minimal OSM reference data stored in URL
export interface OsmReference {
  osmId: string;
  osmType: string; // 'way', 'relation', 'node'
  name?: string;
  color?: string;
  rotation?: number;
}

/**
 * Fix multipolygon to ensure it has the correct format
 */
function fixMultiPolygon(feature: GeoJSONFeature): GeoJSONFeature {
  // If it's already a MultiPolygon, no change needed
  if (feature.geometry.type === "MultiPolygon") {
    return feature;
  }

  // If it's a Polygon, ensure coordinates are properly nested
  if (feature.geometry.type === "Polygon") {
    // Convert single polygons with holes into multipolygons if needed
    if (
      Array.isArray(feature.geometry.coordinates) &&
      feature.geometry.coordinates.length > 1
    ) {
      // This polygon has holes - best to keep as Polygon
      return feature;
    }
    return feature;
  }

  return feature;
}

/**
 * Convert OSM type from Nominatim format to Overpass format
 * Nominatim: 'way', 'relation', 'node'
 * Overpass format for lookup: 'W', 'R', 'N'
 */
export function osmTypeToPrefix(osmType: string): string {
  switch (osmType.toLowerCase()) {
    case "way":
      return "W";
    case "relation":
      return "R";
    case "node":
      return "N";
    default:
      return "R";
  }
}

/**
 * Fetch OSM geometry by ID
 * @param osmReferences Array of OSM references to fetch
 * @returns Array of GeoJSON features with geometries
 */
export async function fetchOsmGeometries(
  osmReferences: OsmReference[]
): Promise<GeoJSONFeature[]> {
  console.log(
    "[osmFetcher] Starting fetchOsmGeometries with references:",
    osmReferences
  );

  if (osmReferences.length === 0) {
    console.log(
      "[osmFetcher] No OSM references provided, returning empty array"
    );
    return [];
  }

  try {
    // Format OSM IDs for Nominatim lookup
    const nominatimIds = osmReferences.map(
      (ref) => `${osmTypeToPrefix(ref.osmType)}${ref.osmId}`
    );
    console.log("[osmFetcher] Formatted nominatimIds:", nominatimIds);

    // Split into batches of 50 as Nominatim has a limit
    const batchSize = 50;
    const batches = [];

    for (let i = 0; i < nominatimIds.length; i += batchSize) {
      batches.push(nominatimIds.slice(i, i + batchSize));
    }
    console.log("[osmFetcher] Created batches:", batches);

    // Process each batch and combine results
    const features: GeoJSONFeature[] = [];

    for (const batch of batches) {
      const nominatimUrl = `https://nominatim.openstreetmap.org/lookup?osm_ids=${batch.join(
        ","
      )}&format=json&polygon_geojson=1&extratags=1`;
      console.log("[osmFetcher] Fetching from URL:", nominatimUrl);

      const nominatimResponse = await fetch(nominatimUrl);
      console.log(
        "[osmFetcher] Fetch response status:",
        nominatimResponse.status
      );

      if (!nominatimResponse.ok) {
        console.warn(
          `[osmFetcher] Nominatim API error for batch: ${nominatimResponse.statusText}`
        );
        continue;
      }

      const nominatimData = await nominatimResponse.json();
      console.log("[osmFetcher] Received nominatimData:", nominatimData);

      // Process each Nominatim result into a GeoJSON feature
      const batchFeatures = nominatimData
        .filter((place: any) => {
          // Ensure it has valid GeoJSON
          const hasValidGeojson =
            place.geojson &&
            (place.geojson.type === "Polygon" ||
              place.geojson.type === "MultiPolygon");
          if (!hasValidGeojson) {
            console.log(
              "[osmFetcher] Filtering out place without valid GeoJSON:",
              place
            );
          }
          return hasValidGeojson;
        })
        .map((place: any) => {
          // Find the original reference to get color and other properties
          const osmIndex = `${place.osm_type}_${place.osm_id}`.toLowerCase();
          const originalRef = osmReferences.find(
            (ref) => `${ref.osmType}_${ref.osmId}`.toLowerCase() === osmIndex
          );

          console.log(
            "[osmFetcher] Processing place:",
            place.osm_id,
            "with matched ref:",
            originalRef
          );

          // Create a GeoJSON feature
          const feature: GeoJSONFeature = {
            type: "Feature" as "Feature",
            geometry: {
              type:
                place.geojson.type === "Polygon" ? "Polygon" : "MultiPolygon",
              coordinates: place.geojson.coordinates,
              coordinateCount: countCoordinates(place.geojson.coordinates),
            },
            properties: {
              // Generate a unique ID that will be stable for this OSM object
              id: `osm-${place.osm_type}-${place.osm_id}`,
              name: originalRef?.name || place.display_name,
              osmType: place.osm_type,
              osmId: place.osm_id.toString(),
              osmClass: place.class,
              customId: place.customId || null,
              whatIsIt: describeOsmObject(place),
              color: originalRef?.color || "#3388ff", // Apply color with fallback
              rotation: originalRef?.rotation || 0,
              // Additional properties
              tags: place.extratags || {},
              // Add index for backward compatibility
              index: features.length + 1,
            },
          };

          const fixedFeature = fixMultiPolygon(feature);
          console.log("[osmFetcher] Created feature:", fixedFeature);
          return fixedFeature;
        });

      console.log(
        "[osmFetcher] Processed batch features:",
        batchFeatures.length
      );
      features.push(...batchFeatures);
    }

    console.log("[osmFetcher] Returning total features:", features.length);
    return features;
  } catch (error) {
    console.error("[osmFetcher] Error fetching OSM geometries:", error);
    throw new Error(`Failed to fetch OSM geometries: ${error}`);
  }
}

/**
 * Check if a feature is an OSM-based feature (has osmId and osmType)
 */
export function isOsmFeature(feature: GeoJSONFeature): boolean {
  // A feature is an OSM feature if it has a non-null osmId
  // and its osmClass doesn't start with 'custom-'
  const result = Boolean(
    feature.properties &&
      feature.properties.osmId !== null &&
      feature.properties.osmType &&
      !(
        feature.properties.osmClass &&
        feature.properties.osmClass.startsWith("custom-")
      )
  );
  console.log(
    "[osmFetcher] isOsmFeature check for",
    feature.properties?.name,
    ":",
    result,
    feature.properties
  );
  return result;
}

/**
 * Check if a feature is a custom user-drawn shape
 */
export function isCustomShape(feature: GeoJSONFeature): boolean {
  // Check if the feature has a customId (non-null value indicates custom shape)
  // or if it has an osmClass that starts with 'custom-'
  const result = Boolean(
    feature.properties &&
      (feature.properties.customId !== null ||
        (feature.properties.osmClass &&
          feature.properties.osmClass.startsWith("custom-")))
  );
  console.log(
    "[osmFetcher] isCustomShape check for",
    feature.properties?.name,
    ":",
    result,
    feature.properties
  );
  return result;
}
