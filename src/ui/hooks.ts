import { useEffect, useMemo, useState } from "react";
import { useIsDark, useMediaQuery, useSettings } from "../state/settings";
import { shapeColor } from "../map/palette";
import { geometryArea, type AreaGeometry } from "../geo/geometry";
import { hasLakes, removesWater, waterlessFor, type Waterless } from "../geo/water";
import type { Outline } from "../geo/services";

export interface WaterOutline {
  /** The outline to draw and its area, with the water setting applied once measured. */
  geometry: AreaGeometry;
  area: number;
  asMapped: number;
  /** The outline as mapped, when water was taken out of `geometry`. */
  original?: AreaGeometry;
  /** What was taken out, or (Keep all) how much water is in: for the caption under previews. */
  removed?: "sea" | "lakes" | "sea and lakes";
  waterIn?: number;
}

/**
 * A place with the water setting applied, for previews before it's on the map, so Japan doesn't
 * show twice its size in search and then shrink once added. It draws as mapped straight away and
 * switches once measured (cached after the first time), rather than making people wait.
 */
export function useWaterOutline(o: Outline | undefined | null): WaterOutline | undefined {
  const mode = useSettings((s) => s.water);
  const [measured, setMeasured] = useState<{ key: string; w: Waterless | null }>();
  const eligible = !!o && removesWater(o.icon);
  useEffect(() => {
    if (!o || !eligible) return;
    let live = true;
    waterlessFor(o.key, o.geometry).then((w) => live && setMeasured({ key: o.key, w }));
    return () => {
      live = false;
    };
  }, [o, eligible]);
  const asMapped = useMemo(() => (o ? geometryArea(o.geometry) : 0), [o]);
  if (!o) return undefined;
  const w = eligible && measured?.key === o.key ? measured.w : null;
  const cut = mode === "keep" ? undefined : (w?.[mode] ?? undefined);
  const base = { geometry: o.geometry, area: asMapped, asMapped };
  if (!w) return base;
  if (!cut) {
    const dry = w.all ?? w.sea;
    return mode === "keep" && dry ? { ...base, waterIn: asMapped - dry.area } : base;
  }
  const lakes = mode === "all" && hasLakes(w);
  return { ...base, geometry: cut.geometry, area: cut.area, original: o.geometry, removed: w.sea && lakes ? "sea and lakes" : lakes ? "lakes" : "sea" };
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)");
}

export function useDarkMap() {
  const isDark = useIsDark();
  const basemap = useSettings((s) => s.basemap);
  return isDark || basemap === "satellite";
}

/** A swatch color that reads on the panel surface (light tone in light UI, dark tone in dark UI). */
export function useSwatch() {
  const isDark = useIsDark();
  return (slot: number) => shapeColor(slot, isDark);
}
