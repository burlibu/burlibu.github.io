// The interface: builds the panel from story.js and tells the scene what to show.
// All text goes in with textContent, including what the user types.
const { PHASES, TECH, WHERE, cleanUser, parseHash, parseDone, wire, trips } = window.STORY;

const params = new URLSearchParams(location.search);
const isPreview = params.has("preview");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const root = document.documentElement;
const frameEl = document.getElementById("frame");
const panel = document.getElementById("panel");
const body = document.getElementById("body");
const strip = document.getElementById("strip");
const SUMMARY = 8;
const STORE = "vetrata.fasi";

if (isPreview) root.classList.add("preview");

let scene = null;
const state = { index: 0, user: "pippo", broken: null, chip: null, pick: null };

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, val] of Object.entries(props)) {
    if (k === "on") for (const [ev, fn] of Object.entries(val)) el.addEventListener(ev, fn);
    else if (k === "class") el.className = val;
    else if (k === "text") el.textContent = val;
    else el.setAttribute(k, val);
  }
  el.append(...kids.filter(Boolean));
  return el;
}

function loadDone() {
  try { return new Set(parseDone(localStorage.getItem(STORE))); } catch (e) { return new Set(); }
}
const done = loadDone();
function saveDone() {
  try { localStorage.setItem(STORE, JSON.stringify([...done])); } catch (e) { /* progress just won't persist */ }
}

/* ---------- strip ---------- */

function buildStrip() {
  strip.replaceChildren();
  const i = state.index;
  const prev = h("button", { class: "pager prev", type: "button", "aria-label": "Fase precedente", on: { click: () => go(i - 1) } },
    h("span", { class: "long", text: "Indietro" }), h("span", { class: "short", text: "‹", "aria-hidden": "true" }));
  prev.disabled = i === 0;
  strip.append(prev);
  PHASES.forEach((p, n) => {
    const b = h("button", {
      class: `pane${done.has(n) ? " on" : ""}`, type: "button", text: String(n + 1),
      "aria-label": `Fase ${n + 1}: ${p.title}${done.has(n) ? ", completata" : ""}`,
      "aria-current": String(n === i), on: { click: () => go(n) },
    });
    b.style.setProperty("--t", TECH[p.tint].color);
    strip.append(b);
  });
  strip.append(h("button", {
    class: "pane sum", type: "button", text: "∑", "aria-label": "Riepilogo",
    "aria-current": String(i === SUMMARY), on: { click: () => go(SUMMARY) },
  }));
  const next = h("button", { class: "pager next", type: "button", "aria-label": i === 7 ? "Riepilogo" : "Fase successiva", on: { click: () => go(i + 1) } },
    h("span", { class: "long", text: i === 7 ? "Riepilogo" : "Avanti" }), h("span", { class: "short", text: "›", "aria-hidden": "true" }));
  next.disabled = i === SUMMARY;
  strip.append(next);
}

/* ---------- panel: one phase ---------- */

const ctx = () => ({ user: state.user, broken: state.broken });

function chipDetail(c) {
  const dl = h("dl");
  if (c.takes) dl.append(h("dt", { text: "Riceve" }), h("dd", { text: c.takes }));
  if (c.returns) dl.append(h("dt", { text: "Ritorna" }), h("dd", { text: c.returns }));
  const badges = h("div", { class: "badges" },
    h("span", { class: "badge", text: `Gira: ${WHERE[c.where]}` }),
    h("span", { class: "badge", text: TECH[c.tech].name }),
    c.extra && h("span", { class: "badge extra", text: "Oltre le slide" }));
  return h("div", { class: "detail" },
    h("h3", { text: c.name }), badges, h("p", { text: c.does }),
    (c.takes || c.returns) && dl,
    c.ex && h("pre", { text: c.ex, class: "ex", style: "margin-top:8px" }));
}

function wireBlocks(phase) {
  const out = [];
  for (const b of wire(phase, ctx())) {
    const pre = h("pre");
    b.text.split("\n").forEach((line, i, all) => {
      const nl = i < all.length - 1 ? "\n" : "";
      if (line.trim().startsWith("//")) pre.append(h("span", { class: "cm", text: line + nl }));
      else pre.append(line + nl);
    });
    pre.tabIndex = 0;
    out.push(h("p", { class: "wire-t", text: b.title }), pre);
  }
  return out;
}

let wireHost = null;
let chipsHost = null;
let userTimer = 0;

function refreshWire(phase) {
  if (wireHost) wireHost.replaceChildren(...wireBlocks(phase));
}

function pushScene(phase) {
  if (scene) scene.show(state.index, phase, trips(phase, ctx()), state.broken);
}

function renderChips(phase) {
  chipsHost.replaceChildren();
  const list = h("div", { class: "chips" });
  for (const c of phase.chips) {
    const dim = state.pick && c.target !== state.pick;
    const b = h("button", {
      class: `chip${c.extra ? " extra" : ""}${dim ? " dim" : ""}`, type: "button", text: c.name,
      "aria-pressed": String(state.chip === c),
      on: {
        click: () => {
          state.chip = state.chip === c ? null : c;
          state.pick = null;
          if (scene) scene.setFocus(state.chip ? state.chip.target : null);
          renderChips(phase);
        },
      },
    });
    b.style.setProperty("--c", TECH[c.tech].color);
    list.append(b);
  }
  chipsHost.append(list);
  if (state.pick) {
    const hits = phase.chips.filter((c) => c.target === state.pick);
    const name = TECH[state.pick] ? TECH[state.pick].name : { packet: "Il pacchetto", dns: "Il DNS", url: "L'URL", tube: "Il canale TLS", dom: "Il DOM" }[state.pick];
    chipsHost.append(h("p", { class: "hint", text: hits.length ? `${name}: in questa fase, ${hits.length === 1 ? "questa voce" : `queste ${hits.length} voci`}.` : `${name} non ha un ruolo diretto in questa fase.` }));
    chipsHost.append(h("button", {
      class: "linkish", type: "button", text: "Mostra tutte",
      on: { click: () => { state.pick = null; if (scene) scene.setFocus(null); renderChips(phase); } },
    }));
  } else if (state.chip) {
    chipsHost.append(chipDetail(state.chip));
  } else {
    chipsHost.append(h("p", { class: "hint", text: "Clicca una voce per il dettaglio e per vedere dove gira. Clicca un oggetto nella scena per il contrario." }));
  }
}

function renderBreaks(phase) {
  const host = h("div");
  phase.breaks.forEach((b) => {
    const active = state.broken === b.id;
    host.append(h("button", {
      class: "switch", type: "button", role: "switch", "aria-checked": String(active),
      on: {
        click: () => {
          state.broken = active ? null : b.id;
          replaceSection("breaks", renderBreaks(phase));
          refreshWire(phase);
          pushScene(phase);
        },
      },
    }, h("i"), h("span", { text: b.label })));
    if (active) host.append(h("p", { class: "effect", role: "status", text: b.effect }));
  });
  host.dataset.section = "breaks";
  return host;
}

function replaceSection(name, node) {
  const old = body.querySelector(`[data-section="${name}"]`);
  if (old) old.replaceWith(node);
}

function renderAsk(phase, i) {
  const a = phase.ask;
  const host = h("div", { class: "ask" }, h("p", { text: a.q }), h("code", { text: a.code }));
  const verdict = h("div", { class: "verdict", role: "status" });
  const opts = h("div", { class: "opts" });
  for (const [key, name] of Object.entries(WHERE)) {
    opts.append(h("button", {
      class: "opt", type: "button", text: name,
      on: {
        click: (e) => {
          const right = key === a.answer;
          opts.querySelectorAll(".opt").forEach((o) => o.classList.remove("right", "wrong"));
          e.currentTarget.classList.add(right ? "right" : "wrong");
          verdict.replaceChildren(h("b", { text: right ? "Esatto." : "Non qui. Riprova." }), a.why);
          if (right && !done.has(i)) {
            done.add(i);
            saveDone();
            if (scene) scene.setLit(done);
            buildStrip();
          }
        },
      },
    }));
  }
  host.append(opts, verdict);
  return host;
}

function renderPhase(i) {
  const p = PHASES[i];
  root.style.setProperty("--t", TECH[p.tint].color);
  document.getElementById("eb").textContent = `Fase ${i + 1} di 8`;
  document.getElementById("heading").textContent = p.title;

  body.replaceChildren(h("p", { class: "story", text: p.story }));

  if (p.user) {
    const input = h("input", {
      value: state.user, maxlength: "24", autocomplete: "off", spellcheck: "false", name: "username",
      on: {
        input: (e) => {
          state.user = cleanUser(e.target.value);
          if (scene) scene.setUser(state.user);
          refreshWire(p);
          clearTimeout(userTimer);
          userTimer = setTimeout(() => pushScene(p), 260);
        },
      },
    });
    body.append(h("label", { class: "user" }, "Username, solo pippo entra", input));
  }

  body.append(h("h2", { text: "Funzioni e dettagli" }));
  chipsHost = h("div");
  body.append(chipsHost);
  renderChips(p);

  body.append(h("h2", { text: "Sul filo" }));
  wireHost = h("div");
  body.append(wireHost);
  refreshWire(p);

  body.append(h("h2", { text: "Rompilo" }), renderBreaks(p));

  for (const n of p.notes) body.append(h("p", { class: "note" }, h("b", { text: "Precisazione sulle slide" }), n));

  body.append(h("h2", { text: "Dove gira?" }), renderAsk(p, i));
  body.append(h("p", { class: "fine", text: "Tutto è simulato nel browser: questo sito non esegue PHP. Le voci tratteggiate vanno oltre le slide SAW e vengono da manuale PHP e MDN." }));
}

/* ---------- panel: summary ---------- */

function renderSummary() {
  root.style.setProperty("--t", TECH.cookie.color);
  document.getElementById("eb").textContent = `${done.size} scomparti accesi su 8`;
  document.getElementById("heading").textContent = "La vetrata";
  const results = h("div");

  function list(q) {
    results.replaceChildren();
    const needle = q.trim().toLowerCase();
    for (const [key, name] of Object.entries(WHERE)) {
      const rows = [];
      PHASES.forEach((p, i) => p.chips.forEach((c) => {
        if (c.where !== key) return;
        if (needle && !`${c.name} ${c.does}`.toLowerCase().includes(needle)) return;
        const row = h("button", { class: "row", type: "button", on: { click: () => go(i) } },
          h("span", { class: "sw" }), h("span", { class: "n", text: c.name }),
          h("span", { class: "f", text: `Fase ${i + 1}` }), h("span", { class: "d", text: c.does }));
        row.querySelector(".sw").style.background = TECH[c.tech].color;
        rows.push(row);
      }));
      if (rows.length) results.append(h("section", { class: "group" }, h("h2", { text: name }), ...rows));
    }
    if (!results.children.length) results.append(h("p", { class: "hint", text: "Nessuna voce trovata." }));
  }

  const intro = done.size === 8
    ? "La finestra è completa. Ogni scomparto è una fase, e insieme sono lo stack: browser, rete, server, database, e di nuovo indietro."
    : "Tutte le voci del percorso, divise per dove girano. Ogni scomparto della vetrata si accende rispondendo alla domanda della sua fase.";
  body.replaceChildren(
    h("p", { class: "story", text: intro }),
    h("input", { class: "filter", type: "search", placeholder: "Cerca una funzione…", "aria-label": "Cerca una funzione", on: { input: (e) => list(e.target.value) } }),
    results,
    h("button", { class: "pager print", type: "button", text: "Stampa", on: { click: () => window.print() } }),
  );
  list("");
}

/* ---------- navigation ---------- */

function apply(i) {
  state.index = i;
  state.broken = null;
  state.chip = null;
  state.pick = null;
  buildStrip();
  body.scrollTop = 0;
  if (i === SUMMARY) {
    renderSummary();
    if (scene) scene.show(SUMMARY, null, [], null);
  } else {
    renderPhase(i);
    pushScene(PHASES[i]);
  }
}

function go(i) {
  const n = Math.max(0, Math.min(SUMMARY, i));
  const next = n === SUMMARY ? "#riepilogo" : `#fase/${n + 1}`;
  if (location.hash === next) apply(n);
  else location.hash = next;
}

addEventListener("hashchange", () => apply(parseHash(location.hash)));
addEventListener("keydown", (e) => {
  if (e.altKey || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === "ArrowRight") go(state.index + 1);
  if (e.key === "ArrowLeft") go(state.index - 1);
});

/* ---------- layout ---------- */

const sheetMode = matchMedia("(max-width: 900px) and (orientation: portrait)");

function syncInset() {
  if (!scene) return;
  if (isPreview) { scene.setInset(0, 0); return; }
  if (sheetMode.matches) scene.setInset(0, panel.offsetHeight + strip.offsetHeight + 10);
  else scene.setInset(panel.offsetWidth + 22, 0);
}

new ResizeObserver(syncInset).observe(frameEl);

const grip = document.getElementById("grip");
let drag = null;
grip.addEventListener("pointerdown", (e) => {
  drag = { y: e.clientY, h: panel.offsetHeight, moved: false };
  grip.setPointerCapture(e.pointerId);
});
grip.addEventListener("pointermove", (e) => {
  if (!drag) return;
  if (Math.abs(e.clientY - drag.y) > 3) drag.moved = true;
  const total = frameEl.clientHeight;
  const next = Math.max(total * 0.28, Math.min(total * 0.86, drag.h + drag.y - e.clientY));
  frameEl.style.setProperty("--sheet", `${next}px`);
});
grip.addEventListener("pointerup", () => {
  if (drag && !drag.moved) {
    const big = panel.offsetHeight > frameEl.clientHeight * 0.6;
    frameEl.style.setProperty("--sheet", big ? "40%" : "80%");
  }
  drag = null;
  syncInset();
});
grip.addEventListener("click", (e) => {
  // A keyboard click has no pointer events and comes with detail 0.
  if (e.detail === 0) {
    const big = panel.offsetHeight > frameEl.clientHeight * 0.6;
    frameEl.style.setProperty("--sheet", big ? "40%" : "80%");
    syncInset();
  }
});

function drawShade() {
  const g = document.getElementById("shade").getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, 64, 36);
  g.strokeStyle = "rgba(120,114,96,.9)";
  g.lineCap = "round";
  for (const [a, b, c, d, w] of [[-4, 8, 22, -2, 3], [-3, 20, 30, 0, 2.2], [-4, 30, 38, 4, 2], [50, 40, 70, 12, 2.4], [38, 42, 66, 22, 1.6], [-5, 36, 12, 26, 3]]) {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(a, b);
    g.quadraticCurveTo((a + c) / 2 + 3, (b + d) / 2 + 4, c, d);
    g.stroke();
  }
}

/* ---------- start ---------- */

drawShade();
// The panel works even if the fonts or the scene never arrive.
const first = isPreview ? 6 : parseHash(location.hash);
apply(first);
if (isPreview) document.getElementById("heading").textContent = "Vetrata";

const fonts = Promise.all(['58px "Goudy Bookletter 1911"', '34px "Sorts Mill Goudy"'].map((f) => document.fonts.load(f)));
try {
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 2000))]);
} catch (e) { /* canvas text falls back to serif */ }

try {
  const { createScene } = await import("./scene.js");
  scene = createScene(document.getElementById("gl"), {
    story: window.STORY,
    preview: isPreview,
    reduced,
    hq: params.get("qualita") === "alta",
    onPick: (id) => {
      if (state.index === SUMMARY) return;
      state.pick = id;
      state.chip = null;
      scene.setFocus(id);
      renderChips(PHASES[state.index]);
      chipsHost.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
    },
  });
  scene.setLit(isPreview ? [0, 1, 2, 3, 4, 5, 6, 7] : done);
  syncInset();
  fonts.then(() => scene.refreshText(), () => {});
  if (state.index === SUMMARY) scene.show(SUMMARY, null, [], null);
  else pushScene(PHASES[state.index]);
} catch (err) {
  console.warn("Vetrata: scena 3D non disponibile.", err);
  root.classList.add("no-gl");
}
