/** Area formatting, ratios and familiar-unit comparisons. */

export type UnitSystem = "metric" | "us";

export function defaultUnits(): UnitSystem {
  const lang = (navigator.languages?.[0] || navigator.language || "en-US").toLowerCase();
  return /-(us|lr|mm)$/.test(lang) || lang === "en" ? "us" : "metric";
}

const nf = (digits: number) => new Intl.NumberFormat(undefined, { maximumFractionDigits: digits, minimumFractionDigits: 0 });

function sig(n: number): string {
  if (n >= 1000) return nf(0).format(Math.round(n));
  if (n >= 100) return nf(0).format(n);
  if (n >= 10) return nf(1).format(n);
  return nf(2).format(n);
}

export function formatArea(m2: number, units: UnitSystem): string {
  if (units === "metric") {
    if (m2 < 10_000) return `${sig(m2)} m²`;
    if (m2 < 1_000_000) return `${sig(m2 / 10_000)} ha`;
    return `${sig(m2 / 1_000_000)} km²`;
  }
  const ft2 = m2 * 10.7639;
  const acres = m2 / 4046.8564;
  const mi2 = m2 / 2_589_988.11;
  if (ft2 < 43_560) return `${sig(ft2)} sq ft`;
  if (mi2 < 1) return `${sig(acres)} ${acres < 1.005 ? "acre" : "acres"}`;
  return `${sig(mi2)} sq mi`;
}

/** The other unit system, for the small secondary line. */
export function formatAreaSecondary(m2: number, units: UnitSystem): string {
  return formatArea(m2, units === "metric" ? "us" : "metric");
}

export function formatLength(m: number, units: UnitSystem): string {
  if (units === "metric") return m < 1000 ? `${sig(m)} m` : `${sig(m / 1000)} km`;
  const ft = m * 3.28084;
  return ft < 5280 ? `${sig(ft)} ft` : `${sig(ft / 5280)} mi`;
}

export function formatRatio(r: number): string {
  if (r >= 10) return `${nf(0).format(Math.round(r))}×`;
  if (r >= 1) return `${nf(1).format(r)}×`;
  return `${nf(2).format(r)}×`;
}

/** Familiar things to measure an area in, from small to huge. */
export const FAMILIAR = [
  { one: "parking space", many: "parking spaces", m2: 14.9 },
  { one: "tennis court", many: "tennis courts", m2: 260.8 },
  { one: "basketball court", many: "basketball courts", m2: 436.6 },
  { one: "Olympic pool", many: "Olympic pools", m2: 1250 },
  { one: "soccer pitch", many: "soccer pitches", m2: 7140 },
  { one: "Central Park", many: "Central Parks", m2: 3_410_000 },
  { one: "Manhattan", many: "Manhattans", m2: 59_100_000 },
  { one: "Rhode Island", many: "Rhode Islands", m2: 3_144_000_000 },
  { one: "Texas", many: "Texases", m2: 695_662_000_000 },
];

/** Up to `max` friendly comparisons where the count lands between 1.5 and ~5000. */
export function familiarComparisons(m2: number, max = 3) {
  return FAMILIAR.map((f) => ({ ...f, count: m2 / f.m2 }))
    .filter((f) => f.count >= 1.5 && f.count <= 5000)
    .sort((a, b) => Math.abs(Math.log10(a.count) - 1.3) - Math.abs(Math.log10(b.count) - 1.3))
    .slice(0, max)
    .map((f) => ({ label: f.many, count: f.count, text: `${approx(f.count)} ${f.many}` }));
}

export function approx(n: number): string {
  if (n >= 1000) return `≈ ${nf(0).format(Math.round(n / 10) * 10)}`;
  if (n >= 20) return `≈ ${nf(0).format(Math.round(n))}`;
  return `≈ ${nf(1).format(n)}`;
}
