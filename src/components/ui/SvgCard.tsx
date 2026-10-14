// src/components/ui/SvgCard.tsx
/**
 * Card component that renders SVG content as a selectable shape.
 * Converts SVG paths to map polygons for display on the map.
 */
import React, { useMemo } from "react";
import Card from "./Card";
import {
  extractPathsFromSvg,
  getLongestPath,
  extractViewBox,
} from "../utils/svgUtils";
import { useMapStore } from "../../state/mapStore";
import { svgPathToGeoJSONFeature } from "../utils/specialShapes";

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

export default SvgCard;
