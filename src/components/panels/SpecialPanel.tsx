import React from "react";
import SpecialShape from "../ui/SpecialShape";
import { SPECIAL_SHAPES_WITH_SVG } from "../../data/specialShapes";

/**
 * Panel for Special features
 * Contains predefined notable areas that users can add to the map.
 * The list itself lives in src/data/specialShapes.ts - see that file
 * for how to add a new shape.
 */
const SpecialPanel: React.FC = () => {
  return (
    <div className="panel special-panel">
      <div className="special-areas-list">
        {SPECIAL_SHAPES_WITH_SVG.map((shape) => (
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
