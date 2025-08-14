import React from "react";
import SpecialShape from "../ui/SpecialShape";
import blueWhaleSvg from "../../assets/bluewhale.svg";
import boeingPlane737 from "../../assets/boeing-737.svg";
import boeingPlane777 from "../../assets/boeing-777-300ER.svg";
import { InformationBubble } from "../ui/informationBubble";
import { DismissableMessage } from "../ui/DismissableMessage";

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
      svgUrl: boeingPlane737,
      name: "Boeing 737",
      description: "Most popular commercial aircraft",
      widthInMeters: 34.3,
      heightInMeters: 39.37,
    },
    {
      id: "boeing-777-300ER",
      svgUrl: boeingPlane777,
      name: "Boeing 777-300ER",
      description: "Bigger plane meant for long-haul flights",
      widthInMeters: 73.86,
      heightInMeters: 64.8,
    },
  ];

  return (
    <div className="panel special-panel">
      <div className="panel-header">
        <h2>
          Treasure<span className="keybind-text">T</span>
        </h2>
        <InformationBubble message="These are special shapes that you can add to the map. If you have suggestions for a special shape you'd like to see added to the Size of Anything, use the Feature Request option!" />
      </div>
      <div className="panel-description">
        Cool shapes and areas that you've unlocked so far!
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
      <DismissableMessage messageId="special-area-center-info">
        <p>
          The new area will be placed at the center of your current map view.
        </p>
      </DismissableMessage>
    </div>
  );
};

export default SpecialPanel;
