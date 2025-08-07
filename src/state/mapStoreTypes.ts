// src/state/mapStoreTypes.ts
// This file contains only the types and interfaces used by the map store

export interface MapArea {
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
    readonly coordinateCount: number;
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
export type OSM_Type = (typeof OSM_Type)[keyof typeof OSM_Type];

export interface MapState {
  areas: MapArea[];
  activeAreaId: string | null;
  geojsonAreas: GeoJSONFeature[];
  historyItems: GeoJSONFeature[];
  isSelectingArea: boolean;
  clickedPosition: [number, number] | null;
  magicWandMode: boolean;
  currentMapCenter: [number, number];
  hoveredCandidate: GeoJSONFeature | null;
  setIsSelectingArea: (isSelecting: boolean) => void;
  setClickedPosition: (position: [number, number] | null) => void;
  addGeoJSONFromSearch: (feature: GeoJSONFeature) => void;
  addArea: (area: MapArea) => void;
  updateArea: (id: string, area: Partial<MapArea>) => void;
  removeArea: (id: string) => void;
  setActiveArea: (id: string | null) => void;
  setCurrentMapCenter: (center: [number, number]) => void;
  setMagicWandMode: (enabled: boolean) => void;
  onMapClick: ((latlng: L.LatLng) => void) | null;
  setOnMapClick: (handler: ((latlng: L.LatLng) => void) | null) => void;
  getActiveElement: () => GeoJSONFeature | null;
  updateElementColor: (id: string, color: string) => void;
  updateCurrentCoordinates: (id: string, coordinates: any) => void;
  setHoveredCandidate: (candidate: GeoJSONFeature | null) => void;
  addToHistory: (feature: GeoJSONFeature) => void;
  clearHistory: () => void;
}