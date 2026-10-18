/** The Create form's draft. It persists, so switching panels or reloading loses nothing. */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ShapeKind = "square" | "rectangle" | "circle" | "polygon";

export interface Draft {
  name: string;
  slot: number | null;
  tab: "shape" | "draw";
  kind: ShapeKind;
  by: "dimensions" | "area";
  a: string; // side / width / radius / area value
  b: string; // length (rectangle)
  sides: string; // polygon sides
  lenUnit: string;
  areaUnit: string;
  circleMeasure: "radius" | "diameter";
  drawMode: "lasso" | "points";
  set: (patch: Partial<Omit<Draft, "set">>) => void;
}

export const useDraft = create<Draft>()(
  persist(
    (set) => ({
      name: "",
      slot: null,
      tab: "shape",
      kind: "rectangle",
      by: "dimensions",
      a: "18",
      b: "24",
      sides: "6",
      lenUnit: "m",
      areaUnit: "m2",
      circleMeasure: "radius",
      drawMode: "lasso",
      set: (patch) => set(patch),
    }),
    { name: "soa-create-draft" }
  )
);
