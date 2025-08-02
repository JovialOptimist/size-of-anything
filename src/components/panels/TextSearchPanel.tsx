// src/components/panels/TextSearchPanel.tsx
import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import { OSM_Type } from "../../state/mapStoreTypes";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import GeoCandidatePicker from "../map/GeoCandidatePicker";
import { describeOsmObject } from "../utils/describeOsmObject";
import fixMultiPolygon from "../utils/fixMultipolygon";
import reactLogo from "../../assets/react.svg";

export default function TextSearchPanel() {
  const [query, setQuery] = useState("");
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );
  const [candidates, setCandidates] = useState<GeoJSONFeature[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setCandidates([]);
    setShowPicker(false);

    try {
      const possiblePlaces = await fetchCandidates(query);
      if (possiblePlaces.length === 0) {
        alert("No valid candidates found for your search.");
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
          },
          properties: {
            name: place.display_name,
            osmType: place.type,
            osmId,
            osmClass: place.class,
            whatIsIt: describeOsmObject(place),
          },
        };
        return fixMultiPolygon(feature);
      });
      if (geojsons.length === 1) {
        addGeoJSONFromSearch(geojsons[0]);
        return;
      }
      setCandidates(geojsons);
      setShowPicker(true);
    } catch (error) {
      console.error("Search error:", error);
      alert("There was a problem searching.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="panel">
      <h2>Text Search</h2>
      <div className="text-search-panel">
        <input
          type="text"
          value={query}
          placeholder="Search for a place"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="text-search-input"
        />
        <button onClick={handleSearch} className="text-search-button">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke={"white"}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {showPicker && candidates.length > 0 && (
        <GeoCandidatePicker
          candidates={candidates}
          onSelect={(feature) => {
            addGeoJSONFromSearch(feature);
            setShowPicker(false);
            setCandidates([]);
          }}
          onCancel={() => {
            setShowPicker(false);
            setCandidates([]);
          }}
        />
      )}

      {!showPicker && candidates.length === 0 && (
        <div className="geo-candidate-picker">
          <h3>Search for anything!</h3>
          <ul className="candidate-list">
            <div className="candidate-item">
              <button className="select-candidate-button">
                <img
                  src={reactLogo}
                  alt=""
                  className="candidate-icon"
                  width={20}
                  height={20}
                />
                <div className="candidate-text">
                  <div className="candidate-label">Results</div>
                  <div className="candidate-description">
                    Results will appear here.
                  </div>
                </div>
              </button>
            </div>
          </ul>
        </div>
      )}
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

  // Combine: keep all from nearbyData, add only unique from nominatimDataRaw (by osm_id + osm_type)
  const existingKeys = new Set(
    nearbyData.map((item: any) => `${item.osm_type}_${item.osm_id}`)
  );
  const uniqueNominatim = nominatimDataRaw.filter(
    (item: any) => !existingKeys.has(`${item.osm_type}_${item.osm_id}`)
  );
  let nominatimData = [...nearbyData, ...uniqueNominatim];
  console.log("Nominatim data:", nominatimData);

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
  nominatimData = nominatimData.filter(
    (candidate: any) =>
      (candidate.osm_type === "relation" ||
        (candidate.osm_type === "way" && isClosedPolygon(candidate.geojson))) &&
      (candidate.geojson?.type === "Polygon" ||
        candidate.geojson?.type === "MultiPolygon")
  );

  // If no candidates found, alert the user
  if (nominatimData.length === 0) {
    alert("Could not find anything named " + input + ".");
    return [];
  }

  // Return the filtered candidates
  return nominatimData;
}
