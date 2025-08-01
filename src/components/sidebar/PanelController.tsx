import TextSearchPanel from "../panels/TextSearchPanel";
import MagicWandPanel from "../panels/MagicWandPanel";
import CustomAreaPanel from "../panels/CustomAreaPanel";
import HistoryPanel from "../panels/HistoryPanel";
import HelpPanel from "../panels/HelpPanel";
import DonatePanel from "../panels/DonatePanel";
import SettingsPanel from "../panels/SettingsPanel";
import SpecialPanel from "../panels/SpecialPanel";

const PANEL_COMPONENTS = {
  "text-search": TextSearchPanel,
  "magic-wand": MagicWandPanel,
  "custom-area": CustomAreaPanel,
  special: SpecialPanel,
  history: HistoryPanel,
  help: HelpPanel,
  donate: DonatePanel,
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
