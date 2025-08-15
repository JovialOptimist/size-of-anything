import React from "react";
import { useSettings } from "../../../state/settingsStore";
import type { PinMode, LabelMode } from "../../../state/settingsStore";
import SliderSetting from "../controls/SliderSetting";
import { InformationBubble } from "../../ui/informationBubble";
import { refreshAllMarkers } from "../../utils/markerUtils";
import DropdownSetting from "../controls/DropdownSetting";

/**
 * Pin/marker settings section component with interdependent controls
 */
const PinSettings: React.FC = () => {
  const { pinSettings, setPinMode, setPinSize, setLabelMode, setFontSize } =
    useSettings();

  // Calculate if controls should be disabled based on current mode
  const isPinSizeDisabled = pinSettings.mode === "disabled";

  return (
    <div className="settings-section">
      <div className="section-header-with-info">
        <h3>Map Markers</h3>
        <InformationBubble message="Markers appear as pins when shapes are small on the map. Configure when and how they appear." />
      </div>

      <DropdownSetting
        title="Marker Display"
        description="Control when markers appear for shapes on the map"
        value={pinSettings.mode}
        options={[
          { label: "Always", value: "always" },
          { label: "Adaptive", value: "adaptive" },
          { label: "Disabled", value: "disabled" },
        ]}
        onChange={(value) => {
          setPinMode(value as PinMode);
          // Immediately refresh all markers when the mode changes
          refreshAllMarkers();
        }}
      />

      <SliderSetting
        title="Marker Size"
        description="Adjust the size of markers"
        value={pinSettings.size}
        min={0.5}
        max={5}
        step={0.1}
        disabled={isPinSizeDisabled}
        onChange={(value) => {
          setPinSize(value);
          // Immediately refresh all markers when the size changes
          refreshAllMarkers();
        }}
        formatValue={(val) => `${val.toFixed(1)}x`}
      />

      <DropdownSetting
        title="Label Visibility"
        description="Control when shape labels are visible on the map"
        value={pinSettings.labelMode}
        options={[
          { label: "Always", value: "always" },
          { label: "Only With Markers", value: "onlyMarker" },
          { label: "Disabled", value: "disabled" },
        ]}
        onChange={(value) => {
          setLabelMode(value as LabelMode);
          // Immediately refresh all markers when the label mode changes
          refreshAllMarkers();
        }}
      />

      <SliderSetting
        title="Label Font Size"
        description="Adjust the font size of marker labels"
        value={pinSettings.fontSize || 16} // Default to 16px if not set
        min={10}
        max={48}
        step={1}
        disabled={pinSettings.labelMode === "disabled"}
        onChange={(value) => {
          setFontSize(value);
          // Immediately refresh all markers when the font size changes
          refreshAllMarkers();
        }}
        formatValue={(val) => `${val}px`}
      />
    </div>
  );
};

export default PinSettings;
