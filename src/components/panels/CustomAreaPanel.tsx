import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { countCoordinates } from "../utils/geometryUtils";

const LENGTH_CONVERSIONS: Record<string, number> = {
  m: 1,
  km: 1000,
  mi: 1609.344,
  ft: 0.3048,
};

const AREA_CONVERSIONS: Record<string, number> = {
  m2: 1,
  km2: 1_000_000,
  acres: 4046.85642,
  hectares: 10_000,
  miles2: 2_589_988.110336,
};

const UNIT_OPTIONS: { value: string; label: string; kind: "length" | "area" }[] = [
  { value: "m", label: "m", kind: "length" },
  { value: "km", label: "km", kind: "length" },
  { value: "mi", label: "mi", kind: "length" },
  { value: "ft", label: "ft", kind: "length" },
  { value: "m2", label: "m²", kind: "area" },
  { value: "km2", label: "km²", kind: "area" },
  { value: "acres", label: "acres", kind: "area" },
  { value: "hectares", label: "hectares", kind: "area" },
  { value: "miles2", label: "mi²", kind: "area" },
];

/**
 * Custom area panel: circle or square; value in length or area (by unit); Place here.
 */
const CustomAreaPanel: React.FC = () => {
  const [shapeType, setShapeType] = useState<"circle" | "square">("circle");
  const [value, setValue] = useState<string>("1");
  const [unit, setUnit] = useState<string>("km");

  const currentMapCenter = useMapStore((state) => state.currentMapCenter);
  const addGeoJSONFromSearch = useMapStore((state) => state.addGeoJSONFromSearch);

  const currentUnitOption = UNIT_OPTIONS.find((o) => o.value === unit) ?? UNIT_OPTIONS[0];
  const isArea = currentUnitOption.kind === "area";

  const placeHere = () => {
    if (!currentMapCenter) return;
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid positive number");
      return;
    }
    const label = currentUnitOption.label;
    let feature: GeoJSONFeature;
    let name: string;
    if (isArea) {
      const areaInM2 = num * AREA_CONVERSIONS[unit];
      if (shapeType === "circle") {
        const radius = Math.sqrt(areaInM2 / Math.PI);
        name = `Circle area: ${value} ${label}`;
        feature = createCircleFeature(currentMapCenter, radius, name);
      } else {
        const side = Math.sqrt(areaInM2);
        name = `Square area: ${value} ${label}`;
        feature = createSquareFeature(currentMapCenter, side, name);
      }
    } else {
      const lengthInMeters = num * LENGTH_CONVERSIONS[unit];
      name =
        shapeType === "circle"
          ? `Circle radius: ${value} ${label}`
          : `Square side: ${value} ${label}`;
      feature =
        shapeType === "square"
          ? createSquareFeature(currentMapCenter, lengthInMeters, name)
          : createCircleFeature(currentMapCenter, lengthInMeters, name);
    }
    addGeoJSONFromSearch(feature);
  };

  /**
   * Creates a square GeoJSON feature centered at the given coordinates
   * @param center The center coordinates [lat, lng]
   * @param sideLength The side length in meters
   * @param name The name for the feature
   */
  const createSquareFeature = (
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
  const createCircleFeature = (
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

  return (
    <div className="panel custom-area-panel">
      <div className="custom-area-form custom-area-form-compact">
        <div className="custom-area-segmented">
          <button
            type="button"
            className={shapeType === "circle" ? "active" : ""}
            onClick={() => setShapeType("circle")}
          >
            Circle
          </button>
          <button
            type="button"
            className={shapeType === "square" ? "active" : ""}
            onClick={() => setShapeType("square")}
          >
            Square
          </button>
        </div>
        <div className="custom-area-input-row">
          <input
            type="number"
            min="0.001"
            step="0.001"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="custom-area-input"
            placeholder={
              isArea
                ? "Area"
                : shapeType === "circle"
                  ? "Radius"
                  : "Side length"
            }
            aria-label={isArea ? "Area" : shapeType === "circle" ? "Radius" : "Side length"}
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="custom-area-unit-select"
            aria-label="Unit"
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="custom-area-place-btn" onClick={placeHere}>
          Place here
        </button>
      </div>
    </div>
  );
};

export default CustomAreaPanel;
