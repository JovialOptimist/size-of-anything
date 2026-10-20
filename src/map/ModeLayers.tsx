/** Map-level UI for modes: the lasso drawing surface and the center crosshair. */
import { useRef, useState } from "react";
import { useUI } from "../state/ui";
import { useDrawing } from "../state/drawing";
import { getMap } from "./mapCore";
import { simplifyLine, geometryArea, closeRing, type LngLat } from "../geo/geometry";
import { formatArea } from "../geo/format";
import { Literal } from "../ui/Literal";
import { useSettings } from "../state/settings";
import { finishDrawing } from "../ui/drawing";
import { toast } from "../state/toasts";
import { useIsDesktop } from "../ui/hooks";

export default function ModeLayers() {
  const mode = useUI((s) => s.mode);
  const desktop = useIsDesktop();
  if (mode === "draw-lasso") return <Lasso />;
  // Picking on desktop is a plain click; the crosshair is for phones.
  if ((mode === "pick" && !desktop) || mode === "draw-points") return <Crosshair />;
  return null;
}

function Crosshair() {
  const m = getMap();
  if (!m) return null;
  const c = m.project(m.getCenter());
  return (
    <svg className="crosshair" style={{ left: c.x, top: c.y }} viewBox="-28 -28 56 56" aria-hidden="true">
      <circle r="13" className="halo" /><path d="M0 -26 V-10 M0 10 V26 M-26 0 H-10 M10 0 H26" className="halo" />
      <circle r="13" /><path d="M0 -26 V-10 M0 10 V26 M-26 0 H-10 M10 0 H26" />
      <circle r="3" className="dot" />
    </svg>
  );
}

function Lasso() {
  const stroke = useDrawing((s) => s.stroke);
  const units = useSettings((s) => s.units);
  const pointers = useRef(new Set<number>());
  const [passThrough, setPassThrough] = useState(false);
  const [area, setArea] = useState(0);
  const drawing = useRef(false);

  const toLngLat = (pts: [number, number][]): LngLat[] => {
    const m = getMap()!;
    return pts.map(([x, y]) => {
      const ll = m.unproject([x, y]);
      return [ll.lng, ll.lat];
    });
  };

  const rectOf = (e: React.PointerEvent) => (e.currentTarget as HTMLElement).getBoundingClientRect();

  return (
    <div
      className="lasso-layer"
      style={{ pointerEvents: passThrough ? "none" : "auto" }}
      onPointerDown={(e) => {
        pointers.current.add(e.pointerId);
        if (pointers.current.size > 1) {
          // A second finger means "move the map": drop the stroke and let the map handle the gesture.
          drawing.current = false;
          useDrawing.getState().set({ stroke: [] });
          setPassThrough(true);
          return;
        }
        if (e.button !== 0) return;
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* capture is best-effort */
        }
        const r = rectOf(e);
        drawing.current = true;
        useDrawing.getState().set({ stroke: [[e.clientX - r.left, e.clientY - r.top]] });
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        const r = rectOf(e);
        const pts = useDrawing.getState().stroke;
        const last = pts[pts.length - 1];
        const p: [number, number] = [e.clientX - r.left, e.clientY - r.top];
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 3) return;
        const next = [...pts, p];
        useDrawing.getState().set({ stroke: next });
        if (next.length % 8 === 0 && next.length >= 3) setArea(geometryArea({ type: "Polygon", coordinates: [closeRing(toLngLat(next))] }));
      }}
      onPointerUp={(e) => {
        pointers.current.delete(e.pointerId);
        if (pointers.current.size === 0) setPassThrough(false);
        if (!drawing.current) return;
        drawing.current = false;
        const pts = simplifyLine(useDrawing.getState().stroke, 1.5);
        useDrawing.getState().set({ stroke: [] });
        setArea(0);
        if (pts.length < 4) return toast({ text: "Draw a loop around something to make a shape." });
        if (!finishDrawing(toLngLat(pts))) toast({ text: "That shape is too small. Try a bigger loop.", tone: "error" });
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        drawing.current = false;
        useDrawing.getState().set({ stroke: [] });
        if (pointers.current.size === 0) setPassThrough(false);
      }}
      onWheel={(e) => {
        const m = getMap();
        if (m) m.zoomTo(m.getZoom() - Math.sign(e.deltaY) * 0.5, { duration: 150 });
      }}
    >
      <svg width="100%" height="100%" aria-hidden="true">
        {stroke.length > 1 && <path d={"M" + stroke.map((p) => p.join(",")).join("L") + "Z"} />}
      </svg>
      {area > 0 && stroke.length > 1 && (
        <div className="drag-hint" style={{ left: stroke[stroke.length - 1][0], top: stroke[stroke.length - 1][1] + 24, animation: "none" }}>
          <Literal>{formatArea(area, units)}</Literal>
        </div>
      )}
    </div>
  );
}
