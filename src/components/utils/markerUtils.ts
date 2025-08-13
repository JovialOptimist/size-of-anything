// src/components/utils/markerUtils.ts
/**
 * Utility functions for map markers and drag handles.
 * Provides functionality for creating, updating, and handling markers on the map.
 */
import L from "leaflet";
import * as turf from "@turf/turf";
import {
  transformPolygonCoordinates,
  convertLatLngsToCoords,
  hybridProjectAndTranslateGeometry,
  convertCoordsToLatLngs,
} from "./geometryUtils";
import { useSettings } from "../../state/settingsStore";
// Get marker size from settings
const getMarkerSize = (): number => {
  const { pinSettings } = useSettings.getState();
  return pinSettings.size || 1.5;
};

// Add a utility to refresh all markers on settings change
export function refreshAllMarkers(): void {
  // Access the map instance and update markers function from the global scope
  // These are set in MapView.tsx for external access
  if ((window as any).mapInstanceRef?.current) {
    // Find the MapView component's updateMarkers function
    if ((window as any).updateAllMapMarkers) {
      console.log("Refreshing all map markers due to settings change");
      (window as any).updateAllMapMarkers();
    } else {
      console.warn("updateAllMapMarkers function not available");
    }
  } else {
    console.warn("Map instance not available for refreshing markers");
  }
}

// Set up a listener for pin settings changes if needed in other components
let unsubscribeFromSettings: (() => void) | null = null;

// Call this from a component to start auto-refreshing markers on settings changes
export function setupAutoRefreshOnSettingsChange(): () => void {
  if (unsubscribeFromSettings) {
    // Already subscribed, return the existing unsubscribe function
    return unsubscribeFromSettings || (() => {});
  }

  // Import settings without circular dependencies

  // Subscribe to settings changes
  interface PinSettings {
    mode: string;
    size: number;
    appearanceThreshold: number;
  }

  interface SettingsState {
    pinSettings: PinSettings;
    // Add other settings properties here if needed
  }

  unsubscribeFromSettings = useSettings.subscribe(
    (state: SettingsState, prevState: SettingsState): void => {
      // Only refresh if pin settings changed
      if (
        state.pinSettings.mode !== prevState.pinSettings.mode ||
        state.pinSettings.size !== prevState.pinSettings.size ||
        state.pinSettings.appearanceThreshold !==
          prevState.pinSettings.appearanceThreshold
      ) {
        refreshAllMarkers();
      }
    }
  );

  return unsubscribeFromSettings || (() => {});
}

export function createMarker(
  center: L.LatLng,
  color: string = "blue",
  name: string = ""
): L.Marker {
  const markerSize = getMarkerSize();
  const width = 18 * markerSize;
  const height = 24 * markerSize;
  
  // Create the SVG pin
  const pinSvg = `<svg width="${width}" height="${height}" viewBox="-1 -1 19 25" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="9" cy="8" rx="7" ry="7" fill="${color}" stroke="white" stroke-width="2"/>
    <path d="M9 23C9 23 16 13.5 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 13.5 9 23 9 23Z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="8" cy="8" r="3" fill="white"/>
  </svg>`;
  
  // Log what name we received
  console.log("Creating marker label with name:", name);
  
  // Format the name for display - use first part before any comma, or the full name if no comma
  // Make sure we handle null, undefined, or empty strings properly
  const cleanName = name && name.trim ? name.trim() : '';
  const displayName = cleanName ? (cleanName.includes(',') ? cleanName.split(',')[0] : cleanName) : 'Unnamed Area';
  
  // Add name label if provided (always add it, but it might show "Unnamed Area")
  const nameLabel = `<div class="marker-name-label">${displayName}</div>`;
  
  // Combine pin and label
  const html = `
    <div class="marker-container">
      ${pinSvg}
      ${nameLabel}
    </div>
  `;

  return L.marker(center, {
    draggable: true,
    title: name || "Drag to move area",
    icon: L.divIcon({
      className: "area-marker",
      html: html,
      iconSize: [width, height],
      iconAnchor: [width / 2 + 1, height],
    }),
  });
}

export function attachMarkerDragHandlers(
  marker: L.Marker,
  geoJsonLayer: L.GeoJSON,
  map: L.Map
) {
  let dragStartLatLng: L.LatLng;
  let originalPolygonCoords: any = null;
  let hasMoved = false;
  const moveThreshold = 3; // Pixels to consider a drag vs a click
  let activePolygon: L.Polygon | null = null;

  // Find the associated polygon for this marker
  const findAssociatedPolygon = (): L.Polygon | null => {
    let result: L.Polygon | null = null;
    geoJsonLayer.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        result = layer;
      }
    });
    return result;
  };

  // Add click handler to make the shape active when its marker is clicked
  marker.on("click", async (e) => {
    // Stop the event propagation to prevent it from triggering the map's click handler
    L.DomEvent.stopPropagation(e);

    if (!hasMoved) {
      // Access the feature to get its index
      let feature: GeoJSON.Feature | undefined;
      geoJsonLayer.eachLayer((layer) => {
        if (layer instanceof L.Polygon && layer.feature) {
          feature = layer.feature as GeoJSON.Feature;
        }
      });

      if (
        feature &&
        feature.properties &&
        feature.properties.index !== undefined
      ) {
        const featureIndex = feature.properties.index;
        // Set active area - we don't need to set wasLayerClickedRef since we're stopping propagation
        const { useMapStore } = await import("../../state/mapStore");
        useMapStore.getState().setActiveArea(`geojson-${featureIndex}`);
        console.log(
          `MarkerUtils: Marker clicked, setting active area to geojson-${featureIndex}`
        );
      }
    }
  });

  marker.on("dragstart", async (e) => {
    hasMoved = false;
    dragStartLatLng = e.target.getLatLng().clone(); // Clone to ensure we have a separate instance
    map.dragging.disable();

    // Find and store the associated polygon
    activePolygon = findAssociatedPolygon();
    if (activePolygon) {
      // Store original coordinates for reference during drag
      originalPolygonCoords = JSON.parse(
        JSON.stringify(activePolygon.getLatLngs())
      );
    }
  });

  marker.on("drag", () => {
    // Calculate pixel distance to determine if this is a drag
    const startPoint = map.latLngToContainerPoint(dragStartLatLng);
    const currentPoint = map.latLngToContainerPoint(marker.getLatLng());
    const pixelDistance = startPoint.distanceTo(currentPoint);

    if (pixelDistance > moveThreshold) {
      hasMoved = true;
    }

    if (!originalPolygonCoords || !activePolygon) return;

    try {
      // Get the feature associated with this polygon for projection-based transformation
      const feature = activePolygon.feature as GeoJSON.Feature | undefined;
      if (feature && feature.geometry) {
        // Deep clone the feature to avoid modifying the original
        const featureToTransform = JSON.parse(JSON.stringify(feature));

        // Calculate the displacement from the drag start position
        const current = marker.getLatLng();
        const latDiff = current.lat - dragStartLatLng.lat;
        const lngDiff = current.lng - dragStartLatLng.lng;

        // Calculate target coordinates based on the original feature's centroid plus the displacement
        const originalCentroid = turf.centroid(featureToTransform);
        const targetCoordinates: [number, number] = [
          originalCentroid.geometry.coordinates[0] + lngDiff,
          originalCentroid.geometry.coordinates[1] + latDiff,
        ];

        // Use our hybrid transformation for accurate shape preservation
        const transformedFeature = hybridProjectAndTranslateGeometry(
          featureToTransform,
          targetCoordinates
        );

        // Convert GeoJSON coordinates to Leaflet LatLngs and update the polygon
        if ("coordinates" in transformedFeature.geometry) {
          const transformedLatLngs = convertCoordsToLatLngs(
            (
              transformedFeature.geometry as Extract<
                GeoJSON.Geometry,
                { coordinates: any }
              >
            ).coordinates
          );
          activePolygon.setLatLngs(transformedLatLngs);
        }
      } else {
        // Fallback to the legacy method if feature is not available
        const current = marker.getLatLng();
        const latDiff = current.lat - dragStartLatLng.lat;
        const lngDiff = current.lng - dragStartLatLng.lng;

        // Apply simple transformation if we can't use projection-based approach
        const transformed = transformPolygonCoordinates(
          originalPolygonCoords,
          latDiff,
          lngDiff
        );
        activePolygon.setLatLngs(transformed);
      }
    } catch (error) {
      console.error("Error during marker drag:", error);

      // Fallback to simple translation on error
      const current = marker.getLatLng();
      const latDiff = current.lat - dragStartLatLng.lat;
      const lngDiff = current.lng - dragStartLatLng.lng;

      const transformed = transformPolygonCoordinates(
        originalPolygonCoords,
        latDiff,
        lngDiff
      );
      activePolygon.setLatLngs(transformed);
    }
  });

  marker.on("dragend", async () => {
    map.dragging.enable();

    if (!activePolygon) return;

    try {
      // Get feature from the active polygon
      const feature = activePolygon.feature as GeoJSON.Feature | undefined;
      if (feature && feature.properties && feature.geometry) {
        const featureIndex = feature.properties.index;

        if (featureIndex !== undefined) {
          // Get the final coordinates from the polygon after projection-based transformation
          const currentCoords = activePolygon.getLatLngs();
          const convertedCoords = convertLatLngsToCoords(currentCoords);

          // Store the current coordinates in the feature itself
          (feature.geometry as any).currentCoordinates = convertedCoords;

          // Update the store with the new coordinates
          const { useMapStore } = await import("../../state/mapStore");
          useMapStore
            .getState()
            .updateCurrentCoordinates(
              `geojson-${featureIndex}`,
              convertedCoords
            );

          // Note: We don't set the area as active after a marker drag
          // This keeps the behavior consistent with polygon dragging
        }
      }
    } catch (error) {
      console.error("Error saving transformed coordinates:", error);
    } finally {
      // Clean up
      originalPolygonCoords = null;
      activePolygon = null;
    }
  });
}
