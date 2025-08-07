import { useRef } from "react";
import PanelController from "./PanelController";
import { usePanel } from "../../state/panelStore";

export default function ControlSidebar() {
  const { activePanel, setActivePanel } = usePanel();

  // Store sidebar width in state
  const sidebarRef = useRef<HTMLDivElement>(null);
  const handleCollapse = () => {
    // set the active panel to null to collapse the sidebar
    setActivePanel(null);
  };

  // Classes for visibility
  const sidebarClass = activePanel
    ? "control-sidebar visible"
    : "control-sidebar hidden";

  return (
    <div className={sidebarClass} ref={sidebarRef}>
      <div className="sidebar-content">
        {activePanel && (
          <PanelController
            panelKey={
              activePanel as
                | "text-search"
                | "magic-wand"
                | "custom-area"
                | "history"
                | "special"
                | "help"
                | "settings"
            }
          />
        )}
      </div>

      <div className="resize-container">
        <div
          className="resize-handle"
          onClick={handleCollapse}
          tabIndex={0}
          role="button"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleCollapse();
          }}
        >
          <span className="resize-icon">&#11104;</span>
        </div>
      </div>
    </div>
  );
}
