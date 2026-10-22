// Blasone engine: a six-turn duel of heraldic beasts over the four quarters of
// a shield. Both sides play one card a turn at the same time; each quarter goes
// to the higher total and is worth crowns. Three formats: Classico deals the
// 16 beasts of the base set and the Crepuscolo, Crepuscolo draws 16 from the
// first three houses, the Draft delle Casate adds four picks to the base set.
// The Prove dell'Araldo are short prepared positions with a goal. The Editto
// is an optional rule. DOM-free, so node can play whole games
// (module.exports at the bottom).
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
    // fourth house: Compagnia delle Veglie, only in the Draft delle Casate. A
    // Reazione answers the enemy cards laid in its quarter after it. Beasts
    // with no emoji of their own have a drawing (img, transparent PNG in
    // art/) and, until it loads or if it fails, emoji parts: [glyph, x, y,
    // size, mirrored], in fractions of the plate. The Grifone is an eagle over
    // a feline body, the Basilisco a cock with a serpent's tail, as heralds draw them
    grifone: { name: "Grifone", img: "art/grifone.png", glyph: [["🐈", 0.58, 0.64, 0.62], ["🦅", 0.34, 0.4, 0.5]], power: 4, t: "oro", ab: "Custode", text: "+2 se controlli entrambi i quarti confinanti." },
    basilisco: { name: "Basilisco", img: "art/basilisco.png", glyph: [["🐍", 0.6, 0.7, 0.62, true], ["🐓", 0.42, 0.44, 0.6]], power: 3, t: "verde", ab: "Sguardo", text: "Reazione: −2 a ogni carta avversaria posata nel suo quarto dopo di lui." },
    balena: { name: "Balena", glyph: "🐋", power: 4, t: "azzurro", ab: "Corrente", text: "+1 per ogni quarto confinante in cui hai almeno una carta (al massimo +2)." },
    arpia: { name: "Arpia", glyph: "🐦‍⬛", power: 4, t: "nero", ab: "Rimprovero", text: "Reazione: le carte avversarie posate nel suo quarto dopo di lei perdono il +1 della legge delle tinture." },
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
    { id: "veglie", name: "Compagnia delle Veglie", cards: ["grifone", "basilisco", "balena", "arpia"] },
  ];
  const HOUSE = {};
  HOUSES.forEach((h) => h.cards.forEach((id) => (HOUSE[id] = h)));
  const FORMATS = {
    classico: { name: "Classico", text: "Le sedici carte del Bestiario e del Crepuscolo." },
    crepuscolo: { name: "Crepuscolo", text: "Sedici carte estratte a sorte dal Bestiario, dal Crepuscolo e dalle Fiere, senza doppioni." },
    draft: { name: "Draft delle Casate", text: "Le dodici carte del Bestiario per tutti e due, più quattro scelte a turno con il Conte tra otto carte scoperte delle altre casate." },
  };
  const CLASSIC = HOUSES[0].cards.concat(HOUSES[1].cards);
  // the Crepuscolo's list is fixed, so its games stay the same as houses are added
  const CREPUSCOLO = HOUSES.slice(0, 3).flatMap((h) => h.cards);
  const DECK = 16;
  // the draft: the base set is common, the other three houses are drafted.
  // Eight are offered face up and picked in the order ABBAABBA, so the first
  // pick is balanced by the two that follow it
  const COMMON = HOUSES[0].cards;
  const DRAFTABLE = HOUSES.slice(1).flatMap((h) => h.cards);
  const OFFER = 8;
  const ORDER = ["me", "foe", "foe", "me", "me", "foe", "foe", "me"];
  // the Conte's draft ranking: the share of quarters each beast wins where it
  // is played, measured by scripts/blasone-sim.js on Draft games picked at random
  const RATE = { volpe: 49, tasso: 49, fenice: 46, pavone: 38, orso: 54, salamandra: 56, cinghiale: 52, scorpione: 44, grifone: 50, basilisco: 58, balena: 58, arpia: 47 };

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

  // opts: { format: "classico" | "crepuscolo" | "draft", editto: bool }, or
  // { trial: n } for the Prova dell'Araldo n (0-based, null if invalid)
  function create(seed, opts = {}) {
    if (opts.trial !== undefined) return trialGame(opts.trial);
    const format = own(FORMATS, opts.format) ? opts.format : "classico";
    const s = {
      seed, format, rand: rng(seed), turn: 1, uid: 0, over: null, last: null, log: [],
      fields: [], decks: { me: [], foe: [] }, hands: { me: [], foe: [] },
      board: [0, 1, 2, 3].map(() => ({ me: [], foe: [] })),
      edict: opts.editto ? { me: null, foe: null } : null,
    };
    // Classico draws nothing extra from the rng, so a seed plays as before;
    // both sides share the Crepuscolo selection. A draft deals after the picks
    if (format === "draft") {
      const offer = shuffle(s, DRAFTABLE).slice(0, OFFER);
      s.draft = { offer, picks: { me: [], foe: [] }, notes: [] };
      s.pool = COMMON.concat(offer);
    } else s.pool = format === "classico" ? CLASSIC.slice() : shuffle(s, CREPUSCOLO).slice(0, DECK);
    s.fields = shuffle(s, FIELDS).slice(0, 4);
    if (!s.draft) deal(s, { me: s.pool, foe: s.pool });
    return s;
  }
  function deal(s, lists) {
    for (const side of SIDES) {
      s.decks[side] = shuffle(s, lists[side]);
      for (let i = 0; i < 4; i++) draw(s, side);
    }
  }
  function draw(s, side) {
    const id = s.decks[side].pop();
    if (id) s.hands[side].push({ id, uid: ++s.uid });
  }

  const own = (o, k) => typeof k === "string" && Object.prototype.hasOwnProperty.call(o, k);

  // ---------- the draft ----------
  // whose pick it is, or null once both sides hold four
  const draftTurn = (s) => (s.draft ? ORDER[s.draft.picks.me.length + s.draft.picks.foe.length] || null : null);
  const draftLeft = (s) => s.draft.offer.filter((id) => !s.draft.picks.me.includes(id) && !s.draft.picks.foe.includes(id));
  // the best-rated beast left, loosened by noise; why says it in words
  function draftChoice(s, side, noise = 0) {
    const left = draftLeft(s).map((id) => ({ id, r: RATE[id], v: RATE[id] + s.rand() * noise * 8 }));
    const top = left.slice().sort((a, b) => b.r - a.r)[0];
    const c = left.sort((a, b) => b.v - a.v)[0];
    const why =
      c.r === top.r
        ? `La più forte rimasta: nelle partite simulate vince il ${c.r}% dei quarti in cui è giocata.`
        : `Una scelta d'istinto: vince il ${c.r}% dei quarti, meno di ${BEASTS[top.id].name} (${top.r}%).`;
    return { id: c.id, side, why };
  }
  // your pick, an untrusted id: it must be on offer and still free, and it
  // must be your turn. The Conte answers until it is your turn again; after
  // the last pick both decks are dealt
  function pick(s, id, noise = 0.35, side = "me") {
    if (draftTurn(s) !== side || typeof id !== "string" || !draftLeft(s).includes(id)) return false;
    s.draft.picks[side].push(id);
    s.draft.notes.push({ id, side });
    while (side === "me" && draftTurn(s) === "foe") {
      const c = draftChoice(s, "foe", noise);
      s.draft.picks.foe.push(c.id);
      s.draft.notes.push(c);
    }
    if (!draftTurn(s)) deal(s, { me: COMMON.concat(s.draft.picks.me), foe: COMMON.concat(s.draft.picks.foe) });
    return true;
  }

  const cap = (s, q) => (s.fields[q].id === "stretto" ? 2 : 3);
  const legal = (s, side, q) => !s.over && !draftTurn(s) && s.board[q][side].length < cap(s, q);
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
    let quarters = B.map((sq, q) => quarter(s, q, null));
    // the Grifone reads who holds the quarters around it; no strength in one
    // quarter changes who holds another, so one more pass is exact
    if (B.some((sq) => SIDES.some((side) => sq[side].some((c) => c.id === "grifone")))) {
      const held = quarters.map((x) => x.lead);
      quarters = B.map((sq, q) => quarter(s, q, held));
    }
    const score = { me: 0, foe: 0 };
    quarters.forEach((x) => x.lead && (score[x.lead] += x.crowns + x.bonus[x.lead]));
    return { quarters, score };
  }
  // one quarter; held: who held each quarter on the first pass, or null
  function quarter(s, q, held) {
    const B = s.board, sq = B[q];
    const has = (q, side, id) => B[q][side].filter((c) => c.id === id).length;
    {
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
          // abilities of the other cards around it (the Tasso shrugs off the enemy's)
          const tough = c.id === "tasso";
          // reactions: enemy cards laid in this quarter in an earlier turn
          const watched = (id) => (tough ? 0 : opp.filter((o) => o.id === id && o.at < c.at).length);
          // law of tincture: metal on colour or colour on metal
          if (k > 0 && TINCT[BEASTS[own[k - 1].id].t].metal !== TINCT[b.t].metal) {
            add(1, "tinture");
            if (watched("arpia")) add(-1, "Arpia");
          }
          add(-2 * watched("basilisco"), "Basilisco");
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
          if (c.id === "grifone" && held && NEAR[q].every((n) => held[n] === side)) add(2, b.ab);
          if (c.id === "balena") add(NEAR[q].filter((n) => B[n][side].length).length, b.ab);
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
    }
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
  // a Reazione pays later: what it is worth now that enemy cards may still
  // come into its quarter (the board alone can't see it)
  const WATCH = { basilisco: 1.2, arpia: 0.5 };
  function watch(s, side, card, q) {
    if (!WATCH[card.id] || s.turn >= TURNS) return 0;
    const room = cap(s, q) - s.board[q][other(side)].length;
    return room > 0 ? WATCH[card.id] * Math.min(room, TURNS - s.turn) / 2 : 0;
  }
  // noise is how loosely the AI plays: 0 always takes the best-looking move
  function choose(s, side, noise = 0.35) {
    let best = null;
    const before = leads(s);
    s.hands[side].forEach((card, i) => {
      for (let q = 0; q < 4; q++) {
        if (!legal(s, side, q)) continue;
        lay(s, side, card, q, before);
        const v = value(s, side) + watch(s, side, card, q) + s.rand() * noise;
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
  // seed, format, Editto and the Conte's style, e.g. "418273-cns", or a
  // trial, "prova-3". The same code and the same moves (and draft picks) give
  // the same game (the AI draws from s.rand).
  const CONTI = ["prudente", "standard", "variabile"];
  const LETTER = { classico: "c", crepuscolo: "r", draft: "d" };
  const code = (s, conte) => (s.trial !== undefined ? `prova-${s.trial + 1}` : `${s.seed}-${LETTER[s.format]}${s.edict ? "e" : "n"}${conte[0]}`);
  // untrusted text in, a validated game or null out
  function parseCode(text) {
    const t = String(text).trim().toLowerCase().slice(0, 32);
    const p = /^prova-(\d)$/.exec(t);
    if (p) return +p[1] >= 1 && +p[1] <= TRIALS.length ? { trial: +p[1] - 1, conte: "prudente" } : null;
    const m = /^(\d{1,10})-([crd])([en])([psv])$/.exec(t);
    if (!m || +m[1] > 0xffffffff) return null;
    return {
      seed: +m[1],
      format: Object.keys(LETTER).find((f) => LETTER[f] === m[2]),
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
    if (s.trial !== undefined) s.goal = goalMet(s, e);
  }

  // ---------- Prove dell'Araldo: prepared positions, no draw ----------
  // Each trial sets the fields, the cards already on the shield (with the
  // turn they were laid), both hands and the turn it starts on; it always
  // ends after turn VI, so it lasts one to three turns. The Conte plays with
  // no noise, so a trial always answers the same moves the same way.
  // goal: { quarters: [q...] } all yours, { crowns: n } at least n, { win: true }
  const TRIALS = [
    {
      name: "Metallo su colore", level: "Introduttiva", turn: 6,
      fields: ["oro", "rosso", "argento", "nero"],
      board: [
        { me: [["leone", 1]], foe: [["gallo", 2]] },
        { me: [["delfino", 2]], foe: [["drago", 1]] },
        { me: [["unicorno", 2]], foe: [["torre", 1], ["cigno", 3], ["orso", 4]] },
        { me: [["aquila", 3]], foe: [["lupo", 4]] },
      ],
      hands: { me: ["pavone", "salamandra", "gallo"], foe: ["serpe"] },
      goal: { quarters: [2] },
      goalText: "Conquista il quarto III, sul Campo d'argento.",
      hint: "Il campo non cambia la forza. Guarda di che tintura è l'Unicorno, e di che tintura sono le carte in mano.",
      why: "L'Unicorno è d'argento, un metallo: una carta di colore posata sopra prende +1 per la legge delle tinture. La Salamandra (rossa, 3) sale a 4 e porta il quarto a 7 contro 6. Pavone (metallo) e Gallo (2+1) si fermano al pareggio, 6 a 6, e un quarto pari non è di nessuno.",
    },
    {
      name: "Oltre la piega", level: "Introduttiva", turn: 6,
      fields: ["verde", "stretto", "azzurro", "rosso"],
      board: [
        { me: [], foe: [["gallo", 3]] },
        { me: [["cervo", 2], ["leone", 3]], foe: [["drago", 2], ["aquila", 4]] },
        { me: [["unicorno", 1]], foe: [] },
        { me: [["delfino", 2]], foe: [["salamandra", 4]] },
      ],
      hands: { me: ["cigno", "gufo", "torre"], foe: ["serpe"] },
      goal: { quarters: [1] },
      goalText: "Conquista il quarto II, sul Campo stretto. Lì non puoi più posare.",
      hint: "Alcune carte agiscono sui quarti confinanti, quelli separati da una sola piega. Quali quarti confinano con il II?",
      why: "Il Campo stretto ammette due carte per lato: il quarto II è pieno. Ma il II confina con il I e con il IV. Il Cigno posato lì dà +1 a ciascuna delle tue due carte nel II (13 a 12); il Gufo toglie 1 a ciascuna delle due del Conte (11 a 10). Il quarto III tocca il II solo in un punto, non lungo una piega.",
    },
    {
      name: "Il mondo alla rovescia", level: "Intermedia", turn: 5,
      fields: ["argento", "oro", "verde", "rovescio"],
      board: [
        { me: [["aquila", 1]], foe: [["leone", 2]] },
        { me: [["gallo", 1], ["torre", 3]], foe: [["delfino", 1]] },
        { me: [["serpe", 2]], foe: [["cervo", 3]] },
        { me: [], foe: [["drago", 3]] },
      ],
      hands: { me: ["cigno", "unicorno", "lupo", "tasso"], foe: ["gufo", "salamandra"] },
      goal: { win: true },
      goalText: "Vinci la partita in due turni.",
      hint: "Sul Campo rovesciato vince il totale più basso, ma solo se entrambi i lati hanno carte. La forza del Drago, lì, è un problema per il Conte.",
      why: "Nel quarto IV il Drago è solo, e un quarto con carte da un lato solo è di quel lato, anche sul Campo rovesciato. Posa lì il Cigno: il quarto diventa conteso e vince il totale più basso, 1 contro 8. Il Conte non può più abbassare il suo totale. Poi conquista un altro quarto, per esempio il I sul Campo d'argento, dove l'Aquila cresce con ogni carta del Conte e l'Unicorno prende +1 dalle tinture: finisci 3 corone a 2.",
    },
    {
      name: "L'Editto", level: "Intermedia", turn: 5, editto: true,
      fields: ["nero", "argento", "azzurro", "oro"],
      board: [
        { me: [["drago", 1]], foe: [["unicorno", 2]] },
        { me: [["cervo", 2]], foe: [["lupo", 3]] },
        { me: [], foe: [["delfino", 1]] },
        { me: [["leone", 3]], foe: [["torre", 4]] },
      ],
      hands: { me: ["gufo", "salamandra", "pavone", "aquila"], foe: ["serpe", "gallo"] },
      goal: { crowns: 6 },
      goalText: "Termina con almeno 6 corone.",
      hint: "Senza Editto arrivi al massimo a 5 corone. Il Conte dichiarerà il suo dove si sente sicuro: guarda il Campo d'argento.",
      why: "Il quarto II, sul Campo d'argento, vale 2 corone, e il Conte ci dichiara il suo Editto al turno V. Se lo conquisti tu, il suo Editto non vale nulla: l'Editto paga solo chi conquista il quarto. L'Aquila lì cresce di 1 per ogni carta del Conte e porta il quarto dalla tua parte; con il tuo Editto sul II (o su un quarto che tieni fino alla fine, come il I o il IV) arrivi a 6.",
    },
    {
      name: "Lo sguardo", level: "Avanzata", turn: 5,
      fields: ["verde", "oro", "rosso", "azzurro"],
      board: [
        { me: [["cervo", 2]], foe: [["basilisco", 2]] },
        { me: [["torre", 1]], foe: [["arpia", 3]] },
        { me: [["salamandra", 2]], foe: [["gallo", 1]] },
        { me: [], foe: [["delfino", 3]] },
      ],
      hands: { me: ["tasso", "leone", "gufo", "volpe"], foe: ["torre", "pavone"] },
      goal: { quarters: [0, 1] },
      goalText: "Conquista entrambi i quarti di capo, I e II.",
      hint: "Il Basilisco e l'Arpia reagiscono alle carte che posi nel loro quarto dopo di loro. Leggi bene le abilità: una carta della tua mano non teme le riduzioni del Conte.",
      why: "Il Basilisco era già nel quarto I: ogni carta che vi posi dopo di lui perde 2. Il Tasso no, perché le abilità avversarie non possono ridurne la forza: nel I sale a 5 con il +1 del Cervo e stacca il Basilisco 10 a 5 (regge anche la Volpe, 3 +2 Astuzia −2). Nel II l'Arpia toglie il +1 delle tinture alle carte posate dopo di lei, ma il Leone d'oro sopra la Torre d'oro non lo avrebbe preso comunque: con il campo arriva a 7 e tiene il quarto anche dopo la Torre del Conte.",
    },
    {
      name: "Tre mosse", level: "Avanzata", turn: 4,
      fields: ["argento", "rovescio", "stretto", "rosso"],
      board: [
        { me: [["unicorno", 1]], foe: [["gallo", 2]] },
        { me: [["drago", 2]], foe: [["cigno", 1]] },
        { me: [["leone", 3]], foe: [["serpe", 3]] },
        { me: [["torre", 2]], foe: [["volpe", 3]] },
      ],
      hands: { me: ["fenice", "balena", "gallo", "grifone"], foe: ["gufo", "lupo", "delfino"] },
      goal: { win: true },
      goalText: "Vinci la partita in tre turni. A parità di corone vince la forza totale dello scudo.",
      hint: "Il Campo d'argento vale due corone. La Fenice rende di più dove stai perdendo, la Balena dove hai carte nei quarti accanto.",
      why: "Il Campo d'argento, quarto I, vale 2 corone ed è lì che si decide. La Fenice rinasce (+3) finché senza di lei il quarto andrebbe al Conte, quindi resta forte anche quando lui rinforza. Nel III, lo Stretto, la Balena prende fino a +2 dalla Corrente, perché hai carte nei quarti confinanti I e IV, e tiene il quarto contro il Delfino. Il quarto II è perso: sul Campo rovesciato il Drago è troppo forte. Finisce 3 corone a 3 e la parità si rompe sulla forza totale dello scudo, dove sei avanti.",
    },
  ];
  function goalMet(s, e = evaluate(s)) {
    const g = TRIALS[s.trial].goal;
    return (!g.quarters || g.quarters.every((q) => e.quarters[q].lead === "me")) && (!g.crowns || e.score.me >= g.crowns) && (!g.win || s.over === "me");
  }
  // trials are internal data, still checked as they load
  function validTrial(t) {
    const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
    if (!t || typeof t !== "object" || !isInt(t.turn, 4, TURNS)) return false;
    if (!Array.isArray(t.fields) || t.fields.length !== 4 || new Set(t.fields).size !== 4 || !t.fields.every((id) => FIELDS.some((f) => f.id === id))) return false;
    if (!Array.isArray(t.board) || t.board.length !== 4 || !t.hands || typeof t.hands !== "object") return false;
    for (const side of SIDES) {
      const laid = [];
      for (let q = 0; q < 4; q++) {
        const l = t.board[q] && t.board[q][side];
        if (!Array.isArray(l) || l.length > (t.fields[q] === "stretto" ? 2 : 3)) return false;
        if (!l.every((c) => Array.isArray(c) && c.length === 2 && own(BEASTS, c[0]) && isInt(c[1], 1, t.turn - 1))) return false;
        laid.push(...l.map((c) => c[0]));
      }
      const hand = t.hands[side];
      if (!Array.isArray(hand) || !hand.every((id) => own(BEASTS, id)) || hand.length < TURNS - t.turn + 1 || hand.length > 4) return false;
      // never two of a beast on one side
      if (new Set(laid.concat(hand)).size !== laid.length + hand.length) return false;
    }
    const g = t.goal;
    if (!g || typeof g !== "object" || Array.isArray(g)) return false;
    const keys = Object.keys(g);
    if (!keys.length || !keys.every((k) => ["quarters", "crowns", "win"].includes(k))) return false;
    if (g.quarters !== undefined && !(Array.isArray(g.quarters) && g.quarters.length && g.quarters.every((q) => isInt(q, 0, 3)))) return false;
    if (g.crowns !== undefined && !isInt(g.crowns, 1, 20)) return false;
    if (g.win !== undefined && g.win !== true) return false;
    if (t.editto !== undefined && typeof t.editto !== "boolean") return false;
    return ["name", "level", "goalText", "hint", "why"].every((k) => typeof t[k] === "string" && t[k].length < 600);
  }
  function trialGame(n) {
    const t = TRIALS[n];
    if (!Number.isInteger(n) || !validTrial(t)) return null;
    const card = ([id, at]) => ({ id, at, uid: 0 });
    const s = {
      seed: 0, trial: n, format: "prova", rand: rng(n + 1), turn: t.turn, uid: 0, over: null, last: null, log: [],
      fields: t.fields.map((id) => FIELDS.find((f) => f.id === id)),
      decks: { me: [], foe: [] }, hands: { me: [], foe: [] },
      board: t.board.map((sq) => ({ me: sq.me.map(card), foe: sq.foe.map(card) })),
      edict: t.editto ? { me: null, foe: null } : null,
    };
    s.board.forEach((sq) => SIDES.forEach((side) => sq[side].forEach((c) => (c.uid = ++s.uid))));
    for (const side of SIDES) s.hands[side] = t.hands[side].map((id) => ({ id, uid: ++s.uid }));
    s.pool = [...new Set(s.board.flatMap((sq) => SIDES.flatMap((side) => sq[side].map((c) => c.id))).concat(t.hands.me, t.hands.foe))];
    return s;
  }

  const api = { TINCT, BEASTS, FIELDS, HOUSES, HOUSE, FORMATS, TRIALS, COMMON, DRAFT_ORDER: ORDER, TURNS, QUARTERS, ROMAN, NEAR, SIDES, create, legal, cap, edictOpen, evaluate, choose, play, code, parseCode, draftTurn, draftLeft, draftChoice, pick, validTrial, goalMet };
  if (typeof module !== "undefined") module.exports = api;
  else root.Blasone = api;
})(this);
