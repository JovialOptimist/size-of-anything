/**
 * Helpers for converting GeoJSON features to Cesium entities (polygons with optional extrusion).
 */
import {
  Cartesian3,
  PolygonHierarchy,
  Color,
  Entity,
  CustomDataSource,
} from "cesium";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";

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
function getCoords(feature: GeoJSONFeature): any {
  const g = feature.geometry;
  return (g as any).currentCoordinates ?? (g as any).rotatedCoordinates ?? g.coordinates;
}

/**
 * Create Cesium entities for one GeoJSON feature (one entity for Polygon, one per part for MultiPolygon).
 */
export function featureToEntities(
  feature: GeoJSONFeature,
  activeAreaId: string | null
): Entity[] {
  const coords = getCoords(feature);
  const featureId = feature.properties?.id ?? feature.properties?.index != null
    ? `geojson-${feature.properties.index}`
    : "";
  const color = parseColor(feature.properties?.color);
  const heightM = Number(feature.properties?.heightInMeters ?? feature.properties?.extrudedHeight ?? 0) || 0;
  const isActive = activeAreaId === featureId;

  const entities: Entity[] = [];

  if (feature.geometry.type === "Polygon") {
    const rings = coords as number[][][];
    const outer = rings[0];
    if (!outer || outer.length < 3) return entities;
    const holes = rings.slice(1).map((r) => new PolygonHierarchy(Cartesian3.fromDegreesArray(ringToDegreesArray(r))));
    const hierarchy = new PolygonHierarchy(
      Cartesian3.fromDegreesArray(ringToDegreesArray(outer)),
      holes.length ? holes : undefined
    );
    const entity = new Entity({
      id: featureId,
      name: featureId,
      polygon: {
        hierarchy,
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
    const parts = coords as number[][][][];
    for (let i = 0; i < parts.length; i++) {
      const rings = parts[i];
      const outer = rings[0];
      if (!outer || outer.length < 3) continue;
      const holes = rings.slice(1).map((r) => new PolygonHierarchy(Cartesian3.fromDegreesArray(ringToDegreesArray(r))));
      const hierarchy = new PolygonHierarchy(
        Cartesian3.fromDegreesArray(ringToDegreesArray(outer)),
        holes.length ? holes : undefined
      );
      const entity = new Entity({
        id: `${featureId}-${i}`,
        name: featureId,
        polygon: {
          hierarchy,
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
