// Blasone engine checks, in node: Classico and Crepuscolo unchanged against
// the 0.0.6 engine and the Draft against the 0.0.7 one, the draft's
// validation and reproducibility, the trials' validation, the codes, the
// Rivalità di Casata and the rules of the Veglie and the Confini.
// Returns the result lines; run by scripts/blasone-check.js.
const path = require("path");
const { execSync } = require("child_process");
const G = require("../../public/designs/blasone/game.js");

module.exports = function engine() {
  const R = [];
  const ok = (n, c) => R.push((c ? "OK   " : "FAIL ") + n);

  // ---------- regression: the 0.0.6 engine and this one play the same games ----------
  const trace = (E, formats) => {
    let out = "";
    for (const format of formats)
      for (const editto of [false, true])
        for (let g = 0; g < 60; g++) {
          const s = E.create(7000 + g, { format, editto });
          while (E.draftTurn && E.draftTurn(s)) E.pick(s, E.draftChoice(s, "me", 0.35).id);
          while (!s.over) {
            const m = E.choose(s, "me");
            E.play(s, m.i, m.q, E.choose(s, "foe", 0.35), m.edict);
          }
          out += s.fields.map((f) => f.id) + "|" + s.board.map((b) => b.me.map((c) => c.id + c.at) + "/" + b.foe.map((c) => c.id + c.at)).join(";") + "|" + s.over + JSON.stringify(s.edict) + "\n";
        }
    return out;
  };
  const old = (rev) => {
    const src = execSync(`git show ${rev}:public/designs/blasone/game.js`, { cwd: path.join(__dirname, "../.."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const m = { exports: {} };
    new Function("module", src)(m);
    return m.exports;
  };
  try {
    ok("Classico e Crepuscolo identici alla 0.0.6 (240 partite)", trace(old("b643f40"), ["classico", "crepuscolo"]) === trace(G, ["classico", "crepuscolo"]));
    ok("Draft senza Rivalità identico alla 0.0.7 (120 partite)", trace(old("6f4a787"), ["draft"]) === trace(G, ["draft"]));
  } catch (e) {
    R.push("SKIP regressione: engine 0.0.6 o 0.0.7 non leggibile da git");
  }
  ok("codice 0.0.6 4242-rev: stessa modalità", JSON.stringify(G.parseCode("4242-rev")) === JSON.stringify({ seed: 4242, format: "crepuscolo", editto: true, conte: "variabile", rivalita: false }));

  // ---------- draft ----------
  const s = G.create(77, { format: "draft" });
  const other = G.BEASTS && Object.keys(G.BEASTS).find((id) => !s.draft.offer.includes(id));
  ok("draft: otto carte offerte, nessuna di base", s.draft.offer.length === 8 && s.draft.offer.every((id) => !G.COMMON.includes(id)));
  ok("draft: nessuna mossa prima delle scelte", !G.play(s, 0, 0) && !G.legal(s, "me", 0));
  ok("draft: id sconosciuto rifiutato", !G.pick(s, "manticora") && !G.pick(s, "__proto__") && !G.pick(s, "constructor"));
  ok("draft: bestia non offerta rifiutata", !G.pick(s, other));
  ok("draft: id non stringa rifiutato", !G.pick(s, { toString: () => s.draft.offer[0] }) && !G.pick(s, [s.draft.offer[0]]));
  ok("draft: il Conte non sceglie per te", !G.pick(s, s.draft.offer[0], 0.35, "foe"));
  const first = s.draft.offer[0];
  ok("draft: scelta valida accettata, il Conte risponde due volte", G.pick(s, first) && s.draft.picks.foe.length === 2);
  ok("draft: doppione rifiutato", !G.pick(s, first) && !G.pick(s, s.draft.picks.foe[0]));
  while (G.draftTurn(s)) G.pick(s, G.draftLeft(s)[0]);
  ok("draft: quattro scelte per lato, poi basta", s.draft.picks.me.length === 4 && s.draft.picks.foe.length === 4 && !G.pick(s, s.draft.offer[0]));
  ok(
    "draft: mazzi da sedici senza doppioni",
    G.SIDES.every((side) => {
      const all = s.decks[side].concat(s.hands[side].map((c) => c.id));
      return all.length === 16 && new Set(all).size === 16 && G.COMMON.every((id) => all.includes(id)) && s.draft.picks[side].every((id) => all.includes(id));
    })
  );
  ok("draft: ogni scelta del Conte spiegata", s.draft.notes.filter((n) => n.side === "foe").every((n) => typeof n.why === "string" && n.why.length > 20));
  // the same code and the same picks give the same draft and the same game
  const run = () => {
    const g = G.create(77, { format: "draft" });
    while (G.draftTurn(g)) G.pick(g, G.draftLeft(g)[G.draftLeft(g).length - 1], 2);
    while (!g.over) G.play(g, 0, [0, 1, 2, 3].find((q) => G.legal(g, "me", q)), G.choose(g, "foe", 2));
    return JSON.stringify([g.draft.notes, g.board, g.over]);
  };
  ok("draft: stesso codice e stesse scelte, stessa partita", run() === run());
  ok("draft: codice 77-dnp", G.code(s, "prudente") === "77-dnp" && G.parseCode("77-dnp").format === "draft");

  // ---------- trials ----------
  ok("prove: sei più due facoltative, tutte valide", G.TRIALS.length === 8 && G.TRIALS_SET === 6 && G.TRIALS.every((t) => G.validTrial(t)));
  ok("prove facoltative: con la Rivalità", G.TRIALS.slice(G.TRIALS_SET).every((t) => t.rivalita === true && G.create(0, { trial: G.TRIALS.indexOf(t) }).rivalry));
  const T = () => JSON.parse(JSON.stringify(G.TRIALS[0]));
  const broken = {
    "bestia sconosciuta": (t) => (t.hands.me[0] = "manticora"),
    "__proto__ come carta": (t) => (t.board[0].me = [["__proto__", 1]]),
    "bestia doppia su un lato": (t) => (t.hands.me[1] = "unicorno"),
    "troppe carte nel quarto": (t) => (t.board[2].foe.push(["leone", 1])),
    "carta posata nel turno in corso": (t) => (t.board[0].me[0][1] = 6),
    "turno fuori dai limiti": (t) => (t.turn = 2),
    "mano troppo corta": (t) => (t.hands.me = []),
    "mano troppo lunga": (t) => (t.hands.me = ["pavone", "salamandra", "gallo", "cervo", "lupo"]),
    "campo sconosciuto": (t) => (t.fields[0] = "porpora"),
    "campo doppio": (t) => (t.fields[1] = "oro"),
    "obiettivo sconosciuto": (t) => (t.goal = { eval: "alert(1)" }),
    "obiettivo vuoto": (t) => (t.goal = {}),
    "quarto obiettivo fuori dai limiti": (t) => (t.goal = { quarters: [4] }),
    "corone non intere": (t) => (t.goal = { crowns: "5" }),
    "testo non stringa": (t) => (t.why = { html: "<b>" }),
    "editto non booleano": (t) => (t.editto = "si"),
    "rivalità non booleana": (t) => (t.rivalita = 1),
  };
  for (const [name, f] of Object.entries(broken)) {
    const t = T();
    f(t);
    ok("prove: rifiutata con " + name, !G.validTrial(t));
  }
  ok("prove: indice fuori dai limiti -> nessuna partita", G.create(0, { trial: 8 }) === null && G.create(0, { trial: -1 }) === null && G.create(0, { trial: "1" }) === null);
  ok("prove: codici", G.parseCode("prova-2").trial === 1 && !G.parseCode("prova-0") && G.parseCode("prova-8").trial === 7 && !G.parseCode("prova-9") && !G.parseCode("prova-1x") && !G.parseCode("77-dxp"));
  const a = G.create(0, { trial: 1 }), b = G.create(0, { trial: 1 });
  G.play(a, 0, 0, G.choose(a, "foe", 0));
  G.play(b, 0, 0, G.choose(b, "foe", 0));
  ok("prove: deterministiche, obiettivo verificato dall'engine", JSON.stringify(a.board) === JSON.stringify(b.board) && a.over && a.goal === true);

  // ---------- the Compagnia delle Veglie ----------
  const board = (cards) => {
    const g = G.create(1, {});
    g.fields = ["argento", "argento", "argento", "argento"].map((id) => G.FIELDS.find((f) => f.id === id));
    g.board = [0, 1, 2, 3].map(() => ({ me: [], foe: [] }));
    for (const [q, side, id, at] of cards) g.board[q][side].push({ id, at, uid: 0 });
    return G.evaluate(g).quarters;
  };
  const power = (x, side, id) => x[side].cards.find((c) => c.id === id).power;
  ok("Basilisco: −2 alla carta posata dopo", power(board([[0, "foe", "basilisco", 1], [0, "me", "leone", 2]])[0], "me", "leone") === 6);
  ok("Basilisco: nessuna reazione nello stesso turno", power(board([[0, "foe", "basilisco", 2], [0, "me", "leone", 2]])[0], "me", "leone") === 8);
  ok("Basilisco: il Tasso lo ignora", power(board([[0, "foe", "basilisco", 1], [0, "me", "tasso", 2]])[0], "me", "tasso") === 4);
  ok("Arpia: toglie solo il +1 delle tinture", power(board([[0, "foe", "arpia", 1], [0, "me", "torre", 1], [0, "me", "lupo", 2]])[0], "me", "lupo") === 3);
  ok("Arpia: con l'Arpia posata dopo, le tinture restano", power(board([[0, "foe", "arpia", 3], [0, "me", "torre", 1], [0, "me", "lupo", 2]])[0], "me", "lupo") === 4);
  ok("Balena: +1 per quarto confinante con tue carte", power(board([[0, "me", "balena", 1], [1, "me", "torre", 1], [3, "me", "pavone", 1]])[0], "me", "balena") === 5);
  ok("Grifone: +2 se tieni entrambi i confinanti", power(board([[0, "me", "grifone", 1], [1, "me", "torre", 1], [2, "me", "pavone", 1]])[0], "me", "grifone") === 6);
  ok("Grifone: nulla con un confinante solo", power(board([[0, "me", "grifone", 1], [1, "me", "torre", 1], [2, "foe", "pavone", 1]])[0], "me", "grifone") === 4);

  // ---------- Rivalità di Casata ----------
  const ruled = (cards, rivalita = true, fields = ["argento", "argento", "argento", "argento"]) => {
    const g = G.create(1, { rivalita });
    g.fields = fields.map((id) => G.FIELDS.find((f) => f.id === id));
    g.board = [0, 1, 2, 3].map(() => ({ me: [], foe: [] }));
    for (const [q, side, id, at] of cards) g.board[q][side].push({ id, at, uid: 0 });
    return G.evaluate(g);
  };
  let e = ruled([[0, "me", "tasso", 1], [0, "me", "leone", 1], [0, "foe", "volpe", 1]]);
  ok("Rivalità: stessa casata sui due lati, +1 a chi conquista", e.quarters[0].rival === 1 && e.quarters[0].lead === "me" && e.score.me === 3);
  ok("Rivalità: regola spenta, nessuna corona", ruled([[0, "me", "tasso", 1], [0, "foe", "volpe", 1]], false).quarters[0].rival === 0);
  ok("Rivalità: il Bestiario non conta", ruled([[0, "me", "leone", 1], [0, "foe", "leone", 1]]).quarters[0].rival === 0);
  e = ruled([[0, "me", "tasso", 1], [0, "me", "orso", 2], [0, "foe", "volpe", 1], [0, "foe", "salamandra", 2]]);
  ok("Rivalità: due casate abbinate, una sola corona", e.quarters[0].rivalry.length === 2 && e.quarters[0].rival === 1 && G.prize(e.quarters[0], e.quarters[0].lead) === 3);
  ok("Rivalità: stessa casata da un lato solo, nulla", ruled([[0, "me", "tasso", 1], [0, "me", "volpe", 1], [0, "foe", "leone", 1]]).quarters[0].rival === 0);
  e = ruled([[0, "me", "unicorno", 1], [0, "me", "tasso", 2], [0, "foe", "drago", 1], [0, "foe", "volpe", 2]], true, ["rovescio", "oro", "verde", "nero"]);
  ok("Rivalità: sul Campo rovesciato va al totale più basso", e.quarters[0].lead === "me" && e.score.me === 2 && e.score.foe === 0);
  e = ruled([[0, "me", "torre", 1], [0, "me", "pavone", 2], [0, "foe", "volpe", 1]]);
  ok("Rivalità: separata da Torre e Pavone", e.quarters[0].crowns === 3 && e.quarters[0].rival === 1 && e.quarters[0].bonus.me === 0 && e.score.me === 4);
  e = ruled([[0, "me", "pavone", 1], [0, "me", "leone", 2], [0, "foe", "volpe", 1]]);
  ok("Rivalità: Pavone e Rivalità si sommano senza doppio conteggio", e.score.me === 2 + 1 + 1);
  ok("codice con Rivalità: 99-dnsr", G.code(G.create(99, { format: "draft", rivalita: true }), "standard") === "99-dnsr" && G.parseCode("99-dnsr").rivalita === true && G.parseCode("99-dns").rivalita === false);
  ok("codici con Rivalità malformati rifiutati", ["99-dnsrr", "99-dnrs", "99-dnsx", "99-dns r", "99-rr"].every((c) => !G.parseCode(c)));

  // ---------- the Draft with the Rivalità: the Confini join the offer ----------
  let confini = 0, blocked = 0;
  for (let g = 0; g < 300; g++) {
    const d = G.create(5000 + g, { format: "draft", rivalita: true });
    if (d.draft.offer.some((id) => G.HOUSE[id].id === "confini")) confini++;
    while (G.draftTurn(d)) if (!G.pick(d, G.draftChoice(d, "me", 2).id)) { blocked++; break; }
    if (!blocked && G.SIDES.some((side) => d.hands[side].length !== 4 || d.decks[side].length !== 12)) blocked++;
  }
  ok(`Draft con Rivalità: Confini offerti in ${confini}/300, nessun draft bloccato`, confini > 200 && blocked === 0);
  ok("Classico e Crepuscolo con Rivalità: nessuna carta dei Confini", [0, 1, 2, 3, 4].every((g) => ["classico", "crepuscolo"].every((format) => !G.create(g, { format, rivalita: true }).pool.some((id) => G.HOUSE[id].id === "confini"))));

  // ---------- the Compagnia dei Confini ----------
  ok("Pantera: +2 con una Rivalità nel quarto", power(board([[0, "me", "pantera", 1], [0, "foe", "tartaruga", 1]])[0], "me", "pantera") === 6);
  ok("Pantera: nulla senza Rivalità", power(board([[0, "me", "pantera", 1], [0, "foe", "leone", 1]])[0], "me", "pantera") === 4);
  ok("Stambecco: +2 solo in punta", power(board([[2, "me", "stambecco", 1]])[2], "me", "stambecco") === 5 && power(board([[0, "me", "stambecco", 1]])[0], "me", "stambecco") === 3);
  ok("Lontra: +1 per carta di un'altra casata, al massimo +2", power(board([[0, "me", "leone", 1], [0, "me", "lontra", 1], [0, "me", "volpe", 2]])[0], "me", "lontra") === 3 + 1 + 2);
  ok("Lontra: le carte dei Confini non contano", power(board([[0, "me", "pantera", 1], [0, "me", "lontra", 1]])[0], "me", "lontra") === 3);
  // board() plays at s.turn 1: a card laid on turn 1 is laid in the turn in course
  ok("Tartaruga: +2 se nessuna carta posata nel turno in corso", power(board([[0, "me", "tartaruga", 0], [0, "foe", "leone", 0]])[0], "me", "tartaruga") === 6);
  ok("Tartaruga: nulla con una posa nel turno in corso", power(board([[0, "me", "tartaruga", 0], [0, "foe", "leone", 1]])[0], "me", "tartaruga") === 4);
  ok("Tartaruga: nulla senza carte avversarie", power(board([[0, "me", "tartaruga", 0]])[0], "me", "tartaruga") === 4);
  // at the end the turn in course is the last: a card laid on turn VI stops it
  const end = G.create(0, { trial: 7 });
  G.play(end, 0, 0, G.choose(end, "foe", 0));
  G.play(end, 0, 0, G.choose(end, "foe", 0));
  ok("Tartaruga: a fine partita conta la posa del turno VI", end.over && G.evaluate(end).quarters[0].foe.cards[0].mods.every((m) => m.why !== "Pazienza"));
  return R;
};
