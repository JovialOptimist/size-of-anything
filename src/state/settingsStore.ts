// src/state/settingsStore.ts
/**
 * Store for managing application settings.
 * Handles theme settings, marker display options, and other app preferences.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Theme settings
export type ThemeMode = "light" | "dark" | "system";

// Map theme settings
export type MapThemeMode = "light" | "dark" | "system";

// Map layer settings
export type MapLayerType = "osm" | "satellite";

// Pin marker settings
export type PinMode = "disabled" | "adaptive" | "always";
export type LabelMode = "disabled" | "always" | "onlyMarker";

export interface PinSettings {
  mode: PinMode;
  size: number;
  appearanceThreshold: number;
  labelMode: LabelMode;
  fontSize: number;
}

// Outline quality setting (for shape simplification)
export type OutlineQuality = "perfect" | "great" | "good" | "low";

// Complete settings state interface
export interface SettingsState {
  // Theme settings
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  getSystemPreference: () => "light" | "dark";

  // Map theme settings
  mapTheme: MapThemeMode;
  setMapTheme: (mapTheme: MapThemeMode) => void;

  // Map layer settings
  mapLayerType: MapLayerType;
  setMapLayerType: (layerType: MapLayerType) => void;

  // Pin/marker settings
  pinSettings: PinSettings;
  setPinMode: (mode: PinMode) => void;
  setPinSize: (size: number) => void;
  setLabelMode: (labelMode: LabelMode) => void;
  setFontSize: (fontSize: number) => void;

  // Map display settings
  outlineQuality: OutlineQuality;
  setOutlineQuality: (quality: OutlineQuality) => void;

  // High contrast mode
  highContrastMode: boolean;
  setHighContrastMode: (highContrastMode: boolean) => void;

  // Units display settings
  useMetricUnits: boolean;
  setUseMetricUnits: (useMetricUnits: boolean) => void;
}

// Check for system preference
export const getSystemPreference = (): "light" | "dark" => {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
};

// Get the initial theme from localStorage or use system preference
const getInitialTheme = (): ThemeMode => {
  if (typeof window === "undefined") return "system";
  const savedTheme = localStorage.getItem("theme") as ThemeMode | null;
  return savedTheme || "system";
};

// Create the settings store with persistence
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      // Theme settings
      theme: getInitialTheme(),
      setTheme: (theme) => {
        localStorage.setItem("theme", theme);
        set({ theme });
      },
      getSystemPreference: () => {
        if (typeof window === "undefined") return "light";
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      },

      // Map theme settings
      mapTheme: "system", // Default to match app theme
      setMapTheme: (mapTheme) => set({ mapTheme }),

      // Map layer settings
      mapLayerType: "osm", // Default to OSM
      setMapLayerType: (layerType) => set({ mapLayerType: layerType }),

      // Pin settings with defaults
      pinSettings: {
        mode: "adaptive",
        size: 1.5,
        appearanceThreshold: 0.01,
        labelMode: "always", // Default to always show labels (current behavior)
        fontSize: 24, // Default font size for marker labels (in pixels)
      },
      setPinMode: (mode) =>
        set((state) => ({
          pinSettings: { ...state.pinSettings, mode },
        })),
      setPinSize: (size) =>
        set((state) => ({
          pinSettings: { ...state.pinSettings, size },
        })),
      setLabelMode: (labelMode) =>
        set((state) => ({
          pinSettings: { ...state.pinSettings, labelMode },
        })),
      setFontSize: (fontSize) =>
        set((state) => ({
          pinSettings: { ...state.pinSettings, fontSize },
        })),

      // Map display settings
      outlineQuality: "great", // Default to "Great" quality
      setOutlineQuality: (quality) => set({ outlineQuality: quality }),

      // High contrast mode
      highContrastMode: false, // Default to normal contrast
      setHighContrastMode: (highContrastMode) => set({ highContrastMode }),

      // Units display settings
      useMetricUnits: true, // Default to metric units
      setUseMetricUnits: (useMetricUnits) => set({ useMetricUnits }),
    }),
    {
      name: "size-of-anything-settings",
      // Only store actual settings, not the setter functions
      partialize: (state) => ({
        theme: state.theme,
        mapTheme: state.mapTheme,
        mapLayerType: state.mapLayerType,
        pinSettings: state.pinSettings,
        outlineQuality: state.outlineQuality,
        highContrastMode: state.highContrastMode,
        useMetricUnits: state.useMetricUnits,
      }),
    }
  )
);

// Apply theme to document
export const applyTheme = (theme: ThemeMode): void => {
  const root = document.documentElement;
  const effectiveTheme = theme === "system" ? getSystemPreference() : theme;

  if (effectiveTheme === "dark") {
    root.classList.add("dark-mode");
  } else {
    root.classList.remove("dark-mode");
  }
};

// Apply map theme by setting CSS filter variables
export const applyMapTheme = (
  mapTheme: MapThemeMode,
  appTheme: ThemeMode
): void => {
  // Get the root element to modify CSS variables
  const root = document.documentElement;
  if (!root) return;

  // Determine the effective map theme
  let effectiveMapTheme: "light" | "dark";

  if (mapTheme === "system") {
    // "Match App" option - use the app theme
    effectiveMapTheme =
      appTheme === "system" ? getSystemPreference() : appTheme;
  } else {
    // "Light" or "Dark" option - use directly
    effectiveMapTheme = mapTheme;
  }

  // Get the high contrast mode setting
  const { highContrastMode } = useSettings.getState();

  // Apply the appropriate filter values based on theme
  if (effectiveMapTheme === "dark") {
    // Dark mode map filter values
    root.style.setProperty("--map-inversion", "0");
    root.style.setProperty("--map-hue-rotate", "0deg");
    root.style.setProperty("--map-brightness", "0.6");
    root.style.setProperty("--map-contrast", highContrastMode ? "3" : "2");
    root.style.setProperty("--map-loading-tile-bg", "#a39f98");
  } else {
    // Light mode map filter values
    root.style.setProperty("--map-inversion", "0");
    root.style.setProperty("--map-hue-rotate", "0deg");
    root.style.setProperty("--map-brightness", highContrastMode ? "0.8" : "1");
    root.style.setProperty("--map-contrast", highContrastMode ? "2" : "1");
    root.style.setProperty("--map-loading-tile-bg", "#f2efe9");
  }
};
