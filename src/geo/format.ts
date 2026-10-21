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

/** The reader's thousands separator: "," in English, "." in pt-BR and German. */
const groupSeparator = () => nf(0).formatToParts(1234567).find((p) => p.type === "group")?.value ?? ",";

/**
 * Reads a number as the reader typed it: "12,5" in pt-BR or German, "12.5" in English. A phone's
 * decimal keypad may offer only one of "," and ".", so a lone separator is a decimal point unless
 * it's the locale's thousands separator in "1.234" form.
 */
export function parseNumber(input: string): number {
  const t = input.trim().replace(/[\s'’]/g, "");
  // With both, whichever comes last is the decimal point ("1.234,5" and "1,234.5" alike).
  if (t.includes(",") && t.includes(".")) {
    const dec = t.lastIndexOf(",") > t.lastIndexOf(".") ? "," : ".";
    const [whole, frac, extra] = t.split(dec);
    return extra === undefined ? Number(`${whole.replace(/[.,]/g, "")}.${frac}`) : NaN;
  }
  const group = groupSeparator();
  const sep = t.includes(",") ? "," : t.includes(".") ? "." : "";
  if (!sep) return Number(t);
  if (sep === group && /^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.split(sep).join(""));
  return t.split(sep).length === 2 ? Number(t.replace(sep, ".")) : NaN;
}

/** A number for an input box: the reader's decimal separator, no thousands separators. */
export function formatInput(n: number, digits = 3): string {
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: digits, useGrouping: false }).format(n);
}

export function formatRatio(r: number): string {
  if (r >= 10) return `${nf(0).format(Math.round(r))}×`;
  if (r >= 1) return `${nf(1).format(r)}×`;
  return `${nf(2).format(r)}×`;
}

/**
 * Familiar things to measure an area in, from small to huge. Visitors come from all over, so these
 * are things known worldwide rather than, say, US states.
 */
export const FAMILIAR = [
  { one: "parking space", many: "parking spaces", m2: 14.9 },
  { one: "tennis court", many: "tennis courts", m2: 260.8 },
  { one: "basketball court", many: "basketball courts", m2: 436.6 },
  { one: "Olympic pool", many: "Olympic pools", m2: 1250 },
  { one: "football pitch", many: "football pitches", m2: 7140 },
  { one: "Vatican City", many: "Vatican Cities", m2: 440_000 },
  { one: "Monaco", many: "Monacos", m2: 2_080_000 },
  { one: "Manhattan", many: "Manhattans", m2: 59_100_000 },
  { one: "Singapore", many: "Singapores", m2: 735_700_000 },
  { one: "Luxembourg", many: "Luxembourgs", m2: 2_586_000_000 },
  { one: "Belgium", many: "Belgiums", m2: 30_689_000_000 },
  { one: "Japan", many: "Japans", m2: 377_975_000_000 },
  { one: "India", many: "Indias", m2: 3_287_263_000_000 },
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
  // "≈ 501 million" (or "501 milhões") reads better than a nine-digit number.
  if (n >= 1_000_000) return `≈ ${new Intl.NumberFormat(undefined, { notation: "compact", compactDisplay: "long", maximumFractionDigits: 0 }).format(n)}`;
  if (n >= 1000) return `≈ ${nf(0).format(Math.round(n / 10) * 10)}`;
  if (n >= 20) return `≈ ${nf(0).format(Math.round(n))}`;
  return `≈ ${nf(1).format(n)}`;
}
