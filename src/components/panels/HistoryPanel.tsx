import React from "react";
import { useMapStore } from "../../state/mapStore";
import Card from "../utils/Card";
import { InformationBubble } from "../ui/informationBubble";

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
      <div className="panel-header">
        <h2>
          History<span className="keybind-text">H</span>
        </h2>
        <InformationBubble message="This panel shows the areas you've previously added to the map. Click an option from the list to place a copy of it on the map." />
      </div>
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

      <div className="custom-area-info">
        <p>
          The outline of the area will be made around the original feature, not
          where you are currently looking.
        </p>
      </div>
    </div>
  );
};

export default HistoryPanel;
