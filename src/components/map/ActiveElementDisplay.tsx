import React from 'react';
import { usePanel } from '../../state/panelStore';

/**
 * Displays information about the active element on the map
 */
const ActiveElementDisplay: React.FC = () => {
  const { activePanel } = usePanel();
  
  const displayClass = activePanel 
    ? "active-element-display sidebar-expanded" 
    : "active-element-display sidebar-collapsed";
  
  return (
    <div className={displayClass}>
      {/* Display for active element information */}
    </div>
  );
};

export default ActiveElementDisplay;