/**
 * Moving and rotating shapes. During a gesture the shape is hidden from the
 * WebGL layer and drawn by the HTML/SVG overlay instead, in the same frame as its
 * pin, so the two never drift apart. The change is committed to the store (one
 * undo step) on release, and the overlay hands back to WebGL once that has drawn.
 */
import { create } from "zustand";
import { flushSync } from "react-dom";
import { getMap, hideShape, syncShapes } from "./mapCore";
import { localOf, useShapes, type Shape } from "../state/shapes";
import type { LngLat, LocalShape } from "../geo/geometry";
import { pinAt, pinPoint } from "./pins";
import { announce } from "../state/ui";
import { useSettings } from "../state/settings";

interface Live {
  id: string | null;
  kind: "move" | "rotate" | "settling" | null;
  anchor: LngLat;
  rotation: number;
  scale: number;
}
export const useLive = create<Live>(() => ({ id: null, kind: null, anchor: [0, 0], rotation: 0, scale: 1 }));

let darkMapRef = false;
export const setDarkMapForDrag = (v: boolean) => {
  darkMapRef = v;
};

/** A lighter copy of the dragged shape's outline (at most ~4,000 points) for drawing every frame. */
let dragLocal: LocalShape | null = null;
export const getDragLocal = () => dragLocal;

function decimate(local: LocalShape, max = 4000): LocalShape {
  const total = local.reduce((n, p) => n + p.reduce((m, r) => m + r.length / 3, 0), 0);
  const step = Math.max(1, Math.ceil(total / max));
  if (step === 1) return local;
  return local.map((poly) =>
    poly.map((ring) => {
      const n = ring.length / 3;
      const out: number[] = [];
      for (let i = 0; i < n; i += step) out.push(ring[i * 3], ring[i * 3 + 1], ring[i * 3 + 2]);
      out.push(ring[0], ring[1], ring[2]);
      return Float64Array.from(out);
    }).filter((r) => r.length >= 12)
  ).filter((p) => p.length > 0);
}

/** Update the live gesture and re-render the overlay synchronously, in this frame. */
function setLive(patch: Partial<Live>) {
  flushSync(() => useLive.setState(patch));
}

function begin(s: Shape, kind: "move" | "rotate") {
  const m = getMap()!;
  m.dragPan.disable();
  m.touchZoomRotate.disableRotation();
  dragLocal = decimate(localOf(s));
  setLive({ id: s.id, kind, anchor: s.anchor, rotation: s.rotation, scale: s.scale });
  hideShape(s.id);
  document.body.classList.add("is-dragging");
}

function end(s: Shape, moved: boolean) {
  const m = getMap();
  m?.dragPan.enable();
  const live = useLive.getState();
  if (moved) useShapes.getState().update(s.id, { anchor: live.anchor, rotation: live.rotation });
  // Keep drawing the overlay copy, and keep the WebGL one hidden, until the WebGL layer has the
  // new position; then swap them in one frame.
  useLive.setState({ kind: "settling" });
  const { shapes, selectedId } = useShapes.getState();
  syncShapes(shapes, selectedId, darkMapRef);
  const done = () => {
    if (useLive.getState().kind !== "settling") return;
    hideShape(null);
    // Drop the overlay while the map draws the frame that brings the shape back.
    const hand = () => {
      if (useLive.getState().kind !== "settling") return;
      setLive({ id: null, kind: null });
      dragLocal = null;
    };
    if (m) m.once("render", hand);
    else hand();
  };
  m?.once("idle", done);
  setTimeout(done, 400);
  document.body.classList.remove("is-dragging");
  if (moved && live.kind === "move" && !useSettings.getState().seenDragHint) useSettings.getState().set("seenDragHint", true);
  if (moved && live.kind === "move") {
    const p = live.anchor;
    announce(`${s.name} moved to ${p[1].toFixed(2)}°, ${p[0].toFixed(2)}°`);
  }
}

/**
 * The anchor that keeps a shape's pin where it is after a rotation or rescale,
 * so shapes turn around their visual center (not a center of mass that can be
 * out at sea, as with France and its overseas territories).
 */
export function anchorKeepingPin(s: Shape, rotation: number, scale = s.scale): LngLat {
  const target = pinAt(s, s.anchor, s.rotation, s.scale);
  let anchor: LngLat = s.anchor;
  for (let i = 0; i < 4; i++) {
    const p = pinAt(s, anchor, rotation, scale);
    anchor = [anchor[0] + target[0] - p[0], anchor[1] + target[1] - p[1]];
  }
  return anchor;
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
    setLive({ anchor: [wrapLng(ll.lng), Math.max(-84, Math.min(84, ll.lat))] });
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
    const rotation = ((r % 360) + 360) % 360;
    setLive({ rotation, anchor: anchorKeepingPin(s, rotation) });
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
  if (s) setRotation(shapeId, s.rotation + deg);
}

/** Set an absolute rotation, turning around the pin. */
export function setRotation(shapeId: string, deg: number) {
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!s) return;
  const rotation = ((deg % 360) + 360) % 360;
  useShapes.getState().update(s.id, { rotation, anchor: anchorKeepingPin(s, rotation) });
}

/**
 * Flip on screen, around the pin. Mirroring the outline in its own frame and
 * negating the rotation is a left-right flip as you see it; adding 180° makes
 * it top-bottom.
 */
export function flip(shapeId: string, axis: "horizontal" | "vertical") {
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!s) return;
  const r = axis === "horizontal" ? -s.rotation : 180 - s.rotation;
  const next: Shape = { ...s, mirrored: !s.mirrored, rotation: ((r % 360) + 360) % 360 };
  const target = pinPoint(s);
  let anchor = s.anchor;
  for (let i = 0; i < 4; i++) {
    const p = pinAt(next, anchor, next.rotation, next.scale);
    anchor = [anchor[0] + target[0] - p[0], anchor[1] + target[1] - p[1]];
  }
  useShapes.getState().update(s.id, { mirrored: next.mirrored, rotation: next.rotation, anchor });
  announce(`${s.name} flipped ${axis}ly`);
}

/** Rescale around the pin. */
export function setScale(shapeId: string, scale: number) {
  const s = useShapes.getState().shapes.find((x) => x.id === shapeId);
  if (!s) return;
  useShapes.getState().update(s.id, { scale, anchor: anchorKeepingPin(s, s.rotation, scale) });
}
