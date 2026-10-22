// Blasone UI: lays the engine state (game.js) out as printed sheets. The beasts
// are engraved at load: each one's emoji is drawn to a canvas and re-inked as
// woodcut hatching (wavy engraving lines whose weight follows the shading,
// cross-hatching in the darks, a heavy contour). In ?preview two AIs play.
// The menu (a native <dialog>) holds the game options, the rules, the
// bestiary and the display settings; the choices are kept in localStorage.
(() => {
  const B = window.Blasone;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const NUM = ["", "I", "II", "III", "IV", "V", "VI"];
  const KEYS = Object.keys(B.BEASTS);

  // ---------- woodcut engraving ----------
  const ART = {};
  function engrave(glyph, S = 256) {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const x = c.getContext("2d", { willReadFrequently: true });
    x.font = `${Math.round(S * 0.8)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`;
    x.textAlign = "center";
    x.textBaseline = "middle";
    x.fillText(glyph, S / 2, S * 0.54);
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
  try {
    Object.assign(prefs, JSON.parse(localStorage.getItem("blasone.prefs")) || {});
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
  let s, picked = null, edictArmed = false;
  function newGame() {
    const seed = +params.get("seed") || (Math.random() * 1e9) | 0;
    s = B.create(seed, preview ? {} : { format: prefs.format, editto: prefs.editto });
    picked = null;
    edictArmed = false;
    $("end").hidden = true;
    $("reveal").hidden = true;
    render();
  }
  const playing = () => s.log.length > 0 && !s.over;

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
        const open = B.legal(s, "me", q);
        const fresh = (c, side) => (s.last && s.last[side] === c.uid ? "fresh-" + side : "");
        const crown = `<svg aria-hidden="true"><use href="#crown"/></svg>`;
        const extra = B.SIDES.flatMap((side) =>
          x.extra[side].map(
            (why) => `<span class="bonus" title="${why}: +1 corona solo se ${side === "me" ? "tu conquisti" : "il Conte conquista"} il quarto">+${crown}<span>${side === "me" ? "Tu" : "C"} · ${why}</span></span>`
          )
        ).join("");
        const crowns = crown.repeat(x.crowns) + extra;
        return `<article class="plate ${open || s.over ? "" : "shut"}" aria-label="Quarto ${B.ROMAN[q]}, ${esc(f.name)}">
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
            ${open ? `<span class="empty">${x.me.cards.length ? "" : "Posa qui"}</span>` : s.over ? "" : `<span class="empty">Pieno</span>`}
          </button></div>
        </article>`;
      })
      .join("");
    const board = $("board");
    board.innerHTML = html + `<i class="fold" aria-hidden="true"></i>`;
    board.classList.toggle("picking", picked !== null);
    $("scoreMe").textContent = e.score.me;
    $("scoreFoe").textContent = e.score.foe;
    $("turn").textContent = s.over ? "Torneo concluso" : `Turno ${NUM[s.turn]} di ${NUM[B.TURNS]}`;
    $("reveal").textContent = s.log.length ? `Mosse rivelate · Turno ${NUM[s.log[0].turn]} — Tu: ${s.log[0].me} · Il Conte: ${s.log[0].foe}` : "";
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
    $("deckInfo").textContent = `Mazzo: ${s.decks.me.length} · ${B.FORMATS[s.format].name}`;
    $("handHint").textContent = s.over
      ? "Torneo concluso"
      : picked === null
      ? "Scegli una carta, poi un quarto"
      : `${B.BEASTS[s.hands.me[picked].id].name}: ora scegli un quarto${edictArmed ? ", con l'Editto" : ""}`;
    $("cancelBtn").hidden = picked === null;
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
    const n = s.hands.foe.length;
    $("foeInfo").textContent = `${n} ${n === 1 ? "carta" : "carte"} in mano · ${s.decks.foe.length} nel mazzo`;
    $("foeHand").innerHTML = Array.from({ length: n }, () => `<span class="back"></span>`).join("");
    $("log").innerHTML = s.log.length
      ? s.log.map((l) => `<li><b>Turno ${NUM[l.turn]}</b>Tu: ${esc(l.me)}.<br />Il Conte: ${esc(l.foe)}.</li>`).join("")
      : `<li class="empty">Il torneo sta per cominciare. Le prime carte si scoprono insieme.</li>`;
  }

  function render() {
    renderBoard();
    renderHand();
    renderSide();
    if (s.over) showEnd();
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
      (c.mods.reduce((t, m) => t + m.v, c.base) < 0 ? `<li><span>La forza non scende sotto zero</span><b></b></li>` : "");
    peekFrom = from;
    $("peek").hidden = false;
    $("peekClose").focus();
  }
  function closePeek() {
    $("peek").hidden = true;
    if (peekFrom && peekFrom.isConnected) peekFrom.focus();
    peekFrom = null;
  }
  $("peekClose").onclick = closePeek;
  $("peek").addEventListener("click", (e) => e.target === $("peek") && closePeek());
  addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("peek").hidden) closePeek();
    else if (picked !== null && !$("menu").open) cancelPick();
  });

  // ---------- end ----------
  // which quarters went where and for how many crowns, then the effects that
  // weighed most on each side
  const WHO = { me: "Tu", foe: "Il Conte" };
  const named = (why) => (why === "campo" ? "Campi" : why === "tinture" ? "Tinture" : why);
  function summary(e) {
    const rows = e.quarters.map((x) => {
      const base = x.field.id === "argento" ? 2 : 1, towers = x.crowns - base;
      const parts = [`${base} base`];
      if (towers) parts.push(`${towers} Torr${towers > 1 ? "i" : "e"}`);
      if (x.lead) x.extra[x.lead].forEach((why) => parts.push(`1 ${why}`));
      const won = x.lead ? x.crowns + x.bonus[x.lead] : 0;
      return `<tr><th scope="row">${B.ROMAN[x.q]} <small>${esc(x.field.name)}</small></th><td>${x.me.total}</td><td>${x.foe.total}</td>
        <td>${x.lead ? WHO[x.lead] : "Nessuno"}</td><td>${won ? `${won} <small>(${parts.join(" + ")})</small>` : "—"}</td></tr>`;
    });
    const weights = B.SIDES.map((side) => {
      const sum = {};
      e.quarters.forEach((x) => x[side].cards.forEach((c) => c.mods.forEach((m) => (sum[named(m.why)] = (sum[named(m.why)] || 0) + m.v))));
      const top = Object.entries(sum).filter(([, v]) => v).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 3);
      return `<li><b>${WHO[side]}</b> ${top.length ? top.map(([k, v]) => `${esc(k)} ${signed(v)}`).join(" · ") : "nessun effetto"}</li>`;
    });
    return `<table class="end-table"><thead><tr><th scope="col">Quarto</th><th scope="col">Tu</th><th scope="col">Conte</th><th scope="col">Va a</th><th scope="col">Corone</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table>
      <p class="label">Gli effetti che hanno pesato</p><ul class="end-weights">${weights.join("")}</ul>`;
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
    $("endSeal").innerHTML = `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="${w === "me" ? "#c88a3b" : "#0f0f10"}"/><circle cx="60" cy="60" r="48" fill="none" stroke="${w === "me" ? "#0f0f10" : "#c88a3b"}" stroke-width="1.5"/><circle cx="60" cy="60" r="44" fill="none" stroke="${w === "me" ? "#0f0f10" : "#c88a3b"}" stroke-dasharray="2 4"/><text x="60" y="78" text-anchor="middle" font-family="Playfair Display, serif" font-weight="900" font-style="italic" font-size="52" fill="${w === "me" ? "#0f0f10" : "#d29a4a"}">${w === "me" ? "V" : w === "foe" ? "C" : "P"}</text></svg>`;
    if (preview) return setTimeout(newGame, 2600);
    $("end").hidden = false;
    $("againBtn").focus();
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
      B.play(s, i, q, B.choose(s, "foe", (CONTE[prefs.conte] || CONTE.standard).noise), edictArmed);
      edictArmed = false;
      $("reveal").hidden = false;
      render();
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
  $("againBtn").onclick = newGame;
  $("endClose").onclick = () => {
    $("end").hidden = true;
    $("menuBtn").focus();
  };

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
  }
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
  $("menuBtn").onclick = () => {
    $("confirmNew").hidden = true;
    renderBestiary();
    menu.showModal();
  };
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
  $("newBtn").onclick = () => {
    if (playing()) {
      $("confirmNew").hidden = false;
      return $("confirmYes").focus();
    }
    menu.close();
    newGame();
  };
  $("confirmYes").onclick = () => {
    menu.close();
    newGame();
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
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  applyView();
  newGame();
})();
