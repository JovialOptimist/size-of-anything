import React from "react";
import Card from "../utils/Card";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";

/**
 * Predefined notable areas with their GeoJSON data
 */
const SPECIAL_AREAS: GeoJSONFeature[] = [
  // Disneyland
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-117.9244, 33.8121],
          [-117.9244, 33.8153],
          [-117.9158, 33.8153],
          [-117.9158, 33.8121],
          [-117.9244, 33.8121],
        ],
      ],
    },
    properties: {
      name: "Disneyland Park",
      osmType: "relation",
      osmId: "2832548",
      osmClass: "tourism",
      whatIsIt: "Famous theme park in California",
    },
  },
  // Eiffel Tower
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [2.2936, 48.858],
          [2.2936, 48.8587],
          [2.295, 48.8587],
          [2.295, 48.858],
          [2.2936, 48.858],
        ],
      ],
    },
    properties: {
      name: "Eiffel Tower",
      osmType: "relation",
      osmId: "5013364",
      osmClass: "tourism",
      whatIsIt: "Iconic landmark in Paris, France",
    },
  },
  // Central Park
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [-73.9812, 40.7642],
          [-73.9812, 40.8003],
          [-73.9495, 40.8003],
          [-73.9495, 40.7642],
          [-73.9812, 40.7642],
        ],
      ],
    },
    properties: {
      name: "Central Park",
      osmType: "relation",
      osmId: "82287",
      osmClass: "leisure",
      whatIsIt: "Urban park in Manhattan, New York City",
    },
  },
  // Great Pyramid of Giza
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [31.1342, 29.9792],
          [31.1342, 29.9798],
          [31.1348, 29.9798],
          [31.1348, 29.9792],
          [31.1342, 29.9792],
        ],
      ],
    },
    properties: {
      name: "Great Pyramid of Giza",
      osmType: "way",
      osmId: "5465617",
      osmClass: "historic",
      whatIsIt: "Ancient Egyptian pyramid and wonder of the world",
    },
  },
  // Taj Mahal
  {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [78.0419, 27.1745],
          [78.0419, 27.1751],
          [78.0425, 27.1751],
          [78.0425, 27.1745],
          [78.0419, 27.1745],
        ],
      ],
    },
    properties: {
      name: "Taj Mahal",
      osmType: "relation",
      osmId: "2997734",
      osmClass: "historic",
      whatIsIt: "Marble mausoleum in Agra, India",
    },
  },
];

/**
 * Panel for Special features
 * Contains predefined notable areas that users can add to the map
 */
const SpecialPanel: React.FC = () => {
  return (
    <div className="panel special-panel">
      <h2>Special Places</h2>
      <div className="panel-description">
        Notable landmarks and interesting places from around the world. Click on
        any card to add it to your map.
      </div>

      <div className="special-areas-list">
        {SPECIAL_AREAS.map((area, index) => (
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
