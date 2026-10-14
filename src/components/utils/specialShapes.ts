// src/components/utils/specialShapes.ts
/**
 * Special (non-geographic) comparison shapes such as whales and planes, plus the
 * SVG-to-GeoJSON conversion used to place them on the map.
 */
import { svgPathProperties } from "svg-path-properties";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { countCoordinates } from "./geometryUtils";
import { extractPathsFromSvg, getLongestPath } from "./svgUtils";
import { getSvgContent } from "./assetUtils";
import blueWhaleSvg from "../../assets/bluewhale.svg";
import boeingPlane737 from "../../assets/boeing-737.svg";
import boeingPlane777 from "../../assets/boeing-777-300ER.svg";
import titanicShip from "../../assets/titanicShip.svg";

export interface SpecialShapeDef {
  id: string;
  svgUrl: string;
  name: string;
  description: string;
  widthInMeters: number;
  heightInMeters: number;
}

export const SPECIAL_SHAPES: SpecialShapeDef[] = [
  {
    id: "blue-whale",
    svgUrl: blueWhaleSvg,
    name: "Blue Whale",
    description: "Largest known animal on Earth",
    widthInMeters: 10,
    heightInMeters: 28.5,
  },
  {
    id: "boeing-737",
    svgUrl: boeingPlane737,
    name: "Boeing 737",
    description: "Average-size plane for short flights",
    widthInMeters: 34.3,
    heightInMeters: 39.37,
  },
  {
    id: "boeing-777-300ER",
    svgUrl: boeingPlane777,
    name: "Boeing 777-300ER",
    description: "Bigger plane for long-haul flights",
    widthInMeters: 73.86,
    heightInMeters: 64.8,
  },
  {
    id: "titanic",
    svgUrl: titanicShip,
    name: "Titanic",
    description: "Famous British passenger liner",
    widthInMeters: 269.1,
    heightInMeters: 53.3,
  },
];

/** Build a placeable feature for a special shape centred on [lat, lng]. */
export async function buildSpecialShapeFeature(
  shape: SpecialShapeDef,
  center: [number, number]
): Promise<GeoJSONFeature | null> {
  const svg = await getSvgContent(shape.svgUrl);
  const path = getLongestPath(extractPathsFromSvg(svg));
  if (!path) return null;
  return svgPathToGeoJSONFeature(
    path,
    shape.widthInMeters,
    shape.heightInMeters,
    [center[1], center[0]],
    1000,
    shape.name,
    shape.description
  );
}

/** Convert an SVG path into a GeoJSON polygon of the given real-world size, centred on centerLatLng. */
export function svgPathToGeoJSONFeature(
  svgPath: string,
  widthInMeters: number,
  heightInMeters: number,
  centerLatLng: [number, number], // [lng, lat] in degrees
  samplePoints: number = 100,
  featureDisplayName = "Custom Shape",
  whatIsIt = "Converted from SVG"
): GeoJSONFeature | null {
  try {
    const [centerLng, centerLat] = centerLatLng;

    const props = new svgPathProperties(svgPath);
    const totalLength = props.getTotalLength();

    const rawPoints = Array.from({ length: samplePoints }, (_, i) =>
      props.getPointAtLength((i / (samplePoints - 1)) * totalLength)
    );

    // Step 2: Get bounding box dimensions of the raw SVG path
    const minX = Math.min(...rawPoints.map((p) => p.x));
    const maxX = Math.max(...rawPoints.map((p) => p.x));
    const minY = Math.min(...rawPoints.map((p) => p.y));
    const maxY = Math.max(...rawPoints.map((p) => p.y));
    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;

    // Step 3: Normalize and scale to meters
    const scaledToMeters: [number, number][] = rawPoints.map((p) => {
      const x = ((p.x - minX) / bboxWidth - 0.5) * widthInMeters; // center at 0
      const y = -((p.y - minY) / bboxHeight - 0.5) * heightInMeters;
      return [x, y]; // in meters
    });

    // Step 4: Convert meters to lat/lng degrees
    const metersToLatLng = ([mx, my]: [number, number]): [number, number] => {
      // Use a more stable calculation that's less affected by latitude
      const latOffset = my / 111_320; // meters per degree latitude
      const lngOffset = mx / (111_320 * Math.cos((centerLat * Math.PI) / 180));

      return [centerLng + lngOffset, centerLat + latOffset];
    };

    const geoPoints = scaledToMeters.map(metersToLatLng);

    // Step 5: Ensure polygon is closed
    const closedGeoPoints =
      JSON.stringify(geoPoints[0]) ===
      JSON.stringify(geoPoints[geoPoints.length - 1])
        ? geoPoints
        : [...geoPoints, geoPoints[0]];

    // Step 6: Return GeoJSON Feature
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [closedGeoPoints],
        coordinateCount: countCoordinates([closedGeoPoints]),
      },
      properties: {
        name: featureDisplayName,
        whatIsIt,
        osmType:
          "special-" + featureDisplayName.toLowerCase().replace(/\s+/g, "-"),
        osmId: `svg-${Math.random().toString(36).slice(2)}`,
        osmClass: "svg-shape",
        location: "",
      },
    };
  } catch (error) {
    console.error(
      `svgPathToGeoJSONFeature: Error occurred while converting SVG path to GeoJSON`,
      error
    );
    return null; // Return null if conversion fails
  }
}
