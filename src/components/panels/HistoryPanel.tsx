import React from "react";
import { useMapStore } from "../../state/mapStore";
import Card from "../utils/Card";

/**
 * Panel for history functionality
 * Shows previously viewed areas and allows users to re-add them to the map
 */
const HistoryPanel: React.FC = () => {
  // Use historyItems directly from the store
  const historyItems = useMapStore((state) => state.historyItems);
  const clearHistory = useMapStore((state) => state.clearHistory);

  return (
    <div className="panel history-panel">
      <h2>History</h2>
      <div className="panel-description">
        Previously created areas and shapes.
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
