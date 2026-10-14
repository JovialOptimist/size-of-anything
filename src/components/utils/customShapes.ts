// src/components/utils/customShapes.ts
/**
 * Custom circle/square shapes: unit tables, feature builders, and a parser for
 * typed queries like "2 km circle" or "40 acre square".
 */
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { countCoordinates } from "./geometryUtils";

export const LENGTH_CONVERSIONS: Record<string, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  ft: 0.3048,
};

export const AREA_CONVERSIONS: Record<string, number> = {
  m2: 1,
  km2: 1_000_000,
  acres: 4046.85642,
  hectares: 10_000,
  miles2: 2_589_988.110336,
  ft2: 0.09290304, // 1 ft² in m²
};

/**
 * Creates a square GeoJSON feature centered at the given coordinates
 * @param center The center coordinates [lat, lng]
 * @param sideLength The side length in meters
 * @param name The name for the feature
 */
export const createSquareFeature = (
  center: [number, number],
  sideLength: number,
  name: string
): GeoJSONFeature => {
  const [centerLat, centerLng] = center;

  // Calculate lat/lng offsets (approximate)
  // 111,320 meters = 1 degree latitude
  // 111,320 * cos(latitude) meters = 1 degree longitude
  const latOffset = sideLength / (2 * 111320);
  const lngOffset =
    sideLength / (2 * 111320 * Math.cos((centerLat * Math.PI) / 180));

  // Calculate the four corners of the square
  const coordinates = [
    [centerLng - lngOffset, centerLat - latOffset], // SW
    [centerLng + lngOffset, centerLat - latOffset], // SE
    [centerLng + lngOffset, centerLat + latOffset], // NE
    [centerLng - lngOffset, centerLat + latOffset], // NW
    [centerLng - lngOffset, centerLat - latOffset], // Close the polygon
  ];

  // Create the GeoJSON feature
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
      coordinateCount: countCoordinates(coordinates),
    },
    properties: {
      name,
      whatIsIt: name,
      osmType: "custom-square",
      osmId: null,
      customId: `custom-square-${Math.random().toString(36).slice(2)}`,
      osmClass: "custom-shape",
    },
  };
};

/**
 * Creates a circle GeoJSON feature centered at the given coordinates
 * @param center The center coordinates [lat, lng]
 * @param radius The radius in meters
 * @param name The name for the feature
 */
export const createCircleFeature = (
  center: [number, number],
  radius: number,
  name: string
): GeoJSONFeature => {
  const [centerLat, centerLng] = center;
  const coordinates = [];

  // Create a circle approximation with 64 points for smoothness
  const numPoints = 256;
  for (let i = 0; i <= numPoints; i++) {
    // Calculate point at current angle (in radians)
    const angle = (i * 2 * Math.PI) / numPoints;

    // Calculate offsets, accounting for Earth's curvature
    // 111,320 meters = 1 degree latitude
    const latOffset = (radius * Math.sin(angle)) / 111320;
    // Longitude degrees get smaller as you move away from the equator
    const lngOffset =
      (radius * Math.cos(angle)) /
      (111320 * Math.cos((centerLat * Math.PI) / 180));

    // Add the point to our coordinates array
    coordinates.push([centerLng + lngOffset, centerLat + latOffset]);
  }

  // Create the GeoJSON feature (note: first and last points must be identical to close the polygon)
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [coordinates],
      coordinateCount: countCoordinates(coordinates),
    },
    properties: {
      name,
      whatIsIt: name,
      osmType: "custom-circle",
      osmId: null,
      customId: `custom-circle-${Math.random().toString(36).slice(2)}`,
      osmClass: "custom-shape",
    },
  };
};

const UNIT_ALIASES: Record<string, string> = {
  m: "m", meter: "m", meters: "m", metre: "m", metres: "m",
  km: "km", kilometer: "km", kilometers: "km", kilometre: "km", kilometres: "km",
  mi: "mi", mile: "mi", miles: "mi",
  ft: "ft", foot: "ft", feet: "ft",
  m2: "m2", "m²": "m2", sqm: "m2",
  km2: "km2", "km²": "km2", sqkm: "km2",
  ft2: "ft2", "ft²": "ft2", sqft: "ft2",
  mi2: "miles2", "mi²": "miles2", sqmi: "miles2",
  acre: "acres", acres: "acres", ac: "acres",
  ha: "hectares", hectare: "hectares", hectares: "hectares",
};

const UNIT_LABELS: Record<string, string> = {
  m: "m", km: "km", mi: "mi", ft: "ft",
  m2: "m²", km2: "km²", ft2: "ft²", miles2: "mi²", acres: "acres", hectares: "hectares",
};

export interface ParsedCustomShape {
  shape: "circle" | "square";
  value: number;
  unit: string;
  isArea: boolean;
  label: string;
  description: string;
}

/**
 * Parse "2 km circle", "500m square", "40 acres", "1 sq mi circle".
 * Returns null when the text doesn't look like a custom shape.
 */
export function parseCustomShapeQuery(text: string): ParsedCustomShape | null {
  const cleaned = text.trim().toLowerCase().replace(/sq\.?\s*(km|mi|ft|m)\b/, "sq$1");
  const match = cleaned.match(/^([\d.,]+)\s*([a-z²0-9]+)\s*(circle|square)?$/);
  if (!match) return null;
  const value = parseFloat(match[1].replace(/,/g, ""));
  const unit = UNIT_ALIASES[match[2]];
  if (!unit || !(value > 0)) return null;
  const shape = (match[3] as "circle" | "square") || "circle";
  const isArea = unit in AREA_CONVERSIONS && !(unit in LENGTH_CONVERSIONS);
  const unitLabel = UNIT_LABELS[unit];
  const label = isArea
    ? `${value} ${unitLabel} ${shape}`
    : shape === "circle"
      ? `${value} ${unitLabel} radius circle`
      : `${value} ${unitLabel} square`;
  const description = isArea
    ? `${shape === "circle" ? "Circle" : "Square"} with an area of ${value} ${unitLabel}`
    : shape === "circle"
      ? `Radius ${value} ${unitLabel}`
      : `Side length ${value} ${unitLabel}`;
  return { shape, value, unit, isArea, label, description };
}

/** Build a feature for a parsed custom shape centred on [lat, lng]. */
export function buildCustomShapeFeature(
  parsed: ParsedCustomShape,
  center: [number, number]
): GeoJSONFeature {
  if (parsed.isArea) {
    const areaInM2 = parsed.value * AREA_CONVERSIONS[parsed.unit];
    return parsed.shape === "circle"
      ? createCircleFeature(center, Math.sqrt(areaInM2 / Math.PI), parsed.label)
      : createSquareFeature(center, Math.sqrt(areaInM2), parsed.label);
  }
  const meters = parsed.value * LENGTH_CONVERSIONS[parsed.unit];
  return parsed.shape === "circle"
    ? createCircleFeature(center, meters, parsed.label)
    : createSquareFeature(center, meters, parsed.label);
}
