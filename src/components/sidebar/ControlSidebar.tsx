// src/components/sidebar/ControlSidebar.tsx
/**
 * Right sidebar component that shows the active panel content.
 * Contains the panel controller and handles sidebar collapse functionality.
 */
import { useRef, useEffect } from "react";
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

  // Adjust sidebar width based on viewport size
  useEffect(() => {
    const adjustSidebarWidth = () => {
      if (sidebarRef.current) {
        const sidebarWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'));
        const maxWidth = Math.min(600, window.innerWidth - sidebarWidth - 20);
        
        // If the control panel width would be too large for the screen, adjust it
        if (maxWidth < parseInt(getComputedStyle(document.documentElement).getPropertyValue('--control-panel-width'))) {
          sidebarRef.current.style.width = `${maxWidth}px`;
        } else {
          // Reset to the default control panel width from CSS variables
          sidebarRef.current.style.width = 'var(--control-panel-width)';
        }
      }
    };

    // Adjust width on component mount and window resize
    adjustSidebarWidth();
    window.addEventListener('resize', adjustSidebarWidth);
    
    return () => {
      window.removeEventListener('resize', adjustSidebarWidth);
    };
  }, [activePanel]);

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
