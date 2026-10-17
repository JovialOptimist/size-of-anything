import { create } from "zustand";
import { useSyncExternalStore } from "react";
import { persist } from "zustand/middleware";
import { defaultUnits, type UnitSystem } from "../geo/format";

export type Theme = "system" | "light" | "dark";
export type Basemap = "map" | "satellite";

export interface Settings {
  theme: Theme;
  units: UnitSystem;
  showBothUnits: boolean;
  labels: "off" | "auto" | "always";
  fill: "light" | "medium" | "strong";
  shapeTools: "panel" | "toolbar";
  basemap: Basemap;
  globe: boolean;
  rememberRecent: boolean;
  seenDragHint: boolean;
  set: <K extends keyof Omit<Settings, "set" | "reset">>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

const defaults = () => ({
  theme: "system" as Theme,
  units: defaultUnits(),
  showBothUnits: true,
  labels: "auto" as const,
  fill: "light" as const,
  shapeTools: "panel" as const,
  basemap: "map" as Basemap,
  globe: false,
  rememberRecent: true,
  seenDragHint: false,
});

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      ...defaults(),
      set: (key, value) => set({ [key]: value } as Partial<Settings>),
      reset: () => set({ ...defaults(), seenDragHint: true }),
    }),
    { name: "soa-settings-v2" }
  )
);

export const FILL_OPACITY = { light: 0.22, medium: 0.35, strong: 0.5 };

/** Resolved dark/light for the UI. */
export function useIsDark(): boolean {
  const theme = useSettings((s) => s.theme);
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  return theme === "dark" || (theme === "system" && prefersDark);
}

export function useMediaQuery(q: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(q);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(q).matches
  );
}
