/** Pin positions and on-screen extents for shapes, cached per shape version. */
import { bbox, labelPoint, place, toLocal, type LngLat, type AreaGeometry } from "../geo/geometry";
import { localKey, localOf, placedGeometry, type Shape } from "../state/shapes";

const pinLocalCache = new Map<string, Float64Array>();

/** The pin's position in the shape's local frame: the visual center of the outline. */
function pinLocal(s: Shape): Float64Array {
  const key = localKey(s);
  let v = pinLocalCache.get(key);
  if (!v) {
    const at0 = place(localOf(s), [0, 0]);
    const lp = labelPoint(at0);
    v = toLocal({ type: "Polygon", coordinates: [[lp, lp, lp, lp]] }, [0, 0])[0][0].slice(0, 3);
    pinLocalCache.set(key, v);
  }
  return v;
}

/** Where the pin sits for a shape at a given placement. */
export function pinAt(s: Shape, anchor: LngLat, rotation: number, scale: number): LngLat {
  const g = place([[pinLocal(s)]], anchor, rotation, scale);
  return (g.type === "Polygon" ? g.coordinates[0][0] : g.coordinates[0][0][0]) as LngLat;
}

const pinCache = new WeakMap<Shape, LngLat>();
export function pinPoint(s: Shape): LngLat {
  let p = pinCache.get(s);
  if (!p) {
    p = pinAt(s, s.anchor, s.rotation, s.scale);
    pinCache.set(s, p);
  }
  return p;
}

const bboxCache = new WeakMap<Shape, [number, number, number, number]>();
export function shapeBBox(s: Shape) {
  let b = bboxCache.get(s);
  if (!b) {
    b = bbox(placedGeometry(s));
    bboxCache.set(s, b);
  }
  return b;
}

export function bboxOf(geom: AreaGeometry) {
  return bbox(geom);
}
