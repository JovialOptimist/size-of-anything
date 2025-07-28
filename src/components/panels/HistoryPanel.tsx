import React from "react";

/**
 * Panel for history functionality
 */
const HistoryPanel: React.FC = () => {
  return (
    <div className="panel history-panel">
      <h2>History</h2>
      {/* History list and controls will go here */}
      <ul className="history-list">
        <li>Disneyland</li>
        <li>Space Needle</li>
        <li>Golden Gate Bridge</li>
      </ul>
    </div>
  );
};

export default HistoryPanel;
