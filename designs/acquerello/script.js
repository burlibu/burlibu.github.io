// Erbario: paints every canvas.paint once it nears the viewport (and again when
// its size changes), draws pencil outlines around .sketch boxes, masks the photo
// with a wet ragged edge, and runs the reveal + mobile menu.
(function () {
  const P = window.Paint, C = P.PALETTE;
  const params = new URLSearchParams(location.search);
  const root = document.documentElement;
  root.classList.add("js");
  if (params.has("preview") || params.has("bare")) root.classList.add("bare");

  const colorOf = (el, fallback) => {
    const c = el.closest("[data-c]");
    return (c && c.dataset.c) || fallback;
  };
  const seedOf = (el, fallback) => Number(el.dataset.seed || (el.closest("[data-seed]") || {}).dataset?.seed || fallback);

  // a stem along a bent cubic with alternating leaves; returns the stem points
  function sprig(ctx, x, y, ang, len, o = {}) {
    const r = P.rng(o.seed || 21), bend = o.bend ?? 0.18, c = Math.cos(ang), s = Math.sin(ang);
    const at = (u, v) => [x + c * u * len - s * v * len, y + s * u * len + c * v * len];
    const pts = P.curve(at(0, 0), at(0.33, bend), at(0.66, -bend * 0.4), at(1, bend * 0.3), 80);
    P.brush(ctx, pts, o.stem || Math.max(2, len * 0.016), o.stemColor || "moss", { seed: o.seed, alpha: 0.4 });
    const n = o.leaves ?? 7, colors = o.colors || ["sage"];
    for (let i = 0; i < n; i++) {
      const t = 0.14 + (0.78 * i) / n, k = Math.round(t * 80), p = pts[k];
      const a = Math.atan2(pts[k + 1][1] - pts[k - 1][1], pts[k + 1][0] - pts[k - 1][0]);
      const side = i % 2 ? 1 : -1;
      P.leaf(ctx, p[0], p[1], a + side * (0.85 - 0.3 * t) + (r() - 0.5) * 0.25, len * (o.leafLen || 0.3) * (1 - 0.45 * t), colors[i % colors.length], {
        seed: (o.seed || 21) * 7 + i,
        tint: r() < (o.tintChance ?? 0.4) ? (r() < 0.5 ? "ochre" : "rose") : null,
        width: 0.3 + r() * 0.08,
      });
    }
    const e = pts[80], a = Math.atan2(e[1] - pts[76][1], e[0] - pts[76][0]);
    P.leaf(ctx, e[0], e[1], a, len * (o.leafLen || 0.3) * 0.5, colors[0], { seed: (o.seed || 21) * 7 + 99 });
    return pts;
  }

  function berries(ctx, x, y, size, seed) {
    const r = P.rng(seed);
    for (let i = 0; i < 6; i++) {
      const bx = x + (r() - 0.5) * size * 2.6, by = y + (r() - 0.5) * size * 2.2, br = size * (0.42 + r() * 0.3);
      P.brush(ctx, P.curve([x, y], [x, (y + by) / 2], [(x + bx) / 2, by], [bx, by], 12), 1.4, "moss", { seed: seed + i, alpha: 0.35, body: false });
      P.wash(ctx, P.blob(bx, by, br, br, seed + i, 0.5), r() < 0.6 ? "terracotta" : "rose", { seed: seed + i, alpha: 0.12, layers: 12, depth: 2, layerDepth: 2, spread: 0.35, rim: 0.12 });
      // the paper left bare where the light hits
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,.55)";
      ctx.beginPath();
      ctx.ellipse(bx - br * 0.3, by - br * 0.32, br * 0.2, br * 0.13, -0.6, 0, 6.3);
      ctx.fill();
      ctx.restore();
    }
  }

  const PAINTERS = {
    logo(ctx, w, h) {
      P.wash(ctx, P.blob(w * 0.48, h * 0.5, w * 0.36, h * 0.34, 4, 0.8), "sage", { seed: 4, alpha: 0.07, layers: 18 });
      P.wash(ctx, P.blob(w * 0.7, h * 0.66, w * 0.16, h * 0.15, 6, 0.8), "ochre", { seed: 6, alpha: 0.08, layers: 14 });
    },
    heroBg(ctx, w, h) {
      // stacked on phones, the big sage wash moves down behind the painting, away from the text
      const stacked = w < 1000;
      P.wash(ctx, stacked ? P.blob(w * 0.62, h * 0.78, w * 0.42, h * 0.2, 31) : P.blob(w * 0.76, h * 0.44, w * 0.22, h * 0.32, 31), "sage", { seed: 31, alpha: 0.022, layers: 34 });
      P.wash(ctx, P.blob(w * 0.88, h * 0.18, w * 0.12, h * 0.14, 32), "ochre", { seed: 32, alpha: 0.03, layers: 26 });
      P.wash(ctx, P.blob(w * 0.08, h * 0.86, w * 0.17, h * 0.15, 33), "rose", { seed: 33, alpha: 0.03, layers: 28 });
      P.wash(ctx, P.blob(w * 0.42, h * 0.08, w * 0.08, h * 0.07, 34), "ochre", { seed: 34, alpha: 0.025, layers: 20 });
      P.bloom(ctx, w * 0.7, h * 0.5, Math.min(w, h) * 0.07, "sage", 35);
      P.stain(ctx, w * 0.3, h * 0.9, w * 0.07, h * 0.05, "ochre", 36);
      P.stain(ctx, w * 0.95, h * 0.72, w * 0.05, h * 0.06, "indigo", 37);
      P.splatter(ctx, w * 0.16, h * 0.18, Math.min(w, h) * 0.08, "terracotta", { seed: 38, n: 26, size: 4 });
      P.splatter(ctx, w * 0.58, h * 0.92, Math.min(w, h) * 0.1, "indigo", { seed: 39, n: 20, size: 3 });
    },
    looseLeaf(ctx, w, h, el) {
      const seed = seedOf(el, 41);
      P.leaf(ctx, w * 0.14, h * 0.82, -0.85, w * 0.82, seed % 2 ? "sage" : "moss", { seed, tint: seed % 2 ? "ochre" : "rose", alpha: 0.1 });
    },
    word(ctx, w, h, el) {
      const seed = 50 + el.closest("[data-c]").textContent.length;
      P.wash(ctx, P.blob(w * 0.5, h * 0.56, w * 0.47, h * 0.36, seed, 0.45), colorOf(el, "ochre"), { seed, alpha: 0.055, layers: 22, spread: 0.4, rim: 0.08 });
    },
    under(ctx, w, h, el) {
      const seed = 60 + el.closest("[data-c]").textContent.length;
      const pts = P.curve([w * 0.02, h * 0.62], [w * 0.3, h * 0.38], [w * 0.7, h * 0.72], [w * 0.98, h * 0.3], 70);
      P.brush(ctx, pts, h * 0.62, colorOf(el, "terracotta"), { seed, alpha: 0.5, gaps: 0.02 });
    },
    roundBtn(ctx, w, h) {
      P.wash(ctx, P.blob(w / 2, h / 2, w * 0.43, h * 0.43, 71, 0.32), "indigo", { seed: 71, alpha: 0.075, layers: 30, spread: 0.35, rim: 0.1 });
      P.wash(ctx, P.blob(w * 0.66, h * 0.66, w * 0.2, h * 0.2, 72, 0.6), "moss", { seed: 72, alpha: 0.05, layers: 14, rim: 0 });
      P.bloom(ctx, w * 0.34, h * 0.32, w * 0.06, "indigo", 73);
    },
    heroArt(ctx, w, h) {
      const m = Math.min(w, h);
      P.wash(ctx, P.blob(w * 0.52, h * 0.5, w * 0.36, h * 0.34, 81), "ochre", { seed: 81, alpha: 0.025, layers: 30 });
      P.wash(ctx, P.blob(w * 0.36, h * 0.66, w * 0.24, h * 0.2, 82), "rose", { seed: 82, alpha: 0.028, layers: 26 });
      P.stain(ctx, w * 0.7, h * 0.22, m * 0.12, m * 0.1, "sage", 83);
      const stem = sprig(ctx, w * 0.42, h * 0.97, -1.42, h * 0.86, { seed: 84, leaves: 9, leafLen: 0.27, bend: 0.12, colors: ["sage", "moss", "sage"] });
      const p = stem[46];
      const side = sprig(ctx, p[0], p[1], -0.55, h * 0.26, { seed: 85, leaves: 3, leafLen: 0.32, bend: -0.2, stem: 2, tintChance: 0.8 });
      berries(ctx, side[80][0] + m * 0.04, side[80][1] - m * 0.02, m * 0.032, 86);
      sprig(ctx, w * 0.46, h * 0.96, -1.95, h * 0.42, { seed: 87, leaves: 4, leafLen: 0.36, colors: ["moss", "sage"], tintChance: 0.6 });
      P.splatter(ctx, w * 0.74, h * 0.6, m * 0.14, "terracotta", { seed: 88, n: 30, size: 4.5 });
      P.splatter(ctx, w * 0.22, h * 0.3, m * 0.1, "indigo", { seed: 89, n: 18, size: 3 });
    },
    servBg(ctx, w, h) {
      P.wash(ctx, P.blob(w * 0.5, h * 0.55, w * 0.42, h * 0.3, 91), "sage", { seed: 91, alpha: 0.014, layers: 30 });
      sprig(ctx, w * 0.03, h * 0.98, -1.05, Math.min(h, w * 0.6) * 0.36, { seed: 92, leaves: 5, leafLen: 0.34, colors: ["sage", "moss"] });
      sprig(ctx, w * 0.98, h * 0.12, 2.5, Math.min(h, w * 0.6) * 0.28, { seed: 93, leaves: 5, leafLen: 0.34, colors: ["moss", "sage"], tintChance: 0.7 });
      P.splatter(ctx, w * 0.92, h * 0.86, Math.min(w, h) * 0.08, "ochre", { seed: 94, n: 22 });
    },
    cardBack(ctx, w, h, el) {
      const seed = seedOf(el, 11), c = colorOf(el, "sage"), accent = { sage: "ochre", rose: "terracotta", indigo: "sage" }[c] || "ochre";
      P.wash(ctx, P.blob(w * 0.5, h * 0.5, w * 0.44, h * 0.43, seed, 0.9), c, { seed, alpha: 0.04, layers: 26 });
      P.wash(ctx, P.blob(w * (seed % 2 ? 0.2 : 0.8), h * 0.16, w * 0.16, h * 0.12, seed + 1), accent, { seed: seed + 1, alpha: 0.05, layers: 18 });
      P.bloom(ctx, w * (seed % 2 ? 0.86 : 0.14), h * 0.8, w * 0.07, c, seed + 2);
      P.splatter(ctx, w * (seed % 2 ? 0.12 : 0.9), h * 0.88, w * 0.08, accent, { seed: seed + 3, n: 14, size: 3 });
    },
    iconLeaf(ctx, w, h) {
      P.leaf(ctx, w * 0.2, h * 0.86, -0.95, w * 0.74, "sage", { seed: 101, tint: "ochre", alpha: 0.12, layers: 14 });
      P.leaf(ctx, w * 0.24, h * 0.86, -0.25, w * 0.5, "moss", { seed: 102, alpha: 0.1, layers: 12 });
    },
    iconBrand(ctx, w, h) {
      P.wash(ctx, P.blob(w * 0.46, h * 0.5, w * 0.3, h * 0.3, 111, 0.7), "rose", { seed: 111, alpha: 0.1, layers: 18 });
      const pts = [];
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, a = t * 5.6 + 0.6, rad = w * (0.08 + 0.22 * t);
        pts.push([w * 0.5 + Math.cos(a) * rad, h * 0.5 + Math.sin(a) * rad * 0.9]);
      }
      P.brush(ctx, pts, 4, "terracotta", { seed: 112, alpha: 0.55 });
    },
    iconWeb(ctx, w, h) {
      P.wash(ctx, [[w * 0.12, h * 0.2, 0.06], [w * 0.88, h * 0.16, 0.06], [w * 0.9, h * 0.8, 0.06], [w * 0.1, h * 0.84, 0.06]], "indigo", { seed: 121, alpha: 0.07, layers: 16 });
      [0.36, 0.52, 0.66].forEach((y, i) =>
        P.brush(ctx, P.curve([w * 0.24, h * y], [w * 0.4, h * (y - 0.03)], [w * 0.55, h * (y + 0.03)], [w * (i ? 0.64 : 0.78), h * y], 30), 3, "ink", { seed: 122 + i, alpha: 0.5, body: false })
      );
      P.wash(ctx, P.blob(w * 0.76, h * 0.26, w * 0.07, h * 0.07, 125, 0.4), "ochre", { seed: 125, alpha: 0.16, layers: 10 });
    },
    methodBg(ctx, w, h) {
      P.wash(ctx, P.blob(w * 0.3, h * 0.5, w * 0.26, h * 0.36, 131), "rose", { seed: 131, alpha: 0.022, layers: 30 });
      P.wash(ctx, P.blob(w * 0.12, h * 0.2, w * 0.1, h * 0.12, 132), "ochre", { seed: 132, alpha: 0.03, layers: 22 });
      P.stain(ctx, w * 0.82, h * 0.2, w * 0.06, h * 0.08, "terracotta", 133);
      sprig(ctx, w * 0.97, h * 0.97, -2.3, Math.min(h, w * 0.6) * 0.38, { seed: 134, leaves: 6, leafLen: 0.3, colors: ["sage", "moss"] });
      P.splatter(ctx, w * 0.5, h * 0.12, Math.min(w, h) * 0.08, "sage", { seed: 135, n: 18 });
    },
    footBg(ctx, w, h) {
      P.wash(ctx, P.blob(w * 0.5, h * 0.48, w * 0.32, h * 0.32, 141), "ochre", { seed: 141, alpha: 0.018, layers: 30 });
      P.wash(ctx, P.blob(w * 0.22, h * 0.62, w * 0.14, h * 0.2, 142), "sage", { seed: 142, alpha: 0.025, layers: 24 });
      P.wash(ctx, P.blob(w * 0.8, h * 0.4, w * 0.13, h * 0.18, 143), "indigo", { seed: 143, alpha: 0.018, layers: 24 });
      sprig(ctx, w * 0.06, h * 0.06, 0.75, Math.min(h, w * 0.6) * 0.42, { seed: 144, leaves: 5, leafLen: 0.32, colors: ["moss", "sage"], tintChance: 0.6 });
      sprig(ctx, w * 0.95, h * 0.95, -2.2, Math.min(h, w * 0.6) * 0.34, { seed: 145, leaves: 5, leafLen: 0.32 });
      P.splatter(ctx, w * 0.66, h * 0.18, Math.min(w, h) * 0.09, "terracotta", { seed: 146, n: 22 });
    },
    // mockup.html: the sheet the devices lie on, and the pigment swatches
    layBg(ctx, w, h) {
      P.wash(ctx, P.blob(w * 0.36, h * 0.36, w * 0.3, h * 0.22, 161), "sage", { seed: 161, alpha: 0.018, layers: 30 });
      P.wash(ctx, P.blob(w * 0.82, h * 0.5, w * 0.16, h * 0.2, 162), "rose", { seed: 162, alpha: 0.025, layers: 26 });
      P.wash(ctx, P.blob(w * 0.2, h * 0.84, w * 0.2, h * 0.12, 163), "ochre", { seed: 163, alpha: 0.025, layers: 26 });
      P.stain(ctx, w * 0.92, h * 0.12, w * 0.05, h * 0.04, "indigo", 164);
      sprig(ctx, w * 0.99, h * 0.62, 2.6, Math.min(h, w * 0.6) * 0.3, { seed: 165, leaves: 6, leafLen: 0.3 });
      sprig(ctx, w * 0.02, h * 0.42, -0.6, Math.min(h, w * 0.6) * 0.22, { seed: 166, leaves: 5, leafLen: 0.34, colors: ["moss", "sage"], tintChance: 0.6 });
      P.splatter(ctx, w * 0.6, h * 0.08, Math.min(w, h) * 0.06, "terracotta", { seed: 167, n: 24 });
    },
    swatch(ctx, w, h, el) {
      const seed = seedOf(el, 1), c = colorOf(el, "sage");
      // a brushed patch: dense where the brush landed, thinning to the right
      P.wash(ctx, [[w * 0.08, h * 0.16, 0.08], [w * 0.7, h * 0.12, 0.1], [w * 0.94, h * 0.5, 0.14], [w * 0.72, h * 0.86, 0.1], [w * 0.1, h * 0.84, 0.08]], c, { seed, alpha: 0.06, layers: 24, rim: 0.1 });
      P.wash(ctx, P.blob(w * 0.3, h * 0.5, w * 0.2, h * 0.3, seed + 1, 0.6), c, { seed: seed + 1, alpha: 0.05, layers: 14, rim: 0 });
      P.bloom(ctx, w * 0.62, h * 0.46, h * 0.16, c, seed + 2);
    },
    dot(ctx, w, h, el) {
      const seed = seedOf(el, 3);
      P.wash(ctx, P.blob(w / 2, h / 2, w * 0.4, h * 0.38, seed, 0.6), colorOf(el, "ochre"), { seed, alpha: 0.075, layers: 18 });
    },
  };

  const sizes = new WeakMap();
  function paint(cv) {
    const w = cv.offsetWidth, h = cv.offsetHeight;
    if (!w || !h || sizes.get(cv) === w + "x" + h) return;
    sizes.set(cv, w + "x" + h);
    // section backdrops are soft and huge: one pixel per CSS pixel is plenty
    const { ctx } = P.setup(cv, cv.classList.contains("bg") ? 1 : 2);
    PAINTERS[cv.dataset.p](ctx, w, h, cv);
    cv.classList.add("painted");
  }

  // hand-drawn rounded rectangle: the perimeter sampled every few px, nudged by
  // slow random waves, overshooting where the pencil comes back to its start
  function pencil(w, h, seed) {
    const r = P.rng(seed), rad = [8, 14, 10, 18].map((v) => Math.min(v + r() * 10, w / 3, h / 3));
    const pts = [];
    const arc = (cx, cy, rr, a0) => {
      for (let i = 0; i <= 6; i++) pts.push([cx + Math.cos(a0 + (i / 6) * 1.5708) * rr, cy + Math.sin(a0 + (i / 6) * 1.5708) * rr]);
    };
    const line = (x0, y0, x1, y1) => {
      const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 14));
      for (let i = 1; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
    };
    arc(rad[0], rad[0], rad[0], Math.PI);
    line(rad[0], 0, w - rad[1], 0);
    arc(w - rad[1], rad[1], rad[1], -1.5708);
    line(w, rad[1], w, h - rad[2]);
    arc(w - rad[2], h - rad[2], rad[2], 0);
    line(w - rad[2], h, rad[3], h);
    arc(rad[3], h - rad[3], rad[3], 1.5708);
    line(0, h - rad[3], 0, rad[0]);
    const ph = [r() * 6, r() * 6, r() * 6], amp = 1.6;
    const total = pts.length, extra = Math.round(total * 0.06);
    const out = [];
    for (let i = 0; i < total + extra; i++) {
      const p = pts[i % total], t = i / total;
      const d = amp * (Math.sin(t * 6.28 * 3 + ph[0]) * 0.6 + Math.sin(t * 6.28 * 7 + ph[1]) * 0.3 + Math.sin(t * 6.28 * 13 + ph[2]) * 0.15);
      const lift = i >= total ? (i - total + 1) * 0.35 : 0;
      out.push([p[0] + 6 + d + lift * 0.4, p[1] + 6 + d * 0.7 - lift]);
    }
    let dPath = `M${out[0][0].toFixed(1)} ${out[0][1].toFixed(1)}`;
    for (let i = 1; i < out.length - 1; i++) {
      const mx = (out[i][0] + out[i + 1][0]) / 2, my = (out[i][1] + out[i + 1][1]) / 2;
      dPath += `Q${out[i][0].toFixed(1)} ${out[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    }
    return dPath;
  }

  const NS = "http://www.w3.org/2000/svg";
  function outline(el, i) {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w || sizes.get(el) === w + "x" + h) return;
    sizes.set(el, w + "x" + h);
    let svg = el.querySelector(":scope > .pencil");
    if (!svg) {
      svg = document.createElementNS(NS, "svg");
      svg.setAttribute("class", "pencil");
      svg.setAttribute("aria-hidden", "true");
      svg.append(document.createElementNS(NS, "path"), document.createElementNS(NS, "path"));
      el.prepend(svg);
    }
    svg.setAttribute("viewBox", `0 0 ${w + 12} ${h + 12}`);
    const seed = Number(el.dataset.seed || 0) + i * 17 + 5;
    svg.children[0].setAttribute("d", pencil(w, h, seed));
    svg.children[1].setAttribute("d", pencil(w, h, seed + 101));
  }

  // a soft, ragged alpha mask so the photo bleeds into the paper like a wet wash
  function maskPhoto(img) {
    const cv = document.createElement("canvas"), w = 700, h = Math.round((700 * img.height) / img.width) || 467;
    cv.width = w;
    cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff";
    P.wash(ctx, P.blob(w / 2, h / 2, w * 0.44, h * 0.42, 151, 0.38), [255, 255, 255], { seed: 151, alpha: 0.11, layers: 30, comp: "source-over", rim: 0 });
    P.bloom(ctx, w * 0.8, h * 0.24, w * 0.05, "black", 152);
    const url = `url(${cv.toDataURL()})`;
    img.style.webkitMaskImage = img.style.maskImage = url;
  }

  function start() {
    const canvases = [...document.querySelectorAll("canvas.paint")];
    const sketches = [...document.querySelectorAll(".sketch")];
    sketches.forEach(outline);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (paint(e.target), io.unobserve(e.target))),
      { rootMargin: "600px 0px" }
    );
    canvases.forEach((c) => io.observe(c));

    let timer;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        sketches.forEach(outline);
        canvases.filter((c) => c.classList.contains("painted")).forEach(paint);
      }, 250);
    });

    const img = document.querySelector(".photo img");
    if (!img) return;
    if (img.complete && img.naturalWidth) maskPhoto(img);
    else img.addEventListener("load", () => maskPhoto(img), { once: true });
  }

  const reveals = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), reveals.unobserve(e.target))),
    { threshold: 0.15 }
  );
  document.querySelectorAll(".reveal").forEach((el) => reveals.observe(el));

  const nav = document.querySelector(".nav"), burger = document.getElementById("burger");
  if (burger) burger.addEventListener("click", () => burger.setAttribute("aria-expanded", nav.classList.toggle("open")));
  if (nav) nav.querySelectorAll(".links a").forEach((a) => a.addEventListener("click", () => (nav.classList.remove("open"), burger.setAttribute("aria-expanded", false))));

  // washes behind words are sized from the text, so wait for the web fonts
  let started = false;
  const go = () => started || ((started = true), start());
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(go);
  setTimeout(go, 2000);
})();
