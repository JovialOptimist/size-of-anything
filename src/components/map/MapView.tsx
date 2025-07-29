// src/components/map/MapView.tsx
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "../../state/mapStore";

export default function MapView() {
  const mapRef = useRef<HTMLDivElement>(null); // Ref to the map container
  const mapInstanceRef = useRef<L.Map | null>(null); // Store Leaflet map instance
  const geojsonAreas = useMapStore((state) => state.geojsonAreas);
  const isSelectingArea = useMapStore((state) => state.isSelectingArea);
  const setClickedPosition = useMapStore((state) => state.setClickedPosition);

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

      // Store map instance so we can clean up later
      mapInstanceRef.current = map;
    }

    return () => {
      if (mapInstanceRef.current) {
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
      const layer = L.geoJSON(feature, {
        style: {
          color: "blue",
          weight: 2,
          fillOpacity: 0.4,
        },
      }).addTo(layerGroup);

      // Make draggable
      enablePolygonDragging(layer, mapInstanceRef.current);

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
