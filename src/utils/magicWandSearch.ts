/**
 * Shared magic-wand search: fetch features at a map point using Overpass + Nominatim.
 */
import type { GeoJSONFeature } from "../state/mapStoreTypes";
import { countCoordinates, fixMultiPolygon } from "../components/utils/geometryUtils";
import { describeOsmObject } from "../components/utils/describeOsmObject";

export async function fetchFeaturesAtPoint(lat: number, lng: number): Promise<GeoJSONFeature[]> {
  const features = await fetchFeaturesUsingOverpass(lat, lng);
  return organizeFeatures(features);
}

async function fetchFeaturesUsingOverpass(lat: number, lng: number): Promise<GeoJSONFeature[]> {
  const distance = 25;
  const query = `
    [out:json][timeout:25];
    (
      is_in(${lat}, ${lng});
      way(around:${distance},${lat},${lng});
      relation(around:${distance},${lat},${lng});
    );
    out body;
  `;

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) throw new Error(`Overpass API error: ${response.statusText}`);

  const data = await response.json();
  const candidates = data.elements.filter(
    (el: any) => (el.type === "way" || el.type === "relation") && el.tags
  );

  if (candidates.length === 0) return [];

  const nominatimIds = candidates.map((el: any) => `${el.type === "way" ? "W" : "R"}${el.id}`);
  const batchSize = 50;
  const features: GeoJSONFeature[] = [];

  for (let i = 0; i < nominatimIds.length; i += batchSize) {
    const batch = nominatimIds.slice(i, i + batchSize);
    const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${batch.join(",")}&format=json&polygon_geojson=1&extratags=1`;
    const res = await fetch(url);
    if (!res.ok) continue;

    const places = await res.json();
    for (const place of places) {
      if (!place.geojson || (place.geojson.type !== "Polygon" && place.geojson.type !== "MultiPolygon")) continue;
      const feature: GeoJSONFeature = {
        type: "Feature",
        geometry: {
          type: place.geojson.type === "Polygon" ? "Polygon" : "MultiPolygon",
          coordinates: place.geojson.coordinates,
          coordinateCount: countCoordinates(place.geojson.coordinates),
        },
        properties: {
          name: place.display_name,
          osmType: place.osm_type,
          osmId: place.osm_id?.toString(),
          osmClass: place.class,
          whatIsIt: describeOsmObject(place),
          source: place.address && (place.address.city || place.address.county || place.address.state) ? "containing" : "nearby",
          adminLevel: place.extratags?.admin_level ? parseInt(place.extratags.admin_level, 10) : 0,
          tags: place.extratags || {},
        },
      };
      features.push(fixMultiPolygon(feature));
    }
  }

  return features;
}

function organizeFeatures(features: GeoJSONFeature[]): GeoJSONFeature[] {
  const containing = features
    .filter((f) => f.properties?.source === "containing")
    .sort((a, b) => (a.properties?.adminLevel ?? 15) - (b.properties?.adminLevel ?? 15));

  const typeOrder: Record<string, number> = {
    building: 1,
    amenity: 2,
    shop: 3,
    leisure: 4,
    natural: 5,
    landuse: 6,
    default: 10,
  };

  const nearby = features
    .filter((f) => f.properties?.source === "nearby")
    .sort((a, b) => {
      const tagsA = a.properties?.tags || {};
      const tagsB = b.properties?.tags || {};
      const getVal = (t: Record<string, unknown>) => {
        for (const k of Object.keys(typeOrder)) {
          if (k !== "default" && t[k]) return typeOrder[k];
        }
        return typeOrder.default;
      };
      return getVal(tagsA) - getVal(tagsB);
    });

  return [...containing, ...nearby];
}
