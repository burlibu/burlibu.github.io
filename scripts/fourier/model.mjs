// Fourier series of four periodic signals (period 2π), DOM-free: the build, the page and
// node checks all read the same numbers. Each signal is a sum of terms amp·sin(nθ + phase).
export const HARMONICS = 7;

const odd = (n) => n % 2 === 1;
export const SIGNALS = {
  quadra: {
    name: "Onda quadra",
    f: (t) => (Math.sin(t) >= 0 ? 1 : -1),
    // mean of f² over a period, for the RMS error through Parseval
    power: 1,
    term: (n) => ({ amp: odd(n) ? 4 / (n * Math.PI) : 0, phase: 0 }),
  },
  dente: {
    name: "Dente di sega",
    f: (t) => {
      const u = (((t + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      return (u - Math.PI) / Math.PI;
    },
    power: 1 / 3,
    term: (n) => ({ amp: (2 * (n % 2 ? 1 : -1)) / (n * Math.PI), phase: 0 }),
  },
  triangolo: {
    name: "Onda triangolare",
    f: (t) => (2 / Math.PI) * Math.asin(Math.sin(t)),
    power: 1 / 3,
    term: (n) => ({ amp: odd(n) ? (8 / (Math.PI * Math.PI * n * n)) * ((n - 1) / 2 % 2 ? -1 : 1) : 0, phase: 0 }),
  },
  impulsi: {
    name: "Treno di impulsi",
    // a pulse a quarter of the period wide, centred on θ = 0, with its mean (1/4) taken out
    f: (t) => {
      const u = (((t % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
      return (Math.abs(u) < Math.PI / 4 ? 1 : 0) - 0.25;
    },
    power: 3 / 16,
    term: (n) => ({ amp: (2 / (n * Math.PI)) * Math.sin((n * Math.PI) / 4), phase: Math.PI / 2 }),
  },
};

export const termsOf = (key, count = HARMONICS) => {
  const out = [];
  for (let n = 1; n <= HARMONICS; n++) {
    const t = SIGNALS[key].term(n);
    out.push({ n, amp: n <= count && Math.abs(t.amp) > 1e-12 ? t.amp : 0, phase: t.phase });
  }
  return out;
};

export const partialSum = (terms, t) => terms.reduce((sum, { n, amp, phase }) => sum + amp * Math.sin(n * t + phase), 0);

// relative RMS error of the partial sum, from Parseval: ‖f − Sₙ‖² = ‖f‖² − Σ amp²/2
export const rmsError = (key, terms) => {
  const kept = terms.reduce((sum, { amp }) => sum + (amp * amp) / 2, 0);
  return Math.sqrt(Math.max(0, SIGNALS[key].power - kept) / SIGNALS[key].power);
};

// the largest value of |f| and of every partial sum, sampled, to scale the machine per signal
export const peakOf = (key) => {
  let peak = 0;
  for (let count = 1; count <= HARMONICS; count++) {
    const terms = termsOf(key, count);
    for (let i = 0; i < 720; i++) peak = Math.max(peak, Math.abs(partialSum(terms, (i / 720) * 2 * Math.PI)));
  }
  for (let i = 0; i < 720; i++) peak = Math.max(peak, Math.abs(SIGNALS[key].f((i / 720) * 2 * Math.PI)));
  return peak;
};

// Winding: g(t) wound round a circle at f turns per second; the centre of mass is
// (1/T)∫ g(t) e^{−2πift} dt, whose size peaks where f matches a frequency inside g.
export const WIND = {
  // a test signal: its mean 1 plus two tones, 2 Hz and 3 Hz, over a 4 s window; never negative,
  // so the wound curve is a radius drawn round the centre
  mean: 1,
  tones: [
    { f: 2, amp: 0.6 },
    { f: 3, amp: 0.4 },
  ],
  span: 4,
  range: [0.5, 4.5],
  g(t) {
    return this.tones.reduce((sum, { f, amp }) => sum + amp * Math.cos(2 * Math.PI * f * t), this.mean);
  },
};

// centre of mass of the curve g(t)·e^{−2πift} for t over the window
export const centroid = (f, samples = 800) => {
  let re = 0;
  let im = 0;
  for (let i = 0; i < samples; i++) {
    const t = ((i + 0.5) / samples) * WIND.span;
    const g = WIND.g(t);
    re += g * Math.cos(-2 * Math.PI * f * t);
    im += g * Math.sin(-2 * Math.PI * f * t);
  }
  return [re / samples, im / samples];
};
