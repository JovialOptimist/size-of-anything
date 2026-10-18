import { useEffect } from "react";
import { useUI, currentRoute } from "../state/ui";
import { useShapes } from "../state/shapes";
import { nudge, rotateBy } from "../map/interaction";
import { deleteShape, duplicateShape, undo } from "./actions";

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const ui = useUI.getState();
      const { selectedId } = useShapes.getState();
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) useShapes.getState().redo();
        else undo();
        return;
      }
      if (e.key === "/" && !mod) {
        e.preventDefault();
        ui.go({ name: "search" });
        return;
      }
      if (e.key === "?") return ui.set({ helpPage: "help", settingsOpen: false });
      if (e.key === "Escape") {
        if (ui.layersOpen) return ui.set({ layersOpen: false });
        if (ui.settingsOpen) return ui.set({ settingsOpen: false });
        if (selectedId) {
          useShapes.getState().select(null);
          if (currentRoute(ui).name === "detail") ui.home();
          return;
        }
        if (ui.stack.length > 1) ui.back();
        return;
      }
      if (!selectedId) return;
      const step = e.shiftKey ? 120 : 20;
      const moves: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
      if (moves[e.key] && !t.closest(".maplibregl-canvas-container")) {
        e.preventDefault();
        nudge(selectedId, ...moves[e.key]);
      } else if (e.key === "[" || e.key === "]") {
        rotateBy(selectedId, e.key === "]" ? 15 : -15);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteShape(selectedId);
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateShape(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
