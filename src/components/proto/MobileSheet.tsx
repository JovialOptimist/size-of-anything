/**
 * Mobile bottom sheet (UI-overhaul prototype): holds the selected shape's
 * actions and the comparison tray. Drag the handle (or tap it) to move
 * between peek, half, and full heights.
 */
import { useEffect, useRef, useState } from "react";
import { useMapStore } from "../../state/mapStore";
import { useSettings } from "../../state/settingsStore";
import SelectionToolbar from "./SelectionToolbar";
import ComparisonTray from "./ComparisonTray";

type Detent = "peek" | "half" | "full";
const DETENT_LABELS: Record<Detent, string> = { peek: "Peek", half: "Half", full: "Full" };

function detentHeights(hasSelection: boolean): Record<Detent, number> {
  const vh = window.innerHeight;
  return {
    peek: hasSelection ? 176 : 64,
    half: Math.round(vh * 0.45),
    full: Math.round(vh * 0.85),
  };
}

export default function MobileSheet() {
  const geojsonAreas = useMapStore((s) => s.geojsonAreas);
  const activeAreaId = useMapStore((s) => s.activeAreaId);
  const compareTray = useSettings((s) => s.uiPrototype.compareTray);
  const [detent, setDetent] = useState<Detent>("peek");
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const dragStart = useRef<{ y: number; height: number; moved: boolean } | null>(null);

  const hasSelection = geojsonAreas.some((f) => f.properties.id === activeAreaId);
  const visible = hasSelection || (compareTray && geojsonAreas.length > 0);
  const heights = detentHeights(hasSelection);
  const height = dragHeight ?? heights[detent];

  // Let map buttons sit above the sheet while it's peeking
  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      root.classList.add("proto-sheet-on");
      root.style.setProperty("--proto-sheet-peek", `${heights.peek}px`);
    } else {
      root.classList.remove("proto-sheet-on");
    }
    return () => root.classList.remove("proto-sheet-on");
  }, [visible, heights.peek]);

  if (!visible) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragStart.current = { y: e.clientY, height, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = dragStart.current.y - e.clientY;
    if (Math.abs(dy) > 4) dragStart.current.moved = true;
    const next = Math.min(heights.full, Math.max(heights.peek, dragStart.current.height + dy));
    setDragHeight(next);
  };

  const onPointerUp = () => {
    if (!dragStart.current) return;
    const { moved } = dragStart.current;
    dragStart.current = null;
    if (!moved) {
      // Tap cycles peek → half → full → peek
      setDetent((d) => (d === "peek" ? "half" : d === "half" ? "full" : "peek"));
      setDragHeight(null);
      return;
    }
    const current = dragHeight ?? height;
    const nearest = (Object.keys(heights) as Detent[]).reduce((best, d) =>
      Math.abs(heights[d] - current) < Math.abs(heights[best] - current) ? d : best
    );
    setDetent(nearest);
    setDragHeight(null);
  };

  return (
    <div
      className={`proto-sheet ${dragHeight !== null ? "proto-sheet-dragging" : ""}`}
      style={{ height }}
      role="region"
      aria-label="Shape details"
    >
      <button
        type="button"
        className="proto-sheet-handle"
        aria-label={`Resize panel, currently ${DETENT_LABELS[detent]}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <span className="proto-sheet-grip" />
      </button>
      <div className="proto-sheet-body">
        {hasSelection && <SelectionToolbar variant="sheet" />}
        {compareTray && <ComparisonTray embedded />}
      </div>
    </div>
  );
}
