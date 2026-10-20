# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Personal site for Burlibu, published at https://burlibu.github.io. Create React App (`react-scripts` 5) + React 19 + Tailwind CSS 3 + react-three-fiber. UI text is in Italian.

## Commands

- `npm start` — dev server
- `npm run build` — production build into `build/`
- `npm run deploy` — manual deploy via `gh-pages` (normally not needed, see below)

There's no lint script. ESLint runs inside `react-scripts` (`react-app` config) during start and build. CI sets `CI=true`, which turns any ESLint warning into a build error and blocks the deploy, so run `CI=true npm run build` before pushing.

There's no test setup: there is no `test` script, and CRA's Jest 27 can't resolve react-router 7's package exports. Verify changes by serving `build/` (e.g. `python3 -m http.server -d build`) and screenshotting it with headless Chrome.

Responsive check: `scripts/responsive-test.html` loads every route in same-origin iframes at 8 viewports (360px phone to 2560px) and reports horizontal scroll, tiles that overflow, clipped labels and back-link placement. Run `npm run build && cp scripts/responsive-test.html build/`, serve `build/` on port 5055, then `google-chrome --headless=new --disable-gpu --virtual-time-budget=200000 --dump-dom http://localhost:5055/responsive-test.html | grep -E '^(FAIL|ok)'`. When you add a route, add it to `ROUTES` in that file. Headless WebGL screenshots of `/graph3d` can show stale frames, so check the 3D camera by reading its state rather than trusting the screenshot.

## Deployment

Every push to `main` triggers `.github/workflows/deploy-gh-pages.yml`, which builds with Node 18 and publishes `build/` via `peaceiris/actions-gh-pages`. A second workflow (`setup-react-tailwind.yml`) rebuilds and checks that `src/index.css` still contains the three `@tailwind` directives. Don't remove them.

## Architecture

- The home page (`/`) is a 3×3 bento grid in `src/App.js`. Each tile links to one section. The `tiles` array holds `[col, row, route, label, preview]`, and the center piece is rendered separately. A tile with no route is a "Prossimo design" placeholder slot. Once the 3×3 is full, new tiles go in the `more` array, rendered as plain 3-column rows (`.bento-more`) below the bento that the page scrolls down to.
- The hover grow effect is pure CSS in `src/index.css`: `.bento:has([data-col|data-row]:hover)` swaps the `fr` tracks and transitions them. It's a no-JS port of the GSAP Flip demo in `inspiration/flilp-bento-hover-effect`. At 900px and below the grid becomes a plain 2-column stack.
- Standalone vanilla designs live in `public/designs/<name>/index.html`, copied from `inspiration/`. `DesignFrame` shows one full screen in an iframe. The tile shows a live preview iframe rendered at 4x and scaled to 0.25.
- Tile previews load the design with `?preview`. Each design includes `public/designs/preview.js` before its own script. In preview mode that script quarters `devicePixelRatio`, debounces `resize` listeners (so a tile's hover grow doesn't rebuild the scene every frame), and holds `requestAnimationFrame` while the tile is off-screen. Size canvases from `devicePixelRatio` and set them up in a `resize` listener so they benefit from this.
- Avoid per-frame style recalc over many elements in a design, such as animating an inherited custom property that hundreds of nodes read. That's what made the home lag. Animate a transform on a container instead.
- To add a design: copy it to `public/designs/<name>/`, add `<script src="../preview.js"></script>` before its scripts, add a `<Route>`, and replace a placeholder tile (or add one to `more`).
- `src/Graph3D.js` (`/graph3d`) is a react-three-fiber knowledge-base graph in the style of Obsidian. It loads lazily because three.js is about 1 MB. Its notes are dummy data generated deterministically in `src/knowledge.js`, about 100 of them with links and backlinks. Each node opens `/graph3d/nodo/<slug>`, which `src/NotePage.js` renders. The layout is a 3D force simulation computed once and scaled to `GRAPH_RADIUS`. The background (particles, wave grid, frequency lines) is drawn in shaders.
- `src/Resources.js` (`/resources`) is a scrollable page of curated web design links, styled as a technical drawing sheet after `inspiration/technicalchart`. The links live in `src/resourcesData.js`. Each card takes the next pen colour and the next of 8 frame styles, so neighbouring cards never match. The filter morphs with the View Transitions API.
- Tiles without a design iframe have a React face in `src/TileFaces.js`: `ContactFace` (airmail envelope), `GithubFace` (contribution calendar, branches, terminal), `ResourcesFace` (a mini drawing sheet) and `GraphFace` (the real knowledge graph on a 2D canvas, paused off-screen). Faces size their contents with container query units (`cqmin`). Those units resolve against the nearest ancestor container, not the element itself.
- `public/designs/dash` (Prisma Dash) is a Geometry Dash-style game. `game.js` is the DOM-free engine: levels, fixed 240 Hz physics and collisions. `script.js` handles rendering (sprites cached per block size, interpolated between physics steps), the WebAudio music, input and screens. `node scripts/dash-solver.js [level]` runs a beam search proving every level can be finished with all coins, and rewrites `demos.js` (the winning inputs replayed by the demo, menu background and tile preview). Rerun it after any change to a level or to the physics, or the demos will crash. `?livello=N&demo` opens a level's demo directly. Headless Chrome only renders a few frames of the game, so to screenshot later parts, step the simulation forward in a throwaway copy.
- Routing uses `HashRouter` (URLs look like `/#/wind`) because GitHub Pages has no SPA fallback.
- Styling uses Tailwind utilities plus the bento/frame classes in `src/index.css`. The service worker is `unregister()`ed in `src/index.js`.

## Notes

- `inspiration/` holds third-party design references from CodePen. The author credits are kept in the copied files.
