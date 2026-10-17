import { useEffect, useMemo } from "react";
import { Lasso, MousePointerClick, Plus, Square, RectangleHorizontal, Circle, Hexagon } from "lucide-react";
import { useDraft, type ShapeKind } from "../../state/draft";
import { useShapes } from "../../state/shapes";
import { useIsDark, useSettings } from "../../state/settings";
import { useUI } from "../../state/ui";
import { PALETTE } from "../../map/palette";
import { getMap, setPreview, visibleCenter } from "../../map/mapCore";
import { geometryArea, localFromMeters, place } from "../../geo/geometry";
import { formatArea, formatAreaSecondary, formatLength } from "../../geo/format";
import { addGenerated } from "../actions";
import { ViewHeader } from "./common";
import type { MetersPolys } from "../../objects/registry";

const LENGTH_UNITS = [
  { id: "m", label: "m", m: 1 },
  { id: "km", label: "km", m: 1000 },
  { id: "ft", label: "ft", m: 0.3048 },
  { id: "yd", label: "yd", m: 0.9144 },
  { id: "mi", label: "mi", m: 1609.344 },
];
const AREA_UNITS = [
  { id: "m2", label: "m²", m2: 1 },
  { id: "ha", label: "hectares", m2: 10_000 },
  { id: "km2", label: "km²", m2: 1_000_000 },
  { id: "ft2", label: "sq ft", m2: 0.09290304 },
  { id: "acre", label: "acres", m2: 4046.8564 },
  { id: "mi2", label: "sq mi", m2: 2_589_988.11 },
];

const KINDS: { id: ShapeKind; label: string; Icon: typeof Square }[] = [
  { id: "square", label: "Square", Icon: Square },
  { id: "rectangle", label: "Rectangle", Icon: RectangleHorizontal },
  { id: "circle", label: "Circle", Icon: Circle },
  { id: "polygon", label: "Polygon", Icon: Hexagon },
];

function ngon(n: number, R: number): MetersPolys {
  const pts: [number, number][] = [];
  const steps = n;
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / steps;
    pts.push([R * Math.cos(a), R * Math.sin(a)]);
  }
  return [[pts]];
}

/** Turn the form into metres. Returns null with a message when the input isn't usable. */
function compute(d: ReturnType<typeof useDraft.getState>): { meters: MetersPolys; label: string; derived: string } | { error: string } {
  const a = Number(d.a), b = Number(d.b), n = Math.round(Number(d.sides));
  if (!(a > 0)) return { error: "Enter a size greater than 0." };
  const len = LENGTH_UNITS.find((u) => u.id === d.lenUnit)!;
  const ar = AREA_UNITS.find((u) => u.id === d.areaUnit)!;
  const short = (m: number) => formatLength(m, d.lenUnit === "m" || d.lenUnit === "km" ? "metric" : "us");
  if (d.by === "area") {
    const A = a * ar.m2;
    if (d.kind === "square") {
      const s = Math.sqrt(A);
      return { meters: ngon(4, s / Math.SQRT2).map((p) => p.map((r) => r.map(([x, y]) => rot45(x, y)))), label: `${d.a} ${ar.label} square`, derived: `Each side ${short(s)}` };
    }
    if (d.kind === "rectangle") {
      if (!(b > 0)) return { error: "Enter an aspect ratio greater than 0." };
      const w = Math.sqrt(A / b), l = w * b;
      return { meters: rect(w, l), label: `${d.a} ${ar.label} rectangle`, derived: `${short(w)} × ${short(l)}` };
    }
    if (d.kind === "circle") {
      const r = Math.sqrt(A / Math.PI);
      return { meters: ngon(128, r), label: `${d.a} ${ar.label} circle`, derived: `Radius ${short(r)}` };
    }
    if (!(n >= 3 && n <= 64)) return { error: "Use between 3 and 64 sides." };
    const R = Math.sqrt((2 * A) / (n * Math.sin((2 * Math.PI) / n)));
    return { meters: ngon(n, R), label: `${d.a} ${ar.label} ${n}-sided polygon`, derived: `Side ${short(2 * R * Math.sin(Math.PI / n))}` };
  }
  const A = a * len.m;
  if (d.kind === "square") return { meters: rect(A, A), label: `${d.a} ${len.label} square`, derived: "" };
  if (d.kind === "rectangle") {
    if (!(b > 0)) return { error: "Enter a length greater than 0." };
    return { meters: rect(A, b * len.m), label: `${d.a} × ${d.b} ${len.label} rectangle`, derived: "" };
  }
  if (d.kind === "circle") {
    const r = d.circleMeasure === "radius" ? A : A / 2;
    return { meters: ngon(128, r), label: `${d.a} ${len.label} ${d.circleMeasure === "radius" ? "radius" : "wide"} circle`, derived: d.circleMeasure === "radius" ? `${short(2 * r)} across` : `Radius ${short(r)}` };
  }
  if (!(n >= 3 && n <= 64)) return { error: "Use between 3 and 64 sides." };
  const R = A / (2 * Math.sin(Math.PI / n));
  return { meters: ngon(n, R), label: `${n}-sided polygon, ${d.a} ${len.label} sides`, derived: "" };
}
const rect = (w: number, l: number): MetersPolys => [[[[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2], [-w / 2, -l / 2]]]];
const rot45 = (x: number, y: number): [number, number] => [(x - y) / Math.SQRT2, (x + y) / Math.SQRT2];

export default function CreateView() {
  const d = useDraft();
  const units = useSettings((s) => s.units);
  const isDark = useIsDark();
  const shapes = useShapes((s) => s.shapes);
  const nextSlot = useMemo(() => {
    const used = new Set(shapes.map((s) => s.slot));
    return [...Array(10).keys()].find((i) => !used.has(i)) ?? 0;
  }, [shapes]);
  const slot = d.slot ?? nextSlot;
  const result = compute(d);

  // Ghost preview that follows the center of the visible map.
  useEffect(() => {
    if (d.tab !== "shape" || "error" in result) {
      setPreview(null);
      return;
    }
    const local = localFromMeters(result.meters);
    const draw = () => setPreview(place(local, visibleCenter()));
    draw();
    const m = getMap();
    m?.on("move", draw);
    return () => {
      m?.off("move", draw);
      setPreview(null);
    };
  }, [d.tab, JSON.stringify("error" in result ? null : result.meters)]); // eslint-disable-line react-hooks/exhaustive-deps

  const area = "error" in result ? 0 : geometryArea(place(localFromMeters(result.meters), [0, 0]));

  const add = () => {
    if ("error" in result) return;
    addGenerated({
      name: d.name.trim() || result.label,
      type: "Custom shape",
      locality: result.derived,
      icon: "drawn",
      source: { kind: "exact", meters: result.meters },
      slot,
    });
    useDraft.getState().set({ name: "", slot: null });
  };

  return (
    <>
      <ViewHeader title="Create a shape" />
      <div className="panel__scroll stack">
        <div className="field">
          <label htmlFor="cname">Name</label>
          <div className="input"><input id="cname" placeholder={"error" in result ? "My shape" : result.label} value={d.name} onChange={(e) => d.set({ name: e.target.value })} /></div>
        </div>
        <div className="field">
          <span className="lbl">Color</span>
          <div className="swatches" role="radiogroup" aria-label="Color">
            {PALETTE.map((p, i) => (
              <button key={p.name} type="button" className="swatch" aria-label={p.name} aria-pressed={slot === i} style={{ ["--c" as string]: isDark ? p.D : p.L }} onClick={() => d.set({ slot: i })} />
            ))}
          </div>
        </div>
        <div className="seg" role="group" aria-label="How to create">
          <button type="button" aria-pressed={d.tab === "shape"} onClick={() => d.set({ tab: "shape" })}>Exact size</button>
          <button type="button" aria-pressed={d.tab === "draw"} onClick={() => d.set({ tab: "draw" })}>Draw it</button>
        </div>

        {d.tab === "shape" ? (
          <>
            <div className="chips">
              {KINDS.map(({ id, label, Icon }) => (
                <button key={id} type="button" className={`chip${d.kind === id ? " is-on" : ""}`} aria-pressed={d.kind === id} onClick={() => d.set({ kind: id })}><Icon size={15} /> {label}</button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Size by">
              <button type="button" aria-pressed={d.by === "dimensions"} onClick={() => d.set({ by: "dimensions" })}>By dimensions</button>
              <button type="button" aria-pressed={d.by === "area"} onClick={() => d.set({ by: "area", areaUnit: units === "us" ? "ft2" : "m2" })}>By area</button>
            </div>
            {d.by === "dimensions" ? (
              <>
                {d.kind === "circle" && (
                  <div className="seg" role="group" aria-label="Circle measure">
                    <button type="button" aria-pressed={d.circleMeasure === "radius"} onClick={() => d.set({ circleMeasure: "radius" })}>Radius</button>
                    <button type="button" aria-pressed={d.circleMeasure === "diameter"} onClick={() => d.set({ circleMeasure: "diameter" })}>Diameter</button>
                  </div>
                )}
                <div className={d.kind === "rectangle" ? "grid2" : ""}>
                  <NumberField id="ca" label={d.kind === "rectangle" ? "Width" : d.kind === "circle" ? (d.circleMeasure === "radius" ? "Radius" : "Diameter") : "Side"} value={d.a} onChange={(a) => d.set({ a })} unit={d.lenUnit} units={LENGTH_UNITS} onUnit={(lenUnit) => d.set({ lenUnit })} />
                  {d.kind === "rectangle" && <NumberField id="cb" label="Length" value={d.b} onChange={(b) => d.set({ b })} unit={d.lenUnit} units={LENGTH_UNITS} onUnit={(lenUnit) => d.set({ lenUnit })} />}
                </div>
              </>
            ) : (
              <>
                <NumberField id="ca" label="Area" value={d.a} onChange={(a) => d.set({ a })} unit={d.areaUnit} units={AREA_UNITS} onUnit={(areaUnit) => d.set({ areaUnit })} />
                {d.kind === "rectangle" && <NumberField id="cb" label="Length ÷ width (shape)" value={d.b} onChange={(b) => d.set({ b })} />}
              </>
            )}
            {d.kind === "polygon" && <NumberField id="cs" label="Sides" value={d.sides} onChange={(sides) => d.set({ sides })} />}
            {"error" in result ? (
              <span className="err" role="alert">{result.error}</span>
            ) : (
              <div className="card" aria-live="polite">
                <div className="bigarea" style={{ fontSize: 28 }}>{formatArea(area, units)}<small>{formatAreaSecondary(area, units)}{result.derived ? ` · ${result.derived}` : ""}</small></div>
              </div>
            )}
            <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>The dashed outline on the map is a preview. Move the map to put it where you want, then add it.</p>
            <button type="button" className="btn btn--primary" onClick={add} disabled={"error" in result}>
              <Plus size={18} /> Add “{d.name.trim() || ("error" in result ? "shape" : result.label)}”
            </button>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>Trace your backyard, a lake, your commute, anything. You can resize it to an exact area afterwards.</p>
            <button type="button" className="row" onClick={() => { d.set({ drawMode: "lasso" }); useUI.getState().go({ name: "draw" }); }}>
              <span className="row__ico"><Lasso size={18} /></span>
              <span className="row__main"><b>Lasso</b><small>Draw freehand with your finger or mouse</small></span>
              <span />
            </button>
            <button type="button" className="row" onClick={() => { d.set({ drawMode: "points" }); useUI.getState().go({ name: "draw" }); }}>
              <span className="row__ico"><MousePointerClick size={18} /></span>
              <span className="row__main"><b>Corners</b><small>Tap or click each corner, then close the shape</small></span>
              <span />
            </button>
          </>
        )}
      </div>
    </>
  );
}

function NumberField({ id, label, value, onChange, unit, units, onUnit }: { id: string; label: string; value: string; onChange: (v: string) => void; unit?: string; units?: { id: string; label: string }[]; onUnit?: (u: string) => void }) {
  const bad = !(Number(value) > 0);
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input${bad ? " is-invalid" : ""}`}>
        <input id={id} inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
        {units && onUnit && (
          <select aria-label={`${label} unit`} value={unit} onChange={(e) => onUnit(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}
