// Blasone engine: a six-turn duel of heraldic beasts over the four quarters of
// a shield. Both sides play one card a turn at the same time; each quarter goes
// to the higher total and is worth crowns. Two formats: Classico deals the 16
// beasts of the base set and the Crepuscolo, Crepuscolo draws 16 from the
// whole catalogue for the game. The Editto is an optional rule. DOM-free, so
// node can play whole games (module.exports at the bottom).
(function (root) {
  const TINCT = {
    oro: { name: "Oro", metal: true },
    argento: { name: "Argento", metal: true },
    rosso: { name: "Rosso" },
    azzurro: { name: "Azzurro" },
    verde: { name: "Verde" },
    nero: { name: "Nero" },
  };

  const BEASTS = {
    leone: { name: "Leone", glyph: "🦁", power: 6, t: "oro", ab: "Solitario", text: "+2 se è l'unica tua carta nel suo quarto." },
    aquila: { name: "Aquila", glyph: "🦅", power: 4, t: "nero", ab: "Rapace", text: "+1 per ogni carta avversaria nel suo quarto." },
    serpe: { name: "Serpe", glyph: "🐍", power: 2, t: "verde", ab: "Veleno", text: "−1 a ogni carta avversaria nel suo quarto." },
    drago: { name: "Drago", glyph: "🐉", power: 8, t: "rosso", ab: "Tiranno", text: "−2 a ogni altra tua carta nel suo quarto." },
    cervo: { name: "Cervo", glyph: "🦌", power: 3, t: "verde", ab: "Concordia", text: "+1 a ogni altra tua carta nel suo quarto." },
    unicorno: { name: "Unicorno", glyph: "🦄", power: 3, t: "argento", ab: "Purezza", text: "+3 se il lato avversario del quarto è vuoto." },
    lupo: { name: "Lupo", glyph: "🐺", power: 3, t: "nero", ab: "Assedio", text: "+3 se l'avversario ha più carte di te nel quarto." },
    delfino: { name: "Delfino", glyph: "🐬", power: 3, t: "azzurro", ab: "Marea", text: "+2 nei quarti di punta (III e IV)." },
    gallo: { name: "Gallo", glyph: "🐓", power: 2, t: "rosso", ab: "Vigilia", text: "+2 nei quarti di capo (I e II)." },
    cigno: { name: "Cigno", glyph: "🦢", power: 1, t: "argento", ab: "Grazia", text: "+1 a ogni tua carta nei quarti confinanti." },
    gufo: { name: "Gufo", glyph: "🦉", power: 2, t: "azzurro", ab: "Presagio", text: "−1 a ogni carta avversaria nei quarti confinanti." },
    torre: { name: "Torre", glyph: "🏰", power: 1, t: "oro", ab: "Bastione", text: "Il suo quarto vale una corona in più, per chi lo conquista." },
    // expansion: Le Case del Crepuscolo
    volpe: { name: "Volpe", glyph: "🦊", power: 3, t: "rosso", ab: "Astuzia", text: "+2 se nel suo quarto c'erano già carte avversarie quando è stata posata." },
    tasso: { name: "Tasso", glyph: "🦡", power: 4, t: "nero", ab: "Tenacia", text: "Le abilità avversarie non possono ridurne la forza." },
    fenice: { name: "Fenice", glyph: "🐦‍🔥", power: 3, t: "oro", ab: "Rinascita", text: "+3 se senza questo potere il suo quarto andrebbe all'avversario." },
    pavone: { name: "Pavone", glyph: "🦚", power: 3, t: "argento", ab: "Ostentazione", text: "Se è la tua prima carta nel quarto, il quarto vale +1 corona solo per te." },
    // third house: Le Fiere, only in the Crepuscolo format
    orso: { name: "Orso", glyph: "🐻", power: 4, t: "oro", ab: "Custodia", text: "+1 se, quando è posato, controlli già un quarto confinante." },
    salamandra: { name: "Salamandra", glyph: "🦎", power: 3, t: "rosso", ab: "Brace", text: "+2 sul Campo d'oro e sul Campo di rosso." },
    cinghiale: { name: "Cinghiale", glyph: "🐗", power: 3, t: "nero", ab: "Impeto", text: "+2 se è stata la prima carta posata nel suo quarto (anche insieme a una avversaria)." },
    scorpione: { name: "Scorpione", glyph: "🦂", power: 5, t: "verde", ab: "Famelica", text: "−1 a ogni altra tua carta nel suo quarto." },
  };

  // each game deals four fields, one per quarter
  const FIELDS = [
    { id: "oro", name: "Campo d'oro", t: "oro", text: "Le carte d'oro +1." },
    { id: "rosso", name: "Campo di rosso", t: "rosso", text: "Le carte rosse +1." },
    { id: "azzurro", name: "Campo d'azzurro", t: "azzurro", text: "Le carte azzurre +2." },
    { id: "verde", name: "Campo di verde", t: "verde", text: "Le carte verdi +2." },
    { id: "nero", name: "Campo di nero", t: "nero", text: "Nere +1, d'argento −1." },
    { id: "argento", name: "Campo d'argento", t: "argento", text: "Il quarto vale 2 corone." },
    { id: "stretto", name: "Campo stretto", t: "argento", text: "Al massimo 2 carte per lato." },
    { id: "rovescio", name: "Campo rovesciato", t: "nero", text: "Vince il totale più basso; se un solo lato ha carte, è suo." },
  ];

  const HOUSES = [
    { id: "base", name: "Bestiario", cards: ["leone", "aquila", "serpe", "drago", "cervo", "unicorno", "lupo", "delfino", "gallo", "cigno", "gufo", "torre"] },
    { id: "crepuscolo", name: "Case del Crepuscolo", cards: ["volpe", "tasso", "fenice", "pavone"] },
    { id: "fiere", name: "Le Fiere", cards: ["orso", "salamandra", "cinghiale", "scorpione"] },
  ];
  const HOUSE = {};
  HOUSES.forEach((h) => h.cards.forEach((id) => (HOUSE[id] = h)));
  const FORMATS = {
    classico: { name: "Classico", text: "Le sedici carte del Bestiario e del Crepuscolo." },
    crepuscolo: { name: "Crepuscolo", text: "Sedici carte estratte a sorte dall'intero catalogo, senza doppioni." },
  };
  const CLASSIC = HOUSES[0].cards.concat(HOUSES[1].cards);
  const DECK = 16;

  const TURNS = 6;
  const QUARTERS = ["Capo destro", "Capo sinistro", "Punta destra", "Punta sinistra"];
  const ROMAN = ["I", "II", "III", "IV"];
  const NEAR = [[1, 2], [0, 3], [0, 3], [1, 2]]; // quarters sharing a fold
  const SIDES = ["me", "foe"];
  const other = (side) => (side === "me" ? "foe" : "me");

  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(s, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(s.rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // opts: { format: "classico" | "crepuscolo", editto: bool }
  function create(seed, opts = {}) {
    const format = FORMATS[opts.format] ? opts.format : "classico";
    const s = {
      seed, format, rand: rng(seed), turn: 1, uid: 0, over: null, last: null, log: [],
      fields: [], decks: {}, hands: { me: [], foe: [] },
      board: [0, 1, 2, 3].map(() => ({ me: [], foe: [] })),
      edict: opts.editto ? { me: null, foe: null } : null,
    };
    // Classico draws nothing extra from the rng, so a seed plays as before;
    // both sides share the Crepuscolo selection
    s.pool = format === "classico" ? CLASSIC.slice() : shuffle(s, Object.keys(BEASTS)).slice(0, DECK);
    s.fields = shuffle(s, FIELDS).slice(0, 4);
    for (const side of SIDES) {
      s.decks[side] = shuffle(s, s.pool);
      for (let i = 0; i < 4; i++) draw(s, side);
    }
    return s;
  }
  function draw(s, side) {
    const id = s.decks[side].pop();
    if (id) s.hands[side].push({ id, uid: ++s.uid });
  }

  const cap = (s, q) => (s.fields[q].id === "stretto" ? 2 : 3);
  const legal = (s, side, q) => !s.over && s.board[q][side].length < cap(s, q);
  // the Editto can be declared once, from turn II
  const edictOpen = (s, side) => !!s.edict && !s.edict[side] && s.turn >= 2 && !s.over;

  // what a card remembers from the moment it is laid: the turn (Volpe,
  // Cinghiale) and, for the Orso, whether you held a neighbouring quarter.
  // leads are the quarters' owners before this turn's cards
  function lay(s, side, card, q, leads) {
    card.at = s.turn;
    if (card.id === "orso") card.guard = NEAR[q].some((n) => leads[n] === side);
    s.board[q][side].push(card);
  }
  const leads = (s) => evaluate(s).quarters.map((x) => x.lead);

  // ---------- scoring: every number is recomputed from the board ----------
  function evaluate(s) {
    const B = s.board;
    const has = (q, side, id) => B[q][side].filter((c) => c.id === id).length;
    const quarters = B.map((sq, q) => {
      const f = s.fields[q];
      const sides = {};
      for (const side of SIDES) {
        const own = sq[side], opp = sq[other(side)];
        const cards = own.map((c, k) => {
          const b = BEASTS[c.id];
          const mods = [];
          const add = (v, why) => v && mods.push({ v, why });
          // field
          if (f.id === "oro" && b.t === "oro") add(1, "campo");
          if (f.id === "rosso" && b.t === "rosso") add(1, "campo");
          if (f.id === "azzurro" && b.t === "azzurro") add(2, "campo");
          if (f.id === "verde" && b.t === "verde") add(2, "campo");
          if (f.id === "nero") add(b.t === "nero" ? 1 : b.t === "argento" ? -1 : 0, "campo");
          // law of tincture: metal on colour or colour on metal
          if (k > 0 && TINCT[BEASTS[own[k - 1].id].t].metal !== TINCT[b.t].metal) add(1, "tinture");
          // its own ability
          if (c.id === "leone" && own.length === 1) add(2, b.ab);
          if (c.id === "aquila") add(opp.length, b.ab);
          if (c.id === "unicorno" && !opp.length) add(3, b.ab);
          if (c.id === "lupo" && opp.length > own.length) add(3, b.ab);
          if (c.id === "delfino" && q >= 2) add(2, b.ab);
          if (c.id === "gallo" && q < 2) add(2, b.ab);
          if (c.id === "volpe" && opp.some((o) => o.at < c.at)) add(2, b.ab);
          if (c.id === "orso" && c.guard) add(1, b.ab);
          if (c.id === "salamandra" && (f.id === "oro" || f.id === "rosso")) add(2, b.ab);
          if (c.id === "cinghiale" && !own.concat(opp).some((o) => o.at < c.at)) add(2, b.ab);
          // abilities of the other cards around it (the Tasso shrugs off the enemy's)
          const tough = c.id === "tasso";
          add(own.filter((o) => o !== c && o.id === "cervo").length, "Cervo");
          add(-2 * own.filter((o) => o !== c && o.id === "drago").length, "Drago");
          add(-own.filter((o) => o !== c && o.id === "scorpione").length, "Scorpione");
          if (!tough) add(-has(q, other(side), "serpe"), "Serpe");
          for (const n of NEAR[q]) {
            add(has(n, side, "cigno"), "Cigno");
            if (!tough) add(-has(n, other(side), "gufo"), "Gufo");
          }
          return { ...c, base: b.power, mods };
        });
        sides[side] = { cards };
      }
      const leader = () => {
        for (const x of [sides.me, sides.foe]) {
          x.cards.forEach((c) => (c.power = Math.max(0, c.mods.reduce((t, m) => t + m.v, c.base))));
          x.total = x.cards.reduce((t, c) => t + c.power, 0);
        }
        const a = sides.me, z = sides.foe;
        if (a.cards.length && !z.cards.length) return "me";
        if (z.cards.length && !a.cards.length) return "foe";
        if (a.cards.length && a.total !== z.total) return (a.total > z.total) !== (f.id === "rovescio") ? "me" : "foe";
        return null;
      };
      let lead = leader();
      // the Fenice reads the result without itself, then rises: a second pass
      const loser = lead && other(lead);
      if (loser && has(q, loser, "fenice")) {
        sides[loser].cards.forEach((c) => c.id === "fenice" && c.mods.push({ v: 3, why: "Rinascita" }));
        lead = leader();
      }
      const crowns = (f.id === "argento" ? 2 : 1) + has(q, "me", "torre") + has(q, "foe", "torre");
      // crowns that only go to one side: the Pavone's and the Editto's
      const extra = {};
      for (const side of SIDES) {
        extra[side] = [];
        if (sq[side][0]?.id === "pavone") extra[side].push("Pavone");
        if (s.edict && s.edict[side] && s.edict[side].q === q) extra[side].push("Editto");
      }
      const bonus = { me: extra.me.length, foe: extra.foe.length };
      return { q, field: f, crowns, bonus, extra, me: sides.me, foe: sides.foe, lead };
    });
    const score = { me: 0, foe: 0 };
    quarters.forEach((x) => x.lead && (score[x.lead] += x.crowns + x.bonus[x.lead]));
    return { quarters, score };
  }

  // ---------- AI: try every card in every quarter, keep the best board ----------
  function value(s, side) {
    return evaluate(s).quarters.reduce((v, x) => {
      if (!x.me.cards.length && !x.foe.cards.length) return v;
      let m = x[side].total - x[other(side)].total;
      if (x.field.id === "rovescio") m = -m;
      if (!x[side].cards.length) m = -4;
      if (!x[other(side)].cards.length && x[side].cards.length) m = Math.max(m, 3);
      // expected crowns won minus crowns conceded
      const p = (1 + Math.tanh(m / 2.5)) / 2;
      return v + p * (x.crowns + x.bonus[side]) - (1 - p) * (x.crowns + x.bonus[other(side)]);
    }, 0);
  }
  // noise is how loosely the AI plays: 0 always takes the best-looking move
  function choose(s, side, noise = 0.35) {
    let best = null;
    const before = leads(s);
    s.hands[side].forEach((card, i) => {
      for (let q = 0; q < 4; q++) {
        if (!legal(s, side, q)) continue;
        lay(s, side, card, q, before);
        const v = value(s, side) + s.rand() * noise;
        s.board[q][side].pop();
        if (!best || v > best.v) best = { i, q, v };
      }
    });
    // the Editto waits for a contested quarter the move clearly holds once
    // the board has taken shape, or is spent on the last turn rather than
    // wasted
    if (best && edictOpen(s, side)) {
      lay(s, side, s.hands[side][best.i], best.q, before);
      const x = evaluate(s).quarters[best.q];
      s.board[best.q][side].pop();
      let m = x[side].total - x[other(side)].total;
      if (x.field.id === "rovescio") m = -m;
      const contested = x[other(side)].cards.length > 0;
      best.edict = (s.turn >= 4 && contested && m >= 3) || s.turn === TURNS;
    }
    return best;
  }

  // both sides commit one card; me plays hand[i] into quarter q, and with
  // edict declares the Editto on that same quarter
  function play(s, i, q, foeMove, edict) {
    const card = s.hands.me[i];
    if (!card || !legal(s, "me", q)) return false;
    const f = foeMove || choose(s, "foe");
    const fc = f && s.hands.foe[f.i];
    const before = leads(s);
    s.hands.me.splice(i, 1);
    lay(s, "me", card, q, before);
    if (fc) {
      s.hands.foe.splice(f.i, 1);
      lay(s, "foe", fc, f.q, before);
    }
    const declared = { me: edict && edictOpen(s, "me"), foe: fc && f.edict && edictOpen(s, "foe") };
    if (declared.me) s.edict.me = { q, turn: s.turn };
    if (declared.foe) s.edict.foe = { q: f.q, turn: s.turn };
    s.last = { me: card.uid, foe: fc && fc.uid };
    const said = (c, at, ed) => `${BEASTS[c.id].name} nel quarto ${ROMAN[at]}${ed ? ", con l'Editto" : ""}`;
    s.log.unshift({
      turn: s.turn,
      me: said(card, q, declared.me),
      foe: fc ? said(fc, f.q, declared.foe) : "nessuna carta",
    });
    if (s.turn >= TURNS) return finish(s), true;
    s.turn++;
    draw(s, "me");
    draw(s, "foe");
    return true;
  }

  // ---------- game codes: one game, reproducible from a short string ----------
  // seed, format, Editto and the Conte's style, e.g. "418273-cns". The same
  // code and the same moves give the same game (the AI draws from s.rand).
  const CONTI = ["prudente", "standard", "variabile"];
  const code = (s, conte) => `${s.seed}-${s.format === "classico" ? "c" : "r"}${s.edict ? "e" : "n"}${conte[0]}`;
  // untrusted text in, a validated game or null out
  function parseCode(text) {
    const m = /^(\d{1,10})-([cr])([en])([psv])$/.exec(String(text).trim().toLowerCase().slice(0, 32));
    if (!m || +m[1] > 0xffffffff) return null;
    return {
      seed: +m[1],
      format: m[2] === "c" ? "classico" : "crepuscolo",
      editto: m[3] === "e",
      conte: CONTI.find((c) => c[0] === m[4]),
    };
  }

  function finish(s) {
    const e = evaluate(s);
    let w = e.score.me > e.score.foe ? "me" : e.score.foe > e.score.me ? "foe" : null;
    if (!w) {
      // tie on crowns: the greater total strength across the shield
      const sum = (side) => e.quarters.reduce((t, x) => t + x[side].total, 0);
      w = sum("me") > sum("foe") ? "me" : sum("foe") > sum("me") ? "foe" : "pari";
    }
    s.over = w;
  }

  const api = { TINCT, BEASTS, FIELDS, HOUSES, HOUSE, FORMATS, TURNS, QUARTERS, ROMAN, NEAR, SIDES, create, legal, cap, edictOpen, evaluate, choose, play, code, parseCode };
  if (typeof module !== "undefined") module.exports = api;
  else root.Blasone = api;
})(this);
