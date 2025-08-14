// src/components/ui/GeoCandidatePicker.tsx
/**
 * Component that displays a list of geographic candidates for selection.
 * Used when multiple areas match a search term or coordinate point.
 */
import type { GeoJSONFeature } from "../../state/mapStoreTypes";
import reactLogo from "../../assets/react.svg";
import { useMapStore } from "../../state/mapStore";
import "../../styles/GeoCandidatePicker.css";

export default function GeoCandidatePicker({
  candidates,
  onSelect,
  onCancel,
  showOnHover = true,
  isLoading = false,
  errorMessage = null,
}: {
  candidates: GeoJSONFeature[];
  onSelect: (feature: GeoJSONFeature) => void;
  onCancel?: () => void;
  showOnHover?: boolean;
  isLoading?: boolean;
  errorMessage?: string | null;
}) {
  const setHoveredCandidate = useMapStore((state) => state.setHoveredCandidate);
  return (
    <div className="geo-candidate-picker">
      {isLoading ? (
        <div className="candidate-loading">
          <div className="candidate-spinner"></div>
          <p>Searching for areas...</p>
        </div>
      ) : errorMessage ? (
        <div className="candidate-error">
          <div className="error-message">
            <p>Error: couldn't find any areas matching your search.</p>
            <p className="help">{errorMessage}</p>
          </div>
          {onCancel && (
            <button
              className="cancel-candidate-button"
              onClick={onCancel}
              tabIndex={0}
            >
              OK
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="candidate-count">
            Found {candidates.length} places.{" "}
            <span className="accent-text">Hover</span> over one of the items
            below to see their outline on the map.
          </p>
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
                    onMouseEnter={() => {
                      if (showOnHover) {
                        // Set the hovered candidate to highlight it on the map
                        setHoveredCandidate(feature);
                      }
                    }}
                    onMouseLeave={() => {
                      if (showOnHover) {
                        // Clear the hover highlight when mouse leaves
                        setHoveredCandidate(null);
                      }
                    }}
                    tabIndex={0}
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
            <button
              className="cancel-candidate-button"
              onClick={onCancel}
              tabIndex={0}
            >
              Cancel
            </button>
          )}
        </>
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
