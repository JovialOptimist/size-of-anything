/**
 * The map's credits, in the corner where MapLibre puts them and with its look (its CSS classes).
 * Drawn by the app instead of MapLibre's own control so they show on the first paint, not seconds
 * later once MapLibre and the style have loaded. Like MapLibre's compact control: open at first,
 * folded into the (i) button once the map is dragged, and toggled by that button.
 */
import { useEffect, useState, type MouseEvent } from "react";
import { getMap } from "../map/mapCore";
import { useSettings } from "../state/settings";
import { useUI } from "../state/ui";
import { useIsDesktop } from "./hooks";
import { SATELLITE_ATTRIBUTION } from "../config";

export default function MapCredit({ mapReady }: { mapReady: boolean }) {
  const satellite = useSettings((s) => s.basemap === "satellite");
  const desktop = useIsDesktop();
  // On phones it sits just above the bottom sheet, in the left corner (the right one has the map
  // buttons), and goes away with them when the sheet covers the map.
  const sheetFull = useUI((s) => s.sheetSnap === "full");
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const m = mapReady ? getMap() : null;
    if (!m) return;
    const fold = () => setShown(false);
    m.once("drag", fold);
    return () => void m.off("drag", fold);
  }, [mapReady]);

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    setShown((s) => !s);
  };

  return (
    <div className={`map-credit maplibregl-ctrl-bottom-${desktop ? "right" : "left"}`} hidden={!desktop && sheetFull}>
      <details className={`maplibregl-ctrl maplibregl-ctrl-attrib maplibregl-compact${shown ? " maplibregl-compact-show" : ""}`} open>
        <summary className="maplibregl-ctrl-attrib-button" title="Toggle attribution" aria-label="Toggle attribution" onClick={toggle} />
        <div className="maplibregl-ctrl-attrib-inner">
          {satellite && <>{SATELLITE_ATTRIBUTION} | </>}
          <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a>{" "}
          <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> Data from{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>
        </div>
      </details>
    </div>
  );
}
