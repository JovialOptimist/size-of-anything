import React, { useState, useEffect } from "react";
import { useMapStore } from "../../state/mapStore";
import Card from "../utils/Card";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";

// Key for storing history in localStorage
const HISTORY_STORAGE_KEY = "sizeOfAnything_history";

/**
 * Panel for history functionality
 * Shows previously viewed areas and allows users to re-add them to the map
 */
const HistoryPanel: React.FC = () => {
  const [historyItems, setHistoryItems] = useState<GeoJSONFeature[]>([]);
  const geojsonAreas = useMapStore((state) => state.geojsonAreas);

  // Load history from localStorage on initial render
  useEffect(() => {
    const savedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (savedHistory) {
      try {
        setHistoryItems(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history from localStorage:", e);
        // If parsing fails, start with empty history
        localStorage.removeItem(HISTORY_STORAGE_KEY);
      }
    }
  }, []);

  // Update history when geojsonAreas change
  useEffect(() => {
    if (geojsonAreas.length > 0) {
      // Get the most recent area
      const latestArea = geojsonAreas[geojsonAreas.length - 1];

      // Check if this area is already in history (by osmId if available, otherwise by name)
      const isAlreadyInHistory = historyItems.some((item) => {
        if (item.properties.osmId && latestArea.properties.osmId) {
          return item.properties.osmId === latestArea.properties.osmId;
        }
        return item.properties.name === latestArea.properties.name;
      });

      if (!isAlreadyInHistory) {
        // Add to history, limiting to last 10 items
        const updatedHistory = [latestArea, ...historyItems].slice(0, 10);
        setHistoryItems(updatedHistory);

        // Save to localStorage
        localStorage.setItem(
          HISTORY_STORAGE_KEY,
          JSON.stringify(updatedHistory)
        );
      }
    }
  }, [geojsonAreas, historyItems]);

  // Clear all history
  const clearHistory = () => {
    setHistoryItems([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  return (
    <div className="panel history-panel">
      <h2>History</h2>
      <div className="panel-description">
        Previously viewed areas. Click to re-add to the map.
      </div>

      {historyItems.length > 0 ? (
        <>
          <div className="history-list">
            {historyItems.map((item, index) => (
              <Card key={`history-${index}`} feature={item} />
            ))}
          </div>
          <button className="clear-history-button" onClick={clearHistory}>
            Clear History
          </button>
        </>
      ) : (
        <div className="empty-history-message">
          <p>No history yet. Search for areas to see them here.</p>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
