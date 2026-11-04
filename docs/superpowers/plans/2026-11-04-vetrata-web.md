# Vetrata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax. No commits: the repo owner commits when asked, a push to `main` deploys.

**Goal:** Build `public/designs/vetrata`, an Italian 3D explainer of the web stack in the stained-glass style, wired into the home at `/vetrata`.

**Architecture:** `story.js` is DOM-free data plus pure functions, loadable from node. `scene.js` turns a phase description into three.js motion and knows nothing about Italian text. `script.js` builds the panel and connects the two.

**Tech Stack:** three r179 vendored, importmap, vanilla JS, no build step.

**Spec:** `docs/superpowers/specs/2026-11-04-vetrata-web-design.md`

## Global Constraints

- Paper `#e6e0cf`, ink `#16130e`. Titles Goudy Bookletter 1911 with `-.045em`.
- One colour per technology: html amber, css red, js teal, apache slate, php plum, mysql green, http paper, cookie gold.
- User text enters the DOM only via `textContent`.
- Every item outside the slides is flagged `extra: true` and shown as "oltre le slide".
- Must pass `CI=true npm run build` and `npm run check:responsive`.

## Review Focus

- Hostile username (`<img onerror=…>`, quotes, `&`, emoji, 500 chars): shown literally, correctly encoded in the POST and in JSON, capped. Tested in `vetrata-check.js` plus a browser run.
- Empty username: the submit is blocked on the client and no trip leaves. Tested in `vetrata-check.js`.
- Corrupt `vetrata.fasi` or throwing localStorage: starts clean, no crash. Tested on `parseDone`.
- Bad hash (`#fase/99`, `#fase/abc`): falls back to phase 1. Tested on `parseHash`.
- No WebGL: text, levels and questions all work, with a static drawing. Checked in a browser with WebGL disabled.

---

### Task 1: Vendor three, story data, node check

**Files:**
- Create: `public/designs/vetrata/vendor/` (`three.module.min.js`, `three.core.min.js`, RoundedBoxGeometry, RoomEnvironment, Line2, LineSegments2, LineGeometry, LineSegmentsGeometry, LineMaterial)
- Create: `public/designs/vetrata/story.js`
- Test: `scripts/vetrata-check.js`

**Interfaces:**
- Produces: `STORY = { TECH, PHASES, TARGETS, WHERE, cleanUser(s), parseHash(h), parseDone(raw), wire(phase, ctx), trips(phase, ctx) }`, global in the browser and `module.exports` in node.
- `ctx = { user, broken }`. `wire` returns `[{ title, text }]`.
- A trip: `{ from, to, kind: 'env'|'ball'|'json', label, tint, red?, cookie?, hold?, sheets?, dur?, focus?, promise? }`.
- A phase: `{ id, title, tint, story, cam, open: {client, server}, fx: [], chips: [{ name, tech, where, target, does, takes?, returns?, ex?, extra? }], notes: [], breaks: [{ id, label, effect }], ask: { q, code, answer, why } }`.

- [ ] Write `vetrata-check.js`: 8 phases; every chip target in `TARGETS`, tech in `TECH`, where in `WHERE`; every `ask.answer` in `WHERE`; every phase, break and username combination gives non-empty `wire` and trips with known anchors; POST of `a&b=c` has `username=a%26b%3Dc`; JSON of `"x` is escaped; `cleanUser` caps at 24 and strips control chars; empty user gives no trips in phase 6; `parseHash('#fase/99')` and `('#fase/abc')` give 0; `parseHash('#riepilogo')` gives 8; `parseDone('{x')` and `('[1,99,"a"]')` give only valid phases; slide values present (`username=pippo&password=pippo123%21`, `Set-Cookie:`, `HttpOnly`).
- [ ] Run `node scripts/vetrata-check.js`: fails, no `story.js`.
- [ ] Copy the vendor files, write `story.js` with all 8 phases from the spec table.
- [ ] Run the check: all pass.

### Task 2: Scene

**Files:** Create `public/designs/vetrata/scene.js`

**Interfaces:**
- Consumes: `STORY.TECH` colours, trip and phase shapes.
- Produces: `createScene(canvas, { onPick, preview, reduced, tech })`, throws without WebGL, returns `{ show(index, phase, trips), setLit(indexes), setFocus(target), setUser(name), setInset(x, y), resize() }`. Index 8 is the final pull-back.

- [ ] Build wall, live ink waves, stained window with 8 panes, ink-shelled glass, client plates, server slabs, DNS, packet with sheets and cookie, fx (url, tube, evaporate, dom, promise), multiply light blobs.
- [ ] Trip engine with dashed route per trip; camera on one CatmullRom rail with a 2.1 s eased move; `setViewOffset` for the panel inset.
- [ ] Perf: pixel ratio cap 1.5, pause off-screen and hidden, drop transmission after 2 s above 40 ms, 15 fps in preview.
- [ ] Check in real time, phase by phase, with screenshots.

### Task 3: Interface

**Files:** Create `index.html`, `style.css`, `script.js`

**Interfaces:** Consumes `STORY` and `createScene`.

- [ ] Panel: story, chips with detail and scene highlight, "Sul filo", Rompilo, Dove gira?, notes.
- [ ] Reverse pick: click on an object lists its chips in that phase.
- [ ] Nav strip, pager, arrows, `#fase/N`, `#riepilogo` with filter and print.
- [ ] Username input in phase 6, `vetrata.fasi` progress, `?preview`, no-WebGL fallback, reduced motion, draggable sheet below 900px.
- [ ] Verify in a browser: hostile username, empty username, corrupt storage, bad hash, WebGL off.

### Task 4: Wire into the site

**Files:** Modify `src/App.js`, `scripts/responsive-test.html`, `CLAUDE.md`

- [ ] Add the `more` entry, `<Route path="/vetrata">`, `#/vetrata` in `ROUTES`, a paragraph in `CLAUDE.md`.
- [ ] Run `node scripts/vetrata-check.js`, `CI=true npm run build`, `npm run check:responsive`: all pass.
