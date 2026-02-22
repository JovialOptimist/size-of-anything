import { useEffect } from "react";
import { useMapStore } from "../state/mapStore";
import { usePanel } from "../state/panelStore";

/**
 * Component to handle keyboard shortcuts throughout the application.
 * [DEL] - Remove active shape from map.
 * [ESC] - Make active shape inactive or collapse sidebar panel.
 */
export function KeyboardHandler() {
  const activeAreaId = useMapStore((state) => state.activeAreaId);
  const activePanel = usePanel((state) => state.activePanel);

  useEffect(() => {
    const isInCriticalInput = (element: EventTarget | null) => {
      if (!element || !(element instanceof HTMLElement)) return false;
      const tag = element.tagName.toLowerCase();
      const type = (element as HTMLInputElement).type?.toLowerCase() || "";
      return (
        (tag === "input" &&
          (type === "text" || type === "password" || type === "email" || type === "search" || type === "number" || type === "")) ||
        tag === "textarea" ||
        element.contentEditable === "true" ||
        tag === "button" ||
        tag === "a"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isInCriticalInput(document.activeElement)) return;

      switch (event.key) {
        case "Delete":
          if (activeAreaId !== null) {
            useMapStore.getState().removeArea(activeAreaId);
            event.preventDefault();
          }
          break;
        case "Escape":
          if (activeAreaId !== null) {
            useMapStore.getState().setActiveArea(null);
          } else if (activePanel !== null) {
            usePanel.getState().setActivePanel(null);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeAreaId, activePanel]);

  // This component doesn't render anything
  return null;
}

export default KeyboardHandler;
