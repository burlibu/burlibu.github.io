// Futuro: kinetic type over a tilted vortex of light streaks.
// Particles orbit a disk at Kepler-ish speeds; each is drawn as the chord it
// swept in the last instant, so speeding them up (click) stretches the streaks.

const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const stage = document.getElementById("stage");
const word = document.getElementById("word");
const index = document.getElementById("index");
const tc = document.getElementById("tc");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const WORDS = ["FUTURO", "MOTION", "SEGNALE", "ORBITA", "IMPULSO"];
const GLYPHS = "!<>-_\\/[]{}=+*^?#01ΔΣΩ";
const { sin, cos, PI, random } = Math;

let W, H, dpr, R, pts;
let mx = 0;
let my = 0;
let boost = 0;

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  R = Math.min(W, H) * 0.62;
  cv.width = W * dpr;
  cv.height = H * dpr;
  pts = Array.from({ length: Math.round(Math.min(1400, (W * H) / 800)) }, () => {
    const r = R * (0.3 + random() ** 0.7 * 0.9);
    return {
      r,
      a: random() * PI * 2,
      y: (random() - 0.5) * R * 0.06 * (r / R),
      w: 0.32 * Math.sqrt(R / r),
    };
  });
  if (reduced) draw(0, 0);
}

// Yaw around Y, pitch around X, then perspective; returns [sx, sy, depth, scale]
function project(x, y, z, yaw, pitch) {
  const x1 = x * cos(yaw) - z * sin(yaw);
  const z1 = x * sin(yaw) + z * cos(yaw);
  const y2 = y * cos(pitch) - z1 * sin(pitch);
  const z2 = y * sin(pitch) + z1 * cos(pitch);
  const k = (R * 2.4) / (R * 2.4 + z2);
  return [W / 2 + x1 * k, H / 2 + y2 * k, z2 / R, k];
}

function draw(t, dt) {
  const speed = 1 + boost * 7;
  const yaw = t * 0.05 + mx * 0.5;
  const pitch = 1.12 + my * 0.3;
  const trail = 0.09 * speed;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, R * 0.5);
  glow.addColorStop(0, `rgba(212,255,58,${0.1 + boost * 0.25})`);
  glow.addColorStop(1, "rgba(212,255,58,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Two batched paths: near half in lime, far half in violet
  const near = new Path2D();
  const far = new Path2D();
  for (const p of pts) {
    p.a += p.w * speed * dt;
    const [x1, y1, d] = project(p.r * cos(p.a), p.y, p.r * sin(p.a), yaw, pitch);
    const b = p.a - p.w * trail;
    const [x0, y0] = project(p.r * cos(b), p.y, p.r * sin(b), yaw, pitch);
    const path = d < 0 ? near : far;
    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = "rgba(122,92,255,0.45)";
  ctx.stroke(far);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = "rgba(212,255,58,0.6)";
  ctx.stroke(near);
  ctx.globalCompositeOperation = "source-over";
}

// Decode-style text swap: each letter flickers through glyphs before settling
let wi = 0;
let scrambleId = 0;
function next() {
  wi = (wi + 1) % WORDS.length;
  const from = word.textContent;
  const to = WORDS[wi];
  word.setAttribute("aria-label", to);
  index.textContent = `0${wi + 1} / 0${WORDS.length}`;
  if (reduced) {
    word.textContent = to;
    return;
  }
  const n = Math.max(from.length, to.length);
  const timing = Array.from({ length: n }, () => {
    const start = random() * 0.35;
    return [start, start + 0.25 + random() * 0.35];
  });
  const id = ++scrambleId;
  const t0 = performance.now();
  word.classList.add("shift");
  const step = (now) => {
    if (id !== scrambleId) return;
    const t = (now - t0) / 1000;
    let out = "";
    let done = true;
    for (let i = 0; i < n; i++) {
      const [s, e] = timing[i];
      if (t >= e) out += to[i] || "";
      else {
        done = false;
        out += t >= s ? GLYPHS[(random() * GLYPHS.length) | 0] : from[i] || "";
      }
    }
    word.textContent = out;
    if (done) word.classList.remove("shift");
    else requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function tapes() {
  const items = ["MOTION DESIGN", "FUTURO", "CLICCA PER L'IMPULSO", "MUOVI IL PUNTATORE", "BURLIBU LAB", "MMXXVI"];
  for (const track of document.querySelectorAll(".track")) {
    const half = Array(4).fill(items.join("  ✦  ")).join("  ✦  ") + "  ✦  ";
    track.textContent = half + half;
  }
}

function ticks() {
  const g = document.getElementById("ticks");
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * PI * 2;
    const long = i % 6 === 0;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    const [r0, r1] = long ? [146, 158] : [151, 156];
    line.setAttribute("x1", (r0 * cos(a)).toFixed(1));
    line.setAttribute("y1", (r0 * sin(a)).toFixed(1));
    line.setAttribute("x2", (r1 * cos(a)).toFixed(1));
    line.setAttribute("y2", (r1 * sin(a)).toFixed(1));
    g.append(line);
  }
}

const pad = (n) => String(n).padStart(2, "0");
let last = performance.now();
const t0 = last;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  boost = Math.max(0, boost - dt * 0.9);
  draw(now / 1000, dt);
  const s = (now - t0) / 1000;
  tc.textContent = `TC ${pad((s / 3600) | 0)}:${pad(((s / 60) | 0) % 60)}:${pad(s % 60 | 0)}:${pad(((s * 25) | 0) % 25)}`;
  requestAnimationFrame(frame);
}

addEventListener("resize", resize);
addEventListener("pointermove", (e) => {
  mx = e.clientX / W - 0.5;
  my = e.clientY / H - 0.5;
  stage.style.setProperty("--rx", `${(-my * 18).toFixed(2)}deg`);
  stage.style.setProperty("--ry", `${(mx * 22).toFixed(2)}deg`);
});

let timer;
function schedule() {
  clearInterval(timer);
  if (!reduced) timer = setInterval(next, 3600);
}
addEventListener("click", () => {
  boost = 1;
  document.body.classList.remove("pulse");
  void document.body.offsetWidth; // restart the pulse on rapid clicks
  document.body.classList.add("pulse");
  next();
  schedule();
});

ticks();
tapes();
resize();
schedule();
if (!reduced) requestAnimationFrame(frame);
