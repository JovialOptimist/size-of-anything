/**
 * Utilities for generating and managing unique IDs for shapes in Size of Anything
 */

/**
 * Generates a RFC4122 version 4 compliant UUID
 * This implementation doesn't require external dependencies
 */
export function generateUUID(): string {
  // Use crypto.randomUUID() if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation for older browsers
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Generates a unique ID for a shape with the "geojson-" prefix
 * Format: "geojson-{uuid}"
 */
export function generateShapeId(): string {
  return `geojson-${generateUUID()}`;
}

/**
 * Validates if a string is a valid shape ID
 */
export function isValidShapeId(id: string): boolean {
  // Check if the ID starts with "geojson-" and followed by a UUID pattern
  const uuidPattern = /^geojson-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(id);
}

/**
 * Extract UUID part from a shape ID
 */
export function getUUIDFromShapeId(id: string): string | null {
  if (!id.startsWith('geojson-')) return null;
  const uuid = id.substring('geojson-'.length);
  return isValidShapeId(`geojson-${uuid}`) ? uuid : null;
}