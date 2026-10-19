// Stagger: a tiny tween engine (easings + staggered delays) driving a row of dots
// through formations inside a glowing rainbow dial. Dot positions are stored in
// units of the dial radius R, so a resize only changes the scale.

const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const { sin, cos, abs, min, max, hypot, random, PI } = Math;
const TAU = PI * 2;
const N = 36;
const HUES = ["#ff4040", "#ff9a1f", "#ffd43b", "#a8e63c", "#3ee08f", "#25d0e8", "#4a8cff", "#ff4f8b"];

const ease = {
  outElastic: (t) => (t === 0 || t === 1 ? t : 2 ** (-10 * t) * sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  inOutSine: (t) => -(cos(PI * t) - 1) / 2,
  outExpo: (t) => (t === 1 ? 1 : 1 - 2 ** (-10 * t)),
  inOutExpo: (t) => (t === 0 || t === 1 ? t : t < 0.5 ? 2 ** (20 * t - 10) / 2 : (2 - 2 ** (-20 * t + 10)) / 2),
  outBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
  outQuart: (t) => 1 - (1 - t) ** 4,
};

const mid = (N - 1) / 2;
const MODES = [
  {
    name: "Linea",
    code: "stagger(<b>30</b>, { from: 'center' }) · outElastic(1, .6)",
    ease: ease.outElastic,
    at: (i) => [(i - mid) * 0.026, 0],
    delay: (i) => abs(i - mid) * 30,
  },
  {
    name: "Onda",
    code: "stagger(<b>25</b>) · inOutSine",
    ease: ease.inOutSine,
    at: (i) => [(i - mid) * 0.026, sin((i / (N - 1)) * PI * 3) * 0.16],
    delay: (i) => i * 25,
  },
  {
    name: "Cerchio",
    code: "stagger(<b>20</b>, { from: 'first' }) · outExpo",
    ease: ease.outExpo,
    at: (i) => [cos((i / N) * TAU - PI / 2) * 0.42, sin((i / N) * TAU - PI / 2) * 0.42],
    delay: (i) => i * 20,
  },
  {
    name: "Spirale",
    code: "stagger(<b>18</b>, { from: 'last' }) · inOutExpo",
    ease: ease.inOutExpo,
    at: (i) => [cos(i * 0.52) * (0.04 + i * 0.0125), sin(i * 0.52) * (0.04 + i * 0.0125)],
    delay: (i) => (N - 1 - i) * 18,
  },
  {
    name: "Griglia",
    code: "stagger(<b>40</b>, { grid: [6, 6], from: 'center' }) · outBack",
    ease: ease.outBack,
    at: (i) => [((i % 6) - 2.5) * 0.11, (((i / 6) | 0) - 2.5) * 0.11],
    delay: (i) => hypot((i % 6) - 2.5, ((i / 6) | 0) - 2.5) * 40,
  },
  {
    name: "Caos",
    code: "stagger(<b>12</b>, { from: 'random' }) · outQuart",
    ease: ease.outQuart,
    at: () => {
      const a = random() * TAU;
      const r = Math.sqrt(random()) * 0.5;
      return [cos(a) * r, sin(a) * r];
    },
    delay: () => random() * N * 12,
  },
];
const DURATION = 1100;

let W, H, dpr, R;
let mode = 0;
let t0 = -1e9; // start of the current transition
let ringFrom = 0;
let ringTo = 0;
const intro = performance.now();
const dots = Array.from({ length: N }, (_, i) => {
  const [x, y] = MODES[0].at(i);
  return { x, y, fx: x, fy: y, tx: x, ty: y, d: 0 };
});

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  R = min(min(W, H) * 0.36, W * 0.4, H / 2 - 115); // keep in sync with .caption in style.css
  cv.width = W * dpr;
  cv.height = H * dpr;
  if (reduced) draw(performance.now());
}

function go(next) {
  mode = (next + MODES.length) % MODES.length;
  const m = MODES[mode];
  t0 = performance.now();
  dots.forEach((p, i) => {
    [p.fx, p.fy] = [p.x, p.y];
    [p.tx, p.ty] = m.at(i);
    p.d = reduced ? -DURATION : m.delay(i);
  });
  ringFrom = ringTo;
  ringTo += PI / 4;
  document.getElementById("label").textContent = `0${mode + 1} / 0${MODES.length} — ${m.name}`;
  document.getElementById("code").innerHTML = m.code;
  for (const [j, b] of buttons.entries()) b.setAttribute("aria-pressed", String(j === mode));
  if (reduced) draw(performance.now());
}

const clamp01 = (v) => max(0, min(1, v));

function draw(now) {
  const cx = W / 2;
  const cy = H / 2;
  const t = now / 1000;
  const since = now - t0;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Background dot grid, lit by a ripple spreading from the center at each transition
  const step = R * 0.075;
  const wave = (since / 1000) * R * 1.1;
  for (let gx = -8; gx <= 8; gx++)
    for (let gy = -8; gy <= 8; gy++) {
      const d = hypot(gx, gy) * step;
      if (d > R * 0.66) continue;
      const lit = reduced ? 0 : Math.exp(-(((d - wave) / (R * 0.08)) ** 2));
      ctx.globalAlpha = 0.16 + lit * 0.6;
      ctx.fillStyle = lit > 0.05 ? "#ff6b6b" : "#9a9a9a";
      ctx.fillRect(cx + gx * step - 1, cy + gy * step - 1, 2, 2);
    }

  // Tick crown with a highlight travelling around it
  const head = (t * 0.3) % 1;
  ctx.strokeStyle = "#ff4b4b";
  ctx.lineWidth = max(1, R * 0.006);
  for (let i = 0; i < 160; i++) {
    const u = i / 160;
    const near = min(abs(u - head), 1 - abs(u - head));
    ctx.globalAlpha = 0.18 + max(0, 1 - near / 0.12) * 0.7;
    const a = u * TAU;
    const [r0, r1] = i % 5 ? [R * 0.86, R * 0.89] : [R * 0.85, R * 0.9];
    ctx.beginPath();
    ctx.moveTo(cx + cos(a) * r0, cy + sin(a) * r0);
    ctx.lineTo(cx + cos(a) * r1, cy + sin(a) * r1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#161616";
  ctx.lineWidth = 1;
  for (const r of [R * 0.8, R * 0.7]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
  }

  // Rainbow dial: eight arcs that draw in one by one, then kick an eighth of a turn per formation
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  const gap = 0.035;
  HUES.forEach((hue, i) => {
    const grow = reduced ? 1 : ease.outExpo(clamp01((now - intro - i * 90) / 900));
    if (grow <= 0) return;
    const kick = reduced ? 1 : ease.outElastic(clamp01((since - i * 40) / 1400));
    const rot = ringFrom + (ringTo - ringFrom) * kick - PI / 2;
    const a0 = rot + (i * TAU) / 8 + gap;
    const a1 = a0 + (TAU / 8 - gap * 2) * grow;
    const g = ctx.createLinearGradient(cx + cos(a0) * R, cy + sin(a0) * R, cx + cos(a1) * R, cy + sin(a1) * R);
    g.addColorStop(0, hue);
    g.addColorStop(1, HUES[(i + 1) % HUES.length]);
    ctx.strokeStyle = g;
    for (const [w, alpha] of [[R * 0.06, 0.12], [R * 0.025, 0.25], [R * 0.011, 1]]) {
      ctx.globalAlpha = alpha;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1);
      ctx.stroke();
    }
  });

  // The dots themselves, each on its own delayed tween
  const m = MODES[mode];
  const dotR = max(1.5, R * 0.014);
  for (const p of dots) {
    const k = m.ease(clamp01((since - p.d) / DURATION));
    p.x = p.fx + (p.tx - p.fx) * k;
    p.y = p.fy + (p.ty - p.fy) * k;
    const x = cx + p.x * R;
    const y = cy + p.y * R;
    ctx.fillStyle = "#ff4b4b";
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(x, y, dotR * 2.4, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(x, y, dotR, 0, TAU);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
}

// Mode buttons
const modesEl = document.getElementById("modes");
const buttons = MODES.map((m, i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = m.name;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    go(i);
    restartCycle();
  });
  modesEl.append(b);
  return b;
});

// Headline letters, staggered like everything else
const headline = document.querySelector(".headline");
let n = 0;
for (const node of [...headline.childNodes]) {
  if (node.nodeType !== Node.TEXT_NODE) continue;
  const frag = document.createDocumentFragment();
  for (const ch of node.textContent) {
    const s = document.createElement("span");
    s.textContent = ch;
    s.style.setProperty("--i", n++);
    s.setAttribute("aria-hidden", "true");
    frag.append(s);
  }
  node.replaceWith(frag);
}

let cycle;
function restartCycle() {
  clearInterval(cycle);
  if (!reduced) cycle = setInterval(() => go(mode + 1), 2800);
}

addEventListener("resize", resize);
addEventListener("click", () => {
  go(mode + 1);
  restartCycle();
});

resize();
go(0);
restartCycle();
if (!reduced) {
  const frame = (now) => {
    draw(now);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
