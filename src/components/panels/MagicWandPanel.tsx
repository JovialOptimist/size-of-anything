// src/components/panels/MagicWandPanel.tsx
import React, { useState } from "react";
import { useMapStore } from "../../state/mapStore";
import GeoCandidatePicker from "../map/GeoCandidatePicker";
import fixMultiPolygon from "../utils/fixMultipolygon";
import { describeOsmObject } from "../utils/describeOsmObject";
import type { GeoJSONFeature } from "../../state/mapStore";
import { OSM_Type } from "../../state/mapStore";

export default function MagicWandPanel() {
  const [candidates, setCandidates] = useState<GeoJSONFeature[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const addGeoJSONFromSearch = useMapStore((s) => s.addGeoJSONFromSearch);
  const setOnMapClick = useMapStore((s) => s.setOnMapClick);

  const handleClick = async (latlng: { lat: number; lng: number }) => {
    const { lat, lng } = latlng;
    console.log("Clicked position:", lat, lng);
    const request = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&polygon_geojson=1&extratags=1`;
    console.log("Reverse geocoding request:", request);
    const response = await fetch(request);
    const data = await response.json();
    console.log("Reverse geocoding response:", data);
    if (!data || !data.geojson || !data.osm_type || !data.osm_id) {
      console.log("No valid area found at this location. Missing required data properties.");
      alert("No valid area found at this location.");
      return;
    }

    // Convert response to GeoJSONFeature[]
    // The Nominatim API returns a single object, not an array
    const place = data;
    const osmType = place.osm_type;
    const osmId = place.osm_id;
    const feature: GeoJSONFeature = {
      type: "Feature" as "Feature",
      geometry: {
        type: osmType === OSM_Type.WAY ? "Polygon" : "MultiPolygon",
        coordinates: place.geojson.coordinates,
      },
      properties: {
        name: place.display_name,
        osmType: place.type,
        osmId,
        osmClass: place.class,
        whatIsIt: describeOsmObject(place),
      },
    };
    const geojsons = [fixMultiPolygon(feature)];
    console.log("GeoJSON features from click:", geojsons);

    setCandidates(geojsons);
    setShowPicker(true);
  };

  const activateWand = () => {
    setShowPicker(false);
    setCandidates([]);
    setOnMapClick(handleClick); // Direct reference to handleClick, not a function that returns it
    useMapStore.getState().setMagicWandMode(true);
    console.log("Magic Wand activated. Click on the map to select an area.");
  };

  const deactivateWand = () => {
    setShowPicker(false);
    setCandidates([]);
    setOnMapClick(null);
    console.log("Magic Wand deactivated.");
  };

  return (
    <div className="panel">
      <h2>Magic Wand</h2>
      <p>Click “Activate”, then click the map to pick an area.</p>
      <button onClick={activateWand}>Activate Magic Wand</button>
      <button onClick={deactivateWand}>Cancel</button>

      {showPicker && candidates.length > 0 && (
        <GeoCandidatePicker
          candidates={candidates}
          onSelect={(feature) => {
            addGeoJSONFromSearch(feature);
            deactivateWand();
          }}
          onCancel={deactivateWand}
        />
      )}
    </div>
  );
}
