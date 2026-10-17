import { useEffect, useRef, useState } from "react";
import { Crosshair, Loader2, Plus, RefreshCw } from "lucide-react";
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

export default function PickView() {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [res, setRes] = useState<{ here: PlaceResult[]; inside: PlaceResult[] }>({ here: [], inside: [] });
  const [stale, setStale] = useState(false);
  const [chosen, setChosen] = useState<Outline | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const units = useSettings((s) => s.units);
  const ctl = useRef<AbortController | null>(null);

  const lookup = async (at?: [number, number]) => {
    ctl.current?.abort();
    ctl.current = new AbortController();
    const [lng, lat] = at ?? visibleCenter();
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
    const onMove = () => setStale(true);
    m?.on("dragstart", onMove);
    m?.on("zoomstart", onMove);
    mapClickHandler.current = (ll) => {
      // On desktop a click is an explicit "look here".
      getMap()?.easeTo({ center: ll, duration: 300 });
      lookup(ll);
      return true;
    };
    return () => {
      useUI.getState().setMode("browse");
      mapClickHandler.current = null;
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
      <ViewHeader title="Pick on map" />
      <div className="panel__scroll">
        <p style={{ marginTop: 0 }}>Move the map so the crosshair sits on what you want{window.matchMedia("(pointer: fine)").matches ? ", or just click it" : ""}.</p>
        <button type="button" className="btn btn--primary" onClick={() => lookup()} disabled={state === "loading"} style={{ width: "100%" }}>
          {state === "loading" ? <Loader2 size={18} className="spin" /> : stale && state === "done" ? <RefreshCw size={18} /> : <Crosshair size={18} />}
          {state === "loading" ? "Looking…" : stale && state === "done" ? "Look here instead" : "What's here?"}
        </button>
        {state === "error" && (
          <div className="notice" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn--sm" onClick={() => lookup()}>Try again</button>
          </div>
        )}
        {state === "done" && (
          <div style={{ opacity: stale ? 0.55 : 1 }} aria-live="polite">
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
