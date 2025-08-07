import IconSidebar from "./components/sidebar/IconSidebar";
import ControlSidebar from "./components/sidebar/ControlSidebar";
import MapView from "./components/map/MapView";
import ActiveElementDisplay from "./components/map/ActiveElementDisplay";
import MapControls from "./components/map/MapControls";
import useUrlSync from "./state/urlSync";
import { useEffect } from "react";
import { useSettings, applyTheme } from "./state/settingsStore";
import ThemeInitializer from "./components/ThemeInitializer";
import KeyboardHandler from "./components/KeyboardHandler";

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
        <MapControls />
      </div>
    </div>
  );
}

export default App;
