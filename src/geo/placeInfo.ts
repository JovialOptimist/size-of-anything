/**
 * Extra information about an OSM place for its detail page: OSM tags (description,
 * height, opening date, website), a Wikipedia summary, and a photo from Wikidata,
 * Wikimedia Commons, OSM's image tag, or Wikipedia, in that order.
 */
import { nominatim } from "./services";
import { idbGet, idbSet } from "../state/idb";

export interface PlaceInfo {
  description?: string;
  /** `words` marks values a translator may translate; the rest are numbers and names. */
  facts: { label: string; value: string; words?: boolean }[];
  website?: string;
  osmUrl: string;
  wikipedia?: { title: string; url: string; extract: string; lang: string };
  photo?: { url: string; credit: string; link: string };
}

const FACTS: [string, string, (v: string) => string][] = [
  ["height", "Height", (v) => (/^[\d.]+$/.test(v) ? `${v} m` : v)],
  ["start_date", "Built", (v) => v],
  ["opening_date", "Opened", (v) => v],
  ["architect", "Architect", (v) => v],
  ["operator", "Run by", (v) => v],
  ["capacity", "Capacity", (v) => Number(v) ? Number(v).toLocaleString() : v],
  ["population", "Population", (v) => Number(v) ? Number(v).toLocaleString() : v],
  ["ele", "Elevation", (v) => (/^[\d.]+$/.test(v) ? `${v} m` : v)],
  ["heritage", "Heritage site", () => "Yes"],
];
const WORDS = new Set(["heritage"]);

/** The reader's languages, as Wikipedia codes, with English as the fallback since the UI is English. */
function readerLanguages() {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language || "en"];
  return [...new Set([...langs, "en"].map((l) => l.split("-")[0].toLowerCase()))];
}

const commonsFile = (file: string) => {
  const name = file.replace(/^File:/i, "");
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=640`,
    credit: "Wikimedia Commons",
    link: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
  };
};

async function json<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal });
    return r.ok ? ((await r.json()) as T) : null;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    return null;
  }
}

export async function fetchPlaceInfo(key: string, signal?: AbortSignal): Promise<PlaceInfo> {
  const langs = readerLanguages();
  // The Wikipedia summary depends on the reader's languages, so they're part of the cache key.
  const cacheKey = `info:${langs.join(",")}:${key}`;
  const cached = await idbGet<PlaceInfo>(cacheKey);
  if (cached) return cached;
  const type = { N: "node", W: "way", R: "relation" }[key[0] as "N"];
  const info: PlaceInfo = { facts: [], osmUrl: `https://www.openstreetmap.org/${type}/${key.slice(1)}` };

  const res = await nominatim<{ extratags?: Record<string, string> }[]>(`/lookup?osm_ids=${key}&format=jsonv2&extratags=1`, signal);
  const tags = res[0]?.extratags || {};
  info.description = tags.description || tags["description:en"];
  info.website = tags.website || tags["contact:website"] || tags.url;
  for (const [k, label, fmt] of FACTS) if (tags[k]) info.facts.push({ label, value: fmt(tags[k]), ...(WORDS.has(k) && { words: true }) });

  // Wikipedia: the article in the reader's language via Wikidata's sitelinks, otherwise the OSM tag's
  // (usually the place's local language).
  let wikiLang = "", wikiTitle = "";
  if (tags.wikipedia?.includes(":")) [wikiLang, wikiTitle] = [tags.wikipedia.split(":")[0], tags.wikipedia.split(":").slice(1).join(":")];
  let wdImage: string | undefined;
  if (tags.wikidata) {
    const wd = await json<{ entities: Record<string, { claims?: Record<string, { mainsnak: { datavalue?: { value: string } } }[]>; sitelinks?: Record<string, { title: string }> }> }>(
      `https://www.wikidata.org/wiki/Special:EntityData/${tags.wikidata}.json`,
      signal
    );
    const ent = wd?.entities?.[tags.wikidata];
    wdImage = ent?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    const lang = langs.find((l) => ent?.sitelinks?.[`${l}wiki`]);
    if (lang) [wikiLang, wikiTitle] = [lang, ent!.sitelinks![`${lang}wiki`].title];
  }
  let wikiThumb: string | undefined;
  if (wikiTitle) {
    const sum = await json<{ extract?: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page: string } }; title: string }>(
      `https://${wikiLang || "en"}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiTitle.replace(/ /g, "_"))}`,
      signal
    );
    if (sum?.extract) info.wikipedia = { title: sum.title, extract: sum.extract, lang: wikiLang || "en", url: sum.content_urls?.desktop?.page || `https://${wikiLang}.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}` };
    wikiThumb = sum?.thumbnail?.source;
  }

  if (wdImage) info.photo = commonsFile(wdImage);
  else if (tags.wikimedia_commons?.startsWith("File:")) info.photo = commonsFile(tags.wikimedia_commons);
  else if (tags.image?.startsWith("https://")) info.photo = { url: tags.image, credit: "OpenStreetMap contributor", link: tags.image };
  else if (wikiThumb) info.photo = { url: wikiThumb, credit: "Wikipedia", link: info.wikipedia?.url || wikiThumb };

  idbSet(cacheKey, info);
  return info;
}
