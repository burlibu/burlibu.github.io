// Halden Stories: the map (built from geo.js), the photo fills drawn from the
// grid video, the zone ring and list, and the draggable story slider.

(() => {
  const G = window.HALDEN_GEO;
  const preview = new URLSearchParams(location.search).has("preview");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const $ = (id) => document.getElementById(id);

  // ---------- content ----------

  // cell: [column, row] of the 3x2 photo grid
  const ZONES = [
    { id: "midwest", name: "Midwest", dot: [808, 482], cell: [1, 0], coord: "41° 35' 11\" N, 93° 37' 15\" W", city: "Des Moines", card: "#2F55D4", body: "Tecnico eolico: tiene in moto le turbine che girano sopra i campi di mais dell'Iowa.", alt: "Un tecnico eolico con il casco bianco accanto a una pala" },
    { id: "canada", name: "Canada", dot: [668, 238], cell: [1, 1], coord: "46° 48' 47\" N, 71° 12' 29\" W", city: "Québec", card: "#23201C", body: "Ecologa forestale: misura il carbonio che la foresta boreale trattiene intorno ai bacini.", alt: "Un'ecologa con il casco rosso nella foresta, sopra un fiume" },
    { id: "west", name: "Ovest", dot: [599, 492], cell: [0, 0], coord: "38° 34' 54\" N, 121° 29' 39\" W", city: "Sacramento", card: "#C35933", body: "Ingegnera idraulica: governa un bacino tra estati di siccità e inverni di piena.", alt: "Un'ingegnera con il gilet arancione davanti a una diga" },
    { id: "south", name: "Sud", dot: [814, 626], cell: [2, 0], coord: "30° 16' 03\" N, 97° 44' 34\" W", city: "Austin", card: "#1F4A35", body: "Capocantiere solare: monta pannelli tra le pinete senza abbattere il bosco.", alt: "Una capocantiere con il gilet giallo davanti a un campo di pannelli solari" },
    { id: "northeast", name: "Nordest", dot: [1022, 463], cell: [0, 1], coord: "43° 39' 41\" N, 70° 15' 21\" W", city: "Portland", card: "#D99A2B", ink: "#1C1A17", body: "Capitano di linea: porta i tecnici alle pale eoliche al largo del Golfo del Maine.", alt: "Un capitano con il giubbotto salvagente sul ponte di una barca, con le pale eoliche sul mare" },
  ];
  const byId = Object.fromEntries(ZONES.map((z) => [z.id, z]));

  // cell edges of the still and of the video
  const STILL = { cols: [[0, 766], [786, 1551], [1571, 2336]], rows: [[0, 862], [880, 1744]] };
  const MOVIE = { cols: [[0, 545], [558, 1104], [1117, 1663]], rows: [[0, 615], [626, 1243]] };

  const video = $("grid");
  const still = new Image();
  still.src = "media/griglia.jpg";

  // draws one grid cell into w x h, cover-cropped; shift in -1..1 pans across the spare width
  function cover(ctx, [c, r], w, h, shift = 0) {
    const live = video.readyState >= 2 && video.videoWidth;
    const src = live ? video : still;
    if (!live && !still.complete) return;
    const grid = live ? MOVIE : STILL;
    // a few pixels in from each edge, so the white gutters never show
    const inset = live ? 3 : 4;
    const x0 = grid.cols[c][0] + inset;
    const y0 = grid.rows[r][0] + inset;
    const sw = grid.cols[c][1] - inset - x0;
    const sh = grid.rows[r][1] - inset - y0;
    const k = Math.max(w / sw, h / sh);
    const cw = w / k;
    const ch = h / k;
    const cx = x0 + ((sw - cw) / 2) * (1 + Math.max(-1, Math.min(1, shift)));
    const cy = y0 + (sh - ch) / 2;
    ctx.drawImage(src, cx, cy, cw, ch, 0, 0, w, h);
  }

  // ---------- the map ----------

  const svg = $("map");
  const NS = "http://www.w3.org/2000/svg";
  const clipT = `matrix(${1 / 2160} 0 0 ${1 / 1350} ${360 / 2160} ${270 / 1350})`;

  // the static map; everything that moves lives in its own small svg, so the map is never repainted
  svg.innerHTML = `
    <g class="hits">${ZONES.map((z) => `<path class="hit" data-zone="${z.id}" d="${G.regions[z.id].d}"/>`).join("")}</g>
    <path class="ink" pathLength="1" style="--d:0s" d="${G.lines.canada}"/>
    <path class="ink" pathLength="1" style="--d:.15s" d="${G.lines.us}"/>
    <path class="ink" pathLength="1" style="--d:.5s" d="${G.lines.borders}"/>
    <path class="lake-cut" id="lakecut" d="${G.lakes}"/>
    <path class="ink lakes" pathLength="1" style="--d:.35s" d="${G.lakes}"/>`;

  const marks = $("marks");
  marks.innerHTML = `
    <defs><path id="ringpath" d="M-45 0a45 45 0 1 1 90 0a45 45 0 1 1-90 0"/></defs>
    ${ZONES.map((z) => `<g class="dot" data-zone="${z.id}"><circle class="halo" cx="${z.dot[0]}" cy="${z.dot[1]}" r="8"/><circle cx="${z.dot[0]}" cy="${z.dot[1]}" r="8"/></g>`).join("")}
    <g class="ring" id="ring">
      <g class="ring-in" id="ring-in">
        <g><text><textPath href="#ringpath" textLength="282.7" lengthAdjust="spacing">SCOPRI LE STORIE · SCOPRI LE STORIE ·</textPath></text>
          <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite"/></g>
        <circle class="disc" r="31"/>
        <path class="plus" d="M-7 0H7M0-7V7"/>
      </g>
    </g>`;

  // one canvas per zone over its bounding box; the zone's shape clips the photo inside the canvas
  const fills = $("fills");
  for (const z of ZONES) {
    const cv = document.createElement("canvas");
    cv.className = "fill";
    const [x, y, w, h] = G.regions[z.id].box;
    Object.assign(cv.style, { left: `${x + 360}px`, top: `${y + 270}px`, width: `${w}px`, height: `${h}px` });
    fills.appendChild(cv);
    z.fill = cv;
    z.canvas = cv;
    z.shape = new Path2D(G.regions[z.id].d);
    z.shownUntil = 0;
  }

  function paintZone(z) {
    const cv = z.canvas;
    const ctx = cv.getContext("2d");
    const [x, y, w] = G.regions[z.id].box;
    const k = cv.width / w;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.setTransform(k, 0, 0, k, -x * k, -y * k);
    ctx.clip(z.shape);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    cover(ctx, z.cell, cv.width, cv.height);
    ctx.restore();
  }

  // ---------- zone list, ruler and chips ----------

  const list = $("zone-list");
  const chips = $("chips");
  for (const z of ZONES) {
    const li = document.createElement("li");
    li.innerHTML = `<button type="button" data-zone="${z.id}">${z.name}</button>`;
    list.appendChild(li);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.dataset.zone = z.id;
    chip.textContent = z.name;
    chips.appendChild(chip);
  }

  let active = null;

  function setZone(id) {
    if (active?.id === id) return;
    const prev = active;
    active = byId[id];
    if (prev) {
      prev.fill.classList.remove("on");
      prev.shownUntil = performance.now() + 500;
    }
    active.fill.classList.add("on");
    active.shownUntil = Infinity;
    active.needs = true;

    const ring = $("ring");
    ring.setAttribute("transform", `translate(${active.dot[0]} ${active.dot[1]})`);
    const inner = $("ring-in");
    inner.style.animation = "none";
    void inner.getBoundingClientRect();
    inner.style.animation = "";

    document.querySelectorAll("[data-zone]").forEach((el) => {
      if (el.tagName === "BUTTON") el.setAttribute("aria-current", String(el.dataset.zone === id));
    });
    const btn = list.querySelector(`[data-zone="${id}"]`);
    const ruler = document.querySelector(".ruler");
    $("marker").style.setProperty("--y", `${btn.offsetTop + btn.offsetHeight / 2 - ruler.offsetTop - 1.5}px`);
    $("coord-zone").textContent = active.coord;
    const chip = chips.querySelector(`[data-zone="${id}"]`);
    if (chips.offsetParent) chips.scrollTo({ left: chip.offsetLeft - (chips.clientWidth - chip.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
  }

  // hover activates, click opens; on touch the first tap activates
  function bind(el, id) {
    el.addEventListener("pointerenter", (e) => e.pointerType === "mouse" && setZone(id));
    el.addEventListener("focus", () => setZone(id));
    el.addEventListener("click", () => {
      if (active?.id !== id) setZone(id);
      else open(id);
    });
  }
  [...svg.querySelectorAll(".hit"), ...marks.querySelectorAll(".dot")].forEach((el) => bind(el, el.dataset.zone));
  list.querySelectorAll("button").forEach((el) => {
    el.addEventListener("pointerenter", () => setZone(el.dataset.zone));
    el.addEventListener("focus", () => setZone(el.dataset.zone));
    el.addEventListener("click", () => open(el.dataset.zone));
  });
  chips.querySelectorAll("button").forEach((el) => bind(el, el.dataset.zone));
  // clicking the ring's plus opens the active story
  svg.addEventListener("click", (e) => {
    if (!active || e.target.classList.contains("hit")) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    if (Math.hypot(p.x - active.dot[0], p.y - active.dot[1]) < 32) open(active.id);
  });

  // ---------- stories ----------

  const track = $("track");
  const viewport = $("viewport");
  const stories = $("stories");
  const N = ZONES.length;

  ZONES.forEach((z, i) => {
    const [x, y, w, h] = G.regions[z.id].box;
    const a = document.createElement("article");
    a.className = "story";
    a.style.setProperty("--card", z.card);
    if (z.ink) a.style.setProperty("--card-ink", z.ink);
    a.setAttribute("aria-label", `${z.city}, ${z.name}`);
    a.innerHTML = `
      <div class="panel"><canvas></canvas></div>
      <div class="card">
        <p class="count">0${i + 1} <b style="--p:${((i + 1) / N) * 100}%"></b> 0${N}</p>
        <figure class="person"><img src="media/${z.id}.jpg" width="882" height="564" alt="${z.alt}" draggable="false"></figure>
        <p class="label rise" style="--i:0">Contro il cambiamento climatico</p>
        <h2 class="city rise" style="--i:1">${z.city}</h2>
        <p class="body rise" style="--i:2">${z.body}</p>
        <svg class="outline" viewBox="${x} ${y} ${w} ${h}" preserveAspectRatio="xMaxYMax meet" aria-hidden="true"><path d="${G.regions[z.id].d}"/></svg>
        <button class="badge" type="button" aria-label="${i < N - 1 ? "Storia successiva" : "Torna alla prima storia"}">
          <svg viewBox="0 0 92 92" aria-hidden="true">
            <defs><path id="badge-${z.id}" d="M10 46a36 36 0 1 1 72 0a36 36 0 1 1-72 0"/></defs>
            <g class="spin"><text><textPath href="#badge-${z.id}" textLength="226" lengthAdjust="spacing">SCOPRI LE STORIE · SCOPRI LE STORIE ·</textPath></text></g>
            <circle cx="46" cy="46" r="22"/>
            <path d="M40 46h12M46 40v12"/>
          </svg>
        </button>
      </div>`;
    a.querySelector(".badge").addEventListener("click", () => go((i + 1) % N));
    track.appendChild(a);
    z.story = a;
    z.panel = a.querySelector(".panel canvas");
  });

  let W = 1; // width of one story
  let pos = 0; // track offset in px
  let index = 0;
  let isOpen = false;
  let anim = null;

  const maxPos = () => (N - 1) * W;
  const place = () => (track.style.transform = `translate3d(${-pos}px,0,0)`);

  function settle(i) {
    index = i;
    ZONES.forEach((z, k) => z.story.classList.toggle("is-on", k === i));
    setZone(ZONES[i].id);
  }

  function go(i, instant) {
    i = Math.max(0, Math.min(N - 1, i));
    const from = pos;
    const to = i * W;
    settle(i);
    if (instant || reduced) {
      anim = null;
      pos = to;
      place();
      return;
    }
    const t0 = performance.now();
    anim = (now) => {
      const t = Math.min(1, (now - t0) / 900);
      const e = t === 1 ? 1 : 1 - 2 ** (-10 * t);
      pos = from + (to - from) * e;
      place();
      if (t === 1) anim = null;
    };
  }

  function open(id) {
    const i = ZONES.findIndex((z) => z.id === id);
    isOpen = true;
    document.documentElement.classList.add("stories-open");
    stories.setAttribute("aria-hidden", "false");
    anim = null;
    index = i;
    pos = i * W;
    place();
    ZONES.forEach((z) => z.story.classList.remove("is-on"));
    // the card's entrance waits until the layer has nearly arrived
    setTimeout(() => isOpen && index === i && settle(i), reduced ? 0 : 650);
    $("back").focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    document.documentElement.classList.remove("stories-open");
    stories.setAttribute("aria-hidden", "true");
    list.querySelector(`[data-zone="${active.id}"]`)?.focus({ preventScroll: true });
  }

  $("back").addEventListener("click", close);

  addEventListener("keydown", (e) => {
    if (!isOpen) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else return;
    e.preventDefault();
  });

  // ---------- dragging: rubber band, momentum, snap ----------

  const drag = $("drag");
  let held = null;

  viewport.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button")) return;
    anim = null;
    held = { x: e.clientX, start: pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false };
    viewport.setPointerCapture(e.pointerId);
    drag.classList.add("down");
  });

  viewport.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") {
      drag.classList.add("on");
      drag.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    }
    if (!held) return;
    const raw = held.start - (e.clientX - held.x);
    const m = maxPos();
    pos = raw < 0 ? raw * 0.35 : raw > m ? m + (raw - m) * 0.35 : raw;
    place();
    const now = performance.now();
    const dt = Math.max(1, now - held.lastT);
    held.v = 0.8 * held.v + 0.2 * (-(e.clientX - held.lastX) / dt);
    held.lastX = e.clientX;
    held.lastT = now;
    if (Math.abs(e.clientX - held.x) > 4) held.moved = true;
  });

  function release() {
    if (!held) return;
    const projected = pos + held.v * 260;
    held = null;
    drag.classList.remove("down");
    go(Math.round(projected / W));
  }
  viewport.addEventListener("pointerup", release);
  viewport.addEventListener("pointercancel", release);
  viewport.addEventListener("pointerleave", () => drag.classList.remove("on"));

  // ---------- layout ----------

  const frame = $("frame");
  const intro = document.querySelector(".intro");
  let scale = 1;

  function layout() {
    const vw = innerWidth;
    const vh = innerHeight;
    const phone = vw <= 760 || vw / vh < 0.8;
    document.documentElement.classList.toggle("phone", phone);
    if (phone && intro.parentNode === frame) document.body.appendChild(intro);
    if (!phone && intro.parentNode !== frame) frame.appendChild(intro);

    let tx, ty;
    if (phone) {
      const top = intro.offsetHeight - 24;
      const avail = vh - top - 72;
      scale = Math.min(vw / 820, avail / 1000);
      tx = vw / 2 - 853 * scale;
      ty = top + avail / 2 - 246 * scale;
    } else {
      scale = Math.min(vw / 1440, vh / 810);
      tx = (vw - 1440 * scale) / 2;
      ty = (vh - 810 * scale) / 2;
    }
    frame.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    document.documentElement.style.setProperty("--slide", `${-520 * scale}px`);
    frame.style.setProperty("--s", scale);
    $("lakecut").style.strokeWidth = 3.2 / scale;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    for (const z of ZONES) {
      const [, , w, h] = G.regions[z.id].box;
      z.canvas.width = Math.round(w * scale * dpr);
      z.canvas.height = Math.round(h * scale * dpr);
      z.needs = true;
    }

    track.style.setProperty("--h", `${vh}px`);
    W = phone ? vw : vh * (0.74 + 0.69);
    for (const z of ZONES) {
      z.panel.width = Math.round((phone ? vw : vh * 0.74) * dpr);
      z.panel.height = Math.round((phone ? vh * 0.42 : vh) * dpr);
    }
    pos = index * W;
    paintedPos = NaN;
    place();
  }

  addEventListener("resize", layout);
  document.fonts?.ready.then(layout);

  // ---------- the clock: every photo is redrawn from the video each frame ----------

  // a photo is repainted only when the video has a new frame, or when it was just shown or moved
  let fresh = true;
  if ("requestVideoFrameCallback" in video) {
    const tick = () => {
      fresh = true;
      video.requestVideoFrameCallback(tick);
    };
    video.requestVideoFrameCallback(tick);
  }
  // without the callback, a playing video counts as a new frame every frame; the still never changes
  const moving = () => video.readyState >= 2 && !video.paused && !("requestVideoFrameCallback" in video);
  let paintedPos = NaN;

  function frameLoop(now) {
    if (anim) anim(now);
    const again = (fresh && video.readyState >= 2) || moving();
    for (const z of ZONES) {
      if (z.shownUntil < now) continue;
      if (again || z.needs) paintZone(z);
      z.needs = false;
    }
    if (document.documentElement.classList.contains("stories-open") && (again || pos !== paintedPos)) {
      paintedPos = pos;
      const vw = viewport.clientWidth;
      ZONES.forEach((z, i) => {
        const left = i * W - pos;
        if (left > vw || left + W < 0) return;
        cover(z.panel.getContext("2d"), z.cell, z.panel.width, z.panel.height, (-left / W) * 0.8);
      });
    }
    fresh = false;
    requestAnimationFrame(frameLoop);
  }

  // autoplay alone doesn't start the video reliably
  video.muted = true;
  const play = () => video.paused && video.play()?.catch(() => {});
  play();
  video.addEventListener("canplay", play);
  ["pointerdown", "keydown"].forEach((t) => addEventListener(t, play, { once: true }));

  layout();
  setZone("midwest");
  requestAnimationFrame(frameLoop);

  // the home tile walks through the zones by itself
  if (preview) {
    let k = 0;
    setInterval(() => setZone(ZONES[++k % N].id), 2600);
  }
})();
