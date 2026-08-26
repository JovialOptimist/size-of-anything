// src/data/specialShapes.ts
/**
 * Registry of the predefined "Special" shapes (notable real-world objects
 * users can drop onto the map for size comparison).
 *
 * To add a new one:
 *   1. Drop an outline SVG at src/assets/specialShapes/<id>.svg
 *      (a single closed <path> for the silhouette is enough - see the
 *      existing files for examples).
 *   2. Add one entry to SPECIAL_SHAPES below with a matching id.
 * Nothing else needs to change - the SVG is picked up automatically.
 */

export interface SpecialShapeDefinition {
  /** Must match the SVG file name (without extension) in assets/specialShapes. */
  id: string;
  name: string;
  description: string;
  widthInMeters?: number;
  heightInMeters?: number;
}

export const SPECIAL_SHAPES: SpecialShapeDefinition[] = [
  {
    id: "blue-whale",
    name: "Blue Whale",
    description: "Largest known animal on Earth",
    widthInMeters: 10,
    heightInMeters: 28.5,
  },
  {
    id: "boeing-737",
    name: "Boeing 737",
    description: "Average-size plane for short flights",
    widthInMeters: 34.3,
    heightInMeters: 39.37,
  },
  {
    id: "boeing-777-300er",
    name: "Boeing 777-300ER",
    description: "Bigger plane for long-haul flights",
    widthInMeters: 73.86,
    heightInMeters: 64.8,
  },
  {
    id: "titanic",
    name: "Titanic",
    description: "Famous British passenger liner",
    widthInMeters: 269.1,
    heightInMeters: 53.3,
  },
  {
    id: "grand-piano",
    name: "Grand Piano",
    description: "Full-size concert grand piano",
    widthInMeters: 2.74,
    heightInMeters: 1.57,
  },
];

export interface SpecialShape extends SpecialShapeDefinition {
  svgUrl: string;
}

// Eagerly import every SVG in the folder as a URL, keyed by its file path.
// This is what makes step 1 above sufficient on its own - no per-shape
// import statement to remember to add.
const svgUrlsByPath = import.meta.glob<string>(
  "../assets/specialShapes/*.svg",
  { eager: true, query: "?url", import: "default" }
);

function findSvgUrl(id: string): string | undefined {
  const match = Object.entries(svgUrlsByPath).find(([path]) =>
    path.endsWith(`/${id}.svg`)
  );
  return match?.[1];
}

/** Special shapes paired with their resolved SVG asset URL. */
export const SPECIAL_SHAPES_WITH_SVG: SpecialShape[] = SPECIAL_SHAPES.flatMap(
  (shape) => {
    const svgUrl = findSvgUrl(shape.id);
    if (!svgUrl) {
      console.error(
        `Special shape "${shape.id}" has no matching SVG at src/assets/specialShapes/${shape.id}.svg - skipping it.`
      );
      return [];
    }
    return [{ ...shape, svgUrl }];
  }
);
