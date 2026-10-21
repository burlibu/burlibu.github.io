// Fire Dispatch HQ UI: runs the engine (game.js) on a fixed step decoupled
// from requestAnimationFrame, draws the tactical map on a canvas (a cached
// static layer of streets and buildings, plus fires, trucks and water on
// top every frame), and keeps the HUD, the dispatch pop-up, the fleet cards
// and the 112 log in sync. The loop stops while the section is off-screen.
// ?seed=N fixes the shift; in ?preview the autopilot dispatches at 2x.
(() => {
  const D = window.Dispatch;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const root = $("fdhq"), map = $("map"), cv = $("cv"), ctx = cv.getContext("2d");
  const layer = document.createElement("canvas"), lctx = layer.getContext("2d");
  const pop = $("pop"), tip = $("tip"), side = $("side");
  const WORLD = { w: D.W * D.B, h: D.H * D.B };
  const TRUCK_COLOR = { engine: "#ef4444", ladder: "#f59e0b", quick: "#cbd5e1" };
  const LOT_STYLE = {
    res: { fill: "#141e33", stroke: "#34445f" },
    tower: { fill: "#1f2d4b", stroke: "#8193b3" },
    ind: { fill: "#241f14", stroke: "#8a6219" },
    hosp: { fill: "#10263a", stroke: "#cbd5e1" },
  };
  const LEVEL_COLOR = { 1: "#f59e0b", 2: "#f97316", 3: "#ef4444" };
  const THREAT = { 1: "MODERATA", 2: "ALTA", 3: "CRITICA" };
  const CODE_TEXT = { green: "CODICE VERDE", yellow: "CODICE GIALLO", red: "CODICE ROSSO" };

  const int = (n) => Math.round(n).toLocaleString("it-IT");
  const eur = (n) => (n < -0.5 ? "−" : "") + "€" + int(Math.abs(n));
  const eurShort = (n) => (n >= 1e6 ? "€" + (n / 1e6).toFixed(1).replace(".", ",") + " M" : n >= 1e3 ? "€" + Math.round(n / 1e3) + "k" : "€" + int(n));
  const km = (units) => ((units * D.M_PER_UNIT) / 1000).toFixed(1).replace(".", ",") + " km";
  const mins = (gameSec) => Math.max(1, Math.round((gameSec * D.CLOCK_RATE) / 60)) + " min";
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  let s, speed, acc = 0, last = 0, raf = 0, lastUi = 0, autoTick = 0, ended = false;
  let visible = true, staticDirty = true, logShown = 0, logLen = -1;
  let selected = null, popKey = "", hover = null, hiTruck = null, pointer = null;
  const view = { k: 1, x: 0, y: 0, fitted: true };
  let cssW = 0, cssH = 0, dpr = 1;

  // ---------- game ----------
  function newGame() {
    const seed = +params.get("seed") || (Math.random() * 0xffff) | 0;
    s = D.create(seed);
    acc = 0;
    ended = false;
    logShown = 0;
    logLen = -1;
    $("log").textContent = "";
    closePop();
    buildFleet();
    setSpeed(preview ? 2 : 1);
    staticDirty = true;
    ui();
  }

  function setSpeed(v) {
    speed = v;
    for (const b of document.querySelectorAll("[data-speed]")) b.setAttribute("aria-pressed", String(+b.dataset.speed === v));
    map.toggleAttribute("data-paused", v === 0);
    last = 0;
    schedule();
  }

  // ---------- view: world -> screen is world * k + (x, y) ----------
  const sx = (wx) => wx * view.k + view.x;
  const sy = (wy) => wy * view.k + view.y;
  function fitK() {
    const pad = cssW < 560 ? 18 : 34;
    return Math.min((cssW - pad * 2) / WORLD.w, (cssH - pad * 2 - 16) / WORLD.h);
  }
  function fit() {
    view.k = fitK();
    view.fitted = true;
    clampView();
  }
  function clampView() {
    const w = WORLD.w * view.k, h = WORLD.h * view.k, m = 40;
    view.x = w <= cssW ? (cssW - w) / 2 : Math.min(m, Math.max(cssW - w - m, view.x));
    // on a phone the city sits near the top, leaving the lower half to the docked pop-up
    const top = cssW < 560 ? Math.min(44, cssH - h) : (cssH - h) / 2 + 6;
    view.y = h <= cssH ? top : Math.min(m, Math.max(cssH - h - m, view.y));
    staticDirty = true;
  }
  function zoomAt(px, py, f) {
    const k = Math.min(fitK() * 5, Math.max(fitK() * 0.9, view.k * f));
    view.x = px - (px - view.x) * (k / view.k);
    view.y = py - (py - view.y) * (k / view.k);
    view.k = k;
    view.fitted = false;
    clampView();
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cssW = map.clientWidth;
    cssH = map.clientHeight;
    for (const c of [cv, layer]) {
      c.width = Math.max(1, Math.round(cssW * dpr));
      c.height = Math.max(1, Math.round(cssH * dpr));
    }
    if (view.fitted) fit();
    else clampView();
    pop.classList.toggle("is-docked", cssW < 560);
    schedule();
  }

  // ---------- static layer: ground, streets, buildings, hydrants ----------
  function drawStatic() {
    const g = lctx, k = view.k;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = "#0b1222";
    g.fillRect(0, 0, cssW, cssH);

    // survey grid, finer inside the city
    for (const [step, a] of [[25, 0.035], [100, 0.07]]) {
      g.strokeStyle = `rgba(6, 182, 212, ${a})`;
      g.lineWidth = 1;
      g.beginPath();
      const x0 = Math.floor(-view.x / k / step) * step, y0 = Math.floor(-view.y / k / step) * step;
      for (let x = x0; sx(x) < cssW; x += step) (g.moveTo(Math.round(sx(x)) + 0.5, 0), g.lineTo(Math.round(sx(x)) + 0.5, cssH));
      for (let y = y0; sy(y) < cssH; y += step) (g.moveTo(0, Math.round(sy(y)) + 0.5), g.lineTo(cssW, Math.round(sy(y)) + 0.5));
      g.stroke();
    }

    // streets: every open segment between two intersections; the corsi are wider
    const seg = [];
    D.NEIGH.forEach((out, n) => out.forEach((m) => m > n && seg.push([D.nodePoint(n), D.nodePoint(m)])));
    const wide = (a, b) => (a.x === b.x && a.x === 4 * D.B) || (a.y === b.y && a.y === 3 * D.B);
    g.lineCap = "square";
    for (const pass of [0, 1]) {
      for (const [a, b] of seg) {
        g.strokeStyle = pass ? "#24324e" : "#070c17";
        g.lineWidth = ((wide(a, b) ? 22 : 17) + (pass ? 0 : 3)) * k;
        g.beginPath();
        g.moveTo(sx(a.x), sy(a.y));
        g.lineTo(sx(b.x), sy(b.y));
        g.stroke();
      }
    }
    g.lineCap = "butt";
    g.setLineDash([6 * k, 7 * k]);
    g.strokeStyle = "rgba(148, 163, 184, 0.16)";
    g.lineWidth = 1;
    g.beginPath();
    for (const [a, b] of seg) (g.moveTo(sx(a.x), sy(a.y)), g.lineTo(sx(b.x), sy(b.y)));
    g.stroke();
    g.setLineDash([]);

    // parks
    for (const [bx, by] of D.PARKS) {
      const merged = D.PARKS.some(([a, b]) => b === by && a === bx + 1);
      const x = bx * D.B + 9, y = by * D.B + 9, w = (merged ? 2 : 1) * D.B - 18, h = D.B - 18;
      g.fillStyle = "#0c241f";
      g.strokeStyle = "#1f5a4a";
      g.lineWidth = 1;
      g.fillRect(sx(x), sy(y), w * k, h * k);
      g.strokeRect(sx(x) + 0.5, sy(y) + 0.5, w * k - 1, h * k - 1);
      g.fillStyle = "rgba(52, 211, 153, 0.22)";
      for (let i = 0; i < (merged ? 22 : 11); i++) {
        const tx = x + 8 + ((i * 37) % (w - 16)), ty = y + 8 + ((i * 53) % (h - 16));
        g.beginPath();
        g.arc(sx(tx), sy(ty), Math.max(1.5, 4 * k), 0, Math.PI * 2);
        g.fill();
      }
    }

    // fire station
    const [hx, hy] = D.HQ_BLOCK;
    const X = hx * D.B + 9, Y = hy * D.B + 9, S = D.B - 18;
    g.fillStyle = "#22140d";
    g.fillRect(sx(X), sy(Y), S * k, S * k);
    g.strokeStyle = "#f97316";
    g.lineWidth = 1.5;
    g.strokeRect(sx(X) + 0.5, sy(Y) + 0.5, S * k - 1, S * k - 1);
    g.strokeStyle = "rgba(249, 115, 22, 0.35)";
    g.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      const bx = sx(D.bayPoint(i).x - 6), by = sy(Y + 48);
      g.strokeRect(bx + 0.5, by + 0.5, 12 * k, 30 * k);
    }
    label(g, k > 0.7 ? "HQ · CASERMA 01" : "HQ", sx(X + S / 2), sy(Y + 22), "#fdba74", 10, "center", "600");

    // buildings
    for (const l of s.lots) drawLot(g, l);

    // hydrants
    for (const n of s.hydrants) {
      const p = D.nodePoint(n), r = Math.max(3, 5 * k);
      g.save();
      g.translate(sx(p.x), sy(p.y));
      g.rotate(Math.PI / 4);
      g.fillStyle = "#06b6d4";
      g.shadowColor = "#06b6d4";
      g.shadowBlur = 8;
      g.fillRect(-r / 2, -r / 2, r, r);
      g.restore();
    }

    // street names, once each, when there's room to read them
    if (k > 0.5) {
      const f = Math.max(8, Math.min(11, 9 * k));
      D.HSTREETS.forEach((n, j) => label(g, n.toUpperCase(), sx(((j * 3) % 8) * D.B + D.B / 2 + 12), sy(j * D.B) + f * 0.35, "rgba(148, 163, 184, 0.55)", f, "center", "500", "#24324e"));
      D.VSTREETS.forEach((n, i) => {
        g.save();
        g.translate(sx(i * D.B) + f * 0.35, sy(((i * 2 + 1) % 7) * D.B + D.B / 2));
        g.rotate(-Math.PI / 2);
        label(g, n.toUpperCase(), 0, 0, "rgba(148, 163, 184, 0.55)", f, "center", "500", "#24324e");
        g.restore();
      });
    }
    staticDirty = false;
  }

  function label(g, text, x, y, color, size, align = "left", weight = "500", bg) {
    g.font = `${weight} ${size}px "JetBrains Mono", monospace`;
    g.textAlign = align;
    g.textBaseline = "middle";
    if (bg) {
      const w = g.measureText(text).width + 6, x0 = align === "center" ? x - w / 2 : x - 3;
      g.fillStyle = bg;
      g.fillRect(x0, y - size * 0.6, w, size * 1.2);
    }
    g.fillStyle = color;
    g.fillText(text, x, y);
  }

  function drawLot(g, l) {
    const k = view.k, x = sx(l.x), y = sy(l.y), w = l.w * k, h = l.h * k;
    if (l.state === "ruin") {
      g.fillStyle = "#1a1312";
      g.fillRect(x, y, w, h);
      g.strokeStyle = "#7f1d1d";
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + w, y + h);
      g.moveTo(x + w, y);
      g.lineTo(x, y + h);
      g.stroke();
      g.fillStyle = "#3f2a26";
      for (let i = 0; i < 9; i++) g.fillRect(x + ((i * 0.37) % 1) * w * 0.85, y + ((i * 0.61) % 1) * h * 0.85, 3 * k + 1, 2 * k + 1);
      return;
    }
    const st = LOT_STYLE[l.kind];
    g.fillStyle = st.fill;
    g.fillRect(x, y, w, h);
    if (l.kind === "tower") {
      // stacked roof outlines: taller towers get more of them
      g.strokeStyle = "rgba(129, 147, 179, 0.28)";
      for (let i = 1; i <= Math.min(3, Math.floor(l.floors / 4)); i++) {
        const d = i * 4 * k;
        g.strokeRect(x + d + 0.5, y + d + 0.5, w - 2 * d - 1, h - 2 * d - 1);
      }
    } else if (l.kind === "ind") {
      g.save();
      g.beginPath();
      g.rect(x, y, w, h);
      g.clip();
      g.strokeStyle = "rgba(183, 121, 31, 0.2)";
      g.beginPath();
      for (let d = -h; d < w; d += 6 * k + 2) (g.moveTo(x + d, y + h), g.lineTo(x + d + h, y));
      g.stroke();
      g.restore();
    } else if (l.kind === "hosp") {
      const c = Math.min(w, h) * 0.32, t = c * 0.34, cx = x + w / 2, cy = y + h / 2;
      g.fillStyle = "#e2e8f0";
      g.fillRect(cx - t / 2, cy - c / 2, t, c);
      g.fillRect(cx - c / 2, cy - t / 2, c, t);
      label(g, "OSPEDALE", cx, y + h - 9 * k, "#94a3b8", Math.max(7, 8 * k), "center");
    }
    // scorched by an earlier fire
    if (l.integrity < 100) {
      g.fillStyle = `rgba(0, 0, 0, ${(1 - l.integrity / 100) * 0.55})`;
      g.fillRect(x, y, w, h);
    }
    g.strokeStyle = l.integrity < 100 ? "#7c3a2a" : st.stroke;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  // ---------- dynamic layer ----------
  function draw(now, alpha) {
    if (staticDirty) drawStatic();
    const g = ctx, k = view.k, time = reduced ? 0 : now / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(layer, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pos = (t) => [sx(t.px + (t.x - t.px) * alpha), sy(t.py + (t.y - t.py) * alpha)];

    // planned routes
    g.lineWidth = 2;
    g.setLineDash([4, 5]);
    g.lineDashOffset = -time * 18;
    for (const t of s.trucks) {
      if (!t.route.length) continue;
      const [x, y] = pos(t);
      g.strokeStyle = TRUCK_COLOR[t.type] + (hiTruck === t.id ? "dd" : "70");
      g.beginPath();
      g.moveTo(x, y);
      for (const p of t.route) g.lineTo(sx(p.x), sy(p.y));
      g.stroke();
    }
    g.setLineDash([]);

    // fires
    for (const f of s.fires) {
      const l = f.lot, cx = sx(l.cx), cy = sy(l.cy), col = LEVEL_COLOR[f.level];
      const flick = 0.85 + 0.15 * Math.sin(time * 9 + f.id * 2.1);
      g.fillStyle = `rgba(249, 115, 22, ${(0.18 + f.hp / 320) * flick})`;
      g.fillRect(sx(l.x), sy(l.y), l.w * k, l.h * k);
      g.fillStyle = `rgba(0, 0, 0, ${(1 - l.integrity / 100) * 0.4})`;
      g.fillRect(sx(l.x), sy(l.y), l.w * k, l.h * k);

      const r = (16 + f.hp * 0.38) * k * (1 + 0.06 * Math.sin(time * 5 + f.id));
      const glow = g.createRadialGradient(cx, cy, 0, cx, cy, r);
      glow.addColorStop(0, "rgba(255, 237, 213, 0.9)");
      glow.addColorStop(0.25, "rgba(249, 115, 22, 0.75)");
      glow.addColorStop(0.6, "rgba(239, 68, 68, 0.25)");
      glow.addColorStop(1, "rgba(239, 68, 68, 0)");
      g.fillStyle = glow;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.fill();

      // radar pings: faster and wider as the threat grows
      for (let i = 0; i < 2; i++) {
        const ph = (time * (0.45 + f.level * 0.15) + i / 2 + f.id * 0.31) % 1;
        g.strokeStyle = col;
        g.globalAlpha = (1 - ph) * 0.7;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(cx, cy, r * 0.6 + ph * (24 + f.level * 14) * k, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;

      // embers drifting up, stateless: each one is a function of time
      const n = 5 + f.level * 4;
      for (let i = 0; i < n; i++) {
        const ph = (time * (0.5 + (i % 3) * 0.17) + i * 0.618) % 1;
        const ex = cx + Math.sin(i * 12.9 + time * 1.3) * r * 0.45, ey = cy - ph * r * 1.5;
        g.fillStyle = i % 3 ? "#fdba74" : "#fef3c7";
        g.globalAlpha = 1 - ph;
        g.fillRect(ex, ey, 1.6, 1.6);
      }
      g.globalAlpha = 1;

      // structure bar and priority tag
      const bw = Math.max(26, l.w * k), bx = cx - bw / 2, by = sy(l.y) - 9;
      g.fillStyle = "rgba(11, 18, 34, 0.85)";
      g.fillRect(bx - 1, by - 1, bw + 2, 5);
      g.fillStyle = l.integrity > 50 ? "#22c55e" : l.integrity > 25 ? "#f59e0b" : "#ef4444";
      g.fillRect(bx, by, (bw * Math.max(0, l.integrity)) / 100, 3);
      label(g, "P" + f.level, bx + bw + 4, by + 1, col, 10, "left", "700", "rgba(11, 18, 34, 0.85)");

      if (selected === f.id || (hover && hover.fire === f.id)) brackets(g, sx(l.x), sy(l.y), l.w * k, l.h * k, time, selected === f.id);
    }

    // water: animated jets from engaged trucks to the burning building
    for (const t of s.trucks) {
      if (!t.spraying) continue;
      const f = D.fireById(s, t.fire);
      if (!f) continue;
      const [x, y] = pos(t), tx = sx(f.lot.cx), ty = sy(f.lot.cy);
      g.strokeStyle = "rgba(6, 182, 212, 0.85)";
      g.lineWidth = 2;
      g.setLineDash([3, 4]);
      g.lineDashOffset = -time * 40;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo((x + tx) / 2, Math.min(y, ty) - 18 * k, tx, ty);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = "rgba(165, 243, 252, 0.8)";
      for (let i = 0; i < 4; i++) {
        const a = time * 3 + i * 1.57;
        g.fillRect(tx + Math.cos(a) * 7 * k, ty + Math.sin(a * 1.3) * 6 * k, 1.5, 1.5);
      }
    }

    // trucks
    for (const t of s.trucks) {
      const [x, y] = pos(t);
      const L = Math.max(12, (t.type === "quick" ? 13 : 17) * k), Wd = L * 0.5;
      if (t.state === "hydrant" || t.state === "refill") {
        g.strokeStyle = "rgba(6, 182, 212, 0.8)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(x, y, L * 0.8 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
        g.stroke();
      }
      g.save();
      g.translate(x, y);
      g.rotate(t.dir);
      g.shadowColor = TRUCK_COLOR[t.type];
      g.shadowBlur = hiTruck === t.id || (hover && hover.truck === t.id) ? 14 : 6;
      g.fillStyle = TRUCK_COLOR[t.type];
      g.fillRect(-L / 2, -Wd / 2, L, Wd);
      g.shadowBlur = 0;
      g.fillStyle = "rgba(11, 18, 34, 0.55)";
      g.fillRect(L / 2 - L * 0.28, -Wd / 2, L * 0.28, Wd);
      if (t.type === "ladder") {
        g.strokeStyle = "rgba(11, 18, 34, 0.7)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(-L / 2 + 2, 0);
        g.lineTo(L / 2 - L * 0.3, 0);
        g.stroke();
      }
      if (t.state === "enroute") {
        // light bar: alternating flashes while running hot
        g.fillStyle = Math.floor(time * 6) % 2 ? "#fecaca" : "#ef4444";
        g.fillRect(L / 2 - L * 0.42, -Wd / 2 - 1, 2.5, Wd + 2);
      }
      g.restore();
      const home = t.state === "base" || t.state === "refill";
      if ((k > 0.75 && !home) || hiTruck === t.id) label(g, t.name, x, y + Wd + 7, "rgba(226, 232, 240, 0.85)", 9, "center", "600", "rgba(11, 18, 34, 0.7)");
    }
  }

  // tactical corner brackets around the selected building
  function brackets(g, x, y, w, h, time, strong) {
    const p = 5 + (strong ? Math.sin(time * 4) * 1.5 : 0), c = 7;
    g.strokeStyle = strong ? "#f97316" : "rgba(226, 232, 240, 0.7)";
    g.lineWidth = 1.5;
    g.beginPath();
    for (const [ax, ay, dx, dy] of [[x - p, y - p, 1, 1], [x + w + p, y - p, -1, 1], [x - p, y + h + p, 1, -1], [x + w + p, y + h + p, -1, -1]]) {
      g.moveTo(ax + dx * c, ay);
      g.lineTo(ax, ay);
      g.lineTo(ax, ay + dy * c);
    }
    g.stroke();
  }

  // ---------- hit testing ----------
  function hit(px, py) {
    for (const t of s.trucks) if (Math.hypot(sx(t.x) - px, sy(t.y) - py) < Math.max(10, 12 * view.k)) return { truck: t.id };
    const wx = (px - view.x) / view.k, wy = (py - view.y) / view.k;
    for (const f of s.fires) {
      const l = f.lot, m = 8 / view.k;
      if (wx > l.x - m && wx < l.x + l.w + m && wy > l.y - m && wy < l.y + l.h + m) return { fire: f.id };
    }
    return null;
  }

  // ---------- pointer: pan, pinch, wheel zoom, hover and click ----------
  const pts = new Map();
  let drag = null, pinch = null;
  const local = (e) => {
    const r = cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  cv.addEventListener("pointerdown", (e) => {
    const [x, y] = local(e);
    pts.set(e.pointerId, [x, y]);
    cv.setPointerCapture(e.pointerId);
    if (pts.size === 1) drag = { x, y, vx: view.x, vy: view.y, moved: false };
    else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), k: view.k, cx: (a[0] + b[0]) / 2, cy: (a[1] + b[1]) / 2, vx: view.x, vy: view.y };
      drag = null;
    }
  });

  cv.addEventListener("pointermove", (e) => {
    const [x, y] = local(e);
    pointer = [x, y];
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [x, y]);
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      view.k = pinch.k;
      view.x = pinch.vx + ((a[0] + b[0]) / 2 - pinch.cx);
      view.y = pinch.vy + ((a[1] + b[1]) / 2 - pinch.cy);
      zoomAt(pinch.cx, pinch.cy, d / pinch.d);
      return;
    }
    if (drag) {
      if (!drag.moved && Math.hypot(x - drag.x, y - drag.y) > 5) {
        drag.moved = true;
        cv.classList.add("is-panning");
        hideTip();
      }
      if (drag.moved) {
        view.x = drag.vx + x - drag.x;
        view.y = drag.vy + y - drag.y;
        view.fitted = false;
        clampView();
        return;
      }
    }
    if (e.pointerType === "mouse") {
      hover = hit(x, y);
      cv.classList.toggle("is-pointing", !!hover);
      tipUpdate();
    }
    const wx = (x - view.x) / view.k, wy = (y - view.y) / view.k;
    const inside = wx >= 0 && wy >= 0 && wx < WORLD.w && wy < WORLD.h;
    $("coords").textContent = (inside ? `SETTORE ${String.fromCharCode(65 + Math.floor(wx / D.B))}${Math.floor(wy / D.B) + 1} · ${int(wx * D.M_PER_UNIT)} / ${int(wy * D.M_PER_UNIT)} M` : "FUORI MAPPA") + ` · ZOOM ${(view.k / fitK()).toFixed(1)}×`;
  });

  const release = (e) => {
    if (drag && !drag.moved && e.type === "pointerup") click(...local(e));
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    drag = null;
    cv.classList.remove("is-panning");
  };
  cv.addEventListener("pointerup", release);
  cv.addEventListener("pointercancel", release);
  cv.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") {
      hover = null;
      pointer = null;
      hideTip();
    }
  });
  cv.addEventListener("wheel", (e) => {
    e.preventDefault();
    zoomAt(...local(e), Math.exp(-e.deltaY * 0.0015));
  }, { passive: false });

  function click(x, y) {
    const h = hit(x, y);
    if (h && h.fire) openPop(h.fire);
    else if (h && h.truck !== undefined && s.trucks[h.truck].fire) openPop(s.trucks[h.truck].fire);
    else closePop();
  }

  $("zoomIn").addEventListener("click", () => zoomAt(cssW / 2, cssH / 2, 1.4));
  $("zoomOut").addEventListener("click", () => zoomAt(cssW / 2, cssH / 2, 1 / 1.4));
  $("zoomFit").addEventListener("click", fit);

  // ---------- hover telemetry ----------
  function hideTip() {
    tip.hidden = true;
  }
  function tipUpdate() {
    if (!hover || !pointer) return hideTip();
    let html, color;
    if (hover.fire) {
      const f = D.fireById(s, hover.fire);
      if (!f) return hideTip();
      const on = s.trucks.filter((t) => t.fire === f.id).map((t) => t.name);
      color = LEVEL_COLOR[f.level];
      html = `<b>${esc(f.lot.addr)}</b>
        <span>${D.KINDS[f.lot.kind].label} <em>P${f.level}</em></span>
        <span>Fiamme <em>${Math.round(f.hp)}%</em></span>
        <span>Spegnimento <em>${Math.max(0, Math.round((1 - f.hp / f.peak) * 100))}%</em></span>
        <span>Struttura <em>${Math.max(0, Math.round(f.lot.integrity))}%</em></span>
        <span>Unità <em>${on.length ? on.join(", ") : "nessuna"}</em></span>`;
    } else {
      const t = s.trucks[hover.truck], k = D.TRUCKS[t.type];
      color = TRUCK_COLOR[t.type];
      html = `<b>${t.name} · ${k.label}</b>
        <span>Stato <em>${D.STATUS[t.state]}</em></span>
        <span>Acqua <em>${int(t.water)} / ${int(k.tank)} L</em></span>
        <span>Carburante <em>${Math.round(t.fuel)}%</em></span>
        <span>Squadra <em>${k.crew} operatori</em></span>
        <span>Percorsi <em>${km(t.odo)}</em></span>`;
    }
    tip.innerHTML = html;
    tip.style.setProperty("--tc", color);
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = pointer[0] + 16, y = pointer[1] + 14;
    if (x + w > cssW - 8) x = pointer[0] - w - 14;
    if (y + h > cssH - 8) y = pointer[1] - h - 12;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  // ---------- dispatch pop-up ----------
  function openPop(id) {
    if (!D.fireById(s, id)) return;
    selected = id;
    popKey = "";
    pop.hidden = false;
    popUpdate();
    placePop();
    const first = pop.querySelector(".fdhq-btn:not(:disabled)") || pop.querySelector(".fdhq-x");
    if (first) first.focus({ preventScroll: true });
  }
  function closePop() {
    if (selected === null && pop.hidden) return;
    selected = null;
    pop.hidden = true;
  }

  function placePop() {
    if (pop.hidden || pop.classList.contains("is-docked")) return;
    const f = D.fireById(s, selected);
    if (!f) return;
    const w = pop.offsetWidth, h = pop.offsetHeight, l = f.lot;
    let x = sx(l.x + l.w) + 18;
    if (x + w > cssW - 12) x = sx(l.x) - w - 18;
    x = Math.max(12, Math.min(cssW - w - 12, x));
    const y = Math.max(12, Math.min(cssH - h - 12, sy(l.cy) - h / 2));
    pop.style.left = x + "px";
    pop.style.top = y + "px";
  }

  // rebuilt only when the list of choices changes; the numbers update in place
  function popUpdate() {
    const f = D.fireById(s, selected);
    if (!f) return closePop();
    const l = f.lot, kind = D.KINDS[l.kind];
    const others = s.trucks.filter((t) => t.fire !== f.id);
    const key = others.map((t) => t.id + t.state + (D.readiness(s, t) || "")).join("|") + f.level;
    if (key !== popKey) {
      popKey = key;
      const ladderComing = s.trucks.some((t) => t.fire === f.id && D.TRUCKS[t.type].ladder);
      const notes = [];
      if (kind.tall && !ladderComing) notes.push("Edificio alto: senza autoscala sul posto l'acqua arriva solo al 30%.");
      if (kind.chem) notes.push("Sostanze chimiche: l'acqua è efficace al 75%. Servono più mezzi.");
      pop.innerHTML = `
        <div class="fdhq-pop-head">
          <span class="fdhq-pri" data-l="${f.level}">P${f.level}</span>
          <div><p>Incendio · ${kind.label} · ${km(distanceFromHq(l))} dalla caserma</p><h3 id="popTitle">${esc(l.addr)}</h3></div>
          <button type="button" class="fdhq-x" data-close aria-label="Chiudi">×</button>
        </div>
        <div class="fdhq-pop-stats">
          <div><span class="fdhq-k">Fiamme</span><strong data-v="hp"></strong><div class="fdhq-bar"><i data-b="hp"></i></div></div>
          <div><span class="fdhq-k">Struttura</span><strong data-v="int"></strong><div class="fdhq-bar"><i data-b="int"></i></div></div>
          <div><span class="fdhq-k">Minaccia</span><strong data-v="threat"></strong></div>
          <div><span class="fdhq-k">Sul posto</span><strong data-v="on"></strong></div>
        </div>
        ${notes.map((n) => `<p class="fdhq-warn">${n}</p>`).join("")}
        <h4>Unità disponibili</h4>
        <ul class="fdhq-pick">${others.map((t) => {
          const k = D.TRUCKS[t.type], why = D.readiness(s, t);
          return `<li${why ? " data-off" : ""}>
            <span class="fdhq-unit-id" style="--tc:${TRUCK_COLOR[t.type]};width:34px;height:34px">${k.code}<small>${t.n}</small></span>
            <span><b>${t.name} · ${k.label}</b><small>${why ? why : `ETA ${mins(D.eta(s, t, f))} · ${int(t.water)} L · carb. ${Math.round(t.fuel)}%`}</small></span>
            <button type="button" class="fdhq-btn" data-send="${t.id}"${why ? " disabled" : ""}>Invia</button>
          </li>`;
        }).join("")}</ul>`;
    }
    const set = (k, v) => (pop.querySelector(`[data-v="${k}"]`).textContent = v);
    set("hp", Math.round(f.hp) + "%");
    set("int", Math.max(0, Math.round(l.integrity)) + "%");
    set("threat", THREAT[f.level]);
    const on = s.trucks.filter((t) => t.fire === f.id);
    set("on", on.length ? on.map((t) => t.name).join(", ") : "—");
    const hp = pop.querySelector('[data-b="hp"]'), it = pop.querySelector('[data-b="int"]');
    hp.style.width = f.hp + "%";
    hp.style.setProperty("--bc", LEVEL_COLOR[f.level]);
    it.style.width = Math.max(0, l.integrity) + "%";
    it.style.setProperty("--bc", l.integrity > 50 ? "#22c55e" : l.integrity > 25 ? "#f59e0b" : "#ef4444");
  }

  const hqDist = new Map();
  function distanceFromHq(l) {
    if (!hqDist.has(l.node)) hqDist.set(l.node, (D.astar(s.hq, l.node).length - 1) * D.B + 26);
    return hqDist.get(l.node);
  }

  pop.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-close")) return closePop();
    if (b.dataset.send !== undefined && D.dispatch(s, +b.dataset.send, selected)) ui();
  });

  // ---------- fleet cards ----------
  function buildFleet() {
    $("fleet").innerHTML = s.trucks.map((t) => {
      const k = D.TRUCKS[t.type];
      return `<li class="fdhq-unit" data-id="${t.id}" style="--tc:${TRUCK_COLOR[t.type]}">
        <span class="fdhq-unit-id">${k.code}<small>${t.n}</small></span>
        <span class="fdhq-unit-name"><b>${t.name}</b><span>${k.label} · ${int(k.tank)} L</span></span>
        <em class="fdhq-badge" data-v="state"></em>
        <div class="fdhq-gauges">
          <span class="fdhq-gauge water"><span>H₂O</span><em data-v="water"></em><span class="fdhq-bar"><i data-b="water"></i></span></span>
          <span class="fdhq-gauge fuel"><span>Gasolio</span><em data-v="fuel"></em><span class="fdhq-bar"><i data-b="fuel"></i></span></span>
          <span class="fdhq-crew" title="${k.crew} operatori">${"<i></i>".repeat(k.crew)}</span>
        </div>
        <div class="fdhq-unit-foot" data-v="foot"></div>
      </li>`;
    }).join("");
  }

  function fleetUpdate() {
    for (const t of s.trucks) {
      const li = $("fleet").children[t.id], k = D.TRUCKS[t.type];
      li.dataset.state = t.state;
      li.querySelector('[data-v="state"]').textContent = D.STATUS[t.state];
      li.querySelector('[data-v="water"]').textContent = int(t.water) + " L";
      li.querySelector('[data-b="water"]').style.width = (t.water / k.tank) * 100 + "%";
      li.querySelector('[data-v="fuel"]').textContent = Math.round(t.fuel) + "%";
      li.querySelector('[data-b="fuel"]').style.width = t.fuel + "%";
      li.querySelector(".fdhq-gauge.fuel").classList.toggle("low", t.fuel < 20);
      const f = D.fireById(s, t.fire);
      const where = f ? `→ ${f.lot.addr}` : t.state === "returning" ? "→ Caserma" : "";
      const can = t.state !== "base" && t.state !== "refill" && t.state !== "returning";
      const foot = where ? `<span>${esc(where)}</span>` + (can ? `<button type="button" class="fdhq-ghost" data-recall="${t.id}">Rientra</button>` : "") : "";
      const el = li.querySelector('[data-v="foot"]');
      if (el.dataset.html !== foot) el.innerHTML = el.dataset.html = foot;
    }
  }

  $("fleet").addEventListener("click", (e) => {
    const b = e.target.closest("[data-recall]");
    if (b && D.recall(s, +b.dataset.recall)) ui();
  });
  $("fleet").addEventListener("pointerover", (e) => {
    const li = e.target.closest(".fdhq-unit");
    hiTruck = li ? +li.dataset.id : null;
  });
  $("fleet").addEventListener("pointerleave", () => (hiTruck = null));

  // ---------- 112 log ----------
  function logUpdate() {
    const list = $("log");
    for (; logShown < s.log.length; logShown++) {
      const e = s.log[logShown];
      const li = document.createElement("li");
      li.dataset.kind = e.kind;
      const tag = e.pri ? `<b data-l="${e.pri}">P${e.pri}</b>` : "";
      const body = e.fire && (e.kind === "call" || e.kind === "alarm") ? `<button type="button" data-fire="${e.fire}">${tag}${esc(e.text)}</button>` : tag + esc(e.text);
      li.innerHTML = `<time>${e.at}</time><span>${body}</span>`;
      list.prepend(li);
    }
    while (list.children.length > 80) list.lastChild.remove();
  }
  $("log").addEventListener("click", (e) => {
    const b = e.target.closest("[data-fire]");
    if (!b) return;
    if (!D.fireById(s, +b.dataset.fire)) return;
    side.classList.remove("is-open");
    $("handle").setAttribute("aria-expanded", "false");
    openPop(+b.dataset.fire);
  });

  // ---------- HUD ----------
  function ui() {
    $("clock").textContent = D.clock(s);
    $("code").dataset.code = s.code;
    $("codeText").textContent = CODE_TEXT[s.code];
    const b = $("budget");
    b.textContent = eur(s.budget);
    b.classList.toggle("fdhq-neg", s.budget < 0);
    const rep = Math.round(s.rep);
    $("rep").textContent = rep + "%";
    $("repMeter").setAttribute("aria-valuenow", rep);
    const bar = $("repBar");
    bar.style.width = s.rep + "%";
    bar.style.setProperty("--rc", s.rep < 35 ? "#ef4444" : s.rep < 60 ? "#f59e0b" : "#22c55e");
    const free = D.staffFree(s);
    $("staff").textContent = `${free}/${s.staff}`;
    const hire = $("hire");
    hire.disabled = s.hired >= D.HIRE.max || s.budget < D.HIRE.cost || !!s.over;
    hire.title = s.hired >= D.HIRE.max ? "Straordinari esauriti per questo turno" : `Richiama ${D.HIRE.staff} operatori fuori turno`;
    $("saved").textContent = s.saved;
    $("lost").textContent = s.lost;
    $("avoided").textContent = eurShort(s.avoided);
    const home = s.trucks.filter((t) => t.state === "base" || t.state === "refill").length;
    $("fleetSum").textContent = `${home}/${s.trucks.length} in caserma`;
    $("active").textContent = `${s.fires.length} ${s.fires.length === 1 ? "attiva" : "attive"}`;
    $("handleText").textContent = `Flotta ${home}/${s.trucks.length} in caserma · ${s.fires.length} ${s.fires.length === 1 ? "attiva" : "attive"}`;
    fleetUpdate();
    if (s.log.length !== logLen) {
      logUpdate();
      staticDirty = true; // a building was saved, scorched or lost
      logLen = s.log.length;
    }
    if (selected !== null) popUpdate();
    if (hover) tipUpdate();
  }

  // ---------- end of shift ----------
  function finish() {
    ended = true;
    if (preview) return setTimeout(newGame, 2500);
    const win = s.over === "win";
    $("endEyebrow").textContent = win ? "Rapporto di fine turno · 02:00" : `Turno sospeso alle ${D.clock(s)}`;
    $("endTitle").textContent = win ? (s.lost ? "Turno concluso" : "Città intatta") : "Fiducia persa";
    $("endText").textContent = win
      ? `La notte è finita con la reputazione al ${Math.round(s.rep)}%. Punteggio ${int(D.score(s))}.`
      : `Troppi edifici crollati: la giunta ha commissariato la centrale. Punteggio ${int(D.score(s))}.`;
    $("endStats").innerHTML = [
      ["Edifici salvati", s.saved], ["Crolli", s.lost],
      ["Danni evitati", eurShort(s.avoided)], ["Danni subiti", eurShort(s.damage)],
      ["Carburante", eur(s.fuelSpent)], ["Fondi finali", eur(s.budget)],
    ].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("");
    $("end").showModal();
  }
  $("again").addEventListener("click", () => {
    $("end").close();
    newGame();
  });

  // ---------- loop: fixed logic step, rendering on rAF, paused off-screen ----------
  function frame(now) {
    raf = 0;
    const dt = last ? Math.min(0.25, (now - last) / 1000) : 0;
    last = now;
    if (!s.over) {
      acc += dt * speed;
      for (let n = 0; acc >= D.DT && n < 300; n++) {
        D.step(s);
        acc -= D.DT;
        if (preview && ++autoTick % 30 === 0) D.auto(s);
      }
    }
    draw(now, s.over ? 1 : Math.min(1, acc / D.DT));
    placePop();
    if (now - lastUi > 120) {
      ui();
      lastUi = now;
    }
    if (s.over && !ended) finish();
    schedule();
  }
  function schedule() {
    if (!raf && visible && !document.hidden && s) raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    last = 0;
    schedule();
  }).observe(root);
  document.addEventListener("visibilitychange", () => {
    last = 0;
    schedule();
  });

  // ---------- controls ----------
  for (const b of document.querySelectorAll("[data-speed]")) b.addEventListener("click", () => setSpeed(+b.dataset.speed));
  $("hire").addEventListener("click", () => D.hire(s) && ui());
  $("handle").addEventListener("click", () => {
    const open = side.classList.toggle("is-open");
    $("handle").setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePop();
    if (e.target.closest("button, input, dialog") || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === " ") {
      e.preventDefault();
      setSpeed(speed ? 0 : 1);
    } else if (e.key === "+" || e.key === "=") zoomAt(cssW / 2, cssH / 2, 1.4);
    else if (e.key === "-") zoomAt(cssW / 2, cssH / 2, 1 / 1.4);
  });

  window.addEventListener("resize", resize);
  if (document.fonts) document.fonts.ready.then(() => (staticDirty = true));
  newGame();
  resize();
})();
