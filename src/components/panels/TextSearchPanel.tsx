// src/components/panels/TextSearchPanel.tsx
import React, { useEffect, useState, useRef } from "react";
import { useMapStore } from "../../state/mapStore";
import { OSM_Type } from "../../state/mapStoreTypes";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import GeoCandidatePicker from "../ui/GeoCandidatePicker";
import { describeOsmObject } from "../utils/describeOsmObject";
import { InformationBubble } from "../ui/informationBubble";
import { DismissableMessage } from "../ui/DismissableMessage";
import { countCoordinates, fixMultiPolygon } from "../utils/geometryUtils";
import "../../styles/MagicWandPanel.css";
import "../../styles/TextSearchPanel.css";
import { useSettings } from "../../state/settingsStore";

export default function TextSearchPanel() {
  const [query, setQuery] = useState("");
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );
  const [candidates, setCandidates] = useState<GeoJSONFeature[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get history items from the store
  const historyItems = useMapStore((state) => state.historyItems);

  // Filter history items for text search
  const textSearchHistory = historyItems
    .filter(
      (item) =>
        item.properties.source === "text-search" || !item.properties.source
    )
    .slice(0, 5); // Limit to 5 most recent items

  // Magic wand state
  const setOnMapClick = useMapStore((s) => s.setOnMapClick);
  const magicWandMode = useMapStore((s) => s.magicWandMode);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setCandidates([]);
    setIsLoading(true);
    setShowPicker(true);

    try {
      const possiblePlaces = await fetchCandidates(query);
      if (possiblePlaces.length === 0) {
        setShowPicker(false);
        alert("Couldn't find anything named " + query + ".");
        return;
      }
      console.log("Possible places:", possiblePlaces);

      const geojsons = possiblePlaces.map((place: any) => {
        const osmType = place.osm_type;
        const osmId = place.osm_id;
        const feature: GeoJSONFeature = {
          type: "Feature" as "Feature",
          geometry: {
            type: osmType === OSM_Type.WAY ? "Polygon" : "MultiPolygon",
            coordinates: place.geojson.coordinates,
            coordinateCount: countCoordinates(place.geojson.coordinates),
          },
          properties: {
            name: place.display_name,
            osmType: place.type,
            osmId,
            osmClass: place.class,
            location: place.location,
            whatIsIt: describeOsmObject(place),
            source: "text-search", // Mark as created via TextSearchPanel
            searchMethod: "other", // Default method, can be updated later
          },
        };
        return fixMultiPolygon(feature);
      });
      if (geojsons.length === 1) {
        addGeoJSONFromSearch(geojsons[0]);
        setShowPicker(false);
        return;
      }
      setCandidates(geojsons);
    } catch (error) {
      console.error("Search error:", error);
      alert("There was a problem searching.");
      setShowPicker(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the input box when the panel mounts
    if (!magicWandMode) {
      inputRef.current?.focus();
    }
  }, [magicWandMode]);

  // Effect to handle external magic wand mode changes (e.g., from keyboard shortcuts)
  useEffect(() => {
    if (magicWandMode) {
      // If magic wand mode is activated externally, set up click handler
      if (!useMapStore.getState().onMapClick) {
        setOnMapClick(handleClick);
        console.log("Magic Wand activated.");
      }
    } else {
      // If magic wand mode is deactivated externally, clean up
      setShowPicker(false);
      setCandidates([]);
      setError(null);
      console.log("Magic Wand deactivated.");
    }
  }, [magicWandMode]);

  // Magic Wand functionality (copied from MagicWandPanel)
  /**
   * Fetch both nearby features and containing areas using a two-step approach:
   * 1. Use Overpass API to identify candidates
   * 2. Use Nominatim API to get proper GeoJSON for those candidates
   */
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
      console.log("Nominatim batches:", batches);

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
                source: "text-search", // Set source as text-search for history filtering
                searchMethod:
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
      .filter((f) => f.properties.searchMethod === "containing")
      .sort((a, b) => {
        // Sort administrative boundaries by admin_level (lower = larger area)
        const levelA = a.properties.adminLevel || 15;
        const levelB = b.properties.adminLevel || 15;
        return levelA - levelB;
      });

    // Sort nearby features by importance or type
    const nearbyFeatures = features
      .filter((f) => f.properties.searchMethod === "nearby")
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
    setCandidates([]);
    setShowPicker(true);

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
        setShowPicker(false);
        return;
      }

      setCandidates(organizedFeatures);
    } catch (error) {
      console.error("Error fetching features:", error);
      setError(
        `Failed to fetch areas: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      setShowPicker(false);
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
  };

  const deactivateWand = () => {
    setShowPicker(false);
    setCandidates([]);
    setError(null);
    setOnMapClick(null);
    useMapStore.getState().setMagicWandMode(false);
    useMapStore.getState().setHoveredCandidate(null);
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2>
          Search<span className="keybind-text">S</span>
        </h2>
        <InformationBubble
          message={
            magicWandMode
              ? "Click on the map to find areas at that location. The magic wand tool helps you find buildings, parks, or other features by clicking directly on them."
              : "You can use the name of a place, the address, coordinates, or any other location identifier. If multiple results are found, you can select one from the list. You can also use the magic wand icon to click on the map and find areas."
          }
        />
      </div>

      <div className="panel-description">
        {magicWandMode
          ? "Click on the map to find areas at that location."
          : "Search for places by name or use magic wand to click on map."}
      </div>

      <div className="text-search-panel">
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search for anything..."
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`text-search-input ${magicWandMode ? "disabled" : ""}`}
          disabled={magicWandMode}
        />

        {/* Search button */}
        <button
          onClick={handleSearch}
          className={`text-search-button ${magicWandMode ? "disabled" : ""}`}
          tabIndex={0}
          disabled={magicWandMode}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={
              useSettings.getState().theme === "dark" ||
              (useSettings.getState().theme === "system" &&
                useSettings.getState().getSystemPreference() === "dark")
                ? "#fff"
                : "#222"
            }
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
        {/* Magic wand button */}
        <button
          onClick={magicWandMode ? deactivateWand : activateWand}
          className={`magic-wand-button ${magicWandMode ? "active" : ""}`}
          title={
            magicWandMode
              ? "Cancel magic wand selection"
              : "Use magic wand to click on map"
          }
          tabIndex={0}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={magicWandMode ? "#4F46E5" : "currentColor"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Wand */}
            <line x1="18" y1="6" x2="6" y2="18" />
            {/* Stars */}
            <path d="M8 2 L9 4 L7 4 Z" />
            <path d="M16 19 L17 21 L15 21 Z" />
            <path d="M21 13 L19 14 L19 12 Z" />
          </svg>
        </button>
      </div>

      {magicWandMode && !isLoading && !showPicker && (
        <div className="magic-wand-instructions">
          <p>
            Click on the map to select an area. Click the wand button again to
            cancel.
          </p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}

      {/* Display history below search controls */}
      {textSearchHistory.length > 0 && !showPicker && !magicWandMode && (
        <div className="history-view">
          <GeoCandidatePicker
            candidates={textSearchHistory}
            isLoading={false}
            foundText="Recent searches"
            onSelect={(feature) => {
              addGeoJSONFromSearch({
                ...feature,
                properties: {
                  ...feature.properties,
                  source: "text-search", // Ensure source is preserved
                },
              });
            }}
            showOnHover={true}
          />
        </div>
      )}

      {showPicker && (
        <GeoCandidatePicker
          candidates={candidates}
          isLoading={isLoading}
          foundText="default"
          onSelect={(feature) => {
            // Make sure the feature has the text-search source
            const featureWithSource = {
              ...feature,
              properties: {
                ...feature.properties,
                source: "text-search" as "text-search", // Ensure source is properly set and typed
              },
            };
            addGeoJSONFromSearch(featureWithSource);
            setShowPicker(false);
            useMapStore.getState().setHoveredCandidate(null);
            setCandidates([]);
            if (magicWandMode) {
              deactivateWand();
            }
          }}
          onCancel={() => {
            setShowPicker(false);
            useMapStore.getState().setHoveredCandidate(null);
            setCandidates([]);
            if (magicWandMode) {
              deactivateWand();
            }
          }}
        />
      )}

      <DismissableMessage messageId="text-search-capabilities-info">
        <p>
          You can find anything you want! Large official borders like countries
          and states, local areas like parks and lakes, or even smaller features
          like buildings and monuments.
        </p>
      </DismissableMessage>
    </div>
  );
}

// Given the name of a place,
// fetch all possible candidates from Nominatim,
// filter out only ways and relations,
// and return the remaining list of candidates.
async function fetchCandidates(input: string) {
  // Gather candidates from Nominatim
  // You can bias the search to a location by adding the "viewbox" and "bounded" parameters.
  // For example, to bias near latitude/longitude (lat, lon), create a small bounding box around it.
  // Replace these with your desired coordinates:
  const mapCenter = useMapStore.getState().currentMapCenter;
  const lat = mapCenter[0];
  const lon = mapCenter[1];
  const delta = 0.1; // Approximate bounding box size in degrees

  const viewbox = [
    lon - delta, // left
    lat - delta, // top
    lon + delta, // right
    lat + delta, // bottom
  ].join(",");

  let nearbyResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&extratags=1&q=${encodeURIComponent(
      input
    )}&viewbox=${viewbox}&bounded=1`
  );

  let nominatimResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&extratags=1&q=${encodeURIComponent(
      input
    )}`
  );

  const [nearbyData, nominatimDataRaw] = await Promise.all([
    nearbyResponse.json(),
    nominatimResponse.json(),
  ]);

  // Helper to check if a polygon is closed
  function isClosedPolygon(geojson: any): boolean {
    if (geojson?.type !== "Polygon") return false;
    const coords = geojson.coordinates?.[0];
    if (!coords || coords.length < 4) return false;
    const first = coords[0];
    const last = coords[coords.length - 1];
    return first[0] === last[0] && first[1] === last[1];
  }

  // Filter for closed ways and valid relations with polygon geometry
  const filterCandidates = (data: any[]) =>
    data.filter(
      (candidate: any) =>
        (candidate.osm_type === "relation" ||
          (candidate.osm_type === "way" &&
            isClosedPolygon(candidate.geojson))) &&
        (candidate.geojson?.type === "Polygon" ||
          candidate.geojson?.type === "MultiPolygon")
    );

  // Filter both sets
  const filteredNominatim = filterCandidates(nominatimDataRaw);
  const filteredNearby = filterCandidates(nearbyData);

  // Remove duplicates from filteredNearby that are already in filteredNominatim (by osm_id + osm_type)
  const nominatimKeys = new Set(
    filteredNominatim.map((item: any) => `${item.osm_type}_${item.osm_id}`)
  );
  const uniqueNearby = filteredNearby.filter(
    (item: any) => !nominatimKeys.has(`${item.osm_type}_${item.osm_id}`)
  );

  // Results: nominatim first, then unique nearby
  const nominatimData = [...filteredNominatim, ...uniqueNearby];

  // If no candidates found, alert the user
  if (nominatimData.length === 0) {
    return [];
  }

  // Return the filtered candidates
  return nominatimData;
}
