// Blasone UI: lays the engine state (game.js) out as printed sheets. The beasts
// are engraved at load: each one's emoji is drawn to a canvas and re-inked as
// woodcut hatching (wavy engraving lines whose weight follows the shading,
// cross-hatching in the darks, a heavy contour). In ?preview two AIs play.
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

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const tinct = (t, cls = "tinct") =>
    `<svg class="${cls}" viewBox="0 0 40 46" aria-hidden="true"><use href="#shield" fill="#f4f3ee"/><use href="#shield" fill="url(#h-${t})"/><use href="#shield" fill="none" stroke="#0f0f10" stroke-width="2"/></svg>`;
  const plateNo = (id) => "Plate " + String(KEYS.indexOf(id) + 1).padStart(2, "0");

  // ---------- state ----------
  let s, picked = null;
  function newGame() {
    s = B.create(+params.get("seed") || (Math.random() * 1e9) | 0);
    picked = null;
    $("end").hidden = true;
    render();
  }

  // ---------- board ----------
  const signed = (v) => `${v > 0 ? "+" : "−"}${Math.abs(v)}`;
  // a laid card: a button that opens its full sheet (see peek)
  function mini(c, q, side, k, fresh) {
    const b = B.BEASTS[c.id], d = c.power - c.base;
    const why = c.mods.map((m) => `${signed(m.v)} ${m.why}`).join(", ");
    return `<button type="button" class="mini ${fresh || ""}" data-q="${q}" data-side="${side}" data-k="${k}" title="${esc(b.name)} · forza ${c.power}${why ? " (" + esc(why) + ")" : ""}" aria-label="${esc(b.name)}, forza ${c.power}. Apri la carta">
      ${tinct(b.t)}<img src="${ART[c.id]}" alt="" />
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
        const extra = B.SIDES.filter((side) => x.bonus[side])
          .map((side) => `<span class="bonus" title="Ostentazione: +1 corona solo se ${side === "me" ? "tu conquisti" : "il Conte conquista"} il quarto">+${crown}${side === "me" ? "Tu" : "C"}</span>`)
          .join("");
        const crowns = crown.repeat(x.crowns) + extra;
        return `<article class="plate" aria-label="Quarto ${B.ROMAN[q]}, ${esc(f.name)}">
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
            ${open ? `<span class="empty">${x.me.cards.length ? "" : "Posa qui"}</span>` : x.me.cards.length ? "" : `<span class="empty">Pieno</span>`}
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
  }

  // ---------- hand ----------
  // the printed face, shared by the hand and the peek sheet
  function face(id) {
    const b = B.BEASTS[id];
    return `<span class="card-top"><b class="pwr">${b.power}</b><span class="label">${plateNo(id)}<br />${B.TINCT[b.t].name}</span></span>
      <span class="art"><img src="${ART[id]}" alt="" />${tinct(b.t)}</span>
      <span><h4>${esc(b.name)}</h4><p class="ab"><i>${esc(b.ab)}.</i> ${esc(b.text)}</p></span>`;
  }
  function card(c, i) {
    const b = B.BEASTS[c.id];
    return `<button class="card" role="option" data-i="${i}" aria-selected="${picked === i}" aria-label="${esc(b.name)}, forza ${b.power}, ${B.TINCT[b.t].name}. ${esc(b.ab)}: ${esc(b.text)}">${face(c.id)}</button>`;
  }
  function renderHand() {
    const hand = $("hand");
    hand.innerHTML = s.hands.me.map(card).join("");
    hand.classList.toggle("locked", !!s.over);
    $("deckInfo").textContent = `Mazzo: ${s.decks.me.length}`;
    $("handHint").textContent = s.over ? "Torneo concluso" : picked === null ? "Scegli una carta, poi un quarto" : `${B.BEASTS[s.hands.me[picked].id].name}: ora scegli un quarto`;
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
  addEventListener("keydown", (e) => e.key === "Escape" && !$("peek").hidden && closePeek());

  // ---------- end ----------
  function showEnd() {
    const e = B.evaluate(s);
    const w = s.over;
    $("endTitle").textContent = w === "me" ? "Vittoria" : w === "foe" ? "Sconfitta" : "Pareggio";
    $("endText").textContent =
      w === "pari"
        ? `Corone ${e.score.me} a ${e.score.foe} e forza pari: il Conte ti stringe la mano.`
        : `Corone ${e.score.me} a ${e.score.foe}. ${w === "me" ? "Il tuo blasone entra nell'archivio." : "Il Conte di Sable si tiene lo scudo, per ora."}`;
    $("endSeal").innerHTML = `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="${w === "me" ? "#c88a3b" : "#0f0f10"}"/><circle cx="60" cy="60" r="48" fill="none" stroke="${w === "me" ? "#0f0f10" : "#c88a3b"}" stroke-width="1.5"/><circle cx="60" cy="60" r="44" fill="none" stroke="${w === "me" ? "#0f0f10" : "#c88a3b"}" stroke-dasharray="2 4"/><text x="60" y="78" text-anchor="middle" font-family="Playfair Display, serif" font-weight="900" font-style="italic" font-size="52" fill="${w === "me" ? "#0f0f10" : "#d29a4a"}">${w === "me" ? "V" : w === "foe" ? "C" : "P"}</text></svg>`;
    if (preview) return setTimeout(newGame, 2600);
    $("end").hidden = false;
    $("againBtn").focus();
  }

  // ---------- input ----------
  $("hand").addEventListener("click", (e) => {
    const b = e.target.closest(".card");
    if (!b || s.over) return;
    const i = +b.dataset.i;
    picked = picked === i ? null : i;
    renderHand();
    renderBoard();
    if (picked !== null && innerWidth < 720) $("board").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  $("board").addEventListener("click", (e) => {
    // with a card chosen, your whole half of an open quarter is the target
    const row = e.target.closest(".row.me.open");
    if (row && picked !== null && !s.over) {
      const i = picked;
      picked = null;
      B.play(s, i, +row.dataset.q);
      return render();
    }
    const m = e.target.closest(".mini");
    if (m) peek(+m.dataset.q, m.dataset.side, +m.dataset.k, m);
  });
  $("newBtn").onclick = newGame;
  $("againBtn").onclick = newGame;
  $("rulesBtn").onclick = () => {
    const r = $("rules");
    r.hidden = !r.hidden;
    $("rulesBtn").setAttribute("aria-expanded", !r.hidden);
  };

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

  newGame();
})();
