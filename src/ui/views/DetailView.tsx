import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Copy, Trash2, ExternalLink, Scaling, X, ChevronLeft, ChevronRight, Globe, TrianglesCenterlineDashedHorizontal, TrianglesCenterlineDashedVertical } from "lucide-react";
import { useShapes, shapeArea, baseArea, canRemoveWater, measuringWater, waterMode } from "../../state/shapes";
import { WATER_OPTIONS, type WaterMode } from "../../geo/water";
import { Seg } from "./InfoViews";
import { useSettings } from "../../state/settings";
import { useUI, announce } from "../../state/ui";
import { toast } from "../../state/toasts";
import { formatArea, formatAreaSecondary, formatRatio, approx, formatInput, parseNumber, FAMILIAR } from "../../geo/format";
import { localFromMeters, place } from "../../geo/geometry";
import { flip, setRotation, setScale } from "../../map/interaction";
import { PALETTE, shapeColor } from "../../map/palette";
import { fetchPlaceInfo, type PlaceInfo } from "../../geo/placeInfo";
import { objectById, thumbnailPath } from "../../objects/registry";
import SatelliteSnapshot from "../SatelliteSnapshot";
import type { Shape } from "../../state/shapes";
import { deleteShape, duplicateShape } from "../actions";
import { ShapeIcon } from "../icons";
import { useSwatch } from "../hooks";
import { useIsDark } from "../../state/settings";
import { Literal } from "../Literal";

const AREA_UNITS = [
  { id: "m2", label: "m²", m2: 1 },
  { id: "ha", label: "hectares", m2: 10_000 },
  { id: "km2", label: "km²", m2: 1_000_000 },
  { id: "ft2", label: "sq ft", m2: 0.09290304 },
  { id: "acre", label: "acres", m2: 4046.8564 },
  { id: "mi2", label: "sq mi", m2: 2_589_988.11 },
];

const close = () => {
  useShapes.getState().select(null);
  useUI.getState().home();
};

export default function DetailView({ id }: { id: string }) {
  const s = useShapes((st) => st.shapes.find((x) => x.id === id));
  const shapes = useShapes((st) => st.shapes);
  const units = useSettings((st) => st.units);
  const showBoth = useSettings((st) => st.showBothUnits);
  const swatch = useSwatch();
  const isDark = useIsDark();
  const [name, setName] = useState(s?.name ?? "");
  const [exact, setExact] = useState(false);

  useEffect(() => setName(s?.name ?? ""), [s?.name]);
  useEffect(() => setExact(false), [id]);
  // If the shape goes away (undo, delete elsewhere), leave its page.
  useEffect(() => {
    if (!s) useUI.getState().home();
  }, [s]);
  useEffect(() => {
    if (s) useShapes.getState().select(s.id);
  }, [s?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!s) return null;

  const area = shapeArea(s);
  const commitName = () => {
    const n = name.trim();
    if (n && n !== s.name) useShapes.getState().update(s.id, { name: n });
    else setName(s.name);
  };

  return (
    <>
      <header className="detail-head" style={{ ["--c" as string]: swatch(s.slot) }}>
        <span className="detail-icon"><ShapeIcon icon={s.icon} size={24} /></span>
        <div className="detail-head__text">
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
          <div className="muted detail-head__sub">{[s.type, s.locality].filter(Boolean).join(" · ")}</div>
        </div>
        <button type="button" className="iconbtn" aria-label="Close" onClick={close}><X size={20} /></button>
      </header>
      <div className="panel__scroll" style={{ ["--c" as string]: swatch(s.slot) }}>
        <div className="bigarea">
          <Literal>{formatArea(area, units)}</Literal>
          <small>
            {showBoth && <Literal>{formatAreaSecondary(area, units)}</Literal>}
            {s.scale !== 1 && <span> · scaled to {Math.round(s.scale * s.scale * 100)}% of its area</span>}
          </small>
        </div>
        <Water s={s} />

        <Picture s={s} />
        <Compare s={s} shapes={shapes} area={area} />

        <div className="sec"><span>Shape</span></div>
        <div className="actions actions--3">
          <button type="button" className="action" disabled={Math.round(s.rotation) % 360 === 0} onClick={() => setRotation(s.id, 0)}><RotateCcw size={19} />Reset rotation</button>
          {/* Lucide names these by the dashed mirror line, so a left-right flip is the vertical one. Its old Flip*2 names are reversed aliases. */}
          <button type="button" className="action" onClick={() => flip(s.id, "horizontal")}><TrianglesCenterlineDashedVertical size={19} />Flip horizontal</button>
          <button type="button" className="action" onClick={() => flip(s.id, "vertical")}><TrianglesCenterlineDashedHorizontal size={19} />Flip vertical</button>
          <button type="button" className="action" aria-expanded={exact} onClick={() => setExact((v) => !v)}><Scaling size={19} />Resize</button>
          <button type="button" className="action" onClick={() => duplicateShape(s.id)}><Copy size={19} />Clone</button>
          <button type="button" className="action danger" onClick={() => deleteShape(s.id)}><Trash2 size={19} />Delete</button>
        </div>
        {exact && <ExactArea id={s.id} onDone={() => setExact(false)} />}

        <div className="sec"><span>Color</span></div>
        <div className="swatches" role="radiogroup" aria-label="Color">
          {PALETTE.map((p, i) => (
            <button key={p.name} type="button" className="swatch" aria-label={p.name} aria-pressed={s.slot === i} style={{ ["--c" as string]: isDark ? p.D : p.L }} onClick={() => useShapes.getState().update(s.id, { slot: i })} />
          ))}
        </div>

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

/** Water inside a border: keep it, drop the sea, or keep only land. Hidden where there's none. */
function Water({ s }: { s: Shape }) {
  const units = useSettings((st) => st.units);
  if (!canRemoveWater(s)) return null;
  if (measuringWater(s)) return <p className="muted water__note">Measuring the water inside the border…</p>;
  const w = s.waterless;
  if (!w?.sea && !w?.all) return null;
  // Offer only choices that change something: a lake city has no sea, an island country may have no lakes.
  const lakes = !!w.all && (!w.sea || w.all.area < w.sea.area * 0.999);
  const options = WATER_OPTIONS.filter(([m]) => m === "keep" || (m === "sea" && w.sea) || (m === "all" && lakes));
  const mode = waterMode(s);
  const shown: WaterMode = baseArea(s) === s.area ? "keep" : mode === "all" && lakes ? "all" : "sea";
  return (
    <div className="water">
      <div className="lbl water__label">Water inside the border</div>
      <Seg label="Water inside the border" value={shown} onChange={(water) => useShapes.getState().update(s.id, { water })} options={options} />
      {shown !== "keep" && (
        <p className="muted water__note">
          As mapped, with water:<Literal>{` ${formatArea(s.area * s.scale * s.scale, units)}`}</Literal>
        </p>
      )}
    </div>
  );
}

function ExactArea({ id, onDone }: { id: string; onDone: () => void }) {
  const s = useShapes((st) => st.shapes.find((x) => x.id === id))!;
  const units = useSettings((st) => st.units);
  const [unit, setUnit] = useState(units === "us" ? "acre" : "ha");
  const u = AREA_UNITS.find((x) => x.id === unit)!;
  const [val, setVal] = useState(() => formatInput(shapeArea(s) / u.m2));
  const n = parseNumber(val);
  const valid = Number.isFinite(n) && n > 0;
  const apply = () => {
    if (!valid) return;
    const scale = Math.sqrt((n * u.m2) / baseArea(s));
    if (scale > 3000 || scale < 1 / 3000) return toast({ text: "That's a bit too extreme. Try a size closer to the original.", tone: "error" });
    setScale(s.id, scale);
    announce(`${s.name} is now exactly ${val} ${u.label}`);
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

/** Which wording `sentence` uses, so the sentence can be keyed by it (see Compare). */
function sentenceKind(r: number, o: Option) {
  if (o.kind === "shape") return r >= 1 ? "times" : "bigger";
  return r >= 1.5 ? "fit" : r >= 0.67 ? "about" : "take";
}

function sentence(name: string, area: number, o: Option) {
  const r = area / o.m2;
  // Names and numbers are Literal: translators mangle locale-formatted numbers and "translate" names.
  // Translators also drop the spaces around untranslated parts, so the spaces live inside them.
  const own = (pad: string) => <b translate="no">{pad.replace("_", name)}</b>;
  const num = (n: string) => <b className="num"><Literal>{` ${n} `}</Literal></b>;
  switch (sentenceKind(r, o)) {
    case "times": return <>{own("_ ")}is{num(formatRatio(r))}the size of<Literal>{` ${o.name}`}</Literal>.</>;
    case "bigger": return <><Literal>{`${o.name} `}</Literal>is{num(formatRatio(1 / r))}bigger than{own(" _")}.</>;
    case "fit": return <>You could fit<b className="num"><Literal>{` ${approx(r)} `}</Literal>{o.many}</b> in{own(" _")}.</>;
    case "about": return <>{own("_ ")}is about the size of {o.one}.</>;
    default: return <>It would take{num(approx(1 / r))}of{own(" _ ")}to cover {o.one}.</>;
  }
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
      // "Olympic" and "American" keep their capitals mid-sentence.
      const lower = /^(Olympic|American) /.test(o.name) ? o.name : o.name.charAt(0).toLowerCase() + o.name.slice(1);
      const proper = /^[A-Z]{2}|^RMS|^Boeing|^Great /.test(o.name);
      const plural = /(ch|sh|s|x)$/.test(lower) ? `${lower}es` : `${lower}s`;
      const article = /^[aeiou]/i.test(lower) ? "an" : "a";
      return { key: `o:${o.id}`, name: o.name, m2: metersArea(o.build()), kind: "familiar" as const, one: proper ? `the ${o.name}` : `${article} ${lower}`, many: proper ? `copies of the ${o.name}` : plural };
    });
    const fam: Option[] = FAMILIAR.filter((f) => !["Olympic pool", "football pitch", "tennis court"].includes(f.one)).map((f) => ({
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
        {/* A translated page has moved this sentence's text around, so React mustn't patch it in place
            (that crashes or leaves the old comparison showing). The key makes it replace the whole sentence. */}
        <p key={`${o.key}:${sentenceKind(area / o.m2, o)}`} className="compare__text" aria-live="polite">{sentence(s.name, area, o)}</p>
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
          <figcaption key={s.source.kind}>{s.source.kind === "osm" ? "Satellite view of where it really is" : "Satellite view of where you made it"}</figcaption>
        </figure>
      ) : null}
      {info && (info.description || info.wikipedia || info.facts.length > 0 || info.website) && (
        <div className="placeinfo">
          {/* lang tells translators what language the summary is really in, since it may not be English. */}
          {info.wikipedia ? <p lang={info.wikipedia.lang}>{info.wikipedia.extract}</p> : info.description ? <p>{info.description}</p> : null}
          {info.facts.length > 0 && (
            <dl>{info.facts.map((f) => <div key={f.label}><dt>{f.label}</dt><dd translate={f.words ? undefined : "no"}>{f.value}</dd></div>)}</dl>
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
