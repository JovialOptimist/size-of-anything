/**
 * Portals: edge-of-screen markers for off-screen shapes.
 * - Click portal → fly view to that shape.
 * - Drag portal toward center → teleport shape to cursor.
 * - Hover → show minimap and shape name.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import type { CSSProperties } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "../../state/mapStore";
import type { MapState } from "../../state/mapStoreTypes";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { useSettings } from "../../state/settingsStore";
import type { MapLayerType } from "../../state/settingsStore";
import {
  getShapeCenter,
  isShapeOffScreen,
  getPortalPositionOnEdge,
  type PortalEdge,
} from "./portalUtils";
import { hybridProjectAndTranslateGeometry } from "../utils/geometryUtils";
import "./Portals.css";

function createMinimapTileLayer(layerType: MapLayerType): L.TileLayer {
  if (layerType === "satellite") {
    return L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxNativeZoom: 19, maxZoom: 22, minZoom: 2, noWrap: true, attribution: "" }
    );
  }
  return L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "",
    maxNativeZoom: 19,
    maxZoom: 22,
    minZoom: 2,
    noWrap: true,
  });
}

interface PortalEntry {
  feature: GeoJSONFeature;
  id: string;
  x: number;
  y: number;
  edge: PortalEdge;
}

interface PortalsProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  mapInstanceRef: React.RefObject<L.Map | null>;
}

/** Distance from map center (as fraction of min dimension) under which drop = teleport shape */
const TELEPORT_THRESHOLD = 0.25;

const TOOLTIP_OFFSET_PX = 14;

function getTooltipStyle(
  edge: PortalEdge,
  x: number,
  y: number
): CSSProperties {
  switch (edge) {
    case "top":
      return {
        left: x,
        top: y,
        transform: `translate(-50%, 0) translateY(${TOOLTIP_OFFSET_PX}px)`,
      };
    case "bottom":
      return {
        left: x,
        top: y,
        transform: `translate(-50%, -100%) translateY(-${TOOLTIP_OFFSET_PX}px)`,
      };
    case "left":
      return {
        left: x,
        top: y,
        transform: `translate(0, -50%) translateX(${TOOLTIP_OFFSET_PX}px)`,
      };
    case "right":
      return {
        left: x,
        top: y,
        transform: `translate(-100%, -50%) translateX(-${TOOLTIP_OFFSET_PX}px)`,
      };
  }
}

export default function Portals({ mapRef, mapInstanceRef }: PortalsProps) {
  const map = mapInstanceRef.current;
  const geojsonAreas = useMapStore((s: MapState) => s.geojsonAreas);
  const setActiveArea = useMapStore((s: MapState) => s.setActiveArea);
  const updateCurrentCoordinates = useMapStore(
    (s: MapState) => s.updateCurrentCoordinates
  );
  const mapLayerType = useSettings((s) => s.mapLayerType);
  const creationPanelExpanded = useMapStore((s: MapState) => s.creationPanelExpanded);

  const [portals, setPortals] = useState<PortalEntry[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{
    id: string;
    feature: GeoJSONFeature;
    startX: number;
    startY: number;
  } | null>(null);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);

  const minimapRef = useRef<HTMLDivElement>(null);
  const minimapInstanceRef = useRef<L.Map | null>(null);
  const minimapLayerRef = useRef<L.GeoJSON | null>(null);
  const justTeleportedRef = useRef(false);

  // Recompute portal list when map moves or areas change
  const updatePortals = useCallback(() => {
    const m = mapInstanceRef.current;
    if (!m || !mapRef.current) {
      setPortals([]);
      return;
    }
    const list: PortalEntry[] = [];
    geojsonAreas.forEach((feature) => {
      const id = feature.properties?.id ?? feature.properties?.index?.toString() ?? "";
      if (!id) return;
      if (!isShapeOffScreen(m, feature)) return;
      const center = getShapeCenter(feature);
      const pos = getPortalPositionOnEdge(m, L.latLng(center[0], center[1]), {
        creationPanelExpanded,
      });
      if (pos) list.push({ feature, id, x: pos.x, y: pos.y, edge: pos.edge });
    });
    setPortals(list);
  }, [geojsonAreas, mapInstanceRef, mapRef, creationPanelExpanded]);

  useEffect(() => {
    const m = mapInstanceRef.current;
    if (!m) return;
    updatePortals();
    m.on("moveend", updatePortals);
    m.on("zoomend", updatePortals);
    return () => {
      m.off("moveend", updatePortals);
      m.off("zoomend", updatePortals);
    };
  }, [updatePortals, mapInstanceRef]);

  // Minimap for hover tooltip
  const hoveredFeature = hoveredId
    ? geojsonAreas.find(
        (f) =>
          (f.properties?.id ?? f.properties?.index?.toString()) === hoveredId
      )
    : null;

  useEffect(() => {
    if (!hoveredFeature) {
      if (minimapInstanceRef.current) {
        minimapInstanceRef.current.remove();
        minimapInstanceRef.current = null;
      }
      minimapLayerRef.current = null;
      return;
    }

    if (!minimapRef.current) return;

    if (!minimapInstanceRef.current) {
      const mini = L.map(minimapRef.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([0, 0], 2);
      const tile = createMinimapTileLayer(mapLayerType);
      tile.addTo(mini);
      minimapInstanceRef.current = mini;
    }

    const mini = minimapInstanceRef.current;
    if (minimapLayerRef.current) {
      mini.removeLayer(minimapLayerRef.current);
      minimapLayerRef.current = null;
    }

    if (hoveredFeature.geometry) {
      const geo = {
        ...hoveredFeature,
        geometry: { ...hoveredFeature.geometry },
      } as GeoJSONFeature;
      const coords = (geo.geometry as any).currentCoordinates ?? geo.geometry.coordinates;
      (geo.geometry as any).coordinates = coords;
      const layer = L.geoJSON(geo as any, {
        style: {
          color: geo.properties?.color ?? "#4287f5",
          weight: 2,
          fillOpacity: 0.4,
        },
      }).addTo(mini);
      minimapLayerRef.current = layer;
      const bounds = layer.getBounds();
      if (bounds.isValid()) mini.fitBounds(bounds, { padding: [8, 8], maxZoom: 15 });
    }

    return () => {
      if (minimapLayerRef.current && mini) {
        mini.removeLayer(minimapLayerRef.current);
        minimapLayerRef.current = null;
      }
    };
  }, [hoveredFeature, mapLayerType]);

  const handlePortalClick = (id: string, feature: GeoJSONFeature) => {
    if (dragState) return;
    if (justTeleportedRef.current) {
      justTeleportedRef.current = false;
      return;
    }
    const m = mapInstanceRef.current;
    if (!m) return;
    const center = getShapeCenter(feature);
    m.flyTo(center, m.getZoom(), { duration: 0.4 });
    setActiveArea(id);
  };

  const handlePortalMouseDown = (
    e: React.MouseEvent,
    id: string,
    feature: GeoJSONFeature,
    portalX: number,
    portalY: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ id, feature, startX: e.clientX, startY: e.clientY });
    setDragPosition({ x: portalX, y: portalY });
  };

  useEffect(() => {
    if (!dragState) return;

    const onMove = (e: MouseEvent) => {
      const mapEl = mapRef.current;
      if (!mapEl) return;
      const rect = mapEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setDragPosition({ x, y });
    };
    const onUp = (e: MouseEvent) => {
      const m = mapInstanceRef.current;
      const mapEl = mapRef.current;
      if (!m || !mapEl || !dragState) {
        setDragState(null);
        setDragPosition(null);
        return;
      }
      const rect = mapEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = m.getSize();
      const centerPoint = m.latLngToContainerPoint(m.getCenter());
      const dx = x - centerPoint.x;
      const dy = y - centerPoint.y;
      const minDim = Math.min(size.x, size.y);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const isNearCenter = dist < minDim * TELEPORT_THRESHOLD;

      if (isNearCenter) {
        justTeleportedRef.current = true;
        const latLng = m.containerPointToLatLng(L.point(x, y));
        const targetCoords: [number, number] = [latLng.lng, latLng.lat];
        const featureForTransform = {
          ...dragState.feature,
          geometry: {
            ...dragState.feature.geometry,
            type: dragState.feature.geometry.type,
            coordinates:
              (dragState.feature.geometry as any).currentCoordinates ??
              dragState.feature.geometry.coordinates,
          },
        } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>;
        const translated = hybridProjectAndTranslateGeometry(
          featureForTransform,
          targetCoords
        );
        const newCoords = (translated.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates;
        updateCurrentCoordinates(dragState.id, newCoords);
        setActiveArea(dragState.id);
        m.flyTo([latLng.lat, latLng.lng], m.getZoom(), { duration: 0.3 });
      }

      setDragState(null);
      setDragPosition(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragState, mapInstanceRef, mapRef, updateCurrentCoordinates, setActiveArea]);

  if (!mapRef.current || !map) return null;

  const shapeName = (f: GeoJSONFeature) =>
    f.properties?.name ?? "Unnamed area";

  const hoveredPortal = hoveredId
    ? portals.find((p) => p.id === hoveredId)
    : null;

  return (
    <div className="portals-overlay" aria-hidden>
      {portals.map(({ feature, id, x, y }) => (
        <div
          key={id}
          className={`portal-marker ${dragState?.id === id ? "portal-dragging" : ""}`}
          style={{
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            borderColor: feature.properties?.color ?? "#4287f5",
          }}
          onClick={() => handlePortalClick(id, feature)}
          onMouseDown={(e) => handlePortalMouseDown(e, id, feature, x, y)}
          onMouseEnter={() => setHoveredId(id)}
          onMouseLeave={() => setHoveredId(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handlePortalClick(id, feature);
            }
          }}
          aria-label={`Go to ${shapeName(feature)}`}
        >
          <span className="portal-marker-dot" />
        </div>
      ))}

      {hoveredPortal && (
        <div
          className="portal-tooltip"
          style={getTooltipStyle(hoveredPortal.edge, hoveredPortal.x, hoveredPortal.y)}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="portal-tooltip-name">
            {shapeName(hoveredPortal.feature)}
          </div>
          <div className="portal-tooltip-minimap-wrap">
            <div ref={minimapRef} className="portal-tooltip-minimap" />
          </div>
        </div>
      )}

      {dragState && dragPosition && (
        <div
          className="portal-marker portal-drag-preview"
          style={{
            left: dragPosition.x,
            top: dragPosition.y,
            transform: "translate(-50%, -50%)",
            borderColor: dragState.feature.properties?.color ?? "#4287f5",
          }}
        >
          <span className="portal-marker-dot" />
        </div>
      )}
    </div>
  );
}
