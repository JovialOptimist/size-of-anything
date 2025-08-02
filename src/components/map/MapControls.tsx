import React from "react";
import { useSettings } from "../../state/settingsStore";

/**
 * Controls for the map view (zoom, layers, etc.)
 */
const MapControls: React.FC = () => {
  const handleShareClick = () => {
    // Logic to handle sharing the map view
    console.log("Share button clicked");
  };

  // If hovering, change the foreground color to white
  // If not hovering, change the foreground color to black
  const [isHovered, setIsHovered] = React.useState(false);

  // Assume dark mode is determined by a CSS class on body or a media query
  const theme = useSettings((state) => state.theme);
  const prefersDarkMode =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  const foregroundColor = isHovered
    ? "#ffffff"
    : prefersDarkMode
    ? "#cbd5e1"
    : "#000000";

  return (
    <button
      className="map-controls icon-button"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleShareClick}
    >
      <svg
        fill={foregroundColor}
        width="40px"
        height="40px"
        viewBox="0 0 50 50"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M15 30c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-8c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z" />
        <path d="M35 20c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-8c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z" />
        <path d="M35 40c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm0-8c-1.7 0-3 1.3-3 3s1.3 3 3 3 3-1.3 3-3-1.3-3-3-3z" />
        <path d="M19.007 25.885l12.88 6.44-.895 1.788-12.88-6.44z" />
        <path d="M30.993 15.885l.894 1.79-12.88 6.438-.894-1.79z" />
      </svg>
      <span>Share</span>
    </button>
  );
};

export default MapControls;
