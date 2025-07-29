// src/components/map/MapView.tsx
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "../../state/mapStore";

// Zoom level threshold below which markers will be shown
const MARKER_ZOOM_THRESHOLD = 9;

// Global references for access in event handlers
declare global {
  interface Window {
    markersLayerGroupRef: React.MutableRefObject<L.LayerGroup | null>;
    markerToLayerMap: React.MutableRefObject<Map<L.Marker, L.GeoJSON>>;
  }
}

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null); // Ref to the map container
  const mapInstanceRef = useRef<L.Map | null>(null); // Store Leaflet map instance
  const geojsonAreas = useMapStore((state) => state.geojsonAreas);
  const isSelectingArea = useMapStore((state) => state.isSelectingArea);
  const setClickedPosition = useMapStore((state) => state.setClickedPosition);

  // Store current zoom level
  const [currentZoomLevel, setCurrentZoomLevel] = useState<number>(13);

  // Reference to store markers for each polygon when zoomed out
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);
  window.markersLayerGroupRef = markersLayerGroupRef;

  // Reference to store mapping between markers and their corresponding GeoJSON layers
  const markerToLayerMap = useRef<Map<L.Marker, L.GeoJSON>>(new Map());
  window.markerToLayerMap = markerToLayerMap;

  useEffect(() => {
    // Prevent reinitialization
    if (mapRef.current && !mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        zoomControl: false, // disable default position of zoom control
      }).setView([47.615, -122.035], 13);

      // Add back the zoom control to the bottom right
      L.control
        .zoom({
          position: "bottomright",
        })
        .addTo(map);

      // Add a basic tile layer
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/">OSM</a> contributors',
      }).addTo(map);

      // Handle map clicks for area selection
      map.on("click", (e) => {
        if (isSelectingArea) {
          const { lat, lng } = e.latlng;
          setClickedPosition([lat, lng]);
        }
        // If in magic wand mode, we will handle clicks differently
        const onMapClick = useMapStore.getState().onMapClick;
        if (onMapClick) {
          onMapClick(e.latlng);
        }
      });

      // Add zoom event handler
      map.on("zoomend", () => {
        const newZoomLevel = map.getZoom();
        setCurrentZoomLevel(newZoomLevel);

        // Handle marker visibility based on zoom level
        if (newZoomLevel <= MARKER_ZOOM_THRESHOLD) {
          createMarkersForPolygons();
        } else {
          removeMarkersForPolygons();
        }
      });

      // Create a layer group for markers
      const markerLayerGroup = L.layerGroup().addTo(map);
      markersLayerGroupRef.current = markerLayerGroup;

      // Store map instance so we can clean up later
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
        // Remove event listeners
        mapInstanceRef.current.off("zoomend");

        mapInstanceRef.current.remove(); // Clean up Leaflet map
        mapInstanceRef.current = null;
      }
    };
  }, [isSelectingArea, setClickedPosition]);

  // Reference to store our GeoJSON layer group for better management
  const geoJSONLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Handle GeoJSON data changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Remove any existing GeoJSON layer group
    if (geoJSONLayerGroupRef.current) {
      geoJSONLayerGroupRef.current.clearLayers();
      map.removeLayer(geoJSONLayerGroupRef.current);
    }

    // Create a new layer group to hold all GeoJSON features
    const layerGroup = L.layerGroup().addTo(map);
    geoJSONLayerGroupRef.current = layerGroup;

    // Mark the layer group for future cleanup
    (layerGroup as any)._isGeoJSON = true;

    if (geojsonAreas.length === 0) return;

    // Create a bounds object to fit all features
    let bounds = new L.LatLngBounds([]);

    // Add each GeoJSON feature to the layer group
    geojsonAreas.forEach((feature) => {
      let recursiveLength = findRecursiveLength(feature.geometry.coordinates);
      if (recursiveLength > 5000) {
        // simplify the geometry if it has too many points
        console.warn(
          "Feature has too many points, simplifying geometry:",
          recursiveLength
        );
        // Remove half of the coordinates
        feature.geometry.coordinates = feature.geometry.coordinates.map(
          (ring: any) => {
            if (Array.isArray(ring[0])) {
              return ring.map((subRing: number[][]) =>
                subRing.filter((_, index: number) => index % 5 === 0)
              );
            } else {
              return ring.filter(
                (_: number[], index: number) => index % 5 === 0
              );
            }
          }
        );
      }
      const layer = L.geoJSON(feature, {
        style: {
          color: "blue",
          weight: 2,
          fillOpacity: 0.4,
        },
      }).addTo(layerGroup);

      // Make draggable
      enablePolygonDragging(layer, mapInstanceRef.current);
      // Allow right-click to remove
      rightClickToRemove(layer, mapInstanceRef.current);

      // Set bounds to the feature's bounds
      try {
        bounds = layer.getBounds();
      } catch (error) {
        console.warn("Could not get bounds for a feature:", error);
      }
    });

    // If we have valid bounds, fit the map to them
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [geojsonAreas]);

  // Function to create markers for polygons when zoomed out
  const createMarkersForPolygons = () => {
    if (
      !mapInstanceRef.current ||
      !geoJSONLayerGroupRef.current ||
      !markersLayerGroupRef.current
    )
      return;

    // First, clear any existing markers
    removeMarkersForPolygons();

    // For each GeoJSON layer (which might contain multiple polygons), create a marker
    geoJSONLayerGroupRef.current.eachLayer((layer) => {
      if (layer instanceof L.GeoJSON) {
        layer.eachLayer((innerLayer) => {
          if (innerLayer instanceof L.Polygon) {
            // Calculate center of the polygon
            const center = calculatePolygonCenter(innerLayer);

            // Create a marker at the center
            const marker = L.marker(center, {
              draggable: true,
              title: "Drag to move area", // Tooltip on hover
              icon: L.divIcon({
                className: "area-marker",
                html: `<div style="
                  width: 12px; 
                  height: 12px; 
                  background-color: blue; 
                  border-radius: 50%; 
                  border: 2px solid white;
                  box-shadow: 0 0 4px rgba(0,0,0,0.5);
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            });

            // Add the marker to the marker layer group
            marker.addTo(markersLayerGroupRef.current!);

            // Store the reference between marker and GeoJSON layer
            markerToLayerMap.current.set(marker, layer as L.GeoJSON);

            // Set up drag events to move the polygon
            marker.on("dragstart", function (e) {
              // Store the initial positions
              const dragStartPos = e.target.getLatLng();
              (marker as any)._dragStartPos = dragStartPos;

              // Disable map dragging during marker drag
              mapInstanceRef.current?.dragging.disable();
            });

            marker.on("drag", function () {
              // Get the current layer associated with this marker
              const geoJsonLayer = markerToLayerMap.current.get(marker);
              if (!geoJsonLayer) return;

              const dragStartPos = (marker as any)._dragStartPos;
              const currentPos = marker.getLatLng();

              // Calculate lat/lng differences using the same algorithm as polygon dragging
              const latDiff = currentPos.lat - dragStartPos.lat;
              const lngDiff = currentPos.lng - dragStartPos.lng;

              // Calculate cosine scaling factor for the Earth's curvature
              const startLat = dragStartPos.lat;
              const newLat = currentPos.lat;

              const startCos = Math.cos((startLat * Math.PI) / 180);
              const newCos = Math.cos((newLat * Math.PI) / 180);
              const widthScale = startCos / newCos;

              // Function to apply the same transformation as in polygon dragging
              function shiftAndScaleRing(ring: L.LatLng[]) {
                const centerLng =
                  ring.reduce((sum, pt) => sum + pt.lng, 0) / ring.length;

                return ring.map((pt) => {
                  const newLat = pt.lat + latDiff;
                  const lngOffset = pt.lng - centerLng;
                  const scaledLngOffset = lngOffset * widthScale;
                  const newLng = centerLng + scaledLngOffset + lngDiff;
                  return L.latLng(newLat, newLng);
                });
              }

              // Move all polygons in the layer
              geoJsonLayer.eachLayer((polygonLayer) => {
                if (polygonLayer instanceof L.Polygon) {
                  // Get current coordinates
                  const latLngs = polygonLayer.getLatLngs() as any;

                  // Apply the same transformation as polygon dragging
                  const transformed = latLngs.map((ring: any) => {
                    if (Array.isArray(ring[0])) {
                      return ring.map((subRing: any) =>
                        shiftAndScaleRing(subRing)
                      );
                    } else {
                      return shiftAndScaleRing(ring);
                    }
                  });

                  // Update polygon coordinates
                  polygonLayer.setLatLngs(transformed);
                }
              });

              // Update the dragStartPos for the next drag event
              (marker as any)._dragStartPos = currentPos;
            });

            marker.on("dragend", function () {
              // Re-enable map dragging
              mapInstanceRef.current?.dragging.enable();

              // Clean up
              delete (marker as any)._dragStartPos;
            });
          }
        });
      }
    });
  };

  // Function to remove all markers for polygons
  const removeMarkersForPolygons = () => {
    if (markersLayerGroupRef.current) {
      markersLayerGroupRef.current.clearLayers();
      markerToLayerMap.current.clear();
    }
  };

  // Check if we need to display markers after geojsonAreas are updated
  useEffect(() => {
    if (currentZoomLevel <= MARKER_ZOOM_THRESHOLD && mapInstanceRef.current) {
      createMarkersForPolygons();
    }
  }, [geojsonAreas, currentZoomLevel]);

  return (
    <div className={`map-container ${isSelectingArea ? "selecting-area" : ""}`}>
      <div id="map" ref={mapRef}></div>
    </div>
  );
}

function enablePolygonDragging(geoJsonLayer: L.GeoJSON, map: L.Map | null) {
  if (!map) return;

  geoJsonLayer.eachLayer((innerLayer) => {
    // Only enable dragging on polygon layers
    if (innerLayer instanceof L.Polygon) {
      let originalLatLngs: L.LatLng[][] | null = null;
      let dragStartLatLng: L.LatLng | null = null;

      innerLayer.on("mousedown", function (event) {
        map.dragging.disable();
        dragStartLatLng = event.latlng;

        // Deep copy of the original points
        const latLngs = innerLayer.getLatLngs() as any;
        originalLatLngs = latLngs.map((ring: any) =>
          Array.isArray(ring[0])
            ? ring.map((subRing: any) =>
                subRing.map((pt: L.LatLng) => L.latLng(pt.lat, pt.lng))
              )
            : ring.map((pt: L.LatLng) => L.latLng(pt.lat, pt.lng))
        );

        function moveHandler(moveEvent: { latlng: L.LatLng }) {
          if (!originalLatLngs || !dragStartLatLng) return;

          const latDiff = moveEvent.latlng.lat - dragStartLatLng.lat;
          const lngDiff = moveEvent.latlng.lng - dragStartLatLng.lng;

          const startLat = dragStartLatLng.lat;
          const newLat = moveEvent.latlng.lat;

          const startCos = Math.cos((startLat * Math.PI) / 180);
          const newCos = Math.cos((newLat * Math.PI) / 180);
          const widthScale = startCos / newCos;

          function shiftAndScaleRing(ring: L.LatLng[]) {
            const centerLng =
              ring.reduce((sum, pt) => sum + pt.lng, 0) / ring.length;

            return ring.map((pt) => {
              const newLat = pt.lat + latDiff;
              const lngOffset = pt.lng - centerLng;
              const scaledLngOffset = lngOffset * widthScale;
              const newLng = centerLng + scaledLngOffset + lngDiff;
              return L.latLng(newLat, newLng);
            });
          }

          const transformed = originalLatLngs.map((ring: any) => {
            if (Array.isArray(ring[0])) {
              return ring.map((subRing: any) => shiftAndScaleRing(subRing));
            } else {
              return shiftAndScaleRing(ring);
            }
          });

          (innerLayer as L.Polygon).setLatLngs(transformed);

          // Update marker position if visible
          const markersGroup = window.markersLayerGroupRef?.current;
          const markerMap = window.markerToLayerMap?.current;

          if (
            map &&
            map.getZoom() <= MARKER_ZOOM_THRESHOLD &&
            markersGroup &&
            markerMap
          ) {
            // Find any markers that need to be updated
            markerMap.forEach((geoLayer, marker) => {
              // Check if the marker's layer contains this polygon
              let containsPolygon = false;
              geoLayer.eachLayer((l) => {
                if (l === innerLayer) {
                  containsPolygon = true;
                }
              });

              if (containsPolygon) {
                // Update marker position to the new center of the polygon
                const newCenter = calculatePolygonCenter(
                  innerLayer as L.Polygon
                );
                marker.setLatLng(newCenter);
              }
            });
          }
        }

        function stopHandler() {
          if (!map) return;
          map.off("mousemove", moveHandler);
          map.off("mouseup", stopHandler);
          map.dragging.enable();

          originalLatLngs = null;
          dragStartLatLng = null;
        }

        map.on("mousemove", moveHandler);
        map.on("mouseup", stopHandler);
      });
    }
  });
}

function rightClickToRemove(geoJsonLayer: L.GeoJSON, map: L.Map | null) {
  if (!map) return;

  geoJsonLayer.eachLayer((layer) => {
    layer.on("contextmenu", (event) => {
      event.originalEvent.preventDefault();
      geoJsonLayer.removeLayer(layer);
    });
  });
}

function findRecursiveLength(coordinates: any[]): number {
  if (!Array.isArray(coordinates)) return 0;
  return coordinates.reduce((sum, coord) => {
    if (Array.isArray(coord)) {
      return sum + findRecursiveLength(coord);
    }
    return sum + 1; // Count the coordinate itself
  }, 0);
}

// Function to calculate the center of a polygon
function calculatePolygonCenter(polygon: L.Polygon): L.LatLng {
  try {
    return polygon.getCenter();
  } catch (e) {
    // Fallback method if getCenter fails
    const bounds = polygon.getBounds();
    return bounds.getCenter();
  }
}
