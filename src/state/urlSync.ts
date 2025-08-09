import { useEffect } from 'react';
import { useMapStore } from './mapStore';
import { usePanel } from './panelStore';
import type { GeoJSONFeature } from './mapStoreTypes';

// Define the shape of the state we want to share
interface ShareableState {
  mapCenter: [number, number];
  zoomLevel: number;
  activeAreaId: string | null;
  areas: {
    id: string;
    feature: GeoJSONFeature;
  }[];
}

/**
 * Generate a shareable link containing the current state
 */
export const generateShareableLink = (): string => {
  const state = useMapStore.getState();
  const { activePanel } = usePanel.getState();
  
  // Get the current zoom level from the map instance if available
  let currentZoom = 13; // Default zoom level
  const mapInstance = (window as any).mapInstanceRef?.current;
  if (mapInstance && typeof mapInstance.getZoom === 'function') {
    currentZoom = mapInstance.getZoom();
  }
  
  // Create the state object we want to encode in the URL
  const shareableState: ShareableState = {
    mapCenter: state.currentMapCenter,
    zoomLevel: currentZoom,
    activeAreaId: state.activeAreaId,
    areas: state.geojsonAreas.map((feature, index) => ({
      id: `geojson-${feature.properties.index || index}`,
      feature: feature
    }))
  };

  // Serialize and encode the state
  const stateString = JSON.stringify(shareableState);
  const encodedState = btoa(encodeURIComponent(stateString));
  
  // Generate the URL with the hash fragment
  const baseUrl = window.location.origin + window.location.pathname;
  let url = baseUrl;
  
  // Include the panel state if needed
  if (activePanel) {
    url += `?panel=${activePanel}`;
  }
  
  // Add the share data as a hash fragment
  url += `#share=${encodedState}`;
  
  return url;
};

/**
 * Parse a shared link and extract the state
 */
export const parseSharedLink = (hash: string): ShareableState | null => {
  if (!hash || !hash.startsWith('#share=')) return null;
  
  try {
    const encodedState = hash.substring(7); // Remove '#share='
    const stateString = decodeURIComponent(atob(encodedState));
    return JSON.parse(stateString) as ShareableState;
  } catch (error) {
    console.error('Failed to parse shared link:', error);
    return null;
  }
};

/**
 * Apply the state from a shared link
 */
export const applySharedState = (state: ShareableState): void => {
  if (!state) return;
  
  const mapStore = useMapStore.getState();
  
  // Clear existing areas
  const currentAreas = [...mapStore.areas];
  currentAreas.forEach(area => mapStore.removeArea(area.id));
  
  // Add the shared areas
  state.areas.forEach(({ feature }) => {
    mapStore.addGeoJSONFromSearch(feature);
  });
  
  // Set the active area if specified
  if (state.activeAreaId) {
    mapStore.setActiveArea(state.activeAreaId);
  }
  
  // Update the map center and zoom
  if (state.mapCenter) {
    mapStore.setCurrentMapCenter(state.mapCenter);
    
    // Get the map instance to update its view
    const mapInstance = (window as any).mapInstanceRef?.current;
    if (mapInstance && typeof mapInstance.setView === 'function') {
      // Set both center and zoom level
      mapInstance.setView(state.mapCenter, state.zoomLevel);
    }
  }
};

/**
 * Custom hook for syncing state with URL parameters
 */
export const useUrlSync = () => {
  const { activePanel, setActivePanel } = usePanel();
  const { activeAreaId, areas, setActiveArea } = useMapStore();

  // Check for shared state on initial load
  useEffect(() => {
    // Check for a shared state in the URL hash
    const hash = window.location.hash;
    if (hash && hash.startsWith('#share=')) {
      const sharedState = parseSharedLink(hash);
      if (sharedState) {
        // Apply the shared state
        applySharedState(sharedState);
        
        // Clear the hash to avoid reapplying on refresh
        setTimeout(() => {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }, 500);
        
        return; // Skip regular URL sync if we applied shared state
      }
    }
    
    // Regular URL sync for non-shared states
    const params = new URLSearchParams(window.location.search);
    
    const panelParam = params.get('panel');
    if (panelParam) {
      setActivePanel(panelParam);
    }
    
    const areaParam = params.get('area');
    if (areaParam && areas.some(area => area.id === areaParam)) {
      setActiveArea(areaParam);
      console.log(`useUrlSync: Active area set to ${areaParam}`);
    }
  }, []);

  // Only sync panel and active area to URL during normal navigation
  // (We don't want to overwrite the shared URL hash)
  useEffect(() => {
    // Don't update URL if we're viewing a shared state
    if (window.location.hash.startsWith('#share=')) return;
    
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

  return null; // This hook doesn't render anything
};

export default useUrlSync;