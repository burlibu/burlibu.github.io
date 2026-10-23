// Builds public/designs/halden/geo.js: the ink lines and region shapes of the
// Halden map, projected from public data (us-atlas states, world-atlas
// countries, Natural Earth 50m lakes) with a Lambert conformal conic fitted to
// the 1440x810 frame. Node 18+, no dependencies: node scripts/halden/build.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const OUT = fileURLToPath(new URL("../../public/designs/halden/geo.js", import.meta.url));
const SRC = {
  states: "https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-10m.json",
  countries: "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-10m.json",
  lakes: "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_lakes.geojson",
};

const TOLERANCE = 0.35; // px, Douglas-Peucker
const MIN_RING = 1.6; // px, islands smaller than this are dropped
const CLIP_TOLERANCE = 0.8; // px, the region shapes only clip photos, so they can be coarser

// US Census regions by state FIPS code (Hawaii is left out of the map)
const REGIONS = {
  northeast: ["09", "23", "25", "33", "44", "50", "34", "36", "42"],
  midwest: ["17", "18", "26", "39", "55", "19", "20", "27", "29", "31", "38", "46"],
  south: ["10", "11", "12", "13", "24", "37", "45", "51", "54", "01", "21", "28", "47", "05", "22", "40", "48"],
  west: ["04", "08", "16", "30", "32", "35", "49", "56", "02", "06", "41", "53"],
};
const regionOf = {};
for (const [r, ids] of Object.entries(REGIONS)) for (const id of ids) regionOf[id] = r;
const ALASKA = "02";
const HAWAII = "15";

// ---------- projection: Lambert conformal conic, 29.5° / 45.5°, 106°W ----------

const rad = Math.PI / 180;
const p1 = 29.5 * rad;
const p2 = 45.5 * rad;
const lam0 = -106 * rad;
const n = Math.log(Math.cos(p1) / Math.cos(p2)) / Math.log(Math.tan(Math.PI / 4 + p2 / 2) / Math.tan(Math.PI / 4 + p1 / 2));
const F = (Math.cos(p1) * Math.tan(Math.PI / 4 + p1 / 2) ** n) / n;

function lcc([lon, lat]) {
  const rho = F / Math.tan(Math.PI / 4 + (lat * rad) / 2) ** n;
  const t = n * (lon * rad - lam0);
  return [rho * Math.sin(t), -rho * Math.cos(t)];
}

const ANCHORS = [
  [[-124.72, 48.38], [539, 343]], // Washington / BC coast
  [[-117.16, 32.72], [539, 600]], // San Diego
  [[-81.08, 25.12], [1009, 733]], // tip of Florida
  [[-66.95, 44.82], [1107, 402]], // eastern Maine
];

// least-squares fit of a similarity (scale, rotation, offset) so the anchors land where the frame wants them:
// X = a x - b v + tx, Y = b x + a v + ty, with v = -y (screen y grows downwards)
function fit() {
  const rows = [];
  const rhs = [];
  for (const [ll, [X, Y]] of ANCHORS) {
    const [x, y] = lcc(ll);
    const v = -y;
    rows.push([x, -v, 1, 0], [v, x, 0, 1]);
    rhs.push(X, Y);
  }
  // normal equations A^T A p = A^T b, solved by Gauss-Jordan
  const M = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)).concat(rows.reduce((s, r, k) => s + r[i] * rhs[k], 0)));
  for (let c = 0; c < 4; c++) {
    const piv = M[c][c];
    for (let j = c; j < 5; j++) M[c][j] /= piv;
    for (let r = 0; r < 4; r++) if (r !== c) {
      const f = M[r][c];
      for (let j = c; j < 5; j++) M[r][j] -= f * M[c][j];
    }
  }
  const [a, b, tx, ty] = M.map((r) => r[4]);
  console.log(`fit: scale ${Math.hypot(a, b).toFixed(1)}, rotation ${((Math.atan2(b, a) * 180) / Math.PI).toFixed(2)}°`);
  return (ll) => {
    const [x, y] = lcc(ll);
    const v = -y;
    return [a * x - b * v + tx, b * x + a * v + ty];
  };
}

const project = fit();
for (const [ll, want] of ANCHORS) {
  const got = project(ll);
  console.log(`anchor ${ll} -> ${got.map((v) => v.toFixed(1))} (want ${want})`);
}

// ---------- topojson ----------

function decodeArcs(topo) {
  const { scale, translate } = topo.transform;
  return topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return { key: `${x},${y}`, ll: [x * scale[0] + translate[0], y * scale[1] + translate[1]] };
    });
  });
}

const polys = (g) => (g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : []);
const oriented = (arcs, i) => (i >= 0 ? arcs[i] : [...arcs[~i]].reverse());
const arcIndex = (i) => (i >= 0 ? i : ~i);

// ---------- geometry helpers ----------

// a closed ring is split at its farthest point from the start, so both halves have a real chord
function simplify(pts, tol) {
  if (pts.length < 4) return pts;
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  if (sx === ex && sy === ey) {
    let m = 1;
    for (let i = 1; i < pts.length; i++) if (Math.hypot(pts[i][0] - sx, pts[i][1] - sy) > Math.hypot(pts[m][0] - sx, pts[m][1] - sy)) m = i;
    return [...dp(pts.slice(0, m + 1), tol), ...dp(pts.slice(m), tol).slice(1)];
  }
  return dp(pts, tol);
}

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, far = tol;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / len;
      if (d > far) (far = d), (best = i);
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
}

const tooSmall = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return Math.max(...xs) - Math.min(...xs) < MIN_RING && Math.max(...ys) - Math.min(...ys) < MIN_RING;
};

const r1 = (v) => Math.round(v * 10) / 10;

function pathOf(lines, closed) {
  return lines
    .map((pts) => "M" + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L") + (closed ? "Z" : ""))
    .join("");
}

function bboxOf(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pts of rings)
    for (const [x, y] of pts) {
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  return [r1(x0), r1(y0), r1(x1 - x0), r1(y1 - y0)];
}

// an open polyline in px, simplified; closed islands under MIN_RING are dropped
function line(points) {
  const px = points.map((p) => project(p.ll));
  const closed = points.length > 2 && points[0].key === points[points.length - 1].key;
  if (closed && tooSmall(px)) return null;
  return simplify(px, TOLERANCE);
}

// joins oriented arcs end to start into closed rings
function chain(pieces) {
  const byStart = new Map();
  for (const p of pieces) {
    const k = p[0].key;
    if (!byStart.has(k)) byStart.set(k, []);
    byStart.get(k).push(p);
  }
  const used = new Set();
  const rings = [];
  for (const p of pieces) {
    if (used.has(p)) continue;
    used.add(p);
    const ring = [...p];
    const start = p[0].key;
    let guard = 0;
    while (ring[ring.length - 1].key !== start && guard++ < 100000) {
      const next = (byStart.get(ring[ring.length - 1].key) || []).find((q) => !used.has(q));
      if (!next) break;
      used.add(next);
      ring.push(...next.slice(1));
    }
    rings.push(ring);
  }
  return rings;
}

function rings(points) {
  return points
    .map((ring) => ring.map((p) => project(p.ll)))
    .filter((px) => !tooSmall(px))
    .map((px) => simplify(px, CLIP_TOLERANCE));
}

// ---------- build ----------

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

const [states, countries, lakes] = await Promise.all([get(SRC.states), get(SRC.countries), get(SRC.lakes)]);

// US: which states use each arc
const sArcs = decodeArcs(states);
const users = sArcs.map(() => []);
const stateGeoms = states.objects.states.geometries.filter((g) => g.id !== HAWAII);
for (const g of stateGeoms) for (const poly of polys(g)) for (const ring of poly) for (const i of ring) users[arcIndex(i)].push(g.id);

// the straight Alaska-Yukon line along 141°W
const onYukon = (p) => Math.abs(p.ll[0] + 141) < 0.05 && p.ll[1] > 60;

// splits an arc into runs, leaving out every segment for which cut(a, b) is true
function splitAt(arc, cut) {
  const runs = [];
  let run = [arc[0]];
  for (let i = 1; i < arc.length; i++) {
    if (cut(arc[i - 1], arc[i])) {
      if (run.length > 1) runs.push(run);
      run = [arc[i]];
    } else run.push(arc[i]);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

const usLines = [];
const borderLines = [];
sArcs.forEach((arc, i) => {
  const u = users[i];
  if (!u.length) return;
  // the western Aleutians cross the antimeridian and would land far off the frame
  if (arc.some((p) => p.ll[0] > 0)) return;
  if (u.length === 1) {
    // Alaska's outline is one arc: cut the straight run along the Yukon border out of it
    const runs = u[0] === ALASKA ? splitAt(arc, (p, q) => onYukon(p) && onYukon(q)) : [arc];
    for (const run of runs) {
      const l = line(run);
      if (l) usLines.push(l);
    }
  } else if (u.length === 2 && regionOf[u[0]] !== regionOf[u[1]]) {
    const l = line(arc);
    if (l) borderLines.push(l);
  }
});

// regions: arcs used once inside the region, chained into rings (Alaska stays out of the West)
const regions = {};
for (const r of Object.keys(REGIONS)) {
  const members = stateGeoms.filter((g) => regionOf[g.id] === r && g.id !== ALASKA);
  const count = new Map();
  for (const g of members) for (const poly of polys(g)) for (const ring of poly) for (const i of ring) count.set(arcIndex(i), (count.get(arcIndex(i)) || 0) + 1);
  const pieces = [];
  for (const g of members) for (const poly of polys(g)) for (const ring of poly) for (const i of ring) if (count.get(arcIndex(i)) === 1) pieces.push(oriented(sArcs, i));
  const rs = rings(chain(pieces));
  regions[r] = { d: pathOf(rs, true), box: bboxOf(rs) };
}

// Canada: coast only (arcs it shares with the US are the land border, drawn from the states)
const cArcs = decodeArcs(countries);
const geoms = countries.objects.countries.geometries;
const canada = geoms.find((g) => g.id === "124");
const cUse = cArcs.map(() => 0);
for (const g of geoms) for (const poly of polys(g)) for (const ring of poly) for (const i of ring) cUse[arcIndex(i)]++;
const canadaLines = [];
const canadaRings = [];
for (const poly of polys(canada))
  for (const ring of poly) {
    const pts = [];
    for (const i of ring) {
      const arc = oriented(cArcs, i);
      pts.push(...(pts.length ? arc.slice(1) : arc));
      if (cUse[arcIndex(i)] === 1) {
        const l = line(arc);
        if (l) canadaLines.push(l);
      }
    }
    canadaRings.push(pts);
  }
const cr = rings(canadaRings);
regions.canada = { d: pathOf(cr, true), box: bboxOf(cr) };

// lakes of the US and Canada, Natural Earth 50m
const lakeRings = [];
for (const f of lakes.features) {
  const g = f.geometry;
  const ps = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of ps) {
    const outer = poly[0];
    const lon = outer.reduce((s, p) => s + p[0], 0) / outer.length;
    const lat = outer.reduce((s, p) => s + p[1], 0) / outer.length;
    if (lon < -170 || lon > -52 || lat < 24 || lat > 75) continue;
    const px = outer.map(project);
    const [, , w, h] = bboxOf([px]);
    if (w * h < 40) continue;
    lakeRings.push(simplify(px, TOLERANCE));
  }
}

const geo = {
  frame: [1440, 810],
  lines: {
    canada: pathOf(canadaLines, false),
    us: pathOf(usLines, false),
    borders: pathOf(borderLines, false),
  },
  lakes: pathOf(lakeRings, true),
  regions,
};

const banner = "// Generated by scripts/halden/build.mjs from us-atlas, world-atlas and Natural Earth. Do not edit by hand.\n";
writeFileSync(OUT, banner + "window.HALDEN_GEO = " + JSON.stringify(geo) + ";\n");
const kb = (s) => (s.length / 1024).toFixed(0) + " KB";
console.log(`wrote ${OUT}: canada ${kb(geo.lines.canada)}, us ${kb(geo.lines.us)}, borders ${kb(geo.lines.borders)}, lakes ${kb(geo.lakes)} (${lakeRings.length})`);
for (const [r, v] of Object.entries(regions)) console.log(`  ${r}: ${kb(v.d)} box ${v.box}`);
