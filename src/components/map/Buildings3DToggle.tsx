// src/components/map/Buildings3DToggle.tsx
/**
 * Component that allows users to toggle between different 3D buildings options.
 * Supports OSM Buildings and Google Photorealistic 3D Tiles.
 */
import { useState, useEffect, useRef } from "react";
import { useSettings, type Buildings3DType } from "../../state/settingsStore";

export default function Buildings3DToggle() {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { buildings3DType, setBuildings3DType, show3DBuildings, setShow3DBuildings } = useSettings();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const options: { value: Buildings3DType; label: string; description: string }[] = [
    { value: "disabled", label: "Disabled", description: "No 3D buildings" },
    { value: "osm", label: "OSM Buildings", description: "Basic 3D building outlines" },
    { value: "google", label: "Google 3D", description: "Photorealistic buildings & trees" },
  ];

  const handleOptionSelect = (type: Buildings3DType) => {
    setBuildings3DType(type);
    if (type !== "disabled") {
      setShow3DBuildings(true);
    } else {
      setShow3DBuildings(false);
    }
    setShowMenu(false);
  };

  const currentOption = options.find(opt => opt.value === buildings3DType) || options[0];
  const googleApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const willFallback = buildings3DType === "google" && !googleApiKey;

  return (
    <div className="buildings-toggle-container" ref={menuRef}>
      <button
        className="buildings-toggle-button map-controls icon-button"
        onClick={() => setShowMenu(!showMenu)}
        aria-label="3D Buildings Options"
      >
        {/* Building icon */}
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
          <rect x="6" y="14" width="4" height="6"/>
          <rect x="6" y="4" width="4" height="6"/>
          <rect x="14" y="9" width="4" height="11"/>
          <rect x="14" y="4" width="4" height="3"/>
        </svg>
      </button>
      
      {showMenu && (
        <div className="buildings-toggle-menu">
          <div className="menu-header">3D Buildings</div>
          {options.map((option) => (
            <button
              key={option.value}
              className={`menu-option ${buildings3DType === option.value ? "active" : ""}`}
              onClick={() => handleOptionSelect(option.value)}
            >
              <div className="option-label">{option.label}</div>
              <div className="option-description">{option.description}</div>
            </button>
          ))}
          {buildings3DType === "google" && !import.meta.env.VITE_GOOGLE_MAPS_API_KEY && (
            <div className="menu-warning">
              ⚠️ Google API key missing - using OSM fallback
            </div>
          )}
          {willFallback && (
            <div className="menu-info">
              ℹ️ Will automatically fall back to OSM Buildings
            </div>
          )}
        </div>
      )}
    </div>
  );
}