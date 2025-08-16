import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { InformationBubble } from "../ui/informationBubble";
import { DismissableMessage } from "../ui/DismissableMessage";
import { countCoordinates } from "../utils/geometryUtils";

/**
 * Panel for custom area functionality
 * Allows users to create shapes by area or by length/radius
 */
const CustomAreaPanel: React.FC = () => {
  // Area panel state
  const [areaValue, setAreaValue] = useState<string>("1");
  const [areaUnit, setAreaUnit] = useState<string>("km2");
  const [areaShapeType, setAreaShapeType] = useState<"square" | "circle">(
    "square"
  );

  // Length/Radius panel state
  const [lengthValue, setLengthValue] = useState<string>("1");
  const [lengthUnit, setLengthUnit] = useState<string>("km");
  const [lengthShapeType, setLengthShapeType] = useState<"square" | "circle">(
    "circle"
  );

  // Get current map center and search function from store
  const currentMapCenter = useMapStore((state) => state.currentMapCenter);
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );

  // Define conversion factors to square meters
  const areaConversions: Record<string, number> = {
    m2: 1,
    km2: 1000000, // 1 km² = 1,000,000 m²
    acres: 4046.85642, // 1 acre = 4046.85642 m²
    hectares: 10000, // 1 hectare = 10,000 m²
    miles2: 2589988.110336, // 1 mile² = 2,589,988.110336 m²
  };

  // Define conversion factors to meters
  const lengthConversions: Record<string, number> = {
    m: 1,
    km: 1000, // 1 km = 1,000 m
    mi: 1609.344, // 1 mile = 1609.344 m
    ft: 0.3048, // 1 foot = 0.3048 m
  };

  // Unit labels for display
  const areaLabels: Record<string, string> = {
    m2: "m²",
    km2: "km²",
    acres: "acres",
    hectares: "hectares",
    miles2: "miles²",
  };

  // Length unit labels for display
  const lengthLabels: Record<string, string> = {
    m: "m",
    km: "km",
    mi: "miles",
    ft: "feet",
  };

  /**
   * Creates a shape based on area (either square or circle)
   */
  const generateAreaBasedShape = () => {
    if (!currentMapCenter) return;

    // Parse area value and convert to square meters
    const numericValue = parseFloat(areaValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      alert("Please enter a valid positive area");
      return;
    }

    const areaInSquareMeters = numericValue * areaConversions[areaUnit];

    // Generate appropriate shape based on type
    let feature: GeoJSONFeature;
    if (areaShapeType === "square") {
      // For square, calculate side length from area
      const sideLength = Math.sqrt(areaInSquareMeters);
      feature = createSquareFeature(
        currentMapCenter,
        sideLength,
        `Square area: ${areaValue} ${areaLabels[areaUnit]}`
      );
    } else {
      // For circle, calculate radius from area (A = πr²)
      const radius = Math.sqrt(areaInSquareMeters / Math.PI);
      feature = createCircleFeature(
        currentMapCenter,
        radius,
        `Circle area: ${areaValue} ${areaLabels[areaUnit]}`
      );
    }

    // Add the feature to the map
    if (feature) {
      addGeoJSONFromSearch(feature);
    }
  };

  /**
   * Creates a shape based on length/radius (either square or circle)
   */
  const generateLengthBasedShape = () => {
    if (!currentMapCenter) return;

    // Parse length value and convert to meters
    const numericValue = parseFloat(lengthValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      alert("Please enter a valid positive length");
      return;
    }

    const lengthInMeters = numericValue * lengthConversions[lengthUnit];

    // Generate appropriate shape based on type
    let feature: GeoJSONFeature;
    if (lengthShapeType === "square") {
      // For square, use length as side length
      feature = createSquareFeature(
        currentMapCenter,
        lengthInMeters,
        `Square sidelength: ${lengthValue} ${lengthLabels[lengthUnit]}`
      );
    } else {
      // For circle, use length as radius
      feature = createCircleFeature(
        currentMapCenter,
        lengthInMeters,
        `Circle radius: ${lengthValue} ${lengthLabels[lengthUnit]}`
      );
    }

    // Add the feature to the map
    if (feature) {
      addGeoJSONFromSearch(feature);
    }
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
      <div className="panel-header">
        <h2>
          Custom Area<span className="keybind-text">C</span>
        </h2>

        <InformationBubble message="Create custom shapes by specifying either an area or dimensions." />
      </div>

      {/* Area-based panel */}
      <div className="sub-panel">
        <div className="panel-description">
          Create a shape with a specific area.
        </div>

        <div className="custom-area-form">
          {/* Shape type selector */}
          <div className="form-group">
            <div className="input-with-unit">
              <select
                id="area-shape-type"
                value={areaShapeType}
                onChange={(e) =>
                  setAreaShapeType(e.target.value as "square" | "circle")
                }
                className="unit-select"
                style={{ width: "100%" }}
                tabIndex={0}
              >
                <option value="square">Square</option>
                <option value="circle">Circle</option>
              </select>
            </div>
          </div>

          {/* Area input */}
          <div className="form-group">
            <div className="input-with-unit">
              <input
                id="area-value"
                type="number"
                min="0.001"
                step="0.001"
                value={areaValue}
                onChange={(e) => setAreaValue(e.target.value)}
                className="area-input"
                placeholder="Area"
              />

              <select
                value={areaUnit}
                onChange={(e) => setAreaUnit(e.target.value)}
                className="unit-select"
                tabIndex={0}
              >
                <option value="acres">acres</option>
                <option value="hectares">hectares</option>
                <option value="km2">km²</option>
                <option value="m2">m²</option>
                <option value="miles2">miles²</option>
              </select>
            </div>
          </div>

          <button
            className="generate-area-button"
            onClick={generateAreaBasedShape}
            tabIndex={0}
          >
            Generate by Area
          </button>
        </div>
      </div>

      {/* Length/Radius-based panel */}
      <div className="sub-panel" style={{ marginTop: "20px" }}>
        <div className="panel-description">
          Create a circle or square with a radius or side length.
        </div>

        <div className="custom-area-form">
          {/* Shape type selector */}
          <div className="form-group">
            <div className="input-with-unit">
              <select
                id="length-shape-type"
                value={lengthShapeType}
                onChange={(e) =>
                  setLengthShapeType(e.target.value as "square" | "circle")
                }
                className="unit-select"
                style={{ width: "100%" }}
                tabIndex={0}
              >
                <option value="circle">Circle (Radius)</option>
                <option value="square">Square (Side Length)</option>
              </select>
            </div>
          </div>

          {/* Length/Radius input */}
          <div className="form-group">
            <div className="input-with-unit">
              <input
                id="length-value"
                type="number"
                min="0.001"
                step="0.001"
                value={lengthValue}
                onChange={(e) => setLengthValue(e.target.value)}
                className="area-input"
                placeholder={
                  lengthShapeType === "square" ? "Side Length" : "Radius"
                }
              />

              <select
                value={lengthUnit}
                onChange={(e) => setLengthUnit(e.target.value)}
                className="unit-select"
                tabIndex={0}
              >
                <option value="m">meters</option>
                <option value="km">kilometers</option>
                <option value="mi">miles</option>
                <option value="ft">feet</option>
              </select>
            </div>
          </div>

          <button
            className="generate-area-button"
            onClick={generateLengthBasedShape}
            tabIndex={0}
          >
            Generate by {lengthShapeType === "square" ? "Length" : "Radius"}
          </button>
        </div>
      </div>

      <DismissableMessage messageId="custom-area-center-info">
        <p>All shapes will be placed at the center of your current map view.</p>
      </DismissableMessage>
    </div>
  );
};

export default CustomAreaPanel;
