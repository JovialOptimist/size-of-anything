# The Size of Anything

The Size of Anything (https://thesizeofanything.com) is a website that lets you drag and drop any area in the real world; buildings, parks, countries, states - literally anything! For example, you can compare the sizes of Seattle and London, find a new place for Disneyland that is conveniently close to where you live, or just put 50 blue whales in your backyard. 

<img width="1410" height="628" alt="A screenshot from https://thesizeofanything.com, showcasing a comparison of Disneyland, the Univeristy of Washington Bothell campus, Vatican City, and Central Park, overlayed on a subsection of the Seattle metro area" src="https://github.com/user-attachments/assets/7ff7ad57-5c7d-4825-a5f7-2b742e3b200b" />

## Motivation

> ### I have a real bone to pick with the way that we teach scale. 
We have this obsession with teaching it through numbers - "the Eiffel Tower is over 1000 feet tall" or "this apartment is 600 square feet". Is it accurate? Absolutely. But is it intuitive? Without a grounded, funamental understanding of those units, it's really tough to actually *understand* how big those things are. We can partially solve this with comparisons. "The Eiffel Tower is almost as tall as two Space Needles" or "this apartment is a little bigger than 2 four-square courts". But unless you've been to Seattle, or you were your school's recess champion, those comparisons are meaningless to you.  

Which brings me to the start of all of this. Back at the start of 2025, as I entered my penultimate quarter in college as a computer science major, I found myself wondering how big my local Costco is. Kinda weird, but bear with me. It feels pretty big when you're walking around inside it, right? But is it as big as your elementary school? Can you fit it in a big park? I couldn't stop thinking about it - the unknowing was killing me, and I just had to figure it out. So I did a bit of measuring in Google Maps and came to the conclusion that it's about 168,000 square feet. ... Now, I'll be the first to raise my hand and say "no but like actually how big is it?" I couldn't help feeling disappointed by the lack of clarity the number brought me. How big is that, really? I just had no idea. 

Later that day, still saltily muttering something about "168,000 square feet...", I was messing around with a site called https://thetruesize.com. It's an educational tool that lets you compare countries and US states, specifically designed to educate users on the effects of the web-mercator projection, the projection that is used by Google Maps, Bing Maps, and pretty much every other digital map. It's pretty neat to be able to compare my home state of Washington with other countries in Europe, and really gives you a good sense of scale. ... Hm. Sense of scale... Comparing areas... Oh!

And then I realized that I could augment thetreusize, and add the ability to compare *anything*! Using OpenStreetMap data, I could query literally anything in the world and just drag and drop entire buildings, or parks, or forests! And so, the Size of Anything was born.

## Contact

This project was written and developed by Jac Chambers (that's me!), a student at the University of Washington - Bothell, for my capstone course. Inquiries can be sent to my email: contact@jachambers.xyz.

## Features

- **One search for everything**: places from OpenStreetMap (with suggestions as you type), reference objects, and your recent searches, all in one box.
- **True-size dragging**: grab a shape's pin and drop it anywhere. Shapes keep their real area at every latitude, and rotate with a handle.
- **Comparisons that make sense**: every shape's page says how many times bigger it is than the others, and how many soccer pitches, pools or Central Parks fit inside.
- **Pick on map**: put the crosshair on anything and press "What's here?" to get it and everything it sits inside, from building to country.
- **Create**: make an exact-size square, rectangle, circle or polygon (by dimensions or by area), or draw one with a lasso or by clicking corners, then resize it to an exact area.
- **Objects**: about 40 real things at true scale (sports fields, ships, planes, landmarks, units), suggested for whatever you're looking at.
- **Layers**: street map (light and dark), satellite with labels, and a globe view that shows sizes without Mercator stretching.
- **Share links** that contain the whole comparison, **undo** for everything, and your last session restored when you come back.

## Technologies Used

- **Frontend**: React 19 with TypeScript, built with Vite
- **Map rendering**: MapLibre GL JS with OpenFreeMap vector styles; Esri imagery for satellite
- **Search**: Photon (type-ahead) and Nominatim (search, outlines, reverse lookups); Overpass for nearby features
- **State**: Zustand, with IndexedDB for the session and cached outlines
- **Geometry**: a small spherical engine in `src/geo/geometry.ts` (rigid rotations keep true area), plus Turf.js helpers
- **Icons and fonts**: Lucide, Inter and Bricolage Grotesque
- **Deployment**: Netlify

## Configuration

Developer settings live in `src/config.ts`: the UI accent color preset (`blue`, `purple`, `teal`, `rose`, `ink`), basemap style URLs, and an optional ArcGIS key for compliant satellite tiles.

## Known Issues

- Satellite tiles use Esri's keyless legacy endpoint unless `ARCGIS_KEY` is set in `src/config.ts`.
- Public Overpass servers are often slow; "What's here?" relies mainly on Nominatim reverse lookups and only adds Overpass results when they arrive in time.
- Pins for shapes on the far side of the globe are still drawn.
- Long-press to pick up a shape on touch screens needs testing on real devices.

---

**Note:** This project is not accepting PRs.  
Forks are welcome under the [MIT License](./LICENSE).
