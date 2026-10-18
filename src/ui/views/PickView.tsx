import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, Plus, RefreshCw, MousePointerClick } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import { useUI } from "../../state/ui";
import { getMap, setPreview, visibleCenter, fitGeometry } from "../../map/mapCore";
import { mapClickHandler } from "../../map/modeHandlers";
import { whatsHere, fetchOutline, ServiceError, type PlaceResult, type Outline } from "../../geo/services";
import { formatArea } from "../../geo/format";
import { geometryArea } from "../../geo/geometry";
import { useSettings } from "../../state/settings";
import { addPlace } from "../actions";
import { ShapeIcon } from "../icons";
import { ViewHeader } from "./common";
import { useIsDesktop } from "../hooks";

/**
 * Desktop: click anything on the map to look there (a marker shows the spot).
 * Phones: move the map under the center crosshair, then tap "What's here?".
 */

export default function PickView() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [res, setRes] = useState<{ here: PlaceResult[]; inside: PlaceResult[] }>({ here: [], inside: [] });
  const [stale, setStale] = useState(false);
  const [chosen, setChosen] = useState<Outline | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const units = useSettings((s) => s.units);
  const desktop = useIsDesktop();
  const ctl = useRef<AbortController | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);

  const lookup = async (at?: [number, number]) => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    const [lng, lat] = at ?? visibleCenter();
    const m = getMap();
    if (at && m) {
      if (!marker.current) {
        const el = document.createElement("div");
        el.className = "pick-marker";
        marker.current = new maplibregl.Marker({ element: el });
      }
      marker.current.setLngLat(at).addTo(m);
    }
    setState("loading");
    setSearching(true);
    setRes({ here: [], inside: [] });
    setChosen(null);
    setPreview(null);
    try {
      setStale(false);
      const r = await whatsHere(lng, lat, ctl.current.signal, (partial) => {
        setRes(partial);
        if (partial.here.length + partial.inside.length) setState("done");
      });
      setRes(r);
      setState("done");
      setSearching(false);
    } catch (e) {
      setSearching(false);
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof ServiceError ? e.message : "The map lookup service didn't answer. Try again in a few seconds.");
      setState("error");
    }
  };

  useEffect(() => {
    useUI.getState().setMode("pick");
    const m = getMap();
    // Only the person moving the map makes "Look here instead" worth offering, not "Show" zooming to a result.
    const onMove = (e: { originalEvent?: Event }) => e.originalEvent && setStale(true);
    m?.on("dragstart", onMove);
    m?.on("zoomstart", onMove);
    document.body.classList.add("is-picking");
    mapClickHandler.current = (ll) => {
      lookup(ll);
      return true;
    };
    return () => {
      useUI.getState().setMode("browse");
      mapClickHandler.current = null;
      document.body.classList.remove("is-picking");
      marker.current?.remove();
      m?.off("dragstart", onMove);
      m?.off("zoomstart", onMove);
      setPreview(null);
      ctl.current?.abort();
    };
  }, []);

  const choose = async (r: PlaceResult) => {
    setLoadingKey(r.key);
    try {
      const o = await fetchOutline(r);
      setChosen(o);
      setPreview(o.geometry);
      fitGeometry(o.geometry, { maxZoom: 17 });
    } catch (e) {
      setError(e instanceof ServiceError ? e.message : "Couldn't load that outline.");
      setState("error");
    } finally {
      setLoadingKey(null);
    }
  };

  const row = (r: PlaceResult) => {
    const isChosen = chosen?.key === r.key;
    return (
      <div key={r.key} className="row" aria-selected={isChosen} style={{ cursor: "default" }}>
        <span className="row__ico"><ShapeIcon icon={r.icon} size={17} /></span>
        <button type="button" className="row__main" style={{ border: 0, background: "none", textAlign: "left", padding: 0 }} onClick={() => choose(r)}>
          <b>{r.name}</b>
          <small>{r.type}{isChosen ? ` · ${formatArea(geometryArea(chosen.geometry), units)}` : ""}</small>
        </button>
        {loadingKey === r.key ? <Loader2 size={18} className="spin" /> : isChosen ? (
          <button type="button" className="btn btn--primary btn--sm" onClick={() => { addPlace(chosen, "origin"); }}><Plus size={15} /> Add</button>
        ) : (
          <button type="button" className="btn btn--sm" onClick={() => choose(r)}>Show</button>
        )}
      </div>
    );
  };

  return (
    <>
      <ViewHeader title="Pick on map" close />
      <div className="panel__scroll">
        {desktop ? (
          <p style={{ marginTop: 0 }} className="pick-hint">
            <MousePointerClick size={18} /> {state === "loading" ? "Looking…" : state === "idle" ? "Click anything on the map to see what's there." : "Click somewhere else to look there instead."}
          </p>
        ) : (
          <>
            <p style={{ marginTop: 0 }}>Move the map so the crosshair sits on what you want, or tap it.</p>
            <button type="button" className="btn btn--primary" onClick={() => lookup()} disabled={state === "loading"} style={{ width: "100%" }}>
              {state === "loading" ? <Loader2 size={18} className="spin" /> : stale && state === "done" ? <RefreshCw size={18} /> : <Crosshair size={18} />}
              {state === "loading" ? "Looking…" : stale && state === "done" ? "Look here instead" : "What's here?"}
            </button>
          </>
        )}
        {state === "error" && (
          <div className="notice" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn--sm" onClick={() => lookup()}>Try again</button>
          </div>
        )}
        {state === "done" && (
          <div aria-live="polite">
            {!searching && res.here.length + res.inside.length === 0 && <p className="muted">Nothing with an outline right here. Try a building, park or lake.</p>}
            {res.here.length > 0 && <div className="sec"><span>Right here</span></div>}
            {res.here.map(row)}
            {res.inside.length > 0 && <div className="sec"><span>It's inside</span></div>}
            {res.inside.map(row)}
            {searching && <div className="skeleton" aria-label="Still looking" />}
          </div>
        )}
      </div>
    </>
  );
}
