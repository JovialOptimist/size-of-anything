// src/state/mapRegistry.ts
/**
 * Holds a reference to the main Leaflet map so UI outside MapView
 * (comparison tray, selection toolbar) can pan and zoom it.
 */
import L from "leaflet";
import type { GeoJSONFeature } from "./mapStoreTypes";

let mainMap: L.Map | null = null;

export function setMainMap(map: L.Map | null): void {
  mainMap = map;
}

export function getMainMap(): L.Map | null {
  return mainMap;
}

/** Fit the main map to a placed feature, using where it currently sits after dragging. */
export function zoomToFeature(feature: GeoJSONFeature): void {
  if (!mainMap) return;
  const geometry = {
    type: feature.geometry.type,
    coordinates:
      feature.geometry.rotatedCoordinates ??
      feature.geometry.currentCoordinates ??
      feature.geometry.coordinates,
  };
  const bounds = L.geoJSON(geometry as GeoJSON.Geometry).getBounds();
  if (bounds.isValid()) {
    mainMap.fitBounds(bounds, { padding: [120, 120], maxZoom: 19 });
  }
}
