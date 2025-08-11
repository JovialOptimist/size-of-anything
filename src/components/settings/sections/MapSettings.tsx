import React, { useState } from "react";
import ToggleSetting from "../controls/ToggleSetting";

/**
 * Map display settings section component
 */
const MapSettings: React.FC = () => {
  // These settings are not yet connected to the store
  // They're just placeholders for UI demonstration
  const [highContrast, setHighContrast] = useState(false);
  const [simplifyGeometries, setSimplifyGeometries] = useState(true);
  
  return (
    <div className="settings-section">
      <h3>Map Display</h3>
      
      <ToggleSetting
        title="High Contrast Mode"
        description="Increase visibility of map elements"
        value={highContrast}
        onChange={setHighContrast}
      />
      
      <ToggleSetting
        title="Simplify Geometries"
        description="Improve performance on complex shapes"
        value={simplifyGeometries}
        onChange={setSimplifyGeometries}
      />
    </div>
  );
};

export default MapSettings;