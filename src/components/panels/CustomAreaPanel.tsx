import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import {
  LENGTH_CONVERSIONS,
  AREA_CONVERSIONS,
  createCircleFeature,
  createSquareFeature,
} from "../utils/customShapes";
import { CircleShapeIcon, SquareShapeIcon } from "../ui/Icons";

const UNIT_OPTIONS: { value: string; label: string; kind: "length" | "area" }[] = [
  { value: "m", label: "m", kind: "length" },
  { value: "km", label: "km", kind: "length" },
  { value: "mi", label: "mi", kind: "length" },
  { value: "ft", label: "ft", kind: "length" },
  { value: "m2", label: "m²", kind: "area" },
  { value: "km2", label: "km²", kind: "area" },
  { value: "ft2", label: "ft²", kind: "area" },
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

  // Button label: "Place a {description} here"
  const placeButtonLabel = (() => {
    const label = currentUnitOption.label;
    const val = value.trim() || "0";
    if (isArea) {
      return shapeType === "circle"
        ? `Place a ${val} ${label} circle here`
        : `Place a ${val} ${label} square here`;
    }
    if (shapeType === "circle") {
      return `Place a circle with a radius of ${val} ${label} here`;
    }
    return `Place a square with ${val} ${label} sidelengths here`;
  })();

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
        name = `${value} ${label} Circle`;
        feature = createCircleFeature(currentMapCenter, radius, name);
      } else {
        const side = Math.sqrt(areaInM2);
        name = `${value} ${label} Square`;
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

  return (
    <div className="panel custom-area-panel">
      <div className="custom-area-form custom-area-form-compact">
        <div className="custom-area-segmented">
          <button
            type="button"
            className={shapeType === "circle" ? "active" : ""}
            onClick={() => setShapeType("circle")}
          >
            <CircleShapeIcon className="custom-area-segmented-icon" />
            <span>Circle</span>
          </button>
          <button
            type="button"
            className={shapeType === "square" ? "active" : ""}
            onClick={() => setShapeType("square")}
          >
            <SquareShapeIcon className="custom-area-segmented-icon" />
            <span>Square</span>
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
            <optgroup label="Length">
              {UNIT_OPTIONS.filter((o) => o.kind === "length").map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Area">
              {UNIT_OPTIONS.filter((o) => o.kind === "area").map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          </select>
        </div>
        <button type="button" className="custom-area-place-btn" onClick={placeHere}>
          {placeButtonLabel}
        </button>
      </div>
    </div>
  );
};

export default CustomAreaPanel;
