import type { AreaGeometry } from "../geo/geometry";

const polygonsOf = (g: AreaGeometry) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

/**
 * A small flat drawing of an outline (equirectangular, corrected by latitude).
 * With `original`, the outline had water taken out: the original is drawn faint and dashed, and
 * framing follows it, so the view holds still when the cut outline fades in.
 */
export default function OutlinePreview({ geometry, original, height = 150 }: { geometry: AreaGeometry; original?: AreaGeometry; height?: number }) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygonsOf(original ?? geometry)) for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * k || 1e-9, h = maxY - minY || 1e-9;
  const W = 300, H = height;
  const s = Math.min((W - 24) / w, (H - 24) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const path = (g: AreaGeometry) =>
    polygonsOf(g)
      .flatMap((p) => p)
      .map((ring) => {
        const step = Math.max(1, Math.floor(ring.length / 800));
        return "M" + ring.filter((_, i) => i % step === 0).map(([x, y]) => `${(ox + (x - minX) * k * s).toFixed(1)},${(oy + (maxY - y) * s).toFixed(1)}`).join("L") + "Z";
      })
      .join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outline preview">
      {original && <path className="opreview__fade" d={path(original)} fill="none" stroke="var(--accent)" strokeOpacity="0.55" strokeWidth="1.25" strokeDasharray="4 4" strokeLinejoin="round" />}
      {/* Keyed so the cut outline fades in rather than snapping. */}
      <path key={original ? "cut" : "mapped"} className={original ? "opreview__fade" : undefined} d={path(geometry)} fill="color-mix(in oklch, var(--accent) 20%, transparent)" stroke="var(--accent)" strokeWidth="2" fillRule="evenodd" strokeLinejoin="round" />
    </svg>
  );
}
