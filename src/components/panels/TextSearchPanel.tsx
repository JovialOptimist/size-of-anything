// src/components/panels/TextSearchPanel.tsx
import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";

const OSM_Type = {
  NODE: "node",
  WAY: "way",
  RELATION: "relation",
} as const;
type OSM_Type = (typeof OSM_Type)[keyof typeof OSM_Type];

// Define GeoJSONFeature type
type GeoJSONFeature = {
  type: "Feature";
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any;
  };
  properties: {
    name: string;
    osmType: string;
    osmId: string | null;
    [key: string]: any;
  };
};

export default function TextSearchPanel() {
  const [query, setQuery] = useState("");
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );

  const handleSearch = async () => {
    if (!query.trim()) return;

    try {
      const possiblePlaces = await fetchCandidates(query);
      const place = possiblePlaces[0];
      const osmType = place.osm_type;
      const osmId = place.osm_id;

      console.log(`Resolved ${query} to ${osmType}(${osmId})`);

      const overpassDataElements = await getRawCoordinates(osmType, osmId);
      console.log("Overpass data elements:", overpassDataElements);

      let coords = await queryAndDisplayPolygon(overpassDataElements, {
        osmType,
        osmId,
      });

      const isSingleRing =
        Array.isArray(coords) &&
        coords.length > 0 &&
        Array.isArray(coords[0]) &&
        typeof coords[0][0] === "number";
      let polygonCoords: L.LatLngExpression[] | L.LatLngExpression[][] | null =
        null;
      polygonCoords = isSingleRing ? [coords as [number, number][]] : coords;

      if (!polygonCoords || polygonCoords.length === 0) {
        alert("No valid polygon found for the selected place.");
        return;
      }

      // For GeoJSON, coordinates must be [longitude, latitude] format
      // Leaflet uses [latitude, longitude], so we need to swap them
      const swappedCoordinates = swapCoordinatesForGeoJSON(polygonCoords);

      const feature: GeoJSONFeature = {
        type: "Feature" as "Feature",
        geometry: {
          type: osmType === OSM_Type.WAY ? "Polygon" : "MultiPolygon",
          coordinates: swappedCoordinates,
        },
        properties: {
          name: place.display_name,
          osmType,
          osmId,
        },
      };

      addGeoJSONFromSearch(feature);
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
  );
}

// Supporting utility functions (same as provided in your original post)
// fetchCandidates, getRawCoordinates, buildCoords, extractFirstValidPolygon, queryAndDisplayPolygon

// Given the name of a place,
// fetch all possible candidates from Nominatim,
// filter out only ways and relations,
// and return the remaining list of candidates.
async function fetchCandidates(input: string) {
  // Gather candidates from Nominatim
  let nominatimResponse = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      input
    )}`
  );
  let nominatimData = await nominatimResponse.json();
  console.log("Nominatim data:", nominatimData);

  // Filter out only ways and relations
  nominatimData = nominatimData.filter(
    (candidate: any) =>
      candidate.osm_type === "way" || candidate.osm_type === "relation"
  );

  // If no candidates found, alert the user
  if (nominatimData.length === 0) {
    alert("Could not find anything named " + input + ".");
    return [];
  }

  // Return the filtered candidates
  return nominatimData;
}

// Given an OSM type and ID (which guarantees a unique element),
// fetch and return the coordinates of that way or relation using Overpass API.
async function getRawCoordinates(osmType: string, osmId: string | null) {
  let query = `[out:json]; ${osmType}(${osmId}); (._; >;); out body;`;
  let response = await fetch(
    `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`
  );
  let coordinates = (await response.json()).elements;

  if (!coordinates || coordinates.length === 0) {
    alert("Boundary data not found!");
    return;
  }
  return coordinates;
}

function buildCoords(
  osmType: OSM_Type,
  overpassDataElements: any[],
  osmId: string | null,
  nodes: { [id: number]: [number, number] },
  ways: any[]
): any[] {
  if (osmType == OSM_Type.WAY) {
    let wayNodes = overpassDataElements.find(
      (el: { type: string; id: string | null }) =>
        el.type === "way" && el.id == osmId
    )?.nodes;

    if (!wayNodes) {
      return [];
    }

    return wayNodes.map((id: number) => nodes[id]);
  } else if (osmType == OSM_Type.RELATION) {
    let outerRings = [];
    let innerRings = [];

    let relation = overpassDataElements.find(
      (el: { type: string; id: string | null }) =>
        el.type === "relation" && el.id == osmId
    );
    if (!relation) {
      alert("Relation not found!");
      return [];
    }

    let wayMap: { [key: number]: [number, number][] } = {};
    ways.forEach((way: any) => {
      wayMap[way.id] = way.nodes.map((id: number) => nodes[id]);
    });

    let outerWays = relation.members.filter(
      (m: { type: string; role: string }) =>
        m.type === "way" && m.role === "outer"
    );
    let innerWays = relation.members.filter(
      (m: { type: string; role: string }) =>
        m.type === "way" && m.role === "inner"
    );

    function buildRings(ways: any[]) {
      let rings = [];

      while (ways.length) {
        let ring = ways.shift();
        let coords = [...wayMap[ring.ref]];
        let changed = true;

        while (changed) {
          changed = false;
          for (let i = 0; i < ways.length; i++) {
            let nextCoords = wayMap[ways[i].ref];
            if (!nextCoords) continue;

            if (
              coords[coords.length - 1].toString() === nextCoords[0].toString()
            ) {
              coords = coords.concat(nextCoords.slice(1));
              ways.splice(i, 1);
              changed = true;
              break;
            } else if (
              coords[0].toString() ===
              nextCoords[nextCoords.length - 1].toString()
            ) {
              coords = nextCoords.slice(0, -1).concat(coords);
              ways.splice(i, 1);
              changed = true;
              break;
            } else if (coords[0].toString() === nextCoords[0].toString()) {
              coords = nextCoords.reverse().slice(0, -1).concat(coords);
              ways.splice(i, 1);
              changed = true;
              break;
            } else if (
              coords[coords.length - 1].toString() ===
              nextCoords[nextCoords.length - 1].toString()
            ) {
              coords = coords.concat(nextCoords.reverse().slice(1));
              ways.splice(i, 1);
              changed = true;
              break;
            }
          }
        }

        rings.push(coords);
      }

      return rings;
    }

    outerRings = buildRings(outerWays);
    innerRings = buildRings(innerWays);

    if (outerRings.length === 0) {
      alert("No outer boundary found.");
      return [];
    }

    return outerRings.map((outer, index) => {
      let outerRing = outer;
      let inner: [number, number][][] = [];

      if (index === 0) {
        inner = innerRings;
      }

      return [outerRing, ...inner];
    });
  } else {
    console.error("Unsupported OSM type:", osmType);
    return [];
  }
}

function extractFirstValidPolygon(elements: any[]): [number, number][] | null {
  for (const el of elements) {
    if (!el.geometry || el.geometry.length < 3) continue;

    const coords = el.geometry.map((p: any) => [p.lat, p.lon]);

    // Ensure the polygon is closed
    const first = coords[0];
    const last = coords[coords.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push(first);
    }

    return coords as [number, number][];
  }

  return null;
}

async function queryAndDisplayPolygon(
  overpassElements: any[],
  options: {
    osmType?: OSM_Type;
    osmId?: string | null;
  }
) {
  let polygonCoords: L.LatLngExpression[] | L.LatLngExpression[][] | null =
    null;

  if (options.osmType && options.osmId) {
    const nodes: { [id: number]: [number, number] } = {};
    const ways: any[] = [];

    for (const el of overpassElements) {
      if (el.type === "node") nodes[el.id] = [el.lat, el.lon];
      else if (el.type === "way") ways.push(el);
    }

    const coords = buildCoords(
      options.osmType,
      overpassElements,
      options.osmId,
      nodes,
      ways
    );
    if (!coords || coords.length === 0) return null;

    // Normalize to always be [[]] (multi-ring)
    const isSingleRing =
      Array.isArray(coords) &&
      coords.length > 0 &&
      Array.isArray(coords[0]) &&
      typeof coords[0][0] === "number";
    polygonCoords = isSingleRing ? [coords as [number, number][]] : coords;
  } else {
    const extracted = extractFirstValidPolygon(overpassElements);
    if (!extracted) return null;
    polygonCoords = [extracted];
  }

  console.log("Polygon coordinates:", polygonCoords);

  return polygonCoords;
}

/**
 * Converts coordinates from Leaflet format [lat, lng] to GeoJSON format [lng, lat]
 * Works with both simple polygons and multi-polygons
 */
function swapCoordinatesForGeoJSON(coords: any): any {
  // Check if we have a simple [lat, lng] pair
  if (!Array.isArray(coords)) {
    return coords;
  }

  if (
    coords.length === 2 &&
    typeof coords[0] === "number" &&
    typeof coords[1] === "number"
  ) {
    // This is a single [lat, lng] coordinate pair
    return [coords[1], coords[0]]; // Swap to [lng, lat]
  }

  // Otherwise, recursively process the array
  return coords.map((item) => swapCoordinatesForGeoJSON(item));
}
