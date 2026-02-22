/**
 * Utilities for portal markers: shape center, bounds, and edge position on screen.
 */
import L from "leaflet";
import * as turf from "@turf/turf";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";

const EDGE_MARGIN_PX = 28;

/** Exclusion zones so portals never sit under UI (creation panel, ellipsis, bottom-right buttons). */
const EXCLUDE_CREATION_LEFT_EXPANDED = 540;   /* creation panel expanded width + padding */
const EXCLUDE_CREATION_TOP_EXPANDED = 560;    /* creation panel expanded height + padding */
const EXCLUDE_CREATION_LEFT_COLLAPSED = 340;  /* creation panel collapsed: 16 + 320 + padding */
const EXCLUDE_CREATION_TOP_COLLAPSED = 70;    /* creation panel collapsed: 16 + 44 + padding */
const EXCLUDE_ELLIPSIS_RIGHT = 70;  /* ellipsis top-right + padding */
const EXCLUDE_ELLIPSIS_TOP = 70;
const EXCLUDE_BOTTOM_RIGHT_X = 270; /* feedback/share/layer/zoom + padding */
const EXCLUDE_BOTTOM_RIGHT_Y = 190;

/**
 * Get the current coordinates from a feature (currentCoordinates or coordinates).
 */
function getFeatureCoords(feature: GeoJSONFeature): any {
  const geom = feature.geometry;
  return (geom as any).currentCoordinates ?? geom.coordinates;
}

/**
 * Get a GeoJSON feature for turf/Leaflet (with current position).
 */
export function getFeatureForPosition(feature: GeoJSONFeature): GeoJSON.Feature {
  const coords = getFeatureCoords(feature);
  return {
    type: "Feature",
    properties: feature.properties,
    geometry: {
      type: feature.geometry.type,
      coordinates: coords,
    },
  } as GeoJSON.Feature;
}

/**
 * Get shape center [lat, lng] for a GeoJSON feature (using current position).
 */
export function getShapeCenter(feature: GeoJSONFeature): [number, number] {
  const f = getFeatureForPosition(feature);
  const centroid = turf.centroid(f);
  const [lng, lat] = centroid.geometry.coordinates;
  return [lat, lng];
}

/**
 * Get LatLngBounds for a feature (current position).
 */
export function getShapeBounds(feature: GeoJSONFeature): L.LatLngBounds {
  const f = getFeatureForPosition(feature);
  const layer = L.geoJSON(f as any);
  const bounds = layer.getBounds();
  return bounds;
}

/**
 * Check if the shape is fully off-screen (no intersection with viewport).
 */
export function isShapeOffScreen(
  map: L.Map,
  feature: GeoJSONFeature
): boolean {
  const bounds = getShapeBounds(feature);
  return !map.getBounds().intersects(bounds);
}

export interface PortalPositionOptions {
  /** When false, use smaller creation-panel exclusion (collapsed bar only). */
  creationPanelExpanded?: boolean;
}

/**
 * Compute portal position (in container pixels) so the marker sits on the
 * viewport edge in the direction of the shape from the map center.
 */
export function getPortalPositionOnEdge(
  map: L.Map,
  shapeCenterLatLng: L.LatLng,
  options?: PortalPositionOptions
): { x: number; y: number } | null {
  const creationPanelExpanded = options?.creationPanelExpanded ?? true;
  const EXCLUDE_CREATION_LEFT = creationPanelExpanded ? EXCLUDE_CREATION_LEFT_EXPANDED : EXCLUDE_CREATION_LEFT_COLLAPSED;
  const EXCLUDE_CREATION_TOP = creationPanelExpanded ? EXCLUDE_CREATION_TOP_EXPANDED : EXCLUDE_CREATION_TOP_COLLAPSED;
  const size = map.getSize();
  if (!size) return null;
  const w = size.x;
  const h = size.y;
  const center = map.getCenter();
  const centerPoint = map.latLngToContainerPoint(center);
  const shapePoint = map.latLngToContainerPoint(shapeCenterLatLng);

  const cx = centerPoint.x;
  const cy = centerPoint.y;
  const sx = shapePoint.x;
  const sy = shapePoint.y;

  // If shape center is on-screen, no portal (caller should filter)
  if (
    sx >= EDGE_MARGIN_PX &&
    sx <= w - EDGE_MARGIN_PX &&
    sy >= EDGE_MARGIN_PX &&
    sy <= h - EDGE_MARGIN_PX
  ) {
    return null;
  }

  let dx = sx - cx;
  let dy = sy - cy;

  // Avoid division by zero: nudge direction so we still hit an edge
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  if (Math.abs(dx) < 1e-6) dx = 1e-6;
  if (Math.abs(dy) < 1e-6) dy = 1e-6;

  const margin = EDGE_MARGIN_PX;
  let tMin = Infinity;

  // Left edge: x = margin
  if (dx !== 0) {
    const t = (margin - cx) / dx;
    if (t > 0) {
      const y = cy + t * dy;
      if (y >= margin && y <= h - margin) tMin = Math.min(tMin, t);
    }
  }
  // Right edge
  if (dx !== 0) {
    const t = (w - margin - cx) / dx;
    if (t > 0) {
      const y = cy + t * dy;
      if (y >= margin && y <= h - margin) tMin = Math.min(tMin, t);
    }
  }
  // Top edge: y = margin
  if (dy !== 0) {
    const t = (margin - cy) / dy;
    if (t > 0) {
      const x = cx + t * dx;
      if (x >= margin && x <= w - margin) tMin = Math.min(tMin, t);
    }
  }
  // Bottom edge
  if (dy !== 0) {
    const t = (h - margin - cy) / dy;
    if (t > 0) {
      const x = cx + t * dx;
      if (x >= margin && x <= w - margin) tMin = Math.min(tMin, t);
    }
  }

  if (tMin === Infinity || tMin <= 0) return null;

  let x = cx + tMin * dx;
  let y = cy + tMin * dy;

  // Nudge along the edge so we never sit under creation panel, ellipsis, or bottom-right buttons
  const tol = 8;

  if (x <= margin + tol) {
    // Left edge: avoid creation panel (0,0) to (EXCLUDE_CREATION_LEFT, EXCLUDE_CREATION_TOP)
    if (y < EXCLUDE_CREATION_TOP) y = Math.min(h - margin, EXCLUDE_CREATION_TOP);
    y = Math.max(margin, Math.min(h - margin, y));
  } else if (x >= w - margin - tol) {
    // Right edge: avoid ellipsis (top) and bottom-right buttons (bottom)
    const yMin = Math.max(margin, EXCLUDE_ELLIPSIS_TOP);
    const yMax = Math.min(h - margin, h - EXCLUDE_BOTTOM_RIGHT_Y);
    y = Math.max(yMin, Math.min(yMax, y));
  } else if (y <= margin + tol) {
    // Top edge: avoid creation panel (left) and ellipsis (right)
    const xMin = Math.max(margin, EXCLUDE_CREATION_LEFT);
    const xMax = Math.min(w - margin, w - EXCLUDE_ELLIPSIS_RIGHT);
    x = Math.max(xMin, Math.min(xMax, x));
  } else if (y >= h - margin - tol) {
    // Bottom edge: avoid bottom-right buttons
    const xMax = Math.min(w - margin, w - EXCLUDE_BOTTOM_RIGHT_X);
    x = Math.max(margin, Math.min(xMax, x));
  }

  type Edge = "top" | "bottom" | "left" | "right";
  let edge: Edge = "bottom";
  if (x <= margin + tol) edge = "left";
  else if (x >= w - margin - tol) edge = "right";
  else if (y <= margin + tol) edge = "top";
  else edge = "bottom";

  return { x, y, edge };
}

export type PortalEdge = "top" | "bottom" | "left" | "right";

export { EDGE_MARGIN_PX };
