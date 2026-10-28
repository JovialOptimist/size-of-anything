/** User-level actions shared by panels, overlays and keyboard shortcuts. */
import { useShapes, placedGeometry, type NewShape } from "../state/shapes";
import { useUI, announce } from "../state/ui";
import { fitGeometry, getMap, getPad, visibleCenter } from "../map/mapCore";
import { objectById } from "../objects/registry";
import type { Outline } from "../geo/services";
import { dryAreas, removesWater, waterlessFor } from "../geo/water";
import type { LngLat } from "../geo/geometry";
import { geometryCenter } from "../geo/geometry";

/** Bring a shape into view if it is off screen, too small to see, or bigger than the view. */
export function revealShape(id: string) {
  zoomToIfNeeded(id, true);
}

function zoomToIfNeeded(id: string, checkOffscreen = false) {
  const s = useShapes.getState().shapes.find((x) => x.id === id);
  const m = getMap();
  if (!s || !m) return;
  const g = placedGeometry(s);
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys)
    for (const pt of p[0]) {
      const q = m.project(pt as [number, number]);
      minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); maxX = Math.max(maxX, q.x); maxY = Math.max(maxY, q.y);
    }
  const size = Math.max(maxX - minX, maxY - minY);
  const c = m.getCanvas();
  const pad = getPad();
  const avail = Math.min(c.clientWidth - pad.left - pad.right, c.clientHeight - pad.top - pad.bottom);
  const offscreen = checkOffscreen && (maxX < pad.left || minX > c.clientWidth - pad.right || maxY < pad.top || minY > c.clientHeight - pad.bottom);
  if (offscreen || size < 40 || size > avail * 0.95) fitGeometry(g);
}

function added(id: string, name: string) {
  useUI.getState().go({ name: "detail", id });
  zoomToIfNeeded(id);
  announce(`${name} added to the map`);
}

/** Add a searched place, either at the visible center or where it really is. */
export function addPlace(o: Outline, requested: "center" | "origin") {
  // From a whole-world view the "middle of the map" is usually open ocean; show it where it really is instead.
  const where = requested === "center" && (getMap()?.getZoom() ?? 10) < 4 ? "origin" : requested;
  const anchor: LngLat = where === "center" ? visibleCenter() : geometryCenter(o.geometry);
  const shape = useShapes.getState().add({
    name: o.name, type: o.type, locality: o.locality, icon: o.icon,
    source: { kind: "osm", key: o.key }, geometry: o.geometry, anchor,
  });
  useUI.getState().pushRecent({ ...o, area: shape.area });
  // So the recent list can show the area without water, like everywhere else.
  if (removesWater(o.icon)) waterlessFor(o.key, o.geometry).then((w) => w && useUI.getState().patchRecent(o.key, { dry: dryAreas(w) }));
  if (where === "origin") {
    useUI.getState().go({ name: "detail", id: shape.id });
    fitGeometry(placedGeometry(shape));
    announce(`${o.name} added where it really is`);
  } else added(shape.id, o.name);
  return shape;
}

export function addObject(id: string, at?: LngLat) {
  const obj = objectById(id);
  if (!obj) return;
  const shape = useShapes.getState().add({
    name: obj.name, type: obj.dims, locality: "Reference object", icon: obj.icon,
    source: { kind: "object", id }, anchor: at ?? visibleCenter(),
  });
  added(shape.id, obj.name);
}

export function addGenerated(input: Omit<NewShape, "anchor"> & { anchor?: LngLat }) {
  const shape = useShapes.getState().add({ ...input, anchor: input.anchor ?? visibleCenter() });
  added(shape.id, input.name);
}

export function deleteShape(id: string) {
  const s = useShapes.getState().remove(id);
  if (!s) return;
  const ui = useUI.getState();
  if (ui.stack.some((r) => r.name === "detail" && r.id === id)) ui.home();
  announce(`${s.name} deleted. Press Control Z to undo.`);
}

export function duplicateShape(id: string) {
  const m = getMap();
  const s = useShapes.getState().shapes.find((x) => x.id === id);
  if (!s || !m) return;
  const p = m.project(s.anchor);
  const ll = m.unproject([p.x + 40, p.y + 40]);
  const copy = useShapes.getState().duplicate(id, [ll.lng, ll.lat]);
  if (copy) {
    useUI.getState().go({ name: "detail", id: copy.id });
    announce(`Cloned ${s.name}`);
  }
}

export function moveShapeTo(id: string, anchor: LngLat) {
  useShapes.getState().update(id, { anchor });
  const s = useShapes.getState().shapes.find((x) => x.id === id);
  if (s) {
    fitGeometry(placedGeometry(s), { maxZoom: 17 });
    announce(`${s.name} moved`);
  }
}

export function undo() {
  const before = useShapes.getState().past.length;
  useShapes.getState().undo();
  if (useShapes.getState().past.length !== before) announce("Undone");
}

export function redo() {
  const before = useShapes.getState().future.length;
  useShapes.getState().redo();
  if (useShapes.getState().future.length !== before) announce("Redone");
}
