/**
 * A picture for any outline: satellite tiles around it with the outline drawn on
 * top. Used when a place has no photo, and for drawn or custom shapes.
 */
import { SATELLITE_TILES } from "../config";
import type { AreaGeometry } from "../geo/geometry";

const W = 640, H = 360;

const worldX = (lng: number, z: number) => ((lng + 180) / 360) * 256 * 2 ** z;
const worldY = (lat: number, z: number) => {
  const s = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 256 * 2 ** z;
};

export default function SatelliteSnapshot({ geometry, color }: { geometry: AreaGeometry; color: string }) {
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polys) for (const [x, y] of p[0]) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  // Largest zoom where the outline fits with some margin.
  let z = 18;
  while (z > 1 && (worldX(maxX, z) - worldX(minX, z) > W * 0.75 || worldY(minY, z) - worldY(maxY, z) > H * 0.75)) z--;
  const cx = (worldX(minX, z) + worldX(maxX, z)) / 2, cy = (worldY(minY, z) + worldY(maxY, z)) / 2;
  const ox = cx - W / 2, oy = cy - H / 2;
  const n = 2 ** z;
  const tiles: { x: number; y: number; px: number; py: number }[] = [];
  for (let tx = Math.floor(ox / 256); tx <= Math.floor((ox + W) / 256); tx++)
    for (let ty = Math.floor(oy / 256); ty <= Math.floor((oy + H) / 256); ty++)
      if (ty >= 0 && ty < n) tiles.push({ x: ((tx % n) + n) % n, y: ty, px: tx * 256 - ox, py: ty * 256 - oy });
  const d = polys
    .flatMap((p) => p)
    .map((ring) => {
      const step = Math.max(1, Math.floor(ring.length / 1500));
      return "M" + ring.filter((_, i) => i % step === 0).map(([x, y]) => `${(worldX(x, z) - ox).toFixed(1)},${(worldY(y, z) - oy).toFixed(1)}`).join("L") + "Z";
    })
    .join("");
  return (
    <svg className="snapshot" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Satellite view of the outline">
      <rect width={W} height={H} fill="#1b2a2f" />
      {tiles.map((t) => (
        <image key={`${t.x}-${t.y}`} href={SATELLITE_TILES.replace("{z}", String(z)).replace("{x}", String(t.x)).replace("{y}", String(t.y))} x={t.px} y={t.py} width={256} height={256} />
      ))}
      <path d={d} fill={color} fillOpacity={0.18} stroke="#101418" strokeOpacity={0.7} strokeWidth={6} strokeLinejoin="round" fillRule="evenodd" />
      <path d={d} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}
