import React from "react";

/**
 * Panel for application settings
 */

const SettingsPanel: React.FC = () => {
  return (
    <div className="panel settings-panel">
      <h2>Settings</h2>
      {/* Settings controls will go here */}
      <input type="checkbox" id="dark-mode" className="settings-checkbox" />
      <label htmlFor="dark-mode" className="settings-label">
        Dark Mode
      </label>
    </div>
  );
};

export default SettingsPanel;
