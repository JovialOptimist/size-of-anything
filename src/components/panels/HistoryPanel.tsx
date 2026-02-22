import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import Card from "../ui/Card";
/**
 * Panel for history functionality
 * Shows previously viewed areas and allows users to re-add them to the map
 */
const HistoryPanel: React.FC = () => {
  // Use historyItems directly from the store
  const historyItems = useMapStore((state) => state.historyItems);
  const clearHistory = useMapStore((state) => state.clearHistory);

  const [listExpanded, setListExpanded] = useState(false);
  const displayItems = listExpanded ? historyItems : historyItems.slice(0, 6);
  const hasMore = historyItems.length > 6 && !listExpanded;

  return (
    <div className="panel history-panel">
      {historyItems.length > 0 ? (
        <>
          <div className="history-list">
            {displayItems.map((item, index) => (
              <Card key={`history-${index}`} feature={item} />
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              className="history-view-more"
              onClick={() => setListExpanded(true)}
            >
              View more
            </button>
          )}
          <button
            className="clear-history-button"
            onClick={clearHistory}
            tabIndex={0}
          >
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
