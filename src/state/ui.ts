import { create } from "zustand";
import type { PlaceResult } from "../geo/services";

export type Route =
  | { name: "home" }
  | { name: "search" }
  | { name: "detail"; id: string }
  | { name: "create" }
  | { name: "objects" }
  | { name: "settings" }
  | { name: "help" }
  | { name: "about" }
  | { name: "pick" }
  | { name: "draw" };

export type Mode = "browse" | "pick" | "draw-lasso" | "draw-points" | "move-to";

export interface RecentItem extends PlaceResult {
  area?: number;
}

interface UIState {
  stack: Route[];
  mode: Mode;
  menuOpen: boolean;
  shareOpen: boolean;
  layersOpen: boolean;
  sheetSnap: "peek" | "half" | "full";
  announce: string;
  recent: RecentItem[];
  go: (r: Route) => void;
  back: () => void;
  home: () => void;
  setMode: (m: Mode) => void;
  set: (patch: Partial<Omit<UIState, "go" | "back" | "home" | "setMode" | "set" | "pushRecent">>) => void;
  pushRecent: (r: RecentItem) => void;
}

const loadRecent = (): RecentItem[] => {
  try {
    return JSON.parse(localStorage.getItem("soa-recent") || "[]");
  } catch {
    return [];
  }
};

export const useUI = create<UIState>((set, get) => ({
  stack: [{ name: "home" }],
  mode: "browse",
  menuOpen: false,
  shareOpen: false,
  layersOpen: false,
  sheetSnap: "peek",
  announce: "",
  recent: loadRecent(),
  go: (r) => set((s) => ({ stack: s.stack[s.stack.length - 1].name === r.name && r.name !== "detail" ? s.stack : [...s.stack.filter((x) => x.name !== r.name || r.name === "home"), r], menuOpen: false })),
  back: () => set((s) => ({ stack: s.stack.length > 1 ? s.stack.slice(0, -1) : s.stack })),
  home: () => set({ stack: [{ name: "home" }] }),
  setMode: (m) => set({ mode: m }),
  set: (patch) => set(patch),
  pushRecent: (r) => {
    const next = [r, ...get().recent.filter((x) => x.key !== r.key)].slice(0, 12);
    set({ recent: next });
    try {
      localStorage.setItem("soa-recent", JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  },
}));

export const currentRoute = (s: { stack: Route[] }) => s.stack[s.stack.length - 1];

export function announce(text: string) {
  useUI.setState({ announce: "" });
  setTimeout(() => useUI.setState({ announce: text }), 30);
}
