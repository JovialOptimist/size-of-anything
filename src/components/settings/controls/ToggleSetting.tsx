import React from "react";

export interface ToggleSettingProps {
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * A toggle switch setting component with title and description
 */
const ToggleSetting: React.FC<ToggleSettingProps> = ({
  title,
  description,
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className={`settings-option ${disabled ? 'disabled-setting' : ''}`}>
      <div className="settings-option-label">
        <span className="settings-option-title">{title}</span>
        <span className="settings-option-description">{description}</span>
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          tabIndex={0}
        />
        <span className="toggle-slider"></span>
      </label>
    </div>
  );
};

export default ToggleSetting;