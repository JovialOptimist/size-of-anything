import React from "react";
import SpecialShape from "../utils/SpecialShape";
import blueWhaleSvg from "../../assets/bluewhale.svg";
import boeingPlane from "../../assets/boeing-737.svg";
import { InformationBubble } from "../ui/informationBubble";

/**
 * Panel for Special features
 * Contains predefined notable areas that users can add to the map
 */
const SpecialPanel: React.FC = () => {
  // Define the special shapes we want to display
  const specialShapes = [
    {
      id: "blue-whale",
      svgUrl: blueWhaleSvg,
      name: "Blue Whale",
      description: "Largest animal on Earth",
      widthInMeters: 10,
      heightInMeters: 28.5,
    },
    {
      id: "boeing-737",
      svgUrl: boeingPlane,
      name: "Boeing 737",
      description: "Popular commercial aircraft",
      widthInMeters: 34.3,
      heightInMeters: 39.37,
    },
  ];

  return (
    <div className="panel special-panel">
      <div className="panel-header">
        <h2>
          Special Shapes<span className="keybind-text">S</span>
        </h2>
        <InformationBubble message="These are special shapes that you can add to the map. If you have suggestions for a special shape you'd like to see added to the Size of Anything, use the Feature Request option!" />
      </div>
      <div className="panel-description">
        Notable shapes and areas that you've unlocked so far.
      </div>

      <div className="special-areas-list">
        {specialShapes.map((shape) => (
          <SpecialShape
            key={shape.id}
            svgUrl={shape.svgUrl}
            name={shape.name}
            description={shape.description}
            widthInMeters={shape.widthInMeters}
            heightInMeters={shape.heightInMeters}
          />
        ))}
      </div>
      <div className="custom-area-info">
        <p>
          The special area will be placed at the center of your current map
          view.
        </p>
      </div>
    </div>
  );
};

export default SpecialPanel;
