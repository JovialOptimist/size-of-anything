/**
 * Everything drawn over the map in screen space: pins (move handles), the
 * rotate handle, the optional floating toolbar, and portals for off-screen shapes.
 */
import { useEffect, useReducer } from "react";
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

function useMapTick() {
  const [, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    let raf = 0;
    const m = getMap();
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(bump);
    };
    const attach = () => {
      const mm = getMap();
      if (!mm) return setTimeout(attach, 200);
      mm.on("move", on);
      mm.on("resize", on);
      mm.on("idle", on);
      bump();
    };
    attach();
    return () => {
      cancelAnimationFrame(raf);
      (m || getMap())?.off("move", on);
      (m || getMap())?.off("resize", on);
      (m || getMap())?.off("idle", on);
    };
  }, []);
}

export default function Overlays() {
  useMapTick();
  const shapes = useShapes((s) => s.shapes);
  const selectedId = useShapes((s) => s.selectedId);
  const live = useLive();
  const mode = useUI((s) => s.mode);
  const basemap = useSettings((s) => s.basemap);
  const shapeTools = useSettings((s) => s.shapeTools);
  const seenDragHint = useSettings((s) => s.seenDragHint);
  const isDark = useIsDark();
  const darkMap = basemap === "satellite" || isDark;
  const m = getMap();
  if (!m || !m.isStyleLoaded?.()) return null;

  const canvas = m.getCanvas();
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const pad = getPad();
  const view = { left: pad.left + 8, top: pad.top + 8, right: W - pad.right - 8, bottom: H - pad.bottom - 8 };

  const items = shapes
    .filter((s) => s.visible)
    .map((s) => {
      const isLive = live.id === s.id;
      const pin = isLive ? pinAt(s, live.anchor, live.rotation, live.scale) : pinPoint(s);
      const p = m.project(pin);
      const [x0, y0, x1, y1] = shapeBBox(s);
      const a = m.project([x0, y1]), b = m.project([x1, y0]);
      const size = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      return { s, p, size, top: Math.min(a.y, b.y) + (isLive ? p.y - m.project(pinPoint(s)).y : 0) };
    });

  const inView = (p: { x: number; y: number }) => p.x >= view.left && p.x <= view.right && p.y >= view.top && p.y <= view.bottom;

  return (
    <div className="overlays" aria-hidden={mode !== "browse" ? true : undefined}>
      {items.map(({ s, p, size }) => {
        const selected = s.id === selectedId;
        const color = shapeColor(s.slot, darkMap);
        if (!inView(p)) {
          if (mode !== "browse") return null;
          return <Portal key={s.id} s={s} p={p} view={view} color={color} />;
        }
        if (!selected && size >= 24) return null;
        return (
          <button
            key={s.id}
            type="button"
            className={`pin${selected ? " pin--selected" : ""}`}
            style={{ left: p.x, top: p.y, ["--c" as string]: color }}
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
        );
      })}
      {(() => {
        const it = items.find((i) => i.s.id === selectedId && inView(i.p));
        if (!it || mode !== "browse") return null;
        const big = it.size > Math.min(W, H) * 0.7;
        const hy = big ? it.p.y - 64 : Math.max(view.top + 20, it.top - 30);
        const handleY = Math.min(hy, it.p.y - 44);
        return (
          <>
            <svg className="rot-tether" style={{ left: 0, top: 0, width: W, height: H }} aria-hidden="true">
              <line x1={it.p.x} y1={it.p.y - 18} x2={it.p.x} y2={handleY + 12} />
            </svg>
            <button
              type="button"
              className="rot-handle"
              style={{ left: it.p.x, top: handleY }}
              aria-label={`Rotate ${it.s.name}. Drag around the pin; hold Shift to snap.`}
              onPointerDown={(e) => {
                e.preventDefault();
                startRotate(it.s.id, e.clientX, e.clientY);
              }}
            >
              <RotateCw size={14} />
            </button>
            {shapeTools === "toolbar" && live.id === null && <Toolbar s={it.s} x={it.p.x} y={handleY - 22} />}
            {!seenDragHint && live.id === null && (
              <div className="drag-hint" style={{ left: it.p.x, top: it.p.y + 26 }}>
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
      style={{ left: x, top: y, ["--c" as string]: color }}
      title={`${s.name}: off screen. Click to go there.`}
      aria-label={`Go to ${s.name}`}
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        getMap()?.flyTo({ center: pinPoint(s), animate: !reduce });
      }}
    >
      <span className="portal__arrow" style={{ transform: `rotate(${angle}deg)` }} />
      <ShapeIcon icon={s.icon} size={15} strokeWidth={2.4} />
    </button>
  );
}
