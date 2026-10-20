import React, { useEffect, useRef } from "react";
import { Glyph, PENS } from "./Resources";
import { SECTIONS } from "./resourcesData";
import { NOTES, LINKS, AREA_COLORS } from "./knowledge";

// Bento face for /resources: a small drawing sheet with pen-coloured cards
const FACE_CARDS = [
  ["golden", "A·01"],
  ["box", "C·04"],
  ["braces", "D·02"],
  ["curve", "E·01"],
  ["cube", "F·03"],
  ["tags", "B·05"],
];

export function ResourcesFace() {
  return (
    <div className="face-rs" aria-hidden="true">
      <div className="face-rs-sheet">
        <span className="face-rs-pen" />
        <b>Risorse</b>
        <small>Tavola R-01 · {SECTIONS.reduce((n, s) => n + s.items.length, 0)} voci</small>
        <div className="face-rs-grid">
          {FACE_CARDS.map(([glyph, code], i) => (
            <span key={code} className={`face-rs-card face-rs-v${i % 3}`} style={{ "--pen": PENS[(i * 3) % PENS.length], "--i": i }}>
              <Glyph name={glyph} />
              <i>{code}</i>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Bento face for /graph3d: the real knowledge graph, projected and turning slowly
export function GraphFace() {
  const canvas = useRef(null);
  useEffect(() => {
    const c = canvas.current, ctx = c.getContext("2d");
    const n = NOTES.length;
    // golden-spiral sphere, slightly jittered so it reads as a cloud
    const pts = NOTES.map((note, i) => {
      const y = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      const j = 0.82 + ((i * 37) % 17) / 70;
      return { x: Math.cos(a) * r * j, y: y * j, z: Math.sin(a) * r * j, color: note.area >= 0 ? AREA_COLORS[note.area] : "#ffffff", hub: note.kind !== "note" };
    });
    const edges = LINKS;
    let raf = 0, visible = true, angle = 0, last = performance.now(), W = 0, H = 0;

    const size = () => {
      const dpr = Math.min(devicePixelRatio || 1, 2);
      W = c.clientWidth;
      H = c.clientHeight;
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (now) => {
      angle += Math.min(50, now - last) * 0.00018;
      last = now;
      const R = Math.min(W, H) * 0.36, cx = W / 2, cy = H / 2;
      const cos = Math.cos(angle), sin = Math.sin(angle), tilt = 0.35;
      const proj = pts.map((p) => {
        const x = p.x * cos - p.z * sin, z0 = p.x * sin + p.z * cos;
        const y = p.y * Math.cos(tilt) - z0 * Math.sin(tilt), z = p.y * Math.sin(tilt) + z0 * Math.cos(tilt);
        const k = 1 / (1.9 - z * 0.6);
        return { sx: cx + x * R * k * 1.5, sy: cy + y * R * k * 1.5, z, k };
      });
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      ctx.lineWidth = 1;
      for (const [a, b] of edges) {
        const p = proj[a], q = proj[b];
        ctx.strokeStyle = `rgba(143, 233, 255, ${0.06 + 0.12 * ((p.z + q.z) / 2 + 1)})`;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(q.sx, q.sy);
        ctx.stroke();
      }
      proj.forEach((p, i) => {
        const base = pts[i].hub ? 3.2 : 1.8;
        const r = base * p.k * 1.6 * (1 + 0.25 * Math.sin(now * 0.002 + i));
        ctx.globalAlpha = 0.35 + 0.65 * ((p.z + 1) / 2);
        ctx.fillStyle = pts[i].color;
        ctx.shadowColor = pts[i].color;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      if (visible) raf = requestAnimationFrame(draw);
    };

    const ro = new ResizeObserver(() => {
      size();
      if (!visible) draw(performance.now());
    });
    ro.observe(c);
    size();
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    // only animate while the tile is on screen
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting && !reduced;
      cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(draw);
    });
    io.observe(c);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div className="face-kb" aria-hidden="true">
      <canvas ref={canvas} />
      <div className="face-kb-head">
        <span className="kb-sigil" />
        <b>Knowledge</b>
      </div>
    </div>
  );
}
