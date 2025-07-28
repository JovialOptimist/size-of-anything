import { useEffect } from 'react';
import { useMapStore } from './mapStore';
import { usePanel } from './panelStore';

/**
 * Custom hook for syncing state with URL parameters
 */
export const useUrlSync = () => {
  const { activePanel, setActivePanel } = usePanel();
  const { activeAreaId, areas, setActiveArea } = useMapStore();

  // Sync state to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (activePanel) {
      params.set('panel', activePanel);
    }
    
    if (activeAreaId) {
      params.set('area', activeAreaId);
    }
    
    const url = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', url);
  }, [activePanel, activeAreaId]);

  // Sync URL to state on initial load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const panelParam = params.get('panel');
    if (panelParam) {
      setActivePanel(panelParam);
    }
    
    const areaParam = params.get('area');
    if (areaParam && areas.some(area => area.id === areaParam)) {
      setActiveArea(areaParam);
    }
  }, []);

  return null; // This hook doesn't render anything
};

export default useUrlSync;