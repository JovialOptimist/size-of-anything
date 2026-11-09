import { useIsDark, useMediaQuery } from "../state/settings";
import { shapeColor } from "../map/palette";

export function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)");
}

/** A swatch color that reads on the panel surface (light tone in light UI, dark tone in dark UI). */
export function useSwatch() {
  const isDark = useIsDark();
  return (slot: number) => shapeColor(slot, isDark);
}
