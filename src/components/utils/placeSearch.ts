// src/components/utils/placeSearch.ts
/**
 * Text search for real places (Nominatim), returned as placeable GeoJSON features.
 */
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { OSM_Type } from "../../state/mapStoreTypes";
import { fetchCandidates } from "../panels/TextSearchPanel";
import { countCoordinates, fixMultiPolygon } from "./geometryUtils";
import { describeOsmObject } from "./describeOsmObject";

/** The fields of a Nominatim result that are used here */
interface NominatimPlace {
  osm_type: string;
  osm_id: string;
  type: string;
  class: string;
  display_name: string;
  location?: string;
  geojson: { coordinates: GeoJSONFeature["geometry"]["coordinates"] };
}

export async function searchPlaces(query: string): Promise<GeoJSONFeature[]> {
  const raw: NominatimPlace[] = await fetchCandidates(query);
  return raw.map((place) => {
    const feature: GeoJSONFeature = {
      type: "Feature",
      geometry: {
        type: place.osm_type === OSM_Type.WAY ? "Polygon" : "MultiPolygon",
        coordinates: place.geojson.coordinates,
        coordinateCount: countCoordinates(place.geojson.coordinates),
      },
      properties: {
        name: place.display_name,
        osmType: place.type,
        osmId: place.osm_id,
        osmClass: place.class,
        location: place.location,
        whatIsIt: describeOsmObject(place),
      },
    };
    return fixMultiPolygon(feature);
  });
}
