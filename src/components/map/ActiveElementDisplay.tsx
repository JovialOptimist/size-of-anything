// src/components/map/ActiveElementDisplay.tsx
/**
 * Component that displays information about the currently active map element.
 * Shows area details, controls for manipulation, and enables shape rotation.
 */
import React, { useState, useRef, useEffect } from "react";
import { usePanel } from "../../state/panelStore";
import { useMapStore } from "../../state/mapStore";
import { useSettings } from "../../state/settingsStore";
import "../../styles/ActiveElementDisplay.css";
import "../../styles/RotationControl.css";
import "../../styles/CloseButton.css";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import { applyRotation } from "../utils/transformUtils";
import { getExistingColors } from "../utils/colorUtils";
import { getContinent } from "../utils/countryHelper"; // Assuming this function exists
import { countCoordinates } from "../utils/geometryUtils";
import RotationWheel from "../ui/RotationWheel";

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
  const { useMetricUnits } = useSettings();

  const activeElement = getActiveElement();
  const currentColor = activeElement?.properties?.color || "#1f77b4";
  // Update rotation angle and name when active element changes
  useEffect(() => {
    if (activeElement) {
      setRotationAngle(activeElement.properties?.rotation || 0);
      setElementName(activeElement.properties?.name || "Unnamed Area");
    }
  }, [activeElement]);
  const [selectedColor, setSelectedColor] = useState(currentColor);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  // Rotation now handled directly by the wheel
  const [rotationAngle, setRotationAngle] = useState(
    activeElement?.properties?.rotation || 0
  );
  const [displayName, setElementName] = useState(
    activeElement?.properties?.name || "Unnamed Area"
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const duplicateArea = useMapStore((state: any) => state.duplicateArea);
  const updateElementRotation = useMapStore(
    (state: any) => state.updateElementRotation
  );
  const updateElementName = useMapStore(
    (state: any) => state.updateElementName
  );

  const colorPickerRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  // Ensure proper positioning and sizing
  useEffect(() => {
    const adjustDisplayPosition = () => {
      if (displayRef.current) {
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
        const controlPanelWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--control-panel-width'));
        
        // Calculate available width for the display
        let availableWidth: number;
        let leftPosition: number;
        
        if (activePanel) {
          // Sidebar is expanded - position to the right of both sidebars
          const panelElement = document.querySelector('.control-sidebar') as HTMLElement;
          const actualPanelWidth = panelElement ? panelElement.offsetWidth : controlPanelWidth;
          
          leftPosition = sidebarWidth + actualPanelWidth + 20; // 20px spacing
          availableWidth = window.innerWidth - leftPosition - 20; // 20px from right edge
        } else {
          // Sidebar is collapsed - position to the right of icon sidebar only
          leftPosition = sidebarWidth + 20; // 20px spacing
          availableWidth = window.innerWidth - leftPosition - 20; // 20px from right edge
        }
        
        // Apply constraints
        const maxWidth = Math.min(400, availableWidth); // 400px is the desired max-width
        
        // Update styles
        displayRef.current.style.left = `${leftPosition}px`;
        displayRef.current.style.width = `${maxWidth}px`;
        displayRef.current.style.maxWidth = `${availableWidth}px`;
      }
    };
    
    // Adjust on component mount, panel change, and window resize
    adjustDisplayPosition();
    window.addEventListener('resize', adjustDisplayPosition);
    
    return () => {
      window.removeEventListener('resize', adjustDisplayPosition);
    };
  }, [activePanel]);

  // Rotation now handled directly by the wheel component

  // Close popups if clicking outside of them
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target as Node)
      ) {
        setIsColorPickerOpen(false);
      }

      // Rotation popup has been removed
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

  // Conversion factors
  const KM2_TO_MI2 = 0.386102; // 1 km² = 0.386102 sq mi
  const M2_TO_SQFT = 10.7639; // 1 m² = 10.7639 sq ft

  const areaSize = useMetricUnits
    ? // Metric units
      areaSizeNum >= 1e6
      ? formatNumberWithCommas(Number((areaSizeNum / 1e6).toFixed(2))) +
        " million km²"
      : areaSizeNum >= 1e3
      ? formatNumberWithCommas(Number(areaSizeNum.toFixed(0))) + " km²"
      : areaSizeNum < 0.1
      ? (areaSizeNum * 1e6).toFixed(0) + " m²"
      : areaSizeNum.toFixed(2) + " km²"
    : // Imperial units
    areaSizeNum >= 1e6
    ? formatNumberWithCommas(
        Number(((areaSizeNum / 1e6) * KM2_TO_MI2).toFixed(2))
      ) + " million sq mi"
    : areaSizeNum >= 1e3
    ? formatNumberWithCommas(Number((areaSizeNum * KM2_TO_MI2).toFixed(0))) +
      " sq mi"
    : areaSizeNum < 0.1
    ? formatNumberWithCommas(
        Number((areaSizeNum * 1e6 * M2_TO_SQFT).toFixed(0))
      ) + " sq ft"
    : formatNumberWithCommas(Number((areaSizeNum * KM2_TO_MI2).toFixed(2))) +
      " sq mi";

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

  // Rotation is now handled by the RotationWheel component

  return (
    <div className={`${displayClass} active-element-panel`} ref={displayRef}>
      <div className="element-info">
        <div className="element-header">
          <div className="element-title">
            {isEditingName ? (
              <div className="element-name-edit">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={displayName}
                  onChange={(e) => setElementName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      updateElementName(activeAreaId, displayName);
                      setIsEditingName(false);
                    } else if (e.key === "Escape") {
                      setElementName(
                        activeElement.properties?.name || "Unnamed Area"
                      );
                      setIsEditingName(false);
                    }
                  }}
                  onBlur={() => {
                    updateElementName(activeAreaId, displayName);
                    setIsEditingName(false);
                  }}
                  autoFocus
                />
              </div>
            ) : (
              <div className="element-name-display">
                <h3
                  onClick={() => {
                    setIsEditingName(true);
                    setTimeout(() => nameInputRef.current?.focus(), 0);
                  }}
                  style={{ cursor: "pointer" }}
                >
                  {displayName}
                </h3>
                <button
                  className="edit-name-button"
                  onClick={() => {
                    setIsEditingName(true);
                    setTimeout(() => nameInputRef.current?.focus(), 0);
                  }}
                  title="Edit name"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                  </svg>
                </button>
              </div>
            )}
          </div>
          <div className="element-controls">
            <button
              className="close-button"
              onClick={() => setActiveArea(null)}
            >
              &times;
            </button>
          </div>
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

        {/* New layout for description and rotation wheel */}
        <div className="description-rotation-container">
          <div className="element-description">
            <p>
              <i>
                {elementType.replace("_", " ")}{" "}
                {(() => {
                  let location = "";
                  if (elementType.toLowerCase() !== "country") {
                    location = activeElement?.properties?.location;
                  } else {
                    location = getContinent(displayName) || "";
                  }
                  return location ? `in ${location}` : "";
                })()}
              </i>
            </p>
            <p>
              <strong>Area:</strong> {areaSize}
            </p>
          </div>

          <RotationWheel
            rotationAngle={rotationAngle}
            onChange={(angle) => {
              // Only update if the angle has actually changed by a significant amount
              if (Math.abs(angle - rotationAngle) >= 1) {
                setRotationAngle(angle);

                // Get the active element to apply rotation to its current position
                const element = getActiveElement();
                if (element && activeAreaId) {
                  // Apply rotation to the current position and store the result
                  // This ensures rotation is only applied when explicitly changed
                  try {
                    // Only rotate if we have an element and a valid angle
                    if (angle !== 0) {
                      // Make sure we use the current coordinates as the base for rotation
                      // This ensures the shape rotates in place instead of teleporting
                      const baseCoordinates =
                        element.geometry.currentCoordinates ||
                        element.geometry.coordinates;

                      // Apply rotation using the current position as the base
                      const rotated = applyRotation(
                        element,
                        angle,
                        baseCoordinates
                      );
                      // Store both the rotation angle and the pre-calculated rotated coordinates
                      updateElementRotation(
                        activeAreaId,
                        angle,
                        rotated.geometry.coordinates
                      );
                    } else {
                      // For zero rotation, just clear any rotation
                      updateElementRotation(activeAreaId, 0);
                    }
                  } catch (error) {
                    console.error("Error applying rotation:", error);
                    updateElementRotation(activeAreaId, angle);
                  }
                } else {
                  updateElementRotation(activeAreaId, angle);
                }
              }
            }}
            size={60}
          />
        </div>

        {/* Updated button group with all buttons in a single row */}
        <div className="button-group">
          <button
            className="icon-action-button"
            onClick={handleDuplicate}
            title="Duplicate"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>

          <button
            className="icon-action-button"
            onClick={() => setIsColorPickerOpen((prev) => !prev)}
            title="Change Color"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
            </svg>
          </button>

          <button
            className="icon-action-button remove-btn"
            onClick={handleRemove}
            title="Remove"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 6h18"></path>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
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
