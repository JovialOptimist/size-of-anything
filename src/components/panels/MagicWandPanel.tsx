// src/components/panels/MagicWandPanel.tsx
import { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import GeoCandidatePicker from "../map/GeoCandidatePicker";
import fixMultiPolygon from "../utils/fixMultipolygon";
import { describeOsmObject } from "../utils/describeOsmObject";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import "../../styles/MagicWandPanel.css";
import { InformationBubble } from "../ui/informationBubble";
import { countCoordinates } from "../utils/geometryUtils";

export default function MagicWandPanel() {
  const [candidates, setCandidates] = useState<GeoJSONFeature[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addGeoJSONFromSearch = useMapStore((s) => s.addGeoJSONFromSearch);
  const setOnMapClick = useMapStore((s) => s.setOnMapClick);
  const magicWandMode = useMapStore((s) => s.magicWandMode);

  /**
   * Fetch both nearby features and containing areas using a two-step approach:
   * 1. Use Overpass API to identify candidates
   * 2. Use Nominatim API to get proper GeoJSON for those candidates
   */
  const fetchFeaturesUsingOverpass = async (lat: number, lng: number) => {
    try {
      // Construct the Overpass QL query to get both nearby features and containing areas
      // This uses both around() for nearby features and is_in() for containing areas
      const distance = 25; // meters radius for nearby features
      const query = `
                [out:json][timeout:25];
                (
                    is_in(${lat}, ${lng});
                    way(around:${distance},${lat},${lng});
                    relation(around:${distance},${lat},${lng});
                );
                out body;
                `;

      const overpassUrl = "https://overpass-api.de/api/interpreter";
      const response = await fetch(overpassUrl, {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      if (!response.ok) {
        throw new Error(`Overpass API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Overpass API response:", data);

      // Filter out valid candidates (ways and relations only)
      const candidates = data.elements.filter(
        (element: any) =>
          (element.type === "way" || element.type === "relation") &&
          element.tags
      );

      // If no candidates found, return empty array
      if (candidates.length === 0) {
        return [];
      }

      // Step 2: Use Nominatim to get proper GeoJSON for each candidate
      const nominatimIds = candidates.map((element: any) => {
        const prefix = element.type === "way" ? "W" : "R";
        return `${prefix}${element.id}`;
      });

      // Split into batches of 50 as Nominatim has a limit
      const batchSize = 50;
      const batches = [];

      for (let i = 0; i < nominatimIds.length; i += batchSize) {
        batches.push(nominatimIds.slice(i, i + batchSize));
      }

      // Process each batch and combine results
      const features: GeoJSONFeature[] = [];

      for (const batch of batches) {
        const nominatimUrl = `https://nominatim.openstreetmap.org/lookup?osm_ids=${batch.join(
          ","
        )}&format=json&polygon_geojson=1&extratags=1`;

        const nominatimResponse = await fetch(nominatimUrl);

        if (!nominatimResponse.ok) {
          console.warn(
            `Nominatim API error for batch: ${nominatimResponse.statusText}`
          );
          continue;
        }

        const nominatimData = await nominatimResponse.json();
        console.log("Nominatim data:", nominatimData);

        // Process each Nominatim result into a GeoJSON feature
        const batchFeatures = nominatimData
          .filter(
            (place: any) =>
              // Ensure it has valid GeoJSON
              place.geojson &&
              (place.geojson.type === "Polygon" ||
                place.geojson.type === "MultiPolygon")
          )
          .map((place: any) => {
            // Create a GeoJSON feature similar to TextSearchPanel
            const feature: GeoJSONFeature = {
              type: "Feature" as "Feature",
              geometry: {
                type:
                  place.geojson.type === "Polygon" ? "Polygon" : "MultiPolygon",
                coordinates: place.geojson.coordinates,
                coordinateCount: countCoordinates(place.geojson.coordinates),
              },
              properties: {
                name: place.display_name,
                osmType: place.osm_type,
                osmId: place.osm_id.toString(),
                osmClass: place.class,
                whatIsIt: describeOsmObject(place),
                // Determine if this is nearby or containing (similar logic as before)
                source:
                  place.address &&
                  (place.address.city ||
                    place.address.county ||
                    place.address.state)
                    ? "containing"
                    : "nearby",
                adminLevel: place.extratags?.admin_level
                  ? parseInt(place.extratags.admin_level, 10)
                  : 0,
                tags: place.extratags || {},
              },
            };

            return fixMultiPolygon(feature);
          });

        features.push(...batchFeatures);
      }

      return features;
    } catch (error) {
      console.error("Error fetching features:", error);
      throw error;
    }
  };

  /**
   * Sort and organize features by relevance
   */
  const organizeFeatures = (features: GeoJSONFeature[]) => {
    // Sort containing features by admin level (country → state → county → city)
    const containingFeatures = features
      .filter((f) => f.properties.source === "containing")
      .sort((a, b) => {
        // Sort administrative boundaries by admin_level (lower = larger area)
        const levelA = a.properties.adminLevel || 15;
        const levelB = b.properties.adminLevel || 15;
        return levelA - levelB;
      });

    // Sort nearby features by importance or type
    const nearbyFeatures = features
      .filter((f) => f.properties.source === "nearby")
      .sort((a, b) => {
        // Custom sorting logic for nearby features
        const tagsA = a.properties.tags || {};
        const tagsB = b.properties.tags || {};

        // Prioritize certain feature types
        const typeOrder = {
          building: 1,
          amenity: 2,
          shop: 3,
          leisure: 4,
          natural: 5,
          landuse: 6,
          default: 10,
        };

        const getTypeValue = (tags: any) => {
          for (const key of Object.keys(typeOrder)) {
            if (tags[key]) return typeOrder[key as keyof typeof typeOrder];
          }
          return typeOrder.default;
        };

        return getTypeValue(tagsA) - getTypeValue(tagsB);
      });

    // Combine lists with containing areas first, then nearby features
    return [...containingFeatures, ...nearbyFeatures];
  };

  const handleClick = async (latlng: { lat: number; lng: number }) => {
    const { lat, lng } = latlng;
    console.log("Clicked position:", lat, lng);

    setIsLoading(true);
    setError(null);
    setShowPicker(false);
    setCandidates([]);

    try {
      // Fetch features using our improved two-step approach
      const features = await fetchFeaturesUsingOverpass(lat, lng);
      console.log("Features from two-step fetch:", features);

      // Organize features
      const organizedFeatures = organizeFeatures(features);

      if (organizedFeatures.length === 0) {
        setError(
          "No recognizable areas found at this location. Try clicking on or near a building, park, or other defined area."
        );
        setIsLoading(false);
        return;
      }

      setCandidates(organizedFeatures);
      setShowPicker(true);
    } catch (error) {
      console.error("Error fetching features:", error);
      setError(
        `Failed to fetch areas: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const activateWand = () => {
    setShowPicker(false);
    setCandidates([]);
    setError(null);
    setOnMapClick(handleClick);
    useMapStore.getState().setMagicWandMode(true);
    console.log("Magic Wand activated. Click on the map to select an area.");
  };

  const deactivateWand = () => {
    setShowPicker(false);
    setCandidates([]);
    setError(null);
    setOnMapClick(null);
    useMapStore.getState().setMagicWandMode(false);
    useMapStore.getState().setHoveredCandidate(null);
    console.log("Magic Wand deactivated.");
  };

  return (
    <div className="panel magic-wand-panel">
      <div className="panel-header">
        <h2>Magic Wand</h2>
        <InformationBubble message="Click activate, then click anywhere on the map. Wait for the list of options to appear, then hover over them to highlight them on the map. Once you've found the correct area, click the option to add it to the map." />
      </div>
      <div className="panel-description">
        Find anything by clicking a location on the map.
      </div>
      <div className="magic-wand-controls">
        <div className="button-group">
          <button
            className={
              magicWandMode ? "secondary-button cancel-mode" : "primary-button"
            }
            onClick={magicWandMode ? deactivateWand : activateWand}
            disabled={isLoading}
          >
            {magicWandMode ? (isLoading ? "Loading..." : "Cancel") : "Activate"}
          </button>
        </div>
      </div>

      {magicWandMode && !isLoading && !showPicker ? (
        <div className="loading-indicator">
          <p>Click on the map to select an area. Click again to cancel.</p>
        </div>
      ) : (
        <div></div>
      )}

      {isLoading && (
        <div className="loading-indicator">
          <p>Searching for areas...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {showPicker && candidates.length > 0 && (
        <>
          <div className="loading-indicator">
            <p>Found {candidates.length} areas. Hover to outline the area.</p>
          </div>
          <GeoCandidatePicker
            candidates={candidates}
            onSelect={(feature) => {
              addGeoJSONFromSearch(feature);
              useMapStore.getState().setHoveredCandidate(null);
              deactivateWand();
            }}
            onCancel={deactivateWand}
          />
        </>
      )}

      <div className="custom-area-info">
        <p>
          Some larger areas may not show up in the list - click on one of its
          corners to select it.
        </p>
      </div>
    </div>
  );
}
