import React from "react";

export interface DropdownOption {
  label: string;
  value: string;
}

export interface DropdownSettingProps {
  title: string;
  description: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A dropdown select setting component with title and description
 */
const DropdownSetting: React.FC<DropdownSettingProps> = ({
  title,
  description,
  value,
  options,
  onChange,
  disabled = false,
}) => {
  return (
    <div className={`settings-option ${disabled ? 'disabled-setting' : ''}`}>
      <div className="settings-option-label">
        <span className="settings-option-title">{title}</span>
        <span className="settings-option-description">{description}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="settings-dropdown"
        tabIndex={disabled ? -1 : 0}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
};

export default DropdownSetting;