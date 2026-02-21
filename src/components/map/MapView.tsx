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
import "../../styles/LayerToggleButton.css";
import "../../styles/markerLabels.css";
import { useMapStore } from "../../state/mapStore";
import { useSettings, applyMapTheme } from "../../state/settingsStore";
import type { MapLayerType } from "../../state/settingsStore";
import {
  enablePolygonDragging,
  shouldShowMarkerForPolygon,
  findCenterForMarker,
} from "../utils/geometryUtils";
import { createMarker, attachMarkerDragHandlers } from "../utils/markerUtils";
import type { GeoJSONFeature, MapState } from "../../state/mapStoreTypes";
import { setupAutoRefreshOnSettingsChange } from "../utils/markerUtils";

// Function to create tile layer based on layer type
function createTileLayer(layerType: MapLayerType): L.TileLayer {
  if (layerType === "satellite") {
    return L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution:
          'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxNativeZoom: 19,
        maxZoom: 22,
        minZoom: 2,
        noWrap: true,
        bounds: [
          [-90, -180],
          [90, 180],
        ],
      }
    );
  } else {
    return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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
    });
  }
}

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
  const currentTileLayerRef = useRef<L.TileLayer | null>(null);

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
      console.log(`Map center determined: ${center}`);
      if (cancelled) return;

      // If map not created yet, create it. Otherwise just setView.
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current!, {
          zoomControl: false,
          worldCopyJump: false,
        }).setView(center, 11);
        setCurrentMapCenter(center);

        mapInstanceRef.current = map;

        L.control.zoom({ position: "bottomright" }).addTo(map);

        // Initialize with the current layer type from settings
        const { mapLayerType } = useSettings.getState();
        const tileLayer = createTileLayer(mapLayerType);
        currentTileLayerRef.current = tileLayer;
        tileLayer.addTo(map);

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
      const idx = feature.properties.id;
      const polygonColor = feature.properties?.color || "blue";
      const isActive = activeAreaId === idx;

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
          map.fitBounds(bounds, {
            paddingTopLeft: [120, 120],
            paddingBottomRight: [120, 120],
            maxZoom: 19,
          });
        } else {
          console.warn("MapView: Bounds are not valid, skipping fitBounds");
        }
      }
    }

    numShapesRef.current = geojsonAreas.length;
  }, [geojsonAreas, activeAreaId]);

  // Function to update a specific polygon's marker or centered label
  function updatePolygonLabels(polygon: L.Polygon, layer: L.GeoJSON) {
    const map = mapInstanceRef.current;
    const markerLayerGroup = markersLayerGroupRef.current;
    if (!map || !markerLayerGroup) return;

    // Calculate the new center position using bounds for stability
    const bounds = polygon.getBounds();
    const centerPosition = bounds.getCenter();

    // Check if this polygon has a centered label
    labelToLayerMap.current.forEach((labelLayer, label) => {
      if (labelLayer === layer) {
        // Update existing centered label position
        label.setLatLng(centerPosition);
      }
    });

    // Also check if there's a marker for this polygon
    markerToLayerMap.current.forEach((markerLayer, marker) => {
      if (markerLayer === layer) {
        // Update marker position using the same stable center calculation
        marker.setLatLng(centerPosition);
      }
    });
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
          }
          // If that fails, try getting from the layer
          else {
            const layerFeature = (layer as any).feature;
            if (layerFeature && typeof layerFeature === "object") {
              const properties = layerFeature.properties;
              if (properties && properties.name) {
                shapeName = properties.name;
              }
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
          const marker = createMarker(centerPosition, polygonColor, shapeName);
          marker.addTo(markerLayerGroup);

          // Store the association between marker and layer
          markerToLayerMap.current.set(marker, layer);

          // Attach drag handlers to the marker
          attachMarkerDragHandlers(marker, layer, map);
        } else if (shapeName && pinSettings.mode !== "disabled") {
          // If no marker is shown but we have a shape name, check if we should show a centered label
          // Only show centered labels if labelMode is set to "always" (not for "onlyMarker" or "disabled")
          if (pinSettings.labelMode === "always") {
            // Split the shapeName into two lines if it has multiple words
            let displayName = shapeName;
            const words = shapeName.trim().split(/\s+/);
            if (words.length > 1 && displayName.length > 10) {
              const mid = Math.ceil(words.length / 2);
              displayName =
                words.slice(0, mid).join(" ") +
                "<br>" +
                words.slice(mid).join(" ");
            }

            // Get font size from settings
            const fontSize = pinSettings.fontSize || 16;

            const nameLabel = L.marker(centerPosition, {
              interactive: false, // Not clickable or draggable
              icon: L.divIcon({
                className: "shape-center-name",
                html: `<div class="shape-center-name-text" style="font-size: ${fontSize}px">${displayName}</div>`,
                iconSize: [0, 0], // Minimal size to avoid affecting the text positioning
                iconAnchor: [0, 0], // Use center of the icon as the anchor point
              }),
            });
            nameLabel.addTo(markerLayerGroup);

            // Store the association between label and layer
            labelToLayerMap.current.set(nameLabel, layer);
          }
        }
      });
    });
  }

  // Update markers when geojson areas or active area changes
  useEffect(() => {
    if (mapInstanceRef.current) updateMarkers();
  }, [geojsonAreas, activeAreaId]);

  // Apply map theme when settings change
  useEffect(() => {
    // Get the current theme settings
    const { mapTheme, theme } = useSettings.getState();

    // Apply the map theme if the map is initialized
    if (mapInstanceRef.current) {
      applyMapTheme(mapTheme, theme);
    }

    // Subscribe to theme setting changes
    const unsubscribe = useSettings.subscribe((state) => {
      const { mapTheme, theme } = state;
      applyMapTheme(mapTheme, theme);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Set up auto-refresh of markers when pin settings change
  useEffect(() => {
    // Start listening for settings changes
    const unsubscribe = setupAutoRefreshOnSettingsChange();

    // Clean up subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Apply map theme when settings change
  useEffect(() => {
    // Get the current theme settings
    const { mapTheme, theme } = useSettings.getState();

    // Apply the map theme immediately
    applyMapTheme(mapTheme, theme);

    // Subscribe to theme setting changes
    const unsubscribe = useSettings.subscribe((state) => {
      const { mapTheme, theme } = state;
      applyMapTheme(mapTheme, theme);
    });

    return () => {
      unsubscribe();
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

  // Get the current map layer type from settings
  const { mapLayerType } = useSettings();

  // Effect to handle map layer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentTileLayerRef.current) return;

    // Remove current tile layer
    map.removeLayer(currentTileLayerRef.current);
    
    // Create and add new tile layer
    const newTileLayer = createTileLayer(mapLayerType);
    currentTileLayerRef.current = newTileLayer;
    newTileLayer.addTo(map);
  }, [mapLayerType]);

  return (
    <div
      className={`map-container ${isSelectingArea ? "selecting-area" : ""} ${
        magicWandMode ? "magic-wand-active" : ""
      }`}
    >
      <div id="map" ref={mapRef}></div>
    </div>
  );
}
