// src/state/mapStore.ts
import { create } from "zustand";
import { generateRandomColor } from "../components/utils/colorUtils";
import { projectAndTranslateGeometry } from "../components/utils/geometryUtils";
import type { MapArea, GeoJSONFeature, MapState } from "./mapStoreTypes";
import * as turf from "@turf/turf"; // TODO: what does this import other than simplify?
import { useSettings } from "./settingsStore";
import { generateShapeId } from "../utils/idUtils";

export type AddFromSearchOptions = { placeAtCenter?: boolean };

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

      // Process each item to ensure location property is preserved
      parsedHistory.forEach((item: GeoJSONFeature) => {
        // If location is missing but name contains a comma, extract the location
        if (
          !item.properties.location &&
          item.properties.name &&
          item.properties.name.includes(",")
        ) {
          const nameParts = item.properties.name.split(",");
          item.properties.name = nameParts[0].trim();
          item.properties.location = nameParts.slice(1).join(",").trim();
        }
      });

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

      console.log("Actual loaded history:", uniqueHistory);
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

  // Ensure all history items have a location property if possible
  const processedHistory = history.map((item) => {
    // Create a deep copy to avoid mutating the original
    const itemCopy = JSON.parse(JSON.stringify(item));

    // If location is missing but name has a comma, extract location
    if (
      !itemCopy.properties.location &&
      itemCopy.properties.name &&
      itemCopy.properties.name.includes(",")
    ) {
      const nameParts = itemCopy.properties.name.split(",");
      itemCopy.properties.name = nameParts[0].trim();
      itemCopy.properties.location = nameParts.slice(1).join(",").trim();
    }

    return itemCopy;
  });

  console.log("Finall Processed HIstory: ", processedHistory);

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(processedHistory));
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
  addGeoJSONFromSearch: (feature: GeoJSONFeature, options?: AddFromSearchOptions) =>
    set((state) => {
      let workingFeature = feature;
      if (options?.placeAtCenter && state.currentMapCenter[0] !== 0 && state.currentMapCenter[1] !== 0) {
        const [lat, lng] = state.currentMapCenter;
        workingFeature = projectAndTranslateGeometry(
          workingFeature as Parameters<typeof projectAndTranslateGeometry>[0],
          [lng, lat]
        ) as GeoJSONFeature;
      }
      const placeAtCenter = options?.placeAtCenter === true;
      feature = workingFeature;
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

      // Generate a unique ID for this feature
      const uniqueId = generateShapeId();

      // Store the sequential index for backward compatibility
      const sequentialIndex = state.geojsonAreas.length;

      // Check if this is a special shape based on osmType
      const isSpecialShape =
        feature.properties?.osmType?.includes("special-") || false;

      // Split name into name and location if it contains a comma
      let shapeName = feature.properties?.name || "Unnamed Area";
      let shapeLocation = feature.properties?.location || "";

      if (shapeName && shapeName.includes(",")) {
        const nameParts = shapeName.split(",");
        shapeName = nameParts[0].trim();
        shapeLocation = nameParts.slice(1).join(",").trim();
      }

      console.log(shapeLocation);

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
          name: shapeName, // Set the name to just the first part
          location: shapeLocation, // Set the location to everything after the first comma
          color,
          index: sequentialIndex, // Keep the index for backward compatibility
          id: uniqueId, // Store the unique ID in properties too
          shouldBringToFocus: !isSpecialShape && !placeAtCenter, // Set focus flag (false for Special shapes or place-at-center)
        },
      };

      const newArea: MapArea = {
        id: uniqueId,
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
          // Remove by matching the ID stored in properties
          feature.properties.id !== id &&
          // For backward compatibility, also check the old index-based approach
          !(
            id.startsWith("geojson-") &&
            feature.properties.index ===
              parseInt(id.replace("geojson-", ""), 10)
          )
      ),
    })),
  duplicateArea: (id: string) =>
    set((state) => {
      const areaToDuplicate = state.areas.find((area) => area.id === id);
      if (!areaToDuplicate) return state;

      // Find the feature to duplicate using the unique ID
      const featureToDuplicate = state.geojsonAreas.find(
        (feature) =>
          feature.properties.id === id ||
          // Fallback for backward compatibility
          (id.startsWith("geojson-") &&
            feature.properties.index ===
              parseInt(id.replace("geojson-", ""), 10))
      );

      if (!featureToDuplicate) {
        console.warn(`No feature found to duplicate for area: ${id}`);
        return state;
      }

      // Generate a unique ID for the duplicate
      const uniqueId = generateShapeId();

      // Keep a sequential index for backward compatibility
      const newSequentialIndex = state.geojsonAreas.length;

      // Ensure the location property is preserved in the duplicate
      const properties = { ...featureToDuplicate.properties };

      // If location is missing but name contains a comma, extract it
      if (
        !properties.location &&
        properties.name &&
        properties.name.includes(",")
      ) {
        const nameParts = properties.name.split(",");
        properties.name = nameParts[0].trim();
        properties.location = nameParts.slice(1).join(",").trim();
      }

      const newFeature = {
        ...featureToDuplicate,
        properties: {
          ...properties,
          index: newSequentialIndex, // Update the sequential index
          id: uniqueId, // Assign the new unique ID
          color: generateRandomColor(),
          shouldBringToFocus: false, // Duplicated areas should not trigger zooming
        },
      };

      const newArea = {
        ...areaToDuplicate,
        id: uniqueId, // Use the new unique ID
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

    // First try to find the element by the ID stored in properties (new approach)
    let element = state.geojsonAreas.find(
      (feature: GeoJSONFeature) => feature.properties.id === activeId
    );

    // If not found and it looks like a legacy ID, try the old index-based approach
    if (!element && activeId.startsWith("geojson-")) {
      const idNumber = activeId.replace("geojson-", "");
      // Only parse as int if it's a numeric string
      if (/^\d+$/.test(idNumber)) {
        const index = parseInt(idNumber, 10);
        element = state.geojsonAreas.find(
          (feature: GeoJSONFeature) => feature.properties.index === index
        );
      }
    }

    return element || null;
  },

  updateElementColor: (id, color) => {
    set((state) => {
      // Find the element by ID first (new approach)
      let featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.id === id
      );

      // If not found and it looks like a legacy ID, try the old index-based approach
      if (featureIndex < 0 && id.startsWith("geojson-")) {
        const idNumber = id.replace("geojson-", "");
        // Only parse as int if it's a numeric string
        if (/^\d+$/.test(idNumber)) {
          const index = parseInt(idNumber, 10);
          featureIndex = state.geojsonAreas.findIndex(
            (feature) => feature.properties.index === index
          );
        }
      }

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
      // Find the element by ID first (new approach)
      let featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.id === id
      );

      // If not found and it looks like a legacy ID, try the old index-based approach
      if (featureIndex < 0 && id.startsWith("geojson-")) {
        const idNumber = id.replace("geojson-", "");
        // Only parse as int if it's a numeric string
        if (/^\d+$/.test(idNumber)) {
          const index = parseInt(idNumber, 10);
          featureIndex = state.geojsonAreas.findIndex(
            (feature) => feature.properties.index === index
          );
        }
      }

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

  updateElementName: (id, name) => {
    set((state) => {
      // Find the element by ID first (new approach)
      let featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.id === id
      );

      // If not found and it looks like a legacy ID, try the old index-based approach
      if (featureIndex < 0 && id.startsWith("geojson-")) {
        const idNumber = id.replace("geojson-", "");
        // Only parse as int if it's a numeric string
        if (/^\d+$/.test(idNumber)) {
          const index = parseInt(idNumber, 10);
          featureIndex = state.geojsonAreas.findIndex(
            (feature) => feature.properties.index === index
          );
        }
      }

      if (featureIndex < 0) return state;

      const updatedAreas = [...state.geojsonAreas];
      updatedAreas[featureIndex] = {
        ...updatedAreas[featureIndex],
        properties: {
          ...updatedAreas[featureIndex].properties,
          name, // Update only the name, keep location intact
        },
      };

      return { geojsonAreas: updatedAreas };
    });
  },

  updateCurrentCoordinates: (id, coordinates) => {
    set((state) => {
      // Find the element by ID first (new approach)
      let featureIndex = state.geojsonAreas.findIndex(
        (feature) => feature.properties.id === id
      );

      // If not found and it looks like a legacy ID, try the old index-based approach
      if (featureIndex < 0 && id.startsWith("geojson-")) {
        const idNumber = id.replace("geojson-", "");
        // Only parse as int if it's a numeric string
        if (/^\d+$/.test(idNumber)) {
          const index = parseInt(idNumber, 10);
          featureIndex = state.geojsonAreas.findIndex(
            (feature) => feature.properties.index === index
          );
        }
      }

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
      console.log("Feature copy location: ", featureCopy.properties.location);

      // Make sure location property is preserved
      // If it's missing but the name has a comma, extract location from name
      if (
        !featureCopy.properties.location &&
        featureCopy.properties.name &&
        featureCopy.properties.name.includes(",")
      ) {
        const nameParts = featureCopy.properties.name.split(",");
        const shapeName = nameParts[0].trim();
        const shapeLocation = nameParts.slice(1).join(",").trim();

        // Update the properties
        featureCopy.properties.name = shapeName;
        featureCopy.properties.location = shapeLocation;
      }

      if (
        featureCopy.properties.customId &&
        featureCopy.properties.customId.includes("special-shape")
      ) {
        state.historyItems.some((item) => {
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
      console.log(
        "Feature copy location that is actually being saved: ",
        featureCopy.properties.location
      );
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
