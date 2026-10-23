// Laboratorio checks, in node: every format unchanged against the 0.0.8
// engine (Rivalità included) while the Laboratorio is off, each new beast
// once with its ability on and once off, the modules (Tre Regni, the
// Pellicano's shield, the Ariete's wager, Presidio, Obiettivo, Campo
// mutevole) and the validation of module lists and codes.
// Returns the result lines; run by scripts/blasone-check.js.
const path = require("path");
const { execSync } = require("child_process");
const G = require("../../public/designs/blasone/game.js");

module.exports = function lab() {
  const R = [];
  const ok = (n, c) => R.push((c ? "OK   " : "FAIL ") + n);

  // ---------- regression: with the Laboratorio off, the 0.0.8 games ----------
  const trace = (E) => {
    let out = "";
    for (const format of ["classico", "crepuscolo", "draft"])
      for (const rivalita of [false, true])
        for (let g = 0; g < 30; g++) {
          const s = E.create(9000 + g, { format, editto: g % 2 === 1, rivalita });
          while (E.draftTurn(s)) E.pick(s, E.draftChoice(s, "me", 0.35).id);
          while (!s.over) {
            const m = E.choose(s, "me");
            E.play(s, m.i, m.q, E.choose(s, "foe", 0.35), m.edict);
          }
          out += s.fields.map((f) => f.id) + "|" + s.board.map((b) => b.me.map((c) => c.id + c.at) + "/" + b.foe.map((c) => c.id + c.at)).join(";") + "|" + s.over + JSON.stringify(s.edict) + "\n";
        }
    return out;
  };
  try {
    const src = execSync("git show c485a59:public/designs/blasone/game.js", { cwd: path.join(__dirname, "../.."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = { exports: {} };
    new Function("module", src)(m);
    ok("Laboratorio spento: Classico, Crepuscolo e Draft, con e senza Rivalità, identici alla 0.0.8 (180 partite)", trace(m.exports) === trace(G));
  } catch (e) {
    R.push("SKIP regressione: engine 0.0.8 non leggibile da git");
  }

  // ---------- a board laid by hand ----------
  // cards: [q, side, id, at, bet]; fields default to the Campo d'argento,
  // which changes no strength
  const game = (labs, cards, o = {}) => {
    const s = G.create(1, { format: "lab", lab: labs });
    s.fields = (o.fields || ["argento", "argento", "argento", "argento"]).map((id) => G.FIELDS.find((f) => f.id === id));
    s.board = [0, 1, 2, 3].map(() => ({ me: [], foe: [] }));
    s.turn = o.turn || 6;
    for (const [q, side, id, at, bet] of cards) s.board[q][side].push({ id, at, uid: 0, ...(bet ? { bet: true } : {}) });
    return s;
  };
  const quarters = (labs, cards, o) => G.evaluate(game(labs, cards, o)).quarters;
  const power = (labs, cards, q, side, id, o) => quarters(labs, cards, o)[q][side].cards.find((c) => c.id === id).power;

  // ---------- Casata delle Ore ----------
  ok("Gazza: forza stampata pari, +2", power("o", [[0, "me", "gazza", 1]], 0, "me", "gazza") === 4);
  ok("Cavalletta: +2 in un turno pari, nulla in uno dispari", power("o", [[0, "me", "cavalletta", 2]], 0, "me", "cavalletta") === 4 && power("o", [[0, "me", "cavalletta", 3]], 0, "me", "cavalletta") === 2);
  ok("Civetta delle Ore: +1, +2, +1 per finestra", [1, 3, 6].map((at) => power("o", [[0, "me", "civetta", at]], 0, "me", "civetta")).join() === "3,4,3");
  ok("Picchio: +1 dopo una tua carta del turno prima", power("o", [[0, "me", "leone", 2], [0, "me", "picchio", 3]], 0, "me", "picchio") === 1 + 1 + 1);
  ok("Picchio: nulla se il turno prima non c'era", power("o", [[0, "me", "leone", 1], [0, "me", "picchio", 3]], 0, "me", "picchio") === 1 + 1);

  // ---------- Compagnia dei Colori ----------
  ok("Cardellino: +2 per carta d'oro, al massimo +4", power("c", [[0, "me", "cardellino", 1], [0, "me", "leone", 1], [0, "me", "torre", 1]], 0, "me", "cardellino") === 6);
  ok("Ermellino: +2 senza carte rosse avversarie", power("c", [[0, "me", "ermellino", 1], [0, "foe", "lupo", 1]], 0, "me", "ermellino") === 4 && power("c", [[0, "me", "ermellino", 1], [0, "foe", "gallo", 1]], 0, "me", "ermellino") === 2);
  ok("Gambero: +2 senza carte rosse avversarie", power("c", [[0, "me", "gambero", 1]], 0, "me", "gambero") === 5 && power("c", [[0, "me", "gambero", 1], [0, "foe", "drago", 1]], 0, "me", "gambero") === 3);
  ok("Tessitore: +1 a lui e alle tue carte verdi, non alle altre", power("c", [[0, "me", "serpe", 1], [0, "me", "tessitore", 2]], 0, "me", "serpe") === 3 && power("c", [[0, "me", "serpe", 1], [0, "me", "tessitore", 2]], 0, "me", "tessitore") === 3 && power("c", [[0, "me", "leone", 1], [0, "me", "tessitore", 2]], 0, "me", "leone") === 6);

  // ---------- Tre Regni ----------
  ok("Famiglie: ogni bestia ne ha una", Object.values(G.BEASTS).every((b) => G.FAMILIES[b.fam]));
  ok("Vantaggio: Volante su Terrestre, +1", power("g", [[0, "me", "aquila", 1], [0, "foe", "leone", 1]], 0, "me", "aquila") === 4 + 1 + 1);
  ok("Vantaggio: nessuno al contrario, né senza il modulo", power("g", [[0, "me", "leone", 1], [0, "foe", "aquila", 1]], 0, "me", "leone") === 6 + 2 && power("o", [[0, "me", "aquila", 1], [0, "foe", "leone", 1]], 0, "me", "aquila") === 5);
  ok("Vantaggio: una volta sola con più prede", power("g", [[0, "me", "squalo", 1], [0, "foe", "aquila", 1], [0, "foe", "gallo", 1]], 0, "me", "squalo") === 4 + 1 + 1);
  ok("Albatros, Squalo, Bufalo: +1 contro la loro preda", power("g", [[0, "me", "albatros", 1], [0, "foe", "lupo", 1]], 0, "me", "albatros") === 3 + 1 + 1 && power("g", [[0, "me", "bufalo", 1], [0, "foe", "delfino", 1]], 0, "me", "bufalo") === 4 + 1 + 1);
  ok("Pellicano: annulla un punto della Serpe", power("g", [[0, "me", "pellicano", 1], [0, "me", "leone", 2], [0, "foe", "serpe", 1]], 0, "me", "leone") === 6 - 1 + 1);
  ok("Pellicano: un punto solo contro Basilisco (−2)", power("g", [[0, "foe", "basilisco", 1], [0, "me", "pellicano", 2], [0, "me", "leone", 3]], 0, "me", "leone") === 6 - 2 + 1);
  ok("Pellicano: non annulla Drago e campi", power("g", [[0, "me", "pellicano", 1], [0, "me", "drago", 1], [0, "me", "leone", 2]], 0, "me", "leone") === 6 - 2 + 1 && power("g", [[0, "me", "pellicano", 1], [0, "me", "cigno", 2]], 0, "me", "cigno", { fields: ["nero", "argento", "argento", "argento"] }) === 1 - 1);

  // ---------- Compagnia della Giostra ----------
  ok("Cicogna: +2 se è la prima tua carta", power("q", [[0, "me", "cicogna", 1]], 0, "me", "cicogna") === 5 && power("q", [[0, "me", "leone", 1], [0, "me", "cicogna", 2]], 0, "me", "cicogna") === 3);
  ok("Lepre: +2 al turno VI in un quarto conteso", power("q", [[0, "foe", "leone", 1], [0, "me", "lepre", 6]], 0, "me", "lepre") === 5 && power("q", [[0, "me", "lepre", 6]], 0, "me", "lepre") === 3);
  ok("Pappagallo: +1 con più casate", power("q", [[0, "me", "pappagallo", 1], [0, "me", "leone", 1], [0, "foe", "lupo", 1]], 0, "me", "pappagallo") === 3 && power("q", [[0, "me", "pappagallo", 1], [0, "foe", "leone", 1], [0, "foe", "volpe", 1]], 0, "me", "pappagallo") === 2);
  let x = quarters("q", [[0, "me", "ariete", 1, true], [0, "foe", "lupo", 1]])[0];
  ok("Ariete: scommessa vinta, +1 corona solo per te", x.lead === "me" && x.extra.me.includes("Ariete") && G.prize(x, "me") === 2 + 1); // the Campo d'argento pays 2
  x = quarters("q", [[0, "me", "ariete", 1, true], [0, "foe", "drago", 1]])[0];
  ok("Ariete: scommessa persa, −2", x.lead === "foe" && x.me.cards[0].power === 2 && !x.extra.me.length);
  x = quarters("q", [[0, "me", "ariete", 1, true], [0, "foe", "lupo", 1], [0, "foe", "serpe", 2]])[0];
  ok("Ariete: in parità la scommessa è persa e il quarto passa all'avversario", x.lead === "foe" && x.me.cards[0].power === 1);
  x = quarters("q", [[0, "me", "ariete", 1], [0, "foe", "drago", 1]])[0];
  ok("Ariete: senza scommessa nessun effetto", x.me.cards[0].power === 4);
  const ar = G.create(3, { format: "lab", lab: "q", editto: true });
  ar.hands.me[0] = { id: "ariete", uid: 999 };
  ar.turn = 2;
  ok("Ariete: Scommessa ed Editto sulla stessa carta rifiutati", !G.play(ar, 0, 0, null, true, true));
  ok("Scommessa rifiutata su una carta che non è l'Ariete", (ar.hands.me[1].id === "ariete") || !G.play(ar, 1, 0, null, false, true));

  // ---------- Presidio ----------
  const pr = game("p", [[0, "me", "leone", 1]]);
  pr.hold[0] = { me: 5, foe: 0 };
  pr.hold[1] = { me: 4, foe: 2 };
  let e = G.evaluate(pr);
  ok("Presidio: +1 corona con 5 turni su 6, 0 con 4", e.quarters[0].presidio.me === 1 && e.quarters[1].presidio.me === 0 && e.score.me === 2 + 1);
  pr.hold[2] = { me: 0, foe: 5 };
  ok("Presidio: pagato anche senza conquistare il quarto", G.evaluate(pr).score.foe === 1);
  const ph = G.create(11, { format: "lab", lab: "p" });
  while (!ph.over) {
    const m = G.choose(ph, "me");
    G.play(ph, m.i, m.q, null, m.edict, m.bet);
  }
  ok("Presidio: al massimo un segnale per turno e per quarto", ph.hold.every((h) => h.me + h.foe <= G.TURNS));

  // ---------- Obiettivo di torneo ----------
  const ob = (id, cards) => {
    const s = game("b", cards, { turn: 2 });
    s.goal = { id, q: null, sides: null };
    s.hands.me = [{ id: "cigno", uid: 900 }];
    s.hands.foe = [{ id: "torre", uid: 901 }];
    s.turn = 2;
    return s;
  };
  let o1 = ob("punta", [[0, "me", "leone", 1]]);
  G.play(o1, 0, 2, { i: 0, q: 1 });
  ok("Obiettivo La prima punta: fissato sul quarto III, +1 a chi lo conquista", o1.goal.q === 2 && G.evaluate(o1).quarters[2].goal === 1 && G.prize(G.evaluate(o1).quarters[2], "me") === 2 + 1);
  o1 = ob("ovunque", [[0, "me", "leone", 1], [1, "me", "lupo", 1], [2, "me", "gallo", 1]]);
  G.play(o1, 0, 3, { i: 0, q: 0 });
  ok("Obiettivo Su tutto lo scudo: +1 al lato che arriva per primo", JSON.stringify(o1.goal.sides) === '["me"]' && G.evaluate(o1).goalSides.includes("me"));
  o1 = ob("sigillo", [[1, "me", "volpe", 1]]);
  o1.hands.foe = [{ id: "tasso", uid: 902 }];
  G.play(o1, 0, 0, { i: 0, q: 1 });
  ok("Obiettivo Il Sigillo: la stessa casata sui due lati fissa il quarto", o1.goal.q === 1);
  let draws = new Set();
  for (let g = 0; g < 60; g++) draws.add(G.create(g, { format: "lab", lab: "b" }).goal.id);
  ok("Obiettivo: i tre obiettivi escono", draws.size === 3);

  // ---------- Campo mutevole ----------
  let shifts = 0, bad = 0;
  for (let g = 0; g < 100; g++) {
    const s = G.create(g, { format: "lab", lab: "m" });
    const from = s.fields[s.shift.q].id, to = s.shift.to;
    if (!["oro", "rosso", "azzurro", "verde", "nero"].includes(from) || s.fields.some((f) => f.id === to)) bad++;
    else shifts++;
  }
  ok("Campo mutevole: sempre da una tintura a una tintura assente", shifts === 100 && bad === 0);
  const sm = game("m", [[0, "me", "gallo", 1]], { fields: ["rosso", "argento", "argento", "argento"], turn: 3 });
  sm.shift = { q: 0, to: "azzurro" };
  const before = G.evaluate(sm).quarters[0];
  sm.turn = G.SHIFT_TURN;
  const after = G.evaluate(sm).quarters[0];
  ok("Campo mutevole: dal turno IV vale il nuovo campo, anche per le carte già posate", before.field.id === "rosso" && before.me.cards[0].power === 2 + 1 + 2 && after.field.id === "azzurro" && after.me.cards[0].power === 2 + 2 && after.shift.done);

  // ---------- module lists and codes ----------
  ok("Moduli: liste valide", ["", "o", "ocg", "ocgqpm", "ocgqbm", "qb"].every((t) => G.validLab(t) === t));
  ok("Moduli: ordine sbagliato, doppioni, lettere ignote, Presidio con Obiettivo, non stringhe rifiutati", ["go", "oo", "oz", "pb", "ocgqpbm", "O", "o c", "toString", "__proto__"].every((t) => G.validLab(t) === null) && [null, 5, ["o"], { length: 1 }].every((t) => G.validLab(t) === null));
  ok("Laboratorio con moduli non validi: nessuna partita", G.create(1, { format: "lab", lab: "pb" }) === null && G.create(1, { format: "lab", lab: "zz" }) === null);
  const lc = G.create(12, { format: "lab", lab: "ocg", rivalita: true });
  ok("Codice del Laboratorio: 12-lnsr-ocg, e ritorno", G.code(lc, "standard") === "12-lnsr-ocg" && JSON.stringify(G.parseCode("12-lnsr-ocg")) === JSON.stringify({ seed: 12, format: "lab", editto: false, conte: "standard", rivalita: true, lab: "ocg" }));
  ok("Codice del Laboratorio senza moduli: 12-lns", G.code(G.create(12, { format: "lab" }), "standard") === "12-lns" && G.parseCode("12-lns").lab === "");
  ok("Codici con moduli malformati rifiutati", ["12-cns-o", "12-dns-o", "12-lns-pb", "12-lns-go", "12-lns-", "12-lns-o-c", "12-lns-oz"].every((c) => !G.parseCode(c)));
  const run = () => {
    const s = G.create(31, { format: "lab", lab: "ocgqpm", editto: true });
    while (!s.over) {
      const m = G.choose(s, "me");
      G.play(s, m.i, m.q, null, m.edict, m.bet);
    }
    return JSON.stringify([s.board, s.hold, s.shift, s.over]);
  };
  ok("Laboratorio: stesso codice e stesse mosse, stessa partita", run() === run());
  const pools = [0, 1, 2].map((g) => G.create(g, { format: "lab", lab: "oc" }).pool);
  ok("Laboratorio: sedici carte, solo Bestiario e casate attive", pools.every((p) => p.length === 16 && p.every((id) => ["base", "ore", "colori"].includes(G.HOUSE[id].id))));
  ok("Laboratorio senza casate: il pool del Classico", G.create(4, { format: "lab", lab: "pm" }).pool.join() === G.create(4, {}).pool.join());
  ok("Altri formati: nessuna carta del Laboratorio", [0, 1, 2, 3].every((g) => ["classico", "crepuscolo", "draft"].every((format) => {
    const s = G.create(g, { format, rivalita: g % 2 === 0 });
    return !s.pool.some((id) => G.HOUSES.find((h) => h.id === G.HOUSE[id].id).lab);
  })));
  return R;
};
