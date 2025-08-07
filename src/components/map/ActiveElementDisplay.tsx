import React, { useState, useRef, useEffect } from "react";
import { usePanel } from "../../state/panelStore";
import { useMapStore } from "../../state/mapStore";
import "../../styles/ActiveElementDisplay.css";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import { getExistingColors } from "../utils/colorUtils";
import { getContinent } from "../utils/countryHelper"; // Assuming this function exists
import { countCoordinates } from "../utils/geometryUtils";

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
              <ColorPickerButton
                onConfirm={(color) => {
                  presetColors.push(color); // optional: store it
                  setSelectedColor(color);
                  updateElementColor(activeAreaId, color);
                  setIsColorPickerOpen(false);
                }}
                onChange={(color) => {
                  setSelectedColor(color);
                  const activeElement = getActiveElement();
                  if (activeElement && activeElement.geometry) {
                    // Count coordinates in the geometry
                    const coordinateCount = countCoordinates(
                      activeElement.geometry.coordinates
                    );

                    // Only update visual feedback if there are 10000 or fewer points
                    if (coordinateCount <= 1000) {
                      // Always update the actual color regardless of coordinate count
                      updateElementColor(activeAreaId, color);
                    }
                  }
                }}
              />
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
            Color
          </button>
          <button onClick={handleRemove}>Remove</button>
        </div>
      </div>
    </div>
  );
};

type ColorPickerButtonProps = {
  onConfirm: (color: string) => void;
  onChange: (color: string) => void;
};

function ColorPickerButton({ onConfirm, onChange }: ColorPickerButtonProps) {
  const colorInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tempColor, setTempColor] = useState<string | null>(null);

  // Open native picker and measure position
  const handleOpenPicker = () => {
    setIsOpen(true);
    setTimeout(() => colorInputRef.current?.click(), 0);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempColor(e.target.value);
    onChange(e.target.value);
  };

  const handleConfirm = () => {
    if (tempColor) {
      onConfirm(tempColor);
    }
    setIsOpen(false);
    setTempColor(null);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={buttonRef}
        className="color-button"
        style={{
          backgroundColor: tempColor || "#ffffff",
          color: tempColor
            ? (() => {
                // Calculate luminance to decide black or white text
                const hex = tempColor.replace("#", "");
                const r = parseInt(hex.substring(0, 2), 16);
                const g = parseInt(hex.substring(2, 4), 16);
                const b = parseInt(hex.substring(4, 6), 16);
                // Standard luminance formula
                const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                return luminance > 0.5 ? "#000" : "#fff";
              })()
            : "#000",
          border: "1px solid #ccc",
        }}
        onClick={isOpen ? handleConfirm : handleOpenPicker}
        title={isOpen ? "Confirm custom color" : "Pick a custom color"}
      >
        {isOpen ? " " : "+"}
      </button>
      {isOpen && (
        <button onClick={handleConfirm} className="confirm-button">
          Confirm Color
        </button>
      )}

      {/* Hidden native input */}
      <input
        type="color"
        className="color-input"
        ref={colorInputRef}
        onChange={handleColorChange}
        style={{
          backgroundColor: "transparent",
          borderColor: "transparent",
        }}
      />
    </div>
  );
}

export default ActiveElementDisplay;
