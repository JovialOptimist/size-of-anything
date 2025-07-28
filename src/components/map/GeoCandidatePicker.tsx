import type { GeoJSONFeature } from "../../state/mapStore";
import reactLogo from "../../assets/react.svg";

export default function GeoCandidatePicker({
  candidates,
  onSelect,
  onCancel,
}: {
  candidates: GeoJSONFeature[];
  onSelect: (feature: GeoJSONFeature) => void;
  onCancel?: () => void;
}) {
  return (
    <div className="geo-candidate-picker">
      <h3>Select an area</h3>
      <ul className="candidate-list">
        {candidates.map((feature, index) => {
          const name = feature.properties?.name || `Candidate ${index + 1}`;
          const label = formatCandidateLabel(feature);

          const iconUrl = getOsmIconUrl(
            feature.properties?.osmClass,
            feature.properties?.osmType
          );

          return (
            <li key={index} className="candidate-item">
              <button
                className="select-candidate-button"
                onClick={() => onSelect(feature)}
              >
                <img
                  src={iconUrl}
                  alt=""
                  className="candidate-icon"
                  width={20}
                  height={20}
                />
                <div className="candidate-text">
                  <div className="candidate-label">{name}</div>
                  <div className="candidate-description">{label}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {onCancel && (
        <button className="cancel-candidate-button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  );
}

// Format a user-friendly label using OSM feature description and location
function formatCandidateLabel(feature: any): string {
  const displayName = feature.properties?.name || "Unknown";
  const parts = displayName.split(",").map((s: string) => s.trim());

  // Use describeOsmObject to say what kind of thing it is
  const type = feature.properties?.whatIsIt || "Unknown feature";

  // Use last 2–3 location parts for context, if available
  const locationParts = parts.slice(-3);
  const location = locationParts.join(", ");

  return `${type} in ${location}`;
}

// Temporary icon fallback
export function getOsmIconUrl(osmClass: string, osmType: string): string {
  console.log("getOsmIconUrl called with:", osmClass, osmType);
  return reactLogo;
}
