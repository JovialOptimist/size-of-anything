/**
 * Top-right ellipsis menu: opens dropdown with Settings, Help, About.
 * Choosing an option opens the Right Sidebar with that content.
 */
import { useState, useRef, useEffect } from "react";
import "./EllipsisMenu.css";

export type RightSidebarContent = "settings" | "help" | "about" | null;

interface EllipsisMenuProps {
  onSelect: (content: RightSidebarContent) => void;
}

export default function EllipsisMenu({ onSelect }: EllipsisMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleChoose = (content: RightSidebarContent) => {
    onSelect(content);
    setOpen(false);
  };

  return (
    <div className="ellipsis-menu-wrap" ref={ref}>
      <button
        type="button"
        className="ellipsis-menu-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="ellipsis-dots" aria-hidden>⋮</span>
      </button>
      {open && (
        <div className="ellipsis-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => handleChoose("settings")}>
            Settings
          </button>
          <button type="button" role="menuitem" onClick={() => handleChoose("help")}>
            Help
          </button>
          <button type="button" role="menuitem" onClick={() => handleChoose("about")}>
            About
          </button>
        </div>
      )}
    </div>
  );
}
