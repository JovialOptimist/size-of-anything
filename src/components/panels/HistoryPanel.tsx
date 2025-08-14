import React from "react";
import { useMapStore } from "../../state/mapStore";
import Card from "../ui/Card";
import { InformationBubble } from "../ui/informationBubble";
import { DismissableMessage } from "../ui/DismissableMessage";
import "../../styles/HistoryPanel.css";

/**
 * Panel for history functionality
 * Shows previously viewed areas and allows users to re-add them to the map
 */
const HistoryPanel: React.FC = () => {
  // Use historyItems directly from the store
  const historyItems = useMapStore((state) => state.historyItems);
  const clearHistory = useMapStore((state) => state.clearHistory);
  
  // Filter history items by source
  const textSearchItems = historyItems.filter(
    item => item.properties.source === 'text-search' || 
           (!item.properties.source && !item.properties.osmType?.includes('custom-'))
  );
  
  const customAreaItems = historyItems.filter(
    item => item.properties.source === 'custom-area' || 
           (item.properties.osmType && item.properties.osmType.includes('custom-'))
  );
  
  // Special items don't belong to either category
  const specialItems = historyItems.filter(
    item => item.properties.source === 'special' || 
           (item.properties.osmType && item.properties.osmType.includes('special-'))
  );

  return (
    <div className="panel history-panel">
      <div className="panel-header">
        <h2>
          History<span className="keybind-text">H</span>
        </h2>
        <InformationBubble message="This panel shows all areas you've previously added to the map. For specific history, check the Search and Custom Area panels." />
      </div>
      <div className="panel-description">
        All previously created areas and shapes.
      </div>

      {historyItems.length > 0 ? (
        <>
          {textSearchItems.length > 0 && (
            <div className="history-category">
              <h3>Search Results</h3>
              <div className="history-list">
                {textSearchItems.map((item, index) => (
                  <Card key={`text-search-history-${index}`} feature={item} />
                ))}
              </div>
            </div>
          )}
          
          {customAreaItems.length > 0 && (
            <div className="history-category">
              <h3>Custom Areas</h3>
              <div className="history-list">
                {customAreaItems.map((item, index) => (
                  <Card key={`custom-area-history-${index}`} feature={item} />
                ))}
              </div>
            </div>
          )}
          
          {specialItems.length > 0 && (
            <div className="history-category">
              <h3>Special Areas</h3>
              <div className="history-list">
                {specialItems.map((item, index) => (
                  <Card key={`special-history-${index}`} feature={item} />
                ))}
              </div>
            </div>
          )}
          
          <button
            className="clear-history-button"
            onClick={clearHistory}
            tabIndex={0}
          >
            Clear All History
          </button>
        </>
      ) : (
        <div className="empty-history-message">
          <p>No history yet. Search for areas or create custom shapes to see them here.</p>
        </div>
      )}

      <DismissableMessage messageId="history-feature-location-info">
        <p>
          The outline of the area will be made around the original feature, not
          where you are currently looking.
        </p>
      </DismissableMessage>
      
      <p className="note">
        For specific history categories, check the Search and Custom Area panels.
      </p>
    </div>
  );
};

export default HistoryPanel;
