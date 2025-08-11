import React from "react";
import { useSettings } from "../../../state/settingsStore";
import DropdownSetting from "../controls/DropdownSetting";

/**
 * Theme settings section component
 */
const ThemeSettings: React.FC = () => {
  const { theme, setTheme } = useSettings();

  return (
    <div className="settings-section">
      <h3>Appearance</h3>

      <DropdownSetting
        title="Theme"
        description="Choose how the app looks"
        value={theme}
        options={[
          { label: "Light", value: "light" },
          { label: "Dark", value: "dark" },
          { label: "System", value: "system" },
        ]}
        onChange={(value) => setTheme(value as typeof theme)}
      />
    </div>
  );
};

export default ThemeSettings;
