/**
 * Utility functions for working with SVG files in the application
 */

/**
 * Extract path data from an SVG string
 * @param svgString The SVG content as a string
 * @returns An array of path data strings found in the SVG
 */
export function extractPathsFromSvg(svgString: string): string[] {
  const paths: string[] = [];
  const pathRegex = /<path[^>]*d=["']([^"']+)["'][^>]*>/g;

  let match;
  while ((match = pathRegex.exec(svgString)) !== null) {
    if (match[1] && match[1].length > 0) {
      paths.push(match[1]);
    }
  }

  return paths;
}

/**
 * Get the longest path from an array of SVG paths
 * This is useful when we need to simplify an SVG to a single path
 * @param paths Array of SVG path data strings
 * @returns The longest path data string
 */
export function getLongestPath(paths: string[]): string {
  if (paths.length === 0) return "";

  return paths.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
}

/**
 * Combine multiple SVG paths into one path data string
 * @param paths Array of SVG path data strings
 * @returns A combined path data string
 */
export function combinePaths(paths: string[]): string {
  return paths.join(" ");
}

/**
 * Extract the viewBox dimensions from an SVG string
 * @param svgString The SVG content as a string
 * @returns An object with width and height, or null if not found
 */
export function extractViewBox(
  svgString: string
): { width: number; height: number } | null {
  const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/);
  if (viewBoxMatch && viewBoxMatch[1]) {
    const [, , width, height] = viewBoxMatch[1].split(/\s+/).map(Number);
    return { width, height };
  }
  return null;
}
