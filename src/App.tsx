import IconSidebar from "./components/sidebar/IconSidebar";
import ControlSidebar from "./components/sidebar/ControlSidebar";
import MapView from "./components/map/MapView";
import ActiveElementDisplay from "./components/map/ActiveElementDisplay";
import MapControls from "./components/map/MapControls";
import useUrlSync from "./state/urlSync";
import { useEffect } from "react";

function App() {
  // Use the URL sync hook to synchronize state with URL
  useUrlSync();

  useEffect(() => {
    console.log("--- SIZE OF ANYTHING APP STARTED ---");
  }, []);

  return (
    <div className="app-container">
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
