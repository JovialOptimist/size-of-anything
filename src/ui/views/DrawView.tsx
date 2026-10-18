import { useEffect, useMemo } from "react";
import { Undo2, Check, X, Plus } from "lucide-react";
import { useDraft } from "../../state/draft";
import { useDrawing } from "../../state/drawing";
import { useUI } from "../../state/ui";
import { useSettings } from "../../state/settings";
import { toast } from "../../state/toasts";
import { getMap, setDrawData, visibleCenter } from "../../map/mapCore";
import { mapClickHandler } from "../../map/modeHandlers";
import { closeRing, geometryArea } from "../../geo/geometry";
import { formatArea, familiarComparisons } from "../../geo/format";
import { ViewHeader } from "./common";
import { finishDrawing } from "../drawing";

export default function DrawView() {
  const mode = useDraft((s) => s.drawMode);
  const points = useDrawing((s) => s.points);
  const units = useSettings((s) => s.units);

  useEffect(() => {
    useUI.getState().setMode(mode === "lasso" ? "draw-lasso" : "draw-points");
    useDrawing.getState().set({ points: [], stroke: [] });
    mapClickHandler.current = (ll) => {
      if (useUI.getState().mode !== "draw-points") return false;
      const pts = useDrawing.getState().points;
      // Clicking near the first corner closes the shape.
      const m = getMap();
      if (m && pts.length >= 3) {
        const a = m.project(pts[0]), b = m.project(ll);
        if (Math.hypot(a.x - b.x, a.y - b.y) < 24) {
          if (finishDrawing(pts)) return true;
        }
      }
      useDrawing.getState().set({ points: [...pts, ll] });
      return true;
    };
    return () => {
      useUI.getState().setMode("browse");
      mapClickHandler.current = null;
      setDrawData(null);
    };
  }, [mode]);

  useEffect(() => {
    if (!points.length) return setDrawData(null);
    const fc: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: [
        ...(points.length >= 3 ? [{ type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [[...points, points[0]]] }, properties: {} }] : []),
        { type: "Feature", geometry: { type: "LineString", coordinates: points }, properties: {} },
        ...points.map((p) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: p }, properties: {} })),
      ],
    };
    setDrawData(fc);
  }, [points]);

  const area = useMemo(() => (points.length >= 3 ? geometryArea({ type: "Polygon", coordinates: [closeRing(points)] }) : 0), [points]);
  const fam = area ? familiarComparisons(area, 1)[0] : undefined;

  const cancel = () => {
    useDrawing.getState().set({ points: [], stroke: [] });
    useUI.getState().back();
  };

  return (
    <>
      <ViewHeader title={mode === "lasso" ? "Lasso" : "Corners"} onBack={cancel} />
      <div className="panel__scroll stack">
        <div className="seg" role="group" aria-label="Drawing tool">
          <button type="button" aria-pressed={mode === "lasso"} onClick={() => useDraft.getState().set({ drawMode: "lasso" })}>Lasso</button>
          <button type="button" aria-pressed={mode === "points"} onClick={() => useDraft.getState().set({ drawMode: "points" })}>Corners</button>
        </div>
        {mode === "lasso" ? (
          <p style={{ margin: 0 }}>Press and drag on the map to draw around something. Let go to finish. Two fingers or the scroll wheel still move the map.</p>
        ) : (
          <>
            <p style={{ margin: 0 }}>Tap or click each corner. Tap the first corner again (or press Done) to close the shape. Drag the map to pan as usual.</p>
            <div className="card" aria-live="polite">
              <span className="readout">{points.length} corner{points.length === 1 ? "" : "s"}</span>
              {area > 0 && <span className="readout"> · {formatArea(area, units)}{fam ? ` · ${fam.text}` : ""}</span>}
            </div>
            <div className="btnrow">
              <button type="button" className="btn btn--sm" onClick={() => useDrawing.getState().set({ points: [...points, visibleCenter()] })}><Plus size={16} /> Add point at crosshair</button>
              <button type="button" className="btn btn--sm" disabled={!points.length} onClick={() => useDrawing.getState().set({ points: points.slice(0, -1) })}><Undo2 size={16} /> Undo</button>
            </div>
            <div className="btnrow">
              <button type="button" className="btn btn--primary" disabled={points.length < 3} onClick={() => { if (!finishDrawing(points)) toast({ text: "That shape is too small. Try spreading the corners out.", tone: "error" }); }}><Check size={18} /> Done</button>
              <button type="button" className="btn" onClick={cancel}><X size={18} /> Cancel</button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
