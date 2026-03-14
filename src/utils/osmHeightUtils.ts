/**
 * Parse OSM tags (e.g. from Nominatim extratags) to get building/feature height in meters.
 * Used to set heightInMeters on features so they render as extruded 3D on the map.
 */

const METERS_PER_LEVEL = 3;

/**
 * Parse height in meters from OSM tags.
 * - Prefers "height" (numeric or "20 m" style).
 * - Falls back to "building:levels" × ~3 m per level.
 * Returns undefined if no height can be determined.
 */
export function parseOsmHeight(tags: Record<string, string> | undefined): number | undefined {
  if (!tags || typeof tags !== "object") return undefined;

  const heightRaw = tags.height ?? tags["building:height"];
  if (heightRaw != null && heightRaw !== "") {
    const parsed = parseHeightString(heightRaw);
    if (parsed != null && parsed > 0) return parsed;
  }

  const levelsRaw = tags["building:levels"];
  if (levelsRaw != null && levelsRaw !== "") {
    const levels = parseInt(levelsRaw, 10);
    if (!isNaN(levels) && levels > 0) return levels * METERS_PER_LEVEL;
  }

  return undefined;
}

/**
 * Parse a height string (e.g. "20", "20 m", "50ft") to meters.
 */
function parseHeightString(s: string): number | undefined {
  const trimmed = String(s).trim().toLowerCase();
  const numMatch = trimmed.match(/^([\d.]+)\s*(m|meters?|ft|feet)?$/);
  if (!numMatch) return undefined;
  const value = parseFloat(numMatch[1]);
  if (isNaN(value) || value <= 0) return undefined;
  const unit = numMatch[2] ?? "m";
  if (unit.startsWith("ft")) return value * 0.3048;
  return value;
}
