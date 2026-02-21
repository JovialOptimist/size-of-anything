/**
 * Search tab for Creation Panel: two-column layout with list, minimap, attributes, Place here / Outline original.
 */
import { useState, useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapStore } from "../../state/mapStore";
import { useSettings } from "../../state/settingsStore";
import type { MapLayerType } from "../../state/settingsStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { OSM_Type } from "../../state/mapStoreTypes";
import { fetchCandidates } from "../panels/TextSearchPanel";
import { fetchFeaturesAtPoint } from "../../utils/magicWandSearch";
import { countCoordinates, fixMultiPolygon } from "../utils/geometryUtils";
import { describeOsmObject } from "../utils/describeOsmObject";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import "./CreationPanelSearch.css";

// Simple icon type for list (building, park, water, place, other)
function getOsmIconType(feature: GeoJSONFeature): string {
  const cls = (feature.properties?.osmClass ?? "").toLowerCase();
  const type = (feature.properties?.osmType ?? "").toLowerCase();
  const what = (feature.properties?.whatIsIt ?? "").toLowerCase();
  if (cls.includes("building") || type.includes("building") || what.includes("building")) return "building";
  if (cls.includes("natural") || type.includes("park") || what.includes("park") || what.includes("forest")) return "park";
  if (cls.includes("water") || type.includes("water") || what.includes("lake") || what.includes("river")) return "water";
  if (cls.includes("place") || type.includes("place") || what.includes("city") || what.includes("town")) return "place";
  return "other";
}

const ICON_EMOJI: Record<string, string> = {
  building: "🏢",
  park: "🌳",
  water: "💧",
  place: "📍",
  other: "📌",
};

/** Display name when placed (first part only, no address) - matches mapStore split */
function getDisplayName(feature: GeoJSONFeature): string {
  const name = feature.properties?.name ?? "Unnamed";
  const first = name.split(",")[0]?.trim();
  return first || name;
}

/** Location for list subtitle: last 3 parts of display_name (city, state, country) */
function formatLocationShort(feature: GeoJSONFeature): string {
  const name = feature.properties?.name ?? "";
  const parts = name.split(",").map((s: string) => s.trim()).filter(Boolean);
  if (parts.length <= 1) return "—";
  const last3 = parts.slice(-3);
  return last3.join(", ");
}

function createTileLayer(layerType: MapLayerType): L.TileLayer {
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

interface CreationPanelSearchProps {
  query: string;
  searchTrigger: number;
  onPlaced?: () => void;
}

export default function CreationPanelSearch({ query, searchTrigger, onPlaced }: CreationPanelSearchProps) {
  const [candidates, setCandidates] = useState<GeoJSONFeature[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPropertiesModal, setShowPropertiesModal] = useState(false);
  const minimapRef = useRef<HTMLDivElement>(null);
  const minimapInstanceRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.GeoJSON | null>(null);

  const addGeoJSONFromSearch = useMapStore((s) => s.addGeoJSONFromSearch);
  const setOnMapClick = useMapStore((s) => s.setOnMapClick);
  const magicWandMode = useMapStore((s) => s.magicWandMode);
  const setMagicWandMode = useMapStore((s) => s.setMagicWandMode);
  const { useMetricUnits } = useSettings();
  const mapLayerType = useSettings((s) => s.mapLayerType);

  const selectedFeature = candidates.length > 0 ? candidates[selectedIndex] ?? candidates[0] : null;

  // Run search when parent triggers it (header search button / Enter)
  useEffect(() => {
    if (searchTrigger > 0 && query.trim()) handleSearch();
  }, [searchTrigger]); // eslint-disable-line react-hooks/exhaustive-deps -- only run when searchTrigger changes

  // Auto-select first when candidates change
  useEffect(() => {
    if (candidates.length > 0) setSelectedIndex(0);
  }, [candidates]);

  // Minimap: init (no zoom control, non-interactive, no attribution) and update when selected feature or mapLayerType changes
  useEffect(() => {
    if (!minimapRef.current) return;

    if (!minimapInstanceRef.current) {
      const map = L.map(minimapRef.current, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false,
      }).setView([0, 0], 2);
      const tile = createTileLayer(mapLayerType);
      tile.addTo(map);
      minimapInstanceRef.current = map;
    }

    const map = minimapInstanceRef.current;
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }

    if (selectedFeature?.geometry) {
      const geo = { ...selectedFeature, geometry: { ...selectedFeature.geometry } } as GeoJSONFeature;
      if ((geo.geometry as any).currentCoordinates) (geo.geometry as any).coordinates = (geo.geometry as any).currentCoordinates;
      const layer = L.geoJSON(geo as any, {
        style: { color: "#f97316", weight: 2, fillOpacity: 0.3, dashArray: "8,8" },
      }).addTo(map);
      layerRef.current = layer;
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [8, 8], maxZoom: 17 });
    }

    return () => {
      if (layerRef.current && map) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [selectedFeature, mapLayerType]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setCandidates([]);
    setError(null);
    setIsLoading(true);
    try {
      const raw = await fetchCandidates(query);
      const geojsons: GeoJSONFeature[] = raw.map((place: any) => {
        const feature: GeoJSONFeature = {
          type: "Feature",
          geometry: {
            type: place.osm_type === OSM_Type.WAY ? "Polygon" : "MultiPolygon",
            coordinates: place.geojson.coordinates,
            coordinateCount: countCoordinates(place.geojson.coordinates),
          },
          properties: {
            name: place.display_name,
            osmType: place.type,
            osmId: place.osm_id,
            osmClass: place.class,
            location: place.location,
            whatIsIt: describeOsmObject(place),
          },
        };
        return fixMultiPolygon(feature);
      });
      if (geojsons.length === 0) {
        setError("No results. Try a different query.");
        return;
      }
      setCandidates(geojsons);
    } catch (e) {
      setError("Search failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = async (latlng: { lat: number; lng: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const features = await fetchFeaturesAtPoint(latlng.lat, latlng.lng);
      if (features.length === 0) {
        setError("No areas found at this location.");
        return;
      }
      setCandidates(features);
    } catch (e) {
      setError("Failed to fetch areas.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClickRef = useRef(handleMapClick);
  handleMapClickRef.current = handleMapClick;

  // When magic wand is active (toggled from header), set map click handler. Use a stable
  // callback so the effect only depends on magicWandMode and doesn't cause update loops.
  useEffect(() => {
    if (magicWandMode) {
      setOnMapClick((latlng: { lat: number; lng: number }) => handleMapClickRef.current(latlng));
    } else {
      setOnMapClick(null);
    }
    return () => setOnMapClick(null);
  }, [magicWandMode, setOnMapClick]);

  const handlePlaceHere = () => {
    if (!selectedFeature) return;
    addGeoJSONFromSearch(selectedFeature, { placeAtCenter: true });
    onPlaced?.();
  };

  const handleOutlineOriginal = () => {
    if (!selectedFeature) return;
    addGeoJSONFromSearch(selectedFeature);
    onPlaced?.();
  };

  const areaKm2 = selectedFeature ? calculateAreaInKm2(selectedFeature) : 0;
  const areaStr = useMetricUnits
    ? areaKm2 >= 1
      ? `${areaKm2.toFixed(2)} km²`
      : `${(areaKm2 * 1e6).toFixed(0)} m²`
    : `${(areaKm2 * 0.386102).toFixed(2)} mi²`;

  return (
    <div className="creation-panel-search">
      <div className="creation-panel-search-left">
        {error && <div className="creation-panel-search-error">{error}</div>}
        {isLoading && <div className="creation-panel-search-loading">Searching…</div>}

        <ul className="creation-panel-search-list">
          {candidates.map((f, i) => (
            <li key={i}>
              <button
                type="button"
                className={`creation-panel-search-list-item ${i === selectedIndex ? "selected" : ""}`}
                onClick={() => setSelectedIndex(i)}
              >
                <span className="creation-panel-search-icon" aria-hidden>
                  {ICON_EMOJI[getOsmIconType(f)] ?? ICON_EMOJI.other}
                </span>
                <div className="creation-panel-search-list-text">
                  <span className="creation-panel-search-list-name">{getDisplayName(f)}</span>
                  <span className="creation-panel-search-list-location">{formatLocationShort(f)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="creation-panel-search-right">
        <div className="creation-panel-minimap-wrap">
          <div ref={minimapRef} className="creation-panel-minimap" />
          {!selectedFeature && (
            <div className="creation-panel-minimap-empty" aria-hidden>
              <span className="creation-panel-minimap-empty-title">Areas will appear here</span>
              <span className="creation-panel-minimap-empty-desc">Description here</span>
            </div>
          )}
        </div>

        <div className="creation-panel-attributes">
          {selectedFeature ? (
            <>
              <div className="creation-panel-attr">
                <strong>Name</strong><br />{getDisplayName(selectedFeature)}
              </div>
              <div className="creation-panel-attr">
                <strong>Location</strong><br />{formatLocationShort(selectedFeature)}
              </div>
              <div className="creation-panel-attr">
                <strong>Type</strong> {selectedFeature.properties?.whatIsIt ?? "—"}
              </div>
              <div className="creation-panel-attr">
                <strong>Area</strong> {areaStr}
              </div>
              <button type="button" className="creation-panel-show-props" onClick={() => setShowPropertiesModal(true)}>
                Show properties…
              </button>
            </>
          ) : (
            <p className="creation-panel-attr-placeholder">Select a result to see details.</p>
          )}
        </div>
        <div className="creation-panel-actions">
          <button
            type="button"
            className="creation-panel-action creation-panel-action-place"
            onClick={handlePlaceHere}
            disabled={!selectedFeature}
          >
            Place here
          </button>
          <button
            type="button"
            className="creation-panel-action creation-panel-action-outline"
            onClick={handleOutlineOriginal}
            disabled={!selectedFeature}
          >
            Outline original
          </button>
        </div>
      </div>

      {showPropertiesModal && selectedFeature && (
        <div className="creation-panel-props-backdrop" onClick={() => setShowPropertiesModal(false)}>
          <div className="creation-panel-props-modal" onClick={(e) => e.stopPropagation()}>
            <h4>Properties</h4>
            <pre className="creation-panel-props-pre">
              {JSON.stringify(selectedFeature.properties, null, 2)}
            </pre>
            <button type="button" onClick={() => setShowPropertiesModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
