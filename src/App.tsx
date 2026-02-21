// src/App.tsx
/**
 * Main application component for Size of Anything.
 * Composes the UI layout including map, creation panel, and controls that allow users
 * to compare and visualize the sizes of different areas on a map.
 */
import { useState, useEffect } from "react";
import MapView from "./components/map/MapView";
import ActiveElementDisplay from "./components/map/ActiveElementDisplay";
import useUrlSync from "./state/urlSync";
import { useSettings, applyTheme } from "./state/settingsStore";
import ThemeInitializer from "./components/ThemeInitializer";
import KeyboardHandler from "./components/KeyboardHandler";
import ShareButton from "./components/map/ShareButton";
import FeedbackButton from "./components/map/FeedbackButton";
import LayerToggleButton from "./components/map/LayerToggleButton";
import CreationPanel from "./components/creation/CreationPanel";
import EllipsisMenu, { type RightSidebarContent } from "./components/EllipsisMenu";
import RightSidebar from "./components/RightSidebar";

function App() {
  useUrlSync();
  const { theme } = useSettings();
  const [rightSidebar, setRightSidebar] = useState<RightSidebarContent>(null);

  useEffect(() => {
    console.log("--- SIZE OF ANYTHING APP STARTED ---");

    // Apply theme on initial load
    applyTheme(theme);

    // Listen for system theme changes if using system setting
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  return (
    <div className="app-container">
      {/* Initialize theme */}
      <ThemeInitializer />

      {/* Handle keyboard shortcuts */}
      <KeyboardHandler />

      {/* Main map area - full viewport */}
      <div className="map-view-container">
        <MapView />
        <EllipsisMenu onSelect={setRightSidebar} />
        <CreationPanel />
        <ActiveElementDisplay />
        <ShareButton />
        <FeedbackButton />
        <LayerToggleButton />
      </div>

      <RightSidebar content={rightSidebar} onClose={() => setRightSidebar(null)} />
    </div>
  );
}

export default App;
