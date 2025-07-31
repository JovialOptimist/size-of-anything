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

const POLYGON_SIZE_THRESHOLD_PERCENT = 0.05; //TODO: Make this configurable

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJSONLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markerToLayerMap = useRef<Map<L.Marker, L.GeoJSON>>(new Map());

  const geojsonAreas = useMapStore((state) => state.geojsonAreas);
  const isSelectingArea = useMapStore((state) => state.isSelectingArea);
  const setClickedPosition = useMapStore((state) => state.setClickedPosition);

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
    });

    map.on("zoomend", () => {
      setCurrentZoomLevel(map.getZoom());
      updateMarkers();
    });

    map.on("moveend", () => {
      if (map.getZoom() === currentZoomLevel) updateMarkers();
    });

    markersLayerGroupRef.current = L.layerGroup().addTo(map);

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
    geojsonAreas.forEach((feature, idx) => {
      if (!isValidGeometry(feature.geometry.coordinates)) {
        console.warn(
          `MapView: Feature #${idx} has invalid geometry, skipping`,
          feature
        );
      }

      const layer = L.geoJSON(feature, {
        style: { color: "blue", weight: 2, fillOpacity: 0.4 },
      }).addTo(group);

      enablePolygonDragging(layer, map);

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
  }, [geojsonAreas]);

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
          const marker = createMarker(findCenterForMarker(poly));
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
