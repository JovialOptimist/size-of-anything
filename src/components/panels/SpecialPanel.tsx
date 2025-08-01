import React, { useMemo } from "react";
import { svgPathProperties } from "svg-path-properties";
import Card from "../utils/Card";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { useMapStore } from "../../state/mapStore";

function svgPathToGeoJSONFeature(
  svgPath: string,
  widthInMeters: number,
  heightInMeters: number,
  centerLatLng: [number, number], // [lng, lat] in degrees
  samplePoints: number = 100,
  featureDisplayName = "Custom Shape",
  whatIsIt = "Converted from SVG"
): GeoJSONFeature {
  console.error(
    `svgPathToGeoJSONFeature: Converting SVG path to GeoJSON with ${samplePoints} sample points`
  );
  console.error(
    `Called with params: ${JSON.stringify({
      svgPath,
      widthInMeters,
      heightInMeters,
      centerLatLng,
      samplePoints,
      featureDisplayName,
      whatIsIt,
    })}`
  );
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
    },
    properties: {
      name: featureDisplayName,
      whatIsIt,
      osmType: "custom",
      osmId: `svg-${Math.random().toString(36).slice(2)}`,
      osmClass: "svg-shape",
    },
  };
}

const flipCoordinates = (coordinates: [number, number]): [number, number] => {
  return [coordinates[1], coordinates[0]];
};

/**
 * Predefined notable areas with their GeoJSON data
 */
const blueWhalePath = "";

/**
 * Panel for Special features
 * Contains predefined notable areas that users can add to the map
 */
const SpecialPanel: React.FC = () => {
  const currentMapCenter = useMapStore((state) => state.currentMapCenter);

  // Only generate special areas when the panel is rendered and map center is available
  const specialAreas = useMemo(() => {
    if (!currentMapCenter) return [];
    return [
      svgPathToGeoJSONFeature(
        blueWhalePath,
        8.7,
        28.5,
        flipCoordinates(currentMapCenter),
        100,
        "Blue Whale",
        "Largest animal on Earth"
      ),
    ];
  }, [currentMapCenter]);

  return (
    <div className="panel special-panel">
      <h2>Special Places</h2>
      <div className="panel-description">
        Notable landmarks and interesting places from around the world. Click on
        any card to add it to your map.
      </div>

      <div className="special-areas-list">
        {specialAreas.map((area, index) => (
          <Card key={`special-${index}`} feature={area} />
        ))}
      </div>

      <div className="special-note">
        <p>More special places coming soon!</p>
      </div>
    </div>
  );
};

export default SpecialPanel;
