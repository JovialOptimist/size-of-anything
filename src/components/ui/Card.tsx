// src/components/ui/Card.tsx
/**
 * Card component that displays an area with its details and provides 
 * actions for adding it to the map.
 * Used in search results and history panel.
 */
import React from "react";
import { useMapStore } from "../../state/mapStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { generateRandomColor } from "../utils/colorUtils";
import { countCoordinates } from "../utils/geometryUtils";

interface CardProps {
  // Either provide a complete GeoJSONFeature
  feature?: GeoJSONFeature;
  // Or provide separate geojson data and name
  geojson?: any;
  name?: string;
  // Optional description
  description?: string;
  // Optional icon/image
  iconUrl?: string;
}

/**
 * Card component that displays area information and adds it to the map when clicked
 */
const Card: React.FC<CardProps> = ({
  feature,
  geojson,
  name,
  description,
  iconUrl,
}) => {
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );

  // Determine what to display based on props
  const displayName = feature?.properties?.name || name || "Unnamed Area";
  const displayDescription =
    description ||
    feature?.properties?.whatIsIt ||
    feature?.properties?.osmType ||
    "Geographic area";

  // Handle the click event to add the area to the map
  const handleCardClick = () => {
    // If we have a complete feature, use it
    if (feature) {
      addGeoJSONFromSearch(feature);
      return;
    }

    // Otherwise, construct a feature from the provided data
    if (geojson) {
      const newFeature: GeoJSONFeature = {
        type: "Feature",
        geometry: {
          type: Array.isArray(geojson.coordinates[0][0][0])
            ? "MultiPolygon"
            : "Polygon",
          coordinates: geojson.coordinates,
          coordinateCount: countCoordinates(geojson.coordinates),
        },
        properties: {
          name: name || "Custom Area",
          osmType: "custom",
          osmId: null,
          osmClass: "custom",
          whatIsIt: description || "Custom area",
          color: generateRandomColor(),
        },
      };

      addGeoJSONFromSearch(newFeature);
    }
  };

  return (
    <div
      className="area-card"
      onClick={handleCardClick}
      tabIndex={0}
      role="button"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCardClick();
      }}
    >
      <div className="area-card-content">
        {iconUrl && (
          <div className="area-card-icon">
            <img src={iconUrl} alt="" width={24} height={24} />
          </div>
        )}
        <div className="area-card-text">
          <h3 className="area-card-title">{displayName}</h3>
          <p className="area-card-description">{displayDescription}</p>
        </div>
      </div>
    </div>
  );
};

export default Card;
