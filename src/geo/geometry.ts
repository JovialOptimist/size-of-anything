/**
 * True-size geometry engine.
 *
 * A shape's original outline is converted once into a local tangent frame
 * (east, north, up) around its center on the unit sphere. Placing it anywhere
 * is then a rigid rotation of the sphere that maps the original center to the
 * new anchor and keeps north pointing north, optionally rotated and scaled.
 * Rigid rotations preserve area, so the shape keeps its true size at any
 * latitude, and placement costs a few multiplications per vertex.
 */
import area from "@turf/area";
import centerOfMass from "@turf/center-of-mass";
import polylabel from "polylabel";

export type LngLat = [number, number];
export type Ring = LngLat[];
export type PolygonCoords = Ring[];
export type AreaGeometry =
  | { type: "Polygon"; coordinates: PolygonCoords }
  | { type: "MultiPolygon"; coordinates: PolygonCoords[] };

/** Local coordinates: flat array of (east, north, up) unit-sphere components per vertex. */
export type LocalShape = Float64Array[][];

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
export const EARTH_RADIUS = 6371008.8;

type Vec = [number, number, number];

function toVec(lng: number, lat: number): Vec {
  const p = lat * RAD;
  const l = lng * RAD;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
}

function frame(lng: number, lat: number): { e: Vec; n: Vec; u: Vec } {
  const clampedLat = Math.max(-89.5, Math.min(89.5, lat));
  const p = clampedLat * RAD;
  const l = lng * RAD;
  const u = toVec(lng, clampedLat);
  const e: Vec = [-Math.sin(l), Math.cos(l), 0];
  const n: Vec = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)];
  return { e, n, u };
}

function polygonsOf(geom: AreaGeometry): PolygonCoords[] {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

export function geometryCenter(geom: AreaGeometry): LngLat {
  const c = centerOfMass({ type: "Feature", properties: {}, geometry: geom } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>);
  return c.geometry.coordinates as LngLat;
}

export function geometryArea(geom: AreaGeometry): number {
  return area({ type: "Feature", properties: {}, geometry: geom } as GeoJSON.Feature);
}

export function toLocal(geom: AreaGeometry, origin: LngLat): LocalShape {
  const { e, n, u } = frame(origin[0], origin[1]);
  return polygonsOf(geom).map((poly) =>
    poly.map((ring) => {
      const out = new Float64Array(ring.length * 3);
      ring.forEach(([lng, lat], i) => {
        const v = toVec(lng, lat);
        out[i * 3] = v[0] * e[0] + v[1] * e[1] + v[2] * e[2];
        out[i * 3 + 1] = v[0] * n[0] + v[1] * n[1] + v[2] * n[2];
        out[i * 3 + 2] = v[0] * u[0] + v[1] * u[1] + v[2] * u[2];
      });
      return out;
    })
  );
}

/** Build local coordinates directly from a polygon in metres (x east, y north) around 0,0. */
export function localFromMeters(polys: [number, number][][][]): LocalShape {
  return polys.map((poly) =>
    poly.map((ring) => {
      const out = new Float64Array(ring.length * 3);
      ring.forEach(([x, y], i) => {
        const a = x / EARTH_RADIUS;
        const b = y / EARTH_RADIUS;
        out[i * 3] = a;
        out[i * 3 + 1] = b;
        out[i * 3 + 2] = Math.sqrt(Math.max(0, 1 - a * a - b * b));
      });
      return out;
    })
  );
}

/** Place local coordinates at an anchor, rotated clockwise by `rotation` degrees and scaled linearly. */
export function place(local: LocalShape, anchor: LngLat, rotation = 0, scale = 1): AreaGeometry {
  const { e, n, u } = frame(anchor[0], anchor[1]);
  const c = Math.cos(rotation * RAD);
  const s = Math.sin(rotation * RAD);
  const polys: PolygonCoords[] = local.map((poly) =>
    poly.map((arr) => {
      const ring: Ring = new Array(arr.length / 3);
      for (let i = 0; i < arr.length; i += 3) {
        let a = arr[i];
        let b = arr[i + 1];
        let w = arr[i + 2];
        if (scale !== 1) {
          a *= scale;
          b *= scale;
          w = Math.sqrt(Math.max(0, 1 - a * a - b * b));
        }
        const a2 = a * c + b * s;
        const b2 = -a * s + b * c;
        const x = a2 * e[0] + b2 * n[0] + w * u[0];
        const y = a2 * e[1] + b2 * n[1] + w * u[1];
        const z = a2 * e[2] + b2 * n[2] + w * u[2];
        const lng = Math.atan2(y, x) * DEG;
        const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * DEG;
        ring[i / 3] = [lng, lat];
      }
      return unwrapRing(ring);
    })
  );
  return polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
}

/** Keep consecutive longitudes continuous so shapes crossing the antimeridian don't smear across the map. */
function unwrapRing(ring: Ring): Ring {
  for (let i = 1; i < ring.length; i++) {
    let d = ring[i][0] - ring[i - 1][0];
    while (d > 180) {
      ring[i][0] -= 360;
      d -= 360;
    }
    while (d < -180) {
      ring[i][0] += 360;
      d += 360;
    }
  }
  return ring;
}

export function vertexCount(geom: AreaGeometry): number {
  return polygonsOf(geom).reduce((sum, p) => sum + p.reduce((s, r) => s + r.length, 0), 0);
}

/** Visual center for handles and labels: pole of inaccessibility of the largest polygon. */
export function labelPoint(geom: AreaGeometry): LngLat {
  const polys = polygonsOf(geom);
  let best = polys[0];
  let bestArea = -1;
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]));
    if (a > bestArea) {
      bestArea = a;
      best = p;
    }
  }
  const lat0 = best[0][0][1] * RAD;
  const k = Math.cos(lat0);
  const projected = best.map((r) => r.map(([x, y]) => [x * k, y]));
  const pt = polylabel(projected, 0.00001 * Math.max(1, Math.sqrt(bestArea)));
  return [pt[0] / k, pt[1]];
}

function ringArea(ring: Ring): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
  }
  return s / 2;
}

export function bbox(geom: AreaGeometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygonsOf(geom))
    for (const [x, y] of p[0]) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

/** Convert local coordinates back to metres (for thumbnails). */
export function localToMeters(local: LocalShape): [number, number][][][] {
  return local.map((poly) =>
    poly.map((arr) => {
      const ring: [number, number][] = [];
      for (let i = 0; i < arr.length; i += 3) ring.push([arr[i] * EARTH_RADIUS, arr[i + 1] * EARTH_RADIUS]);
      return ring;
    })
  );
}

/** Douglas–Peucker on a screen-space or lng/lat polyline. */
export function simplifyLine(points: [number, number][], tolerance: number): [number, number][] {
  if (points.length < 3) return points;
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    let maxD = 0;
    let index = -1;
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      let t = len ? ((px - ax) * dx + (py - ay) * dy) / len : 0;
      t = Math.max(0, Math.min(1, t));
      const ex = ax + t * dx - px, ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > maxD) {
        maxD = d;
        index = i;
      }
    }
    if (maxD > sq && index > 0) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Simplify a large outline so dragging stays smooth. */
export function simplifyGeometry(geom: AreaGeometry, maxVertices = 20000): AreaGeometry {
  if (vertexCount(geom) <= maxVertices) return geom;
  const [minX, minY, maxX, maxY] = bbox(geom);
  let tol = Math.max(maxX - minX, maxY - minY) / 20000;
  let out = geom;
  for (let i = 0; i < 12 && vertexCount(out) > maxVertices; i++) {
    const t = tol;
    const polys = polygonsOf(geom)
      .map((p) => p.map((r) => closeRing(simplifyLine(r, t) as Ring)).filter((r) => r.length >= 4))
      .filter((p) => p.length > 0);
    out = polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
    tol *= 1.8;
  }
  return out;
}

export function closeRing(ring: Ring): Ring {
  if (ring.length && (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1])) {
    return [...ring, [ring[0][0], ring[0][1]]];
  }
  return ring;
}

/** Normalize anything GeoJSON-ish from Nominatim into a Polygon/MultiPolygon or null. */
export function normalizeGeometry(g: { type: string; coordinates: unknown } | null | undefined): AreaGeometry | null {
  if (!g) return null;
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.coordinates as PolygonCoords };
  if (g.type === "MultiPolygon") {
    const c = g.coordinates as PolygonCoords[];
    return c.length === 1 ? { type: "Polygon", coordinates: c[0] } : { type: "MultiPolygon", coordinates: c };
  }
  return null;
}

/** How much Web Mercator inflates areas at a latitude. */
export function mercatorInflation(lat: number): number {
  const c = Math.cos(lat * RAD);
  return 1 / (c * c);
}
