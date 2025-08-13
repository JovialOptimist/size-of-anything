// src/components/map/MapView.tsx
/**
 * Main map component for the Size of Anything application.
 * Handles rendering the map, area polygons, and associated interactive elements.
 * Enables functionality for dragging, selecting, and manipulating map areas.
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../../styles/mapDarkMode.css";
import "../../styles/ShareButton.css";
import "../../styles/markerLabels.css";
import { useMapStore } from "../../state/mapStore";
import { usePanel } from "../../state/panelStore";
import { useSettings } from "../../state/settingsStore";
import {
  enablePolygonDragging,
  shouldShowMarkerForPolygon,
  findCenterForMarker,
} from "../utils/geometryUtils";
import { createMarker, attachMarkerDragHandlers } from "../utils/markerUtils";
import type { GeoJSONFeature, MapState } from "../../state/mapStoreTypes";
import ShareButton from "./ShareButton";
import { setupAutoRefreshOnSettingsChange } from "../utils/markerUtils";

// improved findUserLocation with timeout + async/await
async function findUserLocation(timeout = 3000) {
  const defaultCenter: [number, number] = [47.615, -122.035];
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    const res = await fetch("https://geolocation-db.com/json/", {
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) return defaultCenter;
    const data = await res.json();
    if (data?.latitude && data?.longitude) {
      return [Number(data.latitude), Number(data.longitude)] as [
        number,
        number
      ];
    }
    return defaultCenter;
  } catch (e) {
    // fallback to default on error/timeout
    return defaultCenter;
  }
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJSONLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const hoveredCandidateLayerRef = useRef<L.LayerGroup | null>(null);
  const markerToLayerMap = useRef<Map<L.Marker, L.GeoJSON>>(new Map());
  const labelToLayerMap = useRef<Map<L.Marker, L.GeoJSON>>(new Map());
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

  // single init effect — create map once and use the store getState() inside handlers
  useEffect(() => {
    if (!mapRef.current) return;

    let cancelled = false;

    const initMap = async () => {
      const center = await findUserLocation();
      console.log(center);
      if (cancelled) return;

      // account for the control panel if open
      const isPanelOpen = usePanel.getState().activePanel !== null;
      if (isPanelOpen) center[1] -= 0.15;

      // If map not created yet, create it. Otherwise just setView.
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current!, {
          zoomControl: false,
          worldCopyJump: false,
        }).setView(center, 11);

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

        // use getState() inside handlers so they always see the latest store values
        map.on("click", (e: L.LeafletMouseEvent) => {
          const isSelecting = useMapStore.getState().isSelectingArea;
          if (isSelecting) {
            setClickedPosition([e.latlng.lat, e.latlng.lng]);
          }
          const onMapClick = useMapStore.getState().onMapClick;
          if (onMapClick) onMapClick(e.latlng);
          setActiveArea(null);
        });

        map.on("zoomend", () => {
          const c = map.getBounds().pad(0.1).getCenter();
          setCurrentMapCenter([c.lat, c.lng]);
          updateMarkers();
        });

        map.on("moveend", () => {
          // safer: always update markers on moveend
          updateMarkers();
          const c = map.getBounds().pad(0.1).getCenter();
          setCurrentMapCenter([c.lat, c.lng]);
        });

        markersLayerGroupRef.current = L.layerGroup().addTo(map);
        hoveredCandidateLayerRef.current = L.layerGroup().addTo(map);

        // Expose the layer refs and functions to the window for access from marker utils and share functionality
        (window as any).markersLayerGroupRef = markersLayerGroupRef;
        (window as any).markerToLayerMap = markerToLayerMap;
        (window as any).mapInstanceRef = mapInstanceRef;
        (window as any).updateAllMapMarkers = updateMarkers;
      } else {
        // if map exists, just move it
        mapInstanceRef.current.setView(center, 11);
      }
    };

    initMap();

    return () => {
      cancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off();
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // we reference stable setters — include them to keep eslint happy
  }, [setClickedPosition, setActiveArea, setCurrentMapCenter]);

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
      // Find the newest shape(s) - those that were just added
      const newShapes = geojsonAreas.slice(numShapesRef.current);

      // Check if any new shape should be brought into focus
      const shapesToFocus = newShapes.filter(
        (shape) => shape.properties.shouldBringToFocus === true
      );

      if (shapesToFocus.length > 0) {
        // Focus on the first shape that should be brought into focus
        const shapeToFocus = shapesToFocus[0];

        // Create a temporary GeoJSON layer to get bounds
        const tempLayer = L.geoJSON(shapeToFocus.geometry);
        const bounds = tempLayer.getBounds();

        if (bounds.isValid()) {
          console.log(
            `MapView: Fitting bounds to shape "${shapeToFocus.properties.name}" (shouldBringToFocus=true)`
          );

          // Apply appropriate padding based on panel state
          const paddingOptions = usePanel.getState().activePanel
            ? { paddingTopLeft: [560, 120], paddingBottomRight: [120, 120] }
            : { paddingTopLeft: [120, 120], paddingBottomRight: [120, 120] };

          map.fitBounds(bounds, {
            paddingTopLeft: paddingOptions.paddingTopLeft as [number, number],
            paddingBottomRight: paddingOptions.paddingBottomRight as [
              number,
              number
            ],
          });
        } else {
          console.warn("MapView: Bounds are not valid, skipping fitBounds");
        }
      } else {
        // console.log(
        //   "MapView: New shape added but shouldBringToFocus=false, not fitting bounds"
        // );
      }
    } else if (geojsonAreas.length < numShapesRef.current) {
      console.log("MapView: A shape has been removed, not fitting bounds");
    } else {
      console.log("MapView: No new shapes, not fitting bounds");
    }
    numShapesRef.current = geojsonAreas.length;
  }, [geojsonAreas, activeAreaId]);

  // Function to update a specific polygon's marker or centered label
  function updatePolygonLabels(polygon: L.Polygon, layer: L.GeoJSON) {
    const map = mapInstanceRef.current;
    const markerLayerGroup = markersLayerGroupRef.current;
    if (!map || !markerLayerGroup) return;

    // Calculate the new center position
    const centerPosition = findCenterForMarker(polygon);

    // Get the shape's name
    let shapeName = "Unnamed Area";
    try {
      const feature = (layer as any).feature;
      if (feature && feature.properties && feature.properties.name) {
        shapeName = feature.properties.name;
      }
    } catch (error) {
      console.error("Error accessing shape name:", error);
    }

    // Check if this polygon has a marker
    let foundMarker = false;
    markerToLayerMap.current.forEach((markerLayer, marker) => {
      if (markerLayer === layer) {
        // Update existing marker position
        marker.setLatLng(centerPosition);
        foundMarker = true;
      }
    });

    // Check if this polygon has a centered label
    labelToLayerMap.current.forEach((labelLayer, label) => {
      if (labelLayer === layer) {
        // Update existing centered label position
        label.setLatLng(centerPosition);
        foundMarker = true;
      }
    });

    // If no marker or label was found and updated, this might be during initial
    // drag before updateMarkers has run, so we don't need to do anything
  }

  // Expose the function globally for access from geometryUtils
  (window as any).updatePolygonLabels = updatePolygonLabels;

  // Update all markers on the map based on current settings and state
  const POLYGON_SIZE_THRESHOLD_PERCENT = 0.2; // Default threshold for showing markers
  function updateMarkers() {
    const map = mapInstanceRef.current;
    const geoLayerGroup = geoJSONLayerGroupRef.current;
    const markerLayerGroup = markersLayerGroupRef.current;
    if (!map || !geoLayerGroup || !markerLayerGroup) return;

    // Get current pin settings
    const { pinSettings } = useSettings.getState();

    // Clear existing markers and labels
    markerLayerGroup.clearLayers();
    markerToLayerMap.current.clear();
    labelToLayerMap.current.clear();

    // Re-evaluate each polygon for marker display
    geoLayerGroup.eachLayer((layer) => {
      if (!(layer instanceof L.GeoJSON)) return;

      layer.eachLayer((poly) => {
        if (!(poly instanceof L.Polygon)) return;

        // Get the shape's name if available
        let shapeName = "Unnamed Area";

        try {
          // Try getting feature from the polygon first (most direct approach)
          const polygonFeature = (poly as any).feature;
          if (
            polygonFeature &&
            polygonFeature.properties &&
            polygonFeature.properties.name
          ) {
            shapeName = polygonFeature.properties.name;
            console.log("Found shape name from polygon:", shapeName);
          }
          // If that fails, try getting from the layer
          else {
            const layerFeature = (layer as any).feature;
            if (layerFeature && typeof layerFeature === "object") {
              const properties = layerFeature.properties;
              if (properties && properties.name) {
                shapeName = properties.name;
                console.log("Found shape name from layer:", shapeName);
              } else {
                console.log("No name in layer properties:", properties);
              }
            } else {
              console.log("No valid feature on layer or polygon");
            }
          }
        } catch (error) {
          console.error("Error accessing shape name:", error);
        }

        // Get the position for the marker/label
        const centerPosition = findCenterForMarker(poly);

        // Check if this polygon should have a marker based on current settings
        // Pass POLYGON_SIZE_THRESHOLD_PERCENT as the default threshold (will be overridden by settings)
        if (
          shouldShowMarkerForPolygon(poly, map, POLYGON_SIZE_THRESHOLD_PERCENT)
        ) {
          // Get the color directly from the polygon's style options
          const polygonColor = poly.options.color || "blue";

          // Create the marker at the exact polygon center with the shape name
          console.log(
            `Creating marker for shape with name: "${shapeName}" and color: ${polygonColor}`
          );
          const marker = createMarker(centerPosition, polygonColor, shapeName);
          marker.addTo(markerLayerGroup);

          // Store the association between marker and layer
          markerToLayerMap.current.set(marker, layer);

          // Attach drag handlers to the marker
          attachMarkerDragHandlers(marker, layer, map);
        } else if (shapeName && pinSettings.mode !== "disabled") {
          // If no marker is shown but we have a shape name, show a centered label
          // Create a simple centered label without the pin
          // Use the name directly, as it's already been split from location
          const displayName = shapeName;
          console.log("Creating center label with name:", displayName);

          const nameLabel = L.marker(centerPosition, {
            interactive: false, // Not clickable or draggable
            icon: L.divIcon({
              className: "shape-center-name",
              html: `<div class="shape-center-name-text">${displayName}</div>`,
              iconSize: [0, 0], // Minimal size to avoid affecting the text positioning
              iconAnchor: [0, 0], // Center point - CSS will handle the centering
            }),
          });
          nameLabel.addTo(markerLayerGroup);

          // Store the association between label and layer
          labelToLayerMap.current.set(nameLabel, layer);
        }
      });
    });
  }

  // Update markers when geojson areas or active area changes
  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers();
  }, [geojsonAreas, activeAreaId]);

  // Set up auto-refresh of markers when pin settings change
  useEffect(() => {
    // Start listening for settings changes
    const unsubscribe = setupAutoRefreshOnSettingsChange();

    // Clean up subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

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
