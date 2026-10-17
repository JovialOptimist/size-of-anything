import { useDraft } from "../state/draft";
import { useDrawing } from "../state/drawing";
import { closeRing, geometryArea, geometryCenter, localToMeters, toLocal, type AreaGeometry, type LngLat } from "../geo/geometry";
import { addGenerated } from "./actions";

export function finishDrawing(ring: LngLat[]) {
  if (ring.length < 3) return false;
  const geom: AreaGeometry = { type: "Polygon", coordinates: [closeRing(ring)] };
  const area = geometryArea(geom);
  if (area < 1) return false;
  const center = geometryCenter(geom);
  const meters = localToMeters(toLocal(geom, center));
  const d = useDraft.getState();
  addGenerated({
    name: d.name.trim() || "My drawing",
    type: "Drawn shape",
    locality: "",
    icon: "drawn",
    source: { kind: "drawn", meters },
    anchor: center,
    slot: d.slot ?? undefined,
  });
  useDraft.getState().set({ name: "", slot: null });
  useDrawing.getState().set({ points: [], stroke: [] });
  return true;
}

