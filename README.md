# The Size of Anything

The Size of Anything is an interactive, educational web application that allows users to click, drag, and drop any area in the real world (and a few that aren't). For example, a user could compare the sizes of Moscow and London. Another user could try to fit Disneyland into their city's biggest park. And for those that want a bit more silliness, users can generate special shapes called Treasures. These are shapes that don't truly "exist" in the real world in the sense that a building or country border does, but include more "instantiatable" objects like whales, airplanes, and (soon) football fields.

## Instructions to Build and Run

1. **Prerequisites:**

   - Node.js (latest LTS version recommended)
   - npm or yarn

2. **Clone the repository:**

   ```bash
   git clone https://github.com/JovialOptimist/size-of-anything.git
   cd size-of-anything
   ```

3. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   ```

4. **Run development server:**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Build for production:**

   ```bash
   npm run build
   # or
   yarn build
   ```

6. **Preview production build:**
   ```bash
   npm run preview
   # or
   yarn preview
   ```

## Features

- **Search for Areas**: Type the name of any place (buildings, parks, cities, countries) to find and display its shape on the map.
- **Magic Wand Tool**: Click anywhere on the map to search for areas containing that coordinate.
- **Custom Areas**: Create your own areas with specific dimensions (square kilometers or specific length).
- **History Tab**: Quickly access previously placed areas for reuse.
- **Drag and Drop**: Easily move areas around the map to make size comparisons.
- **Treasures**: Special shapes like whales and airplanes that don't exist as geographical features but are useful for size comparison.
- **Interactive Map**: Pan, zoom, and explore the world map with intuitive controls.

## Technologies Used

- **Frontend**: React with TypeScript
- **Map Rendering**: Leaflet.js
- **State Management**: Zustand
- **Geospatial Processing**: Turf.js, Proj4js
- **Build Tools**: Vite, TypeScript
- **Deployment**: Netlify

## Known Issues

- Duplicate is really buggy when you remove shapes from the map, because duplicated shapes will share IDs.
- Mobile technically is a valid platform, but it's not great. There should be a hamburger menu for options at the very least.

## Motivation

A couple of months ago now, I was wondering to myself, "how big is a Costco? But like actually? Is it 100 swimming pools? 10 houses?" So I did a bit of measuring in Google Maps and came to the conclusion that Costco is about 168,000 square feet. But I couldn't help but feel disappointed by that number. How big is that, really? I just had no idea. But then I was messing around with a site called thetruesize.com. It allows users to drag and drop countries and US states - explicitly designed for educational use by teachers, and particularly concerned with the size of Africa (usually shrunken by most map projections). And then I realized that I could make thetreusize for anything! Using OpenStreetMap data, I could query for literally anything in the world, get their coordinates, and just drag and drop entire buildings, or parks, or forests! And so, the Size of Anything was born.

## Contact

This project was written and developed by Jac Chambers (that's me!), a student at the University of Washington - Bothell, for my capstone course. Inquiries can be sent to my email: contact@jachambers.xyz.

---

**Note:** This project is not accepting PRs.  
Forks are welcome under the [MIT License](./LICENSE).
