// Circuito: a 4K photo garage. Each car wipes in behind a racing stripe while a car
// laps the track map; its speed (from the corners ahead) drives the speedometer,
// the gear and the speed lines over the photo.

const cars = [
  {
    img: "ferrari", pos: "58% 62%", accent: "#ff2a2a", place: "Spa-Francorchamps",
    brand: "Ferrari", model: "499P", cv: 680, vmax: 340, engine: "V6 ibrido",
    tagline: "L'hypercar che ha riportato Maranello a vincere Le Mans, mezzo secolo dopo.",
    credit: "Xavier Praillet",
  },
  {
    img: "lamborghini", pos: "38% 72%", accent: "#7dff3a", place: "Cannes",
    brand: "Lamborghini", model: "Aventador SVJ", cv: 770, vmax: 350, engine: "V12 6.5",
    tagline: "Aerodinamica attiva, dodici cilindri aspirati e nessuna intenzione di passare inosservata.",
    credit: "Flavien",
  },
  {
    img: "amg", pos: "42% 62%", accent: "#00d2be", place: "Long Beach",
    brand: "Mercedes-AMG", model: "GT3", cv: 550, vmax: 290, engine: "V8 6.3",
    tagline: "Il cofano lungo, il V8 davanti e i muretti di un cittadino a pochi centimetri.",
    credit: "Charles Causse",
  },
  {
    img: "porsche", pos: "60% 64%", accent: "#ff3b5c", place: "Endurance",
    brand: "Porsche", model: "963", cv: 680, vmax: 340, engine: "V8 biturbo ibrido",
    tagline: "Ventiquattro ore a tutto gas, di notte, sotto la pioggia, contro tutti.",
    credit: "Xavier Praillet",
  },
  {
    img: "mclaren", pos: "45% 72%", accent: "#ff8000", place: "Silverstone",
    brand: "McLaren", model: "650S", cv: 650, vmax: 333, engine: "V8 3.8 biturbo",
    tagline: "Fibra di carbonio, porte ad ala e il colore papaya nel DNA di Woking.",
    credit: "Spurwing Agency",
  },
];

const DUR = 7000;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const src = (c, w) => `img/${c.img}-${w}.jpg`;

// ---------- slides ----------

const slides = $("slides"), thumbs = $("thumbs"), rail = thumbs.parentElement;
const info = document.querySelector(".info"), model = $("model");
let current = -1, timer;

cars.forEach((c, i) => {
  const b = document.createElement("button");
  b.className = "thumb";
  b.style.setProperty("--pos", c.pos);
  b.setAttribute("aria-label", `${c.brand} ${c.model}`);
  b.innerHTML = `<img src="${src(c, 480)}" alt="" />`;
  b.addEventListener("click", () => show(i));
  thumbs.append(b);
});
$("total").textContent = String(cars.length).padStart(2, "0");
document.documentElement.style.setProperty("--dur", DUR + "ms");

function show(i) {
  i = (i + cars.length) % cars.length;
  if (i === current) return;
  const first = current < 0;
  current = i;
  const c = cars[i];

  const slide = document.createElement("div");
  slide.className = "slide";
  slide.style.setProperty("--pos", c.pos);
  slide.innerHTML = `<img srcset="${src(c, 1920)} 1920w, ${src(c, 3840)} 3840w" sizes="100vw" alt="${c.brand} ${c.model}" />`;
  slides.append(slide);
  const img = slide.firstChild;
  // wait for the photo so the wipe never reveals an empty frame
  (img.complete ? Promise.resolve() : img.decode().catch(() => {})).then(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => slide.classList.add("in")));
    setTimeout(() => {
      while (slides.children.length > 1 && slides.firstChild !== slide) slides.firstChild.remove();
    }, 1400);
  });

  document.documentElement.style.setProperty("--accent", c.accent);
  if (!first) {
    const stripe = $("stripe");
    stripe.classList.remove("go");
    void stripe.offsetWidth;
    stripe.classList.add("go");
    boost = 1;
  }

  [...thumbs.children].forEach((t, k) => t.classList.toggle("on", k === i));
  info.classList.add("out");
  model.classList.remove("in");
  setTimeout(() => fill(c), first ? 0 : 450);

  vmax = c.vmax;
  clearTimeout(timer);
  if (!reduced) timer = setTimeout(() => show(current + 1), DUR);
}

function fill(c) {
  $("index").textContent = String(current + 1).padStart(2, "0");
  $("place").textContent = c.place;
  $("brand").textContent = c.brand;
  $("tagline").textContent = c.tagline;
  $("credit").textContent = `Foto: ${c.credit} / Unsplash`;
  let n = 0;
  model.innerHTML = c.model
    .split(" ")
    .map((w) => `<span class="w">${[...w].map((ch) => `<span class="ch" style="--i:${n++}">${ch}</span>`).join("")}</span>`)
    .join(" ");
  model.setAttribute("aria-label", c.model);
  document.querySelector("[data-spec=engine]").textContent = c.engine;
  count("cv", c.cv);
  count("vmax", c.vmax);
  requestAnimationFrame(() => {
    info.classList.remove("out");
    model.classList.add("in");
  });
}

function count(key, to) {
  const el = document.querySelector(`[data-spec=${key}]`);
  if (reduced) return (el.textContent = to);
  const t0 = performance.now();
  (function tick(t) {
    const k = Math.min(1, (t - t0) / 1300);
    el.textContent = Math.round(to * (1 - (1 - k) ** 4));
    if (k < 1) requestAnimationFrame(tick);
  })(t0);
}

$("prev").addEventListener("click", () => show(current - 1));
$("next").addEventListener("click", () => show(current + 1));
addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") show(current - 1);
  if (e.key === "ArrowRight") show(current + 1);
});
// pause autoplay while the pointer rests on the controls
rail.addEventListener("pointerenter", () => {
  clearTimeout(timer);
  rail.classList.add("paused");
});
rail.addEventListener("pointerleave", () => {
  rail.classList.remove("paused");
  if (!reduced) timer = setTimeout(() => show(current + 1), DUR / 2);
});
let touchX = null;
addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
addEventListener("touchend", (e) => {
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
});

// ---------- track: a speed profile from the corners, like a real lap ----------

const TRACK =
  "M 32 118 L 118 118 C 146 118 156 126 172 133 C 194 142 210 128 205 108 C 201 90 184 84 172 74 " +
  "L 144 44 C 133 33 116 30 104 38 L 82 56 C 71 64 60 60 56 49 L 51 30 C 47 17 30 17 25 30 L 15 88 C 12 104 18 118 32 118 Z";
const road = $("circuit"), glow = $("circuit-glow"), dot = $("car");
road.setAttribute("d", TRACK);
glow.setAttribute("d", TRACK);
const LEN = road.getTotalLength();
const N = 500;
const pts = Array.from({ length: N }, (_, i) => road.getPointAtLength((i / N) * LEN));

// grip-limited speed from curvature, then braking/acceleration passes around the loop
const corner = pts.map((p, i) => {
  const a = pts[(i - 3 + N) % N], b = pts[(i + 3) % N];
  const h1 = Math.atan2(p.y - a.y, p.x - a.x), h2 = Math.atan2(b.y - p.y, b.x - p.x);
  const turn = Math.abs(((h2 - h1 + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return Math.min(1, 0.32 + 0.11 / (turn + 0.04));
});
const profile = corner.slice();
for (let pass = 0; pass < 2; pass++) {
  for (let i = 2 * N; i > 0; i--) profile[i % N] = Math.min(profile[i % N], profile[(i + 1) % N] + 0.012); // braking
  for (let i = 0; i < 2 * N; i++) profile[(i + 1) % N] = Math.min(profile[(i + 1) % N], profile[i % N] + 0.005); // traction
}

let vmax = cars[0].vmax, dist = 0, speed = 0, lapStart = 0, lap = 1, best = Infinity, boost = 0;
const GEARS = [0, 70, 115, 160, 205, 250, 300, Infinity];
const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}.${String(Math.floor(ms % 1000)).padStart(3, "0")}`;

function drive(dt, now) {
  const i = Math.floor((dist / LEN) * N) % N;
  const target = profile[i] * vmax;
  speed += (target - speed) * Math.min(1, dt * 0.004);
  dist += speed * dt * 0.00011;
  if (dist >= LEN) {
    dist -= LEN;
    const t = (now - lapStart) * 4; // the minimap lap runs at 4x
    best = Math.min(best, t);
    $("best").textContent = fmt(best);
    $("lap").textContent = ++lap;
    lapStart = now;
  }
  const p = road.getPointAtLength(dist);
  dot.setAttribute("cx", p.x);
  dot.setAttribute("cy", p.y);
  glow.style.strokeDasharray = `${dist} ${LEN}`;

  const g = GEARS.findIndex((v) => speed < v);
  const lo = GEARS[g - 1], hi = Math.min(GEARS[g], vmax + 10);
  const rpm = 0.3 + 0.7 * Math.min(1, (speed - lo) / (hi - lo));
  $("speed").textContent = Math.round(speed);
  $("gear").textContent = g;
  $("rpm").style.strokeDashoffset = 100 - rpm * 100;
  $("time").textContent = fmt((now - lapStart) * 4);
}

// ---------- speed lines ----------

const canvas = $("lines"), ctx = canvas.getContext("2d");
let W, H, dpr, streaks = [];

function resize() {
  W = innerWidth;
  H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  streaks = Array.from({ length: Math.round(Math.min(160, (W * H) / 9000)) }, spawn);
}
function spawn() {
  return { a: Math.random() * Math.PI * 2, r: Math.random(), v: 0.4 + Math.random() * 0.6 };
}

function lines(dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const cx = W * 0.62, cy = H * 0.55, reach = Math.hypot(W, H) * 0.7;
  const pace = speed / 340 + boost * 2.5;
  ctx.lineCap = "round";
  for (const s of streaks) {
    s.r += dt * 0.00035 * s.v * (0.3 + pace) * (0.3 + s.r);
    if (s.r > 1) Object.assign(s, spawn(), { r: 0.05 });
    const r0 = s.r * reach, r1 = r0 * (1 - Math.min(0.6, 0.08 + pace * 0.18));
    const cos = Math.cos(s.a), sin = Math.sin(s.a) * 0.6;
    ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(0.5, s.r * 0.6 * (0.25 + pace * 0.6))})`;
    ctx.lineWidth = 0.5 + s.r * 1.6;
    ctx.beginPath();
    ctx.moveTo(cx + cos * r1, cy + sin * r1);
    ctx.lineTo(cx + cos * r0, cy + sin * r0);
    ctx.stroke();
  }
  boost = Math.max(0, boost - dt * 0.0012);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(50, now - last);
  last = now;
  drive(dt, now);
  lines(dt);
  requestAnimationFrame(frame);
}

addEventListener("resize", resize);
resize();
show(0);
if (reduced) {
  speed = vmax * 0.8;
  drive(0, 0);
} else {
  lapStart = last;
  requestAnimationFrame(frame);
}
