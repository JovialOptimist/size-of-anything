import { create } from "zustand";

interface PanelState {
  activePanel: string | null;
  setActivePanel: (panel: string | null) => void;
  togglePanel: (panel: string) => void;
}

/**
 * Zustand store for managing active panel state
 */
export const usePanel = create<PanelState>((set) => ({
  activePanel: "text-search", // Start with text-search panel open
  setActivePanel: (panel) => set({ activePanel: panel }),
  togglePanel: (panel) =>
    set((state) => ({
      activePanel: state.activePanel === panel ? null : panel,
    })),
}));
