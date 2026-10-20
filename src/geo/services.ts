/**
 * Network services: Photon type-ahead, Nominatim search and outline lookup,
 * Overpass "what's here". Nominatim calls go through a 1 request/second queue
 * and outlines are cached in IndexedDB, per the OSMF usage policy.
 */
import { NOMINATIM, OVERPASS_SERVERS, PHOTON } from "../config";
import { describeFeature, type IconKey } from "./categories";
import { normalizeGeometry, type AreaGeometry } from "./geometry";
import { idbGet, idbSet } from "../state/idb";

export interface PlaceResult {
  key: string; // e.g. "W123"
  osmType: "N" | "W" | "R";
  osmId: number;
  name: string;
  type: string;
  icon: IconKey;
  locality: string;
  source: "photon" | "nominatim" | "overpass";
}

export interface Outline extends PlaceResult {
  geometry: AreaGeometry;
}

export class ServiceError extends Error {}

// ---------- Nominatim queue ----------
let last = 0;
let chain: Promise<unknown> = Promise.resolve();
export function nominatim<T>(path: string, signal?: AbortSignal): Promise<T> {
  const run = async () => {
    const wait = Math.max(0, last + 1100 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    last = Date.now();
    const res = await fetch(`${NOMINATIM}${path}`, { signal, headers: { "Accept-Language": navigator.language || "en" } });
    if (res.status === 429) throw new ServiceError("The place search service is busy. Try again in a few seconds.");
    if (!res.ok) throw new ServiceError("The place search service didn't answer. Try again.");
    return (await res.json()) as T;
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p as Promise<T>;
}

function localityOf(addr: Record<string, string> | undefined, exclude: string): string {
  if (!addr) return "";
  const parts = [
    addr.city || addr.town || addr.village || addr.suburb || addr.county,
    addr.state || addr.region,
    addr.country,
  ].filter((p): p is string => !!p && p !== exclude);
  return [...new Set(parts)].slice(0, 2).join(", ");
}

interface NominatimPlace {
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  name?: string;
  display_name: string;
  category?: string;
  class?: string;
  type: string;
  addresstype?: string;
  address?: Record<string, string>;
  geojson?: { type: string; coordinates: unknown };
}

const T = { node: "N", way: "W", relation: "R" } as const;

function fromNominatim(p: NominatimPlace): PlaceResult {
  const name = p.name || p.display_name.split(",")[0];
  const d = describeFeature(p.category || p.class, p.type, p.addresstype);
  return {
    key: `${T[p.osm_type]}${p.osm_id}`,
    osmType: T[p.osm_type],
    osmId: p.osm_id,
    name,
    type: d.type,
    icon: d.icon,
    locality: localityOf(p.address, name) || p.display_name.split(",").slice(1, 3).join(",").trim(),
    source: "nominatim",
  };
}

/** Full search, used when Enter is pressed with nothing highlighted. */
export async function searchPlaces(q: string, near?: [number, number], signal?: AbortSignal): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q, format: "jsonv2", addressdetails: "1", limit: "12" });
  if (near) {
    const [lng, lat] = near;
    params.set("viewbox", `${lng - 2},${lat + 2},${lng + 2},${lat - 2}`);
  }
  const data = await nominatim<NominatimPlace[]>(`/search?${params}`, signal);
  return dedupe(data.filter((p) => p.osm_type !== "node" || p.addresstype !== "house").map(fromNominatim));
}

function dedupe(list: PlaceResult[]) {
  const seen = new Set<string>();
  return list.filter((r) => (seen.has(r.key) ? false : (seen.add(r.key), true)));
}

const PHOTON_LANGS = ["en", "de", "fr"];

// Country names in the reader's language, from the browser.
let regions: { names: Intl.DisplayNames; all: [code: string, folded: string][] } | undefined;
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
function regionNames() {
  if (!regions) {
    const names = new Intl.DisplayNames([navigator.language || "en"], { type: "region", fallback: "none" });
    const all: [string, string][] = [];
    for (let a = 65; a <= 90; a++)
      for (let b = 65; b <= 90; b++) {
        const code = String.fromCharCode(a, b);
        const name = names.of(code);
        if (name) all.push([code, fold(name)]);
      }
    regions = { names, all };
  }
  return regions;
}

/**
 * Photon only knows names in English, German and French, so for anyone else "Alemanha" finds
 * bars called Alemanha rather than Germany. The browser knows every country's name in the reader's
 * language, so a query that names a country also searches for it by its English name.
 */
function countriesNamed(q: string): string[] {
  const f = fold(q);
  if (f.length < 3) return [];
  const english = new Intl.DisplayNames(["en"], { type: "region" });
  return regionNames().all.filter(([, name]) => name.startsWith(f)).slice(0, 2).map(([code]) => english.of(code)!);
}

async function photon(params: URLSearchParams, signal?: AbortSignal) {
  const res = await fetch(`${PHOTON}?${params}`, { signal });
  if (!res.ok) return [];
  return ((await res.json()).features || []) as { properties: Record<string, string | number> }[];
}

/** Type-ahead suggestions from Photon. */
export async function suggestPlaces(q: string, near?: [number, number], signal?: AbortSignal): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ q, limit: "8" });
  if (near) {
    params.set("lon", near[0].toFixed(3));
    params.set("lat", near[1].toFixed(3));
  }
  const lang = (navigator.language || "en").slice(0, 2);
  const supported = PHOTON_LANGS.includes(lang);
  if (supported) params.set("lang", lang);
  const countries = supported ? [] : countriesNamed(q);
  const [main, ...named] = await Promise.all([
    photon(params, signal),
    ...countries.map((c) => photon(new URLSearchParams({ q: c, limit: "1", lang: "en", osm_tag: "place:country" }), signal)),
  ]);
  const { names } = regionNames();
  // Photon gives country names in English or the local language; show the reader's instead.
  const country = (p: Record<string, string | number>) => (p.countrycode && names.of(String(p.countrycode))) || p.country;
  return dedupe(
    [...named.flat(), ...main].map((f) => {
      const p = f.properties;
      const osmType = String(p.osm_type) as "N" | "W" | "R";
      const name = String((p.osm_value === "country" && country(p)) || p.name || p.street || "");
      const d = describeFeature(String(p.osm_key), String(p.osm_value), String(p.type || ""));
      const locality = [p.city, p.state, country(p)].filter((x) => x && x !== name).slice(0, 2).join(", ");
      // Streets, rivers and railways are lines with no area to compare.
      const lineKey = ["highway", "railway", "waterway", "route", "power"].includes(String(p.osm_key)) || p.type === "street";
      return { key: `${osmType}${p.osm_id}`, osmType, osmId: Number(p.osm_id), name, type: d.type, icon: d.icon, locality, source: "photon", lineKey } as PlaceResult & { lineKey: boolean };
    }).filter((r: PlaceResult & { lineKey?: boolean }) => r.name && !r.lineKey)
  );
}

function threshold(r: PlaceResult) {
  if (["Country", "State", "Province", "Region"].includes(r.type)) return 0.005;
  if (["County", "City", "Town", "Municipality", "District"].includes(r.type)) return 0.0005;
  return 0;
}

/** Fetch the outline of a place. Nodes (e.g. city points) fall back to a name search for their boundary. */
export async function fetchOutline(r: PlaceResult, signal?: AbortSignal): Promise<Outline> {
  const cacheKey = `outline:${r.key}`;
  const cached = await idbGet<AreaGeometry>(cacheKey);
  if (cached) return { ...r, geometry: cached };

  let geometry: AreaGeometry | null = null;
  let resolved = r;
  if (r.osmType !== "N") {
    const data = await nominatim<NominatimPlace[]>(
      `/lookup?osm_ids=${r.key}&format=jsonv2&polygon_geojson=1&polygon_threshold=${threshold(r)}&addressdetails=1`,
      signal
    );
    geometry = normalizeGeometry(data[0]?.geojson);
  } else {
    const q = [r.name, r.locality].filter(Boolean).join(", ");
    const data = await nominatim<NominatimPlace[]>(
      `/search?q=${encodeURIComponent(q)}&format=jsonv2&polygon_geojson=1&polygon_threshold=0.0005&addressdetails=1&limit=5`,
      signal
    );
    const hit = data.find((p) => normalizeGeometry(p.geojson) && (p.name || "").toLowerCase() === r.name.toLowerCase()) || data.find((p) => normalizeGeometry(p.geojson));
    if (hit) {
      geometry = normalizeGeometry(hit.geojson);
      resolved = { ...fromNominatim(hit), name: r.name, type: r.type, icon: r.icon, locality: r.locality || fromNominatim(hit).locality };
    }
  }
  if (!geometry) throw new ServiceError("This place is only mapped as a point, so it has no outline to compare. Try Pick on map or Create a shape.");
  idbSet(`outline:${resolved.key}`, geometry);
  return { ...resolved, geometry };
}

// ---------- What's here (Overpass) ----------
interface OverpassEl { type: "way" | "relation"; id: number; tags?: Record<string, string> }

const KEY_ORDER = ["building", "amenity", "leisure", "tourism", "shop", "historic", "man_made", "aeroway", "natural", "water", "landuse", "place", "boundary"];

/**
 * What's under a point, from smallest to largest. Nominatim reverse lookups at
 * several detail levels (building → country) arrive one per second and are
 * reported as they come in; Overpass adds nearby features when it answers in time.
 */
export async function whatsHere(
  lng: number,
  lat: number,
  signal: AbortSignal | undefined,
  onUpdate: (r: { here: PlaceResult[]; inside: PlaceResult[] }) => void
): Promise<{ here: PlaceResult[]; inside: PlaceResult[] }> {
  const found = new Map<string, PlaceResult & { rank: number; enclosing: boolean }>();
  const emit = () => {
    const all = [...found.values()].sort((a, b) => a.rank - b.rank);
    const r = { here: all.filter((x) => !x.enclosing), inside: all.filter((x) => x.enclosing) };
    onUpdate(r);
    return r;
  };

  const overpass = overpassNearby(lng, lat, signal)
    .then((els) => {
      for (const r of organize(els)) if (!found.has(r.key)) found.set(r.key, r);
      emit();
    })
    .catch(() => undefined);

  let errors = 0;
  for (const zoom of [18, 16, 14, 10, 5, 3]) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const p = await nominatim<NominatimPlace & { error?: string; place_rank?: number }>(
        `/reverse?lat=${lat}&lon=${lng}&zoom=${zoom}&format=jsonv2&polygon_geojson=1&polygon_threshold=${zoom <= 5 ? 0.005 : zoom <= 10 ? 0.0005 : 0}&addressdetails=1`,
        signal
      );
      const geometry = normalizeGeometry(p.geojson);
      if (!p.error && geometry) {
        const r = fromNominatim(p);
        if (!found.has(r.key)) {
          idbSet(`outline:${r.key}`, geometry);
          const rank = (p.place_rank ?? 30) < 26 ? 100 - (p.place_rank ?? 0) : r.icon === "building" ? 0 : 5;
          found.set(r.key, { ...r, rank, enclosing: (p.place_rank ?? 30) < 26 });
          emit();
        }
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      errors++;
    }
  }
  await Promise.race([overpass, new Promise((r) => setTimeout(r, 1500))]);
  if (!found.size && errors >= 3) throw new ServiceError("The map lookup service is busy. Try again in a few seconds.");
  return emit();
}

async function overpassNearby(lng: number, lat: number, signal?: AbortSignal): Promise<OverpassEl[]> {
  const q = `[out:json][timeout:10];
is_in(${lat},${lng})->.a;
(way(pivot.a)[!"boundary"];relation(pivot.a)[!"boundary"];);
out tags;
way(around:12,${lat},${lng})[~"^(building|leisure|amenity|tourism|landuse|natural|man_made|historic|shop|aeroway|water)$"~"."];
out tags;`;
  for (const server of OVERPASS_SERVERS) {
    try {
      const timeout = AbortSignal.timeout(9000);
      const res = await fetch(server, {
        method: "POST",
        body: `data=${encodeURIComponent(q)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
      });
      if (!res.ok) continue;
      return ((await res.json()) as { elements: OverpassEl[] }).elements;
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return [];
}

function organize(els: OverpassEl[]) {
  const seen = new Set<string>();
  const results: (PlaceResult & { rank: number; enclosing: boolean })[] = [];
  els.forEach((el, idx) => {
    const tags = el.tags || {};
    if (!tags.name && !tags.building && !tags.leisure && !tags.amenity) return;
    const key = KEY_ORDER.find((k) => tags[k]);
    if (!key) return;
    const id = `${el.type === "way" ? "W" : "R"}${el.id}`;
    if (seen.has(id)) return;
    seen.add(id);
    const admin = tags.boundary === "administrative" ? Number(tags.admin_level || 10) : 0;
    const addresstype = admin ? ({ 2: "country", 4: "state", 6: "county", 8: "city", 10: "suburb" } as Record<number, string>)[admin] || "district" : tags.place;
    const d = describeFeature(key, tags[key], addresstype);
    results.push({
      key: id,
      osmType: id[0] as "W" | "R",
      osmId: el.id,
      name: tags.name || d.type,
      type: d.type,
      icon: d.icon,
      locality: "",
      source: "overpass",
      rank: admin ? 100 - admin : KEY_ORDER.indexOf(key) + (tags.name ? 0 : 0.5),
      enclosing: idx < els.length && admin > 0,
    });
  });
  return results;
}
