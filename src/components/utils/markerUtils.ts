import L from "leaflet";
import * as turf from "@turf/turf";
import { 
  transformPolygonCoordinates, 
  convertLatLngsToCoords,
  projectAndTranslateGeometry,
  hybridProjectAndTranslateGeometry,
  convertCoordsToLatLngs
} from "./geometryUtils";

const markerSize = 1.5;

export function createMarker(center: L.LatLng, color: string = "blue"): L.Marker {
    const width = 18 * markerSize;
    const height = 24 * markerSize;

  return L.marker(center, {
    draggable: true,
    title: "Drag to move area",
    icon: L.divIcon({
      className: "area-marker",
      html: `<svg width="${width}" height="${height}" viewBox="-1 -1 19 25" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="9" cy="8" rx="7" ry="7" fill="${color}" stroke="white" stroke-width="2"/>
        <path d="M9 23C9 23 16 13.5 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 13.5 9 23 9 23Z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="8" cy="8" r="3" fill="white"/>
      </svg>`,
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
      
      if (feature && feature.properties && feature.properties.index !== undefined) {
        const featureIndex = feature.properties.index;
        // Set active area - we don't need to set wasLayerClickedRef since we're stopping propagation
        const { useMapStore } = await import('../../state/mapStore');
        useMapStore.getState().setActiveArea(`geojson-${featureIndex}`);
        console.log(`MarkerUtils: Marker clicked, setting active area to geojson-${featureIndex}`);
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
      originalPolygonCoords = JSON.parse(JSON.stringify(activePolygon.getLatLngs()));
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
          originalCentroid.geometry.coordinates[1] + latDiff
        ];
        
        // Use our hybrid transformation for accurate shape preservation
        const transformedFeature = hybridProjectAndTranslateGeometry(featureToTransform, targetCoordinates);
        
        // Convert GeoJSON coordinates to Leaflet LatLngs and update the polygon
        if ("coordinates" in transformedFeature.geometry) {
          const transformedLatLngs = convertCoordsToLatLngs(
            (transformedFeature.geometry as Extract<GeoJSON.Geometry, { coordinates: any }>).coordinates
          );
          activePolygon.setLatLngs(transformedLatLngs);
        }
      } else {
        // Fallback to the legacy method if feature is not available
        const current = marker.getLatLng();
        const latDiff = current.lat - dragStartLatLng.lat;
        const lngDiff = current.lng - dragStartLatLng.lng;
        
        // Apply simple transformation if we can't use projection-based approach
        const transformed = transformPolygonCoordinates(originalPolygonCoords, latDiff, lngDiff);
        activePolygon.setLatLngs(transformed);
      }
    } catch (error) {
      console.error("Error during marker drag:", error);
      
      // Fallback to simple translation on error
      const current = marker.getLatLng();
      const latDiff = current.lat - dragStartLatLng.lat;
      const lngDiff = current.lng - dragStartLatLng.lng;
      
      const transformed = transformPolygonCoordinates(originalPolygonCoords, latDiff, lngDiff);
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
          const { useMapStore } = await import('../../state/mapStore');
          useMapStore.getState().updateCurrentCoordinates(`geojson-${featureIndex}`, convertedCoords);
          
          // Note: We don't set the area as active after a marker drag
          // This keeps the behavior consistent with polygon dragging
          
          console.log("Updated area position using projection-based transformation");
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
