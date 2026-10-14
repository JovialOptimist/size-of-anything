/**
 * Selection toolbar (UI-overhaul prototype): a compact replacement for the
 * active-element card. Every action has a text label, and Remove sits apart
 * behind a divider. Floats at the bottom of the map on desktop and renders
 * inside the bottom sheet on phones.
 */
import { useEffect, useRef, useState } from "react";
import { useMapStore } from "../../state/mapStore";
import { useSettings } from "../../state/settingsStore";
import { zoomToFeature } from "../../state/mapRegistry";
import { calculateAreaInKm2 } from "../utils/geometryUtils";
import { getExistingColors } from "../utils/colorUtils";
import { formatArea, rotateElement } from "../utils/elementActions";
import { CheckIcon, CloseIcon, CopyIcon, FocusIcon, RotateIcon, TrashIcon } from "../ui/ProtoIcons";

interface SelectionToolbarProps {
  variant: "floating" | "sheet";
}

export default function SelectionToolbar({ variant }: SelectionToolbarProps) {
  const activeAreaId = useMapStore((s) => s.activeAreaId);
  const geojsonAreas = useMapStore((s) => s.geojsonAreas);
  const setActiveArea = useMapStore((s) => s.setActiveArea);
  const removeArea = useMapStore((s) => s.removeArea);
  const duplicateArea = useMapStore((s) => s.duplicateArea);
  const updateElementColor = useMapStore((s) => s.updateElementColor);
  const updateElementName = useMapStore((s) => s.updateElementName);
  const useMetricUnits = useSettings((s) => s.useMetricUnits);

  const [colorOpen, setColorOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAngle, setDraftAngle] = useState("0");
  const colorRef = useRef<HTMLDivElement>(null);

  const element = geojsonAreas.find((f) => f.properties.id === activeAreaId) ?? null;
  const rotation = Math.round(element?.properties.rotation ?? 0);

  useEffect(() => setDraftAngle(String(rotation)), [rotation, activeAreaId]);
  useEffect(() => {
    setEditingName(false);
    setColorOpen(false);
  }, [activeAreaId]);

  useEffect(() => {
    if (!colorOpen) return;
    const close = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setColorOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [colorOpen]);

  if (!element || !activeAreaId) return null;

  const name = element.properties.name || "Unnamed area";
  const color = element.properties.color || "#1f77b4";
  const area = formatArea(calculateAreaInKm2(element as unknown as GeoJSON.Feature), useMetricUnits);
  const kind = (element.properties.whatIsIt || "").replace(/_/g, " ");

  const commitAngle = (value: number) => {
    if (Number.isNaN(value)) {
      setDraftAngle(String(rotation));
      return;
    }
    rotateElement(activeAreaId, value);
  };

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== name) updateElementName(activeAreaId, trimmed);
    setEditingName(false);
  };

  return (
    <div className={`proto-selection proto-selection-${variant}`} role="toolbar" aria-label={`${name} actions`}>
      <div className="proto-selection-info">
        <span className="proto-swatch" style={{ background: color }} />
        <div className="proto-selection-text">
          {editingName ? (
            <input
              className="proto-name-input"
              value={draftName}
              autoFocus
              aria-label="Shape name"
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") setEditingName(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="proto-name-btn"
              title="Rename"
              onClick={() => {
                setDraftName(name);
                setEditingName(true);
              }}
            >
              {name}
            </button>
          )}
          <span className="proto-selection-meta">
            {area}
            {kind && variant === "sheet" ? ` · ${kind}` : ""}
          </span>
        </div>
        {variant === "sheet" && (
          <button
            type="button"
            className="proto-icon-btn"
            onClick={() => setActiveArea(null)}
            aria-label="Deselect shape"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="proto-selection-actions">
        <div className="proto-color-wrap" ref={colorRef}>
          <button
            type="button"
            className="proto-tool-btn"
            onClick={() => setColorOpen((o) => !o)}
            aria-expanded={colorOpen}
          >
            <span className="proto-swatch proto-swatch-sm" style={{ background: color }} /> Color
          </button>
          {colorOpen && (
            <div className="proto-color-pop" role="listbox" aria-label="Shape color">
              {getExistingColors().map((c) => (
                <button
                  key={c}
                  type="button"
                  role="option"
                  aria-selected={c === color}
                  aria-label={c}
                  className="proto-color-chip"
                  style={{ background: c }}
                  onClick={() => {
                    updateElementColor(activeAreaId, c);
                    setColorOpen(false);
                  }}
                >
                  {c === color && <CheckIcon />}
                </button>
              ))}
              <label className="proto-color-custom">
                Custom
                <input
                  type="color"
                  value={color}
                  onChange={(e) => updateElementColor(activeAreaId, e.target.value)}
                />
              </label>
            </div>
          )}
        </div>

        <div className="proto-rotate">
          <button
            type="button"
            className="proto-tool-btn"
            onClick={() => commitAngle(rotation - 15)}
            aria-label="Rotate 15 degrees counter-clockwise"
            title="Rotate −15°"
          >
            <span className="proto-flip"><RotateIcon /></span>
          </button>
          <label className="proto-rotate-field">
            <span className="proto-visually-hidden">Rotation in degrees</span>
            <input
              type="number"
              step={15}
              value={draftAngle}
              onChange={(e) => setDraftAngle(e.target.value)}
              onBlur={() => commitAngle(parseFloat(draftAngle))}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitAngle(parseFloat(draftAngle));
              }}
            />
            °
          </label>
          <button
            type="button"
            className="proto-tool-btn"
            onClick={() => commitAngle(rotation + 15)}
            aria-label="Rotate 15 degrees clockwise"
            title="Rotate +15°"
          >
            <RotateIcon />
          </button>
        </div>

        <button type="button" className="proto-tool-btn" onClick={() => duplicateArea(activeAreaId)}>
          <CopyIcon /> Duplicate
        </button>
        <button type="button" className="proto-tool-btn" onClick={() => zoomToFeature(element)}>
          <FocusIcon /> Zoom to
        </button>

        <span className="proto-divider" aria-hidden="true" />

        <button type="button" className="proto-tool-btn proto-danger" onClick={() => removeArea(activeAreaId)}>
          <TrashIcon /> Remove
        </button>

        {variant === "floating" && (
          <button
            type="button"
            className="proto-icon-btn"
            onClick={() => setActiveArea(null)}
            aria-label="Deselect shape"
            title="Deselect"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </div>
  );
}
