/**
 * Developer configuration. Change values here, not in components.
 */

/** UI accent preset. Only affects panels and controls, never the map. */
export type AccentPreset = "blue" | "purple" | "teal" | "rose" | "ink";
export const ACCENT: AccentPreset = "purple";

export const ACCENT_PRESETS: Record<AccentPreset, { light: string; dark: string }> = {
  blue: { light: "#245fd4", dark: "#73a3fc" },
  purple: { light: "#6d4ae0", dark: "#b39cff" },
  teal: { light: "#0f7b6c", dark: "#4fd1c5" },
  rose: { light: "#c2255c", dark: "#f783ac" },
  ink: { light: "#1b2026", dark: "#e8ebef" },
};

export const BASEMAPS = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/fiord",
};

/** TileJSON for the basemap's vector tiles; their water layer is used to take water out of outlines. */
export const WATER_TILES = "https://tiles.openfreemap.org/planet";

/**
 * Optional ArcGIS Location Platform key for compliant satellite imagery.
 * Without a key the legacy keyless Esri endpoint is used.
 */
export const ARCGIS_KEY = "";

export const SATELLITE_TILES = ARCGIS_KEY
  ? `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}?token=${ARCGIS_KEY}`
  : "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export const NOMINATIM = "https://nominatim.openstreetmap.org";
export const PHOTON = "https://photon.komoot.io/api/";
export const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

/**
 * Google Analytics 4 measurement ID ("G-XXXXXXXXXX"), from GA's Admin > Data streams.
 * Empty turns analytics off: no script, no consent prompt, no Settings switch.
 * See src/analytics.ts for how consent works.
 */
export const GA_MEASUREMENT_ID: string = "G-CHVRMLE550";
/** The live site. Analytics only sends from here, so local and preview builds aren't counted. */
export const SITE_HOST = "thesizeofanything.com";

/** The previous version of the site, kept for anyone who prefers it. */
export const OLD_VERSION_URL = "https://old.thesizeofanything.com";

export const SUPPORT_URL = "https://buymeacoffee.com/thesizeofanything";
export const CONTACT_EMAIL = "contact@jachambers.xyz";
