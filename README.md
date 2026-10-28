# Interactive Seerah Map

An interactive timeline and map of the life of the Prophet Muhammad ﷺ, from his birth in Mecca (c. 570 CE) to his passing in Medina (632 CE).

- **Drag the timeline** at the bottom (or scroll, use ← / →, or press play) and the map follows: event icons appear, journeys are drawn, and the camera moves to where the action is.
- **Light green tint** spreads across Arabia (and Abyssinia, for the early refuge) as Islam reaches each region.
- Click any event on the map or the timeline to jump to it. Links like `#hijra` open directly on an event.

Plain HTML/CSS/JS, no build step needed to run it.

## Run locally

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Adding to the timeline

All content lives in [`js/data.js`](js/data.js):

| Thing | Where |
| --- | --- |
| Events (title, date, text, place, category, optional journey route) | `SEERAH.events` |
| Place coordinates | `SEERAH.places` |
| Regions tinted green and when they appear | `SEERAH.regions` |
| Map labels | `SEERAH.labels` |

`START` and `END` are taken from the first and last event, so extending the timeline later is just a matter of adding events (and regions) in order. If you add events outside the current map bounds, adjust `SEERAH.PROJ` there **and** the matching constants at the top of `tools/build-land.mjs`, then regenerate the base map:

```bash
npm install
npm run build:map   # rewrites js/land.js from Natural Earth data (world-atlas)
```

## Deployment

GitHub Pages deploys from the `main` branch (root), so every push to `main` updates the live site.

## Notes on accuracy

Dates before the Hijra are approximate and scholars differ on several of them; region tints and routes are deliberately simple illustrations, not precise borders. Please open an issue for any correction.
