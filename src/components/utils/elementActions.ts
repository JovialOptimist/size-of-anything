// src/components/utils/elementActions.ts
/**
 * Shared helpers for the prototype selection toolbar and comparison tray:
 * area formatting and rotating a placed shape.
 */
import { useMapStore } from "../../state/mapStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { applyRotation } from "./transformUtils";

const KM2_TO_MI2 = 0.386102;
const M2_TO_SQFT = 10.7639;

const withCommas = (num: number) => num.toLocaleString("en-US", { maximumFractionDigits: 2 });

/** Format an area in km² for display, e.g. "3.41 km²", "2,450 m²", "1.32 sq mi". */
export function formatArea(km2: number, metric: boolean): string {
  if (metric) {
    if (km2 >= 1e6) return `${withCommas(Number((km2 / 1e6).toFixed(2)))} million km²`;
    if (km2 >= 1e3) return `${withCommas(Math.round(km2))} km²`;
    if (km2 < 0.1) return `${withCommas(Math.round(km2 * 1e6))} m²`;
    return `${km2.toFixed(2)} km²`;
  }
  const mi2 = km2 * KM2_TO_MI2;
  if (mi2 >= 1e6) return `${withCommas(Number((mi2 / 1e6).toFixed(2)))} million sq mi`;
  if (mi2 >= 1e3) return `${withCommas(Math.round(mi2))} sq mi`;
  if (km2 < 0.1) return `${withCommas(Math.round(km2 * 1e6 * M2_TO_SQFT))} sq ft`;
  return `${mi2.toFixed(2)} sq mi`;
}

/** Format a size ratio, e.g. 1.6, 42, 1,200. */
export function formatRatio(ratio: number): string {
  if (ratio >= 100) return withCommas(Math.round(ratio));
  if (ratio >= 10) return ratio.toFixed(0);
  return ratio.toFixed(1);
}

/** Rotate a placed shape to an absolute angle in degrees, matching the rotation wheel's behaviour. */
export function rotateElement(id: string, angle: number): void {
  const { geojsonAreas, updateElementRotation } = useMapStore.getState();
  const element = geojsonAreas.find((f: GeoJSONFeature) => f.properties.id === id);
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  if (!element || normalized === 0) {
    updateElementRotation(id, 0);
    return;
  }
  try {
    const base = element.geometry.currentCoordinates || element.geometry.coordinates;
    const rotated = applyRotation(
      element as unknown as Parameters<typeof applyRotation>[0],
      normalized,
      base
    );
    updateElementRotation(id, normalized, rotated.geometry.coordinates);
  } catch (error) {
    console.error("Error applying rotation:", error);
    updateElementRotation(id, normalized);
  }
}
