// src/components/utils/colorUtils.ts
import type { GeoJSONFeature } from "../../state/mapStore";

/**
 * Generate a random color in HSL space with constraints to ensure it's visually pleasant
 * @param existingColors Array of existing hex colors to avoid duplicating
 * @returns A hex color string (e.g., "#ff0000")
 */
export function generateRandomColor(existingColors: string[] = []): string {
  // Use HSL color model for better control over the generated colors
  // Hue: 0-360 (color), Saturation: 0-100% (intensity), Lightness: 0-100% (brightness)
  const getRandomHue = () => Math.floor(Math.random() * 360);
  
  // Keep saturation and lightness in pleasing ranges
  const saturation = 65 + Math.floor(Math.random() * 15); // 65-80%
  const lightness = 45 + Math.floor(Math.random() * 10);  // 45-55%
  
  let hue = getRandomHue();
  let hexColor = hslToHex(hue, saturation, lightness);
  
  // Try to find a color that's not too similar to existing ones
  const maxAttempts = 20;
  let attempts = 0;
  
  while (existingColors.includes(hexColor) && attempts < maxAttempts) {
    // Shift the hue by a good amount to get a visually distinct color
    hue = (hue + 137) % 360; // Using golden angle approximation (137.5°)
    hexColor = hslToHex(hue, saturation, lightness);
    attempts++;
  }
  
  return hexColor;
}

/**
 * Convert HSL color values to hex string
 * @param h Hue (0-360)
 * @param s Saturation (0-100)
 * @param l Lightness (0-100)
 * @returns Hex color string
 */
export function hslToHex(h: number, s: number, l: number): string {
  // Convert HSL to RGB first
  s /= 100;
  l /= 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  
  if (0 <= h && h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (60 <= h && h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (120 <= h && h < 180) {
    [r, g, b] = [0, c, x];
  } else if (180 <= h && h < 240) {
    [r, g, b] = [0, x, c];
  } else if (240 <= h && h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  
  // Convert RGB to hex
  const toHex = (value: number) => {
    const hex = Math.round((value + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Get all existing colors from GeoJSON features
 * @param features Array of GeoJSON features
 * @returns Array of color strings
 */
export function getExistingColors(features: GeoJSONFeature[]): string[] {
  return features
    .map(feature => feature.properties?.color)
    .filter((color): color is string => !!color);
}