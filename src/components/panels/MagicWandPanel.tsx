import React, { useState, useEffect } from "react";
import { useMapStore } from "../../state/mapStore";
import "../../styles/MagicWandPanel.css";

type NearbyPlace = {
  id: string;
  name: string;
  osmId: string;
  osmType: string;
  displayName: string;
  distance?: number;
};

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

/**
 * Panel for magic wand functionality
 */
const MagicWandPanel: React.FC = () => {
  const [isSelecting, setIsSelecting] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const isSelectingArea = useMapStore((state) => state.isSelectingArea);
  const setIsSelectingArea = useMapStore((state) => state.setIsSelectingArea);
  const clickedPosition = useMapStore((state) => state.clickedPosition);
  const setClickedPosition = useMapStore((state) => state.setClickedPosition);
  const addGeoJSONFromSearch = useMapStore(
    (state) => state.addGeoJSONFromSearch
  );

  // Handle toggle of selection mode
  const handleToggleSelection = () => {
    const newValue = !isSelecting;
    setIsSelecting(newValue);
    setIsSelectingArea(newValue);

    // Reset state when turning off selection mode
    if (!newValue) {
      setNearbyPlaces([]);
      setClickedPosition(null);
    }
  };

  // When clickedPosition changes, fetch nearby areas
  useEffect(() => {
    if (!clickedPosition || !isSelectingArea) return;

    const fetchNearbyAreas = async () => {
      setIsLoading(true);
      try {
        const [lat, lng] = clickedPosition;

        // First, find nearby places using Nominatim reverse geocoding
        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
        const nominatimResponse = await fetch(nominatimUrl);
        const nominatimData = await nominatimResponse.json();

        // Then get nearby areas using Overpass API
        const radius = 500; // 500 meters radius
        const overpassQuery = `
          [out:json];
          (
            way(around:${radius},${lat},${lng});
            relation(around:${radius},${lat},${lng});
            is_in(${lat},${lng});
          );
          out body;
          >;
          out skel qt;
        `;

        const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
          overpassQuery
        )}`;
        const overpassResponse = await fetch(overpassUrl);
        const overpassData = await overpassResponse.json();

        // Process the results to create a list of nearby places
        const places: NearbyPlace[] = [];

        // Add the current location from Nominatim if available
        if (nominatimData && nominatimData.display_name) {
          places.push({
            id: `nominatim-${nominatimData.osm_id || "current"}`,
            name: nominatimData.name || "Current Location",
            osmId: nominatimData.osm_id || "",
            osmType: nominatimData.osm_type || "",
            displayName: nominatimData.display_name,
            distance: 0,
          });
        }

        // Add places from Overpass
        if (overpassData && overpassData.elements) {
          overpassData.elements.forEach((element: any) => {
            if (element.tags && (element.tags.name || element.tags.place)) {
              const distance = calculateDistance(
                lat,
                lng,
                element.lat,
                element.lon
              );
              places.push({
                id: `${element.type}-${element.id}`,
                name:
                  element.tags.name ||
                  element.tags.place ||
                  `${element.type} ${element.id}`,
                osmId: element.id.toString(),
                osmType: element.type,
                displayName: `${
                  element.tags.name || element.tags.place || element.id
                } (${element.type})`,
                distance: distance,
              });
            }
          });
        }

        // Sort by distance and remove duplicates
        const uniquePlaces = places
          .filter(
            (place, index, self) =>
              index === self.findIndex((p) => p.id === place.id)
          )
          .sort((a, b) => (a.distance || 0) - (b.distance || 0));

        setNearbyPlaces(uniquePlaces);
      } catch (error) {
        console.error("Error fetching nearby areas:", error);
        setNearbyPlaces([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNearbyAreas();
  }, [clickedPosition, isSelectingArea, setClickedPosition]);

  // Handle place selection
  const handlePlaceSelection = async (place: NearbyPlace) => {
    setIsLoading(true);
    try {
      // Fetch detailed geometry data for the selected place
      const overpassQuery = `
        [out:json];
        ${place.osmType}(${place.osmId});
        (._;>;);
        out body;
      `;

      const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(
        overpassQuery
      )}`;
      const response = await fetch(overpassUrl);
      const data = await response.json();

      // Process data to create GeoJSON
      const elements = data.elements || [];
      const nodes: { [id: number]: [number, number] } = {};
      const ways: any[] = [];

      // Process all elements
      elements.forEach((el: any) => {
        if (el.type === "node") {
          nodes[el.id] = [el.lat, el.lon];
        } else if (el.type === "way") {
          ways.push(el);
        }
      });

      // Build polygon coordinates
      const coords = buildCoords(
        place.osmType === "way" ? "way" : "relation",
        elements,
        place.osmId,
        nodes,
        ways
      );

      if (!coords || coords.length === 0) {
        alert("Failed to build geometry for selected place.");
        return;
      }

      // Create GeoJSON feature
      const isSingleRing =
        Array.isArray(coords) &&
        coords.length > 0 &&
        Array.isArray(coords[0]) &&
        typeof coords[0][0] === "number";

      let polygonCoords = isSingleRing
        ? [coords as [number, number][]]
        : coords;
      const swappedCoordinates = swapCoordinatesForGeoJSON(polygonCoords);

      const feature: GeoJSONFeature = {
        type: "Feature" as "Feature",
        geometry: {
          type: place.osmType === "way" ? "Polygon" : "MultiPolygon",
          coordinates: swappedCoordinates,
        },
        properties: {
          name: place.name,
          osmType: place.osmType,
          osmId: place.osmId,
        },
      };

      // Add to map
      addGeoJSONFromSearch(feature);

      // Reset selection state
      setIsSelecting(false);
      setIsSelectingArea(false);
      setNearbyPlaces([]);
      setClickedPosition(null);
    } catch (error) {
      console.error("Error processing selected place:", error);
      alert("Failed to process the selected place. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="panel magic-wand-panel">
      <h2>Magic Wand</h2>

      {!isSelecting && (
        <div>
          <p>Click the button below to select an area from the map.</p>
          <button
            className="select-area-button"
            onClick={handleToggleSelection}
          >
            Select Area
          </button>
        </div>
      )}

      {isSelecting && !clickedPosition && (
        <div>
          <p className="selecting-message">
            Selecting an area... Click anywhere on the map.
          </p>
          <button className="cancel-button" onClick={handleToggleSelection}>
            Cancel
          </button>
        </div>
      )}

      {isSelecting && clickedPosition && (
        <div className="nearby-places">
          <h3>Select a place:</h3>

          {isLoading ? (
            <p>Loading nearby places...</p>
          ) : (
            <>
              {nearbyPlaces.length > 0 ? (
                <ul className="places-list">
                  {nearbyPlaces.map((place) => (
                    <li
                      key={place.id}
                      onClick={() => handlePlaceSelection(place)}
                    >
                      <div className="place-name">{place.name}</div>
                      <div className="place-detail">{place.displayName}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No places found nearby. Try clicking somewhere else.</p>
              )}

              <button className="cancel-button" onClick={handleToggleSelection}>
                Cancel
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

// Utility functions for coordinate calculations and polygon building

function calculateDistance(
  lat1: number,
  lon1: number,
  lat2?: number,
  lon2?: number
): number {
  if (lat2 === undefined || lon2 === undefined) return Number.MAX_VALUE;

  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}

function buildCoords(
  osmType: "way" | "relation",
  overpassDataElements: any[],
  osmId: string,
  nodes: { [id: number]: [number, number] },
  ways: any[]
): any[] {
  if (osmType === "way") {
    let wayNodes = overpassDataElements.find(
      (el: { type: string; id: number | string }) =>
        el.type === "way" && el.id.toString() === osmId
    )?.nodes;

    if (!wayNodes) {
      return [];
    }

    return wayNodes.map((id: number) => nodes[id]);
  } else if (osmType === "relation") {
    let outerRings = [];
    let innerRings = [];

    let relation = overpassDataElements.find(
      (el: { type: string; id: number | string }) =>
        el.type === "relation" && el.id.toString() === osmId
    );

    if (!relation) {
      return [];
    }

    let wayMap: { [key: number]: [number, number][] } = {};
    ways.forEach((way: any) => {
      wayMap[way.id] = way.nodes.map((id: number) => nodes[id]);
    });

    let outerWays =
      relation.members?.filter(
        (m: { type: string; role: string }) =>
          m.type === "way" && m.role === "outer"
      ) || [];

    let innerWays =
      relation.members?.filter(
        (m: { type: string; role: string }) =>
          m.type === "way" && m.role === "inner"
      ) || [];

    function buildRings(ways: any[]) {
      let rings = [];

      while (ways.length) {
        let ring = ways.shift();
        let coords = [...(wayMap[ring.ref] || [])];
        let changed = true;

        while (changed) {
          changed = false;
          for (let i = 0; i < ways.length; i++) {
            let nextCoords = wayMap[ways[i].ref];
            if (!nextCoords) continue;

            if (
              coords[coords.length - 1]?.toString() ===
              nextCoords[0]?.toString()
            ) {
              coords = coords.concat(nextCoords.slice(1));
              ways.splice(i, 1);
              changed = true;
              break;
            } else if (
              coords[0]?.toString() ===
              nextCoords[nextCoords.length - 1]?.toString()
            ) {
              coords = nextCoords.slice(0, -1).concat(coords);
              ways.splice(i, 1);
              changed = true;
              break;
            } else if (coords[0]?.toString() === nextCoords[0]?.toString()) {
              coords = nextCoords.reverse().slice(0, -1).concat(coords);
              ways.splice(i, 1);
              changed = true;
              break;
            } else if (
              coords[coords.length - 1]?.toString() ===
              nextCoords[nextCoords.length - 1]?.toString()
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

    outerRings = buildRings([...outerWays]);
    innerRings = buildRings([...innerWays]);

    if (outerRings.length === 0) {
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

export default MagicWandPanel;
