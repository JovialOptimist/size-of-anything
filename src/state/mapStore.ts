// src/state/mapStore.ts
import { create } from "zustand";
import { generateRandomColor } from "../components/utils/colorUtils";
import type { 
  MapArea,
  GeoJSONFeature,
  MapState
} from "./mapStoreTypes";

/**
 * Zustand store for managing map areas and active area
 */
export const useMapStore = create<MapState>((set) => ({
  areas: [],
  activeAreaId: null,
  geojsonAreas: [],
  isSelectingArea: false,
  clickedPosition: null,
    onMapClick: null,
    magicWandMode: false,
    currentMapCenter: [0, 0],
  setIsSelectingArea: (isSelecting) => set({ isSelectingArea: isSelecting }),
  setClickedPosition: (position) => set({ clickedPosition: position }),
  addGeoJSONFromSearch: (feature: GeoJSONFeature) =>
  set((state) => {
    const { type, coordinates } = feature.geometry;
    
    // Generate a unique color for this feature
    const color = generateRandomColor();
    
    // Add the color, index and initialize current coordinates
    const index = state.geojsonAreas.length;
    const featureWithColor = {
      ...feature,
      geometry: {
        ...feature.geometry,
        currentCoordinates: JSON.parse(JSON.stringify(feature.geometry.coordinates)) // Deep clone
      },
      properties: {
        ...feature.properties,
        color: color,
        index: index
      }
    };

    const newArea: MapArea = {
      id: `geojson-${state.geojsonAreas.length}`,
      name: feature.properties?.name || 'Unnamed Area',
      coordinates: coordinates as any, // trust GeoJSON is well-formed
      type: type === "MultiPolygon" ? "multipolygon" : "polygon",
      properties: featureWithColor.properties,
    };

    set({ activeAreaId: newArea.id });

    return {
      geojsonAreas: [...state.geojsonAreas, featureWithColor],
      areas: [...state.areas, newArea],
    };
  }),

  addArea: (area) => 
    set((state) => ({ areas: [...state.areas, area] })),
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
        geojsonAreas: state.geojsonAreas.filter((feature) => feature.properties.index !== parseInt(id.replace('geojson-', '')))
    })),
duplicateArea: (id: string) =>
set((state) => {
    const areaToDuplicate = state.areas.find((area) => area.id === id);
    if (!areaToDuplicate) return state;

    // Duplicate the corresponding GeoJSONFeature
    const idNumber = id.replace('geojson-', '');
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

setCurrentMapCenter: (center: [number, number]) => set({ currentMapCenter: center }),

getActiveElement: () => {
  const state: any = useMapStore.getState();
  if (!state.activeAreaId) return null;
  
  const activeId = state.activeAreaId;
  const idNumber = activeId.replace('geojson-', '');
  const index = parseInt(idNumber, 10);
  
  // Find the element by its index property rather than assuming array position matches
  return state.geojsonAreas.find((feature: GeoJSONFeature) => feature.properties.index === index) || null;
},

updateElementColor: (id, color) => {
  set((state) => {
    const idNumber = id.replace('geojson-', '');
    const index = parseInt(idNumber, 10);
    
    // Find the element by index property instead of array position
    const featureIndex = state.geojsonAreas.findIndex(
      feature => feature.properties.index === index
    );
    
    if (featureIndex < 0) return state;
    
    const updatedAreas = [...state.geojsonAreas];
    updatedAreas[featureIndex] = {
      ...updatedAreas[featureIndex],
      properties: {
        ...updatedAreas[featureIndex].properties,
        color
      }
    };
    
    return { geojsonAreas: updatedAreas };
  });
},

updateCurrentCoordinates: (id, coordinates) => {
  set((state) => {
    const idNumber = id.replace('geojson-', '');
    const index = parseInt(idNumber, 10);
    
    // Find the element by index property instead of array position
    const featureIndex = state.geojsonAreas.findIndex(
      feature => feature.properties.index === index
    );
    
    if (featureIndex < 0) return state;
    
    const updatedAreas = [...state.geojsonAreas];
    updatedAreas[featureIndex] = {
      ...updatedAreas[featureIndex],
      geometry: {
        ...updatedAreas[featureIndex].geometry,
        currentCoordinates: coordinates
      }
    };
    
    return { geojsonAreas: updatedAreas };
  });
},

}));
