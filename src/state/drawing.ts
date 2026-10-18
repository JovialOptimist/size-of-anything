import { create } from "zustand";
import type { LngLat } from "../geo/geometry";

interface Drawing {
  points: LngLat[];
  stroke: [number, number][]; // live lasso stroke in screen px
  set: (p: Partial<Omit<Drawing, "set">>) => void;
}
export const useDrawing = create<Drawing>((set) => ({ points: [], stroke: [], set: (p) => set(p) }));
