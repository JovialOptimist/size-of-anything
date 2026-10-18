/**
 * Share links. The comparison is encoded in the URL (no server):
 * OSM places by id, objects by id, drawn shapes as encoded polylines in metres.
 */
import polyline from "@mapbox/polyline";
import { buildShape, useShapes, type Shape } from "../state/shapes";
import { fetchOutline, type PlaceResult } from "../geo/services";
import { getMap } from "../map/mapCore";
import type { IconKey } from "../geo/categories";
import type { MetersPolys } from "../objects/registry";

interface Entry {
  k: "o" | "x" | "d" | "e";
  id?: string;
  p?: string; // polyline (metres)
  a: [number, number];
  r?: number;
  s?: number;
  c: number;
  n: string;
  t?: string;
  l?: string;
  i?: IconKey;
  m?: 1;
}

const round = (n: number, d = 5) => Math.round(n * 10 ** d) / 10 ** d;

function toEntry(s: Shape): Entry {
  const base = { a: [round(s.anchor[0]), round(s.anchor[1])] as [number, number], r: s.rotation ? round(s.rotation, 1) : undefined, s: s.scale !== 1 ? round(s.scale, 6) : undefined, c: s.slot, n: s.name, t: s.type, l: s.locality, i: s.icon, m: s.mirrored ? (1 as const) : undefined };
  if (s.source.kind === "osm") return { k: "o", id: s.source.key, ...base };
  if (s.source.kind === "object") return { k: "x", id: s.source.id, ...base, t: undefined, l: undefined, i: undefined };
  const ring = s.source.meters[0][0].map(([x, y]) => [Math.round(y), Math.round(x)] as [number, number]);
  return { k: s.source.kind === "drawn" ? "d" : "e", p: polyline.encode(ring, 0), ...base };
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

export function shareUrl(): string {
  const m = getMap();
  const shapes = useShapes.getState().shapes;
  const data = { v: m ? [round(m.getCenter().lng, 4), round(m.getCenter().lat, 4), round(m.getZoom(), 2)] : undefined, s: shapes.map(toEntry) };
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("c", b64(JSON.stringify(data)));
  return url.toString();
}

export function shareTitle(): string {
  const shapes = useShapes.getState().shapes;
  if (shapes.length >= 2) return `${shapes[shapes.length - 1].name} vs ${shapes[shapes.length - 2].name}`;
  if (shapes.length === 1) return `${shapes[0].name}, at true size`;
  return "The Size of Anything";
}

/** Load a shared comparison from the URL, if there is one. Returns true when it did. */
export async function loadFromUrl(): Promise<boolean> {
  const c = new URLSearchParams(window.location.search).get("c");
  if (!c) return false;
  let data: { v?: [number, number, number]; s: Entry[] };
  try {
    data = JSON.parse(unb64(c));
  } catch {
    return false;
  }
  window.history.replaceState(null, "", window.location.pathname);
  if (data.v) getMap()?.jumpTo({ center: [data.v[0], data.v[1]], zoom: data.v[2] });
  const out: Shape[] = [];
  for (const e of data.s) {
    try {
      let shape: Shape;
      const common = { name: e.n, type: e.t ?? "", locality: e.l ?? "", icon: e.i ?? ("pin" as IconKey), anchor: e.a, rotation: e.r ?? 0, scale: e.s ?? 1, slot: e.c, mirrored: e.m === 1 || undefined };
      if (e.k === "o" && e.id) {
        const place: PlaceResult = { key: e.id, osmType: e.id[0] as "W", osmId: Number(e.id.slice(1)), name: e.n, type: e.t ?? "", icon: e.i ?? "pin", locality: e.l ?? "", source: "nominatim" };
        const o = await fetchOutline(place);
        shape = buildShape({ ...common, source: { kind: "osm", key: o.key }, geometry: o.geometry }, out);
      } else if (e.k === "x" && e.id) {
        shape = buildShape({ ...common, source: { kind: "object", id: e.id }, icon: "object" }, out);
        const { objectById } = await import("../objects/registry");
        shape.icon = objectById(e.id)?.icon ?? "object";
      } else if (e.p) {
        const ring = polyline.decode(e.p, 0).map(([y, x]) => [x, y] as [number, number]);
        const meters: MetersPolys = [[ring]];
        shape = buildShape({ ...common, source: { kind: e.k === "d" ? "drawn" : "exact", meters } }, out);
      } else continue;
      shape.anchor = e.a;
      out.push(shape);
      useShapes.setState({ shapes: [...out] });
    } catch {
      /* skip shapes that fail to load */
    }
  }
  useShapes.setState({ shapes: out, past: [], future: [], selectedId: null });
  return true;
}
