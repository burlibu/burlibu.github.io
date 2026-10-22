// Blasone UI: lays the engine state (game.js) out as printed sheets. The beasts
// are engraved at load: each one's emoji is drawn to a canvas and re-inked as
// woodcut hatching (wavy engraving lines whose weight follows the shading,
// cross-hatching in the darks, a heavy contour). In ?preview two AIs play.
// The menu (a native <dialog>) holds the game options, the Prove dell'Araldo,
// the rules, the bestiary and the display settings; the choices are kept in
// localStorage. A Draft game opens on the draft sheet before the duel.
(() => {
  const B = window.Blasone;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const NUM = ["", "I", "II", "III", "IV", "V", "VI"];
  const VERSION = "0.0.7";
  const KEYS = Object.keys(B.BEASTS);

  // ---------- woodcut engraving ----------
  const ART = {};
  // glyph: one emoji, or parts [emoji, x, y, size, mirrored] drawn in order
  function engrave(glyph, S = 256) {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.textAlign = "center";
    x.textBaseline = "middle";
    for (const [g, px, py, size, flip] of Array.isArray(glyph) ? glyph : [[glyph, 0.5, 0.54, 0.8]]) {
      x.save();
      x.font = `${Math.round(S * size)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
      x.translate(S * px, S * py);
      if (flip) x.scale(-1, 1);
      x.fillText(g, 0, 0);
      x.restore();
    }
    const src = x.getImageData(0, 0, S, S).data;
    const out = x.createImageData(S, S);
    const o = out.data;
    const A = (px, py) => (px < 0 || py < 0 || px >= S || py >= S ? 0 : src[(py * S + px) * 4 + 3]);
    for (let py = 0; py < S; py++)
      for (let px = 0; px < S; px++) {
        const i = (py * S + px) * 4;
        if (src[i + 3] < 128) continue;
        const L = (0.3 * src[i] + 0.59 * src[i + 1] + 0.11 * src[i + 2]) / 255;
        const t = Math.min(1, Math.max(0, (0.92 - L) * 1.35)); // darkness
        let ink = false;
        // contour: any transparent pixel within two steps
        if (A(px - 2, py) < 128 || A(px + 2, py) < 128 || A(px, py - 2) < 128 || A(px, py + 2) < 128) ink = true;
        // engraving lines: wavy, thicker where the image is darker
        const ph = (py + 2.4 * Math.sin(px * 0.06 + py * 0.015) + 1000) % 5;
        if (ph < t * 4.2) ink = true;
        if (t > 0.5 && (px - py + 1024) % 6 < (t - 0.5) * 5) ink = true;
        if (t > 0.78 && (px + py) % 5 < 1.3) ink = true;
        if (ink) {
          o[i] = 15;
          o[i + 1] = 15;
          o[i + 2] = 16;
          o[i + 3] = 255;
        }
      }
    x.putImageData(out, 0, 0);
    return c.toDataURL();
  }
  KEYS.forEach((k) => (ART[k] = engrave(B.BEASTS[k].glyph)));
  // the coloured cards re-ink the same engraving through a mask, so each
  // beast's art is also a custom property (.art-<id> { --art })
  const artCss = document.createElement("style");
  artCss.textContent = KEYS.map((k) => `.art-${k}{--art:url(${ART[k]})}`).join("");
  document.head.appendChild(artCss);
  // the classes that colour a card: its tincture and its house
  const skin = (id) => `t-${B.BEASTS[id].t} h-${B.HOUSE[id].id} art-${id}`;

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tinct = (t, cls = "tinct") =>
    `<svg class="${cls}" viewBox="0 0 40 46" aria-hidden="true"><use href="#shield" fill="#f4f3ee"/><use href="#shield" fill="url(#h-${t})"/><use href="#shield" fill="none" stroke="#0f0f10" stroke-width="2"/></svg>`;
  const plateNo = (id) => "Plate " + String(KEYS.indexOf(id) + 1).padStart(2, "0");

  // ---------- preferences ----------
  // the Conte's styles only change the AI's noise (see choose in game.js)
  const CONTE = {
    prudente: { name: "Prudente", noise: 0, text: "Gioca sempre la mossa che gli sembra migliore. Costante e un po' più forte." },
    standard: { name: "Standard", noise: 0.35, text: "Qualche scelta meno ovvia. L'avversario di sempre." },
    variabile: { name: "Variabile", noise: 2, text: "Spesso tenta mosse azzardate: imprevedibile, e più facile da battere." },
  };
  const SIZES = { 1: "Normale", 1.15: "Grande", 1.3: "Molto grande" };
  const prefs = { format: "classico", editto: false, conte: "standard", motion: false, size: 1, colors: true };
  // stored prefs are untrusted: copy only known keys holding allowed values
  const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);
  function readPrefs(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    if (own(B.FORMATS, raw.format)) prefs.format = raw.format;
    if (own(CONTE, raw.conte)) prefs.conte = raw.conte;
    if (own(SIZES, String(raw.size)) && typeof raw.size === "number") prefs.size = raw.size;
    for (const k of ["editto", "motion", "colors"]) if (typeof raw[k] === "boolean") prefs[k] = raw[k];
  }
  try {
    const raw = localStorage.getItem("blasone.prefs");
    if (raw && raw.length < 500) readPrefs(JSON.parse(raw));
  } catch (e) {}
  const save = () => {
    try {
      localStorage.setItem("blasone.prefs", JSON.stringify(prefs));
    } catch (e) {}
  };
  function applyView() {
    document.documentElement.dataset.motion = prefs.motion ? "ridotto" : "";
    // without it the cards are printed in black ink only, as at first
    document.documentElement.dataset.cards = prefs.colors ? "colore" : "";
    document.documentElement.style.setProperty("--zoom", SIZES[prefs.size] ? prefs.size : 1);
  }

  // ---------- state ----------
  // ?seed= is untrusted too: a whole number in the rng's range, or ignored
  const seedParam = /^\d{1,10}$/.test(params.get("seed") || "") && +params.get("seed") <= 0xffffffff ? +params.get("seed") : null;
  let s, picked = null, edictArmed = false, conte = "standard", endTimer = 0, draftSeen = false;
  // from: a parsed game code (parseCode) to replay, { trial: n }, or nothing
  // for a new game with the menu's options
  function newGame(from) {
    const g = from || {
      seed: seedParam ?? (Math.random() * 1e9) | 0,
      format: preview ? "classico" : prefs.format,
      editto: !preview && prefs.editto,
      conte: preview ? "standard" : prefs.conte,
    };
    // a trial that fails its checks falls back to a plain game
    s = B.create(g.seed, g) || B.create((Math.random() * 1e9) | 0, {});
    // the Conte plays trials with no noise, so they always answer the same way
    conte = s.trial !== undefined ? "prudente" : own(CONTE, g.conte) ? g.conte : "standard";
    picked = null;
    edictArmed = false;
    draftSeen = false;
    clearTimeout(endTimer);
    hideVeil($("end"));
    $("hintText").hidden = true;
    $("hintBtn").setAttribute("aria-expanded", "false");
    $("draftMsg").textContent = "";
    $("reveal").textContent =
      g.trial !== undefined && s.trial === undefined
        ? "Questa prova non è disponibile: comincia una partita normale."
        : s.trial !== undefined
        ? `Prova dell'Araldo: ${B.TRIALS[s.trial].goalText}`
        : s.draft
        ? "Prima del duello, il draft: scegli quattro carte tra le otto scoperte."
        : "Le mosse dei due lati si rivelano insieme, a fine turno.";
    render();
  }
  const gameCode = () => B.code(s, conte);
  const playing = () => (s.log.length > 0 || (s.draft && s.draft.notes.length > 0)) && !s.over;
  const drafting = () => !!B.draftTurn(s);
  const formatName = () => (s.trial !== undefined ? `Prova dell'Araldo ${s.trial + 1}` : B.FORMATS[s.format].name);
  const names = (ids) => ids.map((id) => B.BEASTS[id].name).join(", ");

  // ---------- board ----------
  const signed = (v) => `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
  // a laid card: a button that opens its full sheet (see peek)
  function mini(c, q, side, k, fresh) {
    const b = B.BEASTS[c.id], d = c.power - c.base;
    const why = c.mods.map((m) => `${signed(m.v)} ${m.why}`).join(", ");
    return `<button type="button" class="mini ${skin(c.id)} ${fresh || ""}" data-q="${q}" data-side="${side}" data-k="${k}" title="${esc(b.name)} · forza ${c.power}${why ? " (" + esc(why) + ")" : ""}" aria-label="${esc(b.name)}, forza ${c.power}. Apri la carta">
      ${tinct(b.t)}<img src="${ART[c.id]}" alt="" /><span class="ink"></span>
      <span class="pw">${c.power}${d ? `<small class="${d > 0 ? "up" : "dn"}">${signed(d)}</small>` : ""}</span></button>`;
  }

  function renderBoard() {
    const e = B.evaluate(s);
    const html = e.quarters
      .map((x) => {
        const f = x.field, q = x.q;
        const open = B.legal(s, "me", q), waiting = drafting();
        const fresh = (c, side) => (s.last && s.last[side] === c.uid ? "fresh-" + side : "");
        const crown = `<svg aria-hidden="true"><use href="#crown"/></svg>`;
        const extra = B.SIDES.flatMap((side) =>
          x.extra[side].map(
            (why) => `<span class="bonus" title="${why}: +1 corona solo se ${side === "me" ? "tu conquisti" : "il Conte conquista"} il quarto">+${crown}<span>${side === "me" ? "Tu" : "C"} · ${why}</span></span>`
          )
        ).join("");
        const crowns = crown.repeat(x.crowns) + extra;
        return `<article class="plate ${open || s.over || waiting ? "" : "shut"}" aria-label="Quarto ${B.ROMAN[q]}, ${esc(f.name)}">
          <header class="plate-head">
            <span class="numeral">${B.ROMAN[q]}</span>
            <div class="field">${tinct(f.t, "esc")}<div><h3><small>${B.QUARTERS[q]}</small>${esc(f.name)}</h3><p>${esc(f.text)}</p></div></div>
            <span class="crowns" title="${x.crowns} ${x.crowns === 1 ? "corona" : "corone"}">${crowns}</span>
          </header>
          <div class="row foe">${x.foe.cards.map((c, k) => mini(c, q, "foe", k, fresh(c, "foe"))).join("") || `<span class="slot"><span class="empty">Il Conte non ha carte qui</span></span>`}</div>
          <div class="band">
            <span class="foe-tot"><span class="label">Conte</span> <b class="tot">${x.foe.total}</b></span>
            <span class="lead ${x.lead || ""}" title="${x.lead === "me" ? "Il quarto è tuo" : x.lead === "foe" ? "Il quarto è del Conte" : "Quarto conteso"}">${x.lead === "me" ? "TU" : x.lead === "foe" ? "C" : "—"}</span>
            <span class="me-tot"><b class="tot">${x.me.total}</b> <span class="label">Tu</span></span>
          </div>
          <div class="row me ${open ? "open" : ""}" data-q="${q}">${x.me.cards.map((c, k) => mini(c, q, "me", k, fresh(c, "me"))).join("")}<button class="slot" data-q="${q}" ${open && picked !== null ? "" : "disabled"} aria-label="Gioca nel quarto ${B.ROMAN[q]}">
            ${open ? `<span class="empty">${x.me.cards.length ? "" : "Posa qui"}</span>` : s.over || waiting ? "" : `<span class="empty">Pieno</span>`}
          </button></div>
        </article>`;
      })
      .join("");
    const board = $("board");
    board.innerHTML = html + `<i class="fold" aria-hidden="true"></i>`;
    board.classList.toggle("picking", picked !== null);
    $("scoreMe").textContent = e.score.me;
    $("scoreFoe").textContent = e.score.foe;
    $("turn").textContent = s.over ? (s.trial !== undefined ? "Prova conclusa" : "Torneo concluso") : drafting() ? "Draft delle Casate" : `Turno ${NUM[s.turn]} di ${NUM[B.TURNS]}`;
    if (s.log.length) $("reveal").textContent = `Mosse rivelate insieme · Turno ${NUM[s.log[0].turn]} — Tu: ${s.log[0].me} · Il Conte: ${s.log[0].foe}`;
  }

  // ---------- hand ----------
  // the printed face, shared by the hand and the peek sheet
  // corners, shield, ink and house ribbon only show on the coloured cards
  function face(id) {
    const b = B.BEASTS[id];
    return `<span class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="card-top"><b class="pwr"><svg class="pwr-shield" viewBox="0 0 40 46" aria-hidden="true"><use href="#shield"/></svg><span>${b.power}</span></b><span class="label">${plateNo(id)}<br />${B.TINCT[b.t].name}</span></span>
      <span class="art"><img src="${ART[id]}" alt="" /><span class="ink"></span>${tinct(b.t)}</span>
      <span class="card-body"><h4>${esc(b.name)}</h4><p class="ab"><i>${esc(b.ab)}.</i> ${esc(b.text)}</p></span>
      <span class="house">${esc(B.HOUSE[id].name)}</span>`;
  }
  function card(c, i) {
    const b = B.BEASTS[c.id];
    return `<button class="card ${skin(c.id)}" data-i="${i}" aria-pressed="${picked === i}" aria-label="${esc(b.name)}, forza ${b.power}, ${B.TINCT[b.t].name}. ${esc(b.ab)}: ${esc(b.text)}">${face(c.id)}</button>`;
  }
  function renderHand() {
    const hand = $("hand");
    hand.innerHTML = s.hands.me.map(card).join("");
    hand.classList.toggle("locked", !!s.over);
    $("deckInfo").textContent =
      s.trial !== undefined
        ? `${formatName()} · nessuna pesca`
        : drafting()
        ? `${formatName()} · scelta ${s.draft.picks.me.length + 1} di 4`
        : `Mazzo: ${s.decks.me.length} · ${formatName()}`;
    $("handHint").textContent = s.over
      ? s.trial !== undefined ? "Prova conclusa" : "Torneo concluso"
      : drafting()
      ? "Draft: scegli una carta tra le otto scoperte"
      : picked === null
      ? "Scegli una carta, poi un quarto"
      : `${B.BEASTS[s.hands.me[picked].id].name}: ora scegli un quarto${edictArmed ? ", con l'Editto" : ""}`;
    $("cancelBtn").hidden = picked === null;
    $("endBtn").hidden = !s.over;
    // the Editto: shown only when the rule is on
    const eb = $("edictBtn"), used = s.edict && s.edict.me;
    eb.hidden = !s.edict;
    if (s.edict) {
      const open = B.edictOpen(s, "me");
      eb.disabled = !open;
      eb.setAttribute("aria-pressed", open && edictArmed);
      eb.textContent = used ? `Editto usato · quarto ${B.ROMAN[used.q]}` : s.over ? "Editto non usato" : !open ? "Editto dal turno II" : edictArmed ? "Editto dichiarato" : "Dichiara l'Editto";
    }
  }

  // ---------- side sheet ----------
  function renderSide() {
    const n = s.hands.foe.length, fh = $("foeHand");
    // in a trial the Conte's hand is face up
    const open = s.trial !== undefined;
    $("foeInfo").textContent = open
      ? `Mano scoperta · ${n} ${n === 1 ? "carta" : "carte"} · nessuna pesca`
      : `${n} ${n === 1 ? "carta" : "carte"} in mano · ${s.decks.foe.length} nel mazzo`;
    fh.classList.toggle("open", open);
    if (open) {
      fh.removeAttribute("aria-hidden");
      fh.setAttribute("aria-label", "La mano del Conte, scoperta");
      fh.setAttribute("role", "list");
    } else {
      fh.setAttribute("aria-hidden", "true");
      fh.removeAttribute("role");
    }
    fh.innerHTML = open
      ? s.hands.foe
          .map((c) => {
            const b = B.BEASTS[c.id];
            return `<span class="chip ${skin(c.id)}" role="listitem" title="${esc(b.ab)}: ${esc(b.text)}">${tinct(b.t)}<img src="${ART[c.id]}" alt="" /><span class="ink"></span><b>${esc(b.name)}</b> ${b.power}</span>`;
          })
          .join("")
      : Array.from({ length: n }, () => `<span class="back"></span>`).join("");
    const d = s.draft && !drafting() ? `<li><b>Draft · prima del duello</b>Tu: ${esc(names(s.draft.picks.me))}.<br />Il Conte: ${esc(names(s.draft.picks.foe))}.</li>` : "";
    $("log").innerHTML =
      s.log.map((l) => `<li><b>Turno ${NUM[l.turn]} · rivelate insieme</b>Tu: ${esc(l.me)}.<br />Il Conte: ${esc(l.foe)}.</li>`).join("") + d ||
      `<li class="empty">${drafting() ? "Il draft è in corso: le carte scelte entrano nei mazzi." : "Il torneo sta per cominciare. Le prime carte si scoprono insieme."}</li>`;
  }

  // ---------- draft sheet ----------
  function renderDraft() {
    const d = s.draft, box = $("draft");
    box.hidden = !d || draftSeen;
    if (box.hidden) return;
    const turn = B.draftTurn(s);
    const who = (id) => (d.picks.me.includes(id) ? "me" : d.picks.foe.includes(id) ? "foe" : null);
    $("draftOrder").innerHTML = B.DRAFT_ORDER.map((side, k) => {
      const n = d.notes[k];
      return `<li class="${side}${n ? " done" : k === d.notes.length ? " now" : ""}"><span class="label">${k + 1} · ${side === "me" ? "Tu" : "Conte"}</span>${n ? esc(B.BEASTS[n.id].name) : k === d.notes.length ? "tocca a te" : ""}</li>`;
    }).join("");
    $("draftOffer").innerHTML = d.offer
      .map((id) => {
        const b = B.BEASTS[id], w = who(id);
        const state = w === "me" ? "Scelta da te" : w === "foe" ? "Scelta dal Conte" : "Libera";
        return `<figure class="beast offer ${w ? "taken " + w : ""}"><button type="button" class="card ${skin(id)}" data-id="${id}" ${w || turn !== "me" ? "disabled" : ""} aria-label="${esc(b.name)}, forza ${b.power}, ${B.TINCT[b.t].name}. ${esc(b.ab)}: ${esc(b.text)} ${state}.">${face(id)}</button>
          <figcaption class="label">${w === "me" ? "<b>Tua</b>" : w === "foe" ? "<b>Del Conte</b>" : "Libera"} · ${esc(B.HOUSE[id].name)}</figcaption></figure>`;
      })
      .join("");
    $("draftRecap").hidden = !!turn;
    if (!turn)
      $("draftRecap").innerHTML = `<p class="label">Le scelte del Conte, spiegate</p>
        <ul>${d.notes.filter((n) => n.side === "foe").map((n) => `<li><b>${esc(B.BEASTS[n.id].name)}</b> ${esc(n.why)}</li>`).join("")}</ul>
        <p>Il tuo mazzo: le dodici carte del Bestiario, più ${esc(names(d.picks.me))}. Il Conte ha lo stesso Bestiario, più le sue quattro.</p>
        <button class="tool solid" id="duelBtn">Al duello</button>`;
  }
  $("draftOffer").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-id]");
    if (!b || b.disabled) return;
    const from = s.draft.notes.length;
    if (!B.pick(s, b.dataset.id, CONTE[conte].noise)) return;
    const foe = s.draft.notes.slice(from + 1).map((n) => B.BEASTS[n.id].name);
    $("draftMsg").textContent =
      `Hai scelto ${B.BEASTS[b.dataset.id].name}.` + (foe.length ? ` Il Conte sceglie ${foe.join(" e ")}.` : "") + (drafting() ? " Tocca a te." : " Draft concluso: i mazzi sono pronti.");
    render();
    (drafting() ? $("draftOffer").querySelector("button:not(:disabled)") : $("duelBtn"))?.focus();
  });
  $("draftRecap").addEventListener("click", (e) => {
    if (!e.target.closest("#duelBtn")) return;
    draftSeen = true;
    render();
    $("hand").querySelector(".card")?.focus();
  });

  // ---------- trial goal ----------
  let solved = [];
  try {
    const raw = localStorage.getItem("blasone.prove");
    const v = raw && raw.length < 100 ? JSON.parse(raw) : null;
    // stored data is untrusted: only known trial numbers, once each
    if (Array.isArray(v)) solved = [...new Set(v.filter((n) => Number.isInteger(n) && n >= 0 && n < B.TRIALS.length))];
  } catch (e) {}
  // every pass writes the clean list back
  function markSolved(n) {
    if (!solved.includes(n)) solved.push(n);
    try {
      localStorage.setItem("blasone.prove", JSON.stringify(solved));
    } catch (e) {}
  }
  function renderGoal() {
    const t = s.trial !== undefined && B.TRIALS[s.trial];
    $("goal").hidden = !t;
    if (!t) return;
    $("goalLabel").textContent = `Prova dell'Araldo ${s.trial + 1} di ${B.TRIALS.length} · ${t.level}${solved.includes(s.trial) ? " · superata" : ""}`;
    $("goalTitle").textContent = t.name;
    $("goalText").textContent = t.goalText;
    $("hintText").textContent = t.hint;
  }
  $("hintBtn").onclick = () => {
    const open = $("hintText").hidden;
    $("hintText").hidden = !open;
    $("hintBtn").setAttribute("aria-expanded", open);
  };

  function render() {
    renderBoard();
    renderHand();
    renderSide();
    renderDraft();
    renderGoal();
  }

  // ---------- veils: the end sheet and the peek block the desk behind them ----------
  const desk = document.querySelector(".desk");
  const reduced = () => prefs.motion || matchMedia("(prefers-reduced-motion: reduce)").matches;
  function hideVeil(v) {
    v.hidden = true;
    v.classList.remove("entering");
    desk.inert = !$("end").hidden || !$("peek").hidden;
  }

  // ---------- peek: the full sheet of a card on the shield ----------
  let peekFrom = null;
  function peek(q, side, k, from) {
    const x = B.evaluate(s).quarters[q], c = x[side].cards[k];
    $("peekLabel").textContent = `Quarto ${B.ROMAN[q]} · ${x.field.name} · ${side === "me" ? "tua" : "del Conte"} · turno ${NUM[c.at]}`;
    $("peekCard").className = "card " + skin(c.id);
    $("peekCard").innerHTML = face(c.id);
    $("peekTitle").textContent = `Forza ${c.power}`;
    const named = (why) => (why === "campo" ? x.field.name : why === "tinture" ? "Legge delle tinture" : why);
    $("peekMods").innerHTML =
      `<li><span>Forza stampata</span><b>${c.base}</b></li>` +
      c.mods.map((m) => `<li><span>${esc(named(m.why))}</span><b>${signed(m.v)}</b></li>`).join("") +
      (c.mods.reduce((t, m) => t + m.v, c.base) < 0 ? `<li><span>La forza non scende sotto zero</span><b></b></li>` : "") +
      reactions(x, side, c);
    peekFrom = from;
    $("peek").hidden = false;
    desk.inert = true;
    $("peekClose").focus();
  }
  // what a Basilisco or an Arpia has done to the cards laid after it
  function reactions(x, side, c) {
    if (c.id !== "basilisco" && c.id !== "arpia") return "";
    const name = B.BEASTS[c.id].name;
    const hit = x[side === "me" ? "foe" : "me"].cards.filter((o) => o.mods.some((m) => m.why === name));
    return `<li><span>Reazione: ${hit.length ? esc(hit.map((o) => `${B.BEASTS[o.id].name} (turno ${NUM[o.at]})`).join(", ")) : "nessuna carta colpita finora"}</span><b></b></li>`;
  }
  function closePeek() {
    hideVeil($("peek"));
    if (peekFrom && peekFrom.isConnected) peekFrom.focus();
    peekFrom = null;
  }
  $("peekClose").onclick = closePeek;
  $("peek").addEventListener("click", (e) => e.target === $("peek") && closePeek());
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || $("menu").open) return;
    if (!$("peek").hidden) closePeek();
    else if (!$("end").hidden && !$("end").inert) closeEnd();
    else if (picked !== null) cancelPick();
  });

  // ---------- end ----------
  // which quarters went where and for how many crowns, then the effects that
  // weighed most on each side
  const WHO = { me: "Tu", foe: "Il Conte" };
  const named = (why) => (why === "campo" ? "Campi" : why === "tinture" ? "Tinture" : why);
  const OF = { me: "tua", foe: "del Conte" };
  // why a quarter went where it went, in words
  function reason(x) {
    const a = x.me, z = x.foe, rov = x.field.id === "rovescio";
    if (!a.cards.length && !z.cards.length) return "Nessuno ha giocato qui.";
    if (!a.cards.length || !z.cards.length)
      return `Solo ${x.lead === "me" ? "tu hai" : "il Conte ha"} carte qui: il quarto è ${OF[x.lead]}${rov ? ", anche sul Campo rovesciato" : ""}.`;
    if (!x.lead) return `Totali pari, ${a.total} a ${z.total}: il quarto non va a nessuno.`;
    const w = x[x.lead].total, l = x[x.lead === "me" ? "foe" : "me"].total;
    return rov
      ? `Campo rovesciato: vince il totale più basso, ${w} contro ${l}. Il quarto è ${OF[x.lead]}.`
      : `Totale più alto, ${w} contro ${l}: il quarto è ${OF[x.lead]}.`;
  }
  // every crown on the quarter, whose it is and whether it was paid
  function crownLines(x) {
    const base = x.field.id === "argento" ? 2 : 1, towers = x.crowns - base;
    const lines = [`Base: ${base}${base === 2 ? " (Campo d'argento)" : ""}, a chi conquista il quarto.`];
    if (towers) {
      const by = B.SIDES.map((side) => [side, x[side].cards.filter((c) => c.id === "torre").length]).filter(([, n]) => n);
      lines.push(`Torri: +${towers} (${by.map(([side, n]) => `${n} ${OF[side]}`).join(", ")}), a chi conquista il quarto.`);
    }
    for (const side of B.SIDES)
      for (const why of x.extra[side])
        lines.push(`${why} ${OF[side]}: +1 solo ${side === "me" ? "per te" : "per il Conte"}, ${x.lead === side ? "assegnata" : "non assegnata, il quarto non è " + OF[side]}.`);
    lines.push(x.lead ? `Assegnate: ${x.crowns + x.bonus[x.lead]} ${x.lead === "me" ? "a te" : "al Conte"}.` : "Assegnate: nessuna.");
    return lines;
  }
  function detail(x) {
    const side = (k) => {
      const cards = x[k].cards.map((c) => {
        const mods = c.mods.map((m) => `${signed(m.v)} ${esc(named(m.why) === "Campi" ? x.field.name : named(m.why))}`);
        return `<li>${esc(B.BEASTS[c.id].name)} <b>${c.power}</b> <small>${c.base} stampata${mods.length ? ", " + mods.join(", ") : ""}</small></li>`;
      });
      return `<div><p class="label">${WHO[k]} · totale ${x[k].total}</p><ul>${cards.join("") || "<li><small>nessuna carta</small></li>"}</ul></div>`;
    };
    return `<p><b>${esc(x.field.name)}.</b> ${esc(x.field.text)}</p>
      <div class="qd-sides">${side("me")}${side("foe")}</div>
      <p><b>Perché.</b> ${esc(reason(x))}</p>
      <ul class="qd-crowns">${crownLines(x).map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`;
  }
  function summary(e) {
    const rows = e.quarters.map((x) => {
      const won = x.lead ? x.crowns + x.bonus[x.lead] : 0;
      return `<tr><th scope="row"><button type="button" class="q-btn" aria-expanded="false" aria-controls="qd-${x.q}">${B.ROMAN[x.q]} <small>${esc(x.field.name)}</small></button></th><td>${x.me.total}</td><td>${x.foe.total}</td>
        <td>${x.lead ? WHO[x.lead] : "Nessuno"}</td><td>${won || "—"}</td></tr>
        <tr class="q-detail" id="qd-${x.q}" hidden><td colspan="5">${detail(x)}</td></tr>`;
    });
    const weights = B.SIDES.map((side) => {
      const sum = {};
      e.quarters.forEach((x) => x[side].cards.forEach((c) => c.mods.forEach((m) => (sum[named(m.why)] = (sum[named(m.why)] || 0) + m.v))));
      const top = Object.entries(sum).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
      return `<li><b>${WHO[side]}</b> ${top.length ? top.map(([k, v]) => `${esc(k)} ${signed(v)}`).join(" · ") : "nessun effetto"}</li>`;
    });
    return `<p class="small">Tocca un quarto per vedere carte, totali e corone.</p><table class="end-table"><thead><tr><th scope="col">Quarto</th><th scope="col">Tu</th><th scope="col">Conte</th><th scope="col">Va a</th><th scope="col">Corone</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table>
      <p class="label">Gli effetti che hanno pesato</p><ul class="end-weights">${weights.join("")}</ul>`;
  }
  // the last move stays on the board for a moment, then the summary fades in;
  // it takes focus only once it is there
  function scheduleEnd() {
    clearTimeout(endTimer);
    $("handHint").textContent = `${s.trial !== undefined ? "Prova conclusa" : "Torneo concluso"}: il riepilogo si apre tra poco`;
    endTimer = setTimeout(showEnd, 1800);
  }
  function showEnd() {
    const e = B.evaluate(s);
    const w = s.over;
    $("endTitle").textContent = w === "me" ? "Vittoria" : w === "foe" ? "Sconfitta" : "Pareggio";
    $("endText").textContent =
      w === "pari"
        ? `Corone ${e.score.me} a ${e.score.foe} e forza pari: il Conte ti stringe la mano.`
        : `Corone ${e.score.me} a ${e.score.foe}. ${w === "me" ? "Il tuo blasone entra nell'archivio." : "Il Conte di Sable si tiene lo scudo, per ora."}`;
    $("endSum").innerHTML = summary(e);
    const t = s.trial !== undefined && B.TRIALS[s.trial];
    $("againBtn").textContent = t ? "Riprova" : "Nuova partita";
    $("endLabel").textContent = t ? `Esito della prova · ${t.name}` : "Esito del torneo · Plate 06";
    $("endNext").hidden = !t || s.trial + 1 >= B.TRIALS.length;
    if (t) {
      if (s.goal) markSolved(s.trial);
      $("endTitle").textContent = s.goal ? "Prova superata" : "Prova non superata";
      $("endText").textContent = `${t.goalText} ${s.goal ? "Obiettivo raggiunto" : "Obiettivo mancato"}: corone ${e.score.me} a ${e.score.foe}.`;
      $("endSum").innerHTML = `<div class="trial-why"><p class="label">Le mosse decisive</p><p>${esc(t.why)}</p></div>` + $("endSum").innerHTML;
    }
    $("endSeal").innerHTML = `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="${w === "me" ? "#c88a3b" : "#0f0f10"}"/><circle cx="60" cy="60" r="48" fill="none" stroke="${w === "me" ? "#0f0f10" : "#c88a3b"}" stroke-width="1.5"/><circle cx="60" cy="60" r="44" fill="none" stroke="${w === "me" ? "#0f0f10" : "#c88a3b"}" stroke-dasharray="2 4"/><text x="60" y="78" text-anchor="middle" font-family="Playfair Display, serif" font-weight="900" font-style="italic" font-size="52" fill="${w === "me" ? "#0f0f10" : "#d29a4a"}">${w === "me" ? "V" : w === "foe" ? "C" : "P"}</text></svg>`;
    $("endCode").textContent = gameCode();
    if (preview) return (endTimer = setTimeout(newGame, 800));
    const v = $("end");
    let done = false;
    const ready = () => {
      if (done || v.hidden) return;
      done = true;
      v.inert = false;
      $("againBtn").focus();
    };
    desk.inert = true;
    v.hidden = false;
    if (reduced()) return ready();
    v.inert = true;
    v.classList.add("entering");
    void v.offsetWidth; // start the transition from the hidden state
    v.classList.remove("entering");
    v.addEventListener("transitionend", ready, { once: true });
    setTimeout(ready, 700);
  }
  function closeEnd() {
    hideVeil($("end"));
    $("endBtn").focus();
  }

  // ---------- input ----------
  function cancelPick() {
    const i = picked;
    picked = null;
    renderHand();
    renderBoard();
    const back = $("hand").querySelector(`[data-i="${i}"]`);
    if (back) back.focus();
  }
  $("hand").addEventListener("click", (e) => {
    const b = e.target.closest(".card");
    if (!b || s.over) return;
    const i = +b.dataset.i;
    picked = picked === i ? null : i;
    renderHand();
    renderBoard();
    if (picked === null) return;
    // from the keyboard, go straight to the first quarter you can play
    if (e.detail === 0) $("board").querySelector(".row.me.open .slot")?.focus();
    else if (innerWidth < 720) $("board").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("board").addEventListener("click", (e) => {
    // with a card chosen, your whole half of an open quarter is the target
    const row = e.target.closest(".row.me.open");
    if (row && picked !== null && !s.over) {
      const i = picked, q = +row.dataset.q;
      picked = null;
      B.play(s, i, q, B.choose(s, "foe", CONTE[conte].noise), edictArmed);
      edictArmed = false;
      render();
      if (s.over) return scheduleEnd();
      if (e.detail === 0) $("board").querySelector(`.row.me[data-q="${q}"] .mini:last-of-type`)?.focus();
      return;
    }
    const m = e.target.closest(".mini");
    if (m) peek(+m.dataset.q, m.dataset.side, +m.dataset.k, m);
  });
  $("cancelBtn").onclick = cancelPick;
  $("edictBtn").onclick = () => {
    edictArmed = !edictArmed;
    renderHand();
  };
  // a trial is tried again; otherwise a new game with the menu's options
  $("againBtn").onclick = () => newGame(s.trial !== undefined ? { trial: s.trial } : undefined);
  $("endNext").onclick = () => newGame({ trial: s.trial + 1 });
  $("endClose").onclick = closeEnd;
  $("endBtn").onclick = showEnd;
  $("endReport").onclick = () => {
    hideVeil($("end"));
    openMenu("tab-riscontro");
  };
  $("endSum").addEventListener("click", (e) => {
    const b = e.target.closest(".q-btn");
    if (!b) return;
    const open = b.getAttribute("aria-expanded") !== "true";
    b.setAttribute("aria-expanded", open);
    $(b.getAttribute("aria-controls")).hidden = !open;
  });

  // ---------- menu ----------
  const menu = $("menu");
  const tabs = [...menu.querySelectorAll('[role="tab"]')];
  function showTab(tab) {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
    if (tab.id === "tab-bestiario") renderBestiary();
    if (tab.id === "tab-riscontro") renderReport();
    if (tab.id === "tab-prove") renderTrials();
  }
  function renderTrials() {
    $("trialList").innerHTML = B.TRIALS.map(
      (t, n) => `<li><button type="button" class="trial-btn" data-n="${n}"><span class="label">${n + 1} · ${esc(t.level)}${solved.includes(n) ? " · <b>superata</b>" : ""}</span><b>${esc(t.name)}</b><span>${esc(t.goalText)}</span></button></li>`
    ).join("");
  }
  $("trialList").addEventListener("click", (e) => {
    const b = e.target.closest(".trial-btn");
    if (b) leaveThen(() => newGame({ trial: +b.dataset.n }));
  });
  tabs.forEach((t) => (t.onclick = () => showTab(t)));
  menu.querySelector('[role="tablist"]').addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    const t = tabs[(to + tabs.length) % tabs.length];
    t.focus();
    showTab(t);
  });
  function openMenu(tabId) {
    $("confirmNew").hidden = true;
    $("codeMsg").textContent = "";
    $("gameCode").textContent = gameCode();
    if (tabId) showTab($(tabId));
    renderBestiary();
    renderReport();
    renderTrials();
    menu.showModal();
  }
  $("menuBtn").onclick = () => openMenu();
  $("version").textContent = VERSION;
  $("menuClose").onclick = () => menu.close();
  // a click on the backdrop lands on the dialog itself
  menu.addEventListener("click", (e) => e.target === menu && menu.close());

  const choices = (box, name, list, current, set) => {
    $(box).innerHTML = Object.entries(list)
      .map(([id, o]) => `<label class="choice"><input type="radio" name="${name}" value="${id}" ${String(current) === id ? "checked" : ""} /><span><b>${esc(o.name || o)}</b>${o.text ? " " + esc(o.text) : ""}</span></label>`)
      .join("");
    $(box).onchange = (e) => {
      set(e.target.value);
      save();
    };
  };
  choices("formatChoices", "format", B.FORMATS, prefs.format, (v) => (prefs.format = v));
  choices("conteChoices", "conte", CONTE, prefs.conte, (v) => (prefs.conte = v));
  choices("sizeChoices", "size", SIZES, prefs.size, (v) => {
    prefs.size = +v;
    applyView();
  });
  $("edictPref").checked = prefs.editto;
  $("edictPref").onchange = (e) => {
    prefs.editto = e.target.checked;
    save();
  };
  $("colorPref").checked = prefs.colors;
  $("colorPref").onchange = (e) => {
    prefs.colors = e.target.checked;
    save();
    applyView();
  };
  $("motionPref").checked = prefs.motion;
  $("motionPref").onchange = (e) => {
    prefs.motion = e.target.checked;
    save();
    applyView();
  };
  // leaving a game in progress asks first
  let pending = null;
  function leaveThen(fn) {
    if (!playing()) {
      menu.close();
      return fn();
    }
    pending = fn;
    $("confirmNew").hidden = false;
    $("confirmYes").focus();
    $("confirmNew").scrollIntoView({ block: "nearest" });
  }
  $("newBtn").onclick = () => leaveThen(() => newGame());
  $("confirmYes").onclick = () => {
    menu.close();
    if (pending) pending();
    pending = null;
  };
  $("codeForm").onsubmit = (e) => {
    e.preventDefault();
    const g = B.parseCode($("codeInput").value);
    if (!g) {
      $("codeMsg").textContent = "Codice non valido: numeri, un trattino e tre lettere, come 418273-cns, oppure una prova, come prova-2.";
      return $("codeInput").focus();
    }
    leaveThen(() => newGame(g));
  };

  // ---------- copy and download, both local: nothing leaves the device ----------
  async function copy(text, msg, out) {
    try {
      await navigator.clipboard.writeText(text);
      $(msg).textContent = "Copiato negli appunti.";
      if (out) $(out).hidden = true;
    } catch (e) {
      // no clipboard (insecure context, refused): show the text selected
      if (out) {
        $(out).hidden = false;
        $(out).value = text;
        $(out).select();
      }
      $(msg).textContent = out ? "Copia non riuscita: il testo è qui sotto, già selezionato." : `Copia non riuscita. Il codice è ${text}`;
    }
  }
  $("copyCode").onclick = () => copy(gameCode(), "codeMsg");

  // ---------- feedback sheet ----------
  const SCALE = ["1", "2", "3", "4", "5"];
  const LEVEL = { facile: "troppo facile", giusto: "giusto", difficile: "troppo difficile" };
  const radios = (box, name, values) =>
    ($(box).innerHTML = values.map(([v, label]) => `<label class="pick"><input type="radio" name="${name}" value="${v}" /><span>${esc(label)}</span></label>`).join(""));
  radios("rClarity", "clarity", SCALE.map((v) => [v, v]));
  radios("rResult", "result", SCALE.map((v) => [v, v]));
  radios("rLevel", "level", Object.entries(LEVEL));
  // free text goes out as plain text: no control characters, bounded, and a
  // leading = + - @ is defused so a spreadsheet won't read it as a formula
  const clean = (t, max) =>
    String(t)
      .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "")
      .slice(0, max)
      .split("\n")
      .map((l) => (/^[=+\-@]/.test(l) ? "'" + l : l))
      .join("\n")
      .trim();
  const picked1 = (name, list) => {
    const r = $("report").querySelector(`input[name="${name}"]:checked`);
    return r && own(list, r.value) ? r.value : null;
  };
  function edictLine() {
    if (!s.edict) return "regola non attiva";
    const u = s.edict.me;
    return u ? `turno ${NUM[u.turn]}, quarto ${B.ROMAN[u.q]}` : "non usato";
  }
  function draftLine() {
    const d = s.draft;
    return drafting() ? "in corso" : `tu ${names(d.picks.me)}; il Conte ${names(d.picks.foe)}`;
  }
  function outcome() {
    const e = B.evaluate(s);
    if (s.trial !== undefined && s.over) return `${s.goal ? "prova superata" : "prova non superata"}, corone ${e.score.me} a ${e.score.foe}`;
    if (!s.over) return `partita in corso, turno ${NUM[s.turn]}, corone ${e.score.me} a ${e.score.foe}`;
    return `${s.over === "me" ? "vittoria" : s.over === "foe" ? "sconfitta" : "pareggio"}, corone ${e.score.me} a ${e.score.foe}`;
  }
  function renderReport() {
    $("reportAuto").innerHTML =
      `<span class="label">Compilato da solo</span> Codice <code>${esc(gameCode())}</code> · ${esc(formatName())} · Conte ${esc(CONTE[conte].name.toLowerCase())} · ` +
      `Editto: ${esc(edictLine())}${s.draft ? ` · Draft: ${esc(draftLine())}` : ""} · Esito: ${esc(outcome())}`;
  }
  function reportText() {
    const clarity = picked1("clarity", { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
    const result = picked1("result", { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 });
    const level = picked1("level", LEVEL);
    return [
      `Blasone ${VERSION} · scheda di riscontro`,
      `Codice partita: ${gameCode()}`,
      `Formato: ${formatName()} · Editto: ${s.edict ? "attivo" : "non attivo"} · Conte: ${CONTE[conte].name}`,
      ...(s.draft ? [`Draft: ${draftLine()}`] : []),
      `Esito: ${outcome()}`,
      `Editto usato: ${edictLine()}`,
      `Chiarezza delle abilità (1-5): ${clarity || "—"}`,
      `Leggibilità del risultato (1-5): ${result || "—"}`,
      `Difficoltà del Conte: ${level ? LEVEL[level] : "—"}`,
      `Abilità o regole decisive: ${clean($("rDecisive").value, 200) || "—"}`,
      `Note:`,
      clean($("rNotes").value, 1000) || "—",
    ].join("\n");
  }
  $("reportCopy").onclick = () => copy(reportText(), "reportMsg", "reportOut");
  $("reportSave").onclick = () => {
    const url = URL.createObjectURL(new Blob([reportText() + "\n"], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `blasone-${gameCode()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("reportMsg").textContent = "Scheda scaricata.";
  };
  $("confirmNo").onclick = () => menu.close();

  // ---------- bestiary ----------
  let tintOn = null;
  $("tintFilter").innerHTML =
    `<button type="button" class="tint-btn" data-t="" aria-pressed="true">Tutte</button>` +
    Object.entries(B.TINCT).map(([t, o]) => `<button type="button" class="tint-btn" data-t="${t}" aria-pressed="false">${tinct(t)}${o.name}</button>`).join("");
  $("tintFilter").onclick = (e) => {
    const b = e.target.closest(".tint-btn");
    if (!b) return;
    tintOn = b.dataset.t || null;
    $("tintFilter").querySelectorAll(".tint-btn").forEach((x) => x.setAttribute("aria-pressed", x === b));
    renderBestiary();
  };
  $("beastSearch").oninput = renderBestiary;
  $("beastInGame").onchange = renderBestiary;
  function renderBestiary() {
    const q = $("beastSearch").value.trim().toLowerCase();
    const only = $("beastInGame").checked;
    const list = KEYS.filter((id) => {
      const b = B.BEASTS[id];
      return (!tintOn || b.t === tintOn) && (!q || b.name.toLowerCase().includes(q) || b.ab.toLowerCase().includes(q)) && (!only || s.pool.includes(id));
    });
    $("beastCount").textContent = `${list.length} ${list.length === 1 ? "bestia" : "bestie"} su ${KEYS.length}`;
    $("bestiary").innerHTML = list
      .map(
        (id) => `<figure class="beast"><div class="card ${skin(id)}">${face(id)}</div>
        <figcaption class="label"><span class="fig-house">${esc(B.HOUSE[id].name)}${s.pool.includes(id) ? " · " : ""}</span>${s.pool.includes(id) ? `<b>in partita</b>` : ""}</figcaption></figure>`
      )
      .join("");
  }

  // ---------- preview: the AI plays your side too ----------
  if (preview) {
    let last = 0;
    const loop = (t) => {
      if (!s.over && t - last > 1500) {
        last = t;
        const m = B.choose(s, "me", 0.8);
        if (m) {
          B.play(s, m.i, m.q);
          render();
          if (s.over) scheduleEnd();
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  applyView();
  // ?codice= opens a game code (a link to a game); untrusted, so parseCode decides
  newGame((!preview && B.parseCode(params.get("codice") || "")) || undefined);
})();
