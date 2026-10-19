// Valhalla: a knotwork raven printed in turquoise on cracked slate.
// The raven is built from feather "blades" plus carved knots (lines in the
// stone color cut through the fill); stone and wear come from SVG filters.

const NS = "http://www.w3.org/2000/svg";
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RUNES = "ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ";
const { sin, cos, PI } = Math;

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  parent.append(e);
  return e;
}

const lerp = (a, b, u) => a + (b - a) * u;
const f = (n) => n.toFixed(1);

// Tapered, slightly back-curved feather from base (bx,by) at angle deg;
// returns the blade outline and the carved shaft line down its middle
function blade(bx, by, deg, len, w) {
  const a = (deg * PI) / 180;
  const [dx, dy, nx, ny] = [cos(a), sin(a), -sin(a), cos(a)];
  const bend = len * 0.07;
  const at = (t, side) => [bx + dx * len * t + nx * side, by + dy * len * t + ny * side];
  const [l, c1, tip, c2, r] = [at(0, w / 2), at(0.6, w / 2 + bend), at(1, bend * 0.6), at(0.6, -w / 3 + bend), at(0, -w / 2)];
  const [s0, s1, s2] = [at(0.12, 0), at(0.5, bend * 0.5), at(0.82, bend * 0.6)];
  return [
    `M${f(l[0])},${f(l[1])} Q${f(c1[0])},${f(c1[1])} ${f(tip[0])},${f(tip[1])} Q${f(c2[0])},${f(c2[1])} ${f(r[0])},${f(r[1])}Z`,
    `M${f(s0[0])},${f(s0[1])} Q${f(s1[0])},${f(s1[1])} ${f(s2[0])},${f(s2[1])}`,
  ];
}

// Triquetra: three looping arcs between points on a circle, plus the woven ring
function triquetra(g, cx, cy, r) {
  const p = [0, 1, 2].map((k) => [cx + r * cos(-PI / 2 + (k * 2 * PI) / 3), cy + r * sin(-PI / 2 + (k * 2 * PI) / 3)]);
  const arc = (q) => `A${f(r * 0.9)},${f(r * 0.9)} 0 1 1 ${f(q[0])},${f(q[1])}`;
  el("path", { class: "carve", d: `M${f(p[0][0])},${f(p[0][1])} ${arc(p[1])} ${arc(p[2])} ${arc(p[0])}` }, g);
  el("circle", { class: "carve", cx, cy, r: f(r * 0.62) }, g);
}

// Two strands weaving along a line
function braid(g, x1, y1, x2, y2, amp, turns) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [-(y2 - y1) / len, (x2 - x1) / len];
  for (const ph of [0, PI]) {
    let d = "";
    for (let i = 0; i <= 40; i++) {
      const u = i / 40;
      const o = amp * sin(u * turns * 2 * PI + ph);
      d += `${i ? "L" : "M"}${f(lerp(x1, x2, u) + nx * o)},${f(lerp(y1, y2, u) + ny * o)}`;
    }
    el("path", { class: "carve", d }, g);
  }
}

// Carved contour just inside a shape: clip to it, cut a wide stroke, refill the rim
function inset(g, svg, id, d) {
  el("path", { d }, el("clipPath", { id }, svg));
  const c = el("g", { "clip-path": `url(#${id})` }, g);
  el("path", { d, fill: "none", stroke: "var(--carve)", "stroke-width": 15 }, c);
  el("path", { d, fill: "none", stroke: "var(--teal)", "stroke-width": 8 }, c);
}

function fan(g, carve, n, from, to, deg, len, w) {
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1);
    const [outline, shaft] = blade(lerp(from[0], to[0], u), lerp(from[1], to[1], u), lerp(deg[0], deg[1], u), lerp(len[0], len[1], u), lerp(w[0], w[1], u));
    el("path", { d: outline }, g);
    el("path", { class: "carve shaft", d: shaft }, carve);
  }
}

// Archimedean spiral, the curl that ends many Norse knot terminals
function spiral(g, cx, cy, r, turns, dir = 1) {
  let d = "";
  for (let i = 0; i <= 60; i++) {
    const u = i / 60;
    const a = dir * u * turns * 2 * PI;
    d += `${i ? "L" : "M"}${f(cx + r * u * cos(a))},${f(cy + r * u * sin(a))}`;
  }
  el("path", { class: "carve", d }, g);
}

function buildRaven() {
  const svg = document.getElementById("raven");

  // Faint engraved compass behind the bird, with a slowly turning rune ring
  const eng = el("g", { class: "engraving" }, svg);
  for (const r of [150, 235, 330, 345]) el("circle", { cx: 250, cy: 200, r }, eng);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * 2 * PI;
    el("line", { x1: f(250 + 150 * cos(a)), y1: f(200 + 150 * sin(a)), x2: f(250 + 330 * cos(a)), y2: f(200 + 330 * sin(a)) }, eng);
  }
  const ring = el("g", { class: "ring" }, eng);
  [...RUNES, ...RUNES].forEach((ch, i, all) => {
    const deg = (i / all.length) * 360;
    el("text", { x: 250, y: 200 - 280, "text-anchor": "middle", transform: `rotate(${deg} 250 200)` }, ring).textContent = ch;
  });

  const bird = el("g", { class: "bird", filter: "url(#worn)" }, svg);
  const tail = el("g", {}, bird);
  const wing = el("g", { id: "wing" }, bird);
  const body = el("g", {}, bird);
  const carveWing = el("g", {}, wing);
  const carve = el("g", {}, bird);

  fan(tail, carve, 7, [276, 318], [302, 346], [34, 82], [140, 100], [24, 20]);

  // Wing: covert plate, primaries fanning up-right, secondaries trailing below
  const covert = "M172,168 C182,118 212,84 252,70 C305,58 362,95 405,138 C345,165 300,200 262,236 C230,215 200,190 172,168Z";
  el("path", { d: covert }, wing);
  fan(wing, carveWing, 10, [250, 78], [400, 140], [-64, -3], [140, 150], [17, 21]);
  fan(wing, carveWing, 7, [394, 152], [262, 230], [6, 40], [150, 105], [20, 18]);
  for (const dy of [0, 20, 40])
    el("path", { class: "carve", d: "M196,168 C206,128 228,104 258,94 C300,84 342,108 378,138", transform: `translate(${dy * 0.4} ${dy})` }, carveWing);
  braid(carveWing, 232, 92, 360, 120, 6, 5);
  triquetra(carveWing, 300, 168, 20);
  spiral(carveWing, 252, 188, 15, 2.2);
  spiral(carveWing, 346, 172, 12, 2, -1);
  el("circle", { class: "carve", cx: 300, cy: 168, r: 30 }, carveWing);
  inset(wing, svg, "covert-clip", covert);
  wing.append(carveWing); // carvings cut through the feathers, so they go on top

  // Crest plumes swept back from the skull, hackles bristling under the throat
  fan(body, carve, 4, [138, 140], [156, 156], [-38, 4], [58, 44], [12, 10]);
  fan(body, carve, 5, [112, 222], [150, 264], [128, 148], [34, 42], [12, 12]);

  // Head, hooked beak, body down to the tail root
  const torso = "M150,148 C130,128 100,133 88,158 L70,170 Q50,190 36,230 Q48,214 60,210 Q72,204 88,196 C100,215 115,225 130,235 C150,262 175,290 215,310 L292,346 L302,320 C275,280 242,230 216,196 C196,170 176,154 150,148Z";
  el("path", { d: torso }, body);
  inset(body, svg, "torso-clip", torso);
  el("path", { class: "leg", d: "M196,282 Q178,322 200,334 Q218,320 232,300" }, body);
  for (const [hx, hy, kx, ky] of [[206, 300, 178, 368], [236, 316, 222, 380]]) {
    el("path", { class: "leg", d: `M${hx},${hy} L${kx},${ky} M${kx},${ky} q-15,1 -25,12 M${kx},${ky} q-7,9 -7,23 M${kx},${ky} q7,6 9,19` }, body);
  }

  el("circle", { class: "hole", cx: 110, cy: 164, r: 6 }, carve);
  el("circle", { class: "carve", cx: 110, cy: 164, r: 13 }, carve);
  el("path", { class: "carve", d: "M84,182 Q68,194 52,214" }, carve);
  el("path", { class: "carve", d: "M128,150 Q150,160 158,186" }, carve);
  braid(carve, 132, 194, 196, 262, 7, 3);
  braid(carve, 222, 212, 286, 318, 6, 4);
  triquetra(carve, 236, 266, 17);
  spiral(carve, 128, 214, 11, 1.8, -1);
  spiral(carve, 268, 322, 10, 1.8);
  el("path", { class: "carve", d: "M98,146 C112,138 132,140 146,152" }, carve);
  spiral(carve, 140, 170, 10, 1.7, -1);
  spiral(carve, 196, 222, 9, 1.6);
  for (let i = 0; i < 4; i++) {
    const [x, y] = [150 + i * 15, 238 + i * 16];
    el("path", { class: "carve", d: `M${x - 9},${y} q9,10 18,0` }, carve);
  }
}

// Cracks: forking random walks, a dark gap with a lit lip below it
function buildCracks() {
  const g = document.getElementById("cracks");
  g.replaceChildren();
  const W = innerWidth;
  const H = innerHeight;
  const s = Math.min(W, H);
  let seed = 9;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const walk = (x, y, a, n, w) => {
    let d = `M${f(x)},${f(y)}`;
    for (let i = 0; i < n; i++) {
      a += (rand() - 0.5) * 0.7;
      x += cos(a) * s * 0.025;
      y += sin(a) * s * 0.025;
      d += `L${f(x)},${f(y)}`;
      if (w > 0.8 && rand() < 0.07) walk(x, y, a + (rand() < 0.5 ? 0.9 : -0.9), n * 0.4, w * 0.6);
    }
    el("path", { d, stroke: "rgba(220,240,240,0.07)", "stroke-width": w + 1, transform: "translate(0.8 1.2)" }, g);
    el("path", { d, stroke: "rgba(4,10,12,0.6)", "stroke-width": w }, g);
  };
  walk(0, H * 0.18, 0.35, 28, 1.6);
  walk(W, H * 0.62, PI + 0.3, 30, 1.8);
  walk(W * 0.3, H, -1.2, 22, 1.4);
  walk(W * 0.82, 0, 2.0, 18, 1.2);
}

// Turquoise motes drifting up like embers
function motes() {
  const cv = document.getElementById("motes");
  const ctx = cv.getContext("2d");
  let W, H, dpr, pts;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    pts = Array.from({ length: Math.round(Math.min(70, (W * H) / 20000)) }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      v: 6 + Math.random() * 14,
      r: 0.6 + Math.random() * 1.6,
      p: Math.random() * 6,
    }));
  };
  size();
  addEventListener("resize", size);
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#6ff2da";
    for (const m of pts) {
      m.y -= m.v * dt;
      m.x += sin(now / 1500 + m.p) * 6 * dt;
      if (m.y < -4) {
        m.y = H + 4;
        m.x = Math.random() * W;
      }
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * sin(now / 700 + m.p * 3));
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

buildRaven();
buildCracks();
addEventListener("resize", buildCracks);
if (!reduced) motes();

addEventListener("click", () => {
  document.body.classList.remove("call");
  void document.body.offsetWidth; // restart the animation on rapid clicks
  document.body.classList.add("call");
});
