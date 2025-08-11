// src/components/map/MapView.tsx
/**
 * Main map component for the Size of Anything application.
 * Handles rendering the map, area polygons, and associated interactive elements.
 * Enables functionality for dragging, selecting, and manipulating map areas.
 */
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/mapDarkMode.css";
import "../../styles/ShareButton.css";
import { useMapStore } from "../../state/mapStore";
import { usePanel } from "../../state/panelStore";
import {
  enablePolygonDragging,
  shouldShowMarkerForPolygon,
  findCenterForMarker,
} from "../utils/geometryUtils";
import { createMarker, attachMarkerDragHandlers } from "../utils/markerUtils";
import type { GeoJSONFeature, MapState } from "../../state/mapStoreTypes";
import ShareButton from "./ShareButton";

const POLYGON_SIZE_THRESHOLD_PERCENT = 0.01; //TODO: Make this configurable

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJSONLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hoveredCandidateLayerRef = useRef<L.LayerGroup | null>(null);
  const markerToLayerMap = useRef<Map<L.Marker, L.GeoJSON>>(new Map());
  const numShapesRef = useRef(0);

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
  const setCurrentMapCenter: (center: [number, number]) => void = useMapStore(
    (state: MapState) => state.setCurrentMapCenter
  );

  const hoveredCandidate: GeoJSONFeature | null = useMapStore(
    (state: MapState) => state.hoveredCandidate
  );

  const magicWandMode: boolean = useMapStore(
    (state: MapState) => state.magicWandMode
  );

  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(13);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Find user location or default to a central point
    const defaultCenter: [number, number] = [47.615, -122.035]; // Seattle coordinates
    // use https://geolocation-db.com/json/
    fetch("https://geolocation-db.com/json/")
      .then((response) => response.json())
      .then((data) => {
        if (data && data.latitude && data.longitude) {
          defaultCenter[0] = data.latitude;
          defaultCenter[1] = data.longitude;
        }
      });

    // Based on whether or not the control panel is open, we can adjust the default center
    const isPanelOpen = usePanel.getState().activePanel !== null;
    if (isPanelOpen) {
      defaultCenter[1] -= 0.15;
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
      worldCopyJump: false,
    }).setView(defaultCenter, 11);
    setCurrentMapCenter(defaultCenter);
    mapInstanceRef.current = map;

    L.control.zoom({ position: "bottomright" }).addTo(map);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
      maxNativeZoom: 19,
      maxZoom: 22,
      minZoom: 2,
      noWrap: true,
      bounds: [
        [-90, -180],
        [90, 180],
      ],
    }).addTo(map);

    map.on("click", (e) => {
      if (isSelectingArea) {
        setClickedPosition([e.latlng.lat, e.latlng.lng]);
      }
      const onMapClick = useMapStore.getState().onMapClick;
      if (onMapClick) onMapClick(e.latlng);

      // When user clicks the map background (not a layer or marker),
      // the event will reach here since we stop propagation on layers and markers
      setActiveArea(null);
      console.log("Map background clicked, clearing active area");
    });

    map.on("zoomend", () => {
      setCurrentZoomLevel(map.getZoom());

      const center = map.getBounds().pad(0.1).getCenter(); // Add some padding to the bounds
      setCurrentMapCenter([center.lat, center.lng]);
      updateMarkers();
    });

    map.on("moveend", () => {
      if (map.getZoom() === currentZoomLevel) updateMarkers();
      const center = map.getBounds().pad(0.1).getCenter(); // Add some padding to the bounds
      setCurrentMapCenter([center.lat, center.lng]);
    });

    markersLayerGroupRef.current = L.layerGroup().addTo(map);
    hoveredCandidateLayerRef.current = L.layerGroup().addTo(map);

    // Expose the layer refs to the window for access from marker utils and share functionality
    (window as any).markersLayerGroupRef = markersLayerGroupRef;
    (window as any).markerToLayerMap = markerToLayerMap;
    (window as any).mapInstanceRef = mapInstanceRef;

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

    geojsonAreas.forEach((feature: GeoJSONFeature) => {
      const idx = feature.properties?.index;
      const polygonColor = feature.properties?.color || "blue";
      const isActive = activeAreaId === `geojson-${idx}`;

      // Clone the feature to avoid modifying the original
      let featureToRender: GeoJSONFeature = JSON.parse(JSON.stringify(feature));

      // Use currentCoordinates if available, otherwise use original coordinates
      if (featureToRender.geometry.currentCoordinates) {
        featureToRender.geometry.coordinates =
          featureToRender.geometry.currentCoordinates;
      }

      // We'll only apply rotation when it's newly set through the rotation wheel,
      // not automatically during rendering after movement.
      // The rotation is now managed separately in the RotationWheel component
      // and stored in a "rotatedCoordinates" property in the feature's geometry.
      // If we have pre-calculated rotated coordinates, use those instead of recalculating
      if (
        featureToRender.geometry.rotatedCoordinates &&
        featureToRender.properties.rotation !== 0
      ) {
        featureToRender.geometry.coordinates =
          featureToRender.geometry.rotatedCoordinates;
      }

      const layer = L.geoJSON(featureToRender, {
        style: {
          color: polygonColor,
          weight: isActive ? 4 : 2,
          fillOpacity: 0.4,
          opacity: isActive ? 0.9 : 0.7,
        },
      }).addTo(group);

      // Add click handler to set active element
      layer.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
      });

      // Only enable dragging if this is the active element or there is no active element
      enablePolygonDragging(layer, map);
    });

    if (geojsonAreas.length > numShapesRef.current) {
      // Go find the newest shape
      const newShape = geojsonAreas[geojsonAreas.length - 1];
      // Create a temporary GeoJSON layer to get bounds
      const tempLayer = L.geoJSON(newShape.geometry);
      const bounds = tempLayer.getBounds();
      if (bounds.isValid()) {
        //console.log(`MapView: Fitting bounds because new shape added (${geojsonAreas.length} vs old total of ${numShapesRef.current})`);
        if (usePanel.getState().activePanel) {
          map.fitBounds(bounds, {
            paddingTopLeft: [420, 20], // Updated padding now that map starts after IconSidebar
            paddingBottomRight: [20, 20],
          });
        } else {
          map.fitBounds(bounds, {
            paddingTopLeft: [20, 20], // Updated padding now that map starts after IconSidebar
            paddingBottomRight: [20, 20],
          });
        }
        console.warn("MapView: Bounds are not valid, skipping fitBounds");
      }
    } else if (geojsonAreas.length < numShapesRef.current) {
      //console.log("MapView: A shape has been removed, not fitting bounds");
    } else {
      //console.log("MapView: No new shapes, not fitting bounds");
    }
    numShapesRef.current = geojsonAreas.length;
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
          // Get the color directly from the polygon's style options
          const polygonColor = poly.options.color || "blue";

          // Get the exact center of the polygon for the marker
          const markerPosition = findCenterForMarker(poly);

          // Create the marker at the exact polygon center
          const marker = createMarker(markerPosition, polygonColor);
          marker.addTo(markerLayerGroup);

          // Store the association between marker and layer
          markerToLayerMap.current.set(marker, layer);

          // Attach drag handlers to the marker
          attachMarkerDragHandlers(marker, layer, map);
        }
      });
    });
  }

  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers();
  }, [geojsonAreas, activeAreaId]);

  // Effect for handling the hover highlight
  useEffect(() => {
    const map = mapInstanceRef.current;
    const hoveredLayer = hoveredCandidateLayerRef.current;

    if (!map || !hoveredLayer) return;

    // Clear previous hover highlights
    hoveredLayer.clearLayers();

    // If there's a hovered candidate, render it with a highlight style
    if (hoveredCandidate) {
      L.geoJSON(hoveredCandidate, {
        style: {
          color: "#FF4500", // Orange-red highlight color
          weight: 5,
          fillOpacity: 0.2,
          opacity: 1,
          dashArray: "5, 10", // Dashed line for distinction
        },
      }).addTo(hoveredLayer);
    }

    return () => {
      // Cleanup function to clear the layer if the component unmounts
      if (hoveredLayer) hoveredLayer.clearLayers();
    };
  }, [hoveredCandidate]);

  return (
    <div
      className={`map-container ${isSelectingArea ? "selecting-area" : ""} ${
        magicWandMode ? "magic-wand-active" : ""
      }`}
    >
      <div id="map" ref={mapRef}></div>
      <ShareButton />
    </div>
  );
}
