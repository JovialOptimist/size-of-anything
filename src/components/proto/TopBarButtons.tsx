/**
 * Top-right Settings and Help buttons (UI-overhaul prototype), replacing the ⋮ menu.
 * About now lives at the bottom of the Help panel.
 */
import type { RightSidebarContent } from "../EllipsisMenu";
import { GearIcon, HelpIcon } from "../ui/ProtoIcons";

interface TopBarButtonsProps {
  current: RightSidebarContent;
  onSelect: (content: RightSidebarContent) => void;
}

export default function TopBarButtons({ current, onSelect }: TopBarButtonsProps) {
  const toggle = (content: RightSidebarContent) => onSelect(current === content ? null : content);

  return (
    <div className="proto-topbar">
      <button
        type="button"
        className={`proto-topbar-btn ${current === "settings" ? "proto-topbar-on" : ""}`}
        onClick={() => toggle("settings")}
        aria-pressed={current === "settings"}
        aria-label="Settings"
      >
        <GearIcon /> <span className="proto-topbar-label">Settings</span>
      </button>
      <button
        type="button"
        className={`proto-topbar-btn ${current === "help" ? "proto-topbar-on" : ""}`}
        onClick={() => toggle("help")}
        aria-pressed={current === "help"}
        aria-label="Help"
      >
        <HelpIcon /> <span className="proto-topbar-label">Help</span>
      </button>
    </div>
  );
}
