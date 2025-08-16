import React from "react";
import { useSettings } from "../../../state/settingsStore";
import DropdownSetting from "../controls/DropdownSetting";

/**
 * Theme settings section component
 */
const ThemeSettings: React.FC = () => {
  const { theme, setTheme, mapTheme, setMapTheme } = useSettings();

  return (
    <div className="settings-section">
      <h3>Appearance</h3>

      <DropdownSetting
        title="App Theme"
        description="Change the overall theme"
        value={theme}
        options={[
          { label: "Light", value: "light" },
          { label: "Dark", value: "dark" },
          { label: "System", value: "system" },
        ]}
        onChange={(value) => setTheme(value as typeof theme)}
      />

      <DropdownSetting
        title="Map Theme"
        description="Change how the map looks"
        value={mapTheme}
        onChange={(value) => setMapTheme(value as typeof mapTheme)}
        options={[
          { label: "Light", value: "light" },
          { label: "Match App", value: "system" },
          { label: "Dark", value: "dark" },
        ]}
      />
    </div>
  );
};

export default ThemeSettings;
