// Caramelle: a small match-3 game. Candies are pre-rendered sprites drawn on one
// canvas; every move is an async pipeline (swap -> match -> pop -> fall) built on
// a tiny promise-based tween system driven by the frame loop.

const N = 8;
const TYPES = 6; // sprites and palette; a level may use fewer colors
const CANDY_NAMES = ["rosse", "arancioni", "gialle", "verdi", "blu", "viola"];
// target: points for the first star (2nd and 3rd at x1.3 and x1.6); collect: [type, count]
const LEVELS = [
  { name: "Zucchero filato", colors: 4, moves: 20, target: 1500 },
  { name: "Lecca-lecca", colors: 5, moves: 20, target: 2500 },
  { name: "Gelatine", colors: 5, moves: 22, target: 3000, collect: [0, 15] },
  { name: "Menta", colors: 5, moves: 20, target: 3500, collect: [3, 14] },
  { name: "Marzapane", colors: 6, moves: 25, target: 4000 },
  { name: "Mirtillo", colors: 6, moves: 22, target: 4500, collect: [4, 18] },
  { name: "Liquirizia", colors: 6, moves: 20, target: 5000, collect: [5, 16] },
  { name: "Caramello", colors: 6, moves: 20, target: 6000 },
  { name: "Arancia candita", colors: 6, moves: 18, target: 6000, collect: [1, 20] },
  { name: "Gran finale", colors: 6, moves: 18, target: 7500, collect: [2, 18] },
];
const STAR_AT = [1, 1.3, 1.6];
const BONUS_PER_MOVE = 60;
const STORE = "caramelle-progress";
const preview = new URLSearchParams(location.search).has("preview");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const SPEED = reduced ? 0.35 : 1;
const PRAISE = ["Gustoso!", "Delizioso!", "Divino!", "Dolcissimo!"];
const PAL = [
  ["#ffa0ae", "#f0294b", "#8f0a22"], // red jelly bean
  ["#ffd29a", "#ff8a12", "#a84300"], // orange lozenge
  ["#fff7a8", "#ffd60a", "#b88a00"], // yellow drop
  ["#b4f7a6", "#37c437", "#137a13"], // green square
  ["#a8dcff", "#2a85ff", "#0b3c9e"], // blue ball
  ["#e8b4ff", "#a13cff", "#5a0f9e"], // purple hexagon
];
const { PI, random, floor, min, max, abs, hypot, sqrt } = Math;
const $ = (id) => document.getElementById(id);

const cv = $("board");
const ctx = cv.getContext("2d");
let S, dpr, sprites;
let grid = [];
let score = 0;
let moves = 0;
let level = 0;
let colors = TYPES;
let collected = 0;
const progress = loadProgress();
let busy = false;
let selected = null;
let cursor = { r: 3, c: 3 };
let hint = null;
let lastAction = performance.now();
const particles = [];

// ---------- tweens ----------
const tweens = new Set();
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInBack = (t) => 2.7 * t * t * t - 1.7 * t * t;
const easeOutBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
function easeBounce(t) {
  if (t < 1 / 2.75) return 7.5625 * t * t;
  if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
  if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
  return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
}
function tween(o, to, dur, ease = easeOut) {
  return new Promise((res) => {
    const from = {};
    for (const k in to) from[k] = o[k];
    tweens.add({ o, from, to, t0: performance.now(), dur: max(1, dur * SPEED), ease, res });
  });
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms * SPEED));

// ---------- sprites ----------
function shape(g, type, r) {
  g.beginPath();
  if (type === 0) {
    g.rotate(-0.35);
    g.roundRect(-r, -r * 0.62, 2 * r, 1.24 * r, r * 0.62);
  } else if (type === 1) {
    g.rotate(PI / 4);
    g.roundRect(-r * 0.74, -r * 0.74, 1.48 * r, 1.48 * r, r * 0.32);
  } else if (type === 2) {
    g.moveTo(0, -r);
    g.bezierCurveTo(r * 0.95, -r * 0.05, r * 0.85, r, 0, r);
    g.bezierCurveTo(-r * 0.85, r, -r * 0.95, -r * 0.05, 0, -r);
  } else if (type === 3) {
    g.roundRect(-r * 0.8, -r * 0.8, 1.6 * r, 1.6 * r, r * 0.34);
  } else if (type === 4) {
    g.arc(0, 0, r * 0.9, 0, 2 * PI);
  } else {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * PI + PI / 6;
      g[i ? "lineTo" : "moveTo"](Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
    }
    g.closePath();
  }
}

function makeSprite(type, special) {
  const px = Math.ceil(S * dpr);
  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d");
  const r = px * 0.4;
  g.translate(px / 2, px / 2);

  if (special === "bomb") {
    const grad = g.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    grad.addColorStop(0, "#9a6440");
    grad.addColorStop(1, "#2b160a");
    g.shadowColor = "rgba(0,0,0,0.35)";
    g.shadowBlur = r * 0.2;
    g.shadowOffsetY = r * 0.12;
    g.fillStyle = grad;
    g.beginPath();
    g.arc(0, 0, r * 0.92, 0, 2 * PI);
    g.fill();
    g.shadowColor = "transparent";
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * 2 * PI;
      const d = sqrt(rnd()) * r * 0.7;
      g.save();
      g.translate(Math.cos(a) * d, Math.sin(a) * d);
      g.rotate(rnd() * PI);
      g.fillStyle = PAL[i % TYPES][1];
      g.beginPath();
      g.roundRect(-r * 0.12, -r * 0.04, r * 0.24, r * 0.08, r * 0.04);
      g.fill();
      g.restore();
    }
  } else {
    const [light, mid, dark] = PAL[type];
    g.save();
    shape(g, type, r);
    const grad = g.createLinearGradient(-r, -r, r, r);
    grad.addColorStop(0, light);
    grad.addColorStop(0.45, mid);
    grad.addColorStop(1, dark);
    g.shadowColor = "rgba(40,0,40,0.35)";
    g.shadowBlur = r * 0.2;
    g.shadowOffsetY = r * 0.12;
    g.fillStyle = grad;
    g.fill();
    g.shadowColor = "transparent";
    g.lineWidth = r * 0.07;
    g.strokeStyle = dark;
    g.globalAlpha = 0.5;
    g.stroke();
    g.globalAlpha = 1;
    if (special) {
      // stripes clipped to the candy: horizontal clears its row, vertical its column
      g.clip();
      g.fillStyle = "rgba(255,255,255,0.85)";
      for (const o of [-0.5, 0, 0.5]) {
        if (special === "h") g.fillRect(-r * 1.5, o * r - r * 0.08, r * 3, r * 0.16);
        else g.fillRect(o * r - r * 0.08, -r * 1.5, r * 0.16, r * 3);
      }
    }
    g.restore();
    if (type === 4) {
      g.strokeStyle = "rgba(255,255,255,0.4)";
      g.lineWidth = r * 0.1;
      g.beginPath();
      g.arc(0, 0, r * 0.5, 0.3, 2.2);
      g.stroke();
    }
  }
  // gloss
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.beginPath();
  g.ellipse(-r * 0.28, -r * 0.38, r * 0.36, r * 0.17, -0.5, 0, 2 * PI);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.45)";
  g.beginPath();
  g.arc(r * 0.36, r * 0.3, r * 0.07, 0, 2 * PI);
  g.fill();
  return c;
}

function buildSprites() {
  sprites = {};
  for (let t = 0; t < TYPES; t++) for (const sp of ["", "h", "v"]) sprites[`${t}${sp}`] = makeSprite(t, sp);
  sprites.bomb = makeSprite(0, "bomb");
}
const spriteOf = (k) => (k.special === "bomb" ? sprites.bomb : sprites[`${k.type}${k.special || ""}`]);

// ---------- board ----------
const candy = (type, r, c, special = null) => ({ type, special, x: c, y: r, scale: 1, alpha: 1 });
const colorOf = (k) => (k && k.special !== "bomb" ? k.type : -1);
const inside = (r, c) => r >= 0 && r < N && c >= 0 && c < N;

function fresh() {
  grid = Array.from({ length: N }, () => Array(N).fill(null));
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      let t;
      do t = floor(random() * colors);
      while (
        (c >= 2 && colorOf(grid[r][c - 1]) === t && colorOf(grid[r][c - 2]) === t) ||
        (r >= 2 && colorOf(grid[r - 1][c]) === t && colorOf(grid[r - 2][c]) === t)
      );
      grid[r][c] = candy(t, r, c);
      grid[r][c].y = r - N - 1; // start above the board and fall in
    }
  if (!findMove()) return fresh();
}

function findRuns() {
  const runs = [];
  for (const dir of ["h", "v"])
    for (let a = 0; a < N; a++) {
      let start = 0;
      for (let b = 1; b <= N; b++) {
        const cell = (i) => (dir === "h" ? grid[a][i] : grid[i][a]);
        const same = b < N && colorOf(cell(b)) !== -1 && colorOf(cell(b)) === colorOf(cell(start));
        if (same) continue;
        if (b - start >= 3 && colorOf(cell(start)) !== -1)
          runs.push({ dir, cells: Array.from({ length: b - start }, (_, i) => (dir === "h" ? [a, start + i] : [start + i, a])) });
        start = b;
      }
    }
  return runs;
}

function swapCells(a, b) {
  const k = grid[a.r][a.c];
  grid[a.r][a.c] = grid[b.r][b.c];
  grid[b.r][b.c] = k;
}

// First swap that makes a match (or involves a bomb), for hints and autoplay
function findMove() {
  const moves = [];
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++)
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = { r, c };
        const b = { r: r + dr, c: c + dc };
        if (!inside(b.r, b.c)) continue;
        if (grid[r][c].special === "bomb" || grid[b.r][b.c].special === "bomb") {
          moves.push([a, b, 6]);
          continue;
        }
        swapCells(a, b);
        const runs = findRuns();
        swapCells(a, b);
        if (runs.length) moves.push([a, b, runs.reduce((s, run) => s + run.cells.length, 0)]);
      }
  if (!moves.length) return null;
  moves.sort((x, y) => y[2] - x[2]);
  return preview ? moves[floor(random() * min(3, moves.length))] : moves[0];
}

// ---------- the move pipeline ----------
async function trySwap(a, b) {
  if (busy || moves <= 0 || !$("end").hidden || !inside(b.r, b.c) || abs(a.r - b.r) + abs(a.c - b.c) !== 1) return;
  busy = true;
  selected = null;
  hint = null;
  lastAction = performance.now();
  const ka = grid[a.r][a.c];
  const kb = grid[b.r][b.c];
  swapCells(a, b);
  await Promise.all([tween(ka, { x: b.c, y: b.r }, 170), tween(kb, { x: a.c, y: a.r }, 170)]);

  if (ka.special === "bomb" || kb.special === "bomb") {
    useMove();
    const other = ka.special === "bomb" ? kb : ka;
    const clear = new Set([`${a.r},${a.c}`, `${b.r},${b.c}`]);
    for (let r = 0; r < N; r++)
      for (let c = 0; c < N; c++)
        if (other.special === "bomb" || colorOf(grid[r][c]) === other.type) clear.add(`${r},${c}`);
    await clearCells(clear, 1);
    await gravity();
    await cascade([a, b], 1);
  } else if (findRuns().length) {
    useMove();
    await cascade([a, b], 0);
  } else {
    swapCells(a, b);
    await Promise.all([tween(ka, { x: a.c, y: a.r }, 170), tween(kb, { x: b.c, y: b.r }, 170)]);
  }
  busy = false;
  afterMove();
}

function useMove() {
  if (!preview) moves--;
  $("moves").textContent = moves;
}

async function cascade(swapped, combo) {
  for (;;) {
    const runs = findRuns();
    if (!runs.length) break;
    combo++;
    const clear = new Set();
    const make = [];
    for (const run of runs) {
      run.cells.forEach(([r, c]) => clear.add(`${r},${c}`));
      if (run.cells.length < 4) continue;
      // the special candy appears where the player swapped, or mid-run in a cascade
      const at =
        run.cells.find(([r, c]) => swapped.some((s) => s.r === r && s.c === c)) || run.cells[floor(run.cells.length / 2)];
      make.push({ at, special: run.cells.length >= 5 ? "bomb" : run.dir === "h" ? "v" : "h", type: grid[at[0]][at[1]].type });
    }
    for (const m of make) clear.delete(`${m.at[0]},${m.at[1]}`);
    await clearCells(clear, combo, make);
    await gravity();
    swapped = [];
  }
  if (combo >= 2) praise(combo);
}

// Pop a set of "r,c" keys, chaining striped candies, then place any new specials
async function clearCells(keys, combo, make = []) {
  const queue = [...keys];
  const seen = new Set(queue);
  while (queue.length) {
    const [r, c] = queue.pop().split(",").map(Number);
    const k = grid[r][c];
    if (!k || (k.special !== "h" && k.special !== "v")) continue;
    for (let i = 0; i < N; i++) {
      const key = k.special === "h" ? `${r},${i}` : `${i},${c}`;
      if (!seen.has(key) && !make.some((m) => `${m.at[0]},${m.at[1]}` === key)) {
        seen.add(key);
        queue.push(key);
      }
    }
  }
  const pops = [];
  for (const key of seen) {
    const [r, c] = key.split(",").map(Number);
    const k = grid[r][c];
    if (!k) continue;
    burst(c, r, k);
    const goal = LEVELS[level].collect;
    if (goal && k.special !== "bomb" && k.type === goal[0]) collected++;
    pops.push(tween(k, { scale: 0 }, 200, easeInBack).then(() => (grid[r][c] = null)));
    score += 60 * combo + (k.special ? 120 : 0);
  }
  for (const m of make) {
    const k = grid[m.at[0]][m.at[1]];
    k.special = m.special;
    k.scale = 1.4;
    pops.push(tween(k, { scale: 1 }, 260, easeOutBack));
    score += 200;
  }
  updateScore();
  await Promise.all(pops);
}

async function gravity() {
  const falls = [];
  for (let c = 0; c < N; c++) {
    let write = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      const k = grid[r][c];
      if (!k) continue;
      grid[r][c] = null;
      grid[write][c] = k;
      write--;
    }
    for (let r = write, spawn = 1; r >= 0; r--, spawn++) {
      const k = candy(floor(random() * colors), r, c);
      k.y = -spawn;
      grid[r][c] = k;
    }
    for (let r = 0; r < N; r++) {
      const k = grid[r][c];
      if (k.y !== r) falls.push(tween(k, { y: r }, 140 + sqrt(r - k.y) * 110, easeBounce));
    }
  }
  await Promise.all(falls);
}

async function afterMove() {
  if (!findMove()) {
    busy = true;
    await shuffle();
    busy = false;
  }
  if (preview) return;
  if (won()) {
    busy = true;
    await wait(500);
    finish(true);
  } else if (moves <= 0) {
    await wait(600);
    finish(false);
  }
}

async function shuffle() {
  praise(0, "Mescolo!");
  await Promise.all(grid.flat().map((k) => tween(k, { scale: 0 }, 220, easeInBack)));
  do {
    const types = grid.flat().map(() => floor(random() * colors));
    grid.flat().forEach((k, i) => Object.assign(k, { type: types[i], special: null }));
  } while (findRuns().length || !findMove());
  await Promise.all(grid.flat().map((k) => tween(k, { scale: 1 }, 260, easeOutBack)));
}

// ---------- feedback ----------
function burst(c, r, k) {
  if (reduced) return;
  const color = k.special === "bomb" ? "#ffe14a" : PAL[k.type][1];
  for (let i = 0; i < 9; i++) {
    const a = random() * 2 * PI;
    const v = 2 + random() * 4;
    particles.push({ x: c + 0.5, y: r + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 1, color, star: i % 3 === 0 });
  }
}

function praise(combo, text) {
  const el = $("combo");
  el.textContent = text || PRAISE[min(PRAISE.length - 1, combo - 2)];
  el.classList.remove("show");
  void el.offsetWidth; // restart the animation
  el.classList.add("show");
}

// ---------- levels ----------
// Best stars per level live in localStorage; level i unlocks once level i-1 has a star
function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE));
    if (p && Array.isArray(p.stars)) return p;
  } catch {}
  return { stars: [] };
}
function saveProgress() {
  try {
    localStorage.setItem(STORE, JSON.stringify(progress));
  } catch {}
}
const unlocked = (i) => i === 0 || (progress.stars[i - 1] || 0) > 0;
const starsFor = (pts) => STAR_AT.filter((k) => pts >= k * LEVELS[level].target).length;
function won() {
  const L = LEVELS[level];
  return score >= L.target && (!L.collect || collected >= L.collect[1]);
}
const dot = (type) => `<i class="candy-dot" style="background:${PAL[type][1]}"></i>`;

function goalsHTML(withProgress) {
  const L = LEVELS[level];
  const mark = (ok) => (withProgress && ok ? "✔" : "◦");
  let html = `<li>${mark(score >= L.target)} Fai ${L.target.toLocaleString("it-IT")} punti</li>`;
  if (L.collect) {
    const [type, need] = L.collect;
    const count = withProgress ? ` <b>${min(collected, need)}/${need}</b>` : "";
    html += `<li>${mark(collected >= need)} Raccogli ${need} caramelle ${CANDY_NAMES[type]} ${dot(type)}${count}</li>`;
  }
  return html;
}

function updateScore() {
  const L = LEVELS[level];
  $("score").textContent = score.toLocaleString("it-IT");
  $("fill").style.width = `${min(100, (score / (L.target * STAR_AT[2])) * 100)}%`;
  document.querySelectorAll(".bar s").forEach((s, i) => {
    s.style.left = `${(STAR_AT[i] / STAR_AT[2]) * 100}%`;
    s.textContent = "★";
    s.classList.toggle("on", score >= STAR_AT[i] * L.target);
  });
  $("goal").innerHTML = `<span>Obiettivo</span><ul>${goalsHTML(true)}</ul>`;
}

function renderMap() {
  $("map").replaceChildren(
    ...LEVELS.map((L, i) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      const stars = progress.stars[i] || 0;
      b.type = "button";
      b.className = i === level ? "current" : stars ? "done" : unlocked(i) ? "open" : "locked";
      b.disabled = !unlocked(i);
      b.textContent = i + 1;
      b.title = `Livello ${i + 1} · ${L.name}${stars ? ` · ${"★".repeat(stars)}` : unlocked(i) ? "" : " · bloccato"}`;
      b.setAttribute("aria-label", b.title);
      if (i === level) b.setAttribute("aria-current", "step");
      if (stars) b.dataset.stars = "★".repeat(stars);
      b.addEventListener("click", () => !busy && startLevel(i));
      li.append(b);
      return li;
    })
  );
}

// One dialog serves the level intro, the win and the loss
function card({ kicker, title, stars, goals, text, actions }) {
  $("end-kicker").textContent = kicker;
  $("end-title").textContent = title;
  $("stars").innerHTML = stars == null ? "" : [1, 2, 3].map((i) => `<span class="${i <= stars ? "on" : ""}">★</span>`).join("");
  $("end-goals").innerHTML = goals || "";
  $("end-score").textContent = text || "";
  $("end-actions").replaceChildren(
    ...actions.map(([label, fn, secondary]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = label;
      if (secondary) b.className = "secondary";
      b.addEventListener("click", fn);
      return b;
    })
  );
  $("end").hidden = false;
  $("end-actions").firstChild.focus();
}

function closeCard() {
  $("end").hidden = true;
  cv.focus();
}

function startLevel(i) {
  const L = LEVELS[i];
  level = i;
  colors = L.colors;
  score = 0;
  collected = 0;
  moves = L.moves;
  selected = null;
  hint = null;
  $("lvl").textContent = i + 1;
  $("lvl-name").textContent = L.name;
  $("moves").textContent = moves;
  updateScore();
  renderMap();
  fresh();
  busy = true;
  gravity().then(() => (busy = false));
  lastAction = performance.now();
  if (preview) return;
  card({
    kicker: `Livello ${i + 1} di ${LEVELS.length}`,
    title: L.name,
    goals: goalsHTML(false),
    text: `${L.moves} mosse · ${L.colors} colori`,
    actions: [["Gioca!", closeCard]],
  });
}

function finish(win) {
  const kicker = `Livello ${level + 1} · ${LEVELS[level].name}`;
  if (!win) {
    card({
      kicker,
      title: "Mosse finite!",
      stars: 0,
      goals: goalsHTML(true),
      text: `${score.toLocaleString("it-IT")} punti`,
      actions: [["Riprova", () => startLevel(level)]],
    });
    return;
  }
  // moves left over turn into points, which can lift the star rating
  const bonus = moves * BONUS_PER_MOVE;
  score += bonus;
  moves = 0;
  $("moves").textContent = moves;
  updateScore();
  const stars = starsFor(score);
  progress.stars[level] = max(progress.stars[level] || 0, stars);
  saveProgress();
  renderMap();
  const next = level + 1;
  const replay = ["Rigioca", () => startLevel(level), true];
  card({
    kicker,
    title: next < LEVELS.length ? "Livello completato!" : "Hai finito tutti i livelli!",
    stars,
    text: `${score.toLocaleString("it-IT")} punti${bonus ? ` · bonus mosse +${bonus.toLocaleString("it-IT")}` : ""}`,
    actions: next < LEVELS.length ? [[`Livello ${next + 1} →`, () => startLevel(next)], replay] : [["Ricomincia dal 1", () => startLevel(0)], replay],
  });
  busy = false;
}

// ---------- drawing ----------
function resize() {
  dpr = min(devicePixelRatio || 1, 2);
  const size = cv.clientWidth;
  S = size / N;
  cv.width = cv.height = Math.round(size * dpr);
  buildSprites();
}

let last = performance.now();
function frame(now) {
  const dt = min(0.05, (now - last) / 1000);
  last = now;
  for (const tw of tweens) {
    const u = min(1, (now - tw.t0) / tw.dur);
    const e = tw.ease(u);
    for (const k in tw.to) tw.o[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    if (u === 1) {
      tweens.delete(tw);
      tw.res();
    }
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, N * S, N * S);
  for (let r = 0; r < N; r++)
    for (let c = 0; c < N; c++) {
      ctx.fillStyle = (r + c) % 2 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.18)";
      ctx.fillRect(c * S, r * S, S, S);
    }

  // keyboard cursor and selection
  if (document.activeElement === cv) {
    ctx.strokeStyle = "rgba(255,242,122,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(cursor.c * S + 3, cursor.r * S + 3, S - 6, S - 6, 10);
    ctx.stroke();
  }
  if (selected) {
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.roundRect(selected.c * S + 2, selected.r * S + 2, S - 4, S - 4, 12);
    ctx.fill();
  }

  // hint after a few idle seconds
  if (!busy && !preview && !hint && now - lastAction > 6000) hint = findMove();
  const t = now / 1000;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, N * S, N * S);
  ctx.clip();
  for (const row of grid)
    for (const k of row) {
      if (!k) continue;
      let s = k.scale;
      if (selected && grid[selected.r][selected.c] === k) s *= 1.08 + Math.sin(t * 8) * 0.05;
      if (hint && hint.slice(0, 2).some((h) => grid[h.r][h.c] === k)) s *= 1 + abs(Math.sin(t * 5)) * 0.12;
      if (k.special === "bomb" && !reduced) s *= 1 + Math.sin(t * 4) * 0.04;
      if (s <= 0.01) continue;
      const size = S * s;
      ctx.drawImage(spriteOf(k), (k.x + 0.5) * S - size / 2, (k.y + 0.5) * S - size / 2, size, size);
    }
  ctx.restore();

  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.vy += 14 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 1.6;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.star ? "#fff" : p.color;
    const s = (p.star ? 0.09 : 0.07) * S;
    ctx.beginPath();
    ctx.arc(p.x * S, p.y * S, s, 0, 2 * PI);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(frame);
}

// ---------- input ----------
const cellAt = (e) => {
  const b = cv.getBoundingClientRect();
  return { r: floor(((e.clientY - b.top) / b.height) * N), c: floor(((e.clientX - b.left) / b.width) * N) };
};
let press = null;
cv.addEventListener("pointerdown", (e) => {
  if (busy) return;
  press = { ...cellAt(e), x: e.clientX, y: e.clientY };
  cv.setPointerCapture(e.pointerId);
});
cv.addEventListener("pointermove", (e) => {
  if (!press) return;
  const dx = e.clientX - press.x;
  const dy = e.clientY - press.y;
  const px = cv.getBoundingClientRect().width / N;
  if (max(abs(dx), abs(dy)) < px * 0.35) return;
  const to = abs(dx) > abs(dy) ? { r: press.r, c: press.c + Math.sign(dx) } : { r: press.r + Math.sign(dy), c: press.c };
  const from = { r: press.r, c: press.c };
  press = null;
  trySwap(from, to);
});
cv.addEventListener("pointerup", () => {
  if (!press) return;
  const p = { r: press.r, c: press.c };
  press = null;
  if (selected && abs(selected.r - p.r) + abs(selected.c - p.c) === 1) trySwap(selected, p);
  else selected = selected && selected.r === p.r && selected.c === p.c ? null : p;
});
cv.addEventListener("keydown", (e) => {
  const dirs = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
  if (dirs[e.key]) {
    e.preventDefault();
    const [dr, dc] = dirs[e.key];
    const to = { r: cursor.r + dr, c: cursor.c + dc };
    if (!inside(to.r, to.c)) return;
    if (selected) trySwap(selected, to);
    cursor = to;
  } else if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    selected = selected ? null : { ...cursor };
  }
});
addEventListener("resize", resize);

// In a home tile the board plays itself
async function autoplay() {
  await wait(1400);
  if (!busy) {
    const m = findMove();
    if (m) await trySwap(m[0], m[1]);
  }
  autoplay();
}

resize();
// resume at the first level without stars; the home tile shows a full 6-color board
const resume = LEVELS.findIndex((_, i) => !progress.stars[i]);
startLevel(preview ? 4 : resume === -1 ? 0 : resume);
requestAnimationFrame(frame);
if (preview) autoplay();
