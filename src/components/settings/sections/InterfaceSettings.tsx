import React from "react";
import { useSettings } from "../../../state/settingsStore";
import type {
  CreationUi,
  SelectionUi,
  MenuUi,
  SettingsLayout,
} from "../../../state/settingsStore";
import DropdownSetting from "../controls/DropdownSetting";
import ToggleSetting from "../controls/ToggleSetting";

/**
 * Prototype switches for the UI overhaul: each dropdown picks between the
 * classic design and its proposed replacement.
 */
const InterfaceSettings: React.FC = () => {
  const { uiPrototype, setUiPrototype } = useSettings();

  return (
    <div className="settings-section">
      <h3>Interface (prototype)</h3>

      <DropdownSetting
        title="Adding shapes"
        description="One search box for places, objects, and sizes, or the tabbed panel"
        value={uiPrototype.creation}
        options={[
          { label: "Search box", value: "unified" },
          { label: "Tabs (classic)", value: "tabs" },
        ]}
        onChange={(value) => setUiPrototype({ creation: value as CreationUi })}
      />

      <DropdownSetting
        title="Selected shape"
        description="Labelled toolbar (a bottom sheet on phones), or the info card"
        value={uiPrototype.selection}
        options={[
          { label: "Toolbar", value: "toolbar" },
          { label: "Card (classic)", value: "card" },
        ]}
        onChange={(value) => setUiPrototype({ selection: value as SelectionUi })}
      />

      <ToggleSetting
        title="Comparison tray"
        description="List every shape on the map with its size relative to the others"
        value={uiPrototype.compareTray}
        onChange={(value) => setUiPrototype({ compareTray: value })}
      />

      <DropdownSetting
        title="Top-right menu"
        description="Settings and Help buttons, or the ⋮ menu"
        value={uiPrototype.menu}
        options={[
          { label: "Buttons", value: "buttons" },
          { label: "⋮ menu (classic)", value: "ellipsis" },
        ]}
        onChange={(value) => setUiPrototype({ menu: value as MenuUi })}
      />

      <DropdownSetting
        title="Settings layout"
        description="Grouped boxes, or spaced rows"
        value={uiPrototype.settingsLayout}
        options={[
          { label: "Grouped", value: "grouped" },
          { label: "Rows (classic)", value: "classic" },
        ]}
        onChange={(value) => setUiPrototype({ settingsLayout: value as SettingsLayout })}
      />
    </div>
  );
};

export default InterfaceSettings;
