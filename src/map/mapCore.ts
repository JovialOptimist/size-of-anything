/**
 * MapLibre setup and the layers that draw shapes. React components reach the
 * map through getMap(); geometry for every shape is pushed with syncShapes().
 */
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification, GeoJSONSource } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { BASEMAPS, SATELLITE_TILES } from "../config";
import { shapeColor } from "./palette";
import { placedGeometry, type Shape } from "../state/shapes";
import type { AreaGeometry, LngLat } from "../geo/geometry";

maplibregl.setWorkerUrl(workerUrl);

let map: maplibregl.Map | null = null;
export const getMap = () => map;
export const setMapInstance = (m: maplibregl.Map | null) => {
  map = m;
  if (import.meta.env.DEV) (window as unknown as { __soaMap: unknown }).__soaMap = m;
};

// ---------- styles ----------
const styleCache = new Map<string, StyleSpecification>();
async function fetchStyle(url: string): Promise<StyleSpecification> {
  if (!styleCache.has(url)) styleCache.set(url, await (await fetch(url)).json());
  return structuredClone(styleCache.get(url)!);
}

/**
 * Flat buildings only: 3D extrusions would hide shape outlines behind them.
 * Styles like Liberty stop drawing flat buildings where the 3D layer takes over
 * (zoom 14), so once that layer is gone the flat one has to keep going.
 */
function flatten(style: StyleSpecification): StyleSpecification {
  const hadExtrusions = style.layers.some((l) => l.type === "fill-extrusion");
  style.layers = style.layers.filter((l) => l.type !== "fill-extrusion");
  if (hadExtrusions) for (const l of style.layers) if (l.type === "fill" && l.id.includes("building")) delete l.maxzoom;
  return style;
}

export async function buildStyle(basemap: "map" | "satellite", dark: boolean): Promise<StyleSpecification> {
  if (basemap === "map") return flatten(await fetchStyle(dark ? BASEMAPS.dark : BASEMAPS.light));
  // Satellite with labels: imagery under the street map's label and road-name layers.
  const base = await fetchStyle(BASEMAPS.light);
  const labelLayers = base.layers.filter((l) => l.type === "symbol");
  labelLayers.forEach((l) => {
    if (l.type === "symbol") l.paint = { ...(l.paint || {}), "text-color": "#ffffff", "text-halo-color": "rgba(0,0,0,0.75)", "text-halo-width": 1.4 };
  });
  return {
    ...base,
    sources: { ...base.sources, satellite: { type: "raster", tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 19, attribution: "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community" } },
    layers: [
      { id: "satellite", type: "raster", source: "satellite", paint: { "raster-saturation": -0.2, "raster-brightness-max": 0.92 } },
      ...labelLayers,
    ],
  };
}

// ---------- shape layers ----------
const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export interface LayerLook {
  darkMap: boolean;
  satellite: boolean;
  fillOpacity: number;
}

/**
 * Where shapes go in the layer stack: above every area and line layer of the
 * basemap (land, buildings, roads), but under the block of text labels at the
 * top, so place names stay readable. Some styles put a few symbol layers (like
 * one-way arrows) early on, so "the first symbol layer" is not the right spot.
 */
function firstSymbolLayer(m: maplibregl.Map) {
  const layers = m.getStyle().layers.filter((l) => !l.id.startsWith("soa-"));
  let lastShape = -1;
  layers.forEach((l, i) => {
    if (l.type !== "symbol") lastShape = i;
  });
  return layers[lastShape + 1]?.id;
}

export type ShapeState = "resting" | "hovered" | "selected";

/** How a shape is drawn in each state. The WebGL layers and the drag overlay both use this. */
export function shapePaint(state: ShapeState, look: LayerLook) {
  const selected = state === "selected";
  return {
    fillOpacity: selected ? look.fillOpacity + 0.1 : look.fillOpacity,
    casingColor: look.satellite ? "rgba(16,20,24,0.75)" : look.darkMap ? "#0c0c0c" : "#ffffff",
    casingWidth: selected ? 7 : look.satellite ? 4.5 : 0,
    casingOpacity: selected ? 0.9 : look.satellite ? 1 : 0,
    lineWidth: selected ? 3.5 : state === "hovered" ? 3.2 : look.satellite ? 2.5 : 2,
  };
}

export function ensureLayers(m: maplibregl.Map, look: LayerLook) {
  for (const id of ["soa-shapes", "soa-drag", "soa-preview", "soa-draw"]) {
    if (!m.getSource(id)) m.addSource(id, { type: "geojson", data: EMPTY, tolerance: id === "soa-drag" ? 0.6 : 0.375, promoteId: "id" });
  }
  const before = firstSymbolLayer(m);
  const paint = { selected: shapePaint("selected", look), hovered: shapePaint("hovered", look), resting: shapePaint("resting", look) };
  const byState = (key: "fillOpacity" | "casingWidth" | "casingOpacity" | "lineWidth"): maplibregl.ExpressionSpecification =>
    ["case", ["get", "selected"], paint.selected[key], ["boolean", ["feature-state", "hover"], false], paint.hovered[key], paint.resting[key]];
  const add = (layer: maplibregl.AddLayerObject, beforeId?: string) => {
    if (!m.getLayer(layer.id)) m.addLayer(layer, beforeId);
  };
  for (const src of ["soa-shapes", "soa-drag"]) {
    const p = src === "soa-drag" ? "soa-drag" : "soa";
    add({ id: `${p}-fill`, type: "fill", source: src, paint: { "fill-color": ["get", "color"], "fill-opacity": byState("fillOpacity") } }, before);
    add({ id: `${p}-casing`, type: "line", source: src, paint: { "line-color": paint.resting.casingColor, "line-width": byState("casingWidth"), "line-opacity": byState("casingOpacity") }, layout: { "line-join": "round" } }, before);
    add({ id: `${p}-line`, type: "line", source: src, paint: { "line-color": ["get", "color"], "line-width": byState("lineWidth") }, layout: { "line-join": "round" } }, before);
  }
  add({ id: "soa-preview-fill", type: "fill", source: "soa-preview", paint: { "fill-color": look.darkMap ? "#e8ebef" : "#1b2026", "fill-opacity": 0.1 } });
  add({ id: "soa-preview-line", type: "line", source: "soa-preview", paint: { "line-color": look.darkMap ? "#e8ebef" : "#1b2026", "line-width": 2.5, "line-dasharray": [2, 1.5] } });
  add({ id: "soa-draw-fill", type: "fill", source: "soa-draw", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": "#888", "fill-opacity": 0.12 } });
  add({ id: "soa-draw-line", type: "line", source: "soa-draw", paint: { "line-color": look.darkMap ? "#e8ebef" : "#1b2026", "line-width": 2.5 } });
  add({ id: "soa-draw-pts", type: "circle", source: "soa-draw", filter: ["==", ["geometry-type"], "Point"], paint: { "circle-radius": 6, "circle-color": look.darkMap ? "#e8ebef" : "#1b2026", "circle-stroke-color": look.darkMap ? "#1b2026" : "#fff", "circle-stroke-width": 2 } });
}

function feature(s: Shape, geom: AreaGeometry, selected: boolean, darkMap: boolean): GeoJSON.Feature {
  return { type: "Feature", id: undefined, geometry: geom as GeoJSON.Geometry, properties: { id: s.id, color: shapeColor(s.slot, darkMap), selected } };
}

export function syncShapes(shapes: Shape[], selectedId: string | null, darkMap: boolean, hiddenId?: string) {
  const m = map;
  if (!m || !m.getSource("soa-shapes")) return;
  const visible = shapes.filter((s) => s.id !== hiddenId);
  // Selected shape last so it draws on top.
  visible.sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId));
  (m.getSource("soa-shapes") as GeoJSONSource).setData({ type: "FeatureCollection", features: visible.map((s) => feature(s, placedGeometry(s), s.id === selectedId, darkMap)) });
}

export function setDragShape(s: Shape | null, geom: AreaGeometry | null, darkMap: boolean) {
  const src = map?.getSource("soa-drag") as GeoJSONSource | undefined;
  src?.setData(s && geom ? { type: "FeatureCollection", features: [feature(s, geom, true, darkMap)] } : EMPTY);
}

export function setPreview(geom: AreaGeometry | null) {
  (map?.getSource("soa-preview") as GeoJSONSource | undefined)?.setData(geom ? { type: "Feature", geometry: geom as GeoJSON.Geometry, properties: {} } : EMPTY);
}

export function setDrawData(fc: GeoJSON.FeatureCollection | null) {
  (map?.getSource("soa-draw") as GeoJSONSource | undefined)?.setData(fc || EMPTY);
}

/** The center of the part of the map not covered by panels (MapLibre padding does the work). */
export function visibleCenter(): LngLat {
  const c = map!.getCenter();
  return [c.lng, c.lat];
}

export function fitGeometry(geom: AreaGeometry, opts: { maxZoom?: number; animate?: boolean } = {}) {
  if (!map) return;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys)
    for (const [x, y] of p[0]) {
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  map.fitBounds([[minX, minY], [maxX, maxY]], { padding: 60, maxZoom: opts.maxZoom ?? 18, animate: opts.animate !== false && !reduce, duration: 900 });
}

/** True when a shape at the current view would be smaller than `px` on screen. */
export function isTinyOnScreen(geom: AreaGeometry, px = 24) {
  if (!map) return false;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys)
    for (const pt of p[0]) {
      const s = map.project(pt as [number, number]);
      minX = Math.min(minX, s.x); minY = Math.min(minY, s.y); maxX = Math.max(maxX, s.x); maxY = Math.max(maxY, s.y);
    }
  return Math.max(maxX - minX, maxY - minY) < px;
}

/** Current map padding with every side defined. */
export function getPad() {
  const p: Partial<maplibregl.PaddingOptions> = map?.getPadding() ?? {};
  return { left: p.left ?? 0, top: p.top ?? 0, right: p.right ?? 0, bottom: p.bottom ?? 0 };
}
