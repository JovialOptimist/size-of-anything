import L from "leaflet";
import { transformPolygonCoordinates } from "./geometryUtils";
import { convertLatLngsToCoords } from "./geometryUtils";

const markerSize = 2;

export function createMarker(center: L.LatLng, color: string = "blue"): L.Marker {
    const width = 18 * markerSize;
    const height = 24 * markerSize;

  return L.marker(center, {
    draggable: true,
    title: "Drag to move area",
    icon: L.divIcon({
      className: "area-marker",
      html: `<svg width="${width}" height="${height}" viewBox="0 0 18 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="9" cy="8" rx="7" ry="7" fill="${color}" stroke="white" stroke-width="2"/>
        <path d="M9 23C9 23 16 13.5 16 8C16 3.58172 12.4183 0 8 0C3.58172 0 0 3.58172 0 8C0 13.5 9 23 9 23Z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="8" cy="8" r="3" fill="white"/>
      </svg>`,
      iconSize: [width, height],
      iconAnchor: [9 * markerSize, 23 * markerSize],
    }),
  });
}

export function attachMarkerDragHandlers(
  marker: L.Marker,
  geoJsonLayer: L.GeoJSON,
  map: L.Map
) {
  let dragStart: L.LatLng;

  marker.on("dragstart", (e) => {
    dragStart = e.target.getLatLng();
    map.dragging.disable();
  });

  marker.on("drag", () => {
    const current = marker.getLatLng();
    const latDiff = current.lat - dragStart.lat;
    const lngDiff = current.lng - dragStart.lng;

    geoJsonLayer.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        const coords = layer.getLatLngs();
        const transformed = transformPolygonCoordinates(coords, latDiff, lngDiff);
        layer.setLatLngs(transformed);
      }
    });
    
    // Update dragStart for the next move
    dragStart = current;
  });

  marker.on("dragend", () => {
    map.dragging.enable();
    
    // Get existing feature and polygon layer
    let pathLayer: L.Polygon | null = null;
    let feature: GeoJSON.Feature | undefined;
    geoJsonLayer.eachLayer((layer) => {
      if (layer instanceof L.Polygon) {
        pathLayer = layer;
        if (layer.feature) {
          feature = layer.feature as GeoJSON.Feature;
        }
      }
    });
    
    if (pathLayer && feature && feature.properties) {
      const featureIndex = feature.properties.index;
      
      if (featureIndex !== undefined) {
        // Get the current coordinates from the polygon after dragging
        const currentCoords = (pathLayer as L.Polygon).getLatLngs();
        
        const convertedCoords = convertLatLngsToCoords(currentCoords);
        
        // Store the current coordinates in the feature itself
        if (feature.geometry) {
          (feature.geometry as any).currentCoordinates = convertedCoords;
        }
        
        // Update the store with the new coordinates
        import('../../state/mapStore').then(module => {
          const mapStore = module.useMapStore;
          mapStore.getState().updateCurrentCoordinates(`geojson-${featureIndex}`, convertedCoords);
        });
      }
    }
  });
}
