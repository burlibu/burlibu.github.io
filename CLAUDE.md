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

## Deployment

Every push to `main` triggers `.github/workflows/deploy-gh-pages.yml`, which builds with Node 18 and publishes `build/` via `peaceiris/actions-gh-pages`. A second workflow (`setup-react-tailwind.yml`) rebuilds and checks that `src/index.css` still contains the three `@tailwind` directives. Don't remove them.

## Architecture

- The home page (`/`) is a 3×3 bento grid in `src/App.js`. Each tile links to one section. The `tiles` array holds `[col, row, route, label, preview]`, and the center piece is rendered separately. A tile with no route is a "Prossimo design" placeholder slot.
- The hover grow effect is pure CSS in `src/index.css`: `.bento:has([data-col|data-row]:hover)` swaps the `fr` tracks and transitions them. It's a no-JS port of the GSAP Flip demo in `inspiration/flilp-bento-hover-effect`. Below 641px the grid becomes a plain 2-column stack.
- Standalone vanilla designs live in `public/designs/<name>/index.html`, copied from `inspiration/`. `DesignFrame` shows one full screen in an iframe. The tile shows a live preview iframe rendered at 4x and scaled to 0.25.
- To add a design: copy it to `public/designs/<name>/`, add a `<Route>`, and replace a placeholder tile.
- `src/Graph3D.js` (`/graph3d`) is a react-three-fiber scene.
- Routing uses `HashRouter` (URLs look like `/#/wind`) because GitHub Pages has no SPA fallback.
- Styling uses Tailwind utilities plus the bento/frame classes in `src/index.css`. The service worker is `unregister()`ed in `src/index.js`.

## Notes

- `inspiration/` (untracked) holds third-party design references from CodePen. The author credits are kept in the copied files.
