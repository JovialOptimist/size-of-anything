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
    console.error('Error loading SVG:', error);
    return '';
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
  svgContentCache[url] = content;
  return content;
}