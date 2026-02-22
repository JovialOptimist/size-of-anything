# The Size of Anything

The Size of Anything is a website that lets you drag and drop any area in the real world; buildings, parks, countries, states - literally anything! For example, you can compare the sizes of Seattle and London, find a new place for Disneyland that is conveniently close to where you live, or just put 50 blue whales in your backyard. 

## Motivation

> ### I have a real bone to pick with the way that we teach scale. 
We have this obsession with teaching it through numbers - "the Eiffel Tower is over 1000 feet tall" or "this apartment is 600 square feet". Is it accurate? Absolutely. But is it intuitive? Without a grounded, funamental understanding of those units, it's really tough to actually *understand* how big those things are. We can partially solve this with comparisons. "The Eiffel Tower is almost as tall as two Space Needles" or "this apartment is a little bigger than 2 four-square courts". But unless you've been to Seattle, or you were your school's recess champion, those comparisons are meaningless to you.  

Which brings me to the start of all of this. Back at the start of 2025, as I entered my penultimate quarter in college as a computer science major, I found myself wondering how big my local Costco is. Kinda weird, but bear with me. It feels pretty big when you're walking around inside it, right? But is it as big as your elementary school? Can you fit it in a big park? I couldn't stop thinking about it - the unknowing was killing me, and I just had to figure it out. So I did a bit of measuring in Google Maps and came to the conclusion that it's about 168,000 square feet. ... Now, I'll be the first to raise my hand and say "no but like actually how big is it?" I couldn't help feeling disappointed by the lack of clarity the number brought me. How big is that, really? I just had no idea. 

Later that day, still saltily muttering something about "168,000 square feet...", I was messing around with a site called https://thetruesize.com. It's an educational tool that lets you compare countries and US states, specifically designed to educate users on the effects of the web-mercator projection, the projection that is used by Google Maps, Bing Maps, and pretty much every other digital map. It's pretty neat to be able to compare my home state of Washington with other countries in Europe, and really gives you a good sense of scale. ... Hm. Sense of scale... Comparing areas... Oh!

And then I realized that I could augment thetreusize, and add the ability to compare *anything*! Using OpenStreetMap data, I could query literally anything in the world and just drag and drop entire buildings, or parks, or forests! And so, the Size of Anything was born.

## Contact

This project was written and developed by Jac Chambers (that's me!), a student at the University of Washington - Bothell, for my capstone course. Inquiries can be sent to my email: contact@jachambers.xyz.

## Features

- **Search for Areas**: Type the name of any place (buildings, parks, cities, countries) to find and display its shape on the map.
- **Custom Areas**: Create your own areas with specific dimensions (by sidelength/radius, or by area).
- **History Tab**: Quickly access previously placed areas for reuse.
- **Drag and Drop**: Easily move areas around the map to make size comparisons.
- **Treasures**: Special shapes like whales and airplanes that don't exist as geographical features but are useful for size comparison.

## Technologies Used

- **Frontend**: React with TypeScript
- **Map Rendering**: Leaflet.js
- **State Management**: Zustand
- **Geospatial Processing**: Turf.js, Proj4js
- **Build Tools**: Vite, TypeScript
- **Deployment**: Netlify

## Known Issues
These are some of the known issues in the current codebase, as well as a list of future design improvements that are planned.

### Cross-platform
- Duplicate is really buggy when you remove shapes from the map, because duplicated shapes will share IDs.
- Dropdown for settings/about/help should probably have a more intuitive icon (hamburger, gear, etc.)
- Custom panel, special panel, and history panel all need UI improvements

### Mobile-specific
- Portals will appear in weird spots near the search bar, then just around to the opposite side of the screen.
- Magic wand UI flow is bad - should automatically close the creation panel
- Dropdown for settings has poor spacing
- Active Element Display takes up way too much of the screen

---

**Note:** This project is not accepting PRs.  
Forks are welcome under the [MIT License](./LICENSE).
