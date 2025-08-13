import React, { useState } from "react";
import ToggleSetting from "../controls/ToggleSetting";
import DropdownSetting from "../controls/DropdownSetting";
import { useSettings } from "../../../state/settingsStore";

/**
 * Map display settings section component
 */
const MapSettings: React.FC = () => {
  // Get settings from the store
  const { outlineQuality, setOutlineQuality } = useSettings();

  // This setting is not yet connected to the store
  // It's just a placeholder for UI demonstration
  const [highContrast, setHighContrast] = useState(false);

  return (
    <div className="settings-section">
      <h3>Map Display</h3>

      <ToggleSetting
        title="High Contrast Mode"
        description="Increase visibility of map elements"
        value={highContrast}
        onChange={setHighContrast}
      />

      <DropdownSetting
        title="Outline Quality"
        description="The level of detail used for complex shapes like countries."
        value={outlineQuality}
        onChange={(value) => setOutlineQuality(value as typeof outlineQuality)}
        options={[
          { label: "Perfect", value: "perfect" },
          { label: "Great (recommended)", value: "great" },
          { label: "Good", value: "good" },
          { label: "Low", value: "low" },
        ]}
      />
    </div>
  );
};

export default MapSettings;
