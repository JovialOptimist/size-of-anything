/**
 * Right sidebar: slides out from the right with Settings, Help, or About content.
 * Close only via X button.
 */
import type { RightSidebarContent } from "./EllipsisMenu";
import SettingsPanel from "./panels/SettingsPanel";
import HelpPanel from "./panels/HelpPanel";
import AboutContent from "./AboutContent";
import "./RightSidebar.css";

interface RightSidebarProps {
  content: RightSidebarContent;
  onClose: () => void;
}

export default function RightSidebar({ content, onClose }: RightSidebarProps) {
  if (!content) return null;

  return (
    <div className="right-sidebar" role="dialog" aria-label={`${content} panel`}>
      <div className="right-sidebar-header">
        <h2 className="right-sidebar-title">
          {content === "settings" && "Settings"}
          {content === "help" && "Help"}
          {content === "about" && "About"}
        </h2>
        <button
          type="button"
          className="right-sidebar-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="right-sidebar-content">
        {content === "settings" && <SettingsPanel />}
        {content === "help" && <HelpPanel />}
        {content === "about" && <AboutContent />}
      </div>
    </div>
  );
}
