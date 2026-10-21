// Ardesia UI: draws the engine state (game.js) as a board of 64 buttons, and
// handles click-to-move, pointer drag and drop, the keyboard, promotion, clocks,
// undo/redo, flipping and PGN/FEN export. The AI searches in a worker (ai.js).
// ?fen=... starts from a position, ?seed=N fixes the AI's choices, and in
// ?preview two AIs play each other forever.
(() => {
  const { Chess, START, bestMove, rng } = window.Ardesia;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const rand = rng(+params.get("seed") || (Math.random() * 2 ** 31) | 0);

  const FILES = "abcdefgh";
  const NAMES = { p: "pedone", n: "cavallo", b: "alfiere", r: "torre", q: "donna", k: "re" };
  const COLOR = { w: "Bianco", b: "Nero" };
  const POINTS = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const LEVELS = { 1: "Principiante", 2: "Club", 3: "Maestro" };
  const CLOCKS = { "1+0": [60, 0], "3+2": [180, 2], "5+3": [300, 3], "10+0": [600, 0] };
  const REASONS = {
    stalemate: "Patta per stallo",
    insufficient: "Patta: materiale insufficiente",
    fifty: "Patta: regola delle 50 mosse",
    threefold: "Patta per triplice ripetizione",
  };

  // ---------- pieces: geometric silhouettes on a 100-unit grid ----------
  const PLINTH = '<path class="b" d="M25 89h50a4 4 0 0 0 4-4v-2a4 4 0 0 0-4-4H25a4 4 0 0 0-4 4v2a4 4 0 0 0 4 4z"/>';
  const SHAPES = {
    p: '<path class="b" d="M42 46h16l-2 6c6 6 9 15 10 27H34c1-12 4-21 10-27z"/><rect class="b" x="37" y="42" width="26" height="7" rx="3.5"/><circle class="b" cx="50" cy="29" r="12"/>',
    r: '<path class="b" d="M35 79l2-36h26l2 36z"/><path class="b" d="M29 17h9v7h6v-7h12v7h6v-7h9v18l-6 8H35l-6-8z"/><path class="d" d="M38 55h24"/>',
    n: '<path class="b" d="M34 79c0-13 6-22 13-29-6 1-11 4-15 7l-7-6c4-12 14-22 28-28l2-9 7 9c11 4 17 17 17 31 0 9-2 17-3 25z"/><path class="d" d="M67 29c5 9 6 21 4 34"/><circle class="d dot" cx="51" cy="33" r="3"/>',
    b: '<path class="b" d="M38 79c2-10 4-17 7-22h10c3 5 5 12 7 22z"/><rect class="b" x="35" y="51" width="30" height="7" rx="3.5"/><path class="b" d="M50 17c10 8 16 18 16 26 0 6-6 9-16 9s-16-3-16-9c0-8 6-18 16-26z"/><circle class="b" cx="50" cy="13" r="5"/><path class="d" d="M54 28l-8 10"/>',
    q: '<path class="b" d="M36 79c2-11 5-20 8-28h12c3 8 6 17 8 28z"/><path class="b" d="M26 25l9 21h30l9-21-12 8-6-14-6 13-6-13-6 14z"/><rect class="b" x="33" y="44" width="34" height="8" rx="4"/><circle class="b" cx="26" cy="23" r="4.5"/><circle class="b" cx="44" cy="16" r="4.5"/><circle class="b" cx="56" cy="16" r="4.5"/><circle class="b" cx="74" cy="23" r="4.5"/>',
    k: '<path class="b" d="M36 79c2-11 5-20 8-28h12c3 8 6 17 8 28z"/><path class="b" d="M34 45c-5-9-3-19 6-19 5 0 8 3 10 8 2-5 5-8 10-8 9 0 11 10 6 19z"/><rect class="b" x="33" y="43" width="34" height="8" rx="4"/><path class="b" d="M47 27v-8h-6v-6h6V7h6v6h6v6h-6v8z"/>',
  };
  const piece = (type, color) =>
    `<svg class="pc pc-${color}" viewBox="6 4 88 88" aria-hidden="true">${SHAPES[type]}${PLINTH}</svg>`;

  // ---------- state ----------
  let opts = { mode: preview ? "auto" : "ai", human: "w", level: 2, clock: "0", fen: params.get("fen") || "" };
  let game, legal = [], redo = [], selected = null, flipped = false, focusIdx = 52;
  let thinking = false, token = 0, flagged = null, aiTimer = 0, previewTimer = 0;
  let pending = null; // when the AI's current search started, and its minimum think time
  let clock = null; // { ms: {w, b}, inc, since, after: [] snapshots after each ply, start }
  let tickTimer = 0;

  const board = $("board");
  const squares = [];
  for (let i = 0; i < 64; i++) {
    const r = i >> 3, f = i & 7;
    const el = document.createElement("button");
    el.type = "button";
    el.className = "sq " + ((r + f) % 2 ? "dark" : "light");
    el.dataset.sq = FILES[f] + (8 - r);
    el.tabIndex = -1;
    el.innerHTML = '<span class="slot"></span>';
    board.append(el);
    squares.push(el);
  }
  const sqEl = (name) => squares[(8 - +name[1]) * 8 + FILES.indexOf(name[0])];
  // visual cell (0 top-left .. 63 bottom-right) of a square index, given the orientation
  const cellOf = (i) => (flipped ? 63 - i : i);

  // ---------- worker ----------
  let worker = null;
  try {
    worker = new Worker("ai.js");
    worker.onmessage = (e) => aiReply(e.data.id, e.data.move);
    worker.onerror = () => { worker = null; };
  } catch (e) {
    worker = null;
  }

  // ---------- game flow ----------
  function newGame(o) {
    opts = { ...opts, ...o };
    token++;
    clearTimeout(aiTimer);
    clearTimeout(previewTimer);
    thinking = false;
    try {
      game = new Chess(opts.fen || START);
    } catch (e) {
      game = new Chess(START);
    }
    redo = [];
    selected = null;
    flagged = null;
    const tc = CLOCKS[opts.clock];
    clock = tc ? { ms: { w: tc[0] * 1000, b: tc[0] * 1000 }, inc: tc[1] * 1000, since: 0, after: [] } : null;
    if (clock) clock.start = { ...clock.ms };
    flipped = opts.mode === "ai" && opts.human === "b";
    $("result").hidden = true;
    layout();
    refresh();
    maybeAI();
  }

  const isAI = (color) => opts.mode === "auto" || (opts.mode === "ai" && color !== opts.human);
  const status = () => {
    if (flagged) return { over: true, reason: "time" };
    return game.status();
  };
  const canHumanMove = () => !thinking && !status().over && !isAI(game.turn());

  function commit(m, { animate = true } = {}) {
    const mover = game.turn();
    const done = game.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!done) return;
    redo = [];
    if (clock) {
      if (game.played.length > 1) clock.ms[mover] -= performance.now() - clock.since;
      clock.ms[mover] += clock.inc;
      clock.since = performance.now();
      clock.after.push({ ...clock.ms });
    }
    selected = null;
    refresh(animate ? done : null);
    announce(done);
    maybeAI();
  }

  function maybeAI() {
    const st = status();
    if (st.over) {
      if (opts.mode === "auto") previewTimer = setTimeout(() => newGame({}), 3200);
      return;
    }
    if (opts.mode === "auto" && game.played.length >= 140) {
      previewTimer = setTimeout(() => newGame({}), 1500);
      return;
    }
    if (!isAI(game.turn())) return;
    const id = ++token;
    thinking = true;
    updateStatus();
    const msg = { id, fen: game.fen(), level: opts.mode === "auto" ? 2 : opts.level, seed: (rand() * 2 ** 31) | 0 };
    // a short pause even for instant replies, so the AI's move reads as a reply
    pending = { startedAt: performance.now(), minDelay: opts.mode === "auto" ? 650 : 380 };
    if (worker) worker.postMessage(msg);
    else aiTimer = setTimeout(() => aiReply(id, bestMove(new Chess(msg.fen), msg.level, rng(msg.seed))), 0);
  }

  function aiReply(id, move) {
    if (id !== token || !move) return;
    const wait = Math.max(0, pending.minDelay - (performance.now() - pending.startedAt));
    aiTimer = setTimeout(() => {
      if (id !== token) return;
      thinking = false;
      commit(move);
    }, wait);
  }

  function undo() {
    if (!game.played.length) return;
    cancelAI();
    // against the AI, step back to the last position where it was your move
    let n = 1;
    if (opts.mode === "ai" && game.turn() === opts.human && game.played.length >= 2) n = 2;
    for (let i = 0; i < n; i++) {
      const m = game.undo();
      redo.push({ move: { from: m.from, to: m.to, promotion: m.promotion }, clock: clock && clock.after.pop() });
    }
    restoreClock();
    flagged = null;
    selected = null;
    $("result").hidden = true;
    refresh();
    maybeAI();
  }

  function redoMove() {
    if (!redo.length) return;
    cancelAI();
    const n = opts.mode === "ai" && redo.length >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const r = redo.pop();
      game.move(r.move);
      if (clock) clock.after.push(r.clock);
    }
    restoreClock();
    selected = null;
    refresh(game.played[game.played.length - 1]);
    maybeAI();
  }

  function cancelAI() {
    token++;
    clearTimeout(aiTimer);
    thinking = false;
  }

  function restoreClock() {
    if (!clock) return;
    clock.ms = { ...(clock.after[clock.after.length - 1] || clock.start) };
    clock.since = performance.now();
  }

  // ---------- clock ----------
  function remaining(color) {
    if (!clock) return 0;
    const running = !status().over && game.played.length > 0 && game.turn() === color;
    return clock.ms[color] - (running ? performance.now() - clock.since : 0);
  }

  function tick() {
    if (!clock || status().over) return;
    const c = game.turn();
    if (game.played.length > 0 && remaining(c) <= 0) {
      clock.ms[c] = 0;
      flagged = c;
      cancelAI();
      refresh();
      announceText(`Tempo scaduto per il ${COLOR[c]}`);
      return;
    }
    drawClocks();
  }

  const fmt = (ms) => {
    const s = Math.max(0, ms) / 1000;
    if (s < 10) return `0:0${s.toFixed(1)}`;
    const m = Math.floor(s / 60);
    return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  function drawClocks() {
    for (const el of document.querySelectorAll(".clock")) {
      const ms = remaining(el.dataset.c);
      el.textContent = fmt(ms);
      el.classList.toggle("low", ms < 20000);
    }
  }

  // ---------- rendering ----------
  function layout() {
    squares.forEach((el, i) => {
      el.style.order = cellOf(i);
      const cell = cellOf(i), name = el.dataset.sq;
      let coords = "";
      if (cell % 8 === 0) coords += `<i class="coord rank">${name[1]}</i>`;
      if (cell >= 56) coords += `<i class="coord file">${name[0]}</i>`;
      el.querySelectorAll(".coord").forEach((c) => c.remove());
      el.insertAdjacentHTML("beforeend", coords);
    });
    setFocus(focusIdx, false);
  }

  function refresh(animated) {
    legal = status().over ? [] : game.moves();
    drawBoard(animated);
    drawPlayers();
    drawMoves();
    updateStatus();
    $("undoBtn").disabled = !game.played.length;
    $("redoBtn").disabled = !redo.length;
    $("fenLine").textContent = game.fen();
    const st = status();
    if (st.over) showResult(st);
    clearInterval(tickTimer);
    if (clock && !st.over) tickTimer = setInterval(tick, 100);
    if (clock) drawClocks();
  }

  function drawBoard(animated) {
    const last = game.played[game.played.length - 1];
    const targets = selected ? legal.filter((m) => m.from === selected) : [];
    const checkSq = game.inCheck() ? game.kingSquare(game.turn()) : null;
    squares.forEach((el) => {
      const name = el.dataset.sq, p = game.get(name);
      const key = p ? p.color + p.type : "";
      if (el.dataset.p !== key) {
        el.firstChild.innerHTML = p ? piece(p.type, p.color) : "";
        el.dataset.p = key;
      }
      const target = targets.find((m) => m.to === name);
      el.classList.toggle("last", !!last && (last.from === name || last.to === name));
      el.classList.toggle("sel", selected === name);
      el.classList.toggle("target", !!target);
      el.classList.toggle("cap", !!target && !!target.captured);
      el.classList.toggle("check", checkSq === name);
      el.setAttribute("aria-pressed", selected === name ? "true" : "false");
      el.setAttribute("aria-label", `${name}, ${p ? `${NAMES[p.type]} ${p.color === "w" ? "bianco" : "nero"}` : "vuota"}` +
        (checkSq === name ? ", sotto scacco" : "") + (target ? (target.captured ? ", presa possibile" : ", mossa possibile") : ""));
    });
    if (animated && !reduceMotion.matches) {
      slide(animated.from, animated.to);
      if (animated.castle) {
        const rank = animated.to[1];
        if (animated.castle === "k") slide("h" + rank, "f" + rank);
        else slide("a" + rank, "d" + rank);
      }
    }
  }

  function slide(from, to) {
    const a = sqEl(from), b = sqEl(to);
    const pc = b.querySelector(".pc");
    if (!pc) return;
    const ca = +a.style.order, cb = +b.style.order;
    const dx = (ca % 8) - (cb % 8), dy = (ca >> 3) - (cb >> 3);
    b.classList.add("moving");
    pc.animate([{ transform: `translate(${dx * 111}%, ${dy * 111}%)` }, { transform: "none" }], {
      duration: 200,
      easing: "cubic-bezier(.2,.75,.25,1)",
    }).onfinish = () => b.classList.remove("moving");
  }

  function drawPlayers() {
    const top = flipped ? "w" : "b", bottom = flipped ? "b" : "w";
    const caps = { w: [], b: [] };
    for (const m of game.played) if (m.captured) caps[m.color].push(m.captured);
    let material = 0;
    for (const el of squares) {
      const p = game.get(el.dataset.sq);
      if (p) material += (p.color === "w" ? 1 : -1) * POINTS[p.type];
    }
    const name = (c) =>
      opts.mode === "auto" ? `IA · ${COLOR[c]}` :
      opts.mode === "ai" ? (c === opts.human ? `Tu · ${COLOR[c]}` : `IA ${LEVELS[opts.level]} · ${COLOR[c]}`) : COLOR[c];
    const st = status();
    for (const [id, c] of [["barTop", top], ["barBottom", bottom]]) {
      const list = caps[c].sort((x, y) => POINTS[y] - POINTS[x] || (x < y ? -1 : 1));
      const them = c === "w" ? "b" : "w";
      const lead = c === "w" ? material : -material;
      const pieces = list.map((t, i) => piece(t, them).replace('class="pc', `class="pc${i && t !== list[i - 1] ? " gap" : ""}`)).join("");
      const el = $(id);
      el.classList.toggle("turn", !st.over && game.turn() === c);
      el.innerHTML =
        `<span class="pl-dot ${c}" aria-hidden="true"></span><span class="pl-name">${name(c)}</span>` +
        `<span class="caps" aria-label="Pezzi catturati: ${list.length ? list.map((t) => NAMES[t]).join(", ") : "nessuno"}">${pieces}</span>` +
        (lead > 0 ? `<span class="diff" aria-label="vantaggio di ${lead}">+${lead}</span>` : "") +
        (clock ? `<span class="clock" data-c="${c}" role="timer" aria-label="Orologio del ${COLOR[c]}"></span>` : "");
    }
  }

  function drawMoves() {
    const list = $("moves");
    const start = game.startFen.split(" ");
    let n = +start[5], t = start[1], row = null;
    const rows = [];
    game.played.forEach((m, i) => {
      if (t === "w" || i === 0) {
        row = { n, w: t === "w" ? m.san : "…", b: t === "w" ? "" : m.san, wi: t === "w" ? i : -1, bi: t === "w" ? -1 : i };
        rows.push(row);
      } else {
        row.b = m.san;
        row.bi = i;
      }
      if (t === "b") n++;
      t = t === "w" ? "b" : "w";
    });
    const cur = game.played.length - 1;
    list.innerHTML = rows.length
      ? rows.map((r) =>
          `<li><span class="n">${r.n}.</span><span class="m${r.wi === cur ? " cur" : ""}">${r.w}</span><span class="m${r.bi === cur && r.bi >= 0 ? " cur" : ""}">${r.b}</span></li>`).join("")
      : '<li class="empty">Nessuna mossa. Il Bianco apre la partita.</li>';
    list.scrollTop = list.scrollHeight;
    $("modeLabel").textContent =
      opts.mode === "auto" ? "IA contro IA" :
      opts.mode === "ai" ? `Contro l'IA · ${LEVELS[opts.level]}` : "Due giocatori";
    if (clock) $("modeLabel").textContent += ` · ${opts.clock}`;
  }

  function updateStatus() {
    const el = $("status"), st = status();
    let text, cls = "";
    if (st.over) {
      text = resultText(st).title;
      cls = "over";
    } else if (thinking && opts.mode !== "auto") text = "L'IA sta pensando…";
    else {
      text = `Tocca al ${COLOR[game.turn()]}`;
      if (st.check) { text += " · Scacco!"; cls = "alert"; }
    }
    el.textContent = text;
    el.className = "status " + cls;
  }

  function resultText(st) {
    if (st.reason === "checkmate") return { kicker: "Scacco matto", title: `Vince il ${COLOR[game.turn() === "w" ? "b" : "w"]}` };
    if (st.reason === "time") {
      const winner = flagged === "w" ? "b" : "w";
      // a flag only loses if the other side could still mate
      const canMate = squares.some((el) => { const p = game.get(el.dataset.sq); return p && p.color === winner && p.type !== "k"; });
      return { kicker: "Tempo scaduto", title: canMate ? `Vince il ${COLOR[winner]}` : "Patta" };
    }
    return { kicker: "Patta", title: REASONS[st.reason] };
  }

  function showResult(st) {
    const r = resultText(st);
    $("resultKicker").textContent = r.kicker;
    $("resultTitle").textContent = r.title;
    $("result").hidden = false;
  }

  function announce(m) {
    const who = COLOR[m.color];
    let text;
    if (m.castle) text = `${who}: arrocco ${m.castle === "k" ? "corto" : "lungo"}`;
    else {
      text = `${who}: ${NAMES[m.piece]} da ${m.from} a ${m.to}`;
      if (m.captured) text += `, prende ${NAMES[m.captured]}`;
      if (m.promotion) text += `, promosso a ${NAMES[m.promotion]}`;
    }
    if (m.san.endsWith("#")) text += ". Scacco matto";
    else if (m.san.endsWith("+")) text += ". Scacco";
    announceText(text);
  }
  const announceText = (t) => { $("announce").textContent = t; };

  // ---------- input ----------
  function select(name) {
    selected = name;
    drawBoard();
  }

  function onSquare(name) {
    if (!canHumanMove()) return;
    const p = game.get(name);
    if (selected) {
      if (name === selected) return select(null);
      const cands = legal.filter((m) => m.from === selected && m.to === name);
      if (cands.length) return play(cands);
    }
    select(p && p.color === game.turn() ? name : null);
  }

  // several candidates for one from/to pair means a promotion
  function play(cands, animate = true) {
    if (cands.length === 1) return commit(cands[0], { animate });
    choosePromotion(cands[0].color).then((t) => {
      if (t) commit(cands.find((m) => m.promotion === t), { animate: false });
      else select(null);
    });
  }

  function choosePromotion(color) {
    const dlg = $("promo"), grid = $("promoGrid");
    grid.innerHTML = ["q", "r", "b", "n"]
      .map((t) => `<button type="button" data-t="${t}" aria-label="${NAMES[t]}">${piece(t, color)}</button>`).join("");
    return new Promise((resolve) => {
      const done = (t) => {
        dlg.removeEventListener("close", onClose);
        grid.onclick = null;
        if (dlg.open) dlg.close();
        resolve(t);
      };
      const onClose = () => done(null);
      grid.onclick = (e) => { const b = e.target.closest("button"); if (b) done(b.dataset.t); };
      dlg.addEventListener("close", onClose);
      dlg.showModal();
      grid.firstChild.focus();
    });
  }

  board.addEventListener("click", (e) => {
    if (suppressClick) return;
    const el = e.target.closest(".sq");
    if (!el) return;
    setFocus(squares.indexOf(el), false);
    onSquare(el.dataset.sq);
  });

  // drag and drop with Pointer Events: mouse, pen and touch alike
  let drag = null, suppressClick = false;
  board.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || !canHumanMove()) return;
    const el = e.target.closest(".sq");
    const p = el && game.get(el.dataset.sq);
    if (!p || p.color !== game.turn()) return;
    drag = { from: el.dataset.sq, el, x: e.clientX, y: e.clientY, id: e.pointerId, ghost: null, over: null };
  });

  addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.ghost) {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      select(drag.from);
      const size = drag.el.getBoundingClientRect().width;
      drag.size = size;
      drag.ghost = document.createElement("div");
      drag.ghost.className = "ghost";
      drag.ghost.style.width = drag.ghost.style.height = size + "px";
      drag.ghost.innerHTML = drag.el.querySelector(".pc").outerHTML;
      document.querySelector(".ardesia").append(drag.ghost);
      drag.el.classList.add("lifted");
    }
    drag.ghost.style.transform = `translate(${e.clientX - drag.size / 2}px, ${e.clientY - drag.size / 2}px)`;
    const over = document.elementFromPoint(e.clientX, e.clientY);
    const sq = over && over.closest(".sq");
    if (drag.over !== sq) {
      if (drag.over) drag.over.classList.remove("hover");
      drag.over = sq;
      if (sq) sq.classList.add("hover");
    }
  });

  function endDrag(e, drop) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.ghost) return;
    d.ghost.remove();
    d.el.classList.remove("lifted");
    if (d.over) d.over.classList.remove("hover");
    // the click that follows a drag must not select or move again
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (!drop || !d.over) return;
    const cands = legal.filter((m) => m.from === d.from && m.to === d.over.dataset.sq);
    if (cands.length) play(cands, false);
  }
  addEventListener("pointerup", (e) => endDrag(e, true));
  addEventListener("pointercancel", (e) => endDrag(e, false));

  // keyboard: arrows walk the board as it is drawn, Enter/Space act, Esc drops the selection
  function setFocus(idx, move = true) {
    focusIdx = idx;
    squares.forEach((el, i) => { el.tabIndex = i === idx ? 0 : -1; });
    if (move) squares[idx].focus();
  }
  board.addEventListener("focusin", (e) => {
    const i = squares.indexOf(e.target);
    if (i >= 0 && i !== focusIdx) setFocus(i, false);
  });
  board.addEventListener("keydown", (e) => {
    const steps = { ArrowUp: -8, ArrowDown: 8, ArrowLeft: -1, ArrowRight: 1 };
    if (e.key === "Escape") { select(null); return; }
    if (!(e.key in steps)) return;
    e.preventDefault();
    const cell = cellOf(focusIdx), step = steps[e.key];
    const next = cell + step;
    if (next < 0 || next > 63 || (Math.abs(step) === 1 && next >> 3 !== cell >> 3)) return;
    setFocus(cellOf(next)); // cellOf is its own inverse
  });

  // ---------- controls ----------
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act], [data-close], [data-copy]");
    if (!b) return;
    if (b.dataset.close !== undefined) return b.closest("dialog").close();
    if (b.dataset.copy) return copy($(b.dataset.copy), b);
    ({ new: openSetup, undo, redo: redoMove, flip, export: openExport })[b.dataset.act]();
  });

  function flip() {
    flipped = !flipped;
    layout();
    drawBoard();
    drawPlayers();
    if (clock) drawClocks();
  }

  function openSetup() {
    const f = $("setupForm");
    f.mode.value = opts.mode === "auto" ? "ai" : opts.mode;
    f.side.value = opts.human;
    f.level.value = String(opts.level);
    f.clock.value = opts.clock;
    f.fen.value = opts.fen;
    $("fenError").textContent = "";
    $("setup").showModal();
  }

  $("setupForm").addEventListener("submit", (e) => {
    const f = e.target;
    const fen = f.fen.value.trim();
    if (fen) {
      try {
        new Chess(fen);
      } catch (err) {
        e.preventDefault();
        $("fenError").textContent = err.message;
        f.fen.focus();
        return;
      }
    }
    const side = f.side.value === "r" ? (rand() < 0.5 ? "w" : "b") : f.side.value;
    newGame({ mode: f.mode.value, human: side, level: +f.level.value, clock: f.clock.value, fen });
  });

  function openExport() {
    const st = status();
    const white = opts.mode === "ai" ? (opts.human === "w" ? "Giocatore" : `IA ${LEVELS[opts.level]}`) : "Bianco";
    const black = opts.mode === "ai" ? (opts.human === "b" ? "Giocatore" : `IA ${LEVELS[opts.level]}`) : "Nero";
    const headers = { White: white, Black: black };
    if (st.reason === "time") headers.Result = resultText(st).title === "Patta" ? "1/2-1/2" : flagged === "w" ? "0-1" : "1-0";
    if (clock) headers.TimeControl = `${CLOCKS[opts.clock][0]}+${CLOCKS[opts.clock][1]}`;
    $("fenOut").value = game.fen();
    $("pgnOut").value = game.pgn(headers);
    $("export").showModal();
  }

  function copy(field, btn) {
    const label = btn.textContent;
    const done = (ok) => {
      btn.textContent = ok ? "Copiato" : "Selezionato: copia con Ctrl+C";
      setTimeout(() => { btn.textContent = label; }, 1600);
    };
    field.select();
    if (navigator.clipboard) navigator.clipboard.writeText(field.value).then(() => done(true), () => done(document.execCommand("copy")));
    else done(document.execCommand("copy"));
  }

  $("download").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([$("pgnOut").value], { type: "application/x-chess-pgn" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ardesia-${new Date().toISOString().slice(0, 10)}.pgn`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // let the clock tick in the background tab, but repaint immediately on return
  document.addEventListener("visibilitychange", () => { if (!document.hidden && clock) tick(); });

  newGame({});
})();
