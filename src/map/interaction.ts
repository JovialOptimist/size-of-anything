/**
 * Moving and rotating shapes. During a gesture the shape is drawn from a
 * separate small source and only committed to the store (one undo step) on release.
 */
import { create } from "zustand";
import { getMap, setDragShape, syncShapes } from "./mapCore";
import { localOf, useShapes, type Shape } from "../state/shapes";
import { place, type LngLat } from "../geo/geometry";
import { pinPoint } from "./pins";
import { announce } from "../state/ui";
import { useSettings } from "../state/settings";

interface Live {
  id: string | null;
  kind: "move" | "rotate" | null;
  anchor: LngLat;
  rotation: number;
  scale: number;
}
export const useLive = create<Live>(() => ({ id: null, kind: null, anchor: [0, 0], rotation: 0, scale: 1 }));

let darkMapRef = false;
export const setDarkMapForDrag = (v: boolean) => {
  darkMapRef = v;
};

let frame = 0;
function render(s: Shape) {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const live = useLive.getState();
    if (!live.id) return;
    setDragShape(s, place(localOf(s), live.anchor, live.rotation, live.scale), darkMapRef);
  });
}

function begin(s: Shape, kind: "move" | "rotate") {
  const m = getMap()!;
  m.dragPan.disable();
  m.touchZoomRotate.disableRotation();
  useLive.setState({ id: s.id, kind, anchor: s.anchor, rotation: s.rotation, scale: s.scale });
  const { shapes, selectedId } = useShapes.getState();
  syncShapes(shapes, selectedId, darkMapRef, s.id);
  render(s);
  document.body.classList.add("is-dragging");
}

function end(s: Shape, moved: boolean) {
  const m = getMap();
  m?.dragPan.enable();
  const live = useLive.getState();
  cancelAnimationFrame(frame);
  if (moved) useShapes.getState().update(s.id, { anchor: live.anchor, rotation: live.rotation });
  useLive.setState({ id: null, kind: null });
  setDragShape(null, null, darkMapRef);
  const { shapes, selectedId } = useShapes.getState();
  syncShapes(shapes, selectedId, darkMapRef);
  document.body.classList.remove("is-dragging");
  if (moved && live.kind === "move" && !useSettings.getState().seenDragHint) useSettings.getState().set("seenDragHint", true);
  if (moved && live.kind === "move") {
    const p = live.anchor;
    announce(`${s.name} moved to ${p[1].toFixed(2)}°, ${p[0].toFixed(2)}°`);
  }
}

const wrapLng = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

/** Start moving a shape from a pointer position (client coordinates). */
export function startMove(shapeId: string, clientX: number, clientY: number, onClick?: () => void) {
  const m = getMap();
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!m || !s) return;
  const rect = m.getContainer().getBoundingClientRect();
  const anchorPx = m.project(s.anchor);
  const offX = anchorPx.x - (clientX - rect.left);
  const offY = anchorPx.y - (clientY - rect.top);
  let started = false;
  const move = (e: PointerEvent) => {
    if (!started) {
      if (Math.hypot(e.clientX - clientX, e.clientY - clientY) < 4) return;
      started = true;
      begin(s, "move");
    }
    const ll = m.unproject([e.clientX - rect.left + offX, e.clientY - rect.top + offY]);
    useLive.setState({ anchor: [wrapLng(ll.lng), Math.max(-84, Math.min(84, ll.lat))] });
    render(s);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    if (started) end(s, true);
    else onClick?.();
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/** Start rotating a shape around its pin. Shift snaps to 15°. */
export function startRotate(shapeId: string, clientX: number, clientY: number) {
  const m = getMap();
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!m || !s) return;
  const rect = m.getContainer().getBoundingClientRect();
  const c = m.project(pinPoint(s));
  const angle = (x: number, y: number) => (Math.atan2(x - rect.left - c.x, -(y - rect.top - c.y)) * 180) / Math.PI;
  const a0 = angle(clientX, clientY);
  begin(s, "rotate");
  const move = (e: PointerEvent) => {
    let r = s.rotation + angle(e.clientX, e.clientY) - a0;
    if (e.shiftKey) r = Math.round(r / 15) * 15;
    useLive.setState({ rotation: ((r % 360) + 360) % 360 });
    render(s);
  };
  const up = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    end(s, true);
    announce(`${s.name} rotated to ${Math.round(useShapes.getState().shapes.find((x) => x.id === s.id)?.rotation ?? 0)}°`);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
}

/** Move the selected shape by a screen offset (keyboard and arrow pad). */
export function nudge(shapeId: string, dx: number, dy: number) {
  const m = getMap();
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!m || !s) return;
  const p = m.project(s.anchor);
  const ll = m.unproject([p.x + dx, p.y + dy]);
  useShapes.getState().update(s.id, { anchor: [wrapLng(ll.lng), Math.max(-84, Math.min(84, ll.lat))] });
}

export function rotateBy(shapeId: string, deg: number) {
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!s) return;
  useShapes.getState().update(s.id, { rotation: (((s.rotation + deg) % 360) + 360) % 360 });
}
