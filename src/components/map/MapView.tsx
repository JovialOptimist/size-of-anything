// src/components/map/MapView.tsx
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "../../state/mapStore";
import {
  enablePolygonDragging,
  rightClickToRemove,
  shouldShowMarkerForPolygon,
  findCenterForMarker,
  isValidGeometry,
} from "../utils/geometryUtils";
import { createMarker, attachMarkerDragHandlers } from "../utils/markerUtils";
import type { GeoJSONFeature, MapState } from "../../state/mapStore";

const POLYGON_SIZE_THRESHOLD_PERCENT = 0.05; //TODO: Make this configurable

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJSONLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerToLayerMap = useRef<Map<L.Marker, L.GeoJSON>>(new Map());
  const wasLayerClickedRef = useRef(false);

  const geojsonAreas: GeoJSONFeature[] = useMapStore(
    (state: MapState) => state.geojsonAreas
  );
  const isSelectingArea: boolean = useMapStore(
    (state: MapState) => state.isSelectingArea
  );
  const setClickedPosition: (position: [number, number] | null) => void =
    useMapStore((state: MapState) => state.setClickedPosition);
  const activeAreaId: string | null = useMapStore(
    (state: MapState) => state.activeAreaId
  );
  const setActiveArea: (id: string | null) => void = useMapStore(
    (state: MapState) => state.setActiveArea
  );

  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(13);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([47.615, -122.035], 13);
    mapInstanceRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
    }).addTo(map);

    map.on("click", (e) => {
      if (isSelectingArea) {
        setClickedPosition([e.latlng.lat, e.latlng.lng]);
      }
      const onMapClick = useMapStore.getState().onMapClick;
      if (onMapClick) onMapClick(e.latlng);

      // If no layer was clicked, clear the active area
      if (!wasLayerClickedRef.current) {
        setActiveArea(null);
      }

      // Reset for next click
      wasLayerClickedRef.current = false;
    });

    map.on("zoomend", () => {
      setCurrentZoomLevel(map.getZoom());
      updateMarkers();
    });

    map.on("moveend", () => {
      if (map.getZoom() === currentZoomLevel) updateMarkers();
    });

    markersLayerGroupRef.current = L.layerGroup().addTo(map);

    // Expose the layer refs to the window for access from marker utils
    (window as any).markersLayerGroupRef = markersLayerGroupRef;
    (window as any).markerToLayerMap = markerToLayerMap;

    return () => {
      map.off();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [isSelectingArea, setClickedPosition]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) {
      return;
    }

    if (geoJSONLayerGroupRef.current) {
      geoJSONLayerGroupRef.current.clearLayers();
      map.removeLayer(geoJSONLayerGroupRef.current);
    }

    const group = L.layerGroup().addTo(map);
    geoJSONLayerGroupRef.current = group;

    const bounds = new L.LatLngBounds([]);
    geojsonAreas.forEach((feature: GeoJSONFeature) => {
      const idx = feature.properties?.index;
      if (!isValidGeometry(feature.geometry.coordinates)) {
        console.warn(
          `MapView: Feature #${idx} has invalid geometry, skipping`,
          feature
        );
      }

      const polygonColor = feature.properties?.color || "blue";
      const isActive = activeAreaId === `geojson-${idx}`;
      
      // Clone the feature to avoid modifying the original
      let featureToRender = JSON.parse(JSON.stringify(feature));
      
      // Use currentCoordinates if available, otherwise use original coordinates
      if (featureToRender.geometry.currentCoordinates) {
        featureToRender.geometry.coordinates = featureToRender.geometry.currentCoordinates;
      }

      const layer = L.geoJSON(featureToRender, {
        style: {
          color: polygonColor,
          weight: isActive ? 4 : 2,
          fillOpacity: isActive ? 0.6 : 0.4,
          opacity: isActive ? 0.9 : 0.7,
        },
      }).addTo(group);

      // Add click handler to set active element
      layer.on("click", () => {
        wasLayerClickedRef.current = true; // Mark that a layer was clicked
        setActiveArea(`geojson-${idx}`);
      });

      // Only enable dragging if this is the active element or there is no active element
      if (isActive || !activeAreaId) {
        enablePolygonDragging(layer, map);
      }

      rightClickToRemove(layer, map);

      try {
        bounds.extend(layer.getBounds());
      } catch (err) {
        console.warn("MapView: Invalid bounds on feature", idx, err);
      }
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    } else {
      console.warn("MapView: Bounds are not valid, skipping fitBounds");
    }
  }, [geojsonAreas, activeAreaId]);

  function updateMarkers() {
    const map = mapInstanceRef.current;
    const geoLayerGroup = geoJSONLayerGroupRef.current;
    const markerLayerGroup = markersLayerGroupRef.current;
    if (!map || !geoLayerGroup || !markerLayerGroup) return;

    markerLayerGroup.clearLayers();
    markerToLayerMap.current.clear();

    geoLayerGroup.eachLayer((layer) => {
      if (!(layer instanceof L.GeoJSON)) return;

      layer.eachLayer((poly) => {
        if (!(poly instanceof L.Polygon)) return;

        if (
          shouldShowMarkerForPolygon(poly, map, POLYGON_SIZE_THRESHOLD_PERCENT)
        ) {
          // Get the color from the GeoJSON properties
          const feature = layer.feature as any;
          const polygonColor = feature?.properties?.color || "blue";
          const marker = createMarker(findCenterForMarker(poly), polygonColor);
          marker.addTo(markerLayerGroup);
          markerToLayerMap.current.set(marker, layer);
          attachMarkerDragHandlers(marker, layer, map);
        }
      });
    });
  }

  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers();
  }, [geojsonAreas]);

  return (
    <div className={`map-container ${isSelectingArea ? "selecting-area" : ""}`}>
      <div id="map" ref={mapRef}></div>
    </div>
  );
}
