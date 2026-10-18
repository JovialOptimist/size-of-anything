/** Map controls, share dialog, toasts, live region and keyboard shortcuts. */
import { useEffect, useState } from "react";
import { Undo2, Redo2, Share2, CircleHelp, LocateFixed, Plus, Minus, Link, Check, X, Settings, ArrowLeft } from "lucide-react";
import { useUI } from "../state/ui";
import { useSettings, useIsDark } from "../state/settings";
import { useShapes } from "../state/shapes";
import { useToasts, holdToast, releaseToast, toast } from "../state/toasts";
import { getMap } from "../map/mapCore";
import { shareTitle, shareUrl } from "../share/url";
import { useIsDesktop } from "./hooks";
import { undo, redo } from "./actions";
import { Seg, SettingsBody, HelpBody, AboutBody, FeedbackBody } from "./views/InfoViews";
import { OLD_VERSION_URL } from "../config";

export function MapControls() {
  const desktop = useIsDesktop();
  const layersOpen = useUI((s) => s.layersOpen);
  const basemap = useSettings((s) => s.basemap);
  const isDark = useIsDark();
  const mode = useUI((s) => s.mode);
  const sheetFull = useUI((s) => s.sheetSnap === "full");
  const canUndo = useShapes((s) => s.past.length > 0);
  const canRedo = useShapes((s) => s.future.length > 0);
  const thumb = basemap === "satellite" ? "thumb-sat" : isDark ? "thumb-dark" : "thumb-map";
  return (
    <>
      {mode === "browse" && (desktop || !sheetFull) && (
        <div className="ctl-top">
          <div className="history" role="group" aria-label="History">
            <button type="button" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo}><Undo2 size={18} /></button>
            <button type="button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo}><Redo2 size={18} /></button>
          </div>
          <button type="button" className="pill" onClick={() => useUI.getState().set({ shareOpen: true })}><Share2 size={18} /> Share</button>
          <button type="button" className="round" aria-label="Settings" title="Settings" onClick={() => useUI.getState().set({ settingsOpen: true, layersOpen: false })}><Settings size={20} /></button>
          <button type="button" className="round" aria-label="Help" title="Help" onClick={() => useUI.getState().set({ helpPage: "help", settingsOpen: false, layersOpen: false })}><CircleHelp size={20} /></button>
        </div>
      )}
      <div className="ctl-right" hidden={!desktop && sheetFull} style={{ bottom: desktop ? 32 : "calc(var(--sheet-h, 196px) + 12px)" }}>
        <div style={{ position: "relative" }}>
          <button type="button" className="layers-btn" aria-expanded={layersOpen} aria-label="Map layers" onClick={() => useUI.getState().set({ layersOpen: !layersOpen, settingsOpen: false })}>
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
      <div className="layers-units">
        <span>Units</span>
        <Seg label="Units" value={s.units} onChange={(v) => s.set("units", v)} options={[["metric", "Metric"], ["us", "US"]]} />
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
        {s.globe ? "Globe is on: zoom out to see the whole Earth without Mercator stretching." : "Tip: turn on the globe and zoom out to see true sizes without any stretching."}
      </p>
    </div>
  );
}

/** Settings: a dialog, like Help and Share. */
export function SettingsDialog() {
  const open = useUI((s) => s.settingsOpen);
  if (!open) return null;
  const close = () => useUI.getState().set({ settingsOpen: false });
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="dialog dialog--wide dialog--settings" role="dialog" aria-modal="true" aria-labelledby="settings-h" onKeyDown={(e) => e.key === "Escape" && close()}>
        <div className="inline dialog__head">
          <h2 id="settings-h">Settings</h2>
          <button type="button" className="iconbtn" aria-label="Close" autoFocus onClick={close}><X size={20} /></button>
        </div>
        <div className="dialog__body"><SettingsBody /></div>
      </div>
    </>
  );
}

const HELP_TITLES = { help: "Help", about: "About", feedback: "Send feedback" } as const;

/** Help, About and Feedback: reading material, in a dialog like Share. */
export function HelpDialog() {
  const page = useUI((s) => s.helpPage);
  if (!page) return null;
  const close = () => useUI.getState().set({ helpPage: null });
  const go = (p: typeof page) => useUI.getState().set({ helpPage: p });
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="dialog dialog--wide" role="dialog" aria-modal="true" aria-labelledby="help-h" onKeyDown={(e) => e.key === "Escape" && close()}>
        <div className="inline dialog__head">
          {page !== "help" && <button type="button" className="iconbtn" aria-label="Back to Help" onClick={() => go("help")}><ArrowLeft size={20} /></button>}
          <h2 id="help-h">{HELP_TITLES[page]}</h2>
          <button type="button" className="iconbtn" aria-label="Close" autoFocus onClick={close}><X size={20} /></button>
        </div>
        <div className="dialog__body">
          {page === "help" ? <HelpBody go={go} /> : page === "about" ? <AboutBody /> : <FeedbackBody />}
        </div>
      </div>
    </>
  );
}

const VERSION_SEEN_KEY = "soa-version-prompt-seen";
/** Things the old version saved in this browser: if any are here, this person has used it. */
const OLD_VERSION_KEYS = ["sizeOfAnything_history", "sizeOfAnything_dismissedMessages", "openedShare", "theme"];

/**
 * Welcome back: tells people who used the old version that it's still around.
 * Shows once on its own (only to returning visitors), and from Help any time.
 */
export function VersionDialog() {
  const open = useUI((s) => s.versionOpen);
  useEffect(() => {
    try {
      if (localStorage.getItem(VERSION_SEEN_KEY)) return;
      if (!OLD_VERSION_KEYS.some((k) => localStorage.getItem(k) !== null)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => useUI.getState().set({ versionOpen: true }), 1200);
    return () => clearTimeout(t);
  }, []);
  if (!open) return null;
  const close = () => {
    try {
      localStorage.setItem(VERSION_SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
    useUI.getState().set({ versionOpen: false });
  };
  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="version-h" onKeyDown={(e) => e.key === "Escape" && close()}>
        <div className="inline" style={{ justifyContent: "space-between" }}>
          <h2 id="version-h">Welcome to the new version</h2>
          <button type="button" className="iconbtn" aria-label="Close" onClick={close}><X size={20} /></button>
        </div>
        <p style={{ margin: 0 }}>
          The Size of Anything has been rebuilt with a cleaner map, faster search, true-size objects and a lot more.
          Prefer the way it was? The old version is still around.
        </p>
        <div className="btnrow">
          <button type="button" className="btn btn--primary" autoFocus onClick={close}>Explore the new version</button>
          <a className="btn" href={OLD_VERSION_URL} onClick={close}>Use the old version</a>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Shapes you made in the old version stay there. You can come back here any time.</p>
      </div>
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

