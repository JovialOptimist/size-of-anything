import React, { useEffect } from "react";
import { useSettings, applyTheme } from "../../state/settingsStore";
import "../../styles/SettingsPanel.css";
import { InformationBubble } from "../ui/informationBubble";

// Import section components
import ThemeSettings from "../settings/sections/ThemeSettings";
import PinSettings from "../settings/sections/PinSettings";
import MapSettings from "../settings/sections/MapSettings";

/**
 * Panel for application settings
 * Uses modular section components for better organization and maintainability
 */
const SettingsPanel: React.FC = () => {
  const { theme } = useSettings();

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="panel settings-panel">
      <div className="panel-header">
        <h2>Settings</h2>
        <InformationBubble message="Configure the app's appearance and behavior. Changes are applied immediately and automatically saved." />
      </div>

      {/* Modular settings sections */}
      <ThemeSettings />
      <PinSettings />
      <MapSettings />

      <div className="settings-section">
        <h3>Units</h3>
        <div className="settings-option">
          <div className="settings-option-label">
            <span className="settings-option-title">Distance Units</span>
            <span className="settings-option-description">
              Choose your preferred units
            </span>
          </div>
          <div className="radio-options">
            <button className="radio-option selected" tabIndex={0}>
              Metric
            </button>
            <button className="radio-option" tabIndex={0}>
              Imperial
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
