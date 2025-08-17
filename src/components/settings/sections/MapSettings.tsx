import React from "react";
import ToggleSetting from "../controls/ToggleSetting";
import DropdownSetting from "../controls/DropdownSetting";
import { useSettings } from "../../../state/settingsStore";

/**
 * Map display settings section component
 */
const MapSettings: React.FC = () => {
  // Get settings from the store
  const {
    outlineQuality,
    setOutlineQuality,
    highContrastMode,
    setHighContrastMode,
    useMetricUnits,
    setUseMetricUnits,
  } = useSettings();

  return (
    <div className="settings-section">
      <h3>Map Display</h3>

      <ToggleSetting
        title="High Contrast Mode"
        description="Increase visibility of map elements"
        value={highContrastMode}
        onChange={setHighContrastMode}
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

      <DropdownSetting
        title="Measurement Units"
        description="Choose between metric (km²) and imperial (sq mi) units"
        value={useMetricUnits ? "metric" : "imperial"}
        onChange={(value) => setUseMetricUnits(value === "metric")}
        options={[
          { label: "Metric (km²)", value: "metric" },
          { label: "Imperial (sq mi)", value: "imperial" },
        ]}
      />
    </div>
  );
};

export default MapSettings;
