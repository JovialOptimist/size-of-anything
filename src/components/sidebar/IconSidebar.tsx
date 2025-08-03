import {
  SearchIcon,
  MagicWandIcon,
  CustomAreaIcon,
  HistoryIcon,
  HelpIcon,
  SettingsIcon,
  PuzzlePieceIcon,
} from "./icons";

import { usePanel } from "../../state/panelStore";

const ICONS = [
  { key: "text-search", label: "Search", icon: <SearchIcon /> },
  { key: "magic-wand", label: "Magic Wand", icon: <MagicWandIcon /> },
  { key: "custom-area", label: "Custom Area", icon: <CustomAreaIcon /> },
  { key: "special", label: "Special", icon: <PuzzlePieceIcon /> },
  { key: "history", label: "History", icon: <HistoryIcon /> },
];

const SETTINGS_ICONS = [
  { key: "help", label: "Help", icon: <HelpIcon /> },
  { key: "settings", label: "Settings", icon: <SettingsIcon /> },
];

export default function IconSidebar() {
  const { activePanel, setActivePanel } = usePanel();

  const renderButton = (
    item: (typeof ICONS)[0] | (typeof SETTINGS_ICONS)[0]
  ) => (
    <button
      key={item.key}
      onClick={() => setActivePanel(activePanel === item.key ? null : item.key)}
      className={`icon-button group relative ${
        activePanel === item.key ? "active" : ""
      }`}
    >
      {item.icon}
      <span>{item.label}</span>
    </button>
  );

  return (
    <div className="icon-sidebar">
      <div className="top-tools">{ICONS.map(renderButton)}</div>
      <div className="bottom-tools">{SETTINGS_ICONS.map(renderButton)}</div>
    </div>
  );
}
