"use strict";

/* =========================================================
   Data
   ========================================================= */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const DATA = {
  production2025: [2400, 5000, 4000, 1500, 1200, 1000, 3000, 3500, 4700, 6000, 4500, 3700],
  production2024: [2100, 3900, 4200, 2300, 1800, 1400, 2600, 3100, 3900, 4800, 4600, 3300],
  revenue: [96, 188, 152, 63, 51, 44, 118, 137, 181, 226, 172, 143], // k€
  scrap: [2.8, 2.1, 2.4, 3.6, 3.9, 4.2, 3.1, 2.7, 2.2, 1.9, 2.3, 2.6], // %
  vacationMonthly: [40, 10, 2, 23, 10, 12, 50, 55, 10, 3, 12, 23],
  vacationTarget: 250,
  targetBand: [75, 90],
  machines: [
    { name: "CNC lathe 1", value: 88 },
    { name: "CNC lathe 2", value: 81 },
    { name: "5-axis mill", value: 94 },
    { name: "Surface grinder", value: 72 },
    { name: "Cylindrical grinder", value: 79 },
    { name: "Wire EDM", value: 58 },
    { name: "Laser cutter", value: 84 },
  ],
};

/* =========================================================
   Utilities
   ========================================================= */
const NS = "http://www.w3.org/2000/svg";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const fmt = (n, d = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const sum = (a) => a.reduce((s, v) => s + v, 0);
const avg = (a) => sum(a) / a.length;
const cumulative = (a) => { let s = 0; return a.map((v) => (s += v)); };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const pct = (now, before) => {
  const d = ((now - before) / before) * 100;
  return `${d >= 0 ? "+" : "−"}${fmt(Math.abs(d), 1)}`;
};

function svgEl(tag, attrs = {}, parent) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
}

const linear = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

function niceStep(raw) {
  const mag = 10 ** Math.floor(Math.log10(raw));
  const r = raw / mag;
  return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * mag;
}

function niceScale(max, target = 4) {
  const step = niceStep(max / target);
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { top, step, ticks };
}

const toPath = (pts) =>
  pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");

function interpY(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
}

/* =========================================================
   Readout (tooltip)
   ========================================================= */
const readout = document.createElement("div");
readout.className = "readout";
readout.setAttribute("aria-live", "polite");
document.body.appendChild(readout);

function placeReadout(x, y) {
  const r = readout.getBoundingClientRect();
  let left = x + 16;
  let top = y - r.height - 14;
  if (left + r.width > window.innerWidth - 8) left = x - r.width - 16;
  if (top < 8) top = y + 18;
  readout.style.left = `${Math.max(8, left)}px`;
  readout.style.top = `${top}px`;
}

function showReadout(html, x, y) {
  readout.innerHTML = html;
  readout.classList.add("is-on");
  placeReadout(x, y);
}

function hideReadout() {
  readout.classList.remove("is-on");
  document.querySelectorAll(".highlight.is-on").forEach((h) => h.classList.remove("is-on"));
}

// Readout content: title + rows of [swatch, label, value]
const rows = (title, items) =>
  `<strong>${title}</strong>` +
  items
    .map(([sw, k, v]) => `<span class="row"><span><i class="sw sw--${sw}"></i>${k}</span><b>${v}</b></span>`)
    .join("");

function bindReadout(target, html, on = () => {}) {
  target.addEventListener("pointerenter", (e) => { on(); showReadout(html(), e.clientX, e.clientY); });
  target.addEventListener("pointermove", (e) => placeReadout(e.clientX, e.clientY));
  target.addEventListener("pointerleave", (e) => { if (e.pointerType !== "touch") hideReadout(); });
  target.addEventListener("focus", () => {
    on();
    const b = target.getBoundingClientRect();
    showReadout(html(), b.left + b.width / 2, b.top + 16);
  });
  target.addEventListener("blur", hideReadout);
}

// Tap outside a chart closes the readout on touch devices
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest || !e.target.closest(".hit")) hideReadout();
});

/* =========================================================
   Chart building blocks
   ========================================================= */
function makeFrame(host, { ratio = 0.4, min = 220, max = 380, height, margin, label }) {
  const w = Math.max(280, Math.floor(host.clientWidth));
  const m = margin(w);
  const h = height ? height(m) : Math.round(clamp(w * ratio, min, max));
  const svg = svgEl("svg", {
    viewBox: `0 0 ${w} ${h}`,
    width: w,
    height: h,
    role: "group",
    "aria-label": label,
  });
  host.replaceChildren(svg);
  return { svg, w, h, m, x0: m.l, x1: w - m.r, y0: h - m.b, y1: m.t };
}

function defs(svg) {
  let d = svg.querySelector("defs");
  if (!d) { d = svgEl("defs"); svg.prepend(d); }
  return d;
}

// Section hatching, like a cut surface on a technical drawing
function addHatch(svg, id, cls, gap = 5) {
  const p = svgEl("pattern", {
    id, width: gap, height: gap,
    patternUnits: "userSpaceOnUse",
    patternTransform: "rotate(45)",
  }, defs(svg));
  svgEl("line", { x1: gap / 2, y1: 0, x2: gap / 2, y2: gap, class: cls }, p);
  return `url(#${id})`;
}

function addClip(svg, id, x, width, height) {
  const c = svgEl("clipPath", { id }, defs(svg));
  return svgEl("rect", { x, y: 0, width, height }, c);
}

function monthBands(f) {
  const bw = (f.x1 - f.x0) / 12;
  return { bw, xAt: (i) => f.x0 + bw * (i + 0.5) };
}

function drawValueAxis(f, scale, ticks, { side = "left", format = fmt, grid = true, cls = "" } = {}) {
  const g = svgEl("g", { class: `axis ${cls}` }, f.svg);
  const x = side === "left" ? f.x0 : f.x1;
  svgEl("line", { x1: x, y1: f.y1 - 6, x2: x, y2: f.y0, class: "axis-line" }, g);
  ticks.forEach((v) => {
    const y = scale(v);
    if (grid && v > 0) svgEl("line", { x1: f.x0, y1: y, x2: f.x1, y2: y, class: "guide" }, g);
    svgEl("line", { x1: x - 4, y1: y, x2: x + 4, y2: y, class: "tick" }, g);
    const t = svgEl("text", {
      x: side === "left" ? x - 9 : x + 9,
      y,
      "text-anchor": side === "left" ? "end" : "start",
      "dominant-baseline": "middle",
    }, g);
    t.textContent = format(v);
  });
}

function drawMonthAxis(f, bands) {
  const g = svgEl("g", { class: "axis" }, f.svg);
  svgEl("line", { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0, class: "axis-line" }, g);
  const every = bands.bw < 30 ? 2 : 1;
  MONTHS.forEach((mo, i) => {
    const x = bands.xAt(i);
    svgEl("line", { x1: x, y1: f.y0 - 3, x2: x, y2: f.y0 + 3, class: "tick" }, g);
    if (i % every === 0) {
      const t = svgEl("text", { x, y: f.y0 + 19, "text-anchor": "middle" }, g);
      t.textContent = mo;
    }
  });
}

// Invisible, focusable month columns + highlighter band
function addMonthHits(f, bands, hlLayer, { label, html }) {
  const hl = svgEl("rect", {
    class: "highlight",
    x: -9999, y: f.y1 - 6,
    width: bands.bw * 0.86, height: f.y0 - f.y1 + 6,
  }, hlLayer);
  const hits = svgEl("g", { class: "hits" }, f.svg);
  MONTHS.forEach((_, i) => {
    const r = svgEl("rect", {
      x: f.x0 + bands.bw * i, y: f.y1 - 6,
      width: bands.bw, height: f.y0 - f.y1 + 6,
      class: "hit", tabindex: 0, "aria-label": label(i),
    }, hits);
    bindReadout(r, () => html(i), () => {
      hl.setAttribute("x", bands.xAt(i) - bands.bw * 0.43);
      hl.classList.add("is-on");
    });
  });
}

/* =========================================================
   Motion: plotter pen + growing bars
   ========================================================= */
function plotterReveal(svg, clipRect, xStart, xEnd, pts, { duration = 2000, delay = 0, pen = "" } = {}) {
  if (reduceMotion) return;
  clipRect.setAttribute("width", 0);
  const head = svgEl("g", { class: `pen ${pen}` }, svg);
  svgEl("circle", { r: 6, class: "pen-ring" }, head);
  svgEl("circle", { r: 2.2, class: "pen-tip" }, head);

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const t0 = performance.now() + delay;
  const firstX = pts[0][0];
  const lastX = pts[pts.length - 1][0];

  const frame = (now) => {
    const t = clamp((now - t0) / duration, 0, 1);
    const x = xStart + (xEnd - xStart) * ease(t);
    clipRect.setAttribute("width", Math.max(0, x - xStart));
    const px = clamp(x, firstX, lastX);
    head.setAttribute("transform", `translate(${px.toFixed(1)},${interpY(pts, px).toFixed(1)})`);
    if (t < 1) requestAnimationFrame(frame);
    else {
      head.classList.add("is-lifted");
      setTimeout(() => head.remove(), 400);
    }
  };
  requestAnimationFrame(frame);
}

function tweenBars(bars, base, from, to, { horizontal = false, duration = 700, delay = 0, stagger = 40 } = {}) {
  const apply = (b, v) => {
    v = Math.max(0, v);
    if (horizontal) b.setAttribute("width", v);
    else { b.setAttribute("y", base - v); b.setAttribute("height", v); }
  };
  if (reduceMotion) { bars.forEach((b, i) => apply(b, to[i])); return; }
  bars.forEach((b, i) => apply(b, from[i]));

  const ease = (t) => 1 - (1 - t) ** 3;
  const t0 = performance.now() + delay;
  const frame = (now) => {
    let running = false;
    bars.forEach((b, i) => {
      const t = clamp((now - t0 - i * stagger) / duration, 0, 1);
      if (t < 1) running = true;
      apply(b, from[i] + (to[i] - from[i]) * ease(t));
    });
    if (running) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* =========================================================
   View A: production line chart
   ========================================================= */
function renderProduction(animate = false) {
  const host = document.getElementById("chart-production");
  const a = DATA.production2025;
  const b = DATA.production2024;

  const f = makeFrame(host, {
    ratio: 0.36, min: 250, max: 380,
    label: "Line chart: parts produced per month, 2025 compared with 2024, with the 2025 average",
    margin: (w) => ({ t: 16, r: w < 560 ? 16 : 76, b: 34, l: 52 }),
  });

  const { top, ticks } = niceScale(Math.max(...a, ...b) * 1.12);
  const y = linear(0, top, f.y0, f.y1);
  const bands = monthBands(f);

  drawValueAxis(f, y, ticks);
  drawMonthAxis(f, bands);
  const hl = svgEl("g", {}, f.svg);

  const clip = addClip(f.svg, "clip-production", f.x0 - 8, f.w, f.h);
  const data = svgEl("g", { "clip-path": "url(#clip-production)" }, f.svg);

  const pa = a.map((v, i) => [bands.xAt(i), y(v)]);
  const pb = b.map((v, i) => [bands.xAt(i), y(v)]);

  svgEl("path", { d: toPath(pb), class: "line line--previous" }, data);
  svgEl("path", {
    d: `${toPath(pa)}L${pa[11][0]},${f.y0}L${pa[0][0]},${f.y0}Z`,
    class: "area",
  }, data);
  svgEl("path", { d: toPath(pa), class: "line line--current" }, data);

  // Average as a dash-dot center line
  const mean = avg(a);
  const ym = y(mean);
  svgEl("line", { x1: f.x0, y1: ym, x2: f.x1, y2: ym, class: "centerline" }, data);
  const wide = f.m.r > 40;
  const lbl = svgEl("text", {
    x: wide ? f.x1 + 8 : f.x0 + 6,
    y: wide ? ym : ym - 8,
    "text-anchor": "start",
    "dominant-baseline": wide ? "middle" : "auto",
    class: "label label--red",
  }, data);
  lbl.textContent = `Ø ${fmt(mean)}`;

  pa.forEach(([cx, cy]) => svgEl("circle", { cx, cy, r: 3.3, class: "dot" }, data));

  addMonthHits(f, bands, hl, {
    label: (i) => `${MONTHS_LONG[i]}: ${fmt(a[i])} parts in 2025, ${fmt(b[i])} in 2024`,
    html: (i) => rows(MONTHS_LONG[i], [
      ["ink", "2025", fmt(a[i])],
      ["dashed", "2024", fmt(b[i])],
      ["none", "Change", `${pct(a[i], b[i])} %`],
      ["none", "vs. average", `${a[i] >= mean ? "+" : "−"}${fmt(Math.abs(a[i] - mean))}`],
    ]),
  });

  if (animate) plotterReveal(f.svg, clip, f.x0 - 8, f.w, pa, { duration: 2200 });
}

/* =========================================================
   View B: revenue bars + scrap rate line (dual axis)
   ========================================================= */
function renderRevenue(animate = false) {
  const host = document.getElementById("chart-revenue");
  const rev = DATA.revenue;
  const scrap = DATA.scrap;

  const f = makeFrame(host, {
    ratio: 0.55, min: 240, max: 340,
    label: "Bar chart of monthly revenue in thousand euros with a line for the scrap rate in percent",
    margin: () => ({ t: 16, r: 42, b: 34, l: 46 }),
  });

  const L = niceScale(Math.max(...rev) * 1.12);
  const n = L.ticks.length - 1;
  const rStep = niceStep((Math.max(...scrap) * 1.15) / n);
  const rTicks = Array.from({ length: n + 1 }, (_, i) => +(i * rStep).toFixed(4));
  const yL = linear(0, L.top, f.y0, f.y1);
  const yR = linear(0, rStep * n, f.y0, f.y1);
  const bands = monthBands(f);
  const hatch = addHatch(f.svg, "hatch-revenue", "hatch-ink");

  drawValueAxis(f, yL, L.ticks);
  drawValueAxis(f, yR, rTicks, { side: "right", grid: false, cls: "axis--red", format: (v) => `${fmt(v)}%` });
  drawMonthAxis(f, bands);
  const hl = svgEl("g", {}, f.svg);

  const bw = Math.min(28, bands.bw * 0.58);
  const bars = rev.map((v, i) =>
    svgEl("rect", {
      x: bands.xAt(i) - bw / 2, y: yL(v),
      width: bw, height: f.y0 - yL(v),
      class: "bar", fill: hatch,
    }, f.svg)
  );

  const clip = addClip(f.svg, "clip-revenue", f.x0 - 8, f.w, f.h);
  const lineG = svgEl("g", { "clip-path": "url(#clip-revenue)" }, f.svg);
  const ps = scrap.map((v, i) => [bands.xAt(i), yR(v)]);
  svgEl("path", { d: toPath(ps), class: "line line--red" }, lineG);
  ps.forEach(([cx, cy]) => svgEl("rect", { x: cx - 3.2, y: cy - 3.2, width: 6.4, height: 6.4, class: "marker" }, lineG));

  addMonthHits(f, bands, hl, {
    label: (i) => `${MONTHS_LONG[i]}: revenue ${rev[i]} thousand euros, scrap rate ${scrap[i]} percent`,
    html: (i) => rows(MONTHS_LONG[i], [
      ["hatch", "Revenue", `${fmt(rev[i])}k €`],
      ["red", "Scrap rate", `${fmt(scrap[i], 1)} %`],
    ]),
  });

  if (animate) {
    const heights = bars.map((r) => +r.getAttribute("height"));
    tweenBars(bars, f.y0, heights.map(() => 0), heights, { delay: 350 });
    plotterReveal(f.svg, clip, f.x0 - 8, f.w, ps, { duration: 1600, delay: 900, pen: "pen--red" });
  }
}

/* =========================================================
   View C: vacation bars (running total / per month)
   ========================================================= */
let vacationMode = "total";
let vacationHeights = null;

function renderVacation({ animate = false, morph = false } = {}) {
  const host = document.getElementById("chart-vacation");
  const monthly = DATA.vacationMonthly;
  const total = cumulative(monthly);
  const target = DATA.vacationTarget;
  const pace = target / 12;
  const isTotal = vacationMode === "total";
  const vals = isTotal ? total : monthly;

  const f = makeFrame(host, {
    ratio: 0.7, min: 240, max: 330,
    label: isTotal
      ? "Bar chart: running total of vacation days taken per month against the entitlement of 250 days"
      : "Bar chart: vacation days taken in each month against an even monthly pace",
    margin: () => ({ t: 18, r: 14, b: 34, l: 40 }),
  });

  const S = niceScale((isTotal ? target : Math.max(...monthly)) * 1.12);
  const y = linear(0, S.top, f.y0, f.y1);
  const bands = monthBands(f);
  const hatch = addHatch(f.svg, "hatch-vacation", "hatch-ink");

  drawValueAxis(f, y, S.ticks);
  drawMonthAxis(f, bands);
  const hl = svgEl("g", {}, f.svg);

  const bw = Math.min(24, bands.bw * 0.62);
  const bars = vals.map((v, i) =>
    svgEl("rect", {
      x: bands.xAt(i) - bw / 2, y: y(v),
      width: bw, height: f.y0 - y(v),
      class: "bar", fill: hatch,
    }, f.svg)
  );

  if (isTotal) {
    // Even pace: straight line from zero to the full entitlement
    svgEl("line", { x1: f.x0, y1: f.y0, x2: f.x1, y2: y(target), class: "centerline centerline--pencil" }, f.svg);
    svgEl("line", { x1: f.x0, y1: y(target), x2: f.x1, y2: y(target), class: "limit" }, f.svg);
    const t = svgEl("text", { x: f.x0 + 6, y: y(target) - 7, class: "label label--red" }, f.svg);
    t.textContent = `Entitlement ${target}`;
  } else {
    svgEl("line", { x1: f.x0, y1: y(pace), x2: f.x1, y2: y(pace), class: "centerline centerline--pencil" }, f.svg);
    const t = svgEl("text", { x: f.x1, y: y(pace) - 7, "text-anchor": "end", class: "label" }, f.svg);
    t.textContent = `Even pace ${fmt(pace, 1)} / month`;
  }

  addMonthHits(f, bands, hl, {
    label: (i) => `${MONTHS_LONG[i]}: ${monthly[i]} days taken, ${total[i]} of ${target} in total`,
    html: (i) => rows(MONTHS_LONG[i], [
      ["hatch", "Taken this month", `${monthly[i]} days`],
      ["none", "Running total", `${total[i]} / ${target}`],
      ["center-pencil", "Even pace", fmt(pace * (i + 1), 1)],
      ["none", "Still open", `${target - total[i]} days`],
    ]),
  });

  const heights = bars.map((r) => +r.getAttribute("height"));
  if (morph && vacationHeights) tweenBars(bars, f.y0, vacationHeights, heights, { duration: 480, stagger: 18 });
  else if (animate) tweenBars(bars, f.y0, heights.map(() => 0), heights, { delay: 600 });
  vacationHeights = heights;
}

document.querySelectorAll(".toggle button").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.mode === vacationMode) return;
    vacationMode = btn.dataset.mode;
    document.querySelectorAll(".toggle button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b === btn))
    );
    document.querySelectorAll("[data-only]").forEach((el) => {
      el.hidden = el.dataset.only !== vacationMode;
    });
    renderVacation({ morph: true });
  });
});

/* =========================================================
   View D: machine utilization, horizontal bars
   ========================================================= */
function renderMachines(animate = false) {
  const host = document.getElementById("chart-machines");
  const list = DATA.machines;
  const [lo, hi] = DATA.targetBand;
  const rowH = 32;

  const f = makeFrame(host, {
    label: "Horizontal bar chart: utilization of seven machines against a target band of 75 to 90 percent",
    margin: (w) => ({ t: 24, r: 46, b: 30, l: w < 440 ? 124 : 146 }),
    height: (m) => m.t + m.b + rowH * list.length,
  });

  const x = linear(0, 100, f.x0, f.x1);
  const hatchInk = addHatch(f.svg, "hatch-machines-ink", "hatch-ink");
  const hatchRed = addHatch(f.svg, "hatch-machines-red", "hatch-red");

  // Target band (tolerance zone)
  svgEl("rect", { x: x(lo), y: f.y1 - 8, width: x(hi) - x(lo), height: f.y0 - f.y1 + 8, class: "band" }, f.svg);
  [lo, hi].forEach((v) => svgEl("line", { x1: x(v), y1: f.y1 - 8, x2: x(v), y2: f.y0, class: "band-edge" }, f.svg));
  const bandLbl = svgEl("text", { x: (x(lo) + x(hi)) / 2, y: f.y1 - 13, "text-anchor": "middle", class: "label" }, f.svg);
  bandLbl.textContent = "target band";

  // Axis
  const ax = svgEl("g", { class: "axis" }, f.svg);
  svgEl("line", { x1: f.x0, y1: f.y0, x2: f.x1, y2: f.y0, class: "axis-line" }, ax);
  svgEl("line", { x1: f.x0, y1: f.y1 - 8, x2: f.x0, y2: f.y0, class: "axis-line" }, ax);
  [0, 25, 50, 75, 100].forEach((v) => {
    if (v > 0) svgEl("line", { x1: x(v), y1: f.y1, x2: x(v), y2: f.y0, class: "guide" }, ax);
    svgEl("line", { x1: x(v), y1: f.y0 - 3, x2: x(v), y2: f.y0 + 3, class: "tick" }, ax);
    const t = svgEl("text", { x: x(v), y: f.y0 + 18, "text-anchor": "middle" }, ax);
    t.textContent = `${v}%`;
  });

  const hl = svgEl("g", {}, f.svg);
  const hits = svgEl("g", { class: "hits" }, f.svg);
  const bh = 15;
  const bars = [];

  list.forEach((mch, i) => {
    const cy = f.y1 + rowH * (i + 0.5);
    const status = mch.value < lo ? "low" : mch.value > hi ? "high" : "ok";

    const name = svgEl("text", { x: f.x0 - 10, y: cy, "text-anchor": "end", "dominant-baseline": "middle", class: "name" }, f.svg);
    name.textContent = mch.name;

    const attrs = { x: f.x0, y: cy - bh / 2, width: x(mch.value) - f.x0, height: bh, class: `hbar hbar--${status}` };
    if (status === "ok") attrs.fill = hatchInk;
    if (status === "high") attrs.fill = hatchRed;
    bars.push(svgEl("rect", attrs, f.svg));

    const val = svgEl("text", {
      x: x(mch.value) + 7, y: cy, "dominant-baseline": "middle",
      class: animate && !reduceMotion ? "value fade-in" : "value",
      style: `--d:${900 + i * 40}ms`,
    }, f.svg);
    val.textContent = `${mch.value}%`;

    const rowHl = svgEl("rect", { class: "highlight", x: 0, y: cy - rowH / 2, width: f.w, height: rowH }, hl);
    const hit = svgEl("rect", {
      x: 0, y: cy - rowH / 2, width: f.w, height: rowH,
      class: "hit", tabindex: 0, "aria-label": `${mch.name}: ${mch.value} percent utilization`,
    }, hits);

    const note =
      status === "ok" ? "In target band"
      : status === "low" ? `${lo - mch.value} pts below band`
      : `${mch.value - hi} pts above band`;

    bindReadout(hit, () => rows(mch.name, [
      [status === "high" ? "hatch-red" : status === "low" ? "outline" : "hatch", "Utilization", `${mch.value} %`],
      ["none", "Status", note],
    ]), () => rowHl.classList.add("is-on"));
  });

  if (animate) {
    const widths = bars.map((r) => +r.getAttribute("width"));
    tweenBars(bars, 0, widths.map(() => 0), widths, { horizontal: true, delay: 800, stagger: 50 });
  }
}

/* =========================================================
   Key figures (parts list)
   ========================================================= */
function fillParts() {
  const a = DATA.production2025;
  const b = DATA.production2024;
  const best = a.indexOf(Math.max(...a));
  const [lo, hi] = DATA.targetBand;
  const inBand = DATA.machines.filter((m) => m.value >= lo && m.value <= hi).length;

  const items = [
    ["Parts produced", fmt(sum(a)), "pcs", "a"],
    ["Monthly average", fmt(avg(a)), "pcs", "a"],
    ["Best month", `${fmt(a[best])} (${MONTHS[best]})`, "pcs", "a"],
    ["Change vs. 2024", pct(sum(a), sum(b)), "%", "a"],
    ["Revenue", fmt(sum(DATA.revenue)), "k€", "b"],
    ["Average scrap rate", fmt(avg(DATA.scrap), 1), "%", "b"],
    ["Vacation days taken", `${sum(DATA.vacationMonthly)} / ${DATA.vacationTarget}`, "days", "c"],
    ["Machines in target band", `${inBand} / ${DATA.machines.length}`, "", "d"],
  ];

  document.getElementById("parts-body").innerHTML = items
    .map(([item, value, unit, view], i) => `
      <tr>
        <td class="pos">${i + 1}</td>
        <td>${item}</td>
        <td class="num">${value}</td>
        <td>${unit}</td>
        <td class="pos"><a class="view-ref" href="#view-${view}" aria-label="Go to view ${view.toUpperCase()}">${view.toUpperCase()}</a></td>
      </tr>`)
    .join("");
}

/* =========================================================
   Init + responsive re-render
   ========================================================= */
function renderAll(animate = false) {
  renderProduction(animate);
  renderRevenue(animate);
  renderVacation({ animate });
  renderMachines(animate);
}

(document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
  fillParts();
  renderAll(true);

  const drawing = document.querySelector(".drawing");
  let lastW = drawing.clientWidth;
  let timer;
  new ResizeObserver(() => {
    const w = drawing.clientWidth;
    if (w === lastW) return;
    lastW = w;
    clearTimeout(timer);
    timer = setTimeout(() => { hideReadout(); renderAll(false); }, 120);
  }).observe(drawing);
});