/**
 * Water inside borders. OSM boundaries of countries and coastal cities run out to sea (Japan's
 * outline is twice its land area) and around lakes (Seattle's takes in Lake Washington). Shapes
 * can drop the sea, which matches official country totals, or all water, which matches land area.
 *
 * The cut outlines are worked out once per place (see waterCut.ts, loaded on demand) and cached.
 */
import type { AreaGeometry } from "./geometry";
import type { IconKey } from "./categories";
import { idbGet, idbSet } from "../state/idb";

export type WaterMode = "keep" | "sea" | "all";

/** Choices for water inside a border, in Settings and on a shape's page. */
export const WATER_OPTIONS: [WaterMode, string][] = [["keep", "Keep all"], ["sea", "No sea"], ["all", "Land only"]];

export interface WaterCut {
  geometry: AreaGeometry;
  area: number; // m²
}

/** An outline without the sea, and without any water. null where there was none of that to remove. */
export interface Waterless {
  sea: WaterCut | null;
  all: WaterCut | null;
  /** The WATER_VERSION that measured it, so saved shapes can tell when to measure again. */
  v?: string;
}

/** Just the areas, for places kept in the recent list. */
export const dryAreas = (w: Waterless) => ({ sea: w.sea?.area, all: w.all?.area });

/** Whether taking out lakes as well as the sea changes anything. */
export const hasLakes = (w: Waterless) => !!w.all && (!w.sea || w.all.area < w.sea.area * 0.999);

// Borders and areas of land. Not lakes, buildings or sports fields, where removing water makes no sense.
const LAND_ICONS: IconKey[] = ["globe", "map", "city", "village", "island", "park", "forest"];
export const removesWater = (icon: IconKey) => LAND_ICONS.includes(icon);

// Bump when the cutting changes, so places get measured again (saved shapes too, see restoreSession).
export const WATER_VERSION = "v2";
const CACHE = `water:${WATER_VERSION}:`;
const pending = new Map<string, Promise<Waterless | null>>();

/** The waterless outlines for an OSM place if it was measured before, without measuring it. */
export async function cachedWaterless(key: string): Promise<Waterless | null> {
  return (await pending.get(key)) ?? (await idbGet<Waterless>(CACHE + key)) ?? null;
}

/**
 * The waterless outlines for an OSM place, from memory, the browser cache or the tiles. null if it
 * failed; a failure isn't kept, so the next call tries again.
 */
export function waterlessFor(key: string, geometry: AreaGeometry): Promise<Waterless | null> {
  let p = pending.get(key);
  if (!p) {
    p = (async () => {
      const cached = await idbGet<Waterless>(CACHE + key);
      if (cached) return { ...cached, v: WATER_VERSION };
      try {
        const { cutWater } = await import("./waterCut");
        const w = { ...(await cutWater(geometry)), v: WATER_VERSION };
        idbSet(CACHE + key, w);
        return w;
      } catch (e) {
        console.warn("Couldn't measure the water in", key, e);
        pending.delete(key);
        return null;
      }
    })();
    pending.set(key, p);
  }
  return p;
}
