// Blasone engine: a six-turn duel of heraldic beasts over the four quarters of
// a shield. Both sides play one card a turn at the same time; each quarter goes
// to the higher total and is worth crowns. DOM-free, so node can play whole
// games (module.exports at the bottom).
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
    torre: { name: "Torre", glyph: "🏰", power: 1, t: "oro", ab: "Bastione", text: "Il suo quarto vale una corona in più." },
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
    { id: "rovescio", name: "Campo rovesciato", t: "nero", text: "Vince il totale più basso." },
  ];

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

  function create(seed) {
    const s = {
      seed, rand: rng(seed), turn: 1, uid: 0, over: null, last: null, log: [],
      fields: [], decks: {}, hands: { me: [], foe: [] },
      board: [0, 1, 2, 3].map(() => ({ me: [], foe: [] })),
    };
    s.fields = shuffle(s, FIELDS).slice(0, 4);
    for (const side of SIDES) {
      s.decks[side] = shuffle(s, Object.keys(BEASTS));
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
          // abilities of the other cards around it
          add(own.filter((o) => o !== c && o.id === "cervo").length, "Cervo");
          add(-2 * own.filter((o) => o !== c && o.id === "drago").length, "Drago");
          add(-has(q, other(side), "serpe"), "Serpe");
          for (const n of NEAR[q]) {
            add(has(n, side, "cigno"), "Cigno");
            add(-has(n, other(side), "gufo"), "Gufo");
          }
          const total = mods.reduce((t, m) => t + m.v, b.power);
          return { ...c, power: Math.max(0, total), base: b.power, mods };
        });
        sides[side] = { cards, total: cards.reduce((t, c) => t + c.power, 0) };
      }
      const crowns = (f.id === "argento" ? 2 : 1) + has(q, "me", "torre") + has(q, "foe", "torre");
      const a = sides.me, z = sides.foe;
      let lead = null;
      if (a.cards.length && !z.cards.length) lead = "me";
      else if (z.cards.length && !a.cards.length) lead = "foe";
      else if (a.cards.length && a.total !== z.total) lead = (a.total > z.total) !== (f.id === "rovescio") ? "me" : "foe";
      return { q, field: f, crowns, me: a, foe: z, lead };
    });
    const score = { me: 0, foe: 0 };
    quarters.forEach((x) => x.lead && (score[x.lead] += x.crowns));
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
      return v + x.crowns * Math.tanh(m / 2.5);
    }, 0);
  }
  function choose(s, side, noise = 0.35) {
    let best = null;
    s.hands[side].forEach((card, i) => {
      for (let q = 0; q < 4; q++) {
        if (!legal(s, side, q)) continue;
        s.board[q][side].push(card);
        const v = value(s, side) + s.rand() * noise;
        s.board[q][side].pop();
        if (!best || v > best.v) best = { i, q, v };
      }
    });
    return best;
  }

  // both sides commit one card; me plays hand[i] into quarter q
  function play(s, i, q, foeMove) {
    const card = s.hands.me[i];
    if (!card || !legal(s, "me", q)) return false;
    const f = foeMove || choose(s, "foe");
    const fc = f && s.hands.foe[f.i];
    s.hands.me.splice(i, 1);
    s.board[q].me.push(card);
    if (fc) {
      s.hands.foe.splice(f.i, 1);
      s.board[f.q].foe.push(fc);
    }
    s.last = { me: card.uid, foe: fc && fc.uid };
    s.log.unshift({
      turn: s.turn,
      me: `${BEASTS[card.id].name} nel quarto ${ROMAN[q]}`,
      foe: fc ? `${BEASTS[fc.id].name} nel quarto ${ROMAN[f.q]}` : "nessuna carta",
    });
    if (s.turn >= TURNS) return finish(s), true;
    s.turn++;
    draw(s, "me");
    draw(s, "foe");
    return true;
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

  const api = { TINCT, BEASTS, FIELDS, TURNS, QUARTERS, ROMAN, NEAR, create, legal, cap, evaluate, choose, play };
  if (typeof module !== "undefined") module.exports = api;
  else root.Blasone = api;
})(this);
