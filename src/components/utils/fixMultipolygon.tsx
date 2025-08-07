import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { countCoordinates } from "./geometryUtils";

function fixMultiPolygon(feature: GeoJSONFeature): GeoJSONFeature {
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
export default fixMultiPolygon;
