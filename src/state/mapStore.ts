// src/state/mapStore.ts
import { create } from "zustand";
import { generateRandomColor, getExistingColors } from "../components/utils/colorUtils";

interface MapArea {
  id: string;
  name: string;
  coordinates: [number, number][][] | [number, number][][][]; 
  type: 'polygon' | 'rectangle' | 'circle' | 'multipolygon';
  properties?: Record<string, any>;
}

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
    currentCoordinates?: any; // Store the current coordinates after dragging
  };
  properties: {
    name: string;
    osmType: string;
    osmId: string | null;
    osmClass: string;
    color?: string; // Add color property
    [key: string]: any;
    whatIsIt: string;
  };
};

export const OSM_Type = {
  NODE: "node",
  WAY: "way",
  RELATION: "relation",
} as const;
type OSM_Type = (typeof OSM_Type)[keyof typeof OSM_Type];

export interface MapState {
  areas: MapArea[];
  activeAreaId: string | null;
  geojsonAreas: GeoJSONFeature[];
  isSelectingArea: boolean;
  clickedPosition: [number, number] | null;
  magicWandMode: boolean;
  setIsSelectingArea: (isSelecting: boolean) => void;
  setClickedPosition: (position: [number, number] | null) => void;
  addGeoJSONFromSearch: (feature: GeoJSONFeature) => void;
  addArea: (area: MapArea) => void;
  updateArea: (id: string, area: Partial<MapArea>) => void;
  removeArea: (id: string) => void;
  setActiveArea: (id: string | null) => void;
  setMagicWandMode: (enabled: boolean) => void;
  onMapClick: ((latlng: L.LatLng) => void) | null;
  setOnMapClick: (handler: ((latlng: L.LatLng) => void) | null) => void;
  getActiveElement: () => GeoJSONFeature | null;
  updateElementColor: (id: string, color: string) => void;
  updateCurrentCoordinates: (id: string, coordinates: any) => void;
}

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
  setIsSelectingArea: (isSelecting) => set({ isSelectingArea: isSelecting }),
  setClickedPosition: (position) => set({ clickedPosition: position }),
  addGeoJSONFromSearch: (feature: GeoJSONFeature) =>
  set((state) => {
    const { type, coordinates } = feature.geometry;
    
    // Generate a unique color for this feature
    const existingColors = getExistingColors(state.geojsonAreas);
    const color = generateRandomColor(existingColors);
    
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
  setActiveArea: (id) => set({ activeAreaId: id }),
  setMagicWandMode: (enabled) => {
  set({ magicWandMode: enabled });
},
setOnMapClick: (handler) => set({ onMapClick: handler }),

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
