import { useEffect } from "react";
import { useMapStore } from "../state/mapStore";
import { usePanel } from "../state/panelStore";

/**
 * Component to handle keyboard shortcuts throughout the application
 * Implements the following hotkeys:
 * 1. [DEL] - Remove active shape from map
 * 2. [ESC] - Make active shape inactive or collapse sidebar panel
 * 3. [T], [W], [C], [S], [H] - Open corresponding panels
 */
export function KeyboardHandler() {
  // Only select the state values we need to monitor, not the functions
  const activeAreaId = useMapStore((state) => state.activeAreaId);
  const activePanel = usePanel((state) => state.activePanel);

  useEffect(() => {
    const isInCriticalInput = (element: EventTarget | null) => {
      if (!element || !(element instanceof HTMLElement)) return false;

      const tag = element.tagName.toLowerCase();
      const type = (element as HTMLInputElement).type?.toLowerCase() || "";

      return (
        (tag === "input" &&
          (type === "text" ||
            type === "password" ||
            type === "email" ||
            type === "search" ||
            type === "number" ||
            type === "")) ||
        tag === "textarea" ||
        element.contentEditable === "true" ||
        tag === "button" ||
        tag === "a"
      );
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard shortcuts if user is typing in a text field
      if (isInCriticalInput(document.activeElement)) {
        return;
      }

      switch (event.key) {
        case "Delete":
          // When there's an active shape, [DEL] removes it from the map
          if (activeAreaId !== null) {
            // Get the fresh function reference directly from the store
            useMapStore.getState().removeArea(activeAreaId);
            event.preventDefault();
          }
          break;

        case "Escape":
          // When there's an active shape, [ESC] makes it inactive
          if (activeAreaId !== null) {
            useMapStore.getState().setActiveArea(null);
          }
          // When there is no active shape, [ESC] collapses the sidebar panel
          else if (activePanel !== null) {
            usePanel.getState().setActivePanel(null);
          }
          break;

        case "t":
        case "T":
          // Open TextSearchPanel
          usePanel.getState().togglePanel("text-search");
          event.preventDefault();
          break;

        case "w":
        case "W":
          // Toggle magic wand mode in TextSearchPanel
          usePanel.getState().setActivePanel("text-search");
          // If TextSearchPanel is already open, toggle magic wand mode
          if (activePanel === "text-search") {
            const mapStore = useMapStore.getState();
            if (mapStore.magicWandMode) {
              // Deactivate magic wand
              mapStore.setMagicWandMode(false);
              mapStore.setOnMapClick(null);
              mapStore.setHoveredCandidate(null);
            } else {
              // Activate magic wand
              mapStore.setMagicWandMode(true);
              // We can't directly set the click handler here as that's managed by TextSearchPanel
            }
          }
          event.preventDefault();
          break;

        case "c":
        case "C":
          // Open CustomAreaPanel
          usePanel.getState().togglePanel("custom-area");
          event.preventDefault();
          break;

        case "s":
        case "S":
          // Open SpecialPanel
          usePanel.getState().togglePanel("special");
          event.preventDefault();
          break;

        case "h":
        case "H":
          // Open HistoryPanel
          usePanel.getState().togglePanel("history");
          event.preventDefault();
          break;
      }
    };

    // Add keyboard event listener
    document.addEventListener("keydown", handleKeyDown);

    // Clean up function
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeAreaId, activePanel]); // Only depend on the state values, not the functions

  // This component doesn't render anything
  return null;
}

export default KeyboardHandler;
