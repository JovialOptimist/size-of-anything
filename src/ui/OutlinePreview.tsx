import type { AreaGeometry } from "../geo/geometry";

/** A small flat drawing of an outline (equirectangular, corrected by latitude). */
export default function OutlinePreview({ geometry, height = 150 }: { geometry: AreaGeometry; height?: number }) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  const k = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
  const w = (maxX - minX) * k || 1e-9, h = maxY - minY || 1e-9;
  const W = 300, H = height;
  const s = Math.min((W - 24) / w, (H - 24) / h);
  const ox = (W - w * s) / 2, oy = (H - h * s) / 2;
  const d = polys
    .flatMap((p) => p)
    .map((ring) => {
      const step = Math.max(1, Math.floor(ring.length / 800));
      return "M" + ring.filter((_, i) => i % step === 0).map(([x, y]) => `${(ox + (x - minX) * k * s).toFixed(1)},${(oy + (maxY - y) * s).toFixed(1)}`).join("L") + "Z";
    })
    .join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outline preview">
      <path d={d} fill="color-mix(in oklch, var(--accent) 20%, transparent)" stroke="var(--accent)" strokeWidth="2" fillRule="evenodd" strokeLinejoin="round" />
    </svg>
  );
}
