import { useEffect, useRef, useState } from "react";
import PanelController from "./PanelController";
import { usePanel } from "../../state/panelStore";

export default function ControlSidebar() {
  const { activePanel } = usePanel();

  // Store sidebar width in state
  const [width, setWidth] = useState(300); // Default width in px
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);

  // Handle drag to resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !sidebarRef.current) return;
      const newWidth =
        e.clientX - sidebarRef.current.getBoundingClientRect().left;
      setWidth(Math.max(200, Math.min(600, newWidth))); // Limit min/max width
    };

    const stopResize = () => {
      isResizing.current = false;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, []);

  // Classes for visibility
  const sidebarClass = activePanel
    ? "control-sidebar visible"
    : "control-sidebar hidden";

  return (
    <div
      className={sidebarClass}
      ref={sidebarRef}
      style={{ width: `${width}px` }}
    >
      <div className="sidebar-content">
        {activePanel && (
          <PanelController
            panelKey={
              activePanel as
                | "text-search"
                | "magic-wand"
                | "custom-area"
                | "history"
                | "help"
                | "donate"
                | "settings"
            }
          />
        )}
      </div>

      <div
        className="resize-handle"
        onMouseDown={() => {
          isResizing.current = true;
        }}
      />
    </div>
  );
}
