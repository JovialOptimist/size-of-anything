import React from "react";
import SpecialShape from "../utils/SpecialShape";
import blueWhaleSvg from "../../assets/bluewhale.svg";
import boeingPlane from "../../assets/boeing-737.svg";
import minecraftChunk from "../../assets/minecraft-chunk.svg"; // Assuming you have this SVG
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
    {
      id: "minecraft-chunk",
      svgUrl: minecraftChunk,
      name: "Minecraft Chunk",
      description: "A 16x16 block area in Minecraft",
      widthInMeters: 16,
      heightInMeters: 16,
    },
    // Add more special shapes here as needed
    // Example:
    // {
    //   id: "elephant",
    //   svgUrl: elephantSvg,
    //   name: "African Elephant",
    //   description: "Largest land animal",
    //   widthInMeters: 10.5,
    //   heightInMeters: 6.2,
    // },
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
