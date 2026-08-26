// src/state/mapStoreTypes.ts
// This file contains only the types and interfaces used by the map store

export interface MapArea {
  id: string;
  name: string;
  coordinates: [number, number][][] | [number, number][][][];
  type: "polygon" | "rectangle" | "circle" | "multipolygon";
  properties?: Record<string, any>;
}

/**
 * What kind of shape a GeoJSONFeature represents.
 * - undefined: a real place, looked up via OSM search (Nominatim/Overpass).
 * - "special": one of the predefined catalog shapes (see src/data/specialShapes.ts).
 * - "custom-circle" / "custom-square": a user-defined circle or square from the Custom panel.
 *
 * This is the single source of truth for "what kind of shape is this" -
 * check `shapeKind` directly instead of pattern-matching osmType/osmClass/customId strings.
 */
export type ShapeKind = "special" | "custom-circle" | "custom-square";

export interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
    originalCoordinates?: any; // Store the original coordinates before any transformations
    currentCoordinates?: any; // Store the current coordinates after dragging
    rotatedCoordinates?: any; // Store pre-calculated rotated coordinates
    readonly coordinateCount: number;
  };
  properties: {
    name: string; // Name of the place/shape
    location?: string; // Location information (e.g., city, country, etc.)
    osmType: string;
    osmId: string | null;
    osmClass: string;
    shapeKind?: ShapeKind; // Set for generated shapes; absent for real OSM search results
    shapeId?: string; // Stable identifier for a generated shape's identity, e.g. "special-blue-whale"
    color?: string; // Add color property
    rotation?: number; // Rotation angle in degrees
    shouldBringToFocus?: boolean; // Whether this shape should be zoomed to when added
    [key: string]: any;
    whatIsIt: string;
  };
}

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
  creationPanelExpanded: boolean;
  setCreationPanelExpanded: (expanded: boolean) => void;
  setIsSelectingArea: (isSelecting: boolean) => void;
  setClickedPosition: (position: [number, number] | null) => void;
  addGeoJSONFromSearch: (feature: GeoJSONFeature, options?: { placeAtCenter?: boolean }) => void;
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
  updateElementRotation: (
    id: string,
    rotation: number,
    rotatedCoordinates?: any | null
  ) => void;
  updateElementName: (id: string, name: string) => void;
  updateCurrentCoordinates: (id: string, coordinates: any) => void;
  setHoveredCandidate: (candidate: GeoJSONFeature | null) => void;
  addToHistory: (feature: GeoJSONFeature) => void;
  clearHistory: () => void;
}
