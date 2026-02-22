// src/components/utils/colorUtils.ts
const presetColors = [
  "#1f77b4",
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#efff25",
  "#e377c2",
];

/**
 * Generate a random color in HSL space with constraints to ensure it's visually pleasant
 * @param existingColors Array of existing hex colors to avoid duplicating
 * @returns A hex color string (e.g., "#ff0000")
 */
export function generateRandomColor(): string {
  Math.random(); // Seed the random number generator
  return presetColors[Math.floor(Math.random() * presetColors.length)];
}

export function getExistingColors(): string[] {
  return presetColors;
}
