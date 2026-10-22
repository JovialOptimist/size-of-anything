import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildStyle, ensureLayers, setMapInstance, syncShapes, type LayerLook } from "./mapCore";
import { setDarkMapForDrag, startMove, useLive } from "./interaction";
import { pinHover } from "./hover";
import { useShapes } from "../state/shapes";
import { FILL_OPACITY, useIsDark, useSettings } from "../state/settings";
import { useUI } from "../state/ui";
import { mapClickHandler } from "./modeHandlers";


export default function MapView({ onReady }: { onReady?: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const isDark = useIsDark();
  const basemap = useSettings((s) => s.basemap);
  const globe = useSettings((s) => s.globe);
  const fill = useSettings((s) => s.fill);
  const shapes = useShapes((s) => s.shapes);
  const selectedId = useShapes((s) => s.selectedId);
  const darkMap = basemap === "satellite" || isDark;
  const lookRef = useRef<LayerLook>({ darkMap, satellite: basemap === "satellite", fillOpacity: FILL_OPACITY[fill] });
  lookRef.current = { darkMap, satellite: basemap === "satellite", fillOpacity: FILL_OPACITY[fill] };
  setDarkMapForDrag(darkMap);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let unwire: (() => void) | undefined;
    (async () => {
      const style = await buildStyle(useSettings.getState().basemap, lookRef.current.darkMap);
      if (cancelled || !el.current) return;
      const m = new maplibregl.Map({
        container: el.current,
        style,
        center: [10, 25],
        zoom: 1.4,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        renderWorldCopies: true,
      });
      m.touchZoomRotate.disableRotation();
      m.keyboard.disableRotation();
      mapRef.current = m;
      setMapInstance(m);
      m.on("style.load", () => {
        m.setProjection({ type: useSettings.getState().globe ? "globe" : "mercator" });
        ensureLayers(m, lookRef.current);
        const st = useShapes.getState();
        syncShapes(st.shapes, st.selectedId, lookRef.current.darkMap);
      });
      // The basemap references a few icons its sprite doesn't have; draw nothing instead of warning.
      m.on("styleimagemissing", (e) => {
        if (!m.hasImage(e.id)) m.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
      });
      unwire = wireEvents(m);
      m.once("load", () => onReady?.());
    })();
    return () => {
      cancelled = true;
      unwire?.();
      mapRef.current?.remove();
      mapRef.current = null;
      setMapInstance(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Swap the basemap when theme or layer changes.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const m = mapRef.current;
    if (!m) return;
    buildStyle(basemap, darkMap).then((style) => m.setStyle(style, { diff: false }));
  }, [basemap, darkMap]);

  // Restyle shape layers when the look changes.
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !m.isStyleLoaded()) return;
    for (const id of ["soa-fill", "soa-casing", "soa-line", "soa-drag-fill", "soa-drag-casing", "soa-drag-line", "soa-labels", "soa-preview-fill", "soa-preview-line", "soa-draw-fill", "soa-draw-line", "soa-draw-pts"]) if (m.getLayer(id)) m.removeLayer(id);
    ensureLayers(m, lookRef.current);
  }, [fill]);

  useEffect(() => {
    const m = mapRef.current;
    if (m && m.isStyleLoaded()) m.setProjection({ type: globe ? "globe" : "mercator" });
  }, [globe]);

  useEffect(() => {
    syncShapes(shapes, selectedId, darkMap);
  }, [shapes, selectedId, darkMap]);

  return <div ref={el} className="map" role="region" aria-label="Map. Arrow keys pan, plus and minus zoom. Shapes are listed in the panel." />;
}

function wireEvents(m: maplibregl.Map) {
  const topShapeAt = (point: maplibregl.PointLike): string | null => {
    const fs = m.queryRenderedFeatures(point, { layers: ["soa-fill"].filter((l) => m.getLayer(l)) });
    return (fs[0]?.properties?.id as string) ?? null;
  };
  const coarse = window.matchMedia("(pointer: coarse)").matches;

  m.on("click", (e) => {
    const ui = useUI.getState();
    if (ui.mode !== "browse") {
      mapClickHandler.current?.([e.lngLat.lng, e.lngLat.lat]);
      return;
    }
    const id = topShapeAt(e.point);
    const shapes = useShapes.getState();
    if (id) {
      shapes.select(id);
      ui.go({ name: "detail", id });
    } else if (shapes.selectedId || ui.stack[ui.stack.length - 1].name === "detail") {
      // Clicking empty map deselects and closes the shape's page, like its X. (Going "back"
      // could land on another shape's page, or the search the shape came from.)
      shapes.select(null);
      if (ui.stack[ui.stack.length - 1].name === "detail") ui.home();
    }
  });

  // Desktop: drag the body of the selected shape.
  m.on("mousedown", (e) => {
    if (coarse || useUI.getState().mode !== "browse") return;
    const id = topShapeAt(e.point);
    if (id && id === useShapes.getState().selectedId) {
      e.preventDefault();
      holding = true;
      refresh();
      startMove(id, e.originalEvent.clientX, e.originalEvent.clientY);
    }
  });

  // Hover (a slightly thicker outline) and the cursor: an arrow on empty map, a pointer over a
  // shape, an open hand over the selected shape (it drags from its body), a closed hand while
  // holding it, and the four-way arrow while panning. Both are worked out again from the last
  // mouse position whenever the mouse, the map, the shapes or a drag changes, so they stay right
  // when something moves under a still mouse.
  let hovered: string | null = null;
  let mouse: maplibregl.Point | null = null;
  let panning = false;
  let holding = false;
  const setHover = (id: string | null) => {
    if (hovered === id) return;
    if (hovered && m.getSource("soa-shapes")) m.setFeatureState({ source: "soa-shapes", id: hovered }, { hover: false });
    hovered = id;
    if (id && m.getSource("soa-shapes")) m.setFeatureState({ source: "soa-shapes", id }, { hover: true });
  };
  const refresh = () => {
    const canvas = m.getCanvas();
    if (useUI.getState().mode !== "browse") {
      canvas.style.cursor = "";
      return setHover(null);
    }
    const under = mouse ? topShapeAt(mouse) : null;
    // While a shape is moved or rotated, the shapes it passes over don't light up.
    const kind = useLive.getState().kind;
    setHover(kind === "move" || kind === "rotate" ? null : pinHover.id ?? under);
    canvas.style.cursor = panning ? "move" : holding ? "grabbing" : under ? (under === useShapes.getState().selectedId ? "grab" : "pointer") : "";
  };
  // Plain DOM events, because MapLibre holds back its own "mousemove" while the map is being panned.
  const container = m.getCanvasContainer();
  const onMouseMove = (e: MouseEvent) => {
    const r = container.getBoundingClientRect();
    mouse = new maplibregl.Point(e.clientX - r.left, e.clientY - r.top);
    pinHover.id = null;
    refresh();
  };
  const onMouseLeave = () => {
    mouse = null;
    refresh();
  };
  container.addEventListener("mousemove", onMouseMove);
  container.addEventListener("mouseleave", onMouseLeave);
  m.on("mouseup", () => {
    holding = false;
    refresh();
  });
  m.on("dragstart", () => {
    panning = true;
    refresh();
  });
  m.on("dragend", () => {
    panning = false;
    refresh();
  });
  m.on("move", refresh);
  // After new shape data has drawn (a drop, an edit), so the query sees it.
  m.on("idle", refresh);
  pinHover.changed = refresh;
  const unsubscribe = [useShapes.subscribe(refresh), useLive.subscribe(refresh), useUI.subscribe(refresh)];

  // Touch: hold a shape for 400 ms to pick it up. A plain one-finger drag still pans.
  let timer: ReturnType<typeof setTimeout> | undefined;
  m.on("touchstart", (e) => {
    clearTimeout(timer);
    if (e.points.length !== 1 || useUI.getState().mode !== "browse") return;
    const id = topShapeAt(e.point);
    if (!id) return;
    const t = e.originalEvent.touches[0];
    const sx = t.clientX, sy = t.clientY;
    timer = setTimeout(() => {
      useShapes.getState().select(id);
      navigator.vibrate?.(15);
      m.dragPan.disable();
      startMove(id, sx, sy);
      // Nudge the gesture past the start threshold so the shape lifts immediately.
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: sx + 5, clientY: sy + 5 }));
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: sx, clientY: sy }));
    }, 400);
  });
  const cancel = () => clearTimeout(timer);
  let start: { x: number; y: number } | null = null;
  m.on("touchstart", (e) => {
    start = e.points.length === 1 ? { x: e.point.x, y: e.point.y } : null;
  });
  m.on("touchmove", (e) => {
    // Allow ~10px of finger jitter before treating it as a pan.
    if (!start || e.points.length !== 1 || Math.hypot(e.point.x - start.x, e.point.y - start.y) > 10) cancel();
  });
  m.on("touchend", cancel);
  m.on("dragstart", cancel);

  return () => {
    container.removeEventListener("mousemove", onMouseMove);
    container.removeEventListener("mouseleave", onMouseLeave);
    unsubscribe.forEach((u) => u());
    pinHover.changed = () => {};
  };
}
