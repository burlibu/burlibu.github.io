// BB84 engine: photons prepared in one of two polarisation bases, measured by
// Bob in a random basis, sifted over a public channel, and checked for errors
// (QBER) against an optional eavesdropper. DOM-free, so node can run it
// (module.exports at the bottom).
(function (root) {
  const BASES = {
    rect: { name: "Rettilineare", sym: "+", angle: [0, 90], ket: ["|0⟩", "|1⟩"] },
    diag: { name: "Diagonale", sym: "×", angle: [45, 135], ket: ["|+⟩", "|−⟩"] },
  };
  const THRESHOLD = 0.11; // QBER above this: the channel is compromised
  const SAMPLE = 0.25; // share of the sifted key sacrificed to test errors

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

  // A photon is {basis, bit}. Measuring in the basis it was prepared in gives
  // its bit for sure; in the other basis the outcome is a coin toss.
  function measure(r, photon, basis) {
    return photon.basis === basis ? photon.bit : r() < 0.5 ? 0 : 1;
  }

  // n photons, each step driven by the same seeded rng so a seed replays exactly.
  //   eve:   chance that Eve intercepts a photon (0..1)
  //   noise: chance that the channel flips a photon's bit (decoherence, 0..1)
  function run({ n = 8, eve = 0, noise = 0, seed = 1 } = {}) {
    const r = rng(seed);
    const photons = [];
    for (let i = 0; i < n; i++) {
      const bit = r() < 0.5 ? 0 : 1;
      const aBasis = r() < 0.5 ? "rect" : "diag";
      let sent = { basis: aBasis, bit };
      let interception = null;
      if (r() < eve) {
        // Eve measures in her own basis and resends what she read.
        const eBasis = r() < 0.5 ? "rect" : "diag";
        const eBit = measure(r, sent, eBasis);
        // A wrong basis projects the photon irreversibly: the state collapses.
        interception = { basis: eBasis, bit: eBit, collapsed: eBasis !== aBasis };
        sent = { basis: eBasis, bit: eBit };
      }
      const flipped = r() < noise;
      if (flipped) sent = { basis: sent.basis, bit: 1 - sent.bit };
      const bBasis = r() < 0.5 ? "rect" : "diag";
      const bBit = measure(r, sent, bBasis);
      photons.push({ i, bit, aBasis, interception, flipped, bBasis, bBit });
    }
    return photons;
  }

  // Sifting and error check. Keeps the photons where the bases agree, then
  // compares a random sample of them to estimate the error rate.
  function sift(photons, seed = 1) {
    const r = rng(seed ^ 0x9e3779b9);
    const kept = photons.filter((p) => p.aBasis === p.bBasis);
    const pool = kept.map((p, k) => ({ p, k, s: r() })).sort((x, y) => x.s - y.s);
    const sampleSize = Math.floor(kept.length * SAMPLE);
    const sample = pool.slice(0, sampleSize).map((x) => x.p);
    const rest = pool.slice(sampleSize).map((x) => x.p);
    const errors = sample.filter((p) => p.bit !== p.bBit).length;
    const qber = sampleSize ? errors / sampleSize : 0;
    return {
      sifted: kept.length,
      sampleSize,
      errors,
      qber,
      compromised: qber > THRESHOLD,
      // what remains of the key, in the order sent: Alice's bits and Bob's bits
      keyA: rest.map((p) => p.bit),
      keyB: rest.map((p) => p.bBit),
    };
  }

  // One-time pad: XOR each message byte's bits with the key, bit by bit.
  function otp(bytes, key) {
    const bits = [];
    for (const b of bytes) for (let k = 7; k >= 0; k--) bits.push((b >> k) & 1);
    if (bits.length > key.length) return null;
    return bits.map((b, i) => b ^ key[i]);
  }

  const api = { BASES, THRESHOLD, SAMPLE, rng, run, sift, otp };
  if (typeof module !== "undefined") module.exports = api;
  else root.BB84 = api;
})(this);
