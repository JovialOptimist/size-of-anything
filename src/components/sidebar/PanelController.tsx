// src/components/sidebar/PanelController.tsx
/**
 * Component that manages which panel is currently displayed in the control sidebar.
 * Renders the appropriate panel component based on the active panel selection.
 */
import {
  TextSearchPanel,
  MagicWandPanel,
  CustomAreaPanel,
  SpecialPanel,
  HistoryPanel,
  HelpPanel,
  SettingsPanel,
} from "../panels";

const PANEL_COMPONENTS = {
  "text-search": TextSearchPanel,
  "magic-wand": MagicWandPanel,
  "custom-area": CustomAreaPanel,
  special: SpecialPanel,
  history: HistoryPanel,
  help: HelpPanel,
  settings: SettingsPanel,
} as const;

export default function PanelController({
  panelKey,
}: {
  panelKey: keyof typeof PANEL_COMPONENTS;
}) {
  const Component = PANEL_COMPONENTS[panelKey];
  return <Component />;
}
