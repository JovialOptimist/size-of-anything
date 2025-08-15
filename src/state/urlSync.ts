// src/state/urlSync.ts
/**
 * Functionality to synchronize application state with the URL.
 * Enables sharing map state through URLs and restoring state from URL parameters.
 */
import { useEffect } from "react";
import { useMapStore } from "./mapStore";
import type { GeoJSONFeature } from "./mapStoreTypes";

// Define the shape of the state we want to share
interface ShareableState {
  mapCenter: [number, number];
  zoomLevel: number;
  activeAreaId: string | null;
  areas: {
    id: string;
    feature: GeoJSONFeature;
  }[];
}

/**
 * Generate a shareable link containing the current URL
 * This simply returns the current URL as shown in the browser's address bar,
 * without adding any additional state information or panel tracking.
 */
export const generateShareableLink = (): string => {
  return window.location.href;
};

/**
 * Parse a shared link and extract the state
 */
export const parseSharedLink = (hash: string): ShareableState | null => {
  if (!hash || !hash.startsWith("#share=")) return null;

  try {
    const encodedState = hash.substring(7); // Remove '#share='
    const stateString = decodeURIComponent(atob(encodedState));
    return JSON.parse(stateString) as ShareableState;
  } catch (error) {
    console.error("Failed to parse shared link:", error);
    return null;
  }
};

/**
 * Apply the state from a shared link
 */
export const applySharedState = (state: ShareableState): void => {
  if (!state) return;

  const mapStore = useMapStore.getState();

  // Clear existing areas
  const currentAreas = [...mapStore.areas];
  currentAreas.forEach((area) => mapStore.removeArea(area.id));

  // Add the shared areas
  state.areas.forEach(({ feature }) => {
    mapStore.addGeoJSONFromSearch(feature);
  });

  // Set the active area if specified
  if (state.activeAreaId) {
    mapStore.setActiveArea(state.activeAreaId);
  }

  // Update the map center and zoom
  if (state.mapCenter) {
    mapStore.setCurrentMapCenter(state.mapCenter);

    // Get the map instance to update its view
    const mapInstance = (window as any).mapInstanceRef?.current;
    if (mapInstance && typeof mapInstance.setView === "function") {
      // Set both center and zoom level
      mapInstance.setView(state.mapCenter, state.zoomLevel);
    }
  }
};

/**
 * Custom hook for syncing state with URL parameters
 */
export const useUrlSync = () => {
  const { activeAreaId, areas, setActiveArea } = useMapStore();

  // Check for shared state on initial load
  useEffect(() => {
    // Check for a shared state in the URL hash
    const hash = window.location.hash;
    if (hash && hash.startsWith("#share=")) {
      const sharedState = parseSharedLink(hash);
      if (sharedState) {
        // Apply the shared state
        applySharedState(sharedState);

        // Clear the hash to avoid reapplying on refresh
        setTimeout(() => {
          window.history.replaceState(
            null,
            "",
            window.location.pathname + window.location.search
          );
        }, 500);

        return; // Skip regular URL sync if we applied shared state
      }
    }

    // Regular URL sync for non-shared states
    const params = new URLSearchParams(window.location.search);

    // Panel tracking from URL removed as per requirements

    const areaParam = params.get("area");
    if (areaParam && areas.some((area) => area.id === areaParam)) {
      setActiveArea(areaParam);
    }
  }, [areas, setActiveArea]);

  // Only sync active area to URL during normal navigation
  // Panel tracking has been removed as per requirements
  useEffect(() => {
    // Don't update URL if we're viewing a shared state
    if (window.location.hash.startsWith("#share=")) return;

    const params = new URLSearchParams();

    // Panel tracking removed from URL

    if (activeAreaId) {
      params.set("area", activeAreaId);
    }

    const url = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", url);
  }, [activeAreaId]);

  return null; // This hook doesn't render anything
};

export default useUrlSync;
