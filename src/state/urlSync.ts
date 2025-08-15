// src/state/urlSync.ts
/**
 * Functionality to synchronize application state with the URL.
 * Enables sharing map state through URLs and restoring state from URL parameters.
 * Updated to use OSM IDs instead of full geometry for more compact URLs.
 */
import { useEffect, useState } from "react";
import { useMapStore } from "./mapStore";
import { usePanel } from "./panelStore";
import { useMessage } from "./messageStore";
import type { GeoJSONFeature } from "./mapStoreTypes";
import {
  fetchOsmGeometries,
  isOsmFeature,
  isCustomShape,
} from "../utils/osmFetcher";
import type { OsmReference } from "../utils/osmFetcher";
import { generateRandomColor } from "../components/utils/colorUtils";
import { osmTypeToPrefix } from "../utils/osmFetcher";

// Define the shape of the state we want to share
interface ShareableState {
  version: number; // Used to handle different versions of the sharing format
  mapCenter: [number, number];
  zoomLevel: number;
  activeAreaId: string | null;
  areas: Array<{
    id: string;
    type: "osm" | "custom" | "special";
    // For OSM areas
    osmId?: string;
    osmType?: string;
    // For custom areas
    feature?: GeoJSONFeature;
    // Common properties
    name?: string;
    color?: string;
    rotation?: number;
  }>;
}

/**
 * Generate a shareable link containing the current state
 */
export const generateShareableLink = (): string => {
  const state = useMapStore.getState();
  const { activePanel } = usePanel.getState();

  // Debug: Show the current areas in detail
  console.log(
    "[urlSync] Current geojsonAreas:",
    JSON.stringify(state.geojsonAreas)
  );

  // Get the current zoom level from the map instance if available
  let currentZoom = 13; // Default zoom level
  const mapInstance = (window as any).mapInstanceRef?.current;
  if (mapInstance && typeof mapInstance.getZoom === "function") {
    currentZoom = mapInstance.getZoom();
  }
  console.log(
    "[urlSync] Current map center:",
    state.currentMapCenter,
    "zoom:",
    currentZoom
  );

  // Create the state object we want to encode in the URL
  const shareableState: ShareableState = {
    version: 2, // Current version of the sharing format
    mapCenter: state.currentMapCenter,
    zoomLevel: currentZoom,
    activeAreaId: state.activeAreaId,
    areas: state.geojsonAreas.map((feature) => {
      console.log(
        "[urlSync] Processing feature:",
        feature.properties.name,
        feature.properties
      );

      const baseInfo = {
        id: feature.properties.id || `geojson-${feature.properties.index}`,
        name: feature.properties.name || "Unnamed Area",
        color: feature.properties.color,
        rotation: feature.properties.rotation || 0,
      };

      // Check if this is an OSM feature (has osmId and osmType)
      if (isOsmFeature(feature)) {
        // Only include osmId if it is a string (not null/undefined)
        const osmId = feature.properties.osmId || undefined;
        const osmInfo = {
          ...baseInfo,
          type: "osm" as const,
          osmId: osmId,
          osmType: feature.properties.osmType,
        };

        return osmInfo;
      }
      // Check if this is a special shape or custom area
      else if (isCustomShape(feature)) {
        return {
          ...baseInfo,
          type: "special" as const,
          feature: feature, // Include full feature for special shapes
        };
      }
      // Otherwise it's a custom shape
      else {
        return {
          ...baseInfo,
          type: "custom" as const,
          feature: feature, // Include full feature for custom shapes
        };
      }
    }),
  };

  // Serialize the state
  const stateString = JSON.stringify(shareableState);
  console.log(
    "[urlSync] State string length:",
    stateString.length,
    "characters"
  );

  // DEBUGGING: Skip the encoding step for debugging purposes
  // const encodedState = btoa(encodeURIComponent(stateString));
  //

  // Just use encodeURIComponent for the state (more readable for debugging)
  const debugState = encodeURIComponent(stateString);

  // Generate the URL with the hash fragment
  const baseUrl = window.location.origin + window.location.pathname;
  let url = baseUrl;

  // Include the panel state if needed
  if (activePanel) {
    url += `?panel=${activePanel}`;
  }

  // Add the share data as a hash fragment - in debug format
  url += `#debug=${debugState}`;

  return url;
};

/**
 * Parse a shared link and extract the state
 */
export const parseSharedLink = (hash: string): ShareableState | null => {
  console.log(
    "[urlSync] Starting parseSharedLink with hash:",
    hash?.substring(0, 20) + "..."
  );

  // Handle both regular and debug formats
  let stateString: string;

  if (hash.startsWith("#debug=")) {
    const debugState = hash.substring(7); // Remove '#debug='

    stateString = decodeURIComponent(debugState);
  } else if (hash.startsWith("#share=")) {
    const encodedState = hash.substring(7); // Remove '#share='

    stateString = decodeURIComponent(atob(encodedState));
  } else {
    return null;
  }

  try {
    const parsedState = JSON.parse(stateString);

    // Handle different versions of the sharing format
    if (!parsedState.version) {
      // Version 1 (original format) - convert to version 2 format
      const v1State = {
        version: 1,
        mapCenter: parsedState.mapCenter,
        zoomLevel: parsedState.zoomLevel,
        activeAreaId: parsedState.activeAreaId,
        areas: parsedState.areas.map((area: any) => ({
          id: area.id,
          type: "custom" as const, // Treat all as custom in v1
          feature: area.feature,
        })),
      };
      console.log(
        "[urlSync] Converted to v2 format with areas:",
        v1State.areas.length
      );
      return v1State;
    }

    console.log(
      "[urlSync] Using version",
      parsedState.version,
      "format with areas:",
      parsedState.areas.length
    );
    return parsedState as ShareableState;
  } catch (error) {
    console.error("[urlSync] Failed to parse shared link:", error);
    return null;
  }
};

/**
 * Apply the state from a shared link
 */
export const applySharedState = async (
  state: ShareableState
): Promise<void> => {
  if (!state) {
    return;
  }

  const mapStore = useMapStore.getState();
  const { showMessage } = useMessage.getState();

  // Show loading message
  showMessage("Loading shared map...", "info");

  try {
    // Clear existing areas
    const currentAreas = [...mapStore.areas];

    currentAreas.forEach((area) => mapStore.removeArea(area.id));

    // For OSM areas, we need to fetch their geometries
    const osmAreas = state.areas.filter(
      (area) => area.type === "osm" && area.osmId && area.osmType
    );

    const osmReferences: OsmReference[] = osmAreas.map((area) => ({
      osmId: area.osmId!,
      osmType: area.osmType!,
      name: area.name,
      color: area.color,
      rotation: area.rotation,
    }));

    // Fetch OSM geometries if needed
    let osmFeatures: GeoJSONFeature[] = [];
    if (osmReferences.length > 0) {
      console.log(
        "[urlSync] Fetching OSM geometries for",
        osmReferences.length,
        "references"
      );
      try {
        osmFeatures = await fetchOsmGeometries(osmReferences);
        console.log(
          "[urlSync] Fetched OSM features:",
          osmFeatures.length,
          osmFeatures
        );
      } catch (error) {
        console.error("[urlSync] Error fetching OSM geometries:", error);
        showMessage(
          "Some areas couldn't be loaded from OpenStreetMap",
          "error"
        );
      }
    } else {
    }

    // Add OSM features

    osmFeatures.forEach((feature, index) => {
      console.log(
        `[urlSync] OSM feature #${index}:`,
        "name:",
        feature.properties?.name,
        "id:",
        feature.properties?.id,
        "osmId:",
        feature.properties?.osmId,
        "osmType:",
        feature.properties?.osmType
      );

      // Ensure the feature has the necessary properties set
      if (!feature.properties.id) {
        feature.properties.id = `osm-${feature.properties.osmType}-${feature.properties.osmId}`;
        console.log(
          "[urlSync] Added missing id property:",
          feature.properties.id
        );
      }

      // Debug the feature structure
      console.log(
        "[urlSync] Feature structure check:",
        "has geometry:",
        Boolean(feature.geometry),
        "coordinates array:",
        Boolean(feature.geometry?.coordinates),
        "coordinates length:",
        feature.geometry?.coordinates?.length
      );

      console.log(
        "[urlSync] Adding feature to map:",
        JSON.stringify(feature.properties)
      );
      try {
        mapStore.addGeoJSONFromSearch(feature);
      } catch (error) {
        console.error("[urlSync] Error adding feature to map:", error);
      }
    });

    // Add custom and special shapes
    const customAreas = state.areas.filter(
      (area) =>
        (area.type === "custom" || area.type === "special") && area.feature
    );
    console.log(
      "[urlSync] Found custom/special areas:",
      customAreas.length,
      customAreas
    );

    customAreas.forEach((area) => {
      // Ensure color is set
      if (!area.feature!.properties.color) {
        const color = area.color || generateRandomColor();

        area.feature!.properties.color = color;
      }

      // Make sure to set id in properties if needed
      if (!area.feature!.properties.id) {
        area.feature!.properties.id = area.id;
      }

      console.log(
        "[urlSync] Adding custom/special feature to map:",
        area.feature
      );
      mapStore.addGeoJSONFromSearch(area.feature!);
    });

    // Set the active area if specified
    if (state.activeAreaId) {
      mapStore.setActiveArea(state.activeAreaId);
    }

    // Update the map center and zoom
    if (state.mapCenter) {
      console.log(
        "[urlSync] Setting map center:",
        state.mapCenter,
        "zoom:",
        state.zoomLevel
      );
      mapStore.setCurrentMapCenter(state.mapCenter);

      // Get the map instance to update its view
      const mapInstance = (window as any).mapInstanceRef?.current;
      if (mapInstance && typeof mapInstance.setView === "function") {
        // Set both center and zoom level
        mapInstance.setView(state.mapCenter, state.zoomLevel);
      } else {
      }
    }

    // Show success message

    showMessage("Shared map loaded successfully", "success");
  } catch (error) {
    console.error("[urlSync] Error applying shared state:", error);
    showMessage("Error loading the shared map", "error");
  }
};

/**
 * Custom hook for syncing state with URL parameters
 */
export const useUrlSync = () => {
  const { activePanel, setActivePanel } = usePanel();
  const { activeAreaId, areas, setActiveArea } = useMapStore();
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Check for shared state on initial load
  useEffect(() => {
    const loadState = async () => {
      // Check for a shared state in the URL hash
      const hash = window.location.hash;

      if (hash && (hash.startsWith("#share=") || hash.startsWith("#debug="))) {
        const sharedState = parseSharedLink(hash);

        if (sharedState) {
          try {
            // Apply the shared state - this is now async

            await applySharedState(sharedState);

            // Clear the hash to avoid reapplying on refresh

            setTimeout(() => {
              window.history.replaceState(
                null,
                "",
                window.location.pathname + window.location.search
              );
            }, 500);

            setInitialLoadComplete(true);

            return; // Skip regular URL sync if we applied shared state
          } catch (error) {
            console.error("[urlSync] Error applying shared state:", error);
          }
        } else {
        }
      }

      // Regular URL sync for non-shared states

      const params = new URLSearchParams(window.location.search);

      const panelParam = params.get("panel");
      if (panelParam) {
        setActivePanel(panelParam);
      }

      const areaParam = params.get("area");
      if (areaParam && areas.some((area) => area.id === areaParam)) {
        setActiveArea(areaParam);
      }

      setInitialLoadComplete(true);
    };

    loadState();
  }, []);

  // Only sync panel and active area to URL during normal navigation
  // (We don't want to overwrite the shared URL hash)
  useEffect(() => {
    if (!initialLoadComplete) return;

    // Don't update URL if we're viewing a shared state
    if (
      window.location.hash.startsWith("#share=") ||
      window.location.hash.startsWith("#debug=")
    )
      return;

    const params = new URLSearchParams();

    if (activePanel) {
      params.set("panel", activePanel);
    }

    if (activeAreaId) {
      params.set("area", activeAreaId);
    }

    const url = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", url);
  }, [activePanel, activeAreaId, initialLoadComplete]);

  return null; // This hook doesn't render anything
};

export default useUrlSync;
