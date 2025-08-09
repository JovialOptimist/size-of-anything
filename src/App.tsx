// src/App.tsx
/**
 * Main application component for Size of Anything.
 * Composes the UI layout including map, sidebars, and controls that allow users
 * to compare and visualize the sizes of different areas on a map.
 */
import IconSidebar from "./components/sidebar/IconSidebar";
import ControlSidebar from "./components/sidebar/ControlSidebar";
import MapView from "./components/map/MapView";
import ActiveElementDisplay from "./components/map/ActiveElementDisplay";
import useUrlSync from "./state/urlSync";
import { useEffect } from "react";
import { useSettings, applyTheme } from "./state/settingsStore";
import ThemeInitializer from "./components/ThemeInitializer";
import KeyboardHandler from "./components/KeyboardHandler";
import ShareButton from "./components/map/ShareButton";
import FeedbackButton from "./components/map/FeedbackButton";

function App() {
  // Use the URL sync hook to synchronize state with URL
  useUrlSync();
  const { theme } = useSettings();

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

      {/* Left sidebar with tool icons */}
      <IconSidebar />
      {/* Right control sidebar */}
      <ControlSidebar />

      {/* Main map area */}
      <div className="map-view-container">
        <MapView />
        <ActiveElementDisplay />
        <ShareButton />
        <FeedbackButton />
      </div>
    </div>
  );
}

export default App;
