/** "Try" examples: one tap builds a ready-made comparison. */
import { fetchOutline, searchPlaces } from "../geo/services";
import { addObject, addPlace } from "./actions";
import { useShapes } from "../state/shapes";
import { getMap, fitGeometry } from "../map/mapCore";
import { placedGeometry } from "../state/shapes";
import { toast } from "../state/toasts";
import { pinPoint } from "../map/pins";

/** Anchor that puts a shape's pin on `target`, given where its pin is now. */
function shiftAnchor(anchor: [number, number], pin: [number, number], target: [number, number]): [number, number] {
  return [anchor[0] + target[0] - pin[0], anchor[1] + target[1] - pin[1]];
}

async function first(q: string) {
  const r = (await searchPlaces(q))[0];
  if (!r) throw new Error(`No result for ${q}`);
  return fetchOutline(r);
}

export const TRY: { label: string; tint: number; run: () => Promise<void> }[] = [
  {
    label: "Greenland at the equator",
    tint: 0,
    run: async () => {
      const g = await first("Greenland");
      const s = addPlace(g, "origin");
      useShapes.getState().update(s.id, { anchor: [20, 2] });
      const moved = useShapes.getState().shapes.find((x) => x.id === s.id)!;
      fitGeometry(placedGeometry(moved));
      toast({ text: "Same Greenland, true size. Mercator maps make it look as big as Africa." }, 7000);
    },
  },
  {
    label: "Texas on top of France",
    tint: 1,
    run: async () => {
      const fr = addPlace(await first("France"), "origin");
      const tx = await first("Texas");
      const s = addPlace(tx, "origin");
      // Center Texas on mainland France (France's outline includes overseas territories).
      useShapes.getState().update(s.id, { anchor: shiftAnchor(s.anchor, pinPoint(s), pinPoint(fr)) });
      const moved = useShapes.getState().shapes.find((x) => x.id === s.id)!;
      fitGeometry(placedGeometry(moved));
    },
  },
  {
    label: "A blue whale on a tennis court",
    tint: 2,
    run: async () => {
      if ((getMap()?.getZoom() ?? 0) < 17) getMap()?.jumpTo({ zoom: 18.5 });
      addObject("tennis-court");
      addObject("blue-whale");
    },
  },
  {
    label: "Titanic vs Eiffel Tower",
    tint: 3,
    run: async () => {
      if ((getMap()?.getZoom() ?? 0) < 14) getMap()?.jumpTo({ zoom: 16 });
      addObject("eiffel-base");
      addObject("titanic");
    },
  },
  {
    label: "Central Park vs Disneyland",
    tint: 4,
    run: async () => {
      const cp = addPlace(await first("Central Park, New York"), "origin");
      const dl = await first("Disneyland Park, Anaheim");
      const s = addPlace(dl, "origin");
      useShapes.getState().update(s.id, { anchor: shiftAnchor(s.anchor, pinPoint(s), pinPoint(cp)) });
    },
  },
];

export async function runTry(i: number) {
  try {
    await TRY[i].run();
  } catch {
    toast({ text: "Couldn't load that example right now. Try again in a moment.", tone: "error" });
  }
}
