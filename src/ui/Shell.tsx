/**
 * The one container for task UI. On desktop: a panel docked to the left edge
 * (search and the three tools, with a drawer that opens below for everything
 * else), or a floating panel (a setting). On phones: a bottom sheet with three
 * heights and a full-screen search view.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { PanelLeftOpen, Crosshair, PenLine, Shapes, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useUI, currentRoute, type Route } from "../state/ui";
import { useIsDesktop } from "./hooks";
import { useMediaQuery, useSettings } from "../state/settings";
import { useSearch } from "../state/search";
import { MenuButton } from "./views/common";
import { useSwatch } from "./hooks";
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
  const docked = useSettings((s) => s.panelStyle === "docked");
  return desktop && docked ? (
    <>
      <Dock route={route} collapsed={collapsed} />
      <PaddingSync desktop docked collapsed={false} sheetHeight={0} />
    </>
  ) : desktop ? (
    <>
      <aside className={`panel${collapsed ? " is-collapsed" : ""}`} aria-label="Size of Anything panel">
        <RouteView route={route} />
      </aside>
      <button type="button" className="pill panel-toggle" onClick={() => useUI.getState().set({ panelCollapsed: false })}>
        <PanelLeftOpen size={18} /> Show panel
      </button>
      <PaddingSync desktop docked={false} collapsed={collapsed} sheetHeight={0} />
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

const TOOL_FOR: Partial<Record<Route["name"], string>> = { pick: "pick", create: "create", draw: "create", objects: "objects" };

/**
 * Like Google Maps: at rest, a floating card with the search box and the three
 * tools. Opening anything docks it to the left edge, full height, showing just
 * that page (search has its own box); the side tab tucks it away (back to the
 * card) and brings it back.
 */
function Dock({ route, collapsed }: { route: Route; collapsed: boolean }) {
  const swatch = useSwatch();
  const q = useSearch((s) => s.q);
  const head = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [headH, setHeadH] = useState(140);
  const open = route.name !== "home";
  const expanded = open && !collapsed;
  // Scrolling stays off until the panel has finished growing, so no scrollbar flashes up mid-animation.
  const [settled, setSettled] = useState(false);
  const ui = useUI.getState();

  useEffect(() => {
    setSettled(false);
    if (!expanded) return;
    const t = setTimeout(() => setSettled(true), 400); // in case transitionend never comes (reduced motion)
    return () => clearTimeout(t);
  }, [expanded]);

  useLayoutEffect(() => {
    const el = head.current!;
    // Hidden while docked; keep the last height so the card animates back to it.
    const ro = new ResizeObserver(() => el.offsetHeight > 0 && setHeadH(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Opening something new always shows the drawer.
  useEffect(() => {
    useUI.getState().set({ panelCollapsed: false });
  }, [route]);

  // Leaving search clears the box.
  useEffect(() => {
    if (route.name !== "search") useSearch.setState({ q: "" });
  }, [route.name]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      useSearch.setState({ pending: e.key === "Enter" && q.trim() !== "" });
      ui.go({ name: "search" });
      ui.set({ panelCollapsed: false });
    } else if (e.key === "Escape") {
      if (q) useSearch.setState({ q: "" });
      else input.current?.blur();
    }
  };

  const tool = (name: "pick" | "create" | "objects", label: string, icon: ReactNode, slot: number) => {
    const on = TOOL_FOR[route.name] === name;
    return (
      <button type="button" className="tool" aria-pressed={on} style={{ ["--c" as string]: swatch(slot) }} onClick={() => {
        if (on && expanded) return ui.home();
        ui.go({ name });
        ui.set({ panelCollapsed: false });
      }}>
        {icon} {label}
      </button>
    );
  };

  return (
    <div className="dock-wrap">
    <aside
      className={`dock${expanded ? " is-open" : ""}${expanded && settled ? " is-settled" : ""}`}
      onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === "height" && expanded && setSettled(true)}
      style={{ ["--head-h" as string]: `${headH}px` }}
      aria-label="Size of Anything panel"
    >
      <div className="dock__head" ref={head}>
        <div className="omni" role="search">
          <MenuButton />
          <input
            ref={input}
            id="dock-search"
            role="combobox"
            aria-expanded={route.name === "search"}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-label="Search places and things"
            placeholder="Search places & things…"
            value={q}
            onChange={(e) => useSearch.setState({ q: e.target.value })}
            onKeyDown={onKeyDown}
            enterKeyHint="search"
          />
          {route.name === "search" || q ? (
            <button type="button" className="iconbtn" aria-label="Close search" onClick={() => { useSearch.setState({ q: "" }); if (route.name === "search") ui.home(); input.current?.focus(); }}><X size={18} /></button>
          ) : null}
        </div>
        <div className="tools">
          {tool("pick", "Pick on map", <Crosshair size={22} />, 2)}
          {tool("create", "Create", <PenLine size={22} />, 1)}
          {tool("objects", "Objects", <Shapes size={22} />, 4)}
        </div>
      </div>
      <div className="dock__drawer" inert={!expanded}>
        {open && <RouteView route={route} />}
      </div>
    </aside>
    {open && (
      <button type="button" className={`dock-tab${expanded ? "" : " is-out"}`} aria-label={expanded ? "Collapse side panel" : "Expand side panel"} onClick={() => ui.set({ panelCollapsed: expanded })}>
        {expanded ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
      </button>
    )}
    </div>
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
      <PaddingSync desktop={false} docked={false} collapsed={false} sheetHeight={Math.min(h, heights.half)} />
    </>
  );
}

/** Keep the map's padding (and therefore its "visible center") in sync with the panel or sheet. */
function PaddingSync({ desktop, docked, collapsed, sheetHeight }: { desktop: boolean; docked: boolean; collapsed: boolean; sheetHeight: number }) {
  const narrow = useMediaQuery("(max-width: 1000px)");
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--sheet-h", `${desktop ? 0 : sheetHeight}px`);
    const apply = () => {
      const m = getMap();
      if (!m) return setTimeout(apply, 150);
      m.setPadding(desktop ? { left: collapsed ? 0 : docked ? (narrow ? 332 : 392) : narrow ? 348 : 420, top: 0, right: 0, bottom: 0 } : { left: 0, top: 60, right: 0, bottom: sheetHeight });
    };
    apply();
  }, [desktop, docked, collapsed, sheetHeight, narrow]);
  return null;
}
