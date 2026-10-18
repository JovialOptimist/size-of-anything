/**
 * The one container for task UI: a floating panel on desktop, a bottom sheet
 * with three heights on phones, and a full-screen search view on phones.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftOpen } from "lucide-react";
import { useUI, currentRoute, type Route } from "../state/ui";
import { useIsDesktop } from "./hooks";
import { useMediaQuery } from "../state/settings";
import { getMap } from "../map/mapCore";
import { useShapes } from "../state/shapes";
import HomeView from "./views/HomeView";
import SearchView from "./views/SearchView";
import DetailView from "./views/DetailView";
import CreateView from "./views/CreateView";
import ObjectsView from "./views/ObjectsView";
import { SettingsView, HelpView, AboutView } from "./views/InfoViews";
import PickView from "./views/PickView";
import DrawView from "./views/DrawView";

function RouteView({ route }: { route: Route }) {
  switch (route.name) {
    case "home": return <HomeView />;
    case "search": return <SearchView />;
    case "detail": return <DetailView id={route.id} />;
    case "create": return <CreateView />;
    case "objects": return <ObjectsView />;
    case "settings": return <SettingsView />;
    case "help": return <HelpView />;
    case "about": return <AboutView />;
    case "pick": return <PickView />;
    case "draw": return <DrawView />;
  }
}

const SNAP_FOR: Record<Route["name"], "peek" | "half" | "full"> = {
  home: "peek", search: "full", detail: "half", create: "half", objects: "full", settings: "full", help: "full", about: "full", pick: "half", draw: "peek",
};

export default function Shell() {
  const desktop = useIsDesktop();
  const route = useUI((s) => currentRoute(s));
  const collapsed = useUI((s) => s.panelCollapsed);
  return desktop ? (
    <>
      <aside className={`panel${collapsed ? " is-collapsed" : ""}`} aria-label="Size of Anything panel">
        <RouteView route={route} />
      </aside>
      <button type="button" className="pill panel-toggle" onClick={() => useUI.getState().set({ panelCollapsed: false })}>
        <PanelLeftOpen size={18} /> Show panel
      </button>
      <PaddingSync desktop collapsed={collapsed} sheetHeight={0} />
    </>
  ) : route.name === "search" ? (
    <div className="fullsearch" role="dialog" aria-label="Search">
      <SearchView />
    </div>
  ) : (
    <Sheet routeName={route.name}>
      <RouteView route={route} />
    </Sheet>
  );
}

function Sheet({ routeName, children }: { routeName: Route["name"]; children: ReactNode }) {
  const snap = useUI((s) => s.sheetSnap);
  const [vh, setVh] = useState(() => window.innerHeight);
  const [drag, setDrag] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const on = () => setVh(window.visualViewport?.height ?? window.innerHeight);
    window.addEventListener("resize", on);
    window.visualViewport?.addEventListener("resize", on);
    return () => {
      window.removeEventListener("resize", on);
      window.visualViewport?.removeEventListener("resize", on);
    };
  }, []);

  useEffect(() => {
    useUI.getState().set({ sheetSnap: SNAP_FOR[routeName] });
  }, [routeName]);

  const hasShapes = useShapes((st) => st.shapes.length > 0);
  const peek = routeName === "home" && hasShapes ? 250 : 196;
  const heights = { peek, half: Math.round(vh * 0.5), full: vh - 64 };
  const h = drag ?? heights[snap];

  const onPointerDown = (e: React.PointerEvent) => {
    const startY = e.clientY;
    const startH = h;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    let moved = false;
    const move = (ev: PointerEvent) => {
      moved = moved || Math.abs(ev.clientY - startY) > 4;
      setDrag(Math.max(110, Math.min(heights.full, startH - (ev.clientY - startY))));
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const final = startH - (ev.clientY - startY);
      setDrag(null);
      if (!moved) {
        const order: ("peek" | "half" | "full")[] = ["peek", "half", "full"];
        useUI.getState().set({ sheetSnap: order[(order.indexOf(snap) + 1) % 3] });
        return;
      }
      const nearest = (Object.entries(heights) as [keyof typeof heights, number][]).sort((a, b) => Math.abs(a[1] - final) - Math.abs(b[1] - final))[0][0];
      useUI.getState().set({ sheetSnap: nearest });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <>
      <section ref={ref} className={`sheet${drag !== null ? " is-dragging" : ""}`} style={{ height: h }} aria-label="Size of Anything panel">
        <button type="button" className="sheet__grab" onPointerDown={onPointerDown} aria-label={`Resize panel (now ${snap === "peek" ? "small" : snap === "half" ? "half height" : "full height"})`} />
        {children}
      </section>
      <PaddingSync desktop={false} collapsed={false} sheetHeight={Math.min(h, heights.half)} />
    </>
  );
}

/** Keep the map's padding (and therefore its "visible center") in sync with the panel or sheet. */
function PaddingSync({ desktop, collapsed, sheetHeight }: { desktop: boolean; collapsed: boolean; sheetHeight: number }) {
  const narrow = useMediaQuery("(max-width: 1000px)");
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--sheet-h", `${desktop ? 0 : sheetHeight}px`);
    const apply = () => {
      const m = getMap();
      if (!m) return setTimeout(apply, 150);
      m.setPadding(desktop ? { left: collapsed ? 0 : narrow ? 348 : 420, top: 0, right: 0, bottom: 0 } : { left: 0, top: 60, right: 0, bottom: sheetHeight });
    };
    apply();
  }, [desktop, collapsed, sheetHeight, narrow]);
  return null;
}
