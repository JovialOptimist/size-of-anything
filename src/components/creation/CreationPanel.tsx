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
  const [activeTab, setActiveTab] = useState<CreationTab>("search");
  const prevAreasLengthRef = useRef(0);
  const geojsonAreas = useMapStore((s) => s.geojsonAreas);

  // Auto-collapse when user places an object (from any tab)
  useEffect(() => {
    const len = geojsonAreas.length;
    if (len > prevAreasLengthRef.current && prevAreasLengthRef.current > 0) {
      setExpanded(false);
    }
    prevAreasLengthRef.current = len;
  }, [geojsonAreas.length]);

  return (
    <div className={`creation-panel ${expanded ? "creation-panel-expanded" : "creation-panel-collapsed"}`}>
      {expanded ? (
        <>
          <div className="creation-panel-header">
            <input
              type="text"
              className="creation-panel-search-input"
              placeholder="Search for a place..."
              readOnly
              aria-label="Search"
            />
            <button
              type="button"
              className="creation-panel-collapse-btn"
              onClick={() => setExpanded(false)}
              aria-label="Collapse"
            >
              ←
            </button>
          </div>
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
          </div>
          <div className="creation-panel-content">
            {activeTab === "search" && <CreationPanelSearch onPlaced={() => setExpanded(false)} />}
            {activeTab === "custom" && <CustomAreaPanel />}
            {activeTab === "special" && <SpecialPanel />}
            {activeTab === "history" && <HistoryPanel />}
          </div>
        </>
      ) : (
        <button
          type="button"
          className="creation-panel-bar"
          onClick={() => setExpanded(true)}
          aria-label="Expand search"
        >
          <span className="creation-panel-spyglass" aria-hidden>🔍</span>
          <span className="creation-panel-bar-text">Search for a place...</span>
        </button>
      )}
    </div>
  );
}
