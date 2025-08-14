/**
 * Utilities for working with assets like SVG files
 */

/**
 * Load the content of an SVG file as text
 * @param url URL to the SVG file
 * @returns Promise that resolves to the SVG content as a string
 */
export async function loadSvgContent(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load SVG: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error("Error loading SVG:", error);
    return "";
  }
}

/**
 * Cache for SVG content to avoid repeated fetches
 */
const svgContentCache: Record<string, string> = {};

/**
 * Load and cache SVG content
 * @param url URL to the SVG file
 * @returns Promise that resolves to the SVG content as a string
 */
export async function getSvgContent(url: string): Promise<string> {
  // Return from cache if available
  if (svgContentCache[url]) {
    return svgContentCache[url];
  }

  // Load and cache the content
  const content = await loadSvgContent(url);

  // Increase the stroke-width of SVG paths to make them more visible
  const enhancedContent = enhanceSvgStrokeWidth(content, 50); // Use 3px stroke width

  svgContentCache[url] = enhancedContent;
  return enhancedContent;
}

/**
 * Enhance SVG content by increasing stroke-width for better visibility
 * @param svgContent Original SVG content
 * @param strokeWidth New stroke width in pixels
 * @returns Enhanced SVG content with thicker strokes
 */
function enhanceSvgStrokeWidth(
  svgContent: string,
  strokeWidth: number
): string {
  // If the SVG has a path with stroke but no stroke-width, add our specified width
  return svgContent.replace(
    /(<path[^>]*stroke=["'][^"']*["'][^>]*)(\/?>)/g,
    (match, beforeClose, closeTag) => {
      // Only add stroke-width if it doesn't already exist
      if (!match.includes("stroke-width")) {
        return `${beforeClose} stroke-width="${strokeWidth}"${closeTag}`;
      }
      return match;
    }
  );
}
