/**
 * Right sidebar: slides out from the right with Settings, Help, or About content.
 * Close only via X button.
 */
import type { RightSidebarContent } from "./EllipsisMenu";
import SettingsPanel from "./panels/SettingsPanel";
import HelpPanel from "./panels/HelpPanel";
import AboutContent from "./AboutContent";
import { useSettings } from "../state/settingsStore";
import "./RightSidebar.css";

interface RightSidebarProps {
  content: RightSidebarContent;
  onClose: () => void;
}

export default function RightSidebar({ content, onClose }: RightSidebarProps) {
  // With the prototype Settings/Help buttons there's no About entry, so About follows Help
  const aboutInHelp = useSettings((s) => s.uiPrototype.menu === "buttons");
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
        {content === "help" && aboutInHelp && (
          <section className="proto-about-in-help" aria-label="About">
            <h2 className="right-sidebar-title">About</h2>
            <AboutContent />
          </section>
        )}
        {content === "about" && <AboutContent />}
      </div>
    </div>
  );
}
