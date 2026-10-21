// Tiny state-vector simulator for the /fcq lessons: complex numbers, one- and
// two-qubit states, the gates of the course notes (cap. 3), projective
// measurement and Bloch coordinates. Standard convention: |0> is the north
// pole, Z|0> = |0>. DOM-free so node can check it.

// complex numbers as [re, im]
export const C = (re, im = 0) => [re, im];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
export const scale = (a, s) => [a[0] * s, a[1] * s];
export const conj = (a) => [a[0], -a[1]];
export const abs2 = (a) => a[0] * a[0] + a[1] * a[1];
export const expi = (phi) => [Math.cos(phi), Math.sin(phi)];

const R = Math.SQRT1_2;
const ZERO = C(0), ONE = C(1), I = C(0, 1);

// single-qubit gates as 2x2 matrices, rows of complex entries, plus the
// Bloch-sphere rotation each one performs (axis, angle), up to a global phase
export const GATES = {
  X: { m: [[ZERO, ONE], [ONE, ZERO]], axis: [1, 0, 0], angle: Math.PI },
  Y: { m: [[ZERO, C(0, -1)], [I, ZERO]], axis: [0, 1, 0], angle: Math.PI },
  Z: { m: [[ONE, ZERO], [ZERO, C(-1)]], axis: [0, 0, 1], angle: Math.PI },
  H: { m: [[C(R), C(R)], [C(R), C(-R)]], axis: [R, 0, R], angle: Math.PI },
  S: { m: [[ONE, ZERO], [ZERO, I]], axis: [0, 0, 1], angle: Math.PI / 2 },
  T: { m: [[ONE, ZERO], [ZERO, expi(Math.PI / 4)]], axis: [0, 0, 1], angle: Math.PI / 4 },
};

export const apply1 = (m, [a, b]) => [add(mul(m[0][0], a), mul(m[0][1], b)), add(mul(m[1][0], a), mul(m[1][1], b))];

// |psi> = cos(theta/2)|0> + e^{i phi} sin(theta/2)|1>
export const fromAngles = (theta, phi) => [C(Math.cos(theta / 2)), scale(expi(phi), Math.sin(theta / 2))];

export function bloch([a, b]) {
  const ab = mul(conj(a), b);
  return [2 * ab[0], 2 * ab[1], abs2(a) - abs2(b)];
}

export function toAngles([x, y, z]) {
  const theta = Math.acos(Math.max(-1, Math.min(1, z)));
  let phi = Math.atan2(y, x);
  if (phi < 0) phi += 2 * Math.PI;
  // at the poles the phase is undefined; call it 0
  if (Math.sin(theta) < 1e-9) phi = 0;
  return [theta, phi];
}

// Rodrigues: rotate v by `angle` (right hand) around the unit `axis`
export function rotate(v, axis, angle) {
  const [kx, ky, kz] = axis, c = Math.cos(angle), s = Math.sin(angle);
  const dot = kx * v[0] + ky * v[1] + kz * v[2];
  const cross = [ky * v[2] - kz * v[1], kz * v[0] - kx * v[2], kx * v[1] - ky * v[0]];
  return [0, 1, 2].map((i) => v[i] * c + cross[i] * s + axis[i] * dot * (1 - c));
}

// ---------- two qubits: amplitudes of |00>, |01>, |10>, |11>, q0 written first ----------
export const BASIS = ["00", "01", "10", "11"];
export const ket00 = () => [ONE, ZERO, ZERO, ZERO];

export function applyOn(m, psi, q) {
  const out = psi.slice();
  // pairs of indices that differ only in qubit q (q0 is the high bit)
  const pairs = q === 0 ? [[0, 2], [1, 3]] : [[0, 1], [2, 3]];
  for (const [i, j] of pairs) [out[i], out[j]] = apply1(m, [psi[i], psi[j]]);
  return out;
}

// CNOT with the given control: flips the target where the control is 1
export function cnot(psi, control = 0) {
  const out = psi.slice();
  if (control === 0) [out[2], out[3]] = [psi[3], psi[2]];
  else [out[1], out[3]] = [psi[3], psi[1]];
  return out;
}

export const probs = (psi) => psi.map(abs2);

// Separable iff a00 a11 = a01 a10 (the notes' factorisation test, cap. 3.6.2).
// Twice the modulus of the difference is the concurrence: 0 separable, 1 a Bell state.
export const concurrence = (psi) => 2 * Math.sqrt(abs2(add(mul(psi[0], psi[3]), scale(mul(psi[1], psi[2]), -1))));

// Projective measurement of qubit q: returns the outcome and the collapsed, renormalised state.
export function measureQubit(psi, q, rand = Math.random) {
  const ones = q === 0 ? [2, 3] : [1, 3];
  const p1 = ones.reduce((s, i) => s + abs2(psi[i]), 0);
  const bit = rand() < p1 ? 1 : 0;
  const norm = Math.sqrt(bit ? p1 : 1 - p1);
  const state = psi.map((a, i) => (ones.includes(i) === !!bit ? scale(a, 1 / norm) : ZERO));
  return { bit, p: bit ? p1 : 1 - p1, state };
}

// Circuit columns: { q0: gate|null, q1: gate|null } or { cnot: control }.
// Returns the state after every column, starting from |00>.
export function run(columns) {
  const states = [ket00()];
  let psi = states[0];
  for (const col of columns) {
    if (col.cnot !== undefined) psi = cnot(psi, col.cnot);
    else {
      if (col.q0) psi = applyOn(GATES[col.q0].m, psi, 0);
      if (col.q1) psi = applyOn(GATES[col.q1].m, psi, 1);
    }
    states.push(psi);
  }
  return states;
}

// ---------- LaTeX for amplitudes and kets ----------
const near = (a, b) => Math.abs(a - b) < 1e-6;
const MAGS = [[1, ""], [R, "\\tfrac{1}{\\sqrt{2}}"], [0.5, "\\tfrac{1}{2}"], [Math.sqrt(3) / 2, "\\tfrac{\\sqrt{3}}{2}"]];
const magTex = (m) => (MAGS.find(([v]) => near(m, v)) || [0, m.toFixed(3).replace(/0+$/, "")])[1];

// sign and phase of a unit complex as a prefix: "+", "-", "+i", "-i" or "+e^{i...}"
function phaseTex(z) {
  const [re, im] = z;
  if (near(im, 0)) return re > 0 ? "+" : "-";
  if (near(re, 0)) return im > 0 ? "+i" : "-i";
  const deg = Math.round((Math.atan2(im, re) * 180) / Math.PI);
  return `+e^{i${piTex(deg)}}`;
}

// an angle in degrees as a multiple of pi when it is a multiple of 15 degrees, else in degrees
function piTex(deg) {
  if (deg % 15) return `(${deg}^\\circ)`;
  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  const d = gcd(Math.abs(deg), 180), num = deg / d, den = 180 / d;
  return `${num < 0 ? "-" : ""}${Math.abs(num) === 1 ? "" : Math.abs(num)}\\pi${den === 1 ? "" : `/${den}`}`;
}

// a state as a ket sum, pulling out a common modulus when all terms share it
export function ketTex(psi, labels) {
  const terms = psi.map((a, i) => ({ a, m: Math.sqrt(abs2(a)), label: labels[i] })).filter((t) => t.m > 1e-9);
  const common = terms.every((t) => near(t.m, terms[0].m)) ? terms[0].m : null;
  const body = terms
    .map((t, i) => {
      let p = phaseTex(scale(t.a, 1 / t.m));
      if (i === 0 && p.startsWith("+")) p = p.slice(1);
      const coef = common ? "" : magTex(t.m);
      // a generic phase reads better after the modulus: 0.479 e^{i40°}
      if (p.includes("e^")) return `${p[0]}${coef}${p.slice(1)}|${t.label}\\rangle`;
      return `${p}${coef}|${t.label}\\rangle`;
    })
    .join(" ");
  if (!common || near(common, 1)) return body;
  return `${magTex(common)}\\left(${body}\\right)`;
}

// a seeded generator, so demos can be replayed
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
