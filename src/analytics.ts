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
import { useSettings } from "./state/settings";

export const STATS_CONFIGURED = GA_MEASUREMENT_ID !== "";

/** The EU and EEA (with the EU's overseas regions), the UK and Switzerland: consent first. */
const CONSENT_REGIONS = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT",
  "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB", "CH", "GF", "GP", "MQ", "RE", "YT", "MF",
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
  choose: (c: "yes" | "no") => void;
  /** The prompt was closed without an answer: not counted, and asked again next visit. */
  dismiss: () => void;
}

// Kept apart from settings, so "Reset settings" never quietly turns stats back on.
export const useStats = create<StatsState>()(
  persist(
    (set) => ({
      choice: null,
      prompt: false,
      choose: (choice) => set({ choice, prompt: false }),
      dismiss: () => set({ prompt: false }),
    }),
    { name: "soa-stats", partialize: (s) => ({ choice: s.choice }) }
  )
);

/** Whether this visit is counted (or would be, on the live site). */
export const isCounted = (choice: Choice) => choice === "yes" || (choice === null && countByDefault);

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
  gtag("config", GA_MEASUREMENT_ID, {
    // Share links hold the whole comparison in ?c=…, which would swamp the page reports.
    page_location: location.origin + location.pathname,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    ...(debug && { debug_mode: true }),
  });
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(s);
}

function clearCookies() {
  for (const c of document.cookie.split("; ")) {
    const name = c.split("=")[0];
    if (name !== "_ga" && !name.startsWith("_ga_")) continue;
    for (const domain of ["", `; domain=${location.hostname}`]) document.cookie = `${name}=; max-age=0; path=/${domain}`;
  }
}

function sync(choice: Choice) {
  if (!isCounted(choice)) {
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
  if (loaded && isCounted(useStats.getState().choice)) gtag("event", event, params);
}

export type AddMethod = "search" | "pick" | "object" | "create" | "draw";
/** A shape went on the map. `object` is the reference object's id (never a place or shape name). */
export const trackAdd = (method: AddMethod, object?: string) => track("add_shape", object ? { method, object } : { method });

export function initStats() {
  if (!STATS_CONFIGURED) return;
  if (import.meta.env.DEV) (window as unknown as { __soaStats: unknown }).__soaStats = useStats;
  const { choice } = useStats.getState();
  if (choice === null && europe && !gpc) useStats.setState({ prompt: true });
  useSettings.subscribe((s, p) => {
    if (s.basemap !== p.basemap) track("change_layer", { layer: s.basemap });
    if (s.globe !== p.globe) track("change_layer", { layer: s.globe ? "globe_on" : "globe_off" });
  });
  if (!live) return;
  sync(choice);
  useStats.subscribe((s, p) => {
    if (s.choice !== p.choice) sync(s.choice);
  });
}
