import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Search, Loader2, X, Plus, MapPinned } from "lucide-react";
import { useUI, announce } from "../../state/ui";
import { useSearch } from "../../state/search";
import { useSettings } from "../../state/settings";
import { fetchOutline, searchPlaces, suggestPlaces, ServiceError, type Outline, type PlaceResult } from "../../geo/services";
import { OBJECTS, type RefObject } from "../../objects/registry";
import { formatArea, formatAreaSecondary } from "../../geo/format";
import { geometryArea } from "../../geo/geometry";
import { visibleCenter, getMap } from "../../map/mapCore";
import { addObject, addPlace } from "../actions";
import { ShapeIcon } from "../icons";
import { TRY, runTry } from "../try";
import { useSwatch } from "../hooks";
import OutlinePreview from "../OutlinePreview";

type Item =
  | { kind: "object"; obj: RefObject }
  | { kind: "place"; place: PlaceResult & { area?: number }; recent?: boolean }
  | { kind: "osm" };

function highlight(text: string, q: string) {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (!q || i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function SearchView() {
  const q = useSearch((s) => s.q);
  const pending = useSearch((s) => s.pending);
  const setQ = (v: string) => useSearch.setState({ q: v });
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [full, setFull] = useState<PlaceResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [preview, setPreview] = useState<Outline | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const recent = useUI((s) => s.recent);
  const rememberRecent = useSettings((s) => s.rememberRecent);
  const units = useSettings((s) => s.units);
  const swatch = useSwatch();
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => input.current?.focus(), []);

  // Photon suggestions while typing.
  useEffect(() => {
    setFull(null);
    setActive(0);
    const t = q.trim();
    if (t.length < 3) {
      setSuggestions([]);
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const c = getMap() ? visibleCenter() : undefined;
        setSuggestions(await suggestPlaces(t, c, ctl.signal));
      } catch {
        /* suggestions are best-effort */
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);

  // Enter in the floating card's box asks for a full search as the drawer opens.
  useEffect(() => {
    if (!pending) return;
    useSearch.setState({ pending: false });
    runFullSearch();
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  const items: Item[] = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rememberRecent ? recent.map((r) => ({ kind: "place" as const, place: r, recent: true })) : [];
    const objs = OBJECTS.filter((o) => `${o.name} ${o.synonyms}`.toLowerCase().includes(t)).slice(0, 4).map((obj) => ({ kind: "object" as const, obj }));
    const rec = rememberRecent ? recent.filter((r) => r.name.toLowerCase().includes(t)).slice(0, 3).map((place) => ({ kind: "place" as const, place, recent: true })) : [];
    const seen = new Set(rec.map((r) => r.place.key));
    const net = (full ?? suggestions).filter((p) => !seen.has(p.key)).map((place) => ({ kind: "place" as const, place }));
    return [...objs, ...rec, ...(full ? [] : [{ kind: "osm" as const }]), ...net];
  }, [q, recent, suggestions, full, rememberRecent]);

  async function runFullSearch() {
    const t = q.trim();
    if (!t) return;
    abort.current?.abort();
    abort.current = new AbortController();
    setLoading(true);
    setError(null);
    try {
      const res = await searchPlaces(t, getMap() ? visibleCenter() : undefined, abort.current.signal);
      setFull(res);
      setActive(0);
      announce(res.length ? `${res.length} results for ${t}` : `No results for ${t}`);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof ServiceError ? e.message : "Search didn't work. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(item: Item) {
    if (item.kind === "osm") return runFullSearch();
    if (item.kind === "object") {
      addObject(item.obj.id);
      return;
    }
    abort.current?.abort();
    abort.current = new AbortController();
    setPreviewing(item.place.key);
    setError(null);
    try {
      setPreview(await fetchOutline(item.place, abort.current.signal));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof ServiceError ? e.message : "Couldn't load that outline. Try again.");
    } finally {
      setPreviewing(null);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(items.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const it = items[active];
      if (it) choose(it);
      else runFullSearch();
    } else if (e.key === "Escape") {
      if (preview) setPreview(null);
      else useUI.getState().back();
    }
  };

  if (preview) {
    const area = geometryArea(preview.geometry);
    return (
      <>
        <header className="ph">
          <button type="button" className="iconbtn" onClick={() => setPreview(null)} aria-label="Back to results"><ArrowLeft size={20} /></button>
          <h2 className="ph__title">{preview.name}</h2>
        </header>
        <div className="panel__scroll">
          <div className="preview">
            <OutlinePreview geometry={preview.geometry} />
            <div>
              <div className="muted">{[preview.type, preview.locality].filter(Boolean).join(" · ")}</div>
              <div className="bigarea" style={{ fontSize: 30 }}>{formatArea(area, units)}<small>{formatAreaSecondary(area, units)}</small></div>
            </div>
            <div className="btnrow">
              <button type="button" className="btn btn--primary" onClick={() => { addPlace(preview, "center"); }}>
                <Plus size={18} /> Add to map
              </button>
              <button type="button" className="btn" onClick={() => { addPlace(preview, "origin"); }}>
                <MapPinned size={18} /> Show where it is
              </button>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>"Add to map" drops it in the middle of what you're looking at, ready to drag.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="omni" role="search">
        <button type="button" className="iconbtn" onClick={() => useUI.getState().back()} aria-label="Close search"><ArrowLeft size={20} /></button>
        <input
          ref={input}
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="search-results"
          aria-activedescendant={items.length ? `opt-${active}` : undefined}
          aria-autocomplete="list"
          aria-label="Search places and things"
          placeholder="Try “Central Park” or “blue whale”"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          enterKeyHint="search"
        />
        {loading ? <Loader2 size={18} className="spin" aria-label="Searching" /> : q ? (
          <button type="button" className="iconbtn" aria-label="Clear" onClick={() => { setQ(""); input.current?.focus(); }}><X size={18} /></button>
        ) : <Search size={18} className="muted" aria-hidden="true" style={{ marginRight: 10 }} />}
      </div>
      <div className="panel__scroll">
        {error && <div className="notice" role="alert"><span>{error}</span></div>}
        {!q.trim() && (
          <>
            {recent.length > 0 && rememberRecent && <div className="sec"><span>Recent</span></div>}
          </>
        )}
        <div id="search-results" role="listbox" aria-label="Results">
          {items.map((it, i) => {
            if (it.kind === "osm") {
              return (
                <button key="osm" id={`opt-${i}`} role="option" aria-selected={i === active} type="button" className="row" onClick={() => choose(it)} onMouseEnter={() => setActive(i)}>
                  <span className="row__ico"><Search size={17} /></span>
                  <span className="row__main"><b>Search OpenStreetMap for “{q.trim()}”</b><small>Press Enter to see every match</small></span>
                  <span className="row__end">↵</span>
                </button>
              );
            }
            if (it.kind === "object") {
              return (
                <button key={it.obj.id} id={`opt-${i}`} role="option" aria-selected={i === active} type="button" className="row" onClick={() => choose(it)} onMouseEnter={() => setActive(i)} style={{ ["--c" as string]: swatch(4) }}>
                  <span className="row__ico row__ico--c"><ShapeIcon icon={it.obj.icon} size={17} /></span>
                  <span className="row__main"><b>{highlight(it.obj.name, q.trim())}</b><small>Object · {it.obj.dims}</small></span>
                  <span className="row__end">Add</span>
                </button>
              );
            }
            const p = it.place;
            return (
              <button key={p.key + (it.recent ? "r" : "")} id={`opt-${i}`} role="option" aria-selected={i === active} type="button" className="row" onClick={() => choose(it)} onMouseEnter={() => setActive(i)}>
                <span className="row__ico"><ShapeIcon icon={p.icon} size={17} /></span>
                <span className="row__main"><b>{highlight(p.name, q.trim())}</b><small>{[it.recent ? "Recent" : p.type, p.locality].filter(Boolean).join(" · ")}</small></span>
                <span className="row__end">{previewing === p.key ? <Loader2 size={16} className="spin" /> : p.area ? formatArea(p.area, units) : ""}</span>
              </button>
            );
          })}
          {loading && <><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></>}
        </div>
        {full && full.length === 0 && !loading && (
          <div className="empty">
            <h3>Nothing called “{q.trim()}”</h3>
            <p>Try fewer words, add a city or country, or pick the spot on the map instead.</p>
            <button type="button" className="btn" onClick={() => useUI.getState().go({ name: "pick" })}>Pick on map</button>
          </div>
        )}
        {!q.trim() && (
          <>
            <div className="sec"><span>Try</span></div>
            <div className="chips">
              {TRY.map((t, i) => (
                <button key={t.label} type="button" className="chip chip--tint" style={{ ["--c" as string]: swatch(t.tint) }} onClick={() => { useUI.getState().back(); runTry(i); }}>{t.label}</button>
              ))}
            </div>
            <div className="sec"><span>Things to measure with</span></div>
            <div className="chips">
              {["blue-whale", "soccer-pitch", "titanic", "great-pyramid", "acre"].map((id) => {
                const o = OBJECTS.find((x) => x.id === id)!;
                return <button key={id} type="button" className="chip" onClick={() => addObject(id)}><ShapeIcon icon={o.icon} size={15} /> {o.name}</button>;
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
