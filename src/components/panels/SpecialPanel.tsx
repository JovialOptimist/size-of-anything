import React from "react";
import SpecialShape from "../ui/SpecialShape";
import blueWhaleSvg from "../../assets/bluewhale.svg";
import boeingPlane737 from "../../assets/boeing-737.svg";
import boeingPlane777 from "../../assets/boeing-777-300ER.svg";
import titanicShip from "../../assets/titanicShip.svg";
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

  return (
    <div className="panel special-panel">
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
    </div>
  );
};

export default SpecialPanel;
