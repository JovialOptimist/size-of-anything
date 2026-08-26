// src/data/specialShapes.ts
/**
 * Registry of the predefined "Special" shapes (notable real-world objects
 * users can drop onto the map for size comparison).
 *
 * To add a new one:
 *   1. Drop an outline SVG at src/assets/specialShapes/<id>.svg
 *      (a single closed <path> for the silhouette is enough - see the
 *      existing files for examples. Extra <line>/<circle>/<rect> elements
 *      are fine for visual detail - only <path> is used to compute the
 *      shape's outline, so they're ignored for that).
 *   2. Add one entry to SPECIAL_SHAPES below with a matching id and a category.
 * Nothing else needs to change - the SVG is picked up automatically, and
 * the panel groups shapes by category for you.
 */

export const SPECIAL_SHAPE_CATEGORIES = [
  "Landmarks & Vehicles",
  "Sports Fields & Courts",
  "Everyday Objects",
  "Mattress Sizes",
] as const;

export type SpecialShapeCategory = (typeof SPECIAL_SHAPE_CATEGORIES)[number];

export interface SpecialShapeDefinition {
  /** Must match the SVG file name (without extension) in assets/specialShapes. */
  id: string;
  name: string;
  description: string;
  category: SpecialShapeCategory;
  widthInMeters?: number;
  heightInMeters?: number;
}

export const SPECIAL_SHAPES: SpecialShapeDefinition[] = [
  // ---- Landmarks & Vehicles ----
  {
    id: "blue-whale",
    name: "Blue Whale",
    description: "Largest known animal on Earth",
    category: "Landmarks & Vehicles",
    widthInMeters: 10,
    heightInMeters: 28.5,
  },
  {
    id: "boeing-737",
    name: "Boeing 737",
    description: "Average-size plane for short flights",
    category: "Landmarks & Vehicles",
    widthInMeters: 34.3,
    heightInMeters: 39.37,
  },
  {
    id: "boeing-777-300er",
    name: "Boeing 777-300ER",
    description: "Bigger plane for long-haul flights",
    category: "Landmarks & Vehicles",
    widthInMeters: 73.86,
    heightInMeters: 64.8,
  },
  {
    id: "titanic",
    name: "Titanic",
    description: "Famous British passenger liner",
    category: "Landmarks & Vehicles",
    widthInMeters: 269.1,
    heightInMeters: 53.3,
  },
  {
    id: "pickup-truck",
    name: "Pickup Truck",
    description: "Full-size pickup truck (e.g. Ford F-150)",
    category: "Landmarks & Vehicles",
    widthInMeters: 2.03,
    heightInMeters: 5.89,
  },

  // ---- Sports Fields & Courts ----
  {
    id: "soccer-field",
    name: "Soccer Field",
    description: "FIFA-recommended pitch size",
    category: "Sports Fields & Courts",
    widthInMeters: 68,
    heightInMeters: 105,
  },
  {
    id: "baseball-field",
    name: "Baseball Field",
    description: "100m foul lines, 122m to straightaway center",
    category: "Sports Fields & Courts",
    widthInMeters: 141.42,
    heightInMeters: 122,
  },
  {
    id: "tennis-court",
    name: "Tennis Court",
    description: "Doubles court",
    category: "Sports Fields & Courts",
    widthInMeters: 10.97,
    heightInMeters: 23.77,
  },
  {
    id: "basketball-court",
    name: "Basketball Court",
    description: "NBA regulation court",
    category: "Sports Fields & Courts",
    widthInMeters: 15.24,
    heightInMeters: 28.65,
  },
  {
    id: "football-field",
    name: "Football Field",
    description: "American football, including end zones",
    category: "Sports Fields & Courts",
    widthInMeters: 48.8,
    heightInMeters: 109.7,
  },
  {
    id: "volleyball-court",
    name: "Volleyball Court",
    description: "Regulation indoor court",
    category: "Sports Fields & Courts",
    widthInMeters: 9,
    heightInMeters: 18,
  },
  {
    id: "hockey-rink",
    name: "Hockey Rink",
    description: "NHL regulation rink",
    category: "Sports Fields & Courts",
    widthInMeters: 25.9,
    heightInMeters: 60.96,
  },

  // ---- Everyday Objects ----
  {
    id: "grand-piano",
    name: "Grand Piano",
    description: "Full-size concert grand piano",
    category: "Everyday Objects",
    widthInMeters: 1.57,
    heightInMeters: 2.74,
  },
  {
    id: "cloud",
    name: "Cloud",
    description: "Small fair-weather cumulus cloud",
    category: "Everyday Objects",
    widthInMeters: 1000,
    heightInMeters: 550,
  },
  {
    id: "human-top-down",
    name: "Human (Top-Down)",
    description: "Average adult, viewed from directly above",
    category: "Everyday Objects",
    widthInMeters: 0.46,
    heightInMeters: 0.33,
  },

  // ---- Mattress Sizes ----
  {
    id: "mattress-crib",
    name: "Crib Mattress",
    description: "Standard US crib mattress",
    category: "Mattress Sizes",
    widthInMeters: 0.711,
    heightInMeters: 1.321,
  },
  {
    id: "mattress-twin",
    name: "Twin Mattress",
    description: "Standard US twin",
    category: "Mattress Sizes",
    widthInMeters: 0.965,
    heightInMeters: 1.905,
  },
  {
    id: "mattress-twin-xl",
    name: "Twin XL Mattress",
    description: "Standard US twin XL",
    category: "Mattress Sizes",
    widthInMeters: 0.965,
    heightInMeters: 2.032,
  },
  {
    id: "mattress-full",
    name: "Full Mattress",
    description: "Standard US full/double",
    category: "Mattress Sizes",
    widthInMeters: 1.372,
    heightInMeters: 1.905,
  },
  {
    id: "mattress-queen",
    name: "Queen Mattress",
    description: "Standard US queen",
    category: "Mattress Sizes",
    widthInMeters: 1.524,
    heightInMeters: 2.032,
  },
  {
    id: "mattress-king",
    name: "King Mattress",
    description: "Standard US king",
    category: "Mattress Sizes",
    widthInMeters: 1.93,
    heightInMeters: 2.032,
  },
  {
    id: "mattress-california-king",
    name: "California King Mattress",
    description: "Standard US California king",
    category: "Mattress Sizes",
    widthInMeters: 1.829,
    heightInMeters: 2.134,
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

/** Special shapes grouped by category, in category-declaration order. */
export const SPECIAL_SHAPES_BY_CATEGORY: {
  category: SpecialShapeCategory;
  shapes: SpecialShape[];
}[] = SPECIAL_SHAPE_CATEGORIES.map((category) => ({
  category,
  shapes: SPECIAL_SHAPES_WITH_SVG.filter((shape) => shape.category === category),
})).filter((group) => group.shapes.length > 0);
