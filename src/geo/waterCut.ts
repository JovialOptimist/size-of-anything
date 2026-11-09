/**
 * Cuts the water out of an outline, using the water polygons in the basemap's own vector tiles
 * (OpenMapTiles schema, served by OpenFreeMap). Those are classed, so the sea and inland water
 * (lakes, rivers, docks) can be removed separately.
 *
 * Tiles are fetched at the most detailed zoom that covers the outline in at most MAX_TILES.
 * Checked against official figures: within about 1.5% for the sea at any size; land only is as
 * close for cities but runs high for vast countries, whose low-zoom tiles leave out small lakes.
 */
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import area from "@turf/area";
import union from "@turf/union";
import difference from "@turf/difference";
import bboxClip from "@turf/bbox-clip";
import { featureCollection } from "@turf/helpers";
import { WATER_TILES } from "../config";
import { bbox, geometryArea, simplifyGeometry, type AreaGeometry, type PolygonCoords } from "./geometry";
import type { WaterCut, Waterless } from "./water";

const MAX_TILES = 64;
const MAX_ZOOM = 12;
/** Inland water smaller than this share of the place is left in. */
const MIN_LAKE = 0.0005;

type Poly = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;

/**
 * fetch, tried up to three times on a network error, 429 or 5xx: a place needs up to MAX_TILES
 * requests, and losing any one of them loses the whole measurement.
 */
async function fetchRetrying(url: string): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (attempt === 3 || (res.status !== 429 && res.status < 500)) return res;
    } catch (e) {
      if (attempt === 3) throw e;
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
}

let template: Promise<string> | undefined;
/** The tile URL template. It names a dated build of the planet, so ask the TileJSON for it. */
function tileTemplate() {
  template ??= fetchRetrying(WATER_TILES)
    .then(async (r) => {
      if (!r.ok) throw new Error(`TileJSON ${r.status}`);
      return ((await r.json()) as { tiles: string[] }).tiles[0];
    })
    .catch((e) => {
      // Ask again next time rather than failing every place for the rest of the session.
      template = undefined;
      throw e;
    });
  return template;
}

const tileX = (lng: number, z: number) => Math.min(2 ** z - 1, Math.max(0, Math.floor(((lng + 180) / 360) * 2 ** z)));
const tileY = (lat: number, z: number) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return Math.min(2 ** z - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)));
};
const tileLng = (x: number, z: number) => (x / 2 ** z) * 360 - 180;
const tileLat = (y: number, z: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI;

type Ring = PolygonCoords[number];

/** Corners sharper than about half a degree. */
const SPIKE = 0.01;

/**
 * Close the hairline cracks in the tiles' sea. It's built from pieces, and some joins leave a
 * needle of not-sea running dead straight along a tile line (one goes 166 km out from Hokkaido's
 * coast); cutting a border along it leaves a sliver of "land" in the sea. Only needles with a
 * side due north-south or east-west go, so real ones, like the ditches of a polder, stay.
 */
function closeCracks(ring: Ring): Ring {
  const pts = ring.slice(0, -1);
  for (let changed = true; changed && pts.length > 3; ) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > 3; ) {
      const [bx, by] = pts[i];
      const [ax, ay] = pts[(i + pts.length - 1) % pts.length];
      const [cx, cy] = pts[(i + 1) % pts.length];
      const k = Math.cos((by * Math.PI) / 180); // so a degree of longitude counts for what it covers
      const ux = (ax - bx) * k, uy = ay - by, vx = (cx - bx) * k, vy = cy - by;
      const straight = ax === bx || ay === by || cx === bx || cy === by;
      if (straight && ux * vx + uy * vy > 0 && Math.abs(ux * vy - uy * vx) < SPIKE * Math.hypot(ux, uy) * Math.hypot(vx, vy)) {
        pts.splice(i, 1);
        changed = true;
      } else i++;
    }
  }
  return [...pts, pts[0]];
}

/** Rings with fewer than four points (left over from clipping) make the polygon library throw. */
function cleanPolygons(geom: GeoJSON.Polygon | GeoJSON.MultiPolygon, cracks = false): PolygonCoords[] {
  const polys = (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates) as PolygonCoords[];
  return polys.map((p) => (cracks ? p.map(closeCracks) : p).filter((r) => r.length >= 4)).filter((p) => p.length > 0 && p[0].length >= 4);
}

function asFeature(polys: PolygonCoords[]): Poly {
  return { type: "Feature", properties: {}, geometry: { type: "MultiPolygon", coordinates: polys } };
}

async function waterIn(geom: AreaGeometry): Promise<{ sea: Poly[]; inland: Poly[] }> {
  const [w, s, e, n] = bbox(geom);
  let z = MAX_ZOOM;
  const count = (z: number) => (tileX(e, z) - tileX(w, z) + 1) * (tileY(s, z) - tileY(n, z) + 1);
  while (z > 0 && count(z) > MAX_TILES) z--;
  const url = await tileTemplate();
  const tiles: [number, number][] = [];
  for (let x = tileX(w, z); x <= tileX(e, z); x++) for (let y = tileY(n, z); y <= tileY(s, z); y++) tiles.push([x, y]);

  const sea: Poly[] = [];
  const inland: Poly[] = [];
  await Promise.all(
    tiles.map(async ([x, y]) => {
      const res = await fetchRetrying(url.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)));
      if (!res.ok) throw new Error(`tile ${z}/${x}/${y}: ${res.status}`);
      const layer = new VectorTile(new PbfReader(new Uint8Array(await res.arrayBuffer()))).layers.water;
      if (!layer) return;
      // Tiles overlap a little at the edges; clip to each tile's own square so nothing counts twice.
      const square: [number, number, number, number] = [tileLng(x, z), tileLat(y + 1, z), tileLng(x + 1, z), tileLat(y, z)];
      for (let i = 0; i < layer.length; i++) {
        const f = layer.feature(i).toGeoJSON(x, y, z) as GeoJSON.Feature;
        if (f.geometry.type !== "Polygon" && f.geometry.type !== "MultiPolygon") continue;
        if (f.properties?.class === "swimming_pool") continue;
        const ocean = f.properties?.class === "ocean";
        const polys = cleanPolygons(bboxClip(f as Poly, square).geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon, ocean);
        if (polys.length) (ocean ? sea : inland).push(asFeature(polys));
      }
    })
  );
  return { sea, inland };
}

function minus(shape: Poly | null, water: Poly[]): Poly | null {
  if (!shape || water.length === 0) return shape;
  const merged = water.length === 1 ? water[0] : union(featureCollection(water));
  return merged ? (difference(featureCollection([shape, merged as Poly])) as Poly | null) : shape;
}

/**
 * Simplifying thins each ring on its own, so a ring can end up crossing itself or a neighbour,
 * and the map then fills that part twice. A union with itself redraws the outline without crossings.
 */
function untangle(geom: AreaGeometry): AreaGeometry {
  const f: Poly = { type: "Feature", properties: {}, geometry: geom };
  return (union(featureCollection([f, f]))?.geometry as AreaGeometry | undefined) ?? geom;
}

/** Keep a cut only if it removed something, and didn't remove nearly everything (a place that's mostly water). */
function toCut(cut: Poly | null, before: number): WaterCut | null {
  if (!cut) return null;
  const polys = cleanPolygons(cut.geometry);
  if (!polys.length) return null;
  const outline: AreaGeometry = polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
  const thinned = simplifyGeometry(outline);
  const geometry = thinned === outline ? outline : untangle(thinned);
  const area = geometryArea(geometry);
  return area < before * 0.995 && area > before * 0.05 ? { geometry, area } : null;
}

export async function cutWater(geometry: AreaGeometry): Promise<Waterless> {
  const { sea, inland } = await waterIn(geometry);
  const before = geometryArea(geometry);
  const shape: Poly = { type: "Feature", properties: {}, geometry: geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon };
  const noSea = minus(shape, sea);
  // Ponds would pepper the outline with holes for next to no area; keep lakes worth seeing.
  // Tiles split lakes at their edges, so merge first, then judge each lake whole.
  const merged = inland.length > 1 ? union(featureCollection(inland)) : inland[0];
  const lakes = merged ? cleanPolygons(merged.geometry).map((p) => asFeature([p])).filter((f) => area(f) > before * MIN_LAKE) : [];
  const landOnly = minus(noSea, lakes);
  const seaCut = toCut(noSea, before);
  return { sea: seaCut, all: toCut(landOnly, before) ?? seaCut };
}
