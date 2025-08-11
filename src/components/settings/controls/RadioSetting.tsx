import React from "react";

export interface RadioOption {
  label: string;
  value: string;
}

export interface RadioSettingProps {
  title: string;
  description: string;
  value: string;
  options: RadioOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

/**
 * A radio button group setting component with title and description
 */
const RadioSetting: React.FC<RadioSettingProps> = ({
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
      <div className="radio-options">
        {options.map((option) => (
          <button
            key={option.value}
            className={`radio-option ${value === option.value ? "selected" : ""}`}
            onClick={() => onChange(option.value)}
            disabled={disabled}
            tabIndex={disabled ? -1 : 0}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default RadioSetting;