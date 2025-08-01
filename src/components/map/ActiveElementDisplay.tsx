import React, { useState, useRef, useEffect } from "react";
import { usePanel } from "../../state/panelStore";
import { useMapStore } from "../../state/mapStore";
import "../../styles/ActiveElementDisplay.css";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import { getExistingColors } from "../utils/colorUtils";
import { getContinent } from "../utils/countryHelper"; // Assuming this function exists

const ActiveElementDisplay: React.FC = () => {
  const { activePanel } = usePanel();
  const activeAreaId = useMapStore((state: any) => state.activeAreaId);
  const getActiveElement = useMapStore((state: any) => state.getActiveElement);
  const setActiveArea = useMapStore((state: any) => state.setActiveArea);
  const updateElementColor = useMapStore(
    (state: any) => state.updateElementColor
  );
  const removeArea = useMapStore((state: any) => state.removeArea);
  const presetColors = getExistingColors();

  const activeElement = getActiveElement();
  const currentColor = activeElement?.properties?.color || "#1f77b4";
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const duplicateArea = useMapStore((state: any) => state.duplicateArea);

  const colorPickerRef = useRef<HTMLDivElement>(null);

  // Close popup if clicking outside of it
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      ) {
        setIsColorPickerOpen(false);
      }
    }
    if (isColorPickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isColorPickerOpen]);

  const displayClass = activePanel
    ? "active-element-display sidebar-expanded"
    : "active-element-display sidebar-collapsed";

  if (!activeElement || !activeAreaId) {
    return <div className={`active-element-empty`}></div>;
  }

  const areaSizeNum = calculateAreaInKm2(activeElement);
  // Format with million suffix
  const formatNumberWithCommas = (num: number) =>
    num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  const areaSize =
    areaSizeNum >= 1e6
      ? formatNumberWithCommas(Number((areaSizeNum / 1e6).toFixed(2))) +
        " million km²"
      : areaSizeNum >= 1e3
      ? formatNumberWithCommas(Number(areaSizeNum.toFixed(0))) + " km²"
      : areaSizeNum < 0.1
      ? (areaSizeNum * 1e6).toFixed(0) + " m²"
      : areaSizeNum.toFixed(2) + " km²";

  const elementName = activeElement.properties?.name || "Unnamed Area";
  const elementType =
    activeElement.properties?.whatIsIt ||
    activeElement.properties?.osmClass ||
    "Unknown";

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    updateElementColor(activeAreaId, color);
    setIsColorPickerOpen(false); // close after selection
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setSelectedColor(color);
    updateElementColor(activeAreaId, color);
    setIsColorPickerOpen(false);
  };

  const handleDuplicate = () => {
    if (activeAreaId) {
      duplicateArea(activeAreaId);
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
        <div className="element-header">
          <h3>{elementName.split(",")[0]}</h3>
          <button className="close-button" onClick={() => setActiveArea(null)}>
            &times;
          </button>
        </div>

        {isColorPickerOpen && (
          <div className="color-picker-popup" ref={colorPickerRef}>
            <div className="color-picker-buttons">
              {presetColors.map((color) => (
                <button
                  key={color}
                  className="color-button"
                  style={{
                    backgroundColor: color,
                    border:
                      selectedColor === color
                        ? "3px solid black"
                        : "1px solid #ccc",
                  }}
                  onClick={() => handleColorSelect(color)}
                />
              ))}
              <label className="custom-color-label">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={handleCustomColorChange}
                  className="custom-color-input"
                />
              </label>
            </div>
          </div>
        )}

        <p>
          <i>
            {elementType.replace("_", " ")} in{" "}
            {(elementType.toLowerCase() !== "country"
              ? elementName
                  .split(",")
                  .slice(1)
                  .filter(Boolean)
                  .slice(-5)
                  .join(", ")
              : getContinent(elementName.split(",")[0])) || "Unknown"}
          </i>
        </p>
        <p>
          <strong>Area:</strong> {areaSize}
        </p>

        <div className="button-group">
          <button onClick={handleDuplicate}>Duplicate</button>
          <button onClick={() => setIsColorPickerOpen((prev) => !prev)}>
            Change Color
          </button>
          <button onClick={handleRemove}>Remove</button>
        </div>
      </div>
    </div>
  );
};

export default ActiveElementDisplay;
