import React from "react";
import SpecialShape from "../ui/SpecialShape";
import { SPECIAL_SHAPES_BY_CATEGORY } from "../../data/specialShapes";

/**
 * Panel for Special features
 * Contains predefined notable areas that users can add to the map, grouped
 * into collapsible categories. The list itself lives in
 * src/data/specialShapes.ts - see that file for how to add a new shape.
 */
const SpecialPanel: React.FC = () => {
  return (
    <div className="panel special-panel">
      <div className="special-areas-list">
        {SPECIAL_SHAPES_BY_CATEGORY.map(({ category, shapes }) => (
          <details key={category} className="special-category" open>
            <summary className="special-category-header">
              {category}
              <span className="special-category-count">{shapes.length}</span>
            </summary>
            <div className="special-category-shapes">
              {shapes.map((shape) => (
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
          </details>
        ))}
      </div>
    </div>
  );
};

export default SpecialPanel;
