// src/state/panelStore.ts
/**
 * Store for managing the active panel in the sidebar.
 * Controls which panel is currently active and handles panel toggling.
 */
import { create } from "zustand";
import { isMobileDevice } from "../utils/deviceDetection";

interface PanelState {
  activePanel: string | null;
  setActivePanel: (panel: string | null) => void;
  togglePanel: (panel: string) => void;
}

/**
 * Zustand store for managing active panel state
 */
export const usePanel = create<PanelState>((set) => ({
  // Start with text-search panel open, unless we're on mobile
  activePanel: isMobileDevice() ? null : "text-search",
  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? null : panel,
    })),
}));
