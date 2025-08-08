import React, { useMemo } from "react";
import Card from "./Card";
import {
  extractPathsFromSvg,
  getLongestPath,
  extractViewBox,
} from "./svgUtils";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { useMapStore } from "../../state/mapStore";
import { svgPathProperties } from "svg-path-properties";
import { countCoordinates } from "./geometryUtils";

interface SvgCardProps {
  svgUrl: string;
  svgContent: string;
  name: string;
  description: string;
  widthInMeters?: number;
  heightInMeters?: number;
  samplePoints?: number;
}

/**
 * A Card component that displays and converts an SVG to a GeoJSON feature
 * This allows for easy addition of SVG-based areas to the map
 */
const SvgCard: React.FC<SvgCardProps> = ({
  svgUrl,
  svgContent,
  name,
  description,
  widthInMeters = 100, // Default width if not specified
  heightInMeters = 100, // Default height if not specified
  samplePoints = 1000, // Default number of sample points
}) => {
  const currentMapCenter = useMapStore((state) => state.currentMapCenter);

  // Convert SVG to GeoJSON feature
  const geoJsonFeature = useMemo(() => {
    if (!currentMapCenter) return null;

    // Extract paths and viewBox
    const paths = extractPathsFromSvg(svgContent);
    const viewBox = extractViewBox(svgContent);

    // Use the longest path (typically the main outline)
    const pathData = getLongestPath(paths);

    if (!pathData) return null;

    // Calculate aspect ratio from viewBox if available
    let actualWidth = widthInMeters;
    let actualHeight = heightInMeters;

    if (viewBox) {
      const aspectRatio = viewBox.width / viewBox.height;
      if (widthInMeters && !heightInMeters) {
        actualHeight = widthInMeters / aspectRatio;
      } else if (heightInMeters && !widthInMeters) {
        actualWidth = heightInMeters * aspectRatio;
      }
    }

    // We'll still use the existing svgPathToGeoJSONFeature function, but now we call it with our extracted path
    return svgPathToGeoJSONFeature(
      pathData,
      actualWidth,
      actualHeight,
      [currentMapCenter[1], currentMapCenter[0]], // Flip coordinates as required by the function
      samplePoints,
      name,
      description
    );
  }, [
    currentMapCenter,
    svgContent,
    name,
    description,
    widthInMeters,
    heightInMeters,
    samplePoints,
  ]);

  // If we couldn't create a feature, return null
  if (!geoJsonFeature) return null;

  // Return a Card with the feature and the SVG as the icon
  return <Card feature={geoJsonFeature} iconUrl={svgUrl} />;
};

// Import the function from SpecialPanel to avoid circular dependencies
// In a real implementation, this should be moved to a shared utility file
function svgPathToGeoJSONFeature(
  svgPath: string,
  widthInMeters: number,
  heightInMeters: number,
  centerLatLng: [number, number], // [lng, lat] in degrees
  samplePoints: number = 100,
  featureDisplayName = "Custom Shape",
  whatIsIt = "Converted from SVG"
): GeoJSONFeature | null {
  console.log(
    `svgPathToGeoJSONFeature: Converting SVG path named ${featureDisplayName} to GeoJSON with ${samplePoints} sample points`
  );
  try {
    const [centerLng, centerLat] = centerLatLng;

    const props = new svgPathProperties(svgPath);
    const totalLength = props.getTotalLength();

    // Step 1: Sample points along the SVG path
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
      const y = ((p.y - minY) / bboxHeight - 0.5) * heightInMeters;
      return [x, y]; // in meters
    });

    // Step 4: Convert meters to lat/lng degrees
    const metersToLatLng = ([mx, my]: [number, number]): [number, number] => {
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
          "custom-" + featureDisplayName.toLowerCase().replace(/\s+/g, "-"),
        osmId: `svg-${Math.random().toString(36).slice(2)}`,
        osmClass: "svg-shape",
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

export default SvgCard;
