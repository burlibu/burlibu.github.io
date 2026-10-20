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

// Bento face for /contact: an airmail envelope, a stamp and a paper plane on its way
export function ContactFace() {
  return (
    <div className="face-mail" aria-hidden="true">
      <svg className="face-mail-trail" viewBox="0 0 400 100" preserveAspectRatio="none">
        <path d="M-10 75 C 60 10, 110 30, 140 30 S 210 85, 250 80 S 340 25, 420 20" />
      </svg>
      <span className="face-mail-plane">
        <svg viewBox="0 0 24 24">
          <path d="M2 11 L22 3 L15 21 L11 13 Z" />
          <path d="M11 13 L22 3" />
        </svg>
      </span>
      <div className="face-mail-envelope">
        <div className="face-mail-letter">
          <b>Ciao!</b>
          <i />
          <i />
          <i />
        </div>
        <div className="face-mail-front">
          <span className="face-mail-stamp">
            <span>B</span>
          </span>
          <span className="face-mail-postmark">BURLIBU · POSTA</span>
          <span className="face-mail-to">
            <small>A:</small> burlibu@email.com
          </span>
        </div>
      </div>
    </div>
  );
}

// Bento face for the GitHub link: contribution calendar, a branch graph and a terminal
const WEEKS = 30;
const CELLS = Array.from({ length: WEEKS * 7 }, (_, i) => {
  const w = Math.floor(i / 7), d = i % 7;
  const v = Math.sin(w * 0.45) + Math.sin(w * 1.7 + d * 2.1) * 0.8 + Math.cos(d * 1.3 + w * 0.2) * 0.5;
  return Math.max(0, Math.min(4, Math.round(v + 1.4)));
});

export function GithubFace() {
  return (
    <div className="face-gh" aria-hidden="true">
      <div className="face-gh-cal">
        <svg viewBox={`0 0 ${WEEKS * 12} ${7 * 12}`}>
          {CELLS.map((lvl, i) => (
            <rect key={i} className={`l${lvl}`} x={Math.floor(i / 7) * 12} y={(i % 7) * 12} width="10" height="10" rx="2" />
          ))}
        </svg>
        <span className="face-gh-sweep" />
      </div>
      <svg className="face-gh-branches" viewBox="0 0 120 60">
        <path className="main" d="M4 30 H116" />
        <path className="feat" d="M24 30 C 36 30, 36 12, 48 12 H 80 C 92 12, 92 30, 104 30" />
        <circle cx="12" cy="30" r="4" />
        <circle cx="40" cy="30" r="4" />
        <circle cx="56" cy="12" r="4" className="f" />
        <circle cx="72" cy="12" r="4" className="f" />
        <circle cx="70" cy="30" r="4" />
        <circle cx="104" cy="30" r="5" className="merge" />
      </svg>
      <div className="face-gh-term">
        <span className="p">~/burlibu.github.io $</span> <span className="cmd">git push origin main</span>
      </div>
    </div>
  );
}
