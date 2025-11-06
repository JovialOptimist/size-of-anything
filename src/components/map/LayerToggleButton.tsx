// src/components/map/LayerToggleButton.tsx
/**
 * Button component that toggles between OSM and satellite map layers.
 * Allows users to switch between different map backgrounds.
 */
import { useState } from "react";
import { useSettings } from "../../state/settingsStore";

export default function LayerToggleButton() {
  const [showTooltip, setShowTooltip] = useState(false);
  const { mapLayerType, setMapLayerType } = useSettings();

  // Handle layer toggle
  const handleToggle = () => {
    const newLayerType = mapLayerType === "osm" ? "satellite" : "osm";
    setMapLayerType(newLayerType);
  };

  const isSatellite = mapLayerType === "satellite";
  const tooltipText = isSatellite ? "Switch to Map" : "Switch to Satellite";

  return (
    <div className="layer-toggle-button-container">
      <button
        className="layer-toggle-button map-controls icon-button"
        onClick={handleToggle}
        aria-label={tooltipText}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Globe icon for both states - clean and recognizable */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10"/>
          <path d="M2 12h20"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      </button>
      {showTooltip && (
        <div className="tooltip">
          {tooltipText}
        </div>
      )}
    </div>
  );
}