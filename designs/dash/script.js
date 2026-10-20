// Prisma Dash: rendering, audio, input and screens around the engine in game.js.
// Physics runs at a fixed 240 Hz and the picture is interpolated between steps, so
// motion stays smooth at any refresh rate. Every detailed graphic (blocks, spikes,
// orbs, saws, icons, glows) is drawn once into sprite canvases and then blitted.
(() => {
  "use strict";
  const D = window.Dash;
  const preview = new URLSearchParams(location.search).has("preview");
  if (preview) document.body.classList.add("preview");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (id) => document.getElementById(id);
  const canvas = $("c");
  const ctx = canvas.getContext("2d", { alpha: false });
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;

  // ---------- colours ----------
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const THEMES = D.THEMES.map((t) => t.map(hex));
  const mix = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const scale = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
  const ORB_COL = { yellow: "#ffe14d", pink: "#ff6ad5", red: "#ff4d4d", blue: "#4dc3ff", green: "#4dff88", black: "#9a9ab0", dash: "#ff9f1c" };
  const PAD_COL = { yellow: "#ffe14d", pink: "#ff6ad5", red: "#ff4d4d", blue: "#4dc3ff" };
  const PORTAL_COL = { cube: "#4dff88", ship: "#ff6ad5", ball: "#ff9e3d", wave: "#5ff2ff", swing: "#ffe14d", grav: "#4dc3ff", speed: "#ffd23f", tele: "#b388ff" };
  const P1 = "#7dff4f", P2 = "#2ee6ff";

  // ---------- save data ----------
  const KEY = "prisma-dash";
  let save = { best: [0, 0, 0, 0], practice: [0, 0, 0, 0], coins: [[], [], [], []], muted: false };
  try {
    save = Object.assign(save, JSON.parse(localStorage.getItem(KEY)) || {});
  } catch (e) {}
  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(save));
    } catch (e) {}
  };

  // ---------- levels ----------
  const LEVELS = D.LEVELS.map((def) => {
    const L = D.compile(def);
    // neighbour masks so a run of blocks reads as one shape with an outer outline
    const cells = new Set();
    for (const o of L.solids.list)
      if (o.t === "B" && [o.x, o.y, o.w, o.h].every(Number.isInteger))
        for (let i = 0; i < o.w; i++) for (let j = 0; j < o.h; j++) cells.add((o.x + i) * 64 + o.y + j);
    for (const o of L.solids.list) {
      if (o.t !== "B" || ![o.x, o.y, o.w, o.h].every(Number.isInteger)) continue;
      o.cells = [];
      for (let i = 0; i < o.w; i++)
        for (let j = 0; j < o.h; j++) {
          const x = o.x + i, y = o.y + j;
          const m = (cells.has(x * 64 + y + 1) ? 1 : 0) | (cells.has((x + 1) * 64 + y) ? 2 : 0) | (cells.has(x * 64 + y - 1) ? 4 : 0) | (cells.has((x - 1) * 64 + y) ? 8 : 0);
          o.cells.push(x, y, m, (x * 7 + y * 13) % 3);
        }
    }
    return L;
  });
  const DEMOS = (D.DEMOS || []).map((runs) => {
    const bits = [];
    runs.forEach((n, i) => {
      for (let k = 0; k < n; k++) bits.push(i % 2);
    });
    return Uint8Array.from(bits);
  });

  // ---------- sizing and sprites ----------
  let W = 0, H = 0, dpr = 1, S = 40, viewW = 20, viewH = 12;
  const spr = {};
  const glowCache = new Map();

  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w * dpr));
    c.height = Math.max(1, Math.ceil(h * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    return [c, g];
  }

  function glow(color) {
    let c = glowCache.get(color);
    if (c) return c;
    if (glowCache.size > 48) glowCache.clear();
    const n = 96;
    [c] = makeCanvas(n, n);
    const g = c.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    const N = c.width, gr = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    const [r, gg, b] = hex(color);
    gr.addColorStop(0, `rgba(${r},${gg},${b},0.9)`);
    gr.addColorStop(0.25, `rgba(${r},${gg},${b},0.45)`);
    gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, N, N);
    glowCache.set(color, c);
    return c;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // block overlay: shading, circuit detail and the outline on sides without a neighbour
  function blockSprite(mask, variant) {
    const [c, g] = makeCanvas(S, S);
    const sh = g.createLinearGradient(0, 0, 0, S);
    sh.addColorStop(0, "rgba(255,255,255,0.2)");
    sh.addColorStop(0.45, "rgba(255,255,255,0.02)");
    sh.addColorStop(1, "rgba(0,0,0,0.3)");
    g.fillStyle = sh;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = "rgba(255,255,255,0.14)";
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.lineWidth = Math.max(1, S * 0.03);
    const u = S / 10;
    g.beginPath();
    if (variant === 0) {
      roundRect(g, 2.4 * u, 2.4 * u, 5.2 * u, 5.2 * u, u);
      g.stroke();
      g.fillRect(4.6 * u, 4.6 * u, 0.8 * u, 0.8 * u);
    } else if (variant === 1) {
      g.moveTo(1.5 * u, 3 * u);
      g.lineTo(4 * u, 3 * u);
      g.lineTo(6 * u, 5 * u);
      g.lineTo(8.5 * u, 5 * u);
      g.moveTo(3 * u, 8.5 * u);
      g.lineTo(3 * u, 6.5 * u);
      g.lineTo(5 * u, 6.5 * u);
      g.stroke();
      for (const [x, y] of [[1.5, 3], [8.5, 5], [3, 8.5]]) g.fillRect((x - 0.4) * u, (y - 0.4) * u, 0.8 * u, 0.8 * u);
    } else {
      g.moveTo(2 * u, 8 * u);
      g.lineTo(8 * u, 2 * u);
      g.moveTo(5 * u, 8 * u);
      g.lineTo(8 * u, 5 * u);
      g.stroke();
    }
    // bevel and outline on exposed edges (mask bits: 1 up, 2 right, 4 down, 8 left)
    const lw = Math.max(1.5, S * 0.06);
    const edge = (x0, y0, x1, y1, col, w) => {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    };
    if (!(mask & 1)) {
      const hl = g.createLinearGradient(0, 0, 0, S * 0.3);
      hl.addColorStop(0, "rgba(255,255,255,0.28)");
      hl.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = hl;
      g.fillRect(0, 0, S, S * 0.3);
    }
    const o = lw / 2, i = lw * 1.6;
    if (!(mask & 1)) edge(0, o, S, o, "rgba(255,255,255,0.95)", lw), edge(0, i, S, i, "rgba(0,0,0,0.35)", lw * 0.5);
    if (!(mask & 2)) edge(S - o, 0, S - o, S, "rgba(255,255,255,0.85)", lw), edge(S - i, 0, S - i, S, "rgba(0,0,0,0.35)", lw * 0.5);
    if (!(mask & 4)) edge(0, S - o, S, S - o, "rgba(255,255,255,0.75)", lw), edge(0, S - i, S, S - i, "rgba(0,0,0,0.35)", lw * 0.5);
    if (!(mask & 8)) edge(o, 0, o, S, "rgba(255,255,255,0.85)", lw), edge(i, 0, i, S, "rgba(0,0,0,0.35)", lw * 0.5);
    return c;
  }

  function spikeSprite(dir, small) {
    const h = small ? S * 0.5 : S;
    const [c, g] = makeCanvas(S, h);
    if (dir < 0) {
      g.translate(0, h);
      g.scale(1, -1);
    }
    const lw = Math.max(1.5, S * 0.055);
    const tri = (k) => {
      g.beginPath();
      g.moveTo(S * (0.08 + k), h);
      g.lineTo(S * 0.5, h * (0.04 + k * 1.6));
      g.lineTo(S * (0.92 - k), h);
      g.closePath();
    };
    const body = g.createLinearGradient(0, 0, 0, h);
    body.addColorStop(0, "#3a3a46");
    body.addColorStop(1, "#050508");
    tri(0);
    g.fillStyle = body;
    g.fill();
    g.lineJoin = "round";
    g.strokeStyle = "#ffffff";
    g.lineWidth = lw;
    g.stroke();
    tri(0.16);
    const inner = g.createLinearGradient(0, h * 0.3, 0, h);
    inner.addColorStop(0, "rgba(255,255,255,0.28)");
    inner.addColorStop(1, "rgba(255,255,255,0.02)");
    g.fillStyle = inner;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.6)";
    g.lineWidth = lw * 0.5;
    g.stroke();
    return c;
  }

  function orbSprite(color) {
    const n = S * 1.2, [c, g] = makeCanvas(n, n), r = n / 2;
    const core = g.createRadialGradient(r * 0.8, r * 0.7, r * 0.05, r, r, r * 0.62);
    core.addColorStop(0, "#ffffff");
    core.addColorStop(0.35, color);
    core.addColorStop(1, rgb(scale(hex(color), 0.35)));
    g.fillStyle = core;
    g.beginPath();
    g.arc(r, r, r * 0.6, 0, TAU);
    g.fill();
    g.lineWidth = Math.max(1.5, S * 0.06);
    g.strokeStyle = "#ffffff";
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.75)";
    g.beginPath();
    g.ellipse(r * 0.78, r * 0.68, r * 0.18, r * 0.1, -0.6, 0, TAU);
    g.fill();
    return c;
  }

  function sawSprite(rad) {
    const n = rad * 2 * S, [c, g] = makeCanvas(n, n), r = n / 2, teeth = Math.round(10 + rad * 6);
    g.translate(r, r);
    g.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * TAU, b = a + (0.55 / teeth) * TAU;
      g.lineTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
      g.lineTo(Math.cos(b) * r * 0.99, Math.sin(b) * r * 0.99);
    }
    g.closePath();
    const metal = g.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    metal.addColorStop(0, "#f2f4f8");
    metal.addColorStop(0.5, "#9aa1b0");
    metal.addColorStop(1, "#3d4250");
    g.fillStyle = metal;
    g.fill();
    g.strokeStyle = "#1b1d24";
    g.lineWidth = Math.max(1, S * 0.03);
    g.stroke();
    g.beginPath();
    g.arc(0, 0, r * 0.62, 0, TAU);
    g.strokeStyle = "rgba(0,0,0,0.45)";
    g.lineWidth = Math.max(1, S * 0.05);
    g.stroke();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      g.beginPath();
      g.arc(Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, r * 0.09, 0, TAU);
      g.fillStyle = "#2a2d36";
      g.fill();
    }
    const hub = g.createRadialGradient(-r * 0.05, -r * 0.05, 0, 0, 0, r * 0.2);
    hub.addColorStop(0, "#ff8a8a");
    hub.addColorStop(1, "#8a1020");
    g.fillStyle = hub;
    g.beginPath();
    g.arc(0, 0, r * 0.2, 0, TAU);
    g.fill();
    return c;
  }

  function coinSprite() {
    const n = S * 0.9, [c, g] = makeCanvas(n, n), r = n / 2;
    const gold = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r);
    gold.addColorStop(0, "#fffbd0");
    gold.addColorStop(0.45, "#ffd23f");
    gold.addColorStop(1, "#a86a00");
    g.fillStyle = gold;
    g.beginPath();
    g.arc(r, r, r * 0.96, 0, TAU);
    g.fill();
    g.strokeStyle = "#fff3b0";
    g.lineWidth = Math.max(1, S * 0.04);
    g.beginPath();
    g.arc(r, r, r * 0.74, 0, TAU);
    g.stroke();
    g.fillStyle = "#c98a00";
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r * 0.25 : r * 0.55;
      g.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr);
    }
    g.fill();
    return c;
  }

  // player icons, drawn at 2x detail
  function cubeSprite() {
    const [c, g] = makeCanvas(S, S), u = S / 16;
    g.fillStyle = "#0a0a12";
    roundRect(g, 0, 0, S, S, u * 1.6);
    g.fill();
    const body = g.createLinearGradient(0, 0, S, S);
    body.addColorStop(0, "#d4ffb8");
    body.addColorStop(0.35, P1);
    body.addColorStop(1, "#2d9c18");
    g.fillStyle = body;
    roundRect(g, u, u, S - 2 * u, S - 2 * u, u * 1.2);
    g.fill();
    const inner = g.createLinearGradient(0, 4 * u, 0, 12 * u);
    inner.addColorStop(0, "#bdf9ff");
    inner.addColorStop(0.5, P2);
    inner.addColorStop(1, "#0d7e95");
    g.fillStyle = "#0a0a12";
    roundRect(g, 3.4 * u, 3.4 * u, 9.2 * u, 9.2 * u, u);
    g.fill();
    g.fillStyle = inner;
    roundRect(g, 4.2 * u, 4.2 * u, 7.6 * u, 7.6 * u, u * 0.8);
    g.fill();
    // eyes
    g.fillStyle = "#0a0a12";
    g.fillRect(5.2 * u, 5.6 * u, 2 * u, 2.6 * u);
    g.fillRect(8.8 * u, 5.6 * u, 2 * u, 2.6 * u);
    g.fillStyle = "#fff";
    g.fillRect(5.6 * u, 6 * u, 0.8 * u, 0.8 * u);
    g.fillRect(9.2 * u, 6 * u, 0.8 * u, 0.8 * u);
    g.fillStyle = "#0a0a12";
    g.fillRect(6 * u, 9.6 * u, 4 * u, 1 * u);
    // gloss and rivets
    g.fillStyle = "rgba(255,255,255,0.35)";
    roundRect(g, 1.6 * u, 1.4 * u, S - 3.2 * u, 2 * u, u);
    g.fill();
    g.fillStyle = "#0a0a12";
    for (const [x, y] of [[2, 13.2], [13.2, 13.2]]) g.fillRect(x * u, y * u, 0.9 * u, 0.9 * u);
    return c;
  }

  function shipSprite() {
    const w = S * 1.7, h = S * 1.1, [c, g] = makeCanvas(w, h), u = S / 16;
    g.drawImage(spr.cube, w * 0.32, h * 0.02, S * 0.55, S * 0.55);
    g.beginPath();
    g.moveTo(1 * u, 9 * u);
    g.lineTo(6 * u, 6.5 * u);
    g.lineTo(24 * u, 7.5 * u);
    g.lineTo(27 * u, 11 * u);
    g.lineTo(20 * u, 16.5 * u);
    g.lineTo(4 * u, 16.5 * u);
    g.closePath();
    const hull = g.createLinearGradient(0, 6 * u, 0, 17 * u);
    hull.addColorStop(0, "#c8f7ff");
    hull.addColorStop(0.4, P2);
    hull.addColorStop(1, "#0b5d70");
    g.fillStyle = hull;
    g.fill();
    g.lineWidth = Math.max(1.5, u * 1.1);
    g.strokeStyle = "#0a0a12";
    g.stroke();
    g.beginPath();
    g.moveTo(8 * u, 12 * u);
    g.lineTo(22 * u, 12 * u);
    g.lineTo(19 * u, 14.5 * u);
    g.lineTo(9 * u, 14.5 * u);
    g.closePath();
    g.fillStyle = P1;
    g.fill();
    g.stroke();
    g.fillStyle = "rgba(255,255,255,0.4)";
    g.fillRect(7 * u, 7.6 * u, 14 * u, 1.2 * u);
    return c;
  }

  function ballSprite() {
    const [c, g] = makeCanvas(S, S), r = S / 2;
    g.translate(r, r);
    g.beginPath();
    g.arc(0, 0, r * 0.98, 0, TAU);
    g.fillStyle = "#0a0a12";
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, r * 0.86, (i / 4) * TAU, ((i + 1) / 4) * TAU);
      g.closePath();
      g.fillStyle = i % 2 ? P2 : P1;
      g.fill();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.36, 0, TAU);
    g.fillStyle = "#0a0a12";
    g.fill();
    g.beginPath();
    g.arc(0, 0, r * 0.22, 0, TAU);
    g.fillStyle = "#fff";
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.45)";
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.arc(0, 0, r * 0.7, -2.6, -1.6);
    g.stroke();
    return c;
  }

  function waveSprite() {
    const [c, g] = makeCanvas(S * 0.9, S * 0.9), n = S * 0.9;
    g.beginPath();
    g.moveTo(n * 0.98, n * 0.5);
    g.lineTo(n * 0.08, n * 0.06);
    g.lineTo(n * 0.3, n * 0.5);
    g.lineTo(n * 0.08, n * 0.94);
    g.closePath();
    const b = g.createLinearGradient(0, 0, n, n);
    b.addColorStop(0, "#d4ffb8");
    b.addColorStop(1, P1);
    g.fillStyle = b;
    g.fill();
    g.strokeStyle = "#0a0a12";
    g.lineWidth = Math.max(1.5, S * 0.06);
    g.lineJoin = "round";
    g.stroke();
    g.beginPath();
    g.moveTo(n * 0.7, n * 0.5);
    g.lineTo(n * 0.36, n * 0.34);
    g.lineTo(n * 0.36, n * 0.66);
    g.closePath();
    g.fillStyle = P2;
    g.fill();
    return c;
  }

  function swingSprite() {
    const w = S * 1.5, h = S * 1.2, [c, g] = makeCanvas(w, h);
    const wing = (sy) => {
      g.beginPath();
      g.moveTo(w * 0.5, h * 0.5);
      g.quadraticCurveTo(w * 0.15, h * (0.5 + 0.45 * sy), w * 0.02, h * (0.5 + 0.38 * sy));
      g.quadraticCurveTo(w * 0.3, h * (0.5 + 0.12 * sy), w * 0.5, h * 0.5);
      g.fillStyle = P2;
      g.fill();
      g.strokeStyle = "#0a0a12";
      g.lineWidth = Math.max(1.5, S * 0.05);
      g.stroke();
    };
    wing(-1);
    wing(1);
    g.drawImage(spr.cube, w * 0.5 - S * 0.36, h * 0.5 - S * 0.36, S * 0.72, S * 0.72);
    g.beginPath();
    g.arc(w * 0.82, h * 0.5, S * 0.16, 0, TAU);
    g.fillStyle = "#ffe14d";
    g.fill();
    g.stroke();
    return c;
  }

  function groundSprite() {
    const n = S * 2, [c, g] = makeCanvas(n, n);
    const lw = Math.max(1, S * 0.04);
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(0, 0, n, n * 0.5);
    g.strokeStyle = "rgba(255,255,255,0.16)";
    g.lineWidth = lw;
    g.strokeRect(lw, lw, n - 2 * lw, n - 2 * lw);
    g.strokeStyle = "rgba(0,0,0,0.25)";
    g.strokeRect(lw * 3, lw * 3, n - 6 * lw, n - 6 * lw);
    g.strokeStyle = "rgba(255,255,255,0.06)";
    g.beginPath();
    g.moveTo(0, n);
    g.lineTo(n, 0);
    g.stroke();
    return c;
  }

  function resize() {
    W = innerWidth;
    H = innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 2, Math.sqrt(5e6 / (W * H)));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    S = Math.max(14, Math.min(H / 12, W / 18));
    viewW = W / S;
    viewH = H / S;
    glowCache.clear();
    spr.blocks = [];
    for (let m = 0; m < 16; m++) spr.blocks.push([0, 1, 2].map((v) => blockSprite(m, v)));
    spr.spikeUp = spikeSprite(1, false);
    spr.spikeDown = spikeSprite(-1, false);
    spr.smallUp = spikeSprite(1, true);
    spr.smallDown = spikeSprite(-1, true);
    spr.orbs = {};
    for (const k in ORB_COL) spr.orbs[k] = orbSprite(ORB_COL[k]);
    spr.saws = new Map();
    spr.coin = coinSprite();
    spr.cube = cubeSprite();
    spr.ship = shipSprite();
    spr.ball = ballSprite();
    spr.wave = waveSprite();
    spr.swing = swingSprite();
    spr.ground = groundSprite();
    if (cam) cam.snap = true;
  }
  const saw = (r) => {
    let c = spr.saws.get(r);
    if (!c) spr.saws.set(r, (c = sawSprite(r)));
    return c;
  };

  // ---------- audio: a small synth that plays each level's loop ----------
  const SONGS = [
    { root: 57, prog: [0, -4, 3, -2], scale: [0, 3, 7, 10, 12, 15], lead: "square" },
    { root: 50, prog: [0, -2, 3, 5], scale: [0, 3, 5, 7, 10, 12], lead: "sawtooth" },
    { root: 52, prog: [0, -4, 3, -2], scale: [0, 2, 3, 7, 10, 14], lead: "triangle" },
    { root: 48, prog: [0, -4, -9, -2], scale: [0, 1, 3, 7, 8, 12], lead: "sawtooth" },
  ];
  const audio = { ctx: null, master: null, music: null, noise: null, timer: 0, song: null, start: 0, step: 0 };
  const freq = (m) => 440 * 2 ** ((m - 69) / 12);

  function ensureAudio() {
    if (preview) return false;
    if (!audio.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const a = (audio.ctx = new AC());
      audio.master = a.createGain();
      audio.master.gain.value = save.muted ? 0 : 0.5;
      const comp = a.createDynamicsCompressor();
      audio.master.connect(comp).connect(a.destination);
      audio.music = a.createGain();
      audio.music.connect(audio.master);
      const buf = a.createBuffer(1, a.sampleRate, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      audio.noise = buf;
    }
    if (audio.ctx.state === "suspended") audio.ctx.resume();
    return true;
  }

  function tone(type, f, t, dur, vol, dest = audio.music, f2) {
    const a = audio.ctx, o = a.createOscillator(), g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, type, f, dest = audio.music) {
    const a = audio.ctx, s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    s.buffer = audio.noise;
    fl.type = type;
    fl.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.02);
  }

  function playStep(song, bpm, i, t) {
    const s16 = 60 / bpm / 4, bar = Math.floor(i / 16) % 4, k = i % 16;
    const root = song.root + song.prog[bar];
    if (k % 4 === 0) tone("sine", 150, t, 0.28, 0.9, audio.music, 38);
    if (k === 4 || k === 12) noise(t, 0.16, 0.35, "bandpass", 1800);
    if (k % 2 === 1) noise(t, 0.05, 0.12, "highpass", 7000);
    if (k % 2 === 0) tone("sawtooth", freq(root - 24 + (k % 8 === 6 ? 12 : 0)), t, s16 * 1.8, 0.16);
    const note = song.scale[(k * 3 + bar * 2 + (k > 7 ? 1 : 0)) % song.scale.length];
    if (k % 2 === 0 || bar % 2) tone(song.lead, freq(root + 12 + note), t, s16 * 1.4, 0.05);
  }

  function startMusic(def) {
    if (!ensureAudio()) return;
    stopMusic();
    const a = audio.ctx;
    audio.music.gain.cancelScheduledValues(a.currentTime);
    audio.music.gain.setValueAtTime(0.55, a.currentTime);
    audio.song = { song: SONGS[def.song], bpm: def.bpm };
    audio.start = a.currentTime + 0.05;
    audio.step = 0;
    audio.timer = setInterval(() => {
      const s16 = 60 / audio.song.bpm / 4;
      while (audio.start + audio.step * s16 < a.currentTime + 0.12) {
        playStep(audio.song.song, audio.song.bpm, audio.step, audio.start + audio.step * s16);
        audio.step++;
      }
    }, 25);
  }
  function stopMusic() {
    clearInterval(audio.timer);
    audio.timer = 0;
    if (audio.ctx) {
      const t = audio.ctx.currentTime;
      audio.music.gain.cancelScheduledValues(t);
      audio.music.gain.setTargetAtTime(0, t, 0.03);
      // fresh gain so already-scheduled notes fade out without blocking the next song
      audio.music = audio.ctx.createGain();
      audio.music.connect(audio.master);
    }
  }
  function sfx(kind) {
    if (!audio.ctx || save.muted) return;
    const t = audio.ctx.currentTime, m = audio.master;
    if (kind === "die") {
      noise(t, 0.6, 0.8, "lowpass", 900, m);
      tone("square", 220, t, 0.4, 0.2, m, 40);
    } else if (kind === "coin") {
      tone("sine", 1318, t, 0.12, 0.25, m);
      tone("sine", 1975, t + 0.08, 0.25, 0.25, m);
    } else if (kind === "orb") tone("triangle", 880, t, 0.12, 0.18, m, 1400);
    else if (kind === "portal") noise(t, 0.35, 0.25, "bandpass", 1200, m);
    else if (kind === "win") [0, 4, 7, 12, 16].forEach((n, i) => tone("square", freq(72 + n), t + i * 0.09, 0.3, 0.12, m));
  }

  // ---------- particles ----------
  const parts = [];
  const rings = [];
  function emit(x, y, vx, vy, life, size, color, kind = 0, spin = 0) {
    let p = parts.find((q) => q.life <= 0);
    if (!p) {
      if (parts.length > 700) return;
      parts.push((p = {}));
    }
    Object.assign(p, { x, y, vx, vy, life, max: life, size, color, kind, rot: Math.random() * TAU, spin });
  }
  function ring(x, y, r0, r1, life, color, width = 0.12) {
    rings.push({ x, y, r0, r1, life, max: life, color, width });
  }
  function burst(x, y, color, n, speed, size = 0.12, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, v = speed * (0.3 + Math.random() * 0.7);
      emit(x, y, Math.cos(a) * v, Math.sin(a) * v, life * (0.5 + Math.random() * 0.5), size * (0.5 + Math.random()), color, i % 3 ? 0 : 1, (Math.random() - 0.5) * 12);
    }
  }
  function updateParticles(dt) {
    for (const p of parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= (p.kind === 2 ? -2 : 6) * dt;
      p.vx *= 1 - dt * 1.5;
      p.rot += p.spin * dt;
    }
    for (let i = rings.length - 1; i >= 0; i--) if ((rings[i].life -= dt) <= 0) rings.splice(i, 1);
  }

  // ---------- game state ----------
  let li = 0, L = LEVELS[0], st = null, view = "menu", play = "attract";
  let acc = 0, steps = 0, attempts = 1, practice = false, checkpoints = [];
  let deadT = 0, wonT = 0, startT = 0, attemptText = 0;
  let px = 0, py = 0, prevPX = 0, prevPY = 0;
  const cam = { x: 0, y: -2.2, shake: 0, snap: true };
  const look = { rot: 0, wave: [], ceil: 0, flash: 0, dashT: 0 };
  let input = { held: false, tap: false, touches: 0 };
  let previewLevel = 0;

  function begin(fromCheckpoint) {
    if (fromCheckpoint && checkpoints.length) {
      st = D.clone(checkpoints[checkpoints.length - 1].s);
      look.rot = checkpoints[checkpoints.length - 1].rot;
    } else {
      st = D.newState(L);
      look.rot = 0;
      steps = 0;
      if (play !== "attract" && (!practice || !audio.timer)) startMusic(L);
    }
    st.events = [];
    st.held = false;
    acc = 0;
    deadT = wonT = 0;
    look.wave = [];
    look.ceil = st.hi < Infinity ? 1 : 0;
    px = prevPX = st.x;
    py = prevPY = st.y;
    cam.snap = true;
    attemptText = st.x;
  }

  function startLevel(i, how) {
    li = i;
    L = LEVELS[i];
    play = how;
    attempts = 1;
    checkpoints = [];
    if (how === "attract") stopMusic();
    begin(false);
    syncHud();
  }

  // ---------- input ----------
  const isGame = () => view === "game" && play === "player";
  function press() {
    if (!input.held) input.tap = true;
    input.held = true;
  }
  function release() {
    input.held = false;
  }
  addEventListener("keydown", (e) => {
    if (e.repeat && (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW")) return e.preventDefault();
    const k = e.code;
    if (view === "menu") {
      if (k === "ArrowLeft") pick(li - 1);
      else if (k === "ArrowRight") pick(li + 1);
      else if (k === "Space" || k === "Enter") (e.preventDefault(), go("player"));
      else if (k === "KeyM") toggleMute();
      return;
    }
    if (view === "win" && (k === "Space" || k === "Enter")) return (e.preventDefault(), $("next").click());
    if (k === "Escape" || k === "KeyP") return togglePause();
    if (k === "KeyM") return toggleMute();
    if (view !== "game") return;
    if (k === "KeyR" && play === "player") return restart();
    if (k === "KeyZ") return addCheckpoint();
    if (k === "KeyX") return removeCheckpoint();
    if (k === "Space" || k === "ArrowUp" || k === "KeyW") {
      e.preventDefault();
      press();
    }
  });
  addEventListener("keyup", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") release();
  });
  canvas.addEventListener("pointerdown", (e) => {
    if (view !== "game") return;
    e.preventDefault();
    ensureAudio();
    input.touches++;
    press();
  });
  const up = () => {
    input.touches = Math.max(0, input.touches - 1);
    if (!input.touches) release();
  };
  addEventListener("pointerup", up);
  addEventListener("pointercancel", up);
  addEventListener("blur", () => {
    input.held = false;
    input.touches = 0;
    if (view === "game" && play === "player") togglePause(true);
  });

  // ---------- simulation ----------
  function heldNow() {
    if (play !== "player") {
      const bits = DEMOS[li];
      return bits ? bits[Math.floor(steps / 4)] === 1 : false;
    }
    const h = input.held || input.tap;
    input.tap = false;
    return h;
  }

  function simulate(dt) {
    if (!st || view === "pause") return;
    if (st.dead) {
      deadT += dt;
      if (deadT > (practice ? 0.65 : 0.95)) {
        if (play === "player") attempts++;
        begin(practice && play === "player");
      }
      return;
    }
    if (st.won) {
      wonT += dt;
      px += D.SPEEDS[st.speed] * dt * Math.max(0, 1 - wonT);
      if (wonT > 2.2 && play !== "player") {
        if (preview) previewLevel = (previewLevel + 1) % LEVELS.length;
        startLevel(preview ? previewLevel : li, play);
      }
      return;
    }
    acc += dt;
    while (acc >= D.DT && !st.dead && !st.won) {
      prevPX = st.x;
      prevPY = st.y;
      D.step(L, st, heldNow());
      steps++;
      acc -= D.DT;
      if (st.events.length) handle(st.events), (st.events.length = 0);
    }
    const k = st.dead || st.won ? 1 : acc / D.DT;
    px = lerp(prevPX, st.x, k);
    py = lerp(prevPY, st.y, k);
  }

  function handle(evs) {
    for (const e of evs) {
      switch (e.type) {
        case "orb": {
          const o = e.a;
          ring(o.cx, o.cy, 0.4, 1.6, 0.4, ORB_COL[o.kind], 0.14);
          burst(o.cx, o.cy, ORB_COL[o.kind], 10, 6, 0.1, 0.4);
          sfx("orb");
          break;
        }
        case "pad":
          ring(e.a.x + 0.5, e.a.y + (e.a.dir > 0 ? 0.2 : 0.8), 0.2, 1.4, 0.35, PAD_COL[e.a.kind]);
          burst(e.a.x + 0.5, e.a.y + 0.2, PAD_COL[e.a.kind], 12, 7, 0.1, 0.4);
          break;
        case "portal":
          ring(e.a.x + 0.5, e.a.cy, 0.5, 2.5, 0.5, PORTAL_COL[e.a.kind], 0.2);
          look.flash = 0.25;
          if (e.a.kind !== "speed" && e.a.kind !== "grav") look.wave = [];
          if (e.a.kind !== "tele") sfx("portal");
          break;
        case "coin":
          burst(e.a.cx, e.a.cy, "#ffd23f", 18, 6, 0.12, 0.7);
          ring(e.a.cx, e.a.cy, 0.3, 1.8, 0.5, "#ffd23f");
          sfx("coin");
          break;
        case "jump":
        case "flip":
          burst(st.x - 0.3, st.y - 0.5 * -st.grav, "#ffffff", 4, 2, 0.07, 0.25);
          break;
        case "die":
          onDeath();
          break;
        case "win":
          onWin();
          break;
      }
    }
  }

  function percent() {
    return clamp(Math.floor((st.x / L.end) * 100), 0, 100);
  }

  function onDeath() {
    burst(st.x, st.y, P1, 26, 11, 0.2, 0.9);
    burst(st.x, st.y, P2, 18, 8, 0.15, 0.8);
    ring(st.x, st.y, 0.3, 3.2, 0.5, "#ffffff", 0.18);
    if (!reduced) cam.shake = 0.45;
    look.flash = 0.35;
    sfx("die");
    if (play !== "player") return;
    if (!practice) stopMusic();
    const p = percent();
    const key = practice ? "practice" : "best";
    if (p > save[key][li]) {
      save[key][li] = p;
      persist();
      if (!practice) badge(`Nuovo record: ${p}%`);
    }
  }

  function onWin() {
    sfx("win");
    for (let i = 0; i < 4; i++) setTimeout(() => burst(L.end + 1 + Math.random() * 3, 3 + Math.random() * 5, ["#ffe14d", "#ff6ad5", "#5ff2ff", "#7dff4f"][i], 30, 9, 0.14, 1), i * 220);
    if (play !== "player") return;
    stopMusic();
    const key = practice ? "practice" : "best";
    save[key][li] = 100;
    if (!practice) {
      L.objs.forEach((o) => {
        if (o.t === "K" && st.used[o.id]) save.coins[li][L.objs.filter((k) => k.t === "K").indexOf(o)] = true;
      });
    }
    persist();
    setTimeout(showWin, 1500);
  }

  function restart() {
    attempts++;
    checkpoints = practice ? checkpoints : [];
    begin(false);
  }

  function addCheckpoint() {
    if (!practice || play !== "player" || !st || st.dead || st.won) return;
    checkpoints.push({ s: D.clone(st), rot: look.rot });
    ring(st.x, st.y, 0.3, 1.4, 0.4, "#7dffb2");
  }
  function removeCheckpoint() {
    if (practice) checkpoints.pop();
  }

  // ---------- camera ----------
  function updateCamera(dt) {
    const k = cam.snap ? 1 : 1 - Math.exp(-dt * 6);
    cam.x = px - viewW * 0.32;
    let ty;
    if (st.hi < Infinity) {
      const mid = (st.lo + st.hi) / 2;
      ty = Math.max(-2.2, mid - viewH / 2);
      if (st.hi - st.lo > viewH - 2) ty = clamp(py - viewH / 2, st.lo - 1.5, st.hi + 1.5 - viewH);
    } else {
      ty = cam.y;
      if (py > cam.y + viewH * 0.65) ty = py - viewH * 0.65;
      else if (py < cam.y + viewH * 0.3) ty = py - viewH * 0.3;
      ty = Math.max(-2.2, ty);
    }
    cam.y = lerp(cam.y, ty, k);
    cam.snap = false;
    cam.shake = Math.max(0, cam.shake - dt);
  }

  // ---------- rendering ----------
  let pal, t = 0, beat = 0;
  const X = (wx) => (wx - cam.x) * S;
  const Y = (wy) => H - (wy - cam.y) * S;
  const snapX = (wx) => Math.round(X(wx) * dpr) / dpr;
  const snapY = (wy) => Math.round(Y(wy) * dpr) / dpr;

  function palette() {
    const ts = L.themes;
    let i = 0;
    while (i + 1 < ts.length && ts[i + 1].x <= px) i++;
    const cur = THEMES[ts[i] ? ts[i].i : 0];
    if (!i) return cur;
    const prev = THEMES[ts[i - 1].i], k = clamp((px - ts[i].x) / 5, 0, 1);
    return cur.map((c, j) => mix(prev[j], c, k));
  }

  // background layers, deterministic from the world position
  const FAR = Array.from({ length: 9 }, (_, i) => ({ x: i * 7.3 + ((i * 37) % 5), y: 2 + ((i * 53) % 9), s: 1.6 + ((i * 29) % 4), r: i * 0.7 }));
  const HILLS = Array.from({ length: 33 }, (_, i) => 1.5 + Math.abs(Math.sin(i * 1.7) * 3.2 + Math.sin(i * 0.6) * 2));
  const TOWERS = Array.from({ length: 14 }, (_, i) => ({ x: i * 4.6 + ((i * 17) % 3), w: 1.6 + ((i * 7) % 3) * 0.6, h: 3 + ((i * 31) % 6) }));
  const BOKEH = Array.from({ length: 36 }, (_, i) => ({ x: (i * 7.77) % 60, y: (i * 3.31) % 14, s: 0.2 + ((i * 13) % 7) * 0.08, p: i }));

  // screen y of a world height on a layer that follows the camera by factor f
  const Yp = (wy, f) => H - (wy - cam.y * f + 2.2 * (1 - f)) * S;

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, rgb(pal[0]));
    sky.addColorStop(1, rgb(pal[1]));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // far: slowly turning outlined squares
    ctx.lineWidth = Math.max(1, S * 0.06);
    const fx = cam.x * 0.08, rep = 66;
    for (const f of FAR) {
      const wx = ((f.x - fx) % rep + rep) % rep - 3;
      const sx = wx * S * 0.9, sy = Yp(f.y * 0.7, 0.1);
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(f.r + t * 0.05);
      ctx.fillStyle = rgb(pal[3], 0.035);
      ctx.strokeStyle = rgb(pal[3], 0.11 + beat * 0.05);
      ctx.fillRect((-f.s * S) / 2, (-f.s * S) / 2, f.s * S, f.s * S);
      ctx.strokeRect((-f.s * S) / 2, (-f.s * S) / 2, f.s * S, f.s * S);
      ctx.restore();
    }

    // bokeh motes
    ctx.globalCompositeOperation = "lighter";
    const gl = glow(rgbHex(pal[3]));
    for (const b of BOKEH) {
      const wx = ((b.x - cam.x * 0.18 + t * 0.15) % 60 + 60) % 60;
      const sx = (wx / 60) * (W + 80) - 40, sy = Yp(b.y * 0.8 + Math.sin(t * 0.4 + b.p) * 0.3, 0.15);
      const r = b.s * S * (1 + beat * 0.3);
      ctx.globalAlpha = 0.25;
      ctx.drawImage(gl, sx - r, sy - r, r * 2, r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    // hills
    const hx = cam.x * 0.3;
    ctx.beginPath();
    ctx.moveTo(0, H);
    const step = 3;
    for (let i = -1; i <= Math.ceil(viewW / (step * 0.7)) + 2; i++) {
      const wi = Math.floor(hx / step) + i;
      const h = HILLS[((wi % HILLS.length) + HILLS.length) % HILLS.length];
      const sx = (wi * step - hx) * S * 0.7;
      ctx.lineTo(sx, Yp(h * 0.7, 0.3));
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = rgb(mix(pal[1], pal[2], 0.45), 0.7);
    ctx.fill();
    ctx.strokeStyle = rgb(pal[3], 0.22);
    ctx.lineWidth = Math.max(1, S * 0.04);
    ctx.stroke();

    // towers with lit windows
    const tx = cam.x * 0.55, trep = 66;
    ctx.fillStyle = rgb(mix(pal[2], pal[1], 0.25), 0.85);
    for (const tw of TOWERS) {
      const wx = ((tw.x - tx) % trep + trep) % trep - 3;
      const sx = wx * S * 0.85;
      if (sx > W || sx + tw.w * S < 0) continue;
      const top = Yp(tw.h * 0.85, 0.55);
      ctx.fillRect(sx, top, tw.w * S * 0.85, H - top);
    }
    ctx.fillStyle = rgb(pal[3], 0.22 + beat * 0.15);
    for (const tw of TOWERS) {
      const wx = ((tw.x - tx) % trep + trep) % trep - 3;
      const sx = wx * S * 0.85, wS = S * 0.85;
      if (sx > W || sx + tw.w * S < 0) continue;
      for (let r = 1; r < tw.h; r += 1.2)
        for (let c = 0.3; c < tw.w - 0.3; c += 0.7)
          if ((r * 7 + c * 13 + tw.x) % 3 < 1.4) ctx.fillRect(sx + c * wS, Yp(r * 0.85, 0.55), wS * 0.25, wS * 0.3);
    }
    if (beat > 0.01) {
      ctx.fillStyle = rgb(pal[3], beat * 0.05);
      ctx.fillRect(0, 0, W, H);
    }
  }
  // quantised so blending themes reuses a handful of cached glows
  const rgbHex = (c) => "#" + c.map((v) => Math.min(255, Math.round(v / 24) * 24).toString(16).padStart(2, "0").slice(-2)).join("");

  function drawGround(level, flip, alpha) {
    // level: world y of the surface; flip: true for a ceiling
    ctx.globalAlpha = alpha;
    const sy = snapY(level);
    const y0 = flip ? 0 : sy, y1 = flip ? sy : H;
    if (y1 <= y0) return (ctx.globalAlpha = 1);
    const g = ctx.createLinearGradient(0, sy, 0, flip ? sy - S * 3 : sy + S * 3);
    g.addColorStop(0, rgb(pal[2]));
    g.addColorStop(1, rgb(scale(pal[2], 0.45)));
    ctx.fillStyle = g;
    ctx.fillRect(0, y0, W, y1 - y0);
    const n = S * 2, ox = -((cam.x * S) % n + n) % n;
    for (let x = ox; x < W; x += n)
      for (let r = 0; r < 3; r++) {
        const yy = flip ? sy - (r + 1) * n : sy + r * n;
        if (yy > H || yy + n < 0) continue;
        ctx.drawImage(spr.ground, x, yy, n, n);
      }
    // glowing edge line
    ctx.globalCompositeOperation = "lighter";
    const gl = ctx.createLinearGradient(0, sy, 0, flip ? sy + S * 1.4 : sy - S * 1.4);
    gl.addColorStop(0, rgb(pal[3], 0.38 + beat * 0.2));
    gl.addColorStop(1, rgb(pal[3], 0));
    ctx.fillStyle = gl;
    ctx.fillRect(0, flip ? sy : sy - S * 1.4, W, S * 1.4);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgb(mix(pal[3], [255, 255, 255], 0.5));
    ctx.fillRect(0, sy - Math.max(1, S * 0.04), W, Math.max(2, S * 0.08));
    ctx.globalAlpha = 1;
  }

  function drawSolids(x0, x1) {
    const base = rgb(pal[4]);
    D.query(L.solids, x0, x1, (o) => {
      if (o.t === "B" && o.cells) {
        ctx.fillStyle = base;
        const c = o.cells;
        for (let i = 0; i < c.length; i += 4) {
          const cx = c[i];
          if (cx + 1 < x0 || cx > x1) continue;
          const ax = snapX(cx), bx = snapX(cx + 1), ay = snapY(c[i + 1] + 1), by = snapY(c[i + 1]);
          ctx.fillRect(ax, ay, bx - ax, by - ay);
          ctx.drawImage(spr.blocks[c[i + 2]][c[i + 3]], ax, ay, bx - ax, by - ay);
        }
        return;
      }
      if (o.t === "C") {
        let fall = 0, a = 1;
        const tt = st.crumble[o.id];
        if (tt >= 0) {
          const k = st.t - tt - 0.2;
          if (k > 0) (fall = 0.5 * 30 * k * k), (a = clamp(1 - k * 1.5, 0, 1));
          else fall = Math.sin(st.t * 80) * 0.03;
        }
        if (a <= 0) return;
        ctx.globalAlpha = a;
        const ax = X(o.x), ay = Y(o.y + 1 - fall);
        ctx.fillStyle = rgb(mix(pal[4], pal[5], 0.35));
        ctx.fillRect(ax, ay, S, S);
        ctx.drawImage(spr.blocks[0][2], ax, ay, S, S);
        ctx.strokeStyle = "rgba(0,0,0,0.5)";
        ctx.lineWidth = Math.max(1, S * 0.04);
        ctx.beginPath();
        ctx.moveTo(ax + S * 0.2, ay + S * 0.25);
        ctx.lineTo(ax + S * 0.45, ay + S * 0.5);
        ctx.lineTo(ax + S * 0.35, ay + S * 0.8);
        ctx.moveTo(ax + S * 0.45, ay + S * 0.5);
        ctx.lineTo(ax + S * 0.75, ay + S * 0.42);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      // movers and fractional blocks
      const y = o.t === "M" ? D.moverY(o, st.t) : o.y;
      const ax = X(o.x), ay = Y(y + o.h), w = o.w * S, h = o.h * S;
      if (o.t === "M") {
        ctx.strokeStyle = rgb(pal[3], 0.35);
        ctx.setLineDash([S * 0.15, S * 0.15]);
        ctx.lineWidth = Math.max(1, S * 0.04);
        ctx.beginPath();
        ctx.moveTo(ax + w / 2, Y(o.y - o.amp));
        ctx.lineTo(ax + w / 2, Y(o.y + o.amp + o.h));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = rgb(mix(pal[4], pal[3], 0.25));
      } else ctx.fillStyle = base;
      ctx.fillRect(ax, ay, w, h);
      ctx.drawImage(spr.blocks[0][1], ax, ay, w, h);
      if (o.t === "M") {
        ctx.fillStyle = rgb(pal[5], 0.9);
        for (let i = 0.5; i < o.w; i += 1) {
          ctx.beginPath();
          ctx.moveTo(ax + i * S - S * 0.15, ay + h * 0.5);
          ctx.lineTo(ax + i * S, ay + h * 0.25);
          ctx.lineTo(ax + i * S + S * 0.15, ay + h * 0.5);
          ctx.lineTo(ax + i * S, ay + h * 0.75);
          ctx.fill();
        }
      }
    });
  }

  function drawHazards(x0, x1) {
    D.query(L.hazards, x0, x1, (o) => {
      if (o.t === "S") {
        const img = o.small ? (o.dir > 0 ? spr.smallUp : spr.smallDown) : o.dir > 0 ? spr.spikeUp : spr.spikeDown;
        const h = o.small ? 0.5 : 1;
        const by = o.dir > 0 ? o.y + h : o.y + 1;
        ctx.drawImage(img, X(o.x), Y(by), S, h * S);
      } else if (o.t === "W") {
        const [cx, cy] = D.sawPos(o, st.t);
        const img = saw(o.r), sx = X(cx), sy = Y(cy), r = o.r * S;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.35;
        ctx.drawImage(glow("#ff4d6d"), sx - r * 1.6, sy - r * 1.6, r * 3.2, r * 3.2);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        const a = -st.t * 9;
        ctx.setTransform(dpr * Math.cos(a), dpr * Math.sin(a), -dpr * Math.sin(a), dpr * Math.cos(a), dpr * (sx + shakeX), dpr * (sy + shakeY));
        ctx.drawImage(img, -r, -r, r * 2, r * 2);
        ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);
      } else if (o.t === "L") {
        const on = D.laserOn(o, st.t);
        const ph = ((st.t / o.period + o.ph) % 1 + 1) % 1;
        const warn = !on && ph > 1 - 0.3 / o.period;
        const cx = X(o.x + 0.5), ya = Y(o.y1), yb = Y(o.y0);
        // emitters
        ctx.fillStyle = "#2a2d36";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, S * 0.04);
        for (const yy of [ya, yb]) {
          ctx.fillRect(cx - S * 0.3, yy - S * 0.12, S * 0.6, S * 0.24);
          ctx.strokeRect(cx - S * 0.3, yy - S * 0.12, S * 0.6, S * 0.24);
        }
        if (on) {
          ctx.globalCompositeOperation = "lighter";
          const flick = 0.85 + Math.sin(st.t * 60) * 0.15;
          ctx.fillStyle = `rgba(255,60,90,${0.35 * flick})`;
          ctx.fillRect(cx - S * 0.35, ya, S * 0.7, yb - ya);
          ctx.fillStyle = `rgba(255,120,140,${0.6 * flick})`;
          ctx.fillRect(cx - S * 0.14, ya, S * 0.28, yb - ya);
          ctx.fillStyle = "#fff";
          ctx.fillRect(cx - S * 0.04, ya, S * 0.08, yb - ya);
          ctx.globalCompositeOperation = "source-over";
        } else if (warn && Math.sin(st.t * 50) > 0) {
          ctx.fillStyle = "rgba(255,80,100,0.45)";
          ctx.fillRect(cx - 1, ya, 2, yb - ya);
        }
      }
    });
  }

  function drawTriggers(x0, x1) {
    D.query(L.triggers, x0, x1, (o) => {
      if (o.t === "K") {
        if (st.used[o.id]) return;
        const sx = X(o.cx), sy = Y(o.cy + Math.sin(st.t * 3 + o.cx) * 0.12), r = S * 0.45;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.5;
        ctx.drawImage(glow("#ffd23f"), sx - r * 2.2, sy - r * 2.2, r * 4.4, r * 4.4);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        const w = Math.abs(Math.cos(st.t * 2.5 + o.cx));
        ctx.drawImage(spr.coin, sx - r * Math.max(0.12, w), sy - r, r * 2 * Math.max(0.12, w), r * 2);
      } else if (o.t === "O") {
        const used = st.used[o.id];
        const sx = X(o.cx), sy = Y(o.cy), col = ORB_COL[o.kind];
        const pulse = 1 + beat * 0.12 + (used ? 0.25 : 0);
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = used ? 0.25 : 0.55;
        ctx.drawImage(glow(col), sx - S * 1.2, sy - S * 1.2, S * 2.4, S * 2.4);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        const n = S * 1.2 * pulse;
        ctx.drawImage(spr.orbs[o.kind], sx - n / 2, sy - n / 2, n, n);
        ctx.strokeStyle = col;
        ctx.lineWidth = Math.max(1.5, S * 0.06);
        const a = st.t * 3;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(sx, sy, S * 0.62 * pulse, a + (i * TAU) / 3, a + (i * TAU) / 3 + 1.1);
          ctx.stroke();
        }
        if (o.kind === "dash") {
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.moveTo(sx + S * 0.2, sy);
          ctx.lineTo(sx - S * 0.12, sy - S * 0.18);
          ctx.lineTo(sx - S * 0.12, sy + S * 0.18);
          ctx.fill();
        }
      } else if (o.t === "P") {
        const col = PAD_COL[o.kind], sx = X(o.x + 0.5), sy = Y(o.dir > 0 ? o.y : o.y + 1), d = o.dir > 0 ? -1 : 1;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = 0.6 + beat * 0.3;
        ctx.drawImage(glow(col), sx - S * 0.7, sy - S * 0.7, S * 1.4, S * 1.4);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(sx, sy, S * 0.42, S * 0.22, 0, d < 0 ? Math.PI : 0, d < 0 ? TAU : Math.PI);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = Math.max(1, S * 0.04);
        ctx.stroke();
        ctx.fillStyle = "#1a1a24";
        ctx.fillRect(sx - S * 0.48, sy - (d < 0 ? S * 0.06 : 0), S * 0.96, S * 0.06);
      } else if (o.t === "G") drawPortal(o);
    });
  }

  function drawPortal(o) {
    const col = PORTAL_COL[o.kind], sx = X(o.x + 0.5), sy = Y(o.cy), h = o.h * S * 0.5, w = S * 0.55;
    const used = st.used[o.id];
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.45 + beat * 0.2;
    ctx.drawImage(glow(col), sx - w * 2, sy - h * 1.2, w * 4, h * 2.4);
    ctx.globalAlpha = 1;
    // energy flowing into the ring
    for (let i = 0; i < 6; i++) {
      const k = ((st.t * 0.9 + i / 6) % 1);
      ctx.fillStyle = rgb(hex(col), (1 - k) * 0.8);
      const yy = sy + Math.sin(i * 2.1) * h * 0.8;
      ctx.fillRect(sx - w * 2.5 + k * w * 2.5, yy, S * 0.12, S * 0.12);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.lineWidth = Math.max(2, S * 0.1);
    ctx.strokeStyle = "#0a0a12";
    ctx.beginPath();
    ctx.ellipse(sx, sy, w, h, 0, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = Math.max(1.5, S * 0.07);
    ctx.strokeStyle = col;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = Math.max(1, S * 0.03);
    ctx.beginPath();
    ctx.ellipse(sx, sy, w * 0.62, h * 0.86, 0, 0, TAU);
    ctx.stroke();
    // symbol
    ctx.fillStyle = used ? "rgba(255,255,255,0.5)" : "#fff";
    ctx.strokeStyle = "#fff";
    const u = S * 0.22;
    ctx.beginPath();
    switch (o.kind) {
      case "cube":
        ctx.rect(sx - u, sy - u, 2 * u, 2 * u);
        break;
      case "ship":
        ctx.moveTo(sx + u * 1.3, sy);
        ctx.lineTo(sx - u, sy - u);
        ctx.lineTo(sx - u * 0.5, sy);
        ctx.lineTo(sx - u, sy + u);
        break;
      case "ball":
        ctx.arc(sx, sy, u, 0, TAU);
        break;
      case "wave":
        ctx.moveTo(sx - u, sy + u * 0.6);
        ctx.lineTo(sx - u * 0.3, sy - u * 0.6);
        ctx.lineTo(sx + u * 0.3, sy + u * 0.6);
        ctx.lineTo(sx + u, sy - u * 0.6);
        ctx.lineWidth = u * 0.4;
        ctx.stroke();
        ctx.beginPath();
        break;
      case "swing":
        ctx.ellipse(sx, sy, u * 1.2, u * 0.5, 0, 0, TAU);
        break;
      case "grav": {
        const d = o.arg === "up" ? -1 : o.arg === "down" ? 1 : 0;
        if (d) {
          ctx.moveTo(sx, sy + d * u * 1.2);
          ctx.lineTo(sx - u, sy - d * u * 0.2);
          ctx.lineTo(sx + u, sy - d * u * 0.2);
        } else ctx.arc(sx, sy, u * 0.8, 0, TAU);
        break;
      }
      case "speed":
        for (let i = 0; i <= o.arg; i++) {
          const ox = sx - u + i * u * 0.7;
          ctx.moveTo(ox, sy - u);
          ctx.lineTo(ox + u * 0.6, sy);
          ctx.lineTo(ox, sy + u);
        }
        ctx.lineWidth = u * 0.35;
        ctx.stroke();
        ctx.beginPath();
        break;
      case "tele":
        ctx.arc(sx, sy, u * 0.9, 0, TAU);
        ctx.moveTo(sx + u * 0.5, sy);
        ctx.arc(sx, sy, u * 0.5, 0, TAU, true);
        // exit marker at the destination height
        ctx.fill("evenodd");
        ctx.beginPath();
        ctx.setLineDash([S * 0.1, S * 0.12]);
        ctx.strokeStyle = rgb(hex(col), 0.6);
        ctx.lineWidth = Math.max(1, S * 0.04);
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + S, Y(o.arg));
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.ellipse(sx + S, Y(o.arg), w * 0.6, S * 0.9, 0, 0, TAU);
        ctx.strokeStyle = col;
        ctx.stroke();
        ctx.beginPath();
        break;
    }
    ctx.fill();
  }

  function drawEnd() {
    const sx = X(L.end + 1);
    if (sx > W + S * 4) return;
    ctx.globalCompositeOperation = "lighter";
    const g = ctx.createLinearGradient(sx - S * 3, 0, sx + S, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(1, rgb(pal[3], 0.55 + beat * 0.3));
    ctx.fillStyle = g;
    ctx.fillRect(sx - S * 3, 0, S * 4, H);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "#fff";
    ctx.fillRect(sx, 0, Math.max(2, S * 0.12), H);
    for (let i = 0; i < 8; i++) {
      const yy = ((t * 2 + i / 8) % 1) * H;
      ctx.fillStyle = rgb(pal[5], 0.8);
      ctx.beginPath();
      ctx.moveTo(sx + S * 0.4, yy);
      ctx.lineTo(sx + S * 0.8, yy + S * 0.3);
      ctx.lineTo(sx + S * 0.4, yy + S * 0.6);
      ctx.fill();
    }
  }

  function drawPlayer(dt) {
    if (st.dead) return;
    const sx = X(px), sy = Y(py), flip = st.grav > 0 ? -1 : 1;
    const v = D.SPEEDS[st.speed];
    let img, w = S, h = S, angle = 0;
    // trails and exhaust
    if (st.mode === "wave") {
      look.wave.push(px, py);
      if (look.wave.length > 120) look.wave.splice(0, 2);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineJoin = "round";
      for (const [lw, a] of [[S * 0.42, 0.18], [S * 0.18, 0.55], [S * 0.06, 1]]) {
        ctx.strokeStyle = a === 1 ? "#fff" : rgb(hex(P2), a);
        ctx.lineWidth = lw;
        ctx.beginPath();
        for (let i = 0; i < look.wave.length; i += 2) ctx.lineTo(X(look.wave[i]), Y(look.wave[i + 1]));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }
    if (st.dash) {
      look.dashT += dt;
      for (let i = 0; i < 2; i++) emit(px - 0.4, py + (Math.random() - 0.5) * 0.8, -v * 0.4, 0, 0.3, 0.14, "#ff9f1c", 2);
    }
    if (st.grounded && st.mode === "cube" && Math.random() < dt * 30)
      emit(px - 0.45, py - 0.5 * flip, -2 - Math.random() * 2, flip * (1 + Math.random() * 2), 0.35, 0.08, rgb(pal[3]), 1);
    if ((st.mode === "ship" || st.mode === "swing") && Math.random() < dt * 60)
      emit(px - 0.7, py - 0.15 * flip, -4 - Math.random() * 3, (Math.random() - 0.5) * 2, 0.3, st.held ? 0.18 : 0.1, st.held ? "#ffb347" : "#ff6a3d", 2);

    switch (st.mode) {
      case "cube": {
        if (st.grounded) look.rot = lerp(look.rot, Math.round(look.rot / 90) * 90, 1 - Math.exp(-dt * 30));
        else look.rot += 400 * dt * flip;
        img = spr.cube;
        angle = (look.rot * Math.PI) / 180;
        break;
      }
      case "ship":
      case "swing":
        img = st.mode === "ship" ? spr.ship : spr.swing;
        w = st.mode === "ship" ? S * 1.7 : S * 1.5;
        h = st.mode === "ship" ? S * 1.1 : S * 1.2;
        angle = -Math.atan2(st.vy, v) * 0.7;
        break;
      case "ball":
        look.rot += (v / 0.5) * dt * 57 * flip;
        img = spr.ball;
        angle = (look.rot * Math.PI) / 180;
        break;
      case "wave":
        img = spr.wave;
        w = h = S * 0.9;
        angle = st.vy > 0.1 ? -Math.PI / 4 : st.vy < -0.1 ? Math.PI / 4 : 0;
        break;
    }
    const c = Math.cos(angle), s = Math.sin(angle);
    ctx.setTransform(dpr * c, dpr * s, -dpr * s * flip, dpr * c * flip, dpr * (sx + shakeX), dpr * (sy + shakeY));
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);
    if (st.dash) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.6;
      ctx.drawImage(glow("#ff9f1c"), sx - S, sy - S, S * 2, S * 2);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function drawParticles() {
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      if (p.life <= 0) continue;
      const a = p.life / p.max, sx = X(p.x), sy = Y(p.y), r = p.size * S;
      ctx.globalAlpha = a;
      if (p.kind === 2) ctx.drawImage(glow(p.color.startsWith("#") ? p.color : "#ffffff"), sx - r * 2, sy - r * 2, r * 4, r * 4);
      else {
        ctx.fillStyle = p.color;
        if (p.kind === 1) ctx.fillRect(sx - r / 2, sy - r / 2, r, r);
        else {
          ctx.save();
          ctx.translate(sx, sy);
          ctx.rotate(p.rot);
          ctx.fillRect(-r / 2, -r / 2, r, r);
          ctx.restore();
        }
      }
    }
    for (const rg of rings) {
      const k = 1 - rg.life / rg.max;
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = rg.width * S * (1 - k);
      ctx.beginPath();
      ctx.arc(X(rg.x), Y(rg.y), lerp(rg.r0, rg.r1, k) * S, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function drawWorldText() {
    if (play === "attract") return;
    const sx = X(attemptText + 5);
    if (sx < -W) return;
    ctx.font = `${Math.round(S * 0.9)}px "Russo One", sans-serif`;
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = S * 0.16;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.fillStyle = "#fff";
    const txt = play === "demo" ? "Demo automatica" : `Tentativo ${attempts}`;
    ctx.strokeText(txt, sx, Y(6.5));
    ctx.fillText(txt, sx, Y(6.5));
    // checkpoints
    for (const cp of checkpoints) {
      const cx = X(cp.s.x), cy = Y(cp.s.y);
      ctx.fillStyle = "#7dffb2";
      ctx.beginPath();
      ctx.moveTo(cx, cy - S * 0.35);
      ctx.lineTo(cx + S * 0.25, cy);
      ctx.lineTo(cx, cy + S * 0.35);
      ctx.lineTo(cx - S * 0.25, cy);
      ctx.fill();
    }
  }

  let shakeX = 0, shakeY = 0;
  function render(dt) {
    pal = palette();
    const bp = ((st.t * L.bpm) / 60) % 1;
    beat = reduced ? 0 : Math.exp(-bp * 7);
    shakeX = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * S * 0.8 : 0;
    shakeY = cam.shake > 0 ? (Math.random() - 0.5) * cam.shake * S * 0.8 : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawBackground();
    ctx.setTransform(dpr, 0, 0, dpr, shakeX * dpr, shakeY * dpr);
    const x0 = cam.x - 2, x1 = cam.x + viewW + 2;
    // ceiling of the flying modes slides in
    look.ceil = lerp(look.ceil, st.hi < Infinity ? 1 : 0, 1 - Math.exp(-dt * 8));
    drawEnd();
    drawTriggers(x0, x1);
    drawSolids(x0, x1);
    drawHazards(x0, x1);
    drawGround(0, false, 1);
    if (look.ceil > 0.02 && st.hi < Infinity) drawGround(st.hi, true, look.ceil);
    if (st.lo > 0 && st.hi < Infinity) drawGround(st.lo, false, look.ceil);
    drawWorldText();
    drawPlayer(dt);
    drawParticles();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (look.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${reduced ? 0 : look.flash * 0.6})`;
      ctx.fillRect(0, 0, W, H);
      look.flash = Math.max(0, look.flash - dt);
    }
    // vignette
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- HUD and screens ----------
  const bar = $("bar"), pct = $("pct");
  let lastPct = -1;
  function hud() {
    if (view !== "game") return;
    const p = percent();
    bar.style.transform = `scaleX(${clamp(st.x / L.end, 0, 1)})`;
    if (p !== lastPct) pct.textContent = (lastPct = p) + "%";
  }
  function syncHud() {
    $("hud").hidden = view !== "game";
    $("ptools").hidden = !(practice && play === "player");
    $("practice").setAttribute("aria-pressed", practice);
    $("practice2").setAttribute("aria-pressed", practice);
  }
  let badgeT = 0;
  function badge(text) {
    const b = $("badge");
    b.textContent = text;
    b.hidden = false;
    clearTimeout(badgeT);
    badgeT = setTimeout(() => (b.hidden = true), 1600);
  }

  const FACES = ["#4dc3ff", "#4dff88", "#ff9e3d", "#ff3d5a"];
  function faceSvg(i) {
    const c = FACES[i];
    const mouth = ["M30 62 Q50 78 70 62", "M32 66 H68", "M32 70 Q50 58 68 70", "M30 70 Q50 56 70 70"][i];
    const horns = i === 3 ? `<path d="M18 30 L10 6 L34 22 Z M82 30 L90 6 L66 22 Z" fill="${c}" stroke="#0a0a12" stroke-width="4"/>` : "";
    const brows = i >= 2 ? `<path d="M28 34 L44 40 M72 34 L56 40" stroke="#0a0a12" stroke-width="5" stroke-linecap="round"/>` : "";
    return `<svg class="face" viewBox="0 0 100 100">${horns}<circle cx="50" cy="52" r="40" fill="${c}" stroke="#0a0a12" stroke-width="5"/><circle cx="50" cy="52" r="40" fill="url(#gl${i})"/><defs><radialGradient id="gl${i}" cx="35%" cy="30%"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>${brows}<circle cx="38" cy="46" r="6" fill="#0a0a12"/><circle cx="62" cy="46" r="6" fill="#0a0a12"/><path d="${mouth}" fill="none" stroke="#0a0a12" stroke-width="5" stroke-linecap="round"/></svg>`;
  }
  const CARD_COLS = [["#ff6ad5", "#5a1e78"], ["#5ff2ff", "#0d3a5a"], ["#a98bff", "#2a1060"], ["#ff9e3d", "#6b1212"]];

  function renderCard() {
    const def = D.LEVELS[li], card = $("card");
    const coins = [0, 1, 2].map((k) => `<span class="coin-slot ${save.coins[li][k] ? "on" : ""}"></span>`).join("");
    card.style.setProperty("--c1", CARD_COLS[li][0]);
    card.style.setProperty("--c2", CARD_COLS[li][1]);
    card.innerHTML = `${faceSvg(li)}
      <h2>${li + 1}. ${def.name}</h2>
      <div class="meta"><b>${def.diff}</b><span class="stars">${"★".repeat(def.stars)}</span></div>
      <div class="meta">${coins}<span>${Math.round(def.end / 10) * 10} blocchi · ${def.bpm} bpm</span></div>
      <div class="bests">
        <div class="best"><span>Normale</span><div class="track"><i style="width:${save.best[li]}%"></i></div><b>${save.best[li]}%</b></div>
        <div class="best practice"><span>Pratica</span><div class="track"><i style="width:${save.practice[li]}%"></i></div><b>${save.practice[li]}%</b></div>
      </div>`;
    card.style.animation = "none";
    void card.offsetWidth;
    card.style.animation = "";
    $("dots").innerHTML = LEVELS.map((_, i) => `<i class="${i === li ? "on" : ""}"></i>`).join("");
  }

  function pick(i) {
    li = (i + LEVELS.length) % LEVELS.length;
    renderCard();
    startLevel(li, "attract");
  }

  function show(name) {
    view = name;
    $("menu").hidden = name !== "menu";
    $("pause").hidden = name !== "pause";
    $("win").hidden = name !== "win";
    syncHud();
  }

  function go(how) {
    ensureAudio();
    show("game");
    startLevel(li, how);
    syncHud();
    if (how === "demo") badge("Demo: guarda come si fa");
  }

  let pausedFrom = "game";
  function togglePause(force) {
    if (view === "game" && (force !== false)) {
      pausedFrom = "game";
      show("pause");
      $("pauseInfo").textContent = `${D.LEVELS[li].name} · tentativo ${attempts} · ${percent()}%`;
      if (audio.ctx) audio.ctx.suspend();
    } else if (view === "pause" && force !== true) {
      show(pausedFrom);
      if (audio.ctx) audio.ctx.resume();
      input.held = false;
    }
  }

  function showWin() {
    if (play !== "player") return;
    show("win");
    const def = D.LEVELS[li];
    $("winName").textContent = def.name;
    const coinIds = L.objs.filter((o) => o.t === "K");
    $("winCoins").innerHTML = coinIds.map((o) => `<span class="coin-slot ${st.used[o.id] ? "on" : ""}"></span>`).join("");
    const time = st.t;
    $("winStats").innerHTML = [["Tentativi", attempts], ["Salti", st.jumps], ["Tempo", time.toFixed(1) + "s"], ["Modalità", practice ? "Pratica" : "Normale"]].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    $("next").textContent = li < LEVELS.length - 1 ? "Avanti ›" : "Menu";
  }

  function toggleMute() {
    save.muted = !save.muted;
    persist();
    $("mute").classList.toggle("off", save.muted);
    if (audio.master) audio.master.gain.value = save.muted ? 0 : 0.5;
  }

  $("prevLvl").onclick = () => pick(li - 1);
  $("nextLvl").onclick = () => pick(li + 1);
  $("play").onclick = () => go("player");
  $("demo").onclick = () => go("demo");
  const togglePractice = () => {
    practice = !practice;
    checkpoints = [];
    syncHud();
    badge(practice ? "Pratica: Z / ◆ per i checkpoint" : "Modalità normale");
  };
  $("practice").onclick = togglePractice;
  $("practice2").onclick = () => {
    togglePractice();
    togglePause(false);
    restart();
  };
  $("resume").onclick = () => togglePause(false);
  $("restart").onclick = () => {
    togglePause(false);
    restart();
  };
  const toMenu = () => {
    if (audio.ctx && audio.ctx.state === "suspended") audio.ctx.resume();
    stopMusic();
    show("menu");
    renderCard();
    startLevel(li, "attract");
  };
  $("toMenu").onclick = toMenu;
  $("winMenu").onclick = toMenu;
  $("again").onclick = () => {
    show("game");
    attempts = 0;
    restart();
  };
  $("next").onclick = () => {
    if (li < LEVELS.length - 1) {
      li++;
      renderCard();
      go("player");
    } else toMenu();
  };
  $("pauseBtn").onclick = () => togglePause(true);
  $("cpAdd").onclick = addCheckpoint;
  $("cpDel").onclick = removeCheckpoint;
  $("mute").onclick = toggleMute;
  $("mute").classList.toggle("off", save.muted);

  // ---------- main loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    t += dt;
    if (view !== "pause") {
      simulate(dt);
      updateParticles(dt);
      updateCamera(dt);
    }
    render(view === "pause" ? 0 : dt);
    hud();
    requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  resize();
  renderCard();
  // ?livello=N opens on a level, &demo starts its demo straight away
  const params = new URLSearchParams(location.search);
  if (params.has("livello")) pick(clamp(Number(params.get("livello")) - 1 || 0, 0, LEVELS.length - 1));
  if (preview) {
    view = "attract";
    startLevel(0, "attract");
  } else if (params.has("demo")) go("demo");
  else startLevel(li, "attract");
  requestAnimationFrame(frame);
})();
