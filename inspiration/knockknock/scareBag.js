// Plans a night at the house: which scare answers which knock.
//
// The rules, all checked by scareBag.test.js:
//   1. A night is 20 scares (then the grand finale). Every scare plays once a night, never twice.
//   2. ScaryFizzBuzz decides which knocks are scares and what kind (Boo, Scary, BooScary),
//      so each set gets exactly as many scares as the night has knocks of that kind.
//   3. Scripted knocks keep their scare (the vampire on knock 3, the second line on 15).
//   4. Scares marked "scripted" only ever play on their scripted knock; they are never drawn.
//   5. Scares you have never seen are drawn first, so every new night shows you something new.
//      Only when a set has run out of new ones does it bring back old favourites.
import { ScaryFizzBuzz } from "/fizzbuzz.34d8fe0a2794550d5344.js";

const KIND = { Boo: "boo", Scary: "scary", BooScary: "booscary" };

// The knock numbers of the next `count` scares after knock `from`, sorted by kind.
export function upcomingScareKnocks(from, count = 20) {
  const knocks = { boo: [], scary: [], booscary: [] };
  for (let n = from + 1, found = 0; found < count; n++) {
    const kind = KIND[ScaryFizzBuzz(n)];
    if (kind) { knocks[kind].push(n); found++; }
  }
  return knocks;
}

function shuffle(list, random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// sets:       { boo: [{ id, scripted? }, …], scary: […], booscary: […] }
// from:       the knock count the night starts after (0 for the first night)
// script:     { "3": "vampire", "15": "parade" }
// seenBefore: ids of scares this visitor has already met (on earlier nights or visits)
// Returns { schedule: { knockNumber: scare }, lastKnock }
export function drawNight(sets, { from = 0, count = 20, script = {}, seenBefore = new Set(), random = Math.random } = {}) {
  const knocks = upcomingScareKnocks(from, count);
  const schedule = {};
  for (const kind of Object.keys(knocks)) {
    const pool = sets[kind] || [];
    if (!pool.length) continue;
    const slots = [], used = new Set();
    for (const n of knocks[kind]) {                               // scripted knocks keep their scare
      const fixed = script[n] && pool.find((s) => s.id === script[n]);
      if (fixed) { schedule[n] = fixed; used.add(fixed.id); } else slots.push(n);
    }
    const drawable = pool.filter((s) => !s.scripted && !used.has(s.id));
    const fresh = shuffle(drawable.filter((s) => !seenBefore.has(s.id)), random);
    const old = shuffle(drawable.filter((s) => seenBefore.has(s.id)), random);
    let order = [...fresh, ...old];                               // new ones first
    if (!order.length) order = pool;                              // a set with nothing to draw: let scripted ones encore
    slots.forEach((n, i) => (schedule[n] = order[i % order.length]));
  }
  const all = Object.values(knocks).flat();
  return { schedule, lastKnock: all.length ? Math.max(...all) : from };
}
