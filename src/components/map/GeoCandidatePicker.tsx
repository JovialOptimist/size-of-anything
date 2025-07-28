// src/components/map/GeoCandidatePicker.tsx
import React from "react";
import type { GeoJSONFeature } from "../../state/mapStore";
import "../../styles/globals.css";

interface GeoCandidatePickerProps {
  candidates: GeoJSONFeature[];
  onSelect: (feature: GeoJSONFeature) => void;
  onCancel?: () => void;
}

export default function GeoCandidatePicker({
  candidates,
  onSelect,
  onCancel,
}: GeoCandidatePickerProps) {
  return (
    <div className="geo-candidate-picker">
      <h3>Select an area</h3>
      <ul className="candidate-list">
        {candidates.map((feature, index) => (
          <li key={index} className="candidate-item">
            <button
              className="select-candidate-button"
              onClick={() => onSelect(feature)}
            >
              <div className="candidate-name">
                {feature.properties.name || `Candidate ${index + 1}`}
              </div>
              <div className="candidate-whatisit">
                {feature.properties.whatIsIt}
              </div>
            </button>
          </li>
        ))}
      </ul>
      {onCancel && (
        <button className="cancel-candidate-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}
