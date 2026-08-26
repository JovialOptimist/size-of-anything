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
  feature: GeoJSONFeature;
  // Or provide separate geojson data and name
  geojson?: any;
  name?: string;
  // Optional description
  description?: string;
  // Optional icon/image
  iconUrl?: string;
  // "row" (default): icon + name + description in a row, used by Search/History.
  // "tile": icon on top, name below, no description - used by the Special panel's grid.
  variant?: "row" | "tile";
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
  variant = "row",
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
    console.log("Card clicked, adding area:", displayName);
    // If we have a complete feature, use it
    if (feature) {
      // Make sure the location property is preserved when adding from history
      if (feature.properties && !feature.properties.location) {
        // If location is missing but name contains a comma, extract location
        if (feature.properties.name && feature.properties.name.includes(",")) {
          const nameParts = feature.properties.name.split(",");
          feature.properties.name = nameParts[0].trim();
          feature.properties.location = nameParts.slice(1).join(",").trim();
        }
      }
      addGeoJSONFromSearch(feature);
      return;
    }

    // Otherwise, construct a feature from the provided data
    if (geojson) {
      // Check if name contains location information (comma-separated)
      let featureName = name || "Custom Area";
      let featureLocation = "";

      if (feature && (feature as GeoJSONFeature).properties) {
        featureLocation = (feature as GeoJSONFeature).properties.location || "";
      } else if (featureName && featureName.includes(",") && !featureLocation) {
        const nameParts = featureName.split(",");
        featureName = nameParts[0].trim();
        featureLocation = nameParts.slice(1).join(",").trim();
      } else {
        console.warn("Feature location couldn't be found.");
      }

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
          name: featureName,
          location: featureLocation,
          osmType: "custom",
          osmId: null,
          osmClass: "custom",
          whatIsIt: description || "Custom area",
          color: generateRandomColor(),
        },
      };

      console.log("Constructed new feature from props:", newFeature);

      addGeoJSONFromSearch(newFeature);
    }
  };

  return (
    <div
      className={`area-card area-card-${variant}`}
      onClick={handleCardClick}
      tabIndex={0}
      role="button"
      title={variant === "tile" ? displayName : undefined}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleCardClick();
      }}
    >
      {variant === "tile" ? (
        <>
          {iconUrl && (
            <div className="area-card-tile-icon">
              <img src={iconUrl} alt="" />
            </div>
          )}
          <h3 className="area-card-tile-title">{displayName}</h3>
        </>
      ) : (
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
      )}
    </div>
  );
};

export default Card;
