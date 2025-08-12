// src/state/mapStore.ts
import { create } from "zustand";
import { generateRandomColor } from "../components/utils/colorUtils";
import type { MapArea, GeoJSONFeature, MapState } from "./mapStoreTypes";
import * as turf from "@turf/turf"; // TODO: what does this import other than simplify?
import { useSettings } from "./settingsStore";

/**
 * Zustand store for managing map areas and active area
 */
// Key for storing history in localStorage
const HISTORY_STORAGE_KEY = "sizeOfAnything_history";

// Load history from localStorage when creating the store
const loadHistory = (): GeoJSONFeature[] => {
  if (typeof window === "undefined") return []; // For SSR safety

  const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
  if (savedHistory) {
    try {
      // Parse and validate the saved history
      if (!savedHistory) return [];
      // Check if the saved history has duplicates
      const parsedHistory = JSON.parse(savedHistory);
      const uniqueHistory = Array.isArray(parsedHistory)
        ? parsedHistory.filter((item, idx, arr) => {
            // Check by osmId if available
            if (item.properties?.osmId) {
              return (
                arr.findIndex(
                  (f) => f.properties?.osmId === item.properties.osmId
                ) === idx
              );
            }

            // For custom shapes, check by customId
            if (item.properties?.customId) {
              return (
                arr.findIndex(
                  (f) => f.properties?.customId === item.properties.customId
                ) === idx
              );
            }

            // Fallback: check by name
            if (item.properties?.name) {
              return (
                arr.findIndex(
                  (f) => f.properties?.name === item.properties?.name
                ) === idx
              );
            }
            console.error("Item has no identifiable properties:", item);
            return false; // Exclude items without identifiable properties
          })
        : [];
      if (uniqueHistory.length !== parsedHistory.length) {
        localStorage.setItem(
          HISTORY_STORAGE_KEY,
          JSON.stringify(uniqueHistory)
        );
      }
      return uniqueHistory;
    } catch (e) {
      console.error("Failed to parse history from localStorage:", e);
      localStorage.removeItem(HISTORY_STORAGE_KEY);
    }
  }
  return [];
};

// Save history to localStorage
const saveHistory = (history: GeoJSONFeature[]) => {
  if (typeof window === "undefined") return; // For SSR safety
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
};

// Bigger is less detail, smaller is more detail
// Function to get the current simplify points setting from the SettingsStore
const getSimplifyToNumPoints = (): number => {
  const { outlineQuality } = useSettings.getState();

  // Map the quality setting to an actual number of points
  switch (outlineQuality) {
    case "perfect": // Perfect quality
      return -1;
    case "great": // Great quality
      return 5000;
    case "good": // Good quality
      return 1000;
    case "low": // Low quality
      return 200;
    default:
      return 1000; // Default to good quality
  }
};

export const useMapStore = create<MapState>((set) => ({
  areas: [],
  activeAreaId: null,
  geojsonAreas: [],
  historyItems: loadHistory(),
  isSelectingArea: false,
  clickedPosition: null,
  onMapClick: null,
  magicWandMode: false,
  currentMapCenter: [0, 0],
  hoveredCandidate: null,
  setIsSelectingArea: (isSelecting) => set({ isSelectingArea: isSelecting }),
  setClickedPosition: (position) => set({ clickedPosition: position }),
  addGeoJSONFromSearch: (feature: GeoJSONFeature) =>
    set((state) => {
      let { type, coordinates } = feature.geometry;

      // Count total coordinate points in the geometry
      // Recursively count the number of coordinate points in a GeoJSON geometry
      const countCoordinates = (coords: any[]): number =>
        Array.isArray(coords[0])
          ? coords.reduce((sum: number, c: any) => sum + countCoordinates(c), 0)
          : 1;

      function simplifyToTargetPoints(
        feature: GeoJSONFeature,
        targetPoints = 1000,
        maxIterations = 20
      ): GeoJSONFeature {
        const totalPoints = countCoordinates(feature.geometry.coordinates);

        if (totalPoints < targetPoints * 5) {
          console.log(
            `No need to simplify geometry with ${totalPoints} points`
          );
          return feature;
        }

        console.warn(`Simplifying geometry with ${totalPoints} points`);

        let minTol = 0.001; // Start at no simplification
        let maxTol = 1; // ~5km in degrees, adjust if needed
        let bestTol = minTol;

        for (let i = 0; i < maxIterations; i++) {
          const midTol = (minTol + maxTol) / 2;
          const simplified = turf.simplify(feature, {
            tolerance: midTol,
            highQuality: false,
            mutate: false,
          });

          const newCount = countCoordinates(simplified.geometry.coordinates);

          if (newCount > targetPoints) {
            // Still too many points → increase tolerance
            minTol = midTol;
          } else {
            // Under target → maybe too simplified, try lowering tolerance
            bestTol = midTol;
            maxTol = midTol;
          }
        }

        const finalFeature = turf.simplify(feature, {
          tolerance: bestTol,
          highQuality: false,
          mutate: false,
        });

        console.log(
          `Simplified geometry from ${totalPoints} → ${countCoordinates(
            finalFeature.geometry.coordinates
          )} points (tolerance=${bestTol})`
        );

        return finalFeature;
      }

      const targetPoints = getSimplifyToNumPoints();
      if (targetPoints == -1) {
        type = feature.geometry.type;
        coordinates = feature.geometry.coordinates;
      } else {
        const simplified = simplifyToTargetPoints(
          feature,
          getSimplifyToNumPoints(),
          200
        );
        type = simplified.geometry.type;
        coordinates = simplified.geometry.coordinates;
      }

      // Generate a unique color for this feature
      const color = generateRandomColor();

      // Add the color, index, and initialize current coordinates
      const index = state.geojsonAreas.length;

      // Check if this is a special shape based on osmType
      const isSpecialShape =
        feature.properties?.osmType?.includes("special-") || false;

      const featureWithColor = {
        ...feature,
        geometry: {
          ...feature.geometry,
          type,
          coordinates,
          currentCoordinates: JSON.parse(JSON.stringify(coordinates)), // Deep clone
        },
        properties: {
          ...feature.properties,
          color,
          index,
          shouldBringToFocus: !isSpecialShape, // Set focus flag (false for Special shapes)
        },
      };

      const newArea: MapArea = {
        id: `geojson-${state.geojsonAreas.length}`,
        name: feature.properties?.name || "Unnamed Area",
        coordinates: coordinates as any, // trust GeoJSON is well-formed
        type: type === "MultiPolygon" ? "multipolygon" : "polygon",
        properties: featureWithColor.properties,
      };

      set({ activeAreaId: newArea.id });

      // Add feature to history immediately
      setTimeout(() => {
        useMapStore.getState().addToHistory(featureWithColor);
      }, 0);

      return {
        geojsonAreas: [...state.geojsonAreas, featureWithColor],
        areas: [...state.areas, newArea],
      };
    }),

  addArea: (area) => set((state) => ({ areas: [...state.areas, area] })),
  updateArea: (id, updatedProps) =>
    set((state) => ({
      areas: state.areas.map((area) =>
        area.id === id ? { ...area, ...updatedProps } : area
      ),
    })),
  removeArea: (id) =>
    set((state) => ({
      areas: state.areas.filter((area) => area.id !== id),
      activeAreaId: state.activeAreaId === id ? null : state.activeAreaId,
      geojsonAreas: state.geojsonAreas.filter(
        (feature) =>
          feature.properties.index !== parseInt(id.replace("geojson-", ""))
      ),
    })),
  duplicateArea: (id: string) =>
    set((state) => {
      const areaToDuplicate = state.areas.find((area) => area.id === id);
      if (!areaToDuplicate) return state;

      // Duplicate the corresponding GeoJSONFeature
      const idNumber = id.replace("geojson-", "");
      const index = parseInt(idNumber, 10);
      const featureToDuplicate = state.geojsonAreas.find(
        (feature) => feature.properties.index === index
      );
      if (!featureToDuplicate) return state;

      const newIndex = state.geojsonAreas.length;
      const newFeature = {
        ...featureToDuplicate,
        properties: {
          ...featureToDuplicate.properties,
          index: newIndex,
          color: generateRandomColor(),
          shouldBringToFocus: false, // Duplicated areas should not trigger zooming
        },
      };

      const newArea = {
        ...areaToDuplicate,
        id: `geojson-${newIndex}`,
        properties: newFeature.properties,
      };

      set({ activeAreaId: newArea.id });

      return {
        areas: [...state.areas, newArea],
        geojsonAreas: [...state.geojsonAreas, newFeature],
      };
    }),
  setActiveArea: (id) => set({ activeAreaId: id }),
  setMagicWandMode: (enabled) => {
    set({ magicWandMode: enabled });
  },
  setOnMapClick: (handler) => set({ onMapClick: handler }),

  setCurrentMapCenter: (center: [number, number]) =>
    set({ currentMapCenter: center }),

  getActiveElement: () => {
    const state: any = useMapStore.getState();
    if (!state.activeAreaId) return null;

    const activeId = state.activeAreaId;
    const idNumber = activeId.replace("geojson-", "");
    const index = parseInt(idNumber, 10);

    // Find the element by its index property rather than assuming array position matches
    return (
      state.geojsonAreas.find(
        (feature: GeoJSONFeature) => feature.properties.index === index
      ) || null
    );
  },

  updateElementColor: (id, color) => {
    set((state) => {
      const idNumber = id.replace("geojson-", "");
      const index = parseInt(idNumber, 10);

      // Find the element by index property instead of array position
      const featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.index === index
      );

      if (featureIndex < 0) return state;

      const updatedAreas = [...state.geojsonAreas];
      updatedAreas[featureIndex] = {
        ...updatedAreas[featureIndex],
        properties: {
          ...updatedAreas[featureIndex].properties,
          color,
        },
      };

      return { geojsonAreas: updatedAreas };
    });
  },

  updateElementRotation: (id, rotation, rotatedCoordinates = null) => {
    set((state) => {
      const idNumber = id.replace("geojson-", "");
      const index = parseInt(idNumber, 10);

      // Find the element by index property instead of array position
      const featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.index === index
      );

      if (featureIndex < 0) return state;

      const updatedAreas = [...state.geojsonAreas];

      // Update the rotation property
      updatedAreas[featureIndex] = {
        ...updatedAreas[featureIndex],
        properties: {
          ...updatedAreas[featureIndex].properties,
          rotation,
        },
      };

      // If rotatedCoordinates are provided, store them in the geometry
      // This prevents recalculating rotation every render
      if (rotatedCoordinates !== null) {
        updatedAreas[featureIndex].geometry = {
          ...updatedAreas[featureIndex].geometry,
          rotatedCoordinates: rotatedCoordinates,
        };
      } else if (rotation === 0) {
        // For zero rotation, clear any rotated coordinates to use original/current position
        // Get a reference to the geometry to prevent mutation
        const geometry = { ...updatedAreas[featureIndex].geometry };
        // Delete the rotated coordinates property if it exists
        delete geometry.rotatedCoordinates;
        // Update the feature with the modified geometry
        updatedAreas[featureIndex].geometry = geometry;
      }

      return { geojsonAreas: updatedAreas };
    });
  },

  updateCurrentCoordinates: (id, coordinates) => {
    set((state) => {
      const idNumber = id.replace("geojson-", "");
      const index = parseInt(idNumber, 10);

      // Find the element by index property instead of array position
      const featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.index === index
      );

      if (featureIndex < 0) return state;

      const updatedAreas = [...state.geojsonAreas];
      // Preserve originalCoordinates if they exist
      const originalCoordinates =
        updatedAreas[featureIndex].geometry.originalCoordinates;

      updatedAreas[featureIndex] = {
        ...updatedAreas[featureIndex],
        geometry: {
          ...updatedAreas[featureIndex].geometry,
          currentCoordinates: coordinates,
          // Always preserve the original coordinates
          originalCoordinates:
            originalCoordinates ||
            updatedAreas[featureIndex].geometry.coordinates,
          // Remove any previously calculated rotated coordinates when position changes
          rotatedCoordinates: undefined,
        },
      };

      // If we have a non-zero rotation, we need to re-apply it after updating the position
      // This ensures the shape maintains its orientation after being moved

      return { geojsonAreas: updatedAreas };
    });
  },

  setHoveredCandidate: (candidate) => {
    set({ hoveredCandidate: candidate });
  },

  // Add a feature to history
  addToHistory: (feature) => {
    set((state) => {
      // Create a copy of the feature to ensure we don't modify the original
      const featureCopy = JSON.parse(JSON.stringify(feature));
      if (
        featureCopy.properties.customId &&
        featureCopy.properties.customId.includes("special-shape")
      ) {
        state.historyItems.some((item) => {
          console.log("Checking history item:", item.properties.customId);
          console.log(
            "Against feature customId:",
            featureCopy.properties.customId
          );
          if (
            item.properties.customId.includes(featureCopy.properties.customId)
          )
            return false;
        });
      }

      // Check if this feature is already in history
      const isAlreadyInHistory = state.historyItems.some((item) => {
        if (
          featureCopy.properties.osmType === item.properties.osmType &&
          (featureCopy.properties.osmType.includes("special-") ||
            featureCopy.properties.osmType.includes("custom-"))
        ) {
          console.log(
            "Skipping history check for special/custom type:",
            featureCopy.properties.osmType
          );
          console.log("Feature properties:", featureCopy.properties);
          console.log("Item properties:", item.properties);
          return true;
        }
        // Check by osmId if available
        if (item.properties.osmId && featureCopy.properties.osmId) {
          return item.properties.osmId === featureCopy.properties.osmId;
        }
        // For custom shapes without osmId, check by name and any custom identifier

        // As a fallback, check by name
        return item.properties.name === featureCopy.properties.name;
      });

      if (isAlreadyInHistory) return state;

      // Add to history, limiting to last 20 items (increase from 10)
      const updatedHistory = [featureCopy, ...state.historyItems].slice(0, 20);

      // Save to localStorage
      saveHistory(updatedHistory);

      return { historyItems: updatedHistory };
    });
  },

  // Clear all history
  clearHistory: () => {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    set({ historyItems: [] });
  },
}));
