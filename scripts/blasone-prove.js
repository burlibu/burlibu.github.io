// Prove dell'Araldo solver: for every trial, plays every sequence of your
// moves (card, quarter, Editto or not) against the Conte, who answers with
// no noise, and counts the ones that meet the goal. Proves each trial valid,
// solvable and deterministic; prints one solution and the share of winning
// lines. With -v, also prints the result of every first move.
// usage: node scripts/blasone-prove.js [n] [-v] [-a]  (-a prints every winning line)
const G = require("../public/designs/blasone/game.js");

const verbose = process.argv.includes("-v");
const all = process.argv.includes("-a");
const only = process.argv.find((a) => /^\d+$/.test(a));
const say = (s, m) => `${G.BEASTS[s.hands.me[m.i].id].name} ${G.ROMAN[m.q]}${m.edict ? "+E" : ""}`;
let bad = 0;

G.TRIALS.forEach((t, n) => {
  if (only && +only !== n + 1) return;
  if (!G.validTrial(t)) return console.log(`prova ${n + 1}: NON VALIDA`), bad++;
  // every move from a position: each card in each open quarter, with and without the Editto
  const moves = (s) => {
    const out = [];
    s.hands.me.forEach((c, i) => [0, 1, 2, 3].forEach((q) => {
      if (!G.legal(s, "me", q)) return;
      out.push({ i, q, edict: false });
      if (G.edictOpen(s, "me")) out.push({ i, q, edict: true });
    }));
    return out;
  };
  const replay = (line) => {
    const s = G.create(0, { trial: n });
    for (const m of line) G.play(s, m.i, m.q, G.choose(s, "foe", 0), m.edict);
    return s;
  };
  let wins = 0, total = 0, first = null;
  const best = [0, 0]; // most crowns without and with the Editto
  const byFirst = {};
  const walk = (line) => {
    const s = replay(line);
    if (s.over) {
      total++;
      const sc = G.evaluate(s).score.me, used = line.some((m) => m.edict);
      best[used ? 1 : 0] = Math.max(best[used ? 1 : 0], sc);
      const k = line.length ? say(replay([]), line[0]) : "";
      byFirst[k] = byFirst[k] || [0, 0];
      byFirst[k][1]++;
      if (s.goal) {
        wins++;
        byFirst[k][0]++;
        if (all) console.log("    vince: " + line.map((m, j) => say(replay(line.slice(0, j)), m) + " / " + replay(line.slice(0, j + 1)).log[0].foe).join(" · "));
        if (!first) first = line.map((m, j) => say(replay(line.slice(0, j)), m)).join(", ") + ` → ${G.evaluate(s).score.me}-${G.evaluate(s).score.foe}`;
      }
      return;
    }
    for (const m of moves(s)) walk(line.concat(m));
  };
  if (verbose) {
    const s0 = replay([]), e = G.evaluate(s0);
    for (const x of e.quarters) {
      const side = (k) => x[k].cards.map((c) => `${c.id} ${c.power}`).join(", ") || "—";
      console.log(`  ${G.ROMAN[x.q]} ${x.field.id.padEnd(8)} tu [${side("me")}] ${x.me.total} · conte [${side("foe")}] ${x.foe.total} → ${x.lead || "nessuno"} (${x.crowns})`);
    }
    console.log(`  mani: tu ${s0.hands.me.map((c) => c.id)} · conte ${s0.hands.foe.map((c) => c.id)} · corone ${e.score.me}-${e.score.foe}`);
  }
  walk([]);
  // determinism: the same line twice gives the same board
  const a = JSON.stringify(replay([]).board), b = JSON.stringify(replay([]).board);
  const ok = wins > 0 && a === b;
  if (!ok) bad++;
  console.log(`prova ${n + 1} ${t.name} (${t.level}): ${ok ? "OK" : "FAIL"} ${wins}/${total} linee vincenti${first ? " · es. " + first : ""}`);
  if (verbose) console.log(`    corone massime: ${best[0]} senza Editto, ${best[1]} con`);
  if (verbose) Object.entries(byFirst).forEach(([k, [w, tot]]) => console.log(`    ${k.padEnd(18)} ${w}/${tot}`));
});
process.exit(bad ? 1 : 0);
