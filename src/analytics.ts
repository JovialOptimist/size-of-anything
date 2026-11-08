/**
 * Usage stats with Google Analytics 4 and Google's consent mode.
 *
 * - Off unless GA_MEASUREMENT_ID is set in config.ts. Only the live site sends anything, so dev
 *   servers and Netlify deploy previews stay out of the numbers.
 * - Nothing loads for anyone who said no, or whose browser sends Global Privacy Control.
 * - Anyone whose time zone is in Europe is asked first, and nothing loads until they say yes.
 *   In case that guess misses, Google also holds back cookies for EU, UK and Swiss visitors
 *   (by IP address) unless they've said yes.
 * - Only what's passed to track() is sent: never search text or shape names.
 *
 * To check events in GA's DebugView from any host (localhost included), run this in the console
 * and reload: localStorage.setItem("soa-stats-debug", "1")
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { GA_MEASUREMENT_ID, SITE_HOST } from "./config";

export const STATS_CONFIGURED = GA_MEASUREMENT_ID !== "";

/** The EU and EEA (with the EU's overseas regions), the UK and Switzerland: consent first. */
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
  "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH", "GF", "GP", "MQ", "RE", "YT", "MF",
  "AX",
];

/** Time zones in those places, plus some neighbours: asking a few extra people is fine, missing some isn't. */
const EUROPE_TZ =
  /^(Europe|Arctic)\/|^Atlantic\/(Azores|Madeira|Canary|Reykjavik|Faroe|Faeroe)$|^Asia\/(Nicosia|Famagusta)$|^Africa\/Ceuta$|^America\/(Cayenne|Guadeloupe|Martinique|Marigot)$|^Indian\/(Reunion|Mayotte)$/;

function inEurope(): boolean {
  try {
    return EUROPE_TZ.test(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
  } catch {
    return false;
  }
}

const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
const europe = inEurope();
/** Counted unless they say no: outside Europe, with no Global Privacy Control. */
const countByDefault = !gpc && !europe;

type Choice = "yes" | "no" | null;

interface StatsState {
  /** What this person said, in the prompt or in Settings. */
  choice: Choice;
  /** The one-time "Count your visit?" prompt is waiting. */
  prompt: boolean;
  /**
   * Google is holding back cookies for this visit by IP address (an EU, UK or Swiss visitor whose
   * time zone isn't European), so they aren't counted until they say yes. Found out each visit.
   */
  regionDenied: boolean;
  /** Remembered for good: "no" (No thanks, or closing the prompt) is never asked again. */
  choose: (c: "yes" | "no") => void;
}

// Kept apart from settings, so "Reset settings" never quietly turns stats back on.
export const useStats = create<StatsState>()(
  persist(
    (set) => ({ choice: null, prompt: false, regionDenied: false, choose: (choice) => set({ choice, prompt: false }) }),
    { name: "soa-stats", partialize: (s) => ({ choice: s.choice }) }
  )
);

type Consent = Pick<StatsState, "choice" | "regionDenied">;
/** Whether this visit is counted (or would be, on the live site). */
export const isCounted = (s: Consent) => s.choice === "yes" || (s.choice === null && countByDefault && !s.regionDenied);

const debug = (() => {
  try {
    return localStorage.getItem("soa-stats-debug") === "1";
  } catch {
    return false;
  }
})();
const live = location.hostname === SITE_HOST || debug;

const w = window as unknown as Record<string, unknown> & { dataLayer?: unknown[] };
/** GA's own off switch: while it's true, gtag.js sends nothing. */
const DISABLE = `ga-disable-${GA_MEASUREMENT_ID}`;
let loaded = false;

function gtag(...args: unknown[]): void;
function gtag() {
  // gtag.js only reads `arguments` objects from its queue, not arrays.
  // eslint-disable-next-line prefer-rest-params
  (w.dataLayer ??= []).push(arguments);
}

function load(granted: boolean) {
  loaded = true;
  const noAds = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
  gtag("consent", "default", { ...noAds, analytics_storage: "denied", region: CONSENT_REGIONS });
  gtag("consent", "default", { ...noAds, analytics_storage: "granted" });
  // Before config, so the first page view already counts.
  if (granted) gtag("consent", "update", { analytics_storage: "granted" });
  gtag("js", new Date());
  // Share links hold the whole comparison in ?c=…, which would swamp the page reports. Only that
  // goes: campaign tags (utm_*, gclid) stay, since GA reads them from this URL.
  const page = new URL(location.href);
  page.searchParams.delete("c");
  page.hash = "";
  gtag("config", GA_MEASUREMENT_ID, {
    page_location: page.toString(),
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(debug && { debug_mode: true }),
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  if (!granted) s.onload = watchRegionDefault;
  document.head.appendChild(s);
}

const hasGaCookie = () => document.cookie.split("; ").some((c) => c.startsWith("_ga="));

/**
 * Counted by default, but Google may still hold back cookies by IP address (see CONSENT_REGIONS).
 * Its tag only writes _ga when cookies are allowed, so if none turns up a few seconds after it loads,
 * Google treats this visitor as needing consent: stop counting and ask them, like other Europeans.
 */
function watchRegionDefault() {
  let tries = 0;
  const check = () => {
    if (useStats.getState().choice !== null || hasGaCookie()) return;
    if (++tries < 8) setTimeout(check, 500);
    else useStats.setState({ regionDenied: true, prompt: true });
  };
  setTimeout(check, 500);
}

function clearCookies() {
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of ["", `; domain=${location.hostname}`]) document.cookie = `${name}=; max-age=0; path=/${domain}`;
  }
}

function sync({ choice, regionDenied }: Consent) {
  if (!isCounted({ choice, regionDenied })) {
    w[DISABLE] = true;
    if (loaded) gtag("consent", "update", { analytics_storage: "denied" });
    clearCookies();
    return;
  }
  w[DISABLE] = false;
  if (!loaded) load(choice === "yes");
  else if (choice === "yes") gtag("consent", "update", { analytics_storage: "granted" });
}

/** Send an event, if this visit is counted. */
export function track(event: string, params: Record<string, string | number> = {}) {
  if (import.meta.env.DEV) console.debug("[stats]", event, params);
  if (loaded && isCounted(useStats.getState())) gtag("event", event, params);
}

export type AddMethod = "search" | "pick" | "object" | "create" | "draw" | "example";
/**
 * A shape went on the map (called from the add actions in src/ui/actions.ts). `object` is the
 * reference object's id, never a place or shape name. Try examples aren't sent: try_example covers them.
 */
export function trackAdd(method: AddMethod, object?: string) {
  if (method === "example") return;
  track("add_shape", object ? { method, object } : { method });
}

export function initStats() {
  if (!STATS_CONFIGURED) return;
  if (import.meta.env.DEV) (window as unknown as { __soaStats: unknown }).__soaStats = useStats;
  const { choice } = useStats.getState();
  if (choice === null && europe && !gpc) useStats.setState({ prompt: true });
  // A choice made in another tab applies here too (persist doesn't watch other tabs itself).
  window.addEventListener("storage", async (e) => {
    if (e.key !== "soa-stats") return;
    await useStats.persist.rehydrate();
    if (useStats.getState().choice !== null) useStats.setState({ prompt: false });
  });
  if (!live) return;
  sync(useStats.getState());
  useStats.subscribe((s, p) => {
    if (s.choice !== p.choice || s.regionDenied !== p.regionDenied) sync(s);
  });
}
