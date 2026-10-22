// Blasone balance runs: the engine's AI plays both sides over seeded games and
// prints, per beast, how often it is played and how often its quarter and its
// game are won. usage: node scripts/blasone-sim.js [config] [games]
// config: "base" drops the four expansion beasts; "name=N" overrides a power,
// e.g. base-drago=7 or tasso=3-pavone=2.
const G = require("../public/designs/blasone/game.js");

const cfg = process.argv[2] || "", N = +process.argv[3] || 400;
const EXPANSION = ["volpe", "tasso", "fenice", "pavone"];
if (cfg.includes("base")) EXPANSION.forEach((k) => delete G.BEASTS[k]);
for (const [, k, v] of cfg.matchAll(/([a-z]+)=([0-9]+)/g)) G.BEASTS[k].power = +v;

const st = {}, res = { me: 0, foe: 0, pari: 0 };
let crowns = 0, contested = 0;
for (let g = 0; g < N; g++) {
  const s = G.create(1000 + g);
  while (!s.over) {
    const m = G.choose(s, "me");
    G.play(s, m.i, m.q);
  }
  res[s.over]++;
  for (const x of G.evaluate(s).quarters) {
    if (x.me.cards.length && x.foe.cards.length) contested++;
    const won = x.lead ? x.crowns + x.bonus[x.lead] : 0;
    crowns += won;
    for (const side of G.SIDES) {
      for (const id of new Set(x[side].cards.map((c) => c.id))) {
        const r = (st[id] ||= { play: 0, win: 0, crowns: 0, game: 0, pow: 0 });
        r.play++;
        if (x.lead === side) r.win++, (r.crowns += won);
      }
      x[side].cards.forEach((c) => (st[c.id].pow += c.power));
    }
  }
  for (const side of G.SIDES)
    if (s.over === side) new Set(s.board.flatMap((b) => b[side].map((c) => c.id))).forEach((id) => st[id].game++);
}

const pct = (a, b) => `${Math.round((100 * a) / b)}%`.padStart(4);
console.log(`${cfg || "espansione"} · ${N} partite · me ${pct(res.me, N)} conte ${pct(res.foe, N)} pari ${pct(res.pari, N)} · quarti contesi ${pct(contested, N * 4)} · corone/partita ${(crowns / N).toFixed(2)}`);
Object.entries(st)
  .sort((a, b) => b[1].game / b[1].play - a[1].game / a[1].play)
  .forEach(([id, r]) =>
    console.log(`  ${id.padEnd(9)} giocata ${pct(r.play, N * 2)}  quarto vinto ${pct(r.win, r.play)}  partita vinta ${pct(r.game, r.play)}  forza media ${(r.pow / r.play).toFixed(1)}  corone ${(r.crowns / r.play).toFixed(2)}`)
  );
