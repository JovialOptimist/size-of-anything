import React from "react";
import "../../../styles/SliderSetting.css";

export interface SliderSettingProps {
  title: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  formatValue?: (value: number) => string;
}

/**
 * A slider control setting component with title and description
 */
const SliderSetting: React.FC<SliderSettingProps> = ({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
  disabled = false,
  formatValue = (val) => val.toString(),
}) => {
  return (
    <div className={`settings-option slider-option ${disabled ? 'disabled-setting' : ''}`}>
      <div className="settings-option-label">
        <span className="settings-option-title">{title}</span>
        <span className="settings-option-description">{description}</span>
      </div>
      <div className="slider-control">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="slider"
          tabIndex={disabled ? -1 : 0}
        />
        <span className="slider-value">{formatValue(value)}</span>
      </div>
    </div>
  );
};

export default SliderSetting;