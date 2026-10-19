// Orizzonte degli eventi: the photo (buconero.jpg) is the backdrop; the canvas adds
// what a still can't — a turning accretion disk with its lensed halo, matter falling
// in, background stars bent around the shadow, and gravitational waves on click.

const IMG = { w: 1280, h: 720 };
const HOLE = { x: 629, y: 324, r: 111 }; // shadow centre and radius in photo pixels
const TILT = 0.1; // disk tilt in the photo, radians
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const scene = document.getElementById("scene");
const photo = document.getElementById("photo");
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");

let W, H, dpr, C, R, stars, disk, waves = [];
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };

function rand(a, b) {
  return a + Math.random() * (b - a);
}

// Cover the viewport with the photo, keeping the hole near the upper middle
function place() {
  W = innerWidth;
  H = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4e6 / (W * H)));
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);

  const s = Math.max(W / IMG.w, H / IMG.h) * 1.06;
  const fx = W / 2, fy = H * (W < 640 ? 0.36 : 0.4);
  const ox = Math.min(0, Math.max(W - IMG.w * s, fx - HOLE.x * s));
  const oy = Math.min(0, Math.max(H - IMG.h * s, fy - HOLE.y * s));
  Object.assign(photo.style, { width: IMG.w * s + "px", left: ox + "px", top: oy + "px" });

  C = { x: ox + HOLE.x * s, y: oy + HOLE.y * s };
  R = HOLE.r * s;
  scene.style.setProperty("--cx", C.x + "px");
  scene.style.setProperty("--cy", C.y + "px");
  photo.style.setProperty("--cx", HOLE.x * s + "px");
  photo.style.setProperty("--cy", HOLE.y * s + "px");

  stars = Array.from({ length: Math.round((W * H) / 2600) }, () => ({
    x: rand(0, W), y: rand(0, H), z: rand(0.2, 1), p: rand(0, 6.28), s: rand(0.4, 1.4),
  }));
  disk = Array.from({ length: 900 }, () => particle(rand(1.25, 5.5)));
}

// Disk radius in units of R; hotter (whiter) closer in
function particle(r) {
  return { r, a: rand(0, Math.PI * 2), h: rand(18, 38), w: rand(0.3, 1) };
}

const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
function tilt(x, y) {
  return [C.x + x * cosT - y * sinT, C.y + x * sinT + y * cosT];
}

// Direct image of the disk: a thin tilted ellipse through the hole
function direct(r, a) {
  return tilt(Math.cos(a) * r * R, Math.sin(a) * r * R * 0.11);
}
// Lensed image: the far side bent up into the arc over the shadow, the near side
// folded under it, both hugging the photon ring
function lensed(r, a) {
  const rho = R * (1.04 + (r - 1.25) * 0.3);
  return tilt(Math.cos(a) * rho, Math.sin(a) * rho * 0.96);
}

function drawStars(t) {
  const px = mouse.x * 18, py = mouse.y * 12;
  for (const st of stars) {
    if (!reduced) st.x -= st.z * 0.06;
    if (st.x < -20) st.x += W + 40;
    let x = st.x + px * st.z, y = st.y + py * st.z;
    let dx = x - C.x, dy = y - C.y, d = Math.hypot(dx, dy) || 1;
    // gravitational wave fronts shove stars outward as they pass
    let push = 0;
    for (const wv of waves) push += wv.amp * Math.exp(-(((d - wv.rad) / 40) ** 2));
    // weak-field lensing: light passing close is bent away from the shadow
    const bent = d + (R * R * 1.4) / d + push;
    if (bent < R * 1.08) continue;
    x = C.x + (dx / d) * bent;
    y = C.y + (dy / d) * bent;
    const tw = 0.55 + 0.45 * Math.sin(t * 0.002 * st.s + st.p);
    ctx.globalAlpha = tw * st.z;
    const size = st.s * st.z * (d < R * 3 ? 1.6 : 1);
    ctx.fillRect(x, y, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawDisk(dt) {
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";
  for (const p of disk) {
    const a0 = p.a;
    // Kepler: inner matter laps the outer, and everything slowly spirals in
    p.a += dt * 0.0011 * p.r ** -1.5;
    p.r -= dt * 0.000045 * (p.r < 1.6 ? 4 : 1);
    if (p.r < 1.2) Object.assign(p, particle(rand(4.5, 5.5)));

    const heat = Math.min(1, 1.6 / p.r);
    // relativistic beaming: the side coming toward us (left) is brighter
    const beam = 0.55 + 0.45 * -Math.cos(p.a);
    const light = 55 + heat * 40;
    const col = `hsla(${p.h - heat * 10}, ${90 - heat * 50}%, ${light}%,`;
    const front = Math.sin(p.a) > 0;

    // direct image: the far half disappears behind the shadow
    const [x0, y0] = direct(p.r, a0);
    const [x1, y1] = direct(p.r, p.a);
    if (front || Math.hypot(x1 - C.x, y1 - C.y) > R) {
      ctx.strokeStyle = col + 0.45 * beam * p.w + ")";
      ctx.lineWidth = 0.8 + heat * 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // lensed halo, mostly from the inner disk
    if (p.r < 3.2) {
      const [u0, v0] = lensed(p.r, a0);
      const [u1, v1] = lensed(p.r, p.a);
      ctx.strokeStyle = col + (front ? 0.1 : 0.24) * beam * p.w * heat + ")";
      ctx.lineWidth = 0.6 + heat;
      ctx.beginPath();
      ctx.moveTo(u0, v0);
      ctx.lineTo(u1, v1);
      ctx.stroke();
    }
  }

  // photon ring breathing
  const g = 0.5 + 0.25 * Math.sin(performance.now() * 0.0015);
  ctx.strokeStyle = `rgba(255, 236, 210, ${0.35 * g})`;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = "rgba(255, 190, 120, 0.9)";
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(C.x, C.y, R * 1.005, Math.PI * 0.96 + TILT, Math.PI * 2.04 + TILT);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = "source-over";
}

function drawWaves(dt) {
  for (const wv of waves) {
    wv.rad += dt * 0.55;
    wv.amp *= 0.985;
    const fade = Math.max(0, 1 - wv.rad / Math.hypot(W, H));
    ctx.strokeStyle = `rgba(159, 200, 255, ${0.35 * fade})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(C.x, C.y, wv.rad, wv.rad * 0.92, TILT, 0, Math.PI * 2);
    ctx.stroke();
  }
  waves = waves.filter((wv) => wv.rad < Math.hypot(W, H));
}

let last = 0;
function frame(t) {
  const dt = Math.min(50, t - last || 16);
  last = t;
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  if (!document.body.classList.contains("dive")) {
    scene.style.transform = `translate(${mouse.x * -10}px, ${mouse.y * -7}px)`;
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  drawStars(t);
  drawDisk(dt);
  drawWaves(dt);
  if (!reduced) requestAnimationFrame(frame);
}

function wave() {
  waves.push({ rad: R, amp: 26 });
  for (const p of disk) p.r = Math.max(1.25, p.r - rand(0, 0.25));
}

// ---------- interface ----------

const clock = document.getElementById("clock");
setInterval(() => {
  clock.textContent = new Date().toISOString().slice(11, 19) + " UTC";
}, 1000);

const spark = document.getElementById("spark");
const samples = Array.from({ length: 60 }, () => 20);
let phase = 0;
function signal() {
  phase += 0.35;
  samples.shift();
  // a chirp: the ringdown of two merging horizons, over and over
  const env = (phase % 18) / 18;
  samples.push(20 + Math.sin(phase * (1 + env * 5)) * 16 * env * (1 - env) * 4 + rand(-1.5, 1.5));
  spark.setAttribute("points", samples.map((v, i) => `${(i / 59) * 200},${v.toFixed(1)}`).join(" "));
}
if (reduced) for (let i = 0; i < 60; i++) signal();
else setInterval(signal, 120);

const dil = document.getElementById("dil"), dilBar = document.getElementById("dil-bar");
const spin = document.getElementById("spin");
setInterval(() => {
  const v = 58 + Math.round(rand(0, 6));
  dil.textContent = v;
  dilBar.style.setProperty("--v", v / 100);
  spin.textContent = (0.996 + rand(0, 0.003)).toFixed(3);
}, 1600);

const entries = [
  "Agganciati all'orbita di parcheggio a 3.4 rₛ.",
  "Il disco brilla a dieci milioni di kelvin.",
  "Le stelle dietro Gargantua si piegano ad anello.",
  "Ogni ora qui sono sette anni a casa.",
  "Sonda lanciata oltre la sfera di fotoni.",
  "Segnale della sonda: spostato verso il rosso, poi nulla.",
  "Onda gravitazionale registrata dagli interferometri.",
  "Rotta corretta: fionda gravitazionale tra 40 minuti.",
];
const log = document.getElementById("log");
let entry = 0, mission = 3600 * 2 + 840;
function stamp() {
  const h = Math.floor(mission / 3600), m = Math.floor(mission / 60) % 60, s = mission % 60;
  return `T+${[h, m, s].map((n) => String(n).padStart(2, "0")).join(":")}`;
}
function write() {
  const li = document.createElement("li");
  li.innerHTML = `<time>${stamp()}</time><span></span>`;
  const span = li.lastChild, text = entries[entry++ % entries.length];
  log.append(li);
  while (log.children.length > 6) log.firstChild.remove();
  mission += Math.round(rand(240, 1300));
  if (reduced) {
    span.textContent = text;
    return;
  }
  li.className = "typing";
  let i = 0;
  const type = setInterval(() => {
    span.textContent = text.slice(0, ++i);
    if (i < text.length) return;
    clearInterval(type);
    li.className = "";
    setTimeout(write, 2600);
  }, 32);
}
if (reduced) entries.slice(0, 4).forEach(write);
else setTimeout(write, 1600);

// seamless marquee: the track holds two copies and slides by half its width
const ticker = document.getElementById("ticker");
ticker.innerHTML += ticker.innerHTML;

const dive = document.getElementById("dive");
dive.addEventListener("click", () => {
  const on = document.body.classList.toggle("dive");
  scene.style.transform = "";
  dive.textContent = on ? "Ritorna" : "Avvicinati";
  if (on) wave();
});
document.getElementById("wave").addEventListener("click", wave);
scene.addEventListener("click", wave);

const cursor = document.getElementById("cursor");
addEventListener("pointermove", (e) => {
  mouse.tx = e.clientX / W - 0.5;
  mouse.ty = e.clientY / H - 0.5;
  if (e.pointerType !== "mouse") return;
  document.body.classList.add("pointer");
  cursor.style.translate = `${e.clientX}px ${e.clientY}px`;
  cursor.classList.toggle("big", !!e.target.closest("a, button"));
});
document.documentElement.addEventListener("pointerleave", () => document.body.classList.remove("pointer"));

addEventListener("resize", () => {
  place();
  if (reduced) frame(0);
});
place();
if (photo.complete) requestAnimationFrame(frame);
else photo.addEventListener("load", () => requestAnimationFrame(frame), { once: true });
