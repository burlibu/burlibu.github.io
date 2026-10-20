// Prisma Dash level solver: `node scripts/dash-solver.js [level]`
// Beam search over press/release decisions at 60 Hz (each held for 4 physics steps).
// Proves every level can be finished, reports coins and tight spots, and rewrites
// public/designs/dash/demos.js with the winning inputs used by the demo mode.
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "..", "public", "designs", "dash");
const D = require(path.join(dir, "game.js"));
const only = process.argv[2] !== undefined ? Number(process.argv[2]) : null;
const CAP = 3000, SUB = 4;

function key(s) {
  let u = 0;
  for (let i = 0; i < s.used.length; i++) if (s.used[i]) u = (u * 31 + i + 1) | 0;
  let c = 0;
  for (let i = 0; i < s.crumble.length; i++) if (s.crumble[i] >= 0) c++;
  return `${Math.round(s.y * 30)}|${Math.round(s.vy * 4)}|${s.mode}|${s.grav}|${s.dash ? 1 : 0}|${s.held ? 1 : 0}|${s.buffer > 0 ? 1 : 0}|${s.grounded ? 1 : 0}|${u}|${c}`;
}

function solve(li) {
  const L = D.compile(D.LEVELS[li]);
  const s0 = D.newState(L);
  s0.node = { p: null };
  let beam = [s0], won = null, steps = 0, lastDeaths = {};
  const tight = [];
  while (beam.length && steps++ < 60 * 180) {
    const next = new Map(), deaths = {};
    for (const s of beam)
      for (const held of [false, true]) {
        const c = D.clone(s);
        c.node = { p: s.node, h: held };
        c.events = [];
        for (let k = 0; k < SUB && !c.dead && !c.won; k++) D.step(L, c, held);
        if (c.dead) {
          const e = c.events.find((e) => e.type === "die");
          const why = `${e ? e.a : "?"}@${c.x.toFixed(1)},${c.y.toFixed(1)}`;
          deaths[why] = (deaths[why] || 0) + 1;
          continue;
        }
        c.events = null;
        if (c.won) {
          if (!won || c.coins > won.coins) won = c;
          continue;
        }
        const k = key(c), prev = next.get(k);
        if (!prev || c.coins > prev.coins) next.set(k, c);
      }
    let arr = [...next.values()];
    if (arr.length > CAP) {
      // keep the coin-richest half, and an even spread of the rest for variety
      arr.sort((a, b) => b.coins - a.coins || a.y - b.y);
      const top = arr.slice(0, CAP / 2), rest = arr.slice(CAP / 2), stride = rest.length / (CAP / 2);
      arr = top.concat(Array.from({ length: CAP / 2 }, (_, i) => rest[Math.floor(i * stride)]));
    }
    if (arr.length) {
      const b = Math.floor(arr[0].x / 4);
      if (!tight[b] || arr.length < tight[b].n) tight[b] = { n: arr.length, x: +arr[0].x.toFixed(1) };
    } else lastDeaths = deaths;
    beam = arr;
  }
  const name = `L${li + 1} ${D.LEVELS[li].name}`;
  if (!won) {
    const top = Object.entries(lastDeaths).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k}x${n}`).join("  ");
    console.log(`${name}: FAIL  deaths ${top}`);
    return null;
  }
  const missing = L.objs.filter((o) => o.t === "K" && !won.used[o.id]).map((o) => `(${o.cx},${o.cy})`).join(" ");
  const worst = tight.filter(Boolean).sort((a, b) => a.n - b.n).slice(1, 6).map((t) => `${t.x}:${t.n}`).join("  ");
  console.log(`${name}: OK  coins ${won.coins}/${L.coins} ${missing}  time ${won.t.toFixed(1)}s  tightest ${worst}`);
  const bits = [];
  for (let n = won.node; n.p; n = n.p) bits.push(n.h ? 1 : 0);
  bits.reverse();
  const runs = [];
  let cur = 0, len = 0;
  for (const b of bits) b === cur ? len++ : (runs.push(len), (cur = b), (len = 1));
  runs.push(len);
  return runs;
}

const out = path.join(dir, "demos.js");
const demos = (() => {
  try {
    const box = { Dash: {} };
    new Function("Dash", fs.readFileSync(out, "utf8"))(box.Dash);
    return box.Dash.DEMOS || [];
  } catch (e) {
    return [];
  }
})();
let ok = true;
D.LEVELS.forEach((_, li) => {
  if (only !== null && li !== only) return;
  const runs = solve(li);
  if (runs) demos[li] = runs;
  else ok = false;
});
fs.writeFileSync(
  out,
  "// Winning inputs found by scripts/dash-solver.js: run lengths at 60 Hz, alternating released/held.\n" +
    "// Regenerate them whenever a level changes.\nDash.DEMOS = " + JSON.stringify(demos) + ";\n"
);
process.exit(ok ? 0 : 1);
