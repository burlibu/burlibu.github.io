// Osservatorio: a tactical-style monitoring dashboard around a dot-matrix globe.
// Everything shown is fictional: relay nodes at a few world cities, their links,
// three satellites and a simulated telemetry feed. The globe is a hand-rolled
// orthographic projection over a land mask sampled from Natural Earth (land.js).

const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const { sin, cos, asin, atan2, sqrt, hypot, min, max, abs, random, round, PI } = Math;
const D = PI / 180;
const $ = (id) => document.getElementById(id);

const NODES = [
  ["ROM", "Roma", 41.9, 12.5, "Data center"],
  ["LDN", "Londra", 51.5, -0.13, "Ripetitore"],
  ["REK", "Reykjavík", 64.15, -21.94, "Stazione di terra"],
  ["NYC", "New York", 40.71, -74.0, "Data center"],
  ["SFO", "San Francisco", 37.77, -122.42, "Ripetitore"],
  ["ANC", "Anchorage", 61.22, -149.9, "Stazione di terra"],
  ["SAO", "San Paolo", -23.55, -46.63, "Ripetitore"],
  ["CPT", "Città del Capo", -33.92, 18.42, "Array sensori"],
  ["NBO", "Nairobi", -1.29, 36.82, "Ripetitore"],
  ["DXB", "Dubai", 25.2, 55.27, "Data center"],
  ["SGP", "Singapore", 1.35, 103.82, "Data center"],
  ["TYO", "Tokyo", 35.68, 139.69, "Ripetitore"],
  ["SYD", "Sydney", -33.87, 151.21, "Stazione di terra"],
  ["MCM", "McMurdo", -77.85, 166.67, "Osservatorio meteo"],
].map(([code, city, lat, lon, role], i) => ({
  code,
  city,
  lat,
  lon,
  role,
  status: i === 8 ? "warn" : i === 13 ? "bad" : "ok",
  ms: 20 + round(random() * 120),
  up: `${40 + round(random() * 400)}g ${String(round(random() * 23)).padStart(2, "0")}h`,
  hist: Array.from({ length: 60 }, () => 300 + random() * 500),
}));
const byCode = Object.fromEntries(NODES.map((n) => [n.code, n]));
const LINKS = [
  "ROM-LDN", "ROM-DXB", "LDN-NYC", "LDN-REK", "REK-NYC", "NYC-SFO", "NYC-SAO", "SAO-CPT",
  "CPT-NBO", "NBO-DXB", "DXB-SGP", "SGP-TYO", "SGP-SYD", "TYO-SFO", "TYO-ANC", "ANC-SFO", "SYD-MCM",
].map((s) => s.split("-").map((c) => byCode[c]));
const SATS = [
  { name: "SAT-1", inc: 53, raan: 20, speed: 0.11, phase: 0 },
  { name: "SAT-2", inc: 97, raan: 140, speed: 0.08, phase: 2 },
  { name: "SAT-3", inc: 28, raan: 260, speed: 0.14, phase: 4 },
];

// ---------- geometry ----------
const vec = (lat, lon) => [cos(lat * D) * cos(lon * D), cos(lat * D) * sin(lon * D), sin(lat * D)];
const toLatLon = ([x, y, z]) => [asin(max(-1, min(1, z))) / D, atan2(y, x) / D];

function slerp(a, b, t) {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const om = Math.acos(max(-1, min(1, dot)));
  const s = sin(om) || 1;
  const ka = sin((1 - t) * om) / s;
  const kb = sin(t * om) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}

// Great-circle km between two nodes
function km(a, b) {
  const [p, q] = [vec(a.lat, a.lon), vec(b.lat, b.lon)];
  return round(6371 * Math.acos(max(-1, min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2]))));
}

// Land points from the hex row masks
const land = [];
LAND.forEach((hex, i) => {
  const lat = -84 + i * LAND_STEP;
  const k = max(1, round((360 * cos(lat * D)) / LAND_STEP));
  const pad = hex.length * 4 - k;
  for (let j = 0; j < k; j++) {
    const b = pad + j;
    if ((parseInt(hex[b >> 2], 16) >> (3 - (b & 3))) & 1) {
      land.push([sin(lat * D), cos(lat * D), -180 + ((j + 0.5) * 360) / k]);
    }
  }
});

// Each link becomes a lifted great-circle polyline: [lat, lon, altitude]
const arcs = LINKS.map(([a, b]) => {
  const [p, q] = [vec(a.lat, a.lon), vec(b.lat, b.lon)];
  const span = Math.acos(max(-1, min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])));
  return Array.from({ length: 49 }, (_, i) => {
    const t = i / 48;
    const [la, lo] = toLatLon(slerp(p, q, t));
    return [la, lo, 1 + sin(PI * t) * 0.05 * min(3, span * 2.2)];
  });
});

// ---------- view state ----------
const view = { lon: 12, lat: 28, zoom: 1 };
let fly = null; // {from, to, t0}
let lastInput = -1e9;
let auto = !reduced;
let sel = byCode.ROM;
let hover = null;

const cv = $("globe");
const ctx = cv.getContext("2d");
const wrap = $("wrap");
let W, H, dpr, R;

function resize() {
  dpr = min(devicePixelRatio || 1, 2);
  W = wrap.clientWidth;
  H = wrap.clientHeight;
  R = min(W, H) * 0.4;
  cv.width = W * dpr;
  cv.height = H * dpr;
  sizeSpark();
}

// Orthographic projection around the view center; returns [sx, sy, depth, visible]
function project(lat, lon, alt = 1) {
  const p0 = view.lat * D;
  const dl = (lon - view.lon) * D;
  const cp = cos(lat * D);
  const sp = sin(lat * D);
  const cd = cos(dl);
  const x = cp * sin(dl);
  const y = cos(p0) * sp - sin(p0) * cp * cd;
  const z = sin(p0) * sp + cos(p0) * cp * cd;
  const r = R * view.zoom * alt;
  const vis = z > 0 || hypot(x, y) * alt > 1;
  return [W / 2 + x * r, H / 2 - y * r, z, vis];
}

// Inverse projection for the cursor readout
function unproject(sx, sy) {
  const r = R * view.zoom;
  const x = (sx - W / 2) / r;
  const y = -(sy - H / 2) / r;
  const rho = hypot(x, y);
  if (rho > 1) return null;
  const c = asin(rho);
  const p0 = view.lat * D;
  const lat = rho === 0 ? view.lat : asin(cos(c) * sin(p0) + (y * sin(c) * cos(p0)) / rho) / D;
  const lon = view.lon + atan2(x * sin(c), rho * cos(c) * cos(p0) - y * sin(c) * sin(p0)) / D;
  return [lat, ((((lon + 180) % 360) + 360) % 360) - 180];
}

const COLORS = { ok: "#49d3ff", warn: "#ffb020", bad: "#ff3b30" };
const worst = (a, b) => (a.status === "bad" || b.status === "bad" ? "bad" : a.status === "warn" || b.status === "warn" ? "warn" : "ok");

function polyline(points, alt) {
  // strokes only the visible runs of a lat/lon polyline
  let pen = false;
  ctx.beginPath();
  for (const [la, lo, a] of points) {
    const [x, y, , vis] = project(la, lo, a ?? alt);
    if (!vis) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    pen = true;
  }
  ctx.stroke();
}

function satPos(s, t) {
  const u = s.phase + t * s.speed;
  const i = s.inc * D;
  const o = s.raan * D;
  const x = cos(u);
  const y = sin(u) * cos(i);
  const z = sin(u) * sin(i);
  return toLatLon([x * cos(o) - y * sin(o), x * sin(o) + y * cos(o), z]);
}

// Ring of points at angular radius r (deg) around a node
function ring(n, r) {
  const p1 = n.lat * D;
  const d = r * D;
  return Array.from({ length: 41 }, (_, i) => {
    const b = (i / 40) * 2 * PI;
    const p2 = asin(sin(p1) * cos(d) + cos(p1) * sin(d) * cos(b));
    const l2 = n.lon * D + atan2(sin(b) * sin(d) * cos(p1), cos(d) - sin(p1) * sin(p2));
    return [p2 / D, l2 / D];
  });
}

function draw(now) {
  const t = now / 1000;
  const r = R * view.zoom;
  const cx = W / 2;
  const cy = H / 2;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // atmosphere and disc
  const atm = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.3);
  atm.addColorStop(0, "rgba(73,211,255,0.14)");
  atm.addColorStop(1, "rgba(73,211,255,0)");
  ctx.fillStyle = atm;
  ctx.fillRect(0, 0, W, H);
  const disc = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, 0, cx, cy, r);
  disc.addColorStop(0, "#0e1a20");
  disc.addColorStop(1, "#060a0d");
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * PI);
  ctx.fill();

  // graticule
  ctx.strokeStyle = "rgba(120,160,180,0.09)";
  ctx.lineWidth = 1;
  for (let lo = -180; lo < 180; lo += 30) polyline(Array.from({ length: 61 }, (_, i) => [-90 + i * 3, lo]), 1);
  for (let la = -60; la <= 60; la += 30) polyline(Array.from({ length: 121 }, (_, i) => [la, -180 + i * 3]), 1);

  // land dots, bucketed by depth so each bucket is one fill
  const p0 = view.lat * D;
  const [sp0, cp0] = [sin(p0), cos(p0)];
  const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const size = max(1.2, r * 0.0065);
  for (const [sp, cp, lon] of land) {
    const dl = (lon - view.lon) * D;
    const cd = cos(dl);
    const z = sp0 * sp + cp0 * cp * cd;
    if (z <= 0) continue;
    const x = cx + cp * sin(dl) * r;
    const y = cy - (cp0 * sp - sp0 * cp * cd) * r;
    buckets[min(3, (z * 4) | 0)].rect(x - size / 2, y - size / 2, size, size);
  }
  buckets.forEach((b, i) => {
    ctx.fillStyle = `rgba(150,185,200,${0.22 + i * 0.2})`;
    ctx.fill(b);
  });

  // rim
  ctx.strokeStyle = "rgba(73,211,255,0.35)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * PI);
  ctx.stroke();

  // satellites: faint orbit, marker and label
  ctx.font = `500 10px "IBM Plex Mono", monospace`;
  for (const s of SATS) {
    ctx.strokeStyle = "rgba(207,224,232,0.12)";
    ctx.setLineDash([2, 4]);
    polyline(Array.from({ length: 97 }, (_, i) => satPos({ ...s, phase: (i / 96) * 2 * PI, speed: 0 }, 0)), 1.22);
    ctx.setLineDash([]);
    const [la, lo] = satPos(s, reduced ? 0 : t);
    const [x, y, , vis] = project(la, lo, 1.22);
    if (!vis) continue;
    ctx.fillStyle = "#cfe0e8";
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 4.5, y + 3);
    ctx.lineTo(x - 4.5, y + 3);
    ctx.fill();
    ctx.fillStyle = "rgba(207,224,232,0.7)";
    ctx.fillText(s.name, x + 8, y + 3);
  }

  // links with packets travelling along them
  arcs.forEach((pts, i) => {
    const [a, b] = LINKS[i];
    const st = worst(a, b);
    ctx.strokeStyle = COLORS[st];
    ctx.globalAlpha = st === "bad" ? 0.25 : 0.45;
    ctx.setLineDash(st === "bad" ? [3, 4] : []);
    polyline(pts);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    if (st === "bad" || reduced) return;
    for (const off of [0, 0.5]) {
      const u = (t * 0.25 + off + i * 0.13) % 1;
      const [la, lo, al] = pts[round(u * 48)];
      const [x, y, , vis] = project(la, lo, al);
      if (!vis) continue;
      ctx.fillStyle = "#e9f7ff";
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  });

  // ping rings around the selected node
  for (const k of [0, 0.5]) {
    const ph = reduced ? 0.5 : (t * 0.5 + k) % 1;
    ctx.strokeStyle = COLORS[sel.status];
    ctx.globalAlpha = 1 - ph;
    polyline(ring(sel, 2 + ph * 12), 1);
  }
  ctx.globalAlpha = 1;

  // nodes
  for (const n of NODES) {
    const [x, y, z] = project(n.lat, n.lon);
    n.screen = z > 0 ? [x, y] : null;
    if (!n.screen) continue;
    const c = COLORS[n.status];
    const pulse = reduced ? 0.5 : (t * 0.8 + n.lat) % 1;
    ctx.strokeStyle = c;
    ctx.globalAlpha = (1 - pulse) * 0.8;
    ctx.beginPath();
    ctx.arc(x, y, 4 + pulse * 10, 0, 2 * PI);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    ctx.fillRect(x - 3, y - 3, 6, 6);
    ctx.fillStyle = n === sel || n === hover ? "#ffffff" : "rgba(207,224,232,0.75)";
    ctx.fillText(n.code, x + 8, y - 6);
    if (n === sel) brackets(x, y, 13, c);
  }

  // center reticle
  ctx.strokeStyle = "rgba(207,224,232,0.18)";
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();

  $("view").textContent = `λ ${view.lon.toFixed(1)}°  φ ${view.lat.toFixed(1)}°  ×${view.zoom.toFixed(2)}`;
}

function brackets(x, y, s, c) {
  ctx.strokeStyle = c;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.moveTo(x + dx * s, y + dy * (s - 5));
    ctx.lineTo(x + dx * s, y + dy * s);
    ctx.lineTo(x + dx * (s - 5), y + dy * s);
  }
  ctx.stroke();
  ctx.lineWidth = 1;
}

// ---------- interaction ----------
const ease = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

function flyTo(n) {
  const to = { lon: n.lon, lat: max(-60, min(60, n.lat)) };
  let dl = to.lon - view.lon;
  dl = ((((dl + 180) % 360) + 360) % 360) - 180;
  if (reduced) {
    view.lon += dl;
    view.lat = to.lat;
    return;
  }
  fly = { from: { ...view }, dl, dlat: to.lat - view.lat, t0: performance.now() };
}

function select(n, move = true) {
  sel = n;
  lastInput = performance.now();
  if (move) flyTo(n);
  renderList();
  renderDetail();
}

function nodeAt(x, y) {
  let best = null;
  let bd = 14;
  for (const n of NODES) {
    if (!n.screen) continue;
    const d = hypot(n.screen[0] - x, n.screen[1] - y);
    if (d < bd) [best, bd] = [n, d];
  }
  return best;
}

let drag = null;
wrap.addEventListener("pointerdown", (e) => {
  if (e.target.closest("button")) return;
  drag = { x: e.clientX, y: e.clientY, moved: 0, vx: 0, vy: 0 };
  wrap.setPointerCapture(e.pointerId);
  wrap.classList.add("dragging");
  fly = null;
});
wrap.addEventListener("pointermove", (e) => {
  const b = wrap.getBoundingClientRect();
  const [mx, my] = [e.clientX - b.left, e.clientY - b.top];
  if (drag) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.moved += abs(dx) + abs(dy);
    [drag.x, drag.y] = [e.clientX, e.clientY];
    const k = 1 / (R * view.zoom * D);
    view.lon -= dx * k;
    view.lat = max(-85, min(85, view.lat + dy * k));
    lastInput = performance.now();
  }
  const ll = unproject(mx, my);
  $("cursor").textContent = ll ? `Cursore ${fmtLat(ll[0])} ${fmtLon(ll[1])}` : "Cursore —";
  hover = drag ? null : nodeAt(mx, my);
  const tip = $("tip");
  if (hover) {
    tip.hidden = false;
    tip.innerHTML = `<b>${hover.code}</b> · ${hover.city}<br>${statusText(hover.status)} · ${hover.ms} ms`;
    tip.style.left = `${min(mx + 14, W - 180)}px`;
    tip.style.top = `${my + 14}px`;
  } else tip.hidden = true;
  wrap.style.cursor = hover ? "pointer" : "";
});
wrap.addEventListener("pointerup", (e) => {
  if (!drag) return;
  const b = wrap.getBoundingClientRect();
  if (drag.moved < 5) {
    const n = nodeAt(e.clientX - b.left, e.clientY - b.top);
    if (n) select(n);
  }
  drag = null;
  wrap.classList.remove("dragging");
});
wrap.addEventListener("pointerleave", () => {
  $("tip").hidden = true;
  hover = null;
});
wrap.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    view.zoom = max(0.7, min(2.8, view.zoom * Math.exp(-e.deltaY * 0.0012)));
    lastInput = performance.now();
  },
  { passive: false }
);
$("zin").addEventListener("click", () => (view.zoom = min(2.8, view.zoom * 1.25)));
$("zout").addEventListener("click", () => (view.zoom = max(0.7, view.zoom / 1.25)));
$("rot").addEventListener("click", (e) => {
  auto = !auto;
  e.currentTarget.setAttribute("aria-pressed", String(auto));
});

// ---------- panels ----------
const statusText = (s) => ({ ok: "Online", warn: "Degradato", bad: "Allerta" })[s];
const dms = (v, pos, neg) => {
  const secs = round(abs(v) * 3600); // round once, then split, so 59.6" never prints as 60"
  const d = Math.floor(secs / 3600);
  const m = Math.floor(secs / 60) % 60;
  const s = secs % 60;
  return `${d}°${String(m).padStart(2, "0")}′${String(s).padStart(2, "0")}″${v >= 0 ? pos : neg}`;
};
const fmtLat = (v) => dms(v, "N", "S");
const fmtLon = (v) => dms(v, "E", "W");
let filter = "all";

// The list is built once and updated in place, so keyboard focus survives the ticks
const rows = new Map();
function buildList() {
  $("list").replaceChildren(
    ...NODES.map((n) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML =
        `<i class="dot"></i><span class="c">${n.code}</span><span class="n">${n.city}</span>` +
        `<span class="bars">${[4, 6, 8, 10].map((h) => `<i style="height:${h}px"></i>`).join("")}</span><span class="ms"></span>`;
      b.addEventListener("click", () => select(n));
      li.append(b);
      rows.set(n, li);
      return li;
    })
  );
  $("count").textContent = `· ${NODES.length}`;
}

function renderList() {
  for (const [n, li] of rows) {
    li.hidden = !(filter === "all" || (filter === "online" ? n.status === "ok" : n.status !== "ok"));
    const b = li.firstChild;
    b.setAttribute("aria-current", String(n === sel));
    b.querySelector(".dot").className = `dot ${n.status}`;
    const on = n.status === "bad" ? 0 : 4 - min(3, Math.floor(n.ms / 50));
    b.querySelectorAll(".bars i").forEach((bar, i) => bar.classList.toggle("on", i < on));
    b.querySelector(".ms").textContent = n.status === "bad" ? "—" : `${n.ms}ms`;
  }
}

function renderDetail() {
  const n = sel;
  $("d-code").textContent = n.code;
  $("d-city").textContent = n.city;
  $("d-coord").textContent = `${fmtLat(n.lat)} ${fmtLon(n.lon)}`;
  $("d-role").textContent = n.role;
  $("d-status").innerHTML = `<span class="s-${n.status}">${statusText(n.status)}</span>`;
  $("d-lat").textContent = n.status === "bad" ? "—" : `${n.ms} ms`;
  $("d-up").textContent = n.up;
  $("links").replaceChildren(
    ...LINKS.filter(([a, b]) => a === n || b === n).map(([a, b]) => {
      const o = a === n ? b : a;
      const li = document.createElement("li");
      li.innerHTML = `<b class="s-${worst(a, b)}">${n.code} ⇄ ${o.code}</b><span>${km(a, b).toLocaleString("it-IT")} km</span>`;
      return li;
    })
  );
  renderTime();
  drawSpark();
}

function renderTime() {
  const now = new Date();
  $("utc").textContent = `${now.toISOString().slice(11, 19)}Z`;
  $("date").textContent = now.toISOString().slice(0, 10);
  const solar = new Date(now.getTime() + (sel.lon / 15) * 3600e3);
  $("d-time").textContent = solar.toISOString().slice(11, 16);
}

const spark = $("spark");
const sctx = spark.getContext("2d");
function sizeSpark() {
  spark.width = spark.clientWidth * dpr;
  spark.height = spark.clientHeight * dpr;
}
function drawSpark() {
  const w = spark.clientWidth;
  const h = spark.clientHeight;
  sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  sctx.clearRect(0, 0, w, h);
  const data = sel.hist;
  const top = 1000;
  sctx.strokeStyle = "rgba(120,160,180,0.12)";
  for (let i = 1; i < 4; i++) {
    sctx.beginPath();
    sctx.moveTo(0, (h * i) / 4);
    sctx.lineTo(w, (h * i) / 4);
    sctx.stroke();
  }
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - (v / top) * h]);
  const g = sctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(73,211,255,0.35)");
  g.addColorStop(1, "rgba(73,211,255,0)");
  sctx.fillStyle = g;
  sctx.beginPath();
  sctx.moveTo(0, h);
  pts.forEach(([x, y]) => sctx.lineTo(x, y));
  sctx.lineTo(w, h);
  sctx.fill();
  sctx.strokeStyle = COLORS[sel.status];
  sctx.beginPath();
  pts.forEach(([x, y], i) => (i ? sctx.lineTo(x, y) : sctx.moveTo(x, y)));
  sctx.stroke();
}

// ---------- simulated telemetry ----------
const EVENTS = [
  ["OK", "ok", (n) => `${n.code} handshake completato`],
  ["SYNC", "ok", () => `effemeridi ${SATS[(random() * 3) | 0].name} aggiornate`],
  ["CAL", "ok", (n) => `${n.code} calibrazione sensori completata`],
  ["LINK", "ok", () => {
    const [a, b] = LINKS[(random() * LINKS.length) | 0];
    return `collegamento ${a.code}⇄${b.code} verificato`;
  }],
  ["WARN", "warn", (n) => `${n.code} latenza elevata (${n.ms + 140} ms)`],
  ["ALERT", "bad", (n) => `${n.code} perdita pacchetti ${(2 + random() * 9).toFixed(1)}%`],
];

function log(tag, sev, text) {
  const li = document.createElement("li");
  li.innerHTML = `<time>${new Date().toISOString().slice(11, 19)}Z</time><span class="tag s-${sev}">[${tag}]</span>${text}`;
  const ol = $("log");
  ol.prepend(li);
  while (ol.children.length > 12) ol.lastChild.remove();
}

function tick() {
  for (const n of NODES) {
    n.ms = max(8, min(240, n.ms + round((random() - 0.5) * 14)));
    n.hist.push(n.status === "bad" ? 0 : max(40, min(980, n.hist.at(-1) + (random() - 0.5) * 160)));
    n.hist.shift();
  }
  // now and then a node degrades or recovers
  if (random() < 0.12) {
    const n = NODES[(random() * NODES.length) | 0];
    const next = n.status === "ok" ? (random() < 0.7 ? "warn" : "bad") : "ok";
    n.status = next;
    log(next === "ok" ? "LINK" : next === "warn" ? "WARN" : "ALERT", next, `${n.code} stato → ${statusText(next).toLowerCase()}`);
  } else if (random() < 0.6) {
    const n = NODES[(random() * NODES.length) | 0];
    const pool = n.status === "ok" ? EVENTS.slice(0, 4) : EVENTS;
    const [tag, sev, text] = pool[(random() * pool.length) | 0];
    log(tag, sev, text(n));
  }
  const active = LINKS.filter(([a, b]) => worst(a, b) !== "bad").length;
  $("s-links").textContent = `${active}/${LINKS.length}`;
  $("s-pps").textContent = round(active * (900 + random() * 300)).toLocaleString("it-IT");
  $("s-sat").textContent = SATS.length;
  $("s-alert").textContent = NODES.filter((n) => n.status !== "ok").length;
  renderList();
  renderDetail();
}

// ---------- loop ----------
let last = performance.now();
function frame(now) {
  const dt = min(0.05, (now - last) / 1000);
  last = now;
  if (fly) {
    const u = min(1, (now - fly.t0) / 1300);
    const e = ease(u);
    view.lon = fly.from.lon + fly.dl * e;
    view.lat = fly.from.lat + fly.dlat * e;
    if (u === 1) fly = null;
  } else if (auto && !drag && now - lastInput > 3000) {
    view.lon += dt * 4;
  }
  view.lon = ((((view.lon + 180) % 360) + 360) % 360) - 180;
  draw(now);
  requestAnimationFrame(frame);
}

document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    filter = b.dataset.filter;
    document.querySelectorAll(".tabs button").forEach((o) => o.setAttribute("aria-pressed", String(o === b)));
    renderList();
  })
);
addEventListener("resize", () => {
  resize();
  drawSpark();
});

resize();
buildList();
for (let i = 0; i < 6; i++) tick();
select(sel, false);
setInterval(tick, 1000);
setInterval(renderTime, 1000);
requestAnimationFrame(frame);
