import React, { useState } from "react";
import { usePanel } from "../../state/panelStore";
import { useMapStore } from "../../state/mapStore";
import "../../styles/ActiveElementDisplay.css";

/**
 * Displays information about the active element on the map
 */
const ActiveElementDisplay: React.FC = () => {
  const { activePanel } = usePanel();
  const activeAreaId = useMapStore((state: any) => state.activeAreaId);
  const getActiveElement = useMapStore((state: any) => state.getActiveElement);
  const calculateAreaInKm2 = useMapStore(
    (state: any) => state.calculateAreaInKm2
  );
  const updateElementColor = useMapStore(
    (state: any) => state.updateElementColor
  );
  const removeArea = useMapStore((state: any) => state.removeArea);

  const [colorInput, setColorInput] = useState("");

  const displayClass = activePanel
    ? "active-element-display sidebar-expanded"
    : "active-element-display sidebar-collapsed";

  const activeElement = getActiveElement();

  if (!activeElement || !activeAreaId) {
    return <div className={`active-element-empty`}></div>;
  }

  const areaSize = calculateAreaInKm2(activeElement);
  const currentColor = activeElement.properties?.color || "blue";
  const elementName = activeElement.properties?.name || "Unnamed Area";
  const elementType =
    activeElement.properties?.whatIsIt ||
    activeElement.properties?.osmClass ||
    "Unknown";

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColorInput(newColor);

    // If using the color picker, apply the change immediately
    if (e.target.type === "color" && activeAreaId) {
      updateElementColor(activeAreaId, newColor);
    }
  };

  const applyColorChange = () => {
    if (colorInput && activeAreaId) {
      updateElementColor(activeAreaId, colorInput);
      setColorInput("");
    }
  };

  const handleRemove = () => {
    if (activeAreaId) {
      removeArea(activeAreaId);
    }
  };

  return (
    <div className={`${displayClass} active-element-panel`}>
      <div className="element-info">
        <p>
          <strong>{elementName.split(",")[0]}</strong>
        </p>
        <p>
          <i>
            {elementType} in {elementName.split(",")[1]}
          </i>
        </p>
        <p>
          <strong>Area:</strong> {areaSize} km²
        </p>

        <div className="color-display">
          <strong>Color:</strong>
          <div
            className="color-preview"
            style={{ backgroundColor: currentColor }}
          ></div>
          <span>{currentColor}</span>
        </div>

        {/* <div className="color-change">
          <div className="color-input-group">
            <input
              type="color"
              value={colorInput || currentColor}
              onChange={handleColorChange}
              className="color-picker"
            />
            <input
              type="text"
              placeholder="Enter color name or hex"
              value={colorInput}
              onChange={handleColorChange}
              className="color-text"
            />
          </div>
          <button onClick={applyColorChange}>Change Color</button>
        </div> */}

        <button className="remove-element-btn" onClick={handleRemove}>
          Remove from Map
        </button>
      </div>
    </div>
  );
};

export default ActiveElementDisplay;
