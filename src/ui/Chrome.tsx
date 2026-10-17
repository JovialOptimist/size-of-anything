/** Map controls, app menu drawer, share dialog, toasts, live region and keyboard shortcuts. */
import { useEffect, useState } from "react";
import { Share2, CircleHelp, LocateFixed, Plus, Minus, Settings, Info, Shapes, PenLine, Crosshair, Search, Link, Check, X, Ruler } from "lucide-react";
import { useUI } from "../state/ui";
import { useSettings, useIsDark } from "../state/settings";
import { useShapes } from "../state/shapes";
import { useToasts, holdToast, releaseToast, toast } from "../state/toasts";
import { getMap } from "../map/mapCore";
import { shareTitle, shareUrl } from "../share/url";
import { useIsDesktop } from "./hooks";

export function MapControls() {
  const desktop = useIsDesktop();
  const layersOpen = useUI((s) => s.layersOpen);
  const basemap = useSettings((s) => s.basemap);
  const isDark = useIsDark();
  const mode = useUI((s) => s.mode);
  const sheetFull = useUI((s) => s.sheetSnap === "full");
  const thumb = basemap === "satellite" ? "thumb-sat" : isDark ? "thumb-dark" : "thumb-map";
  return (
    <>
      {mode === "browse" && (desktop || !sheetFull) && (
        <div className="ctl-top">
          <button type="button" className="pill" onClick={() => useUI.getState().set({ shareOpen: true })}><Share2 size={18} /> Share</button>
          <button type="button" className="round" aria-label="Help" onClick={() => useUI.getState().go({ name: "help" })}><CircleHelp size={20} /></button>
        </div>
      )}
      <div className="ctl-right" hidden={!desktop && sheetFull} style={{ bottom: desktop ? 32 : "calc(var(--sheet-h, 196px) + 12px)" }}>
        <div style={{ position: "relative" }}>
          <button type="button" className="layers-btn" aria-expanded={layersOpen} aria-label="Map layers" onClick={() => useUI.getState().set({ layersOpen: !layersOpen })}>
            <span className={`layers-btn__thumb ${thumb}`} />
            Layers
          </button>
          {layersOpen && <LayersPopover />}
        </div>
        <button type="button" className="round" aria-label="Go to my location" onClick={() => {
          navigator.geolocation?.getCurrentPosition(
            (p) => getMap()?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 14 }),
            () => toast({ text: "Couldn't get your location. Check your browser's location permission.", tone: "error" })
          );
        }}><LocateFixed size={20} /></button>
        {desktop && (
          <div className="zoom">
            <button type="button" aria-label="Zoom in" onClick={() => getMap()?.zoomIn()}><Plus size={18} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => getMap()?.zoomOut()}><Minus size={18} /></button>
          </div>
        )}
      </div>
    </>
  );
}

function LayersPopover() {
  const s = useSettings();
  const isDark = useIsDark();
  useEffect(() => {
    const close = (e: KeyboardEvent) => e.key === "Escape" && useUI.getState().set({ layersOpen: false });
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  return (
    <div className="layers-pop" role="dialog" aria-label="Map layers">
      <div className="inline" style={{ justifyContent: "space-between" }}>
        <h3>Map layers</h3>
        <button type="button" className="iconbtn" aria-label="Close" onClick={() => useUI.getState().set({ layersOpen: false })}><X size={18} /></button>
      </div>
      <div className="layer-opts">
        <button type="button" className="layer-opt" aria-pressed={s.basemap === "map"} onClick={() => s.set("basemap", "map")}>
          <span className={`layers-btn__thumb ${isDark ? "thumb-dark" : "thumb-map"}`} />Map
        </button>
        <button type="button" className="layer-opt" aria-pressed={s.basemap === "satellite"} onClick={() => s.set("basemap", "satellite")}>
          <span className="layers-btn__thumb thumb-sat" />Satellite
        </button>
        <button type="button" className="layer-opt" aria-pressed={s.globe} onClick={() => s.set("globe", !s.globe)}>
          <span className="layers-btn__thumb thumb-globe" />Globe
        </button>
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        {s.globe ? "Globe is on: zoom out to see the whole Earth without Mercator stretching." : "Tip: turn on the globe and zoom out to see true sizes without any stretching."}
      </p>
    </div>
  );
}

export function AppMenu() {
  const open = useUI((s) => s.menuOpen);
  if (!open) return null;
  const go = (r: Parameters<ReturnType<typeof useUI.getState>["go"]>[0]) => useUI.getState().go(r);
  return (
    <>
      <div className="scrim" onClick={() => useUI.getState().set({ menuOpen: false })} />
      <nav className="drawer" aria-label="Menu" onKeyDown={(e) => e.key === "Escape" && useUI.getState().set({ menuOpen: false })}>
        <div className="brand">
          <span className="brand__mark"><Ruler size={22} /></span>
          <span className="brand__name">The Size<br />of Anything</span>
        </div>
        <button type="button" className="menuitem" autoFocus onClick={() => go({ name: "search" })}><Search size={20} /> Search</button>
        <button type="button" className="menuitem" onClick={() => go({ name: "pick" })}><Crosshair size={20} /> Pick on map</button>
        <button type="button" className="menuitem" onClick={() => go({ name: "create" })}><PenLine size={20} /> Create a shape</button>
        <button type="button" className="menuitem" onClick={() => go({ name: "objects" })}><Shapes size={20} /> Objects</button>
        <hr style={{ border: 0, borderTop: "1px solid var(--border)", width: "100%" }} />
        <button type="button" className="menuitem" onClick={() => useUI.getState().set({ menuOpen: false, shareOpen: true })}><Share2 size={20} /> Share</button>
        <button type="button" className="menuitem" onClick={() => go({ name: "settings" })}><Settings size={20} /> Settings</button>
        <button type="button" className="menuitem" onClick={() => go({ name: "help" })}><CircleHelp size={20} /> Help &amp; feedback</button>
        <button type="button" className="menuitem" onClick={() => go({ name: "about" })}><Info size={20} /> About</button>
      </nav>
    </>
  );
}

export function ShareDialog() {
  const open = useUI((s) => s.shareOpen);
  const shapes = useShapes((s) => s.shapes);
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const url = shareUrl();
  const title = shareTitle();
  const close = () => {
    setCopied(false);
    useUI.getState().set({ shareOpen: false });
  };
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="share-h" onKeyDown={(e) => e.key === "Escape" && close()}>
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <h2 id="share-h">Share this comparison</h2>
          <button type="button" className="iconbtn" aria-label="Close" onClick={close}><X size={20} /></button>
        </div>
        {shapes.length === 0 ? (
          <p className="muted">Add something to the map first, then share it.</p>
        ) : (
          <>
            <div className="share-card"><p>{title}</p></div>
            <div className="linkbox">
              <input readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn--primary" onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                  toast({ text: "Link copied" });
                } catch {
                  toast({ text: "Couldn't copy. Select the link and copy it yourself.", tone: "error" });
                }
              }}>{copied ? <Check size={18} /> : <Link size={18} />} {copied ? "Copied" : "Copy link"}</button>
            </div>
            {"share" in navigator && (
              <button type="button" className="btn" onClick={() => navigator.share({ title, text: `${title} on The Size of Anything`, url }).catch(() => {})}>
                <Share2 size={18} /> Share with an app…
              </button>
            )}
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>The link holds every shape, where you put it and how it's rotated.</p>
          </>
        )}
      </div>
    </>
  );
}

export function Toasts() {
  const toasts = useToasts((s) => s.toasts);
  const desktop = useIsDesktop();
  return (
    <div className="toasts" style={{ bottom: desktop ? 28 : "calc(var(--sheet-h, 196px) + 14px)" }}>
      {toasts.map((t) => (
        <div key={t.id} className={`toast${t.tone === "error" ? " toast--error" : ""}`} onMouseEnter={() => holdToast(t.id)} onMouseLeave={() => releaseToast(t.id)} onFocus={() => holdToast(t.id)} onBlur={() => releaseToast(t.id)}>
          <span>{t.text}</span>
          {t.action && (
            <button type="button" onClick={() => {
              t.action!.run();
              useToasts.getState().dismiss(t.id);
            }}>{t.action.label}</button>
          )}
          <button type="button" aria-label="Dismiss" onClick={() => useToasts.getState().dismiss(t.id)}><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}

export function LiveRegion() {
  const text = useUI((s) => s.announce);
  return <div className="sr-only" aria-live="polite" role="status">{text}</div>;
}

