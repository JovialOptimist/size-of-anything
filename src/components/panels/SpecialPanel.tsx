import React, { useState } from "react";
import SpecialShape from "../ui/SpecialShape";
import {
  SPECIAL_SHAPES_BY_CATEGORY,
  type SpecialShapeCategory,
} from "../../data/specialShapes";
import { FolderIcon, BackArrowIcon } from "../ui/Icons";

/**
 * Panel for Special features.
 * Contains predefined notable areas that users can add to the map, organized
 * as folders (one per category) - pick a folder, then pick a shape inside
 * it. The list itself lives in src/data/specialShapes.ts - see that file
 * for how to add a new shape.
 */
const SpecialPanel: React.FC = () => {
  const [openCategory, setOpenCategory] = useState<SpecialShapeCategory | null>(
    null
  );

  const openGroup = SPECIAL_SHAPES_BY_CATEGORY.find(
    (group) => group.category === openCategory
  );

  return (
    <div className="panel special-panel">
      {openGroup && (
        <div className="special-panel-toolbar">
          <button
            type="button"
            className="special-back-button"
            onClick={() => setOpenCategory(null)}
          >
            <BackArrowIcon />
            Back
          </button>
          <span className="special-panel-toolbar-title">
            {openGroup.category}
          </span>
        </div>
      )}
      <div className="special-panel-scroll">
        {!openGroup ? (
          <div className="special-shapes-grid">
            {SPECIAL_SHAPES_BY_CATEGORY.map(({ category, shapes }) => (
              <button
                key={category}
                type="button"
                className="special-folder-card"
                onClick={() => setOpenCategory(category)}
              >
                <span className="special-folder-icon" aria-hidden>
                  <FolderIcon />
                </span>
                <span className="special-folder-name">{category}</span>
                <span className="special-folder-count">
                  {shapes.length} shape{shapes.length === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="special-shapes-grid">
            {openGroup.shapes.map((shape) => (
              <SpecialShape
                key={shape.id}
                svgUrl={shape.svgUrl}
                name={shape.name}
                description={shape.description}
                widthInMeters={shape.widthInMeters}
                heightInMeters={shape.heightInMeters}
                variant="tile"
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecialPanel;
