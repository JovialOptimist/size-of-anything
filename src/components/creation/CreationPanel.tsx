// src/components/creation/CreationPanel.tsx
/**
 * Floating creation panel (Google Maps style): collapsed = search bar + spyglass;
 * expanded = card with tabs (Search, Custom, Special, History).
 */
import { useState, useEffect, useRef } from "react";
import { useMapStore } from "../../state/mapStore";
import CustomAreaPanel from "../panels/CustomAreaPanel";
import SpecialPanel from "../panels/SpecialPanel";
import HistoryPanel from "../panels/HistoryPanel";
import CreationPanelSearch from "./CreationPanelSearch";
import { SearchIcon } from "../ui/Icons";
import "./CreationPanel.css";

type CreationTab = "search" | "custom" | "special" | "history";

const TABS: { key: CreationTab; label: string }[] = [
  { key: "search", label: "Search" },
  { key: "custom", label: "Custom" },
  { key: "special", label: "Special" },
  { key: "history", label: "History" },
];

export default function CreationPanel() {
  const [expanded, setExpanded] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isExpanding, setIsExpanding] = useState(false);
  const [activeTab, setActiveTab] = useState<CreationTab>("search");
  const [query, setQuery] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);
  const prevAreasLengthRef = useRef(0);
  const geojsonAreas = useMapStore((s) => s.geojsonAreas);
  const magicWandMode = useMapStore((s) => s.magicWandMode);
  const setMagicWandMode = useMapStore((s) => s.setMagicWandMode);

  const handleClose = () => {
    if (!expanded || isClosing) return;
    setIsClosing(true);
  };

  const setCreationPanelExpanded = useMapStore((s) => s.setCreationPanelExpanded);

  // Desktop: start with panel open; mobile: start collapsed (matches 500px breakpoint used in CSS)
  useEffect(() => {
    const isDesktop = window.matchMedia("(min-width: 501px)").matches;
    if (isDesktop) {
      setExpanded(true);
      setCreationPanelExpanded(true);
    }
  }, [setCreationPanelExpanded]);

  const handleExpand = () => {
    setExpanded(true);
    setIsExpanding(true);
    setCreationPanelExpanded(true);
  };

  // After painting the expanded panel at initial (small) size, remove expanding class to trigger transition
  useEffect(() => {
    if (!expanded || !isExpanding) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsExpanding(false));
    });
    return () => cancelAnimationFrame(id);
  }, [expanded, isExpanding]);

  const handleTransitionEnd = (e: React.TransitionEvent) => {
    if (e.propertyName === "height" && isClosing) {
      setExpanded(false);
      setIsClosing(false);
      setCreationPanelExpanded(false);
    }
  };

  // Auto-collapse when user places an object (from any tab)
  useEffect(() => {
    const len = geojsonAreas.length;
    if (len > prevAreasLengthRef.current && prevAreasLengthRef.current > 0 && expanded && !isClosing) {
      setIsClosing(true);
    }
    prevAreasLengthRef.current = len;
  }, [geojsonAreas.length, expanded, isClosing]);

  const barButton = (
    <button
      type="button"
      className={`creation-panel-bar ${isClosing ? "creation-panel-bar-closing" : ""}`}
      onClick={handleExpand}
      aria-label="Expand search"
    >
      <span className="creation-panel-spyglass" aria-hidden><SearchIcon /></span>
      <span className="creation-panel-bar-text">Search for a place...</span>
    </button>
  );

  return (
    <div
      className={`creation-panel ${expanded ? "creation-panel-expanded" : "creation-panel-collapsed"} ${isClosing ? "creation-panel-closing" : ""} ${isExpanding ? "creation-panel-expanding" : ""}`}
    >
      {expanded ? (
        <>
          {isClosing && barButton}
          <div
            className={`creation-panel-expanded-inner ${isClosing ? "creation-panel-expanded-inner-closing" : ""}`}
            onTransitionEnd={handleTransitionEnd}
          >
            <div className="creation-panel-tabs">
              {TABS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`creation-panel-tab ${activeTab === key ? "active" : ""}`}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                className="creation-panel-close-btn"
                onClick={handleClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {activeTab === "search" && (
              <div className="creation-panel-header">
                <div className="creation-panel-search-wrap">
                  <input
                    type="text"
                    className="creation-panel-search-input"
                    placeholder="Search for a place..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setSearchTrigger((s) => s + 1)}
                    aria-label="Search"
                  />
                  <button
                    type="button"
                    className="creation-panel-search-btn-inside"
                    onClick={() => setSearchTrigger((s) => s + 1)}
                    aria-label="Search"
                  >
                    <SearchIcon />
                  </button>
                </div>
                <span className="creation-panel-or">OR</span>
                <button
                  type="button"
                  className={`creation-panel-click-to-search ${magicWandMode ? "active" : ""}`}
                  onClick={() => setMagicWandMode(!magicWandMode)}
                >
                  Choose on map
                </button>
              </div>
            )}
            <div className="creation-panel-content">
              {activeTab === "search" && (
                <CreationPanelSearch
                  query={query}
                  searchTrigger={searchTrigger}
                  onPlaced={handleClose}
                />
              )}
              {activeTab === "custom" && <CustomAreaPanel />}
              {activeTab === "special" && <SpecialPanel />}
              {activeTab === "history" && <HistoryPanel />}
            </div>
          </div>
        </>
      ) : (
        barButton
      )}
    </div>
  );
}
