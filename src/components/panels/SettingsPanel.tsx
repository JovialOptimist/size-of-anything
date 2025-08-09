import React, { useEffect } from "react";
import { useSettings, applyTheme } from "../../state/settingsStore";
import "../../styles/SettingsPanel.css";

/**
 * Panel for application settings
 */
const SettingsPanel: React.FC = () => {
  const { theme, setTheme } = useSettings();

  // Apply theme when it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="panel settings-panel">
      <div className="panel-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-section">
        <h3>Appearance</h3>

        <div className="settings-option">
          <div className="settings-option-label">
            <span className="settings-option-title">Theme</span>
            <span className="settings-option-description">
              Choose how the app looks
            </span>
          </div>
          <div className="radio-options">
            <button
              className={`radio-option ${theme === "light" ? "selected" : ""}`}
              onClick={() => setTheme("light")}
              tabIndex={0}
            >
              Light
            </button>
            <button
              className={`radio-option ${theme === "dark" ? "selected" : ""}`}
              onClick={() => setTheme("dark")}
              tabIndex={0}
            >
              Dark
            </button>
            <button
              className={`radio-option ${theme === "system" ? "selected" : ""}`}
              onClick={() => setTheme("system")}
              tabIndex={0}
            >
              System
            </button>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3>Map Display</h3>

        <div className="settings-option">
          <div className="settings-option-label">
            <span className="settings-option-title">High Contrast Mode</span>
            <span className="settings-option-description">
              Increase visibility of map elements
            </span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" tabIndex={0} />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-option">
          <div className="settings-option-label">
            <span className="settings-option-title">Simplify Geometries</span>
            <span className="settings-option-description">
              Improve performance on complex shapes
            </span>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" tabIndex={0} />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

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
