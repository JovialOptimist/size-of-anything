/**
 * Returns a human-readable label for an OSM object returned by Nominatim.
 * @param result A Nominatim result object
 * @returns A string describing what the object is, like "City", "Restaurant", etc.
 */
export function describeOsmObject(result: any): string {
  const cls = result.class;
  const type = result.type;
  const tags = result.extratags || {};
  const addresstype = result.addresstype;

  // 1. Handle common known boundary types
  if (cls === "boundary" && type === "administrative") {
    if (addresstype === "country") return "Country";
    if (addresstype === "state") return "State";
    if (addresstype === "city") return "City";
    if (addresstype === "county") return "County";
    if (addresstype === "region") return "Region";
    if (tags.border_type) return `${capitalize(tags.border_type)} Border`;
    return "Administrative Boundary";
  }

  // 2. Handle places
  if (cls === "place") {
    return capitalize(type); // e.g. "town", "village"
  }

  // 3. Landuse, natural, and leisure areas
  if (cls === "landuse" || cls === "leisure" || cls === "natural") {
    return capitalize(type);
  }

  // 4. Buildings and amenities (like schools, restaurants, hospitals)
  if (cls === "building" || cls === "amenity") {
    return capitalize(type);
  }

  // 5. Water bodies
  if (cls === "waterway" || cls === "water") {
    return capitalize(type); // e.g., "river", "lake"
  }

  // 6. Tourism, attractions, historic places
  if (cls === "tourism" || cls === "historic") {
    return capitalize(type);
  }

  // 7. Transportation
  if (cls === "highway" || cls === "railway" || cls === "aeroway") {
    return capitalize(type);
  }

  // 8. Fallback to class/type or name
  if (cls && type) {
    return `${capitalize(cls)}: ${capitalize(type)}`;
  }

  // 9. Fallback to name only
  if (result.name) return result.name;

  return "Unknown Feature";
}

/**
 * Capitalizes the first letter of a word.
 */
function capitalize(word: string | undefined): string {
  if (!word || typeof word !== "string") return "";
  return word.charAt(0).toUpperCase() + word.slice(1);
}
