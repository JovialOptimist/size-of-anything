// src/components/panels/TextSearchPanel.tsx
import React, { useState, useRef } from "react";
import { useMapStore } from "../../state/mapStore";
import type { GeoJSONFeature } from "../../state/mapStore";
import GeoCandidatePicker from "../map/GeoCandidatePicker";

const OSM_Type = {
  NODE: "node",
  WAY: "way",
  RELATION: "relation",
} as const;
type OSM_Type = (typeof OSM_Type)[keyof typeof OSM_Type];

export default function TextSearchPanel() {
  const [query, setQuery] = useState("");
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );
  const [candidates, setCandidates] = useState<GeoJSONFeature[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

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
            osmType,
            osmId,
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
          Search
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
    </div>
  );
}

// Given the name of a place,
// fetch all possible candidates from Nominatim,
// filter out only ways and relations,
// and return the remaining list of candidates.
async function fetchCandidates(input: string) {
  // Gather candidates from Nominatim
  let nominatimResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&extratags=1&q=${encodeURIComponent(
      input
    )}`
  );
  let nominatimData = await nominatimResponse.json();
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

function fixMultiPolygon(feature: GeoJSONFeature): GeoJSONFeature {
  const geom = feature.geometry;

  // If it's labeled MultiPolygon but only a single ring is present, and the innermost element is [lng, lat]
  if (
    geom.type === "MultiPolygon" &&
    Array.isArray(geom.coordinates) &&
    geom.coordinates.length > 0 &&
    Array.isArray(geom.coordinates[0]) &&
    Array.isArray(geom.coordinates[0][0]) &&
    typeof geom.coordinates[0][0][0] === "number"
  ) {
    // It’s actually a single polygon, not a multipolygon
    const corrected: GeoJSONFeature = {
      ...feature,
      geometry: {
        type: "Polygon",
        coordinates: geom.coordinates as any, // safe to treat as Polygon
      },
    };
    return corrected;
  }

  return feature;
}

/**
 * Returns a human-readable label for an OSM object returned by Nominatim.
 * @param result A Nominatim result object
 * @returns A string describing what the object is, like "City", "Restaurant", etc.
 */
export function describeOsmObject(result: any): string {
  const cls = result.class;
  const type = result.type;
  const tags = result.extratags || {};
  const addresstype = result.addresstype;

  // 1. Handle common known boundary types
  if (cls === "boundary" && type === "administrative") {
    if (addresstype === "country") return "Country";
    if (addresstype === "state") return "State";
    if (addresstype === "city") return "City";
    if (addresstype === "county") return "County";
    if (addresstype === "region") return "Region";
    if (tags.border_type) return `${capitalize(tags.border_type)} Border`;
    return "Administrative Boundary";
  }

  // 2. Handle places
  if (cls === "place") {
    return capitalize(type); // e.g. "town", "village"
  }

  // 3. Landuse, natural, and leisure areas
  if (cls === "landuse" || cls === "leisure" || cls === "natural") {
    return capitalize(type);
  }

  // 4. Buildings and amenities (like schools, restaurants, hospitals)
  if (cls === "building" || cls === "amenity") {
    return capitalize(type);
  }

  // 5. Water bodies
  if (cls === "waterway" || cls === "water") {
    return capitalize(type); // e.g., "river", "lake"
  }

  // 6. Tourism, attractions, historic places
  if (cls === "tourism" || cls === "historic") {
    return capitalize(type);
  }

  // 7. Transportation
  if (cls === "highway" || cls === "railway" || cls === "aeroway") {
    return capitalize(type);
  }

  // 8. Fallback to class/type or name
  if (cls && type) {
    return `${capitalize(cls)}: ${capitalize(type)}`;
  }

  // 9. Fallback to name only
  if (result.name) return result.name;

  return "Unknown Feature";
}

/**
 * Capitalizes the first letter of a word.
 */
function capitalize(word: string | undefined): string {
  if (!word || typeof word !== "string") return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}
