// Africa: the woven bands between chapters, the loom that re-weaves the kente
// ones, the header that takes each chapter's ink, the held photograph of
// chapter four and the arrow-key presentation stops.

(() => {
  const preview = new URLSearchParams(location.search).has("preview");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const wide = matchMedia("(min-width: 901px)");

  // ---------- the loom state ----------

  const THREADS = [
    { id: "oro", name: "Oro", hex: "#f2b705", meaning: "ricchezza, regalità e fertilità" },
    { id: "verde", name: "Verde", hex: "#4f6b2f", meaning: "crescita, raccolto e rinnovamento" },
    { id: "rosso", name: "Rosso", hex: "#a8321e", meaning: "sacrificio e lotta per la libertà" },
    { id: "blu", name: "Blu", hex: "#22305e", meaning: "pace, armonia e amore" },
    { id: "nero", name: "Nero", hex: "#16110d", meaning: "maturità e legame con gli antenati" },
    { id: "bianco", name: "Bianco", hex: "#eedfc4", meaning: "purezza e festa" },
    { id: "bruno", name: "Bruno", hex: "#7a4a22", meaning: "la madre terra e la guarigione" },
  ];
  const MOTIFS = ["scacchi", "zigzag", "scala"];
  const byId = Object.fromEntries(THREADS.map((t) => [t.id, t]));
  const DEFAULT = { threads: ["oro", "verde", "rosso", "nero"], motif: "scacchi" };
  const KEY = "africa.telaio";

  // stored state is untrusted: keep only known threads (2 to 4) and a known motif
  function load() {
    if (preview) return { ...DEFAULT };
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      const threads = Array.isArray(s?.threads) ? [...new Set(s.threads.filter((id) => byId[id]))].slice(0, 4) : [];
      if (threads.length >= 2 && MOTIFS.includes(s.motif)) return { threads, motif: s.motif };
    } catch {}
    return { ...DEFAULT, threads: [...DEFAULT.threads] };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  }

  let state = load();

  // ---------- pattern drawing ----------

  function rng(seed) {
    return () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const r = (x, y, w, h, fill) => `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}"/>`;
  const svg = (w, h, body) => `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  // kente: two rows of narrow strips sewn together; each strip alternates a
  // warp-faced run of lengthwise stripes with a weft-faced block of the motif
  function kente(w, h) {
    const cols = state.threads.map((id) => byId[id].hex);
    const ink = "#16110d";
    const row = h / 2;
    const seg = row * 2.2;
    let out = r(0, 0, w, h, ink);
    for (let k = 0; k < 2; k++) {
      const y = k * row;
      const shift = k ? -seg / 2 : 0;
      for (let i = 0, x = shift; x < w; i++, x += seg) {
        const a = cols[(i + k) % cols.length];
        const b = cols[(i + k + 1) % cols.length];
        const c = cols[(i + k + 2) % cols.length];
        if (i % 2 === 0) {
          const stripes = [a, b, a, c, a];
          const sh = row / stripes.length;
          stripes.forEach((col, j) => (out += r(x, y + j * sh, seg, sh, col)));
          out += r(x, y + 2 * sh + sh * 0.4, seg, sh * 0.2, ink);
        } else {
          out += r(x, y, seg, row, b);
          out += motif(x, y, seg, row, a, c, ink);
        }
        out += r(x, y, 2, row, ink);
      }
      out += r(0, y + row - 1.5, w, 3, ink);
    }
    return svg(w, h, out);
  }

  function motif(x, y, w, h, a, c, ink) {
    let out = "";
    const pad = h * 0.12;
    if (state.motif === "scacchi") {
      const n = 4;
      const cw = (w - 2 * pad) / (n * 2);
      const ch = (h - 2 * pad) / n;
      for (let i = 0; i < n * 2; i++)
        for (let j = 0; j < n; j++) if ((i + j) % 2 === 0) out += r(x + pad + i * cw, y + pad + j * ch, cw, ch, (i + j) % 4 ? a : c);
    } else if (state.motif === "zigzag") {
      const n = 4;
      const step = (w - 2 * pad) / n;
      let p = "";
      for (let i = 0; i <= n; i++) p += `${(x + pad + i * step).toFixed(1)},${(y + (i % 2 ? h - pad : pad)).toFixed(1)} `;
      out += `<polyline points="${p}" fill="none" stroke="${ink}" stroke-width="${(h * 0.26).toFixed(1)}" stroke-linejoin="miter"/>`;
      out += `<polyline points="${p}" fill="none" stroke="${a}" stroke-width="${(h * 0.12).toFixed(1)}" stroke-linejoin="miter"/>`;
    } else {
      const steps = 3;
      const cx = x + w / 2;
      for (let s = 0; s < steps; s++) {
        const sw = (w - 2 * pad) * (1 - s / steps);
        const sh = (h - 2 * pad) / steps;
        out += r(cx - sw / 2, y + h - pad - (s + 1) * sh, sw, sh, s % 2 ? c : a);
      }
      out += r(cx - w * 0.05, y + pad, w * 0.1, h - 2 * pad, ink);
    }
    return out;
  }

  // bogolan: cream marks painted with mud on a brown ground, slightly uneven
  function bogolan(w, h, seed) {
    const rand = rng(seed);
    const bg = "#3b2416";
    const mark = "#eedfc4";
    const sw = (h * 0.075).toFixed(1);
    const cell = h;
    const j = () => (rand() - 0.5) * h * 0.05;
    let out = r(0, 0, w, h, bg);
    const line = (pts) => `<polyline points="${pts.map(([px, py]) => `${(px + j()).toFixed(1)},${(py + j()).toFixed(1)}`).join(" ")}" fill="none" stroke="${mark}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
    for (let i = 0, x = 0; x < w; i++, x += cell) {
      const m = h * 0.18;
      const L = x + m;
      const R = x + cell - m;
      const T = m;
      const B = h - m;
      const cx = x + cell / 2;
      const cy = h / 2;
      switch (i % 5) {
        case 0:
          for (let a = 0; a < 3; a++)
            for (let b = 0; b < 3; b++)
              out += `<circle cx="${(L + (a * (R - L)) / 2 + j()).toFixed(1)}" cy="${(T + (b * (B - T)) / 2 + j()).toFixed(1)}" r="${(h * 0.06).toFixed(1)}" fill="${mark}"/>`;
          break;
        case 1:
          out += line([[L, T], [R, B]]) + line([[R, T], [L, B]]);
          break;
        case 2:
          out += line([[L, B], [L + (R - L) * 0.25, T], [cx, B], [L + (R - L) * 0.75, T], [R, B]]);
          break;
        case 3:
          out += line([[L, T], [R, T], [R, B], [L, B], [L, T]]);
          out += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(h * 0.08).toFixed(1)}" fill="${mark}"/>`;
          break;
        default:
          out += line([[L, cy], [R, cy]]) + line([[cx, T], [cx, B]]);
          out += line([[L, T], [L + h * 0.12, T]]) + line([[R - h * 0.12, B], [R, B]]);
      }
      out += line([[x + cell, h * 0.08], [x + cell, h * 0.92]]);
    }
    return svg(w, h, out);
  }

  // ndebele: thick black outlines around stepped gables and chevrons, flat fills
  function ndebele(w, h) {
    const fills = ["#f2b705", "#22305e", "#b4532a", "#4f6b2f", "#a8321e"];
    const ink = "#16110d";
    const ground = "#f4ecdc";
    const sw = (h * 0.09).toFixed(1);
    const cell = h * 1.5;
    let out = r(0, 0, w, h, ground);
    const shape = (pts, fill) => `<polygon points="${pts.map((p) => p.map((v) => v.toFixed(1)).join(",")).join(" ")}" fill="${fill}" stroke="${ink}" stroke-width="${sw}" stroke-linejoin="miter"/>`;
    for (let i = 0, x = 0; x < w; i++, x += cell) {
      const f = fills[i % fills.length];
      const g = fills[(i + 2) % fills.length];
      const p = h * 0.14;
      const L = x + p;
      const R = x + cell - p;
      const T = p;
      const B = h - p;
      const cx = x + cell / 2;
      if (i % 3 === 0) {
        const s = (R - L) / 6;
        const v = (B - T) / 3;
        out += shape([[L, B], [L, T + 2 * v], [L + s, T + 2 * v], [L + s, T + v], [L + 2 * s, T + v], [L + 2 * s, T], [R - 2 * s, T], [R - 2 * s, T + v], [R - s, T + v], [R - s, T + 2 * v], [R, T + 2 * v], [R, B]], f);
        out += shape([[cx - s * 0.6, B], [cx - s * 0.6, T + v * 1.5], [cx + s * 0.6, T + v * 1.5], [cx + s * 0.6, B]], ground);
      } else if (i % 3 === 1) {
        out += shape([[L, T], [cx, B], [R, T], [R - (R - L) * 0.2, T], [cx, B - (B - T) * 0.45], [L + (R - L) * 0.2, T]], f);
        out += shape([[cx - (R - L) * 0.12, T], [cx + (R - L) * 0.12, T], [cx, T + (B - T) * 0.3]], g);
      } else {
        out += shape([[L, T], [R, T], [R, B], [L, B]], g);
        out += shape([[L + (R - L) * 0.25, T + (B - T) * 0.25], [R - (R - L) * 0.25, T + (B - T) * 0.25], [R - (R - L) * 0.25, B - (B - T) * 0.25], [L + (R - L) * 0.25, B - (B - T) * 0.25]], ground);
      }
    }
    out += r(0, 0, w, h * 0.06, ink) + r(0, h * 0.94, w, h * 0.06, ink);
    return svg(w, h, out);
  }

  const bands = [...document.querySelectorAll("[data-band]")];

  function draw(only) {
    bands.forEach((el, i) => {
      const kind = el.dataset.band;
      if (only && kind !== only) return;
      const w = Math.max(1, Math.round(el.clientWidth));
      const h = Math.max(1, Math.round(el.clientHeight));
      if (!only && el._w === w && el._h === h) return;
      el._w = w;
      el._h = h;
      el.innerHTML = kind === "kente" ? kente(w, h) : kind === "bogolan" ? bogolan(w, h, 7 + i * 13) : ndebele(w, h);
    });
  }

  draw();
  addEventListener("resize", () => draw());
  document.fonts?.ready.then(() => draw());

  // ---------- the loom ----------

  const fili = document.getElementById("fili");
  const meaning = document.getElementById("significato");

  function tell(t) {
    meaning.textContent = `${t.name}: ${t.meaning}.`;
  }

  THREADS.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.id = t.id;
    b.style.setProperty("--c", t.hex);
    b.innerHTML = `<i></i>${t.name}`;
    b.addEventListener("click", () => {
      const on = state.threads.includes(t.id);
      if (on && state.threads.length > 2) state.threads = state.threads.filter((id) => id !== t.id);
      else if (!on) state.threads = [...state.threads, t.id].slice(-4);
      tell(t);
      weave();
    });
    b.addEventListener("focus", () => tell(t));
    fili.appendChild(b);
  });

  document.querySelectorAll('input[name="motivo"]').forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        state.motif = input.value;
        weave();
      }
    });
  });

  document.getElementById("casuale").addEventListener("click", () => {
    const pool = THREADS.map((t) => t.id).sort(() => Math.random() - 0.5);
    state = { threads: pool.slice(0, 3 + (Math.random() < 0.5 ? 1 : 0)), motif: MOTIFS[Math.floor(Math.random() * 3)] };
    tell(byId[state.threads[0]]);
    weave();
  });

  function sync() {
    fili.querySelectorAll(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(state.threads.includes(b.dataset.id))));
    document.querySelectorAll('input[name="motivo"]').forEach((i) => (i.checked = i.value === state.motif));
  }

  function weave() {
    sync();
    draw("kente");
    save();
  }

  sync();
  tell(byId[state.threads[0]]);

  // ---------- header ink and current chapter ----------

  const bar = document.getElementById("top-bar");
  const chapters = [...document.querySelectorAll("[data-chapter]")];
  const navLinks = [...bar.querySelectorAll("nav a")];

  function ink() {
    const y = bar.offsetHeight / 2;
    const here = chapters.find((c) => {
      const b = c.getBoundingClientRect();
      return b.top <= y && b.bottom > y;
    });
    if (!here) return;
    bar.dataset.ink = here.dataset.ink;
    bar.style.backgroundColor = `var(--${here.dataset.bg})`;
    bar.dataset.bg = here.dataset.bg;
    navLinks.forEach((a) => a.setAttribute("aria-current", String(a.getAttribute("href") === `#${here.id}`)));
  }

  // ---------- chapter four: the cards cross the held photograph ----------

  const showcase = document.querySelector(".showcase");
  const track = showcase.querySelector(".track");
  const stageH = showcase.querySelector(".stage-h");

  function travel() {
    if (!wide.matches) {
      track.style.removeProperty("--x");
      stageH.style.transform = "";
      return;
    }
    const b = showcase.getBoundingClientRect();
    const run = b.height - innerHeight;
    const p = Math.min(1, Math.max(0, -b.top / run));
    const dist = Math.max(0, track.scrollWidth - innerWidth);
    track.style.setProperty("--x", `${(-p * dist).toFixed(1)}px`);
    stageH.style.transform = `translateX(${(-p * dist * 0.35).toFixed(1)}px)`;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      ink();
      travel();
    });
  }

  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  ink();
  travel();

  // ---------- entrances ----------

  const reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !preview) {
    document.querySelectorAll("section").forEach((s) => s.querySelectorAll(".reveal").forEach((el, i) => el.style.setProperty("--d", `${Math.min(i, 6) * 80}ms`)));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -10% 0px" },
    );
    reveals.forEach((el) => io.observe(el));
  } else reveals.forEach((el) => el.classList.add("is-in"));

  // ---------- presentation: one stop per chapter, one per card in chapter four ----------

  function stops() {
    const top = (el) => el.getBoundingClientRect().top + scrollY;
    const list = [0];
    chapters.slice(1).forEach((c) => {
      const band = c.previousElementSibling?.classList.contains("band") ? c.previousElementSibling : c;
      list.push(Math.round(top(band)));
      if (c === showcase && wide.matches) {
        const n = track.children.length;
        const run = showcase.offsetHeight - innerHeight;
        for (let k = 1; k < n; k++) list.push(Math.round(top(showcase) + (run * k) / (n - 1)));
      }
    });
    return list.sort((a, b) => a - b);
  }

  function go(dir) {
    const y = scrollY;
    const all = stops();
    const target = dir > 0 ? all.find((s) => s > y + 4) : [...all].reverse().find((s) => s < y - 4);
    if (target === undefined) return false;
    scrollTo({ top: target, behavior: reduced ? "auto" : "smooth" });
    return true;
  }

  addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t.closest?.("input, textarea, select, [contenteditable]")) return;
    const next = ["ArrowDown", "ArrowRight", "PageDown"].includes(e.key) || (e.key === " " && !e.shiftKey);
    const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key) || (e.key === " " && e.shiftKey);
    if (e.key === " " && t.closest?.("button, a, label")) return;
    if ((next && go(1)) || (prev && go(-1))) e.preventDefault();
  });

  const presenta = document.getElementById("presenta");
  presenta.addEventListener("click", async () => {
    const fs = document.fullscreenElement;
    try {
      if (fs) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    } catch {}
    if (!fs) go(1);
  });
  document.addEventListener("fullscreenchange", () => {
    presenta.textContent = document.fullscreenElement ? "Esci" : "Presenta";
    draw();
  });
})();
