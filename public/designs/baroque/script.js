// Barocco: gilded acanthus volutes grown from a central cartouche.
// Each branch curls along a tightening spiral and ends in a pearl; everything
// is drawn in one quadrant and mirrored four ways around the center.
// Layers: shade (cast shadow), gold (body), hi (specular), composited over velvet.

const cv = document.getElementById("c");
const ctx = cv.getContext("2d");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const MIRRORS = [[1, 1], [-1, 1], [1, -1], [-1, -1]];

let W, H, dpr, s, rand, branches, bg, shade, gold, hi, sheen, metal, motes, bounds, oval;

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function layer() {
  const c = document.createElement("canvas");
  c.width = cv.width;
  c.height = cv.height;
  return c.getContext("2d");
}

// Run fn once per mirrored quadrant with a transform that maps quadrant
// coordinates onto the screen; fn gets the mirror signs for screen-space offsets.
function each(c, fn) {
  for (const [mx, my] of MIRRORS) {
    c.setTransform(dpr * mx, 0, 0, dpr * my, (dpr * W) / 2, (dpr * H) / 2);
    fn(mx, my);
  }
}

function line(c, x1, y1, x2, y2) {
  c.beginPath();
  c.moveTo(x1, y1);
  c.lineTo(x2, y2);
  c.stroke();
}

// Gilded stroke: dark shadow down-right, metal body, thin highlight up-left.
function segment(x1, y1, x2, y2, w) {
  const so = 1.6 * s, ho = -w * 0.22;
  each(shade, (mx, my) => {
    shade.lineWidth = w + 1.5 * s;
    line(shade, x1 + so * mx, y1 + so * 1.4 * my, x2 + so * mx, y2 + so * 1.4 * my);
  });
  each(gold, () => {
    gold.lineWidth = w;
    line(gold, x1, y1, x2, y2);
  });
  each(hi, (mx, my) => {
    hi.lineWidth = Math.max(w * 0.28, 0.5);
    line(hi, x1 + ho * mx, y1 + ho * my, x2 + ho * mx, y2 + ho * my);
  });
}

function pearl(x, y, r) {
  const so = 1.6 * s;
  each(shade, (mx, my) => {
    shade.beginPath();
    shade.arc(x + so * mx, y + so * 1.4 * my, r + s, 0, 7);
    shade.fill();
  });
  each(gold, () => {
    gold.beginPath();
    gold.arc(x, y, r, 0, 7);
    gold.fill();
  });
  each(hi, (mx, my) => {
    hi.beginPath();
    hi.arc(x - r * 0.35 * mx, y - r * 0.35 * my, r * 0.32, 0, 7);
    hi.fill();
  });
}

// Acanthus leaf: a pointed blade sprouting from (x, y) at angle a, curling back.
function leaf(x, y, a, len, bend) {
  const path = (c) => {
    const tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len;
    const n = a + Math.PI / 2, b = len * 0.32;
    const cx = x + Math.cos(a + bend) * len * 0.55, cy = y + Math.sin(a + bend) * len * 0.55;
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(cx + Math.cos(n) * b, cy + Math.sin(n) * b, tx, ty);
    c.quadraticCurveTo(cx - Math.cos(n) * b * 0.6, cy - Math.sin(n) * b * 0.6, x, y);
    return [cx, cy, tx, ty];
  };
  const so = 1.6 * s;
  each(shade, (mx, my) => {
    shade.save();
    shade.translate(so * mx, so * 1.4 * my);
    path(shade);
    shade.fill();
    shade.restore();
  });
  each(gold, () => {
    path(gold);
    gold.fill();
  });
  each(hi, () => {
    const [cx, cy, tx, ty] = path(hi);
    hi.lineWidth = Math.max(0.5, len * 0.05);
    hi.beginPath();
    hi.moveTo(x, y);
    hi.quadraticCurveTo(cx, cy, tx, ty);
    hi.stroke();
  });
}

function branch(x, y, a, k, w, depth) {
  return {
    x, y, a, k, w, depth,
    tight: 1.012 + rand() * 0.014 + depth * 0.004,
    len: 0,
    max: (420 - depth * 80) * (0.6 + rand() * 0.6),
    cool: 12,
  };
}

// Advance one branch by one step; returns false when it has finished.
function step(b, out) {
  const ox = b.x, oy = b.y, v = 2.2 * s;
  b.a += b.k;
  b.k *= b.tight;
  b.x += Math.cos(b.a) * v;
  b.y += Math.sin(b.a) * v;
  b.w *= 0.9965;
  b.len++;
  segment(ox, oy, b.x, b.y, b.w);

  const curl = Math.sign(b.k);
  if (--b.cool <= 0 && b.depth < 3 && b.w > 1.4 * s && rand() < 0.04) {
    b.cool = 14 + rand() * 20;
    // Children sprout off the outside of the curl and curl the other way.
    const a = b.a - curl * (0.5 + rand() * 0.7);
    out.push(branch(b.x, b.y, a, -curl * (0.012 + rand() * 0.03), b.w * (0.5 + rand() * 0.2), b.depth + 1));
  } else if (b.len % 9 === 0 && b.w > 1.1 * s && rand() < 0.7) {
    leaf(b.x, b.y, b.a - curl * (0.9 + rand() * 0.5), b.w * (3 + rand() * 2.5), curl * 0.5);
  }

  // Stay inside the frame and out of the cartouche so the title stays readable.
  const inside = (b.x / oval.rx) ** 2 + (b.y / oval.ry) ** 2 < 1.25;
  const away = inside || b.x > bounds.x || b.y > bounds.y || b.x < -bounds.x || b.y < -bounds.y;
  if (Math.abs(b.k) > 0.45 || b.w < 0.6 * s || b.len > b.max || away) {
    pearl(b.x, b.y, Math.max(b.w * 0.9, 1.2 * s));
    return false;
  }
  return true;
}

function velvet() {
  const c = layer();
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const r = Math.hypot(W, H) / 2;
  const g = c.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);
  g.addColorStop(0, "#6d0f1d");
  g.addColorStop(0.55, "#3a0611");
  g.addColorStop(1, "#0c0106");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // Velvet pile: fine noise of light and dark specks.
  for (let i = 0; i < (W * H) / 40; i++) {
    c.fillStyle = rand() < 0.5 ? "rgba(255,120,140,.035)" : "rgba(0,0,0,.08)";
    c.fillRect(rand() * W, rand() * H, 1, 1);
  }
  return c.canvas;
}

// Cartouche around the title plus an inset frame along the screen edge.
function architecture() {
  const rx = 200 * s, ry = 130 * s, inset = 22 * s;
  const ring = (c, rxx, ryy, w, dx = 0, dy = 0) => {
    c.lineWidth = w;
    c.beginPath();
    c.ellipse(dx, dy, rxx, ryy, 0, 0, 7);
    c.stroke();
  };
  for (const [c, dx, dy] of [[shade, 1.6 * s, 2.2 * s], [gold, 0, 0]]) {
    c.setTransform(dpr, 0, 0, dpr, (dpr * W) / 2, (dpr * H) / 2);
    ring(c, rx, ry, 7 * s, dx, dy);
    ring(c, rx - 13 * s, ry - 13 * s, 2 * s, dx, dy);
    ring(c, rx + 11 * s, ry + 11 * s, 1.5 * s, dx, dy);
    c.lineWidth = 5 * s;
    c.strokeRect(-W / 2 + inset + dx, -H / 2 + inset + dy, W - 2 * inset, H - 2 * inset);
    c.lineWidth = 1.5 * s;
    c.strokeRect(-W / 2 + inset * 1.6 + dx, -H / 2 + inset * 1.6 + dy, W - 3.2 * inset, H - 3.2 * inset);
  }
  hi.setTransform(dpr, 0, 0, dpr, (dpr * W) / 2, (dpr * H) / 2);
  ring(hi, rx, ry, 1.6 * s, -1.5 * s, -1.5 * s);
  // Beads around the cartouche, laid out in one quadrant and mirrored.
  for (let t = 0.04; t < Math.PI / 2; t += 0.13) pearl(Math.cos(t) * (rx + 22 * s), Math.sin(t) * (ry + 22 * s), 3 * s);
  bounds = { x: W / 2 - inset * 2, y: H / 2 - inset * 2 };
  oval = { rx, ry };
}

function init(seed) {
  W = innerWidth;
  H = innerHeight;
  // Keep the backing store bounded: the bento tile renders this page at 4x.
  dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(4e6 / (W * H)));
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  s = Math.min(W, H) / 900;
  rand = mulberry32(seed);

  bg = velvet();
  [shade, gold, hi, sheen] = [layer(), layer(), layer(), layer()];
  // Metal is a radial gradient around the center, so each mirror shares its banding.
  metal = gold.createRadialGradient(0, 0, 0, 0, 0, Math.hypot(W, H) / 2);
  const stops = ["#f6e08a", "#a8761f", "#e9c25a", "#7a4f12", "#f3d67a", "#9b6a1c", "#d9ad48", "#6e4510"];
  stops.forEach((c, i) => metal.addColorStop(i / (stops.length - 1), c));
  for (const c of [shade, gold, hi]) c.lineCap = c.lineJoin = "round";
  shade.fillStyle = shade.strokeStyle = "rgba(15,0,4,.6)";
  gold.fillStyle = gold.strokeStyle = metal;
  hi.fillStyle = hi.strokeStyle = "rgba(255,248,215,.85)";

  architecture();
  const { rx, ry } = oval;
  branches = [];
  const roots = 4 + Math.floor(rand() * 2);
  for (let i = 0; i < roots; i++) {
    const t = ((i + 0.3 + rand() * 0.4) / roots) * (Math.PI / 2);
    const x = Math.cos(t) * (rx + 26 * s), y = Math.sin(t) * (ry + 26 * s);
    const out = Math.atan2(Math.sin(t) / ry, Math.cos(t) / rx);
    const curl = i % 2 ? 1 : -1;
    branches.push(branch(x, y, out - curl * 0.4, curl * (0.003 + rand() * 0.006), (7 + rand() * 4) * s, 0));
  }
  motes = Array.from({ length: 70 }, () => ({ x: rand() * W, y: rand() * H, r: 0.6 + rand() * 1.8, v: 0.1 + rand() * 0.35, p: rand() * 7 }));
  if (reduced) {
    while (branches.length) grow();
    render(0);
  }
}

function grow() {
  const next = [];
  for (const b of branches) if (step(b, next)) next.push(b);
  branches = next;
}

function render(t) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(bg, 0, 0);
  ctx.drawImage(shade.canvas, 0, 0);
  ctx.drawImage(gold.canvas, 0, 0);
  ctx.drawImage(hi.canvas, 0, 0);
  if (reduced) return;

  // A band of light sweeping diagonally across the gold only.
  const k = sheen, w = cv.width, h = cv.height;
  const p = ((t / 6000) % 1) * 2.2 - 0.6;
  k.setTransform(1, 0, 0, 1, 0, 0);
  k.globalCompositeOperation = "source-over";
  k.clearRect(0, 0, w, h);
  k.drawImage(gold.canvas, 0, 0);
  k.globalCompositeOperation = "source-in";
  const g = k.createLinearGradient(w * (p - 0.25), h * (p - 0.25), w * (p + 0.05), h * (p + 0.05));
  g.addColorStop(0, "rgba(255,240,190,0)");
  g.addColorStop(0.5, "rgba(255,240,190,.75)");
  g.addColorStop(1, "rgba(255,240,190,0)");
  k.fillStyle = g;
  k.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "screen";
  ctx.drawImage(k.canvas, 0, 0);

  // Gold dust drifting upward through candlelight.
  ctx.globalCompositeOperation = "lighter";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const m of motes) {
    m.y -= m.v;
    m.x += Math.sin(t / 1800 + m.p) * 0.2;
    if (m.y < -5) m.y = H + 5;
    ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t / 700 + m.p * 3);
    ctx.fillStyle = "#ffd77a";
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function frame(t) {
  for (let i = 0; i < 3 && branches.length; i++) grow();
  render(t);
  requestAnimationFrame(frame);
}

let seed = 1680;
init(seed);
if (!reduced) requestAnimationFrame(frame);
addEventListener("click", () => init(++seed));
let resizeTimer;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => init(seed), 200);
});
