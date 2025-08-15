import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import { OSM_Type, type GeoJSONFeature } from "../../state/mapStoreTypes";
import { InformationBubble } from "../ui/informationBubble";
import { DismissableMessage } from "../ui/DismissableMessage";
import { countCoordinates } from "../utils/geometryUtils";

/**
 * Panel for custom area functionality
 * Allows users to create square areas of specific sizes
 */
const CustomAreaPanel: React.FC = () => {
  const [areaValue, setAreaValue] = useState<string>("1");
  const [areaUnit, setAreaUnit] = useState<string>("km2");
  const currentMapCenter = useMapStore((state) => state.currentMapCenter);
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );

  // Define conversion factors to square meters
  const unitConversions: Record<string, number> = {
    m2: 1,
    km2: 1000000, // 1 km² = 1,000,000 m²
    acres: 4046.85642, // 1 acre = 4046.85642 m²
    hectares: 10000, // 1 hectare = 10,000 m²
    miles2: 2589988.110336, // 1 mile² = 2,589,988.110336 m²
  };

  // Unit labels for display
  const unitLabels: Record<string, string> = {
    m2: "m²",
    km2: "km²",
    acres: "acres",
    hectares: "hectares",
    miles2: "miles²",
  };

  /**
   * Creates a square GeoJSON feature centered at the current map center
   */
  const generateCustomArea = () => {
    if (!currentMapCenter) return;

    // Parse area value and convert to square meters
    const numericValue = parseFloat(areaValue);
    if (isNaN(numericValue) || numericValue <= 0) {
      alert("Please enter a valid positive number");
      return;
    }

    const areaInSquareMeters = numericValue * unitConversions[areaUnit];

    // Calculate the side length of the square (in meters)
    const sideLength = Math.sqrt(areaInSquareMeters);

    // Create a square centered at the current map center
    const feature = createSquareFeature(
      currentMapCenter,
      sideLength,
      `${areaValue} ${unitLabels[areaUnit]}`
    );

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
        whatIsIt: `Custom ${areaUnit} square`,
        osmType: OSM_Type.WAY,
        osmId: null, // Not an OSM object
        customId: `square-${Math.random().toString(36).slice(2)}`, // Consistent prefix for square shapes
        osmClass: `custom-square-${areaUnit}`, // Classification by type and unit
      },
    };
  };

  return (
    <div className="panel custom-area-panel">
      <div className="panel-header">
        <h2>
          Custom Area<span className="keybind-text">C</span>
        </h2>

        <InformationBubble message="Create a square area of a specific size. Enter the size and select the unit, then click Generate to place it on the map. The outline will morph as it is moved around the map to account for projection artifacts." />
      </div>
      <div className="panel-description">
        Create a square representing a certain size.
      </div>

      <div className="custom-area-form">
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
          onClick={generateCustomArea}
          tabIndex={0}
        >
          Generate
        </button>
      </div>

      <DismissableMessage messageId="custom-area-center-info">
        <p>
          The square area will be placed at the center of your current map view.
        </p>
      </DismissableMessage>
    </div>
  );
};

export default CustomAreaPanel;
