// Procedural watercolor for canvas. A wash is a polygon deformed by recursive
// midpoint displacement, then painted as ~30 further-deformed translucent layers
// (Tyler Hobbs' technique): pigment piles up in the middle and the edges stay
// ragged. Washes use multiply so overlapping colours mix like real pigment, and
// faint strokes on some layers darken the rim where pigment collects as it dries.
// Everything is painted once per size, never per frame.
(function (root) {
  const PALETTE = {
    sage: [128, 156, 124],
    moss: [82, 108, 86],
    terracotta: [198, 116, 86],
    rose: [210, 150, 142],
    ochre: [216, 166, 80],
    indigo: [52, 72, 116],
    ink: [46, 52, 71],
    black: [0, 0, 0],
  };

  function rng(seed) {
    let s = Math.imul(seed | 0 || 1, 2654435761) >>> 0 || 1;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return (s >>> 0) / 4294967296;
    };
  }
  // clamped, so one unlucky vertex can't throw a spike across the sheet
  const gauss = (r) => Math.max(-2.2, Math.min(2.2, Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(6.2832 * r())));
  const rgb = (c) => (typeof c === "string" ? PALETTE[c] : c);
  const rgba = (c, a, k = 1) => {
    const [r, g, b] = rgb(c);
    return `rgba(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)},${a})`;
  };

  // pts are [x, y, v]: v is how ragged the edges next to that vertex get
  function deform(pts, depth, r, scale = 1) {
    for (let d = 0; d < depth; d++) {
      const out = [];
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        out.push(a);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]), v = ((a[2] + b[2]) / 2) * scale;
        const ang = r() * 6.2832, m = gauss(r) * len * v;
        out.push([(a[0] + b[0]) / 2 + Math.cos(ang) * m, (a[1] + b[1]) / 2 + Math.sin(ang) * m, v * (0.75 + r() * 0.5)]);
      }
      pts = out;
    }
    return pts;
  }

  function trace(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function blob(x, y, rx, ry, seed = 1, rough = 1) {
    const r = rng(seed), n = 10, pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.2832, k = 0.82 + r() * 0.36;
      pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k, (0.12 + r() * 0.3) * rough]);
    }
    return pts;
  }

  function wash(ctx, base, color, o = {}) {
    const r = rng(o.seed || 7), layers = o.layers || 30, a = o.alpha || 0.04;
    const shape = deform(base, o.depth ?? 3, r);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of shape) (x0 = Math.min(x0, p[0])), (y0 = Math.min(y0, p[1])), (x1 = Math.max(x1, p[0])), (y1 = Math.max(y1, p[1]));
    const bw = x1 - x0, bh = y1 - y0;
    ctx.save();
    ctx.globalCompositeOperation = o.comp || "multiply";
    ctx.strokeStyle = rgba(color, o.rim ?? 0.05, 0.72);
    ctx.lineWidth = o.rimWidth || 1.2;
    for (let l = 0; l < layers; l++) {
      // each layer is loaded unevenly: pigment pools around a random spot, so the
      // body of the wash mottles instead of filling flat
      const cx = x0 + r() * bw, cy = y0 + r() * bh, rad = Math.max(bw, bh) * (0.35 + r() * 0.55);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
      g.addColorStop(0, rgba(color, a * 1.8));
      g.addColorStop(1, rgba(color, a * 0.3));
      ctx.fillStyle = g;
      trace(ctx, deform(shape, o.layerDepth ?? 3, r, o.spread ?? 0.5));
      ctx.fill();
      if (l % 3 === 0 && o.rim !== 0) ctx.stroke();
    }
    ctx.restore();
    return shape;
  }

  // a "cauliflower" bloom: water flooding back into a drying wash lifts the
  // pigment and leaves a darker crinkled ring
  function bloom(ctx, x, y, rad, color, seed = 3) {
    const r = rng(seed), shape = deform(blob(x, y, rad, rad * (0.8 + r() * 0.4), seed, 0.9), 3, r);
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    for (let i = 0; i < 4; i++) {
      trace(ctx, deform(shape, 1, r, 0.4));
      ctx.fill();
    }
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = rgba(color, 0.16, 0.7);
    ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      trace(ctx, deform(shape, 1, r, 0.3));
      ctx.stroke();
    }
    ctx.restore();
  }

  // a dried puddle of clear water: almost no pigment, a crisp tide line
  function stain(ctx, x, y, rx, ry, color, seed = 5) {
    const r = rng(seed), shape = deform(blob(x, y, rx, ry, seed, 0.7), 4, r);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = rgba(color, 0.03);
    trace(ctx, shape);
    ctx.fill();
    ctx.strokeStyle = rgba(color, 0.16, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = rgba(color, 0.07, 0.8);
    trace(ctx, deform(shape.map((p) => [x + (p[0] - x) * 0.9, y + (p[1] - y) * 0.9, p[2]]), 1, r, 0.2));
    ctx.stroke();
    ctx.restore();
  }

  function splatter(ctx, x, y, rad, color, o = {}) {
    const r = rng(o.seed || 9), n = o.n || 36, size = o.size || 3;
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    for (let i = 0; i < n; i++) {
      const d = rad * Math.pow(r(), 1.6), a = r() * 6.2832;
      const s = 0.5 + size * Math.pow(r(), 3.2);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d * 0.8;
      ctx.fillStyle = rgba(color, 0.3 + r() * 0.4);
      ctx.beginPath();
      ctx.ellipse(px, py, s, s * (0.75 + r() * 0.3), r() * 3, 0, 6.2832);
      ctx.fill();
      // big drops land with a darker rim
      if (s > size * 0.45) {
        ctx.strokeStyle = rgba(color, 0.35, 0.7);
        ctx.lineWidth = 0.6;
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function curve(p0, p1, p2, p3, n = 60) {
    const out = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      out.push([
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]);
    }
    return out;
  }

  // a loaded round brush dragged along pts: a soft body plus separate bristle
  // lines that taper at both ends and skip where the brush runs dry
  function brush(ctx, pts, width, color, o = {}) {
    const r = rng(o.seed || 11), n = Math.max(4, Math.round(width * 1.4)), last = pts.length - 1;
    const norms = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(last, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [-dy / l, dx / l];
    });
    const taper = (t) => Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.05))), 0.45);
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.lineCap = ctx.lineJoin = "round";
    if (o.body !== false) {
      ctx.strokeStyle = rgba(color, (o.alpha || 0.3) * 0.35);
      ctx.lineWidth = width * 0.7;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
    }
    for (let k = 0; k < n; k++) {
      const off = (k / (n - 1) - 0.5) * width, start = r() * 0.06, end = 1 - r() * (o.dry ?? 0.14);
      ctx.strokeStyle = rgba(color, (o.alpha || 0.3) * (0.35 + r() * 0.75), 0.9);
      ctx.lineWidth = 0.7 + r() * (width / n) * 1.6;
      ctx.beginPath();
      let on = false;
      for (let i = 0; i <= last; i++) {
        const t = i / last;
        if (t < start || t > end || r() < (o.gaps ?? 0.015)) {
          on = false;
          continue;
        }
        const s = off * taper(t), p = pts[i], nm = norms[i];
        const x = p[0] + nm[0] * s + (r() - 0.5) * 0.4, y = p[1] + nm[1] * s + (r() - 0.5) * 0.4;
        on ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        on = true;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function leafShape(x, y, ang, len, w) {
    const pts = [], n = 7, c = Math.cos(ang), s = Math.sin(ang);
    const put = (u, v) => pts.push([x + u * c - v * s, y + u * s + v * c, 0.035]);
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      put(t * len, Math.pow(Math.sin(Math.PI * t), 0.85) * w * (1 - 0.3 * t));
    }
    for (let i = n - 1; i > 0; i--) {
      const t = i / n;
      put(t * len, -Math.pow(Math.sin(Math.PI * t), 0.85) * w * (1 - 0.3 * t) * 0.92);
    }
    return pts;
  }

  // a painted leaf, optionally tinted at the tip wet-in-wet with a second colour
  function leaf(ctx, x, y, ang, len, color, o = {}) {
    const seed = o.seed || 13, base = leafShape(x, y, ang, len, len * (o.width || 0.32));
    const shape = wash(ctx, base, color, { seed, alpha: o.alpha || 0.085, layers: o.layers || 16, depth: 1, layerDepth: 2, spread: 0.6, rim: 0.09 });
    if (o.tint) {
      ctx.save();
      trace(ctx, shape);
      ctx.clip();
      const tx = x + Math.cos(ang) * len * 0.8, ty = y + Math.sin(ang) * len * 0.8;
      wash(ctx, blob(tx, ty, len * 0.35, len * 0.3, seed + 1, 0.8), o.tint, { seed: seed + 2, alpha: 0.05, layers: 14, rim: 0 });
      ctx.restore();
    }
    const vein = curve([x, y], [x + Math.cos(ang) * len * 0.3, y + Math.sin(ang) * len * 0.3], [x + Math.cos(ang + 0.08) * len * 0.6, y + Math.sin(ang + 0.08) * len * 0.6], [x + Math.cos(ang) * len * 0.86, y + Math.sin(ang) * len * 0.86], 20);
    brush(ctx, vein, Math.max(1.2, len * 0.025), o.vein || "moss", { seed, alpha: 0.32, body: false, dry: 0.3 });
  }

  // size a canvas to its CSS box; washes are soft, so the pixel ratio is capped
  function setup(canvas, cap = 2) {
    const w = canvas.offsetWidth, h = canvas.offsetHeight, dpr = Math.min(cap, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  root.Paint = { PALETTE, rng, deform, trace, blob, wash, bloom, stain, splatter, curve, brush, leafShape, leaf, setup };
})(window);
