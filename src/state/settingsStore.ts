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

  // Pin/marker settings
  pinSettings: PinSettings;
  setPinMode: (mode: PinMode) => void;
  setPinSize: (size: number) => void;
  setLabelMode: (labelMode: LabelMode) => void;
  setFontSize: (fontSize: number) => void;

  // Map display settings
  outlineQuality: OutlineQuality;
  setOutlineQuality: (quality: OutlineQuality) => void;
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
      mapTheme: "light", // Default to match app theme
      setMapTheme: (mapTheme) => set({ mapTheme }),

      // Pin settings with defaults
      pinSettings: {
        mode: "adaptive",
        size: 1.5,
        appearanceThreshold: 0.01,
        labelMode: "always", // Default to always show labels (current behavior)
        fontSize: 14, // Default font size for marker labels (in pixels)
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
    }),
    {
      name: "size-of-anything-settings",
      // Only store actual settings, not the setter functions
      partialize: (state) => ({
        theme: state.theme,
        mapTheme: state.mapTheme,
        pinSettings: state.pinSettings,
        outlineQuality: state.outlineQuality,
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

  // Apply the appropriate filter values based on theme
  if (effectiveMapTheme === "dark") {
    // Dark mode map filter values
    root.style.setProperty("--map-inversion", "1");
    root.style.setProperty("--map-hue-rotate", "192deg");
    root.style.setProperty("--map-brightness", "1.2");
    root.style.setProperty("--map-contrast", "0.9");
    root.style.setProperty("--map-loading-tile-bg", "#21252e");
  } else {
    // Light mode map filter values
    root.style.setProperty("--map-inversion", "0");
    root.style.setProperty("--map-hue-rotate", "0deg");
    root.style.setProperty("--map-brightness", "1");
    root.style.setProperty("--map-contrast", "1");
    root.style.setProperty("--map-loading-tile-bg", "#e5e6e9");
  }
};
