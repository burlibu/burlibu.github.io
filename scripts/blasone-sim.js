// Blasone balance runs: the engine's AI plays both sides over seeded games and
// prints, per beast, how often it is drawn and played and how often its
// quarter and its game are won, then the fields and the Editto.
// usage: node scripts/blasone-sim.js [config] [games]
// config words, joined by "-": "crepuscolo" or "draft" (format), "casuale"
// (draft picks at random instead of by the Conte's ranking), "editto" and
// "rivalita" (rules on; with the Rivalità the draft offers the Confini too),
// "conte=0.05" (the Conte's AI noise; you stay at 0.35), "name=N" (a power
// override, e.g. drago=7), "lab=ocg" (the Laboratorio with those modules).
// Seeds are 1000..1000+games, so runs are repeatable.
const G = require("../public/designs/blasone/game.js");

const cfg = process.argv[2] || "", N = +process.argv[3] || 400;
const labs = (cfg.match(/lab=([a-z]*)/) || [])[1];
const opts = { format: labs !== undefined ? "lab" : ["crepuscolo", "draft"].find((f) => cfg.includes(f)) || "classico", editto: cfg.includes("editto"), rivalita: cfg.includes("rivalita"), lab: labs };
const draftNoise = cfg.includes("casuale") ? 1000 : 0.35;
const noise = +(cfg.match(/conte=([0-9.]+)/) || [])[1];
for (const [, k, v] of cfg.matchAll(/([a-z]+)=([0-9]+)(?![.\d])/g)) if (G.BEASTS[k]) G.BEASTS[k].power = +v;

const st = {}, fields = {}, res = { me: 0, foe: 0, pari: 0 }, edicts = { me: [], foe: [] };
let crowns = 0, contested = 0, rivalCrowns = 0, rivalQuarters = 0;
// the Laboratorio's crowns: Presidio, Obiettivo, Ariete; wagers made and lost
const lab = { all: 0, presidio: 0, goal: 0, ariete: 0, bets: 0, lost: 0, vantaggio: 0, riparo: 0 };
const beast = (id) => (st[id] ||= { seen: 0, play: 0, win: 0, crowns: 0, game: 0, pow: 0 });
for (let g = 0; g < N; g++) {
  const s = G.create(1000 + g, opts);
  if (!s) throw new Error("configurazione non valida: " + cfg);
  while (G.draftTurn(s)) G.pick(s, G.draftChoice(s, "me", draftNoise).id, draftNoise);
  const seen = { me: new Set(), foe: new Set() };
  const look = () => G.SIDES.forEach((side) => s.hands[side].forEach((c) => seen[side].add(c.id)));
  while (!s.over) {
    look();
    const m = G.choose(s, "me");
    G.play(s, m.i, m.q, noise >= 0 ? G.choose(s, "foe", noise) : null, m.edict, m.bet);
  }
  res[s.over]++;
  G.SIDES.forEach((side) => seen[side].forEach((id) => beast(id).seen++));
  if (s.edict) G.SIDES.forEach((side) => s.edict[side] && edicts[side].push(s.edict[side]));
  const fin = G.evaluate(s);
  lab.goal += fin.goalSides.length;
  lab.all += fin.score.me + fin.score.foe;
  for (const x of fin.quarters) {
    lab.presidio += x.presidio.me + x.presidio.foe;
    if (x.lead) lab.goal += x.goal;
    for (const side of G.SIDES) {
      if (x.lead === side && x.extra[side].includes("Ariete")) lab.ariete++;
      for (const c of x[side].cards) {
        if (c.bet) lab.bets++;
        c.mods.forEach((m) => (m.why === "Scommessa persa" ? lab.lost++ : m.why.startsWith("Vantaggio") ? lab.vantaggio++ : m.why === "Riparo del Pellicano" ? lab.riparo++ : 0));
      }
    }
    if (x.me.cards.length && x.foe.cards.length) contested++;
    const won = x.lead ? G.prize(x, x.lead) : 0;
    if (x.rivalry.length) rivalQuarters++;
    if (x.lead) rivalCrowns += x.rival;
    crowns += won;
    const f = (fields[x.field.id] ||= { n: 0, contested: 0, me: 0, empty: 0 });
    f.n++;
    if (x.me.cards.length && x.foe.cards.length) f.contested++;
    if (!x.lead) f.empty++;
    if (x.lead === "me") f.me++;
    for (const side of G.SIDES) {
      for (const id of new Set(x[side].cards.map((c) => c.id))) {
        const r = beast(id);
        r.play++;
        if (x.lead === side) r.win++, (r.crowns += won);
      }
      x[side].cards.forEach((c) => (st[c.id].pow += c.power));
    }
  }
  for (const side of G.SIDES)
    if (s.over === side) new Set(s.board.flatMap((b) => b[side].map((c) => c.id))).forEach((id) => st[id].game++);
}

const pct = (a, b) => `${b ? Math.round((100 * a) / b) : 0}%`.padStart(4);
console.log(`${cfg || "classico"} · ${N} partite · tu ${pct(res.me, N)} conte ${pct(res.foe, N)} pari ${pct(res.pari, N)} · quarti contesi ${pct(contested, N * 4)} · corone/partita ${(crowns / N).toFixed(2)}${opts.rivalita ? ` · quarti in rivalità ${pct(rivalQuarters, N * 4)} · corone di rivalità/partita ${(rivalCrowns / N).toFixed(2)}` : ""}`);
Object.entries(st)
  .sort((a, b) => b[1].game / b[1].play - a[1].game / a[1].play)
  .forEach(([id, r]) =>
    console.log(`  ${id.padEnd(10)} pescata ${pct(r.seen, N * 2)}  giocata ${pct(r.play, N * 2)}  quarto vinto ${pct(r.win, r.play)}  partita vinta ${pct(r.game, r.play)}  forza media ${(r.pow / r.play).toFixed(1)}  corone ${(r.crowns / r.play).toFixed(2)}`)
  );
if (opts.format === "lab")
  console.log(`  laboratorio: corone/partita Presidio ${(lab.presidio / N).toFixed(2)} · Obiettivo ${(lab.goal / N).toFixed(2)} · Ariete ${(lab.ariete / N).toFixed(2)} (quota ${pct(lab.presidio + lab.goal + lab.ariete, lab.all)} di ${(lab.all / N).toFixed(2)} corone/partita) · scommesse ${lab.bets} perse ${lab.lost} · vantaggi/partita ${(lab.vantaggio / N).toFixed(2)} · ripari/partita ${(lab.riparo / N).toFixed(2)}`);
console.log("  campi:");
Object.entries(fields).forEach(([id, f]) =>
  console.log(`  ${id.padEnd(10)} contesi ${pct(f.contested, f.n)}  vuoti/pari ${pct(f.empty, f.n)}  a te ${pct(f.me, f.n)}`)
);
if (opts.editto)
  for (const side of G.SIDES) {
    const turns = [1, 2, 3, 4, 5, 6].map((t) => edicts[side].filter((e) => e.turn === t).length);
    console.log(`  editto ${side === "me" ? "tu   " : "conte"} usato ${pct(edicts[side].length, N)}  per turno ${turns.join(" ")}`);
  }
