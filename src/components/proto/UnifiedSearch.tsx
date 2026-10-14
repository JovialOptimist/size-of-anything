/**
 * Unified search (UI-overhaul prototype): one box replaces the Search, Custom,
 * Special, and History tabs. Typing "2 km circle" offers a custom shape,
 * object names match instantly, Enter searches real places, and an empty box
 * shows recent shapes.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapStore } from "../../state/mapStore";
import { useSettings } from "../../state/settingsStore";
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import { searchPlaces } from "../utils/placeSearch";
import { fetchFeaturesAtPoint } from "../../utils/magicWandSearch";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import { formatArea } from "../utils/elementActions";
import { parseCustomShapeQuery, buildCustomShapeFeature } from "../utils/customShapes";
import { SPECIAL_SHAPES, buildSpecialShapeFeature } from "../utils/specialShapes";
import type { SpecialShapeDef } from "../utils/specialShapes";
import { SearchIcon } from "../ui/Icons";
import { CheckIcon, CloseIcon, HistoryIcon, ObjectIcon, PointerIcon, ShapeIcon } from "../ui/ProtoIcons";

type Filter = "all" | "places" | "objects" | "custom";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "places", label: "Places" },
  { key: "objects", label: "Objects" },
  { key: "custom", label: "Custom shapes" },
];
const CUSTOM_EXAMPLES = ["1 km circle", "500 m square", "40 acres", "1 sq mi square"];

/** One selectable row; `run` places it. */
interface Item {
  key: string;
  run: () => void;
}

const firstPart = (name: string) => name.split(",")[0]?.trim() || name;
const lastParts = (name: string) => {
  const parts = name.split(",").map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(-3).join(", ") : "";
};

export default function UnifiedSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [places, setPlaces] = useState<GeoJSONFeature[]>([]);
  const [placesFor, setPlacesFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addGeoJSONFromSearch = useMapStore((s) => s.addGeoJSONFromSearch);
  const currentMapCenter = useMapStore((s) => s.currentMapCenter);
  const historyItems = useMapStore((s) => s.historyItems);
  const magicWandMode = useMapStore((s) => s.magicWandMode);
  const setMagicWandMode = useMapStore((s) => s.setMagicWandMode);
  const setOnMapClick = useMapStore((s) => s.setOnMapClick);
  const setHoveredCandidate = useMapStore((s) => s.setHoveredCandidate);
  const setCreationPanelExpanded = useMapStore((s) => s.setCreationPanelExpanded);
  const useMetricUnits = useSettings((s) => s.useMetricUnits);

  const trimmed = query.trim();
  const parsed = useMemo(() => parseCustomShapeQuery(trimmed), [trimmed]);
  const show = (f: Filter) => filter === "all" || filter === f;

  useEffect(() => {
    setCreationPanelExpanded(open);
  }, [open, setCreationPanelExpanded]);

  // Close when clicking outside (but not while picking on the map)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (magicWandMode) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, magicWandMode]); // eslint-disable-line react-hooks/exhaustive-deps -- close is stable enough for a listener

  // "Pick on map": the next map click looks up areas at that point
  const pickRef = useRef<(latlng: { lat: number; lng: number }) => void>(() => {});
  pickRef.current = async (latlng) => {
    setMagicWandMode(false);
    setOpen(true);
    setFilter("places");
    setLoading(true);
    setError(null);
    try {
      const found = await fetchFeaturesAtPoint(latlng.lat, latlng.lng);
      setPlaces(found);
      setPlacesFor("this spot on the map");
      if (found.length === 0) setError("Nothing found at that spot. Try somewhere else.");
    } catch {
      setError("Couldn't look up that spot. Try again.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (magicWandMode) setOnMapClick((latlng: { lat: number; lng: number }) => pickRef.current(latlng));
    else setOnMapClick(null);
    return () => setOnMapClick(null);
  }, [magicWandMode, setOnMapClick]);

  function close() {
    setOpen(false);
    setHighlight(-1);
    setHoveredCandidate(null);
  }

  const afterPlace = () => {
    close();
    inputRef.current?.blur();
  };

  const runPlaceSearch = async () => {
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setPlaces([]);
    try {
      const found = await searchPlaces(trimmed);
      setPlaces(found);
      setPlacesFor(trimmed);
      if (found.length === 0) setError(`No places match "${trimmed}". Try a different spelling.`);
    } catch {
      setError("Search failed. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const placeCustom = () => {
    if (!parsed) return;
    addGeoJSONFromSearch(buildCustomShapeFeature(parsed, currentMapCenter));
    afterPlace();
  };

  const placeObject = async (shape: SpecialShapeDef) => {
    const feature = await buildSpecialShapeFeature(shape, currentMapCenter);
    if (feature) addGeoJSONFromSearch(feature);
    afterPlace();
  };

  const placePlace = (feature: GeoJSONFeature, atCenter: boolean) => {
    addGeoJSONFromSearch(feature, atCenter ? { placeAtCenter: true } : undefined);
    afterPlace();
  };

  const placeRecent = (feature: GeoJSONFeature) => {
    addGeoJSONFromSearch(feature);
    afterPlace();
  };

  // Build the visible sections, plus a flat list of rows for arrow-key navigation
  const items: Item[] = [];
  const objects = SPECIAL_SHAPES.filter(
    (s) => !trimmed || s.name.toLowerCase().includes(trimmed.toLowerCase())
  );
  const recents = historyItems
    .filter((f, i, all) => all.findIndex((g) => g.properties.name === f.properties.name) === i)
    .slice(0, 5);
  const showRecents = !trimmed && filter === "all" && recents.length > 0;
  const showCustom = show("custom") && !!parsed;
  const showPlaces = show("places") && (places.length > 0 || (!!trimmed && !parsed));

  if (showCustom) items.push({ key: "custom", run: placeCustom });
  if (showRecents) recents.forEach((f, i) => items.push({ key: `recent-${i}`, run: () => placeRecent(f) }));
  if (show("places")) places.forEach((f, i) => items.push({ key: `place-${i}`, run: () => placePlace(f, false) }));
  if (show("objects")) objects.forEach((s) => items.push({ key: `object-${s.id}`, run: () => placeObject(s) }));
  const indexOf = (key: string) => items.findIndex((it) => it.key === key);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (items.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next = (highlight + step + items.length) % items.length;
      setHighlight(next);
      const place = items[next].key.startsWith("place-") ? places[Number(items[next].key.slice(6))] : null;
      setHoveredCandidate(place ?? null);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && items[highlight]) items[highlight].run();
      else if (parsed && show("custom")) placeCustom();
      else runPlaceSearch();
    } else if (e.key === "Escape") {
      if (magicWandMode) setMagicWandMode(false);
      close();
      inputRef.current?.blur();
    }
  };

  const rowClass = (key: string) =>
    `proto-result ${indexOf(key) === highlight && highlight >= 0 ? "proto-result-active" : ""}`;

  return (
    <div className={`proto-search ${open ? "proto-search-open" : ""}`} ref={wrapRef}>
      <div className="proto-search-bar">
        <span className="proto-search-icon" aria-hidden="true">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          className="proto-search-input"
          placeholder="Search places, objects, or “2 km circle”"
          value={query}
          aria-label="Search for something to place"
          aria-expanded={open}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setHighlight(-1);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button
            type="button"
            className="proto-icon-btn"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setPlaces([]);
              setPlacesFor(null);
              setError(null);
              inputRef.current?.focus();
            }}
          >
            <CloseIcon />
          </button>
        )}
        <button
          type="button"
          className={`proto-pick-btn ${magicWandMode ? "proto-pick-on" : ""}`}
          aria-pressed={magicWandMode}
          onClick={() => {
            setMagicWandMode(!magicWandMode);
            setOpen(true);
          }}
          title="Click the map to find the areas at that spot"
        >
          <PointerIcon /> <span className="proto-pick-label">{magicWandMode ? "Picking…" : "Pick on map"}</span>
        </button>
      </div>

      {open && (
        <div className="proto-search-drop">
          <div className="proto-chips" role="radiogroup" aria-label="Result type">
            {FILTERS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filter === key}
                className={`proto-chip ${filter === key ? "proto-chip-on" : ""}`}
                onClick={() => {
                  setFilter(key);
                  setHighlight(-1);
                }}
              >
                {filter === key && <CheckIcon />} {label}
              </button>
            ))}
          </div>

          <div className="proto-results" onMouseLeave={() => setHoveredCandidate(null)}>
            {magicWandMode && (
              <div className="proto-banner">
                <PointerIcon /> Click anywhere on the map to see the areas there. Press Esc to cancel.
              </div>
            )}

            {showCustom && parsed && (
              <ResultGroup title="Custom shape">
                <button type="button" className={rowClass("custom")} onClick={placeCustom}>
                  <span className="proto-result-icon"><ShapeIcon /></span>
                  <span className="proto-result-text">
                    <span className="proto-result-name">{parsed.label}</span>
                    <span className="proto-result-sub">{parsed.description} · placed at the map's centre</span>
                  </span>
                  <span className="proto-kbd">Enter</span>
                </button>
              </ResultGroup>
            )}

            {filter === "custom" && !parsed && (
              <ResultGroup title="Custom shape">
                <p className="proto-hint">Type a size and a shape. Try one of these:</p>
                <div className="proto-examples">
                  {CUSTOM_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      className="proto-chip"
                      onClick={() => {
                        setQuery(ex);
                        inputRef.current?.focus();
                      }}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </ResultGroup>
            )}

            {showRecents && (
              <ResultGroup title="Recent">
                {recents.map((f, i) => (
                  <button key={i} type="button" className={rowClass(`recent-${i}`)} onClick={() => placeRecent(f)}>
                    <span className="proto-result-icon"><HistoryIcon /></span>
                    <span className="proto-result-text">
                      <span className="proto-result-name">{firstPart(f.properties.name)}</span>
                      <span className="proto-result-sub">{f.properties.whatIsIt || "Shape"}</span>
                    </span>
                  </button>
                ))}
              </ResultGroup>
            )}

            {showPlaces && (
              <ResultGroup title={placesFor ? `Places matching ${placesFor === trimmed ? `"${placesFor}"` : placesFor}` : "Places"}>
                {loading && <p className="proto-hint">Searching…</p>}
                {error && <p className="proto-hint proto-error">{error}</p>}
                {!loading && trimmed && placesFor !== trimmed && !parsed && (
                  <button type="button" className="proto-result" onClick={runPlaceSearch}>
                    <span className="proto-result-icon"><SearchIcon /></span>
                    <span className="proto-result-text">
                      <span className="proto-result-name">Search places for "{trimmed}"</span>
                    </span>
                    <span className="proto-kbd">Enter</span>
                  </button>
                )}
                {places.map((f, i) => (
                  <div
                    key={i}
                    className={rowClass(`place-${i}`)}
                    onMouseEnter={() => setHoveredCandidate(f)}
                  >
                    <button type="button" className="proto-result-main" onClick={() => placePlace(f, false)}>
                      <span className="proto-result-text">
                        <span className="proto-result-name">{firstPart(f.properties.name)}</span>
                        <span className="proto-result-sub">
                          {[f.properties.whatIsIt, lastParts(f.properties.name)].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="proto-result-area">
                        {formatArea(calculateAreaInKm2(f as unknown as GeoJSON.Feature), useMetricUnits)}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="proto-mini-btn"
                      onClick={() => placePlace(f, true)}
                      title="Move a copy to the middle of your current view"
                    >
                      Place here
                    </button>
                  </div>
                ))}
              </ResultGroup>
            )}

            {show("objects") && objects.length > 0 && (
              <ResultGroup title="Objects">
                {objects.map((s) => (
                  <button key={s.id} type="button" className={rowClass(`object-${s.id}`)} onClick={() => placeObject(s)}>
                    <span className="proto-result-icon">
                      <img src={s.svgUrl} alt="" className="proto-object-img" />
                    </span>
                    <span className="proto-result-text">
                      <span className="proto-result-name">{s.name}</span>
                      <span className="proto-result-sub">{s.description}</span>
                    </span>
                  </button>
                ))}
              </ResultGroup>
            )}

            {items.length === 0 && !showPlaces && !magicWandMode && filter !== "custom" && (
              <p className="proto-hint">
                <ObjectIcon /> Nothing here yet. Search for a place, or type a size like "2 km circle".
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="proto-group">
      <div className="proto-group-title">{title}</div>
      {children}
    </div>
  );
}
