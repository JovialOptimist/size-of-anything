import { useEffect, useMemo, useState } from "react";
import { RotateCcw, RotateCw, Copy, Trash2, Crosshair, MapPinned, LocateFixed, ArrowUp, ArrowDown, ArrowLeft as ALeft, ArrowRight, ExternalLink, Scaling, Eye, EyeOff, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { useShapes, shapeArea, placedGeometry } from "../../state/shapes";
import { useSettings } from "../../state/settings";
import { useUI } from "../../state/ui";
import { toast } from "../../state/toasts";
import { formatArea, formatAreaSecondary, formatRatio, approx, FAMILIAR } from "../../geo/format";
import { suggestPlaces, fetchOutline, type PlaceResult } from "../../geo/services";
import { geometryCenter, localFromMeters, place } from "../../geo/geometry";
import { visibleCenter, fitGeometry } from "../../map/mapCore";
import { nudge, rotateBy, setRotation, setScale } from "../../map/interaction";
import { PALETTE, shapeColor } from "../../map/palette";
import { fetchPlaceInfo, type PlaceInfo } from "../../geo/placeInfo";
import { objectById, thumbnailPath } from "../../objects/registry";
import SatelliteSnapshot from "../SatelliteSnapshot";
import type { Shape } from "../../state/shapes";
import { deleteShape, duplicateShape, moveShapeTo } from "../actions";
import { ShapeIcon } from "../icons";
import { ViewHeader } from "./common";
import { useSwatch } from "../hooks";
import { useIsDark } from "../../state/settings";

const AREA_UNITS = [
  { id: "m2", label: "m²", m2: 1 },
  { id: "ha", label: "hectares", m2: 10_000 },
  { id: "km2", label: "km²", m2: 1_000_000 },
  { id: "ft2", label: "sq ft", m2: 0.09290304 },
  { id: "acre", label: "acres", m2: 4046.8564 },
  { id: "mi2", label: "sq mi", m2: 2_589_988.11 },
];

export default function DetailView({ id }: { id: string }) {
  const s = useShapes((st) => st.shapes.find((x) => x.id === id));
  const shapes = useShapes((st) => st.shapes);
  const units = useSettings((st) => st.units);
  const showBoth = useSettings((st) => st.showBothUnits);
  const swatch = useSwatch();
  const isDark = useIsDark();
  const [name, setName] = useState(s?.name ?? "");
  const [moveTo, setMoveTo] = useState(false);
  const [exact, setExact] = useState(false);

  const [rot, setRot] = useState(String(Math.round(s?.rotation ?? 0)));
  useEffect(() => setName(s?.name ?? ""), [s?.name]);
  useEffect(() => setRot(String(Math.round(s?.rotation ?? 0))), [s?.rotation]);
  // If the shape goes away (undo, delete elsewhere), leave its page.
  useEffect(() => {
    if (!s) useUI.getState().home();
  }, [s]);
  useEffect(() => {
    if (s) useShapes.getState().select(s.id);
  }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) {
    return (
      <>
        <ViewHeader title="Shape" onBack={() => useUI.getState().home()} />
        <div className="panel__scroll"><p className="muted">This shape isn't on the map any more.</p></div>
      </>
    );
  }

  const area = shapeArea(s);
  const commitName = () => {
    const n = name.trim();
    if (n && n !== s.name) useShapes.getState().update(s.id, { name: n });
    else setName(s.name);
  };

  return (
    <>
      <ViewHeader
        title={<span className="sr-only">{s.name}</span>}
        onBack={() => {
          useShapes.getState().select(null);
          useUI.getState().home();
        }}
        right={
          <button type="button" className="iconbtn" aria-label={s.visible ? "Hide shape" : "Show shape"} onClick={() => useShapes.getState().update(s.id, { visible: !s.visible })}>
            {s.visible ? <Eye size={19} /> : <EyeOff size={19} />}
          </button>
        }
      />
      <div className="panel__scroll" style={{ ["--c" as string]: swatch(s.slot) }}>
        <div className="detail-hero">
          <div className="detail-hero__top">
            <span className="detail-icon"><ShapeIcon icon={s.icon} size={24} /></span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <input
                className="name-input"
                value={name}
                aria-label="Name"
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") setName(s.name);
                }}
              />
              <div className="muted" style={{ fontSize: 13 }}>{[s.type, s.locality].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
          <div className="bigarea">{formatArea(area, units)}<small>{showBoth ? formatAreaSecondary(area, units) : ""}{s.scale !== 1 ? ` · scaled to ${Math.round(s.scale * s.scale * 100)}% of its area` : ""}</small></div>
        </div>

        <Picture s={s} />
        <Compare s={s} shapes={shapes} area={area} />

        <div className="sec"><span>Shape</span></div>
        <div className="actions">
          <button type="button" className="action" onClick={() => rotateBy(s.id, -15)}><RotateCcw size={19} />Left 15°</button>
          <button type="button" className="action" onClick={() => rotateBy(s.id, 15)}><RotateCw size={19} />Right 15°</button>
          <button type="button" className="action" onClick={() => duplicateShape(s.id)}><Copy size={19} />Copy</button>
          <button type="button" className="action danger" onClick={() => deleteShape(s.id)}><Trash2 size={19} />Delete</button>
        </div>
        <div className="inline" style={{ margin: "8px 0 4px" }}>
          <label className="lbl" htmlFor="rot">Rotation</label>
          <div className="input" style={{ width: 110, minHeight: 38 }}>
            <input id="rot" type="number" inputMode="numeric" value={rot} onChange={(e) => setRot(e.target.value)}
              onBlur={() => {
                const v = Number(rot);
                if (rot.trim() !== "" && Number.isFinite(v) && Math.round(v) !== Math.round(s.rotation)) setRotation(s.id, v);
                else setRot(String(Math.round(s.rotation)));
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
            <span className="muted">°</span>
          </div>
          {s.rotation !== 0 && <button type="button" className="btn btn--sm" onClick={() => setRotation(s.id, 0)}>Reset</button>}
        </div>

        <div className="sec"><span>Color</span></div>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {PALETTE.map((p, i) => (
            <button key={p.name} type="button" className="swatch" aria-label={p.name} aria-pressed={s.slot === i} style={{ ["--c" as string]: isDark ? p.D : p.L }} onClick={() => useShapes.getState().update(s.id, { slot: i })} />
          ))}
        </div>

        <div className="sec"><span>Move it</span></div>
        <div className="btnrow">
          <button type="button" className="btn btn--sm" onClick={() => moveShapeTo(s.id, visibleCenter())}><Crosshair size={16} /> Move here</button>
          <button type="button" className="btn btn--sm" onClick={() => setMoveTo((v) => !v)} aria-expanded={moveTo}><MapPinned size={16} /> Move to…</button>
          <button type="button" className="btn btn--sm" onClick={() => {
            navigator.geolocation?.getCurrentPosition(
              (pos) => moveShapeTo(s.id, [pos.coords.longitude, pos.coords.latitude]),
              () => toast({ text: "Couldn't get your location. Check your browser's location permission.", tone: "error" })
            );
          }}><LocateFixed size={16} /> My location</button>
        </div>
        {moveTo && <MoveTo id={s.id} name={s.name} onDone={() => setMoveTo(false)} />}
        <div className="inline" style={{ marginTop: 10 }}>
          <div className="pad" aria-label="Nudge">
            <span />
            <button type="button" aria-label="Nudge up" onClick={() => nudge(s.id, 0, -40)}><ArrowUp size={18} /></button>
            <span />
            <button type="button" aria-label="Nudge left" onClick={() => nudge(s.id, -40, 0)}><ALeft size={18} /></button>
            <button type="button" aria-label="Zoom to shape" onClick={() => fitGeometry(placedGeometry(s))}><ShapeIcon icon={s.icon} size={16} /></button>
            <button type="button" aria-label="Nudge right" onClick={() => nudge(s.id, 40, 0)}><ArrowRight size={18} /></button>
            <span />
            <button type="button" aria-label="Nudge down" onClick={() => nudge(s.id, 0, 40)}><ArrowDown size={18} /></button>
            <span />
          </div>
          <p className="muted" style={{ fontSize: 12.5, flex: 1, minWidth: 140 }}>Or drag the pin on the map. Arrow keys nudge, <span className="kbd">[</span> <span className="kbd">]</span> rotate.</p>
        </div>

        <div className="sec"><span>Size</span></div>
        {exact ? <ExactArea id={s.id} onDone={() => setExact(false)} /> : (
          <button type="button" className="btn btn--sm" onClick={() => setExact(true)}><Scaling size={16} /> Set exact area…</button>
        )}

        {s.source.kind === "osm" && (
          <>
            <div className="sec"><span>Source</span></div>
            <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
              Outline from OpenStreetMap.{" "}
              <a href={`https://www.openstreetmap.org/${{ W: "way", R: "relation", N: "node" }[s.source.key[0] as "W"]}/${s.source.key.slice(1)}`} target="_blank" rel="noopener noreferrer">
                View or fix it on OpenStreetMap <ExternalLink size={12} />
              </a>
            </p>
          </>
        )}
      </div>
    </>
  );
}

function MoveTo({ id, name, onDone }: { id: string; name: string; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<PlaceResult[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (q.trim().length < 3) return setRes([]);
    const ctl = new AbortController();
    const t = setTimeout(() => suggestPlaces(q.trim(), undefined, ctl.signal).then(setRes).catch(() => {}), 300);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [q]);
  return (
    <div className="card" style={{ marginTop: 10 }}>
      <div className="field">
        <label htmlFor="moveto">Move {name} to…</label>
        <div className="input"><input id="moveto" autoFocus placeholder="Tokyo, your hometown, anywhere" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>
      {res.slice(0, 5).map((r) => (
        <button key={r.key} type="button" className="row" disabled={busy} onClick={async () => {
          setBusy(true);
          try {
            const o = await fetchOutline(r).catch(() => null);
            moveShapeTo(id, o ? geometryCenter(o.geometry) : await pointOf(r));
            onDone();
          } finally {
            setBusy(false);
          }
        }}>
          <span className="row__ico"><ShapeIcon icon={r.icon} size={16} /></span>
          <span className="row__main"><b>{r.name}</b><small>{[r.type, r.locality].filter(Boolean).join(" · ")}</small></span>
          <span />
        </button>
      ))}
    </div>
  );
}

async function pointOf(r: PlaceResult): Promise<[number, number]> {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(r.name)}&limit=1`);
  const j = await res.json();
  return j.features?.[0]?.geometry?.coordinates ?? visibleCenter();
}

function ExactArea({ id, onDone }: { id: string; onDone: () => void }) {
  const s = useShapes((st) => st.shapes.find((x) => x.id === id))!;
  const units = useSettings((st) => st.units);
  const [unit, setUnit] = useState(units === "us" ? "acre" : "ha");
  const u = AREA_UNITS.find((x) => x.id === unit)!;
  const [val, setVal] = useState(() => String(+(shapeArea(s) / u.m2).toPrecision(3)));
  const n = Number(val);
  const valid = Number.isFinite(n) && n > 0;
  const apply = () => {
    if (!valid) return;
    const scale = Math.sqrt((n * u.m2) / s.area);
    if (scale > 3000 || scale < 1 / 3000) return toast({ text: "That's a bit too extreme. Try a size closer to the original.", tone: "error" });
    setScale(s.id, scale);
    toast({ text: `${s.name} is now exactly ${val} ${u.label}`, action: { label: "Undo", run: () => useShapes.getState().undo() } });
    onDone();
  };
  return (
    <div className="card stack">
      <div className="field">
        <label htmlFor="exact">Make it exactly</label>
        <div className={`input${valid ? "" : " is-invalid"}`}>
          <input id="exact" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && apply()} autoFocus />
          <select aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value)}>
            {AREA_UNITS.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </div>
        {!valid && <span className="err">Enter a size greater than 0.</span>}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>Keeps the outline and scales it evenly, like resizing a photo.</p>
      <div className="btnrow">
        <button type="button" className="btn btn--primary btn--sm" onClick={apply} disabled={!valid}>Resize</button>
        {s.scale !== 1 && <button type="button" className="btn btn--sm" onClick={() => { setScale(s.id, 1); onDone(); }}>Back to original size</button>}
        <button type="button" className="btn btn--sm" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

// ---------- comparisons ----------
interface Option { key: string; name: string; m2: number; kind: "shape" | "familiar"; one?: string; many?: string; slot?: number }

const FAMILIAR_OBJECTS = ["olympic-pool", "soccer-pitch", "american-football-field", "tennis-court", "blue-whale", "boeing-737", "titanic", "great-pyramid", "acre", "square-mile"];

function sentence(name: string, area: number, o: Option) {
  const r = area / o.m2;
  if (o.kind === "shape") {
    return r >= 1
      ? <><b>{name}</b> is <b className="num">{formatRatio(r)}</b> the size of {o.name}.</>
      : <>{o.name} is <b className="num">{formatRatio(1 / r)}</b> bigger than <b>{name}</b>.</>;
  }
  if (r >= 1.5) return <>You could fit <b className="num">{approx(r)} {o.many}</b> in <b>{name}</b>.</>;
  if (r >= 0.67) return <><b>{name}</b> is about the size of {o.one}.</>;
  return <>It would take <b className="num">{approx(1 / r)}</b> of <b>{name}</b> to cover {o.one}.</>;
}

function metersArea(meters: [number, number][][][]) {
  let a = 0;
  for (const poly of meters)
    poly.forEach((ring, ri) => {
      let r = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) r += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
      a += (ri === 0 ? 1 : -1) * Math.abs(r / 2);
    });
  return a;
}

function Compare({ s, shapes, area }: { s: Shape; shapes: Shape[]; area: number }) {
  const swatch = useSwatch();
  const options = useMemo<Option[]>(() => {
    const own: Option[] = shapes
      .filter((o) => o.id !== s.id)
      .map((o) => ({ key: `s:${o.id}`, name: o.name, m2: shapeArea(o), kind: "shape" as const, slot: o.slot }));
    const objs: Option[] = FAMILIAR_OBJECTS.map((id) => objectById(id)).filter((o) => !!o).map((o) => {
      const lower = o.name.charAt(0).toLowerCase() + o.name.slice(1);
      const proper = /^[A-Z]{2}|^RMS|^Boeing/.test(o.name);
      return { key: `o:${o.id}`, name: o.name, m2: metersArea(o.build()), kind: "familiar" as const, one: proper ? `the ${o.name}` : `a ${lower}`, many: proper ? `copies of the ${o.name}` : `${lower}s` };
    });
    const fam: Option[] = FAMILIAR.filter((f) => !["Olympic pool", "soccer pitch", "tennis court"].includes(f.one)).map((f) => ({
      key: `f:${f.one}`, name: f.one.charAt(0).toUpperCase() + f.one.slice(1), m2: f.m2, kind: "familiar" as const, one: /^[A-Z]/.test(f.one) ? f.one : `a ${f.one}`, many: f.many,
    }));
    return [...own, ...objs, ...fam];
  }, [shapes, s.id]);
  // Default: the most recent shape of a comparable size, otherwise the familiar thing that gives the friendliest number.
  const best = useMemo(() => {
    const near = options.filter((o) => o.kind === "shape" && Math.abs(Math.log10(area / o.m2)) < 3).pop();
    if (near) return near.key;
    return [...options].filter((o) => o.kind === "familiar").sort((a, b) => Math.abs(Math.log10(area / a.m2) - 1.3) - Math.abs(Math.log10(area / b.m2) - 1.3))[0]?.key;
  }, [options, area]);
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => setChosen(null), [s.id]);
  const key = chosen && options.some((o) => o.key === chosen) ? chosen : best;
  const idx = Math.max(0, options.findIndex((o) => o.key === key));
  const o = options[idx];
  if (!o) return null;
  const step = (d: number) => setChosen(options[(idx + d + options.length) % options.length].key);
  return (
    <>
      <div className="sec"><span>How big is that?</span></div>
      <div className="compare" style={o.slot !== undefined ? { ["--c" as string]: swatch(o.slot) } : undefined}>
        <button type="button" className="iconbtn" aria-label="Previous comparison" onClick={() => step(-1)}><ChevronLeft size={20} /></button>
        <p className="compare__text" aria-live="polite">{sentence(s.name, area, o)}</p>
        <button type="button" className="iconbtn" aria-label="Next comparison" onClick={() => step(1)}><ChevronRight size={20} /></button>
      </div>
      <div className="input compare__pick">
        <label htmlFor="cmp" className="lbl" style={{ whiteSpace: "nowrap" }}>Compare with</label>
        <select id="cmp" value={o.key} onChange={(e) => setChosen(e.target.value)}>
          {options.some((x) => x.kind === "shape") && (
            <optgroup label="On your map">{options.filter((x) => x.kind === "shape").map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</optgroup>
          )}
          <optgroup label="Familiar things">{options.filter((x) => x.kind === "familiar").map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}</optgroup>
        </select>
      </div>
    </>
  );
}

// ---------- picture and place info ----------
function Picture({ s }: { s: Shape }) {
  const [info, setInfo] = useState<PlaceInfo | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const osmKey = s.source.kind === "osm" ? s.source.key : null;
  useEffect(() => {
    setInfo(null);
    setPhotoFailed(false);
    if (!osmKey) return;
    const ctl = new AbortController();
    fetchPlaceInfo(osmKey, ctl.signal).then(setInfo).catch(() => {});
    return () => ctl.abort();
  }, [osmKey]);

  if (s.source.kind === "object") {
    const obj = objectById(s.source.id);
    if (!obj) return null;
    const t = thumbnailPath(obj.build());
    return (
      <div className="picture picture--object">
        <svg viewBox={t.viewBox} aria-hidden="true"><path d={t.d} /></svg>
        <p>{obj.fact}</p>
      </div>
    );
  }

  // Where the place really is: the original OSM outline, or a drawn shape where it was first made.
  const realGeom = s.geometry ?? (s.source.kind !== "osm" ? place(localFromMeters(s.source.meters), s.origin) : null);
  const color = shapeColor(s.slot, true);
  return (
    <div className="picture">
      {info?.photo && !photoFailed ? (
        <figure>
          <img src={info.photo.url} alt={`Photo of ${s.name}`} loading="lazy" onError={() => setPhotoFailed(true)} />
          <figcaption><a href={info.photo.link} target="_blank" rel="noopener noreferrer">Photo: {info.photo.credit}</a></figcaption>
        </figure>
      ) : realGeom ? (
        <figure>
          <SatelliteSnapshot geometry={realGeom} color={color} />
          <figcaption>{s.source.kind === "osm" ? "Satellite view of where it really is" : "Satellite view of where you made it"}</figcaption>
        </figure>
      ) : null}
      {info && (info.description || info.wikipedia || info.facts.length > 0 || info.website) && (
        <div className="placeinfo">
          {info.wikipedia ? <p>{info.wikipedia.extract}</p> : info.description ? <p>{info.description}</p> : null}
          {info.facts.length > 0 && (
            <dl>{info.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd>{f.value}</dd></div>)}</dl>
          )}
          <div className="btnrow">
            {info.wikipedia && <a className="btn btn--sm" href={info.wikipedia.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> Wikipedia</a>}
            {info.website && <a className="btn btn--sm" href={info.website} target="_blank" rel="noopener noreferrer"><Globe size={14} /> Website</a>}
          </div>
        </div>
      )}
    </div>
  );
}
