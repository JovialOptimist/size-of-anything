/**
 * Human-readable types and icon keys for OSM features.
 * Boundaries and places are decided by Nominatim's `addresstype`, not class/type.
 */
export type IconKey =
  | "globe" | "map" | "city" | "village" | "park" | "forest" | "water" | "mountain" | "island" | "beach"
  | "building" | "house" | "school" | "university" | "hospital" | "church" | "museum" | "castle" | "landmark"
  | "stadium" | "pitch" | "pool" | "golf" | "zoo" | "theme" | "airport" | "rail" | "parking" | "shop" | "mall"
  | "cafe" | "food" | "hotel" | "factory" | "farm" | "camp" | "cemetery" | "office" | "bridge" | "pin"
  | "object" | "drawn" | "ship" | "plane" | "animal" | "vehicle" | "space" | "units" | "sports";

const ADDRESS_TYPES: Record<string, [IconKey, string]> = {
  country: ["globe", "Country"],
  state: ["map", "State"],
  province: ["map", "Province"],
  region: ["map", "Region"],
  county: ["map", "County"],
  district: ["map", "District"],
  municipality: ["city", "Municipality"],
  city: ["city", "City"],
  town: ["city", "Town"],
  village: ["village", "Village"],
  hamlet: ["village", "Hamlet"],
  suburb: ["city", "Neighborhood"],
  borough: ["city", "Borough"],
  quarter: ["city", "Neighborhood"],
  neighbourhood: ["city", "Neighborhood"],
  city_district: ["city", "District"],
  island: ["island", "Island"],
};

const TAGS: Record<string, [IconKey, string]> = {
  "leisure=park": ["park", "Park"],
  "leisure=garden": ["park", "Garden"],
  "leisure=nature_reserve": ["forest", "Nature reserve"],
  "leisure=stadium": ["stadium", "Stadium"],
  "leisure=pitch": ["pitch", "Sports field"],
  "leisure=sports_centre": ["sports", "Sports centre"],
  "leisure=swimming_pool": ["pool", "Swimming pool"],
  "leisure=golf_course": ["golf", "Golf course"],
  "leisure=playground": ["park", "Playground"],
  "tourism=theme_park": ["theme", "Theme park"],
  "tourism=zoo": ["zoo", "Zoo"],
  "tourism=museum": ["museum", "Museum"],
  "tourism=hotel": ["hotel", "Hotel"],
  "tourism=attraction": ["landmark", "Attraction"],
  "tourism=camp_site": ["camp", "Campground"],
  "amenity=university": ["university", "University"],
  "amenity=college": ["university", "College"],
  "amenity=school": ["school", "School"],
  "amenity=hospital": ["hospital", "Hospital"],
  "amenity=place_of_worship": ["church", "Place of worship"],
  "amenity=parking": ["parking", "Parking"],
  "amenity=cafe": ["cafe", "Cafe"],
  "amenity=restaurant": ["food", "Restaurant"],
  "amenity=fast_food": ["food", "Fast food"],
  "amenity=grave_yard": ["cemetery", "Graveyard"],
  "landuse=cemetery": ["cemetery", "Cemetery"],
  "shop=mall": ["mall", "Shopping mall"],
  "shop=supermarket": ["shop", "Supermarket"],
  "shop=wholesale": ["shop", "Warehouse store"],
  "aeroway=aerodrome": ["airport", "Airport"],
  "railway=station": ["rail", "Station"],
  "building=house": ["house", "House"],
  "building=detached": ["house", "House"],
  "building=apartments": ["building", "Apartments"],
  "building=church": ["church", "Church"],
  "building=cathedral": ["church", "Cathedral"],
  "building=stadium": ["stadium", "Stadium"],
  "building=school": ["school", "School"],
  "building=university": ["university", "University building"],
  "historic=castle": ["castle", "Castle"],
  "historic=monument": ["landmark", "Monument"],
  "man_made=tower": ["landmark", "Tower"],
  "man_made=bridge": ["bridge", "Bridge"],
  "man_made=pier": ["bridge", "Pier"],
  "natural=water": ["water", "Lake"],
  "water=lake": ["water", "Lake"],
  "natural=wood": ["forest", "Woods"],
  "landuse=forest": ["forest", "Forest"],
  "natural=beach": ["beach", "Beach"],
  "natural=peak": ["mountain", "Peak"],
  "natural=glacier": ["mountain", "Glacier"],
  "natural=island": ["island", "Island"],
  "place=island": ["island", "Island"],
  "landuse=farmland": ["farm", "Farmland"],
  "landuse=industrial": ["factory", "Industrial area"],
  "landuse=residential": ["city", "Residential area"],
  "landuse=commercial": ["office", "Commercial area"],
  "landuse=retail": ["shop", "Retail area"],
};

const KEYS: Record<string, [IconKey, string]> = {
  building: ["building", "Building"],
  leisure: ["park", "Leisure"],
  amenity: ["pin", "Amenity"],
  shop: ["shop", "Shop"],
  tourism: ["landmark", "Attraction"],
  historic: ["landmark", "Historic site"],
  natural: ["forest", "Natural feature"],
  water: ["water", "Water"],
  waterway: ["water", "Waterway"],
  landuse: ["map", "Land use"],
  aeroway: ["airport", "Airport"],
  railway: ["rail", "Railway"],
  man_made: ["landmark", "Structure"],
  office: ["office", "Office"],
  boundary: ["map", "Area"],
  place: ["city", "Place"],
};

function titleCase(s: string) {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Resolve an icon and a friendly type from OSM key/value and optional Nominatim addresstype. */
export function describeFeature(key?: string, value?: string, addresstype?: string): { icon: IconKey; type: string } {
  if ((key === "boundary" || key === "place") && addresstype && ADDRESS_TYPES[addresstype]) {
    const [icon, type] = ADDRESS_TYPES[addresstype];
    return { icon, type };
  }
  if (key && value && TAGS[`${key}=${value}`]) {
    const [icon, type] = TAGS[`${key}=${value}`];
    return { icon, type };
  }
  if (key === "place" && value && ADDRESS_TYPES[value]) {
    const [icon, type] = ADDRESS_TYPES[value];
    return { icon, type };
  }
  if (addresstype && ADDRESS_TYPES[addresstype]) {
    const [icon, type] = ADDRESS_TYPES[addresstype];
    return { icon, type };
  }
  if (key && KEYS[key]) {
    const [icon, generic] = KEYS[key];
    return { icon, type: value && value !== "yes" ? titleCase(value) : generic };
  }
  return { icon: "pin", type: value ? titleCase(value) : "Place" };
}
