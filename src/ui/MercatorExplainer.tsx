/**
 * A click-through picture of why flat maps stretch: an apple (the Earth) is cut
 * into slices, the slices are laid flat, stretched to fill the gaps, and things
 * near the poles end up drawn too big. One `stage` number (0 to 3) drives the
 * drawing, and it animates smoothly between steps.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { getMap } from "../map/mapCore";
import { mercatorInflation } from "../geo/geometry";

const RAD = Math.PI / 180;
const W = 320, H = 200, CX = W / 2, CY = H / 2;
const SLICES = 8;
const MAX_LAT = 75; // Mercator runs off to infinity at the poles, so stop short.
const R = 46; // pixels per radian
const SLICE_W = (W - 24) / SLICES;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const mercY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));

/** Screen y for a latitude, from true (u = 0) to Mercator (u = 1) spacing. */
const yAt = (lat: number, u: number) => CY - R * lerp(lat * RAD, mercY(lat), u);
/** How much wider (and taller) Mercator draws things at a latitude, partway to full. */
const stretchAt = (lat: number, u: number) => lerp(1, 1 / Math.cos(lat * RAD), u);

function slicePath(cx: number, u: number) {
  const right: string[] = [];
  const left: string[] = [];
  for (let lat = -MAX_LAT; lat <= MAX_LAT; lat += 5) {
    const half = (SLICE_W / 2) * lerp(Math.cos(lat * RAD), 1, u);
    const y = yAt(lat, u).toFixed(1);
    right.push(`${(cx + half).toFixed(1)},${y}`);
    left.unshift(`${(cx - half).toFixed(1)},${y}`);
  }
  return `M${right.join("L")}L${left.join("L")}Z`;
}

/** Two made-up islands of about the same real size, as offsets from their middles in units of their half-size. */
type Outline = [number, number][];
const ISLAND_A: Outline = [
  [-0.35, 1], [0.1, 0.95], [0.45, 0.85], [0.7, 0.6], [0.55, 0.35], [0.8, 0.1], [0.6, -0.2], [0.4, -0.5], [0.2, -0.8], [0, -1],
  [-0.15, -0.75], [-0.35, -0.45], [-0.6, -0.2], [-0.8, 0.15], [-0.7, 0.45], [-0.9, 0.7], [-0.6, 0.85],
];
const ISLAND_B: Outline = [
  [-0.2, 0.85], [0.3, 0.95], [0.7, 0.7], [0.9, 0.25], [0.7, -0.1], [0.85, -0.55], [0.5, -0.9], [0.05, -0.7],
  [-0.3, -0.95], [-0.7, -0.65], [-0.8, -0.2], [-0.55, 0.1], [-0.85, 0.45], [-0.6, 0.75],
];
const ISLAND_SIZE = 0.2; // half-size in radians of the Earth's surface (about 1,300 km)

/**
 * The island centred at a latitude on a slice, drawn as the map would draw it partway to Mercator (u).
 * It is the same real size wherever it is; only the map's stretch changes how big it looks.
 */
function islandPath(shape: Outline, cx: number, lat: number, u: number) {
  return "M" + shape.map(([x, y]) => {
    const pLat = lat + (y * ISLAND_SIZE) / RAD;
    // Longitude span grows by 1/cos(lat) for a fixed real width; the slice shrinks it back by cos (true) or not at all (Mercator).
    const px = cx + (R * x * ISLAND_SIZE * lerp(Math.cos(pLat * RAD), 1, u)) / Math.cos(lat * RAD);
    return `${px.toFixed(1)},${yAt(pLat, u).toFixed(1)}`;
  }).join("L") + "Z";
}

/** The same island on the apple, seen from the front (an orthographic view), centred at a longitude. */
function islandOnApple(shape: Outline, lon: number, lat: number, r: number) {
  return "M" + shape.map(([x, y]) => {
    const pLat = (lat * RAD) + y * ISLAND_SIZE;
    const pLon = lon * RAD + (x * ISLAND_SIZE) / Math.cos(lat * RAD);
    return `${(CX + r * Math.cos(pLat) * Math.sin(pLon)).toFixed(1)},${(CY - r * Math.sin(pLat)).toFixed(1)}`;
  }).join("L") + "Z";
}

function Drawing({ stage }: { stage: number }) {
  const peel = ease(clamp01(stage)); // 0 → 1: from apple to slices in a row
  const u = ease(clamp01(stage - 1)); // 0 → 1: slices stretched to fill the gaps
  const slide = ease(clamp01(stage - 2)); // 0 → 1: the northern island slides to the equator
  const r = 82;

  // Two islands of the same real size: one on the equator, one far north.
  const sliceX = (i: number) => lerp(CX, 12 + SLICE_W * (i + 0.5), peel);
  const northLat = lerp(58, 0, slide);
  const k = mercatorInflation(northLat) ** u;
  const labelY = (lat: number) => yAt(lat, u) + R * ISLAND_SIZE * stretchAt(lat, u) + 13;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="merc" role="img" aria-label="Animation of how a flat map stretches the Earth">
      {/* The apple */}
      <g opacity={1 - peel}>
        <path d={`M${CX} ${CY - r + 4} q -2 -16 -9 -22`} className="merc__stem" />
        <path d={`M${CX - 6} ${CY - r - 12} q -18 -10 -26 4 q 16 8 26 -4 z`} className="merc__leaf" />
        <circle cx={CX} cy={CY} r={r} className="merc__fill" />
        {[22.5, 45, 67.5].map((l) => (
          <ellipse key={l} cx={CX} cy={CY} rx={r * Math.sin(l * RAD)} ry={r} className="merc__line" />
        ))}
        <line x1={CX} y1={CY - r} x2={CX} y2={CY + r} className="merc__line" />
        <path d={islandOnApple(ISLAND_A, -40, 0, r)} className="merc__land" />
        <path d={islandOnApple(ISLAND_B, 40, 58, r)} className="merc__land" />
        <circle cx={CX} cy={CY} r={r} className="merc__edge" />
      </g>

      {/* The slices, with the two islands on them */}
      <g opacity={peel}>
        {Array.from({ length: SLICES }, (_, i) => <path key={i} d={slicePath(sliceX(i), u)} className="merc__slice" />)}
        <path d={islandPath(ISLAND_A, sliceX(2), 0, u)} className="merc__land" />
        <path d={islandPath(ISLAND_B, sliceX(5), northLat, u)} className="merc__land" />
        {u > 0.05 && (
          <g opacity={Math.min(1, u * 2)}>
            <text x={sliceX(2)} y={labelY(0)} className="merc__label">real size</text>
            <text x={sliceX(5)} y={Math.min(H - 6, labelY(northLat))} className="merc__label">
              {k > 1.15 ? `${k.toFixed(1)}× too big` : "real size"}
            </text>
          </g>
        )}
      </g>
    </svg>
  );
}

export default function MercatorExplainer() {
  const lat = getMap()?.getCenter().lat ?? 45;
  const k = mercatorInflation(lat);
  const steps: ReactNode[] = [
    <>Imagine the Earth as an apple. We'd like to represent all the skin of the apple on a flat paper map. The first step of the Mercator projection is to cut up the apple into slices.</>,
    <>Then, we line up the slices in a row, so that we can see all the skin at the same time. The only problem is, there are gaps at the top and bottom of our apple slices that don't come together all the way.</>,
    <>Using lots of fancy math, we can increase the size of those parts of the apple slices, to fill in the gaps. The main side effect is that now, the top parts of our map are way bigger than they are supposed to be.</>,
    <>
      So every flat map is a little off. Places near the poles, like Russia and Greenland, are drawn way too big. Where you're looking now, around {Math.round(Math.abs(lat))}° {lat >= 0 ? "N" : "S"}, everything is <b>{k.toFixed(1)}×</b> its real size.
      Shapes here keep their true size, so they shrink as you drag them toward the equator and grow toward the poles. To see the world without the stretch, turn on <b>Globe</b> in Layers.
    </>,
  ];
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState(0);
  const from = useRef(0);

  // Animate the drawing to the chosen step.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    const a = from.current;
    const dur = reduce ? 0 : Math.min(1400, 700 * Math.abs(step - a) + 300);
    let frame = 0;
    const tick = (now: number) => {
      const t = dur ? Math.min(1, (now - start) / dur) : 1;
      const v = lerp(a, step, t);
      from.current = v;
      setStage(v);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  const last = step === steps.length - 1;
  return (
    <div className="merc-explainer">
      <Drawing stage={stage} />
      <p className="merc-explainer__text" aria-live="polite">{steps[step]}</p>
      <div className="merc-explainer__nav">
        <button type="button" className="btn btn--sm" onClick={() => setStep(step - 1)} disabled={step === 0}><ChevronLeft size={15} /> Back</button>
        <div className="merc-explainer__dots" role="group" aria-label="Steps">
          {steps.map((_, i) => (
            <button key={i} type="button" aria-label={`Step ${i + 1}`} aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)} />
          ))}
        </div>
        {last ? (
          <button type="button" className="btn btn--sm" onClick={() => setStep(0)}><RotateCcw size={14} /> Again</button>
        ) : (
          <button type="button" className="btn btn--sm btn--primary" onClick={() => setStep(step + 1)}>Next <ChevronRight size={15} /></button>
        )}
      </div>
    </div>
  );
}
