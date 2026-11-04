// Checks the story data of public/designs/vetrata in node: every chip points at a real
// scene object, every combination of phase, break and username yields text and valid
// trips, and the untrusted inputs (username, hash, stored progress) are handled.
//   node scripts/vetrata-check.js
const assert = require("assert");
const STORY = require("../public/designs/vetrata/story.js");

const { PHASES, TECH, TARGETS, WHERE, ANCHORS, KINDS, cleanUser, parseHash, parseDone, wire, trips } = STORY;
const allWire = (i, ctx) => wire(PHASES[i], ctx).map((b) => b.text).join("\n");

assert.strictEqual(PHASES.length, 8, "8 fasi");
assert.strictEqual(new Set(PHASES.map((p) => p.id)).size, 8, "id unici");

for (const p of PHASES) {
  assert(p.title && p.story && p.cam && p.open && Array.isArray(p.fx), `${p.id}: campi`);
  assert(p.chips.length >= 4, `${p.id}: almeno 4 funzioni`);
  assert(p.breaks.length >= 1, `${p.id}: almeno un Rompilo`);
  assert(WHERE[p.ask.answer], `${p.id}: risposta valida`);
  assert(p.ask.q && p.ask.code && p.ask.why, `${p.id}: domanda completa`);
  for (const c of p.chips) {
    assert(TARGETS.includes(c.target), `${p.id}/${c.name}: target ${c.target}`);
    assert(TECH[c.tech], `${p.id}/${c.name}: tech ${c.tech}`);
    assert(WHERE[c.where], `${p.id}/${c.name}: where ${c.where}`);
    assert(c.does, `${p.id}/${c.name}: does`);
  }
  for (const broken of [null, ...p.breaks.map((b) => b.id)]) {
    for (const user of ["pippo", "mario", ""]) {
      const blocks = wire(p, { user, broken });
      assert(blocks.length && blocks.every((b) => b.title && b.text), `${p.id}/${broken}/${user}: wire`);
      for (const t of trips(p, { user, broken })) {
        assert(ANCHORS.includes(t.from) && ANCHORS.includes(t.to), `${p.id}: ancore ${t.from} ${t.to}`);
        assert(KINDS.includes(t.kind), `${p.id}: kind ${t.kind}`);
        assert(!t.tint || TECH[t.tint], `${p.id}: tint ${t.tint}`);
      }
    }
  }
}

// Slide values appear verbatim
const pippo = { user: "pippo", broken: null };
assert(allWire(5, pippo).includes("username=pippo&password=pippo123%21"), "corpo della POST dalle slide");
assert(allWire(2, pippo).includes("GET /login.php HTTP/1.1"), "riga iniziale");
assert(allWire(6, pippo).includes("Set-Cookie:") && allWire(6, pippo).includes("HttpOnly"), "Set-Cookie");
assert(allWire(7, pippo).includes("return response.json()"), "il return che la slide omette");

// Untrusted username
assert(allWire(5, { user: "a&b=c", broken: null }).includes("username=a%26b%3Dc"), "urlencode");
assert(allWire(7, { user: 'x"y', broken: null }), "wire con virgolette");
assert(allWire(5, { user: 'x"y', broken: null }).includes('"x\\"y"'), "stringa PHP mostrata con escape JSON");
assert.strictEqual(cleanUser("a".repeat(500)).length, 24, "lunghezza massima");
assert.strictEqual(cleanUser("a\u0000b\nc"), "abc", "caratteri di controllo");
assert.strictEqual(cleanUser(null), "", "null");
assert.strictEqual(trips(PHASES[5], { user: "", broken: null }).length, 0, "username vuoto: non parte nulla");
assert(allWire(5, { user: "", broken: null }).includes("preventDefault"), "username vuoto: fermato dal client");
assert(allWire(5, { user: "mario", broken: null }).includes("401"), "utente sconosciuto");
assert(!allWire(6, { user: "mario", broken: null }).includes("Set-Cookie: PHPSESSID"), "niente sessione senza login");

// Content-Length counts bytes, emoji included
const body = new URLSearchParams({ username: "😀", password: "pippo123!" }).toString();
assert(allWire(5, { user: "😀", broken: null }).includes(`Content-Length: ${Buffer.byteLength(body)}`), "Content-Length");

// Hash
assert.strictEqual(parseHash("#fase/1"), 0);
assert.strictEqual(parseHash("#fase/8"), 7);
assert.strictEqual(parseHash("#fase/99"), 0);
assert.strictEqual(parseHash("#fase/abc"), 0);
assert.strictEqual(parseHash("#fase/3x"), 0);
assert.strictEqual(parseHash(""), 0);
assert.strictEqual(parseHash("#riepilogo"), 8);

// Stored progress
assert.deepStrictEqual(parseDone("{x"), []);
assert.deepStrictEqual(parseDone(null), []);
assert.deepStrictEqual(parseDone('{"a":1}'), []);
assert.deepStrictEqual(parseDone('[1,99,"a",1,7,-1,2.5]'), [1, 7]);

console.log("vetrata: ok");
