/**
 * Everything drawn over the map in screen space: a pin with a name tag for every
 * shape (the move handle), the rotate handle, the optional floating toolbar, and
 * portals for off-screen shapes. Positions update every frame the map moves.
 */
import { useEffect, useReducer, type WheelEvent as ReactWheelEvent } from "react";
import { RotateCw, RotateCcw, Copy, Trash2, PanelLeftOpen } from "lucide-react";
import { getMap, getPad } from "./mapCore";
import { startMove, startRotate, useLive, rotateBy } from "./interaction";
import { pinAt, pinPoint, shapeBBox } from "./pins";
import { shapeColor } from "./palette";
import { useShapes, type Shape } from "../state/shapes";
import { useIsDark, useSettings } from "../state/settings";
import { useUI } from "../state/ui";
import { ShapeIcon } from "../ui/icons";
import { duplicateShape, deleteShape } from "../ui/actions";
import type { LngLat } from "../geo/geometry";

/** Re-render once per animation frame while the map moves. */
function useMapTick() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let pending = false;
    let attached: ReturnType<typeof getMap> = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const on = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        bump();
      });
    };
    const attach = () => {
      attached = getMap();
      if (!attached) {
        retry = setTimeout(attach, 200);
        return;
      }
      attached.on("move", on);
      attached.on("resize", on);
      attached.on("styledata", on);
      bump();
    };
    attach();
    return () => {
      clearTimeout(retry);
      attached?.off("move", on);
      attached?.off("resize", on);
      attached?.off("styledata", on);
    };
  }, []);
}

/** Send wheel events that land on overlay elements to the map, so scrolling over a pin still zooms. */
function forwardWheel(e: ReactWheelEvent) {
  const canvas = getMap()?.getCanvas();
  if (!canvas) return;
  const n = e.nativeEvent;
  canvas.dispatchEvent(new WheelEvent("wheel", { deltaX: n.deltaX, deltaY: n.deltaY, deltaMode: n.deltaMode, clientX: n.clientX, clientY: n.clientY, ctrlKey: n.ctrlKey, shiftKey: n.shiftKey, bubbles: true, cancelable: true }));
}

const RAD = Math.PI / 180;
/** Great-circle angle between two points, in degrees. */
function angleBetween(a: LngLat, b: LngLat) {
  const c = Math.sin(a[1] * RAD) * Math.sin(b[1] * RAD) + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((a[0] - b[0]) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) / RAD;
}

export default function Overlays() {
  useMapTick();
  const shapes = useShapes((s) => s.shapes);
  const selectedId = useShapes((s) => s.selectedId);
  const live = useLive();
  const mode = useUI((s) => s.mode);
  const basemap = useSettings((s) => s.basemap);
  const shapeTools = useSettings((s) => s.shapeTools);
  const labels = useSettings((s) => s.labels);
  const seenDragHint = useSettings((s) => s.seenDragHint);
  const isDark = useIsDark();
  const darkMap = basemap === "satellite" || isDark;
  const m = getMap();
  if (!m || !m.getStyle?.()) return null;

  const canvas = m.getCanvas();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const pad = getPad();
  // Keep portals clear of the panel, the top buttons and the right-hand controls.
  const view = { left: pad.left + 8, top: pad.top + 64, right: W - pad.right - 72, bottom: H - pad.bottom - 8 };
  const globe = m.getProjection?.()?.type === "globe";
  const center = m.getCenter();

  const items = shapes
    .filter((s) => s.visible)
    .map((s) => {
      const isLive = live.id === s.id;
      const pin = isLive ? pinAt(s, live.anchor, live.rotation, live.scale) : pinPoint(s);
      // On the globe, skip shapes on the far side of the Earth.
      const hidden = globe && angleBetween(pin, [center.lng, center.lat]) > 82;
      const p = m.project(pin);
      const [x0, y0, x1, y1] = shapeBBox(s);
      const a = m.project([x0, y1]), b = m.project([x1, y0]);
      const size = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      const pinNow = isLive ? p : m.project(pinPoint(s));
      return { s, p, size, hidden, top: Math.min(a.y, b.y) + (p.y - pinNow.y) };
    })
    .filter((i) => !i.hidden);

  const inView = (p: { x: number; y: number }) => p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom;

  // Name tags: the selected shape first, then the rest; in "auto" mode skip tags that would overlap.
  const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
  const order = [...items].sort((a, b) => Number(b.s.id === selectedId) - Number(a.s.id === selectedId));
  const showTag = new Set<string>();
  for (const it of order) {
    if (labels === "off" || !inView(it.p)) continue;
    const w = Math.min(160, it.s.name.length * 7 + 16);
    const r = { x0: it.p.x - w / 2, y0: it.p.y + 18, x1: it.p.x + w / 2, y1: it.p.y + 40 };
    if (labels === "auto" && placed.some((q) => r.x0 < q.x1 && r.x1 > q.x0 && r.y0 < q.y1 && r.y1 > q.y0)) continue;
    placed.push(r);
    showTag.add(it.s.id);
  }

  const sel = items.find((i) => i.s.id === selectedId && inView(i.p));

  return (
    <div className="overlays" onWheel={forwardWheel} aria-hidden={mode !== "browse" ? true : undefined}>
      {items.map(({ s, p }) => {
        const selected = s.id === selectedId;
        const color = shapeColor(s.slot, darkMap);
        if (!inView(p)) {
          if (mode !== "browse") return null;
          return <Portal key={s.id} s={s} p={p} view={view} color={color} />;
        }
        return (
          <div key={s.id} className={`pin-wrap${selected ? " is-selected" : ""}`} style={{ transform: `translate(${p.x}px, ${p.y}px)`, ["--c" as string]: color }}>
            <button
              type="button"
              className="pin"
              aria-label={selected ? `Move ${s.name}. Drag, or use the arrow keys.` : `Select ${s.name}`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                startMove(s.id, e.clientX, e.clientY, () => {
                  useShapes.getState().select(s.id);
                  useUI.getState().go({ name: "detail", id: s.id });
                });
              }}
            >
              <ShapeIcon icon={s.icon} size={selected ? 18 : 14} strokeWidth={2.4} />
            </button>
            {showTag.has(s.id) && <span className="pin-tag">{s.name}</span>}
          </div>
        );
      })}
      {sel && mode === "browse" && (() => {
        const big = sel.size > Math.min(W, H) * 0.7;
        const hy = big ? sel.p.y - 70 : Math.max(view.top + 20, sel.top - 30);
        const handleY = Math.min(hy, sel.p.y - 50);
        return (
          <>
            <svg className="rot-tether" style={{ left: 0, top: 0, width: W, height: H }} aria-hidden="true">
              <line x1={sel.p.x} y1={sel.p.y - 22} x2={sel.p.x} y2={handleY + 14} />
            </svg>
            <button
              type="button"
              className="rot-handle"
              style={{ transform: `translate(${sel.p.x}px, ${handleY}px)` }}
              aria-label={`Rotate ${sel.s.name}. Drag around the pin; hold Shift to snap.`}
              onPointerDown={(e) => {
                e.preventDefault();
                startRotate(sel.s.id, e.clientX, e.clientY);
              }}
            >
              <RotateCw size={14} />
            </button>
            {shapeTools === "toolbar" && live.id === null && <Toolbar s={sel.s} x={sel.p.x} y={handleY - 22} />}
            {!seenDragHint && live.id === null && (
              <div className="drag-hint" style={{ left: sel.p.x, top: sel.p.y + 46 }}>
                Drag the pin to move it anywhere. It stays true to size!
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}

function Toolbar({ s, x, y }: { s: Shape; x: number; y: number }) {
  return (
    <div className="float-toolbar" style={{ left: x, top: y }} role="toolbar" aria-label={`${s.name} actions`}>
      <span className="float-toolbar__name">{s.name}</span>
      <button type="button" aria-label="Rotate left 15°" onClick={() => rotateBy(s.id, -15)}><RotateCcw size={15} /></button>
      <button type="button" aria-label="Rotate right 15°" onClick={() => rotateBy(s.id, 15)}><RotateCw size={15} /></button>
      <button type="button" aria-label="Duplicate" onClick={() => duplicateShape(s.id)}><Copy size={15} /></button>
      <button type="button" aria-label="Delete" className="danger" onClick={() => deleteShape(s.id)}><Trash2 size={15} /></button>
      <button type="button" aria-label="Details" onClick={() => useUI.getState().go({ name: "detail", id: s.id })}><PanelLeftOpen size={15} /></button>
    </div>
  );
}

function Portal({ s, p, view, color }: { s: Shape; p: { x: number; y: number }; view: { left: number; top: number; right: number; bottom: number }; color: string }) {
  const cx = (view.left + view.right) / 2, cy = (view.top + view.bottom) / 2;
  const dx = p.x - cx, dy = p.y - cy;
  const t = Math.min(Math.abs((view.right - cx - 20) / (dx || 1e-9)), Math.abs((view.bottom - cy - 20) / (dy || 1e-9)));
  const x = cx + dx * t, y = cy + dy * t;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <button
      type="button"
      className="portal"
      style={{ transform: `translate(${x}px, ${y}px)`, ["--c" as string]: color }}
      title={`${s.name}: off screen. Click to go there.`}
      aria-label={`Go to ${s.name}`}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        getMap()?.flyTo({ center: pinPoint(s), animate: !reduce });
        useShapes.getState().select(s.id);
        useUI.getState().go({ name: "detail", id: s.id });
      }}
    >
      <span className="portal__arrow" style={{ transform: `rotate(${angle}deg)` }} />
      <ShapeIcon icon={s.icon} size={15} strokeWidth={2.4} />
    </button>
  );
}
