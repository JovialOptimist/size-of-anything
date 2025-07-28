// src/state/mapStore.ts
import { create } from "zustand";

interface MapArea {
  id: string;
  name: string;
  coordinates: [number, number][]; // Array of lat, lng pairs
  type: 'polygon' | 'rectangle' | 'circle';
  properties?: Record<string, any>;
}

interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  properties: Record<string, any>;
}

interface MapState {
  areas: MapArea[];
  activeAreaId: string | null;
  geojsonAreas: GeoJSONFeature[];
  isSelectingArea: boolean;
  clickedPosition: [number, number] | null;
  setIsSelectingArea: (isSelecting: boolean) => void;
  setClickedPosition: (position: [number, number] | null) => void;
  addGeoJSONFromSearch: (feature: GeoJSONFeature) => void;
  addArea: (area: MapArea) => void;
  updateArea: (id: string, area: Partial<MapArea>) => void;
  removeArea: (id: string) => void;
  setActiveArea: (id: string | null) => void;
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
  setIsSelectingArea: (isSelecting) => set({ isSelectingArea: isSelecting }),
  setClickedPosition: (position) => set({ clickedPosition: position }),
  addGeoJSONFromSearch: (feature: GeoJSONFeature) =>
    set((state) => ({
      geojsonAreas: [...state.geojsonAreas, feature],
    })),
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
}));
