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

interface MapState {
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
    
    // Add the color to the feature properties
    const featureWithColor = {
      ...feature,
      properties: {
        ...feature.properties,
        color: color
      }
    };

    const newArea: MapArea = {
      id: `geojson-${state.geojsonAreas.length}`,
      name: feature.properties?.name || 'Unnamed Area',
      coordinates: coordinates as any, // trust GeoJSON is well-formed
      type: type === "MultiPolygon" ? "multipolygon" : "polygon",
      properties: featureWithColor.properties,
    };

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
    })),
  setActiveArea: (id) => set({ activeAreaId: id }),
  setMagicWandMode: (enabled) => {
  set({ magicWandMode: enabled });
},
setOnMapClick: (handler) => set({ onMapClick: handler }),

}));
