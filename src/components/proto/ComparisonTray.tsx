/**
 * Comparison tray (UI-overhaul prototype): lists every shape on the map with its
 * area, a bar scaled to the largest shape, and how the shapes compare with a
 * chosen reference shape.
 */
import { useMemo, useState } from "react";
import { useMapStore } from "../../state/mapStore";
import { useSettings } from "../../state/settingsStore";
import { zoomToFeature } from "../../state/mapRegistry";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import { formatArea, formatRatio } from "../utils/elementActions";
import { ChevronIcon, LayersIcon, StarIcon, TrashIcon } from "../ui/ProtoIcons";

interface ComparisonTrayProps {
  /** Rendered inside the mobile bottom sheet instead of floating on the map */
  embedded?: boolean;
}

export default function ComparisonTray({ embedded = false }: ComparisonTrayProps) {
  const geojsonAreas = useMapStore((s) => s.geojsonAreas);
  const activeAreaId = useMapStore((s) => s.activeAreaId);
  const setActiveArea = useMapStore((s) => s.setActiveArea);
  const removeArea = useMapStore((s) => s.removeArea);
  const useMetricUnits = useSettings((s) => s.useMetricUnits);
  const [collapsed, setCollapsed] = useState(false);
  const [referenceId, setReferenceId] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      geojsonAreas.map((feature) => ({
        id: feature.properties.id as string,
        name: feature.properties.name || "Unnamed area",
        color: feature.properties.color || "#1f77b4",
        km2: calculateAreaInKm2(feature as unknown as GeoJSON.Feature),
        feature,
      })),
    [geojsonAreas]
  );

  if (rows.length === 0) return null;

  const maxKm2 = Math.max(...rows.map((r) => r.km2));
  const reference =
    rows.find((r) => r.id === referenceId) ??
    rows.find((r) => r.id === activeAreaId) ??
    rows[0];
  const others = rows.filter((r) => r.id !== reference.id);

  const selectRow = (row: (typeof rows)[number]) => {
    setActiveArea(row.id);
    zoomToFeature(row.feature);
  };

  return (
    <section
      className={`proto-tray ${embedded ? "proto-tray-embedded" : ""} ${collapsed ? "proto-tray-collapsed" : ""}`}
      aria-label="Shapes on the map"
    >
      <header className="proto-tray-header">
        <span className="proto-tray-title">
          <LayersIcon /> On the map · {rows.length}
        </span>
        {!embedded && (
          <button
            type="button"
            className="proto-icon-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Show shape list" : "Hide shape list"}
          >
            <span className={`proto-chevron ${collapsed ? "" : "proto-chevron-open"}`}>
              <ChevronIcon />
            </span>
          </button>
        )}
      </header>

      {!collapsed && (
        <>
          <ul className="proto-tray-list">
            {rows.map((row) => {
              const isActive = row.id === activeAreaId;
              const isReference = row.id === reference.id;
              return (
                <li
                  key={row.id}
                  className={`proto-tray-row ${isActive ? "proto-tray-row-active" : ""}`}
                  aria-current={isActive ? "true" : undefined}
                >
                  <button type="button" className="proto-tray-main" onClick={() => selectRow(row)}>
                    <span className="proto-swatch" style={{ background: row.color }} />
                    <span className="proto-tray-text">
                      <span className="proto-tray-name">
                        <span className="proto-ellipsis">{row.name}</span>
                        {isActive && <span className="proto-tag">Selected</span>}
                      </span>
                      <span className="proto-bar-track">
                        <span
                          className="proto-bar"
                          style={{ width: `${Math.max(1.5, (row.km2 / maxKm2) * 100)}%` }}
                        />
                      </span>
                    </span>
                    <span className="proto-tray-area">{formatArea(row.km2, useMetricUnits)}</span>
                  </button>
                  <button
                    type="button"
                    className={`proto-icon-btn proto-ref-btn ${isReference ? "proto-ref-on" : ""}`}
                    onClick={() => setReferenceId(row.id)}
                    aria-pressed={isReference}
                    aria-label={`Compare everything with ${row.name}`}
                    title={isReference ? "Reference shape" : "Compare everything with this"}
                  >
                    <StarIcon />
                  </button>
                  <button
                    type="button"
                    className="proto-icon-btn proto-danger"
                    onClick={() => removeArea(row.id)}
                    aria-label={`Remove ${row.name}`}
                    title="Remove"
                  >
                    <TrashIcon />
                  </button>
                </li>
              );
            })}
          </ul>

          {others.length > 0 && (
            <div className="proto-readout" aria-live="polite">
              <div className="proto-readout-head">
                <StarIcon /> Compared with {reference.name}
              </div>
              <ul>
                {others.map((other) => {
                  if (other.km2 <= 0 || reference.km2 <= 0) return null;
                  const ratio = reference.km2 / other.km2;
                  return (
                    <li key={other.id}>
                      {ratio >= 1 ? (
                        <>
                          <strong>{formatRatio(ratio)}×</strong> {other.name} fit inside {reference.name}
                        </>
                      ) : (
                        <>
                          {reference.name} fits inside {other.name} <strong>{formatRatio(1 / ratio)}×</strong>
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
