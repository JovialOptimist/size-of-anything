// src/state/settingsStore.ts
/**
 * Store for managing application settings.
 * Handles theme settings, marker display options, and other app preferences.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Theme settings
export type ThemeMode = "light" | "dark" | "system";

// Pin marker settings
export type PinMode = "disabled" | "adaptive" | "always";

export interface PinSettings {
  mode: PinMode;
  size: number;
  appearanceThreshold: number;
}

// Complete settings state interface
export interface SettingsState {
  // Theme settings
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Pin/marker settings
  pinSettings: PinSettings;
  setPinMode: (mode: PinMode) => void;
  setPinSize: (size: number) => void;
}

// Check for system preference
const getSystemPreference = (): "light" | "dark" => {
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

      // Pin settings with defaults
      pinSettings: {
        mode: "adaptive",
        size: 1.5,
        appearanceThreshold: 1.0,
      },
      setPinMode: (mode) =>
        set((state) => ({
          pinSettings: { ...state.pinSettings, mode },
        })),
      setPinSize: (size) =>
        set((state) => ({
          pinSettings: { ...state.pinSettings, size },
        })),
    }),
    {
      name: "size-of-anything-settings",
      // Only store actual settings, not the setter functions
      partialize: (state) => ({
        theme: state.theme,
        pinSettings: state.pinSettings,
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
