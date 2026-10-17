/**
 * Reference objects drawn at true scale. Most are generated from their real
 * dimensions; a few come from SVG outlines that are scaled uniformly from one
 * reference length, so they can never be stretched out of proportion.
 *
 * To add an object, add an entry below. Dimensions in metres; x = east, y = north.
 */
import { svgPathProperties } from "svg-path-properties";
import whaleSvg from "../assets/bluewhale.svg?raw";
import b737Svg from "../assets/boeing-737.svg?raw";
import b777Svg from "../assets/boeing-777-300ER.svg?raw";
import type { IconKey } from "../geo/categories";

export type Category = "sports" | "vehicles" | "ships" | "aircraft" | "animals" | "homes" | "landmarks" | "units" | "planetary";

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: "sports", label: "Sports" },
  { id: "landmarks", label: "Landmarks" },
  { id: "ships", label: "Ships" },
  { id: "aircraft", label: "Aircraft & space" },
  { id: "vehicles", label: "Vehicles" },
  { id: "animals", label: "Animals" },
  { id: "homes", label: "Homes & blocks" },
  { id: "units", label: "Units" },
  { id: "planetary", label: "Huge things" },
];

export type MetersPolys = [number, number][][][];

export interface RefObject {
  id: string;
  name: string;
  category: Category;
  icon: IconKey;
  dims: string; // shown on cards
  fact: string; // playful one-liner
  synonyms: string;
  build: () => MetersPolys;
  /** largest dimension in metres, for "fits this view" suggestions */
  span: number;
}

// ---------- generators ----------
const rect = (w: number, l: number): MetersPolys => [[[[-w / 2, -l / 2], [w / 2, -l / 2], [w / 2, l / 2], [-w / 2, l / 2], [-w / 2, -l / 2]]]];

function roundedRect(w: number, l: number, r: number, steps = 8): MetersPolys {
  const pts: [number, number][] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, l / 2 - r, 0],
    [-w / 2 + r, l / 2 - r, 90],
    [-w / 2 + r, -l / 2 + r, 180],
    [w / 2 - r, -l / 2 + r, 270],
  ];
  for (const [cx, cy, start] of corners)
    for (let i = 0; i <= steps; i++) {
      const a = ((start + (90 * i) / steps) * Math.PI) / 180;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  pts.push(pts[0]);
  return [[pts]];
}

function ellipse(w: number, l: number, steps = 96): MetersPolys {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    pts.push([(w / 2) * Math.cos(a), (l / 2) * Math.sin(a)]);
  }
  return [[pts]];
}

const circle = (d: number) => ellipse(d, d, 128);

function regular(n: number, side: number, holeSide = 0): MetersPolys {
  const ring = (s: number) => {
    const R = s / (2 * Math.sin(Math.PI / n));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = Math.PI / 2 + (i * 2 * Math.PI) / n;
      pts.push([R * Math.cos(a), R * Math.sin(a)]);
    }
    return pts;
  };
  return holeSide ? [[ring(side), ring(holeSide).reverse()]] : [[ring(side)]];
}

/** Running track: two straights joined by semicircles. */
function stadium(straight: number, radius: number, steps = 32): MetersPolys {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI;
    pts.push([radius * Math.cos(a), straight / 2 + radius * Math.sin(a)]);
  }
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI + (i / steps) * Math.PI;
    pts.push([radius * Math.cos(a), -straight / 2 + radius * Math.sin(a)]);
  }
  pts.push(pts[0]);
  return [[pts]];
}

/** Ship hull in plan view: pointed bow to the north, rounded stern. */
function hull(length: number, beam: number): MetersPolys {
  const L = length / 2, B = beam / 2;
  const bowStart = L - length * 0.18;
  const sternY = -L + B * 0.6;
  const pts: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    pts.push([B * Math.cos(a), sternY + B * 0.6 * Math.sin(a)]);
  }
  for (let i = 0; i <= 16; i++) {
    const t = (i / 16) * (Math.PI / 2);
    pts.push([B * Math.cos(t), bowStart + (L - bowStart) * Math.sin(t)]);
  }
  for (let i = 15; i >= 0; i--) {
    const t = (i / 16) * (Math.PI / 2);
    pts.push([-B * Math.cos(t), bowStart + (L - bowStart) * Math.sin(t)]);
  }
  pts.push(pts[0]);
  return [[pts]];
}

/** Baseball field: a quarter circle fan from home plate. */
function fan(radius: number): MetersPolys {
  const pts: [number, number][] = [[0, -radius / 2]];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI / 4 + (i / 32) * (Math.PI / 2);
    pts.push([radius * Math.cos(a), -radius / 2 + radius * Math.sin(a)]);
  }
  pts.push([0, -radius / 2]);
  return [[pts]];
}

/** Sample an SVG outline and scale it uniformly so its long axis is `length` metres, pointing north. */
function fromSvg(svg: string, length: number): () => MetersPolys {
  let cache: MetersPolys | null = null;
  return () => {
    if (cache) return cache;
    const paths = [...svg.matchAll(/<path[^>]*\sd=["']([^"']+)["']/g)].map((m) => m[1]);
    const d = paths.reduce((a, b) => (b.length > a.length ? b : a), "");
    const props = new svgPathProperties(d);
    const total = props.getTotalLength();
    const raw: [number, number][] = [];
    for (let i = 0; i < 600; i++) {
      const p = props.getPointAtLength((i / 599) * total);
      raw.push([p.x, p.y]);
    }
    const xs = raw.map((p) => p[0]), ys = raw.map((p) => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;
    const vertical = h >= w;
    const k = length / Math.max(w, h);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    const ring = raw.map(([x, y]) => {
      const dx = (x - cx) * k, dy = -(y - cy) * k;
      return vertical ? ([dx, dy] as [number, number]) : ([-dy, dx] as [number, number]);
    });
    ring.push(ring[0]);
    cache = [[ring]];
    return cache;
  };
}

// ---------- catalog ----------
export const OBJECTS: RefObject[] = [
  { id: "soccer-pitch", name: "Soccer pitch", category: "sports", icon: "pitch", dims: "105 × 68 m", fact: "The size FIFA recommends for big matches.", synonyms: "football pitch fifa field", span: 105, build: () => rect(68, 105) },
  { id: "american-football-field", name: "American football field", category: "sports", icon: "pitch", dims: "120 × 53⅓ yd with end zones", fact: "The classic 'football fields' unit.", synonyms: "nfl gridiron field", span: 109.7, build: () => rect(48.8, 109.7) },
  { id: "rugby-pitch", name: "Rugby pitch", category: "sports", icon: "pitch", dims: "144 × 70 m (maximum)", fact: "100 m of field plus two in-goal areas.", synonyms: "rugby union", span: 144, build: () => rect(70, 144) },
  { id: "nba-court", name: "NBA basketball court", category: "sports", icon: "sports", dims: "94 × 50 ft", fact: "28.65 × 15.24 m of polished hardwood.", synonyms: "basketball court nba", span: 28.65, build: () => rect(15.24, 28.65) },
  { id: "tennis-court", name: "Tennis court", category: "sports", icon: "sports", dims: "23.77 × 10.97 m (doubles)", fact: "Exactly 78 by 36 feet.", synonyms: "tennis wimbledon", span: 23.77, build: () => rect(10.97, 23.77) },
  { id: "pickleball-court", name: "Pickleball court", category: "sports", icon: "sports", dims: "44 × 20 ft", fact: "About a third of a tennis court.", synonyms: "pickleball", span: 13.41, build: () => rect(6.1, 13.41) },
  { id: "volleyball-court", name: "Volleyball court", category: "sports", icon: "sports", dims: "18 × 9 m", fact: "Two 9-metre squares, one per team.", synonyms: "volleyball", span: 18, build: () => rect(9, 18) },
  { id: "olympic-pool", name: "Olympic swimming pool", category: "sports", icon: "pool", dims: "50 × 25 m", fact: "Holds about 2.5 million litres.", synonyms: "pool swimming olympic", span: 50, build: () => rect(25, 50) },
  { id: "hockey-rink", name: "NHL ice rink", category: "sports", icon: "sports", dims: "200 × 85 ft", fact: "With its rounded 28-foot corners.", synonyms: "ice hockey rink nhl", span: 61, build: () => roundedRect(25.9, 61, 8.5) },
  { id: "baseball-field", name: "Baseball field", category: "sports", icon: "pitch", dims: "~400 ft to center field", fact: "Fair territory of a typical MLB park.", synonyms: "baseball diamond mlb", span: 122, build: () => fan(122) },
  { id: "cricket-ground", name: "Cricket ground", category: "sports", icon: "pitch", dims: "~150 × 140 m oval", fact: "No two cricket grounds are the same shape.", synonyms: "cricket oval", span: 150, build: () => ellipse(140, 150) },
  { id: "running-track", name: "400 m running track", category: "sports", icon: "sports", dims: "≈ 177 × 92 m", fact: "Lane 1 is exactly 400 metres around.", synonyms: "track athletics oval", span: 176.9, build: () => stadium(84.39, 46.25) },

  { id: "great-pyramid", name: "Great Pyramid of Giza", category: "landmarks", icon: "landmark", dims: "230.3 m square base", fact: "Its base covers about 13 acres.", synonyms: "pyramid giza egypt khufu", span: 230.3, build: () => rect(230.3, 230.3) },
  { id: "colosseum", name: "Colosseum", category: "landmarks", icon: "landmark", dims: "189 × 156 m", fact: "Held around 50,000 spectators.", synonyms: "colosseum rome amphitheatre", span: 189, build: () => ellipse(156, 189) },
  { id: "pentagon", name: "The Pentagon", category: "landmarks", icon: "building", dims: "281 m per side", fact: "Its courtyard alone is 2 hectares.", synonyms: "pentagon defense", span: 478, build: () => regular(5, 281, 110) },
  { id: "eiffel-base", name: "Eiffel Tower footprint", category: "landmarks", icon: "landmark", dims: "125 × 125 m", fact: "The four legs stand on a 125 m square.", synonyms: "eiffel tower paris", span: 125, build: () => rect(125, 125) },
  { id: "parthenon", name: "Parthenon", category: "landmarks", icon: "landmark", dims: "69.5 × 30.9 m", fact: "Built in about nine years, 2,400 years ago.", synonyms: "parthenon athens acropolis", span: 69.5, build: () => rect(30.9, 69.5) },
  { id: "taj-mahal", name: "Taj Mahal plinth", category: "landmarks", icon: "landmark", dims: "95.5 m square", fact: "The marble platform the tomb sits on.", synonyms: "taj mahal agra india", span: 95.5, build: () => rect(95.5, 95.5) },

  { id: "titanic", name: "RMS Titanic", category: "ships", icon: "ship", dims: "269.1 × 28.2 m", fact: "Longer than two and a half soccer pitches.", synonyms: "titanic ship liner", span: 269.1, build: () => hull(269.1, 28.2) },
  { id: "gerald-ford", name: "USS Gerald R. Ford", category: "ships", icon: "ship", dims: "337 m long", fact: "The largest aircraft carrier ever built (hull shown).", synonyms: "aircraft carrier navy ford", span: 337, build: () => hull(337, 41) },
  { id: "icon-of-the-seas", name: "Icon of the Seas", category: "ships", icon: "ship", dims: "364.75 × 48.5 m", fact: "A cruise ship for nearly 8,000 passengers.", synonyms: "cruise ship royal caribbean", span: 364.75, build: () => hull(364.75, 48.5) },
  { id: "ever-given", name: "Ever Given", category: "ships", icon: "ship", dims: "399.9 × 58.8 m", fact: "The ship that got stuck in the Suez Canal.", synonyms: "container ship suez evergreen", span: 399.9, build: () => hull(399.94, 58.8) },

  { id: "boeing-737", name: "Boeing 737-800", category: "aircraft", icon: "plane", dims: "39.5 m long", fact: "The most common jet you've probably flown on.", synonyms: "plane airplane jet 737 boeing", span: 39.47, build: fromSvg(b737Svg, 39.47) },
  { id: "boeing-777", name: "Boeing 777-300ER", category: "aircraft", icon: "plane", dims: "73.9 m long", fact: "A long-haul twin-engine jet.", synonyms: "plane airplane jet 777 boeing", span: 73.86, build: fromSvg(b777Svg, 73.86) },
  { id: "iss", name: "International Space Station", category: "aircraft", icon: "space", dims: "109 × 73 m", fact: "About the size of an American football field.", synonyms: "iss space station nasa", span: 109, build: () => rect(73, 109) },

  { id: "blue-whale", name: "Blue whale", category: "animals", icon: "animal", dims: "29.9 m (largest measured)", fact: "The biggest animal that has ever lived.", synonyms: "whale ocean animal", span: 29.9, build: fromSvg(whaleSvg, 29.9) },

  { id: "shipping-container", name: "40 ft shipping container", category: "vehicles", icon: "vehicle", dims: "12.19 × 2.44 m", fact: "The box that moves most of the world's stuff.", synonyms: "container shipping box", span: 12.19, build: () => rect(2.44, 12.19) },
  { id: "parking-space", name: "Parking space", category: "vehicles", icon: "parking", dims: "18 × 9 ft", fact: "A typical US parking stall.", synonyms: "parking car space", span: 5.49, build: () => rect(2.74, 5.49) },
  { id: "city-bus", name: "City bus", category: "vehicles", icon: "vehicle", dims: "40 × 8.5 ft", fact: "A standard 12-metre transit bus.", synonyms: "bus transit", span: 12.2, build: () => rect(2.59, 12.2) },

  { id: "manhattan-block", name: "Manhattan city block", category: "homes", icon: "city", dims: "264 × 900 ft", fact: "A standard block between avenues.", synonyms: "block new york manhattan street", span: 274, build: () => rect(80, 274) },
  { id: "chicago-block", name: "Chicago city block", category: "homes", icon: "city", dims: "330 × 660 ft", fact: "Eight blocks make a mile.", synonyms: "block chicago street", span: 200, build: () => rect(100, 200) },
  { id: "quarter-acre-lot", name: "Quarter-acre lot", category: "homes", icon: "house", dims: "1,012 m²", fact: "The classic suburban dream lot.", synonyms: "lot yard house suburb", span: 50.6, build: () => rect(20, 50.6) },
  { id: "tiny-house", name: "Tiny house", category: "homes", icon: "house", dims: "≈ 24 × 8.5 ft", fact: "Small enough to tow.", synonyms: "tiny house home", span: 7.3, build: () => rect(2.6, 7.3) },

  { id: "hectare", name: "Hectare", category: "units", icon: "units", dims: "100 × 100 m", fact: "10,000 square metres.", synonyms: "hectare ha unit", span: 100, build: () => rect(100, 100) },
  { id: "acre", name: "Acre", category: "units", icon: "units", dims: "4,047 m² (63.6 m square)", fact: "Originally what an ox could plough in a day.", synonyms: "acre unit", span: 63.61, build: () => rect(63.61, 63.61) },
  { id: "square-km", name: "Square kilometre", category: "units", icon: "units", dims: "1 × 1 km", fact: "100 hectares.", synonyms: "km2 square kilometer unit", span: 1000, build: () => rect(1000, 1000) },
  { id: "square-mile", name: "Square mile", category: "units", icon: "units", dims: "1 × 1 mi", fact: "640 acres.", synonyms: "square mile unit", span: 1609.34, build: () => rect(1609.34, 1609.34) },

  { id: "lhc", name: "Large Hadron Collider ring", category: "planetary", icon: "space", dims: "26.7 km around", fact: "Protons lap it 11,000 times a second.", synonyms: "lhc cern collider", span: 8486, build: () => circle(8486) },
  { id: "chicxulub", name: "Chicxulub crater", category: "planetary", icon: "space", dims: "≈ 180 km across", fact: "Where the dinosaur-ending asteroid hit.", synonyms: "crater asteroid dinosaur", span: 180000, build: () => circle(180000) },
  { id: "moon", name: "The Moon (as a disk)", category: "planetary", icon: "space", dims: "3,474.8 km across", fact: "Wider than Australia is tall.", synonyms: "moon lunar", span: 3474800, build: () => circle(3474800) },
];

export const objectById = (id: string) => OBJECTS.find((o) => o.id === id);

/** SVG path of an object's outline for thumbnails, fitted to a 0..100 box. */
export function thumbnailPath(polys: MetersPolys): { d: string; viewBox: string } {
  const all = polys.flatMap((p) => p[0]);
  const xs = all.map((p) => p[0]), ys = all.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = 90 / Math.max(maxX - minX, maxY - minY);
  const ox = 50 - ((minX + maxX) / 2) * s, oy = 50 + ((minY + maxY) / 2) * s;
  const d = polys
    .flatMap((p) => p)
    .map((ring) => "M" + ring.map(([x, y]) => `${(x * s + ox).toFixed(1)},${(oy - y * s).toFixed(1)}`).join("L") + "Z")
    .join("");
  return { d, viewBox: "0 0 100 100" };
}
