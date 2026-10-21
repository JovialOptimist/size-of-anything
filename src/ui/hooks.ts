import { useEffect, useMemo, useState } from "react";
import { useIsDark, useMediaQuery, useSettings } from "../state/settings";
import { shapeColor } from "../map/palette";
import { geometryArea } from "../geo/geometry";
import { removesWater, waterlessFor, type Waterless } from "../geo/water";
import type { Outline } from "../geo/services";

/**
 * A place's area with the water setting applied, for previews before it's on the map, so Japan
 * doesn't show twice its size in search and then shrink once added. As mapped until measured.
 */
export function useOutlineArea(o: Outline | undefined): number | undefined {
  const mode = useSettings((s) => s.water);
  const [measured, setMeasured] = useState<{ key: string; w: Waterless | null }>();
  const cuts = !!o && mode !== "keep" && removesWater(o.icon);
  useEffect(() => {
    if (!o || !cuts) return;
    let live = true;
    waterlessFor(o.key, o.geometry).then((w) => live && setMeasured({ key: o.key, w }));
    return () => {
      live = false;
    };
  }, [o, cuts]);
  const asMapped = useMemo(() => o && geometryArea(o.geometry), [o]);
  const cut = mode !== "keep" && cuts && measured?.key === o?.key ? measured?.w?.[mode] : undefined;
  return cut?.area ?? asMapped;
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
