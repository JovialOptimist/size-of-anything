/**
 * Shapes on the map. A shape keeps its original outline once and is placed by
 * anchor + rotation + scale (and an optional mirror), so moving it only changes
 * three numbers.
 * Changes are undoable and the session is restored on reload.
 */
import { create } from "zustand";
import {
  geometryArea,
  geometryCenter,
  localFromMeters,
  place,
  simplifyGeometry,
  toLocal,
  type AreaGeometry,
  type LngLat,
  type LocalShape,
} from "../geo/geometry";
import type { IconKey } from "../geo/categories";
import { idbGet, idbSet } from "./idb";
import { objectById, type MetersPolys } from "../objects/registry";

export type ShapeSource =
  | { kind: "osm"; key: string }
  | { kind: "object"; id: string }
  | { kind: "drawn"; meters: MetersPolys }
  | { kind: "exact"; meters: MetersPolys };

export interface Shape {
  id: string;
  name: string;
  type: string;
  locality: string;
  icon: IconKey;
  slot: number; // 0..9 palette slot
  source: ShapeSource;
  /** Original outline in lng/lat for OSM shapes (absent for generated ones). */
  geometry?: AreaGeometry;
  origin: LngLat;
  anchor: LngLat;
  rotation: number;
  scale: number;
  /** Mirrored left-to-right in its own frame (both flips are this plus a rotation). */
  mirrored?: boolean;
  area: number; // m² at scale 1
}

export type NewShape = Omit<Shape, "id" | "slot" | "anchor" | "rotation" | "scale" | "origin" | "area"> & {
  anchor: LngLat;
  rotation?: number;
  scale?: number;
  slot?: number;
};

// ---------- local geometry cache ----------
const localCache = new Map<string, LocalShape>();

/** Identifies a shape's local outline (shared by copies of the same thing). */
export function localKey(s: Shape) {
  const base = s.source.kind === "osm" ? `osm:${s.source.key}:${s.origin.join(",")}` : s.source.kind === "object" ? `obj:${s.source.id}` : `id:${s.id}`;
  return s.mirrored ? `${base}:m` : base;
}

/** Mirror east-west, reversing each ring so its winding stays the same. */
function mirror(local: LocalShape): LocalShape {
  return local.map((poly) =>
    poly.map((ring) => {
      const out = new Float64Array(ring.length);
      const n = ring.length / 3;
      for (let i = 0; i < n; i++) {
        const j = (n - 1 - i) * 3;
        out[i * 3] = -ring[j];
        out[i * 3 + 1] = ring[j + 1];
        out[i * 3 + 2] = ring[j + 2];
      }
      return out;
    })
  );
}

export function localOf(s: Shape): LocalShape {
  const key = localKey(s);
  let l = localCache.get(key);
  if (!l) {
    if (s.mirrored) l = mirror(localOf({ ...s, mirrored: false }));
    else if (s.source.kind === "osm") l = toLocal(s.geometry!, s.origin);
    else if (s.source.kind === "object") l = localFromMeters(objectById(s.source.id)!.build());
    else l = localFromMeters(s.source.meters);
    localCache.set(key, l);
  }
  return l;
}

const placedCache = new WeakMap<Shape, AreaGeometry>();
export function placedGeometry(s: Shape): AreaGeometry {
  let g = placedCache.get(s);
  if (!g) {
    g = place(localOf(s), s.anchor, s.rotation, s.scale);
    placedCache.set(s, g);
  }
  return g;
}

export function shapeArea(s: Shape) {
  return s.area * s.scale * s.scale;
}

let counter = 0;
const newId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

function nextSlot(shapes: Shape[]): number {
  const used = new Set(shapes.map((s) => s.slot));
  for (let i = 0; i < 10; i++) if (!used.has(i)) return i;
  return shapes.length % 10;
}

/** Build a shape from an outline or generated metres. */
export function buildShape(input: NewShape, existing: Shape[]): Shape {
  let origin: LngLat = input.anchor;
  let area = 0;
  let geometry = input.geometry;
  if (input.source.kind === "osm" && geometry) {
    geometry = simplifyGeometry(geometry);
    origin = geometryCenter(geometry);
    area = geometryArea(geometry);
  } else {
    const src = input.source;
    const meters = src.kind === "object" ? objectById(src.id)!.build() : src.kind === "osm" ? [] : src.meters;
    area = geometryArea(place(localFromMeters(meters), [0, 0]));
  }
  return {
    ...input,
    geometry,
    id: newId(),
    slot: input.slot ?? nextSlot(existing),
    origin,
    anchor: input.anchor,
    rotation: input.rotation ?? 0,
    scale: input.scale ?? 1,
    area,
  };
}

interface ShapesState {
  shapes: Shape[];
  selectedId: string | null;
  past: Shape[][];
  future: Shape[][];
  hydrated: boolean;
  add: (input: NewShape, opts?: { select?: boolean }) => Shape;
  update: (id: string, patch: Partial<Shape>, opts?: { history?: boolean }) => void;
  remove: (id: string) => Shape | undefined;
  duplicate: (id: string, offset: LngLat) => Shape | undefined;
  clear: () => void;
  select: (id: string | null) => void;
  undo: () => void;
  redo: () => void;
  replaceAll: (shapes: Shape[]) => void;
}

export const useShapes = create<ShapesState>((set, get) => {
  const commit = (next: Shape[]) => set((st) => ({ shapes: next, past: [...st.past.slice(-49), st.shapes], future: [] }));
  return {
    shapes: [],
    selectedId: null,
    past: [],
    future: [],
    hydrated: false,
    add: (input, opts) => {
      const shape = buildShape(input, get().shapes);
      commit([...get().shapes, shape]);
      if (opts?.select !== false) set({ selectedId: shape.id });
      return shape;
    },
    update: (id, patch, opts) => {
      const next = get().shapes.map((s) => (s.id === id ? { ...s, ...patch } : s));
      if (opts?.history === false) set({ shapes: next });
      else commit(next);
    },
    remove: (id) => {
      const shape = get().shapes.find((s) => s.id === id);
      commit(get().shapes.filter((s) => s.id !== id));
      if (get().selectedId === id) set({ selectedId: null });
      return shape;
    },
    duplicate: (id, offset) => {
      const s = get().shapes.find((x) => x.id === id);
      if (!s) return;
      const base = s.name.replace(/ \(copy(?: \d+)?\)$/, "");
      const taken = new Set(get().shapes.map((x) => x.name));
      let name = `${base} (copy)`;
      for (let n = 2; taken.has(name); n++) name = `${base} (copy ${n})`;
      const copy: Shape = { ...s, id: newId(), name, slot: nextSlot(get().shapes), anchor: offset };
      commit([...get().shapes, copy]);
      set({ selectedId: copy.id });
      return copy;
    },
    clear: () => {
      commit([]);
      set({ selectedId: null });
    },
    select: (id) => set({ selectedId: id }),
    undo: () => {
      const { past, shapes, future, selectedId } = get();
      if (!past.length) return;
      const prev = past[past.length - 1];
      set({ shapes: prev, past: past.slice(0, -1), future: [shapes, ...future], selectedId: prev.some((s) => s.id === selectedId) ? selectedId : null });
    },
    redo: () => {
      const { past, shapes, future } = get();
      if (!future.length) return;
      set({ shapes: future[0], past: [...past, shapes], future: future.slice(1) });
    },
    replaceAll: (shapes) => set({ shapes, selectedId: null, past: [], future: [] }),
  };
});

export const selectedShape = () => {
  const { shapes, selectedId } = useShapes.getState();
  return shapes.find((s) => s.id === selectedId);
};

// ---------- session persistence (IndexedDB) ----------
const SESSION_KEY = "session:shapes";

export async function restoreSession(): Promise<boolean> {
  const saved = await idbGet<Shape[]>(SESSION_KEY);
  useShapes.setState({ hydrated: true });
  if (saved?.length && !useShapes.getState().shapes.length) {
    useShapes.setState({ shapes: saved });
    return true;
  }
  return false;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
useShapes.subscribe((st, prev) => {
  if (!st.hydrated || st.shapes === prev.shapes) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => idbSet(SESSION_KEY, st.shapes), 400);
});
