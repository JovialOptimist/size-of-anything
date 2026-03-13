/**
 * Helpers for converting GeoJSON features to Cesium entities (polygons with optional extrusion).
 */
import {
  Cartesian3,
  PolygonHierarchy,
  Color,
  Entity,
  CustomDataSource,
  CallbackProperty,
} from "cesium";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";

/** Build a PolygonHierarchy from a rings array (outer + holes). */
function ringsToHierarchy(rings: number[][][]): PolygonHierarchy | null {
  const outer = rings[0];
  if (!outer || outer.length < 3) return null;
  const holes = rings.slice(1).map((r) => new PolygonHierarchy(Cartesian3.fromDegreesArray(ringToDegreesArray(r))));
  return new PolygonHierarchy(
    Cartesian3.fromDegreesArray(ringToDegreesArray(outer)),
    holes.length ? holes : undefined
  );
}

function parseColor(cssColor: string | undefined): Color {
  if (!cssColor) return Color.BLUE;
  try {
    return Color.fromCssColorString(cssColor) ?? Color.BLUE;
  } catch {
    return Color.BLUE;
  }
}

/** Flatten a single ring [lng, lat][] to fromDegreesArray format (lng, lat, lng, lat, ...). */
function ringToDegreesArray(ring: number[][]): number[] {
  const out: number[] = [];
  for (const [lng, lat] of ring) {
    out.push(lng, lat);
  }
  return out;
}

/** Get coordinates to use for rendering (currentCoordinates ?? rotatedCoordinates ?? coordinates). */
export function getCoords(feature: GeoJSONFeature): number[][][] | number[][][][] {
  const g = feature.geometry;
  return (g as any).currentCoordinates ?? (g as any).rotatedCoordinates ?? g.coordinates;
}

/**
 * Get coordinates for one polygon part from the full feature coords.
 * - Polygon: partIndex is undefined, returns rings.
 * - MultiPolygon: partIndex is the part index, returns that part's rings.
 */
export type GetCoordsForEntity = (
  featureId: string,
  partIndex?: number
) => number[][][];

/**
 * Create Cesium entities for one GeoJSON feature (one entity for Polygon, one per part for MultiPolygon).
 * Uses CallbackProperty for hierarchy so the polygon reads from live coords each frame (smooth drag).
 */
export function featureToEntities(
  feature: GeoJSONFeature,
  activeAreaId: string | null,
  getCoordsForEntity: GetCoordsForEntity
): Entity[] {
  const featureId = feature.properties?.id ?? (feature.properties?.index != null ? `geojson-${feature.properties.index}` : "");
  if (!featureId) return [];
  const color = parseColor(feature.properties?.color);
  const heightM = Number(feature.properties?.heightInMeters ?? feature.properties?.extrudedHeight ?? 0) || 0;
  const isActive = activeAreaId === featureId;

  const entities: Entity[] = [];
  const geomType = feature.geometry.type;
  if (geomType !== "Polygon" && geomType !== "MultiPolygon") return entities;

  if (geomType === "Polygon") {
    const hierarchyCallback = new CallbackProperty(() => {
      const rings = getCoordsForEntity(featureId, undefined);
      return ringsToHierarchy(rings) ?? new PolygonHierarchy([]);
    }, false);
    const entity = new Entity({
      id: featureId,
      name: featureId,
      polygon: {
        hierarchy: hierarchyCallback,
        material: color.withAlpha(isActive ? 0.5 : 0.4),
        outline: true,
        outlineColor: isActive ? color : color.withAlpha(0.8),
        outlineWidth: isActive ? 4 : 2,
        height: 0,
        extrudedHeight: heightM,
      },
    });
    entities.push(entity);
  } else {
    const parts = (getCoords(feature) as number[][][][]).length;
    for (let i = 0; i < parts; i++) {
      const partIndex = i;
      const hierarchyCallback = new CallbackProperty(() => {
        const rings = getCoordsForEntity(featureId, partIndex);
        return ringsToHierarchy(rings) ?? new PolygonHierarchy([]);
      }, false);
      const entity = new Entity({
        id: `${featureId}-${i}`,
        name: featureId,
        polygon: {
          hierarchy: hierarchyCallback,
          material: color.withAlpha(isActive ? 0.5 : 0.4),
          outline: true,
          outlineColor: isActive ? color : color.withAlpha(0.8),
          outlineWidth: isActive ? 4 : 2,
          height: 0,
          extrudedHeight: heightM,
        },
      });
      entities.push(entity);
    }
  }

  return entities;
}

export function createAreasDataSource(): CustomDataSource {
  return new CustomDataSource("areaPolygons");
}

/** Create highlight (hover) entities for a feature - no extrusion, orange outline. */
export function featureToHoverEntities(feature: GeoJSONFeature): Entity[] {
  const coords = getCoords(feature);
  const color = new Color(1, 69 / 255, 0, 1);
  const entities: Entity[] = [];

  const addOne = (rings: number[][][]) => {
    const outer = rings[0];
    if (!outer || outer.length < 3) return;
    const holes = rings.slice(1).map((r) => new PolygonHierarchy(Cartesian3.fromDegreesArray(ringToDegreesArray(r))));
    const hierarchy = new PolygonHierarchy(
      Cartesian3.fromDegreesArray(ringToDegreesArray(outer)),
      holes.length ? holes : undefined
    );
    entities.push(
      new Entity({
        polygon: {
          hierarchy,
          material: color.withAlpha(0.2),
          outline: true,
          outlineColor: color,
          outlineWidth: 5,
          height: 0,
        },
      })
    );
  };

  if (feature.geometry.type === "Polygon") {
    addOne(coords as number[][][]);
  } else {
    (coords as number[][][][]).forEach(addOne);
  }
  return entities;
}
