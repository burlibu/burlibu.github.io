// Biplano: a training biplane on a gimbal test stand, built with the anatomy kit's
// 3D mode. `node scripts/biplano/build.mjs` writes public/designs/biplano/index.html;
// `--audit` runs the kit and orbit audits, `--quick` undersamples them.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../anatomy/kit/iso-kit.mjs";
import * as G from "../anatomy/kit/lathe.mjs";
import * as A from "../anatomy/kit/audit.mjs";
import { turning } from "../anatomy/kit/turn-build.mjs";
import * as TA from "../anatomy/kit/turn-audit.mjs";
import { kitScript, turnScript } from "../anatomy/scripts/inline-kit.mjs";
import { tubePieces, tubeSvg } from "../anatomy/kit/tube.mjs";
import { MODEL } from "./model.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "public", "designs", "biplano");
const argv = process.argv.slice(2);

const WIDTH = 700;
const HEIGHT = 520;
const AZIMUTH = 58;
const ELEVATION = 30;

// Ground: base plate, stand, console
const BASE = { x: -96, y: -42, w: 150, d: 188, r: 9 };
const BASE_H = 12;
const FOOT_H = 5;
const XC = 12; // pivot station, near the wings' quarter chord
const ZR = 53; // roll axis
const ZP = 66; // pitch axis
const CONSOLE = { x: -80, y: 104, w: 66, d: 34, r: 3 };
const CONSOLE_H = 20;

// Aircraft (world units, nose toward +x, left wing toward +y)
const ZW0 = 72; // lower wing underside
const CHORD = 36;
const LOWER_LE = 22;
const UPPER_LE = 30; // stagger
const GAP = 40;
const ZU = ZW0 + GAP; // upper wing underside
const SPAN = 88; // half span
const AIL_IN = 50;
const AIL_CHORD = 9.6;
const THICK = 0.117;
const FUS_R = 10;

export const P = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [LOWER_LE, -SPAN, ZU + 5], [UPPER_LE, SPAN, ZU + 5], [-100, 0, 120], [70, 0, 120], [70, 0, 55]],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: AZIMUTH, elevation: ELEVATION },
);
const at = (p) => k.iso(p, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
const fr = (o, a, u) => {
  const axis = G.unit3(a);
  const uu = u ? G.unit3(G.sub3(u, G.mul3(axis, G.dot3(u, axis)))) : G.frameAlong(o, axis).u;
  return { o, a: axis, u: uu, v: G.cross3(axis, uu) };
};
const VERT = (x, y) => fr([x, y, 0], [0, 0, 1], [1, 0, 0]);
const ALONG_X = (y, z) => fr([0, y, z], [1, 0, 0], [0, 0, 1]);
const ALONG_Y = (x, z) => fr([x, 0, z], [0, 1, 0], [0, 0, 1]);
// a section drawn in the x–z plane and extruded along y: F maps [u, v] = [z, x]
const SPANWISE = { o: [0, 0, 0], a: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] };
const sec = (points) => points.map(([x, z]) => [z, x]);

// Flat-bottomed (Clark Y like) wing section: height above the flat underside at ξ = x/c
const hOf = (xi, t = THICK) => 2 * 5 * t * (0.2969 * Math.sqrt(xi) - 0.126 * xi - 0.3516 * xi ** 2 + 0.2843 * xi ** 3 - 0.1015 * xi ** 4);
const H_MAX = CHORD * Math.max(...Array.from({ length: 101 }, (_, i) => hOf(i / 100)));
const ZF = ZW0 + H_MAX + FUS_R; // fuselage axis: its belly rests on the lower wing's crest
const topOf = (le, z0, x, c = CHORD, t = THICK) => z0 + c * hOf(Math.min(1, Math.max(0, (le - x) / c)), t);
const airfoil = (le, z0, cut = 1, c = CHORD, t = THICK, n = 16) => {
  const top = Array.from({ length: n + 1 }, (_, i) => {
    const xi = cut * (1 - Math.cos((i / n) * (Math.PI / 2))) ** 1.15;
    return [le - xi * c, z0 + c * hOf(xi, t)];
  });
  return sec([[le, z0], ...top.slice(1), [le - cut * c, z0]]);
};

export const R = A.recorder(P);
const put = (item) => R.put({ ...item, shapes: item.shapes.map((shape, index) => R.solid(Object.assign(shape, { name: shape.name ?? (index ? `${item.name}#${index + 1}` : item.name) }))) });

// ---------- static ground (back layer) ----------
function base() {
  for (const [x, y] of byDepth(k.corners(BASE, 22))) {
    const svg = S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }) + S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), { tone: "mid" });
    put({ name: `stand.foot.${x}.${y}`, layer: "back", at: [x, y, -BASE_H - FOOT_H], svg, shapes: [A.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, { ground: true }), A.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6)] });
  }
  const screws = k.corners(BASE, 9);
  const strip = { x: BASE.x + 16, y: BASE.y + BASE.d - 13, w: 96, d: 7, r: 1 };
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 4, 5, strip.y + 0.8, 0.6, [2, 3.6], P);
  const label = { x: BASE.x + BASE.w - 44, y: BASE.y + BASE.d - 40, w: 32, d: 24, r: 1.6 };
  const rules = [[label.x + 5, label.x + 29], [label.x + 5, label.x + 23], [label.x + 5, label.x + 26]].map(([x0, x1], i) => L(k.lineOnTop([x0, label.y + 8 + i * 5], [x1, label.y + 8 + i * 5], 0.8, P), { tone: "lo", free: true })).join("");
  const svg = [
    S(k.slabOf(BASE, -BASE_H, BASE_H, P, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 4, P, 8), { tone: "faint" }) }),
    L(k.planOutline(k.insetPlan(BASE, 5), 0, P), { tone: "lo" }),
    L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), { tone: "lo" }),
    D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }),
    S(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }),
    L(ticks.minor, { tone: "lo" }),
    L(ticks.major, { tone: "mid" }),
    S(k.slabOf(label, 0, 0.8, P, 4), { tone: "lo", crease: "none" }),
    L(k.planOutline(k.insetPlan(label, 1.6), 0.8, P), { tone: "faint" }),
    rules,
    D([at([label.x + 2.6, label.y + 2.6, 0.8]), at([label.x + label.w - 2.6, label.y + label.d - 2.6, 0.8])], { size: 0.45 }),
    // the aircraft's shadow on the plate, kept on the plate
    `<clipPath id="bp-plate"><path d="${k.planOutline(k.insetPlan(BASE, 2), 0, P)}"/></clipPath><g clip-path="url(#bp-plate)"><path class="iso-halo bp-shadow" d="${k.haloOf({ x: -14, y: -SPAN, w: 36, d: 2 * SPAN, r: 8 }, 0, 0.1, P)}${k.haloOf({ x: -90, y: -12, w: 150, d: 24, r: 10 }, 0, 0.1, P)}"/></g>`,
  ].join("");
  put({ name: "stand.base", layer: "back", at: [0, 0, -BASE_H], bias: 4, svg, shapes: [A.slab(BASE, -BASE_H, BASE_H, { ground: true })] });
}

// the control cable: from the console's side to a junction box at the stand, lying on the plate
const BOX = { x: -8, y: 4, w: 10, d: 10, r: 1.2 };
const CABLE_R = 1.1;
function cable() {
  const box = k.slabOf(BOX, 0, 6, P, 3, 0.4);
  const screws = [[BOX.x + 2, BOX.y + 2], [BOX.x + BOX.w - 2, BOX.y + BOX.d - 2]];
  put({ name: "stand.junction", layer: "back", at: [BOX.x + BOX.w / 2, BOX.y + BOX.d / 2, 0], svg: S(box, { tone: "mid", inner: L(k.sideSeam(BOX, 1.6, P, 3), { tone: "faint" }) }) + D(screws.map(([x, y]) => at([x, y, 6])), { size: 0.42 }), shapes: [A.slab(BOX, 0, 6)] });
  const X = BOX.x + BOX.w / 2;
  const route = G.fillet([[CONSOLE.x + CONSOLE.w, 116, CABLE_R], [X, 116, CABLE_R], [X, BOX.y + BOX.d, CABLE_R]], 10 * CABLE_R, 12);
  for (const piece of tubePieces(route, CABLE_R, P, { maxLength: 40 })) put({ name: R.nameFor("stand.cable"), layer: "back", at: piece.mid, svg: tubeSvg(piece, { tone: "mid" }), shapes: [A.tube(piece.points, CABLE_R, { owner: "stand.cable", limp: true })] });
  R.route("stand.cable", route, CABLE_R, { limp: true, owner: "stand.cable", touch: ["stand.base"] });
}

// ---------- the turning scene ----------
export const T = turning(P, { recorder: R });
const plane = T.layer("plane");
const desk = T.layer("desk");
T.stack(["back", "mid", "plane", "desk"]);

const roll = T.group("roll", { hinge: { point: [XC, 0, ZR], axis: [1, 0, 0], range: [-12, 12] } });
const pitch = T.group("pitch", { parent: roll, hinge: { point: [XC, 0, ZP], axis: [0, -1, 0], range: [0, 18] } });

// stand: post, saddle block (static parts sorted with the aircraft)
T.round({ name: "stand.collar", layer: plane, F: VERT(XC, 0), s0: 0, s1: 4, r: 8, tone: "mid", details: { bolts: [{ s: 4, r: 6.2, count: 6, size: 0.45, phase: 0.3 }] } });
T.round({ name: "stand.post", layer: plane, F: VERT(XC, 0), s0: 4, s1: 44, r: 3.6, tone: "mid", details: { seams: [30] } });
T.prism({ name: "stand.saddle", layer: plane, plan: { x: XC - 8, y: -6, w: 16, d: 12, r: 1.5 }, z: 44, h: ZR - 4.5 - 44, steps: 3, bevel: 0.4, tone: "mid", material: "gunmetal", details: { dots: [[XC - 5.5, 0], [XC + 5.5, 0]].map(([x, y]) => ({ at: [ZR - 4.5, x, y], normal: [0, 0, 1], size: 0.42 })) } });

// gimbal: roll barrel, plate and ears
const ROLL_R = 4.5;
T.round({ name: "roll.barrel", group: roll, layer: plane, F: ALONG_X(0, ZR), s0: XC - 8, s1: XC + 8, r: ROLL_R, tone: "hi", crease: "lo", material: "steel", details: { seams: [XC - 6.8, XC + 6.8], bolts: [{ s: XC + 8, r: 2.6, count: 4, size: 0.4, phase: 0.4 }] } });
T.prism({ name: "roll.plate", group: roll, layer: plane, plan: { x: XC - 5.5, y: -7, w: 11, d: 14, r: 1 }, z: ZR + ROLL_R, h: 2.5, steps: 2, bevel: 0.3, tone: "mid", material: "gunmetal" });
for (const [side, y0] of [["l", 4], ["r", -6.5]]) {
  T.prism({ name: `roll.ear.${side}`, group: roll, layer: plane, plan: { x: XC - 4, y: y0, w: 8, d: 2.5, r: 0.6 }, z: ZR + ROLL_R + 2.5, h: ZP + 4 - (ZR + ROLL_R + 2.5), steps: 2, bevel: 0.25, tone: "mid", material: "gunmetal", details: { dots: [{ at: [ZP, XC, y0 + (side === "l" ? 2.5 : 0)], normal: [0, side === "l" ? 1 : -1, 0], size: 0.5 }] } });
}

// pitch knuckle and lug: the aircraft hangs on these
T.round({ name: "pitch.knuckle", group: pitch, layer: plane, F: ALONG_Y(XC, ZP), s0: -4, s1: 4, r: 3.5, tone: "hi", material: "chrome" });
T.prism({ name: "pitch.lug", group: pitch, layer: plane, plan: { x: XC - 3, y: -3.6, w: 6, d: 7.2, r: 0.6 }, z: ZP + 3.5, h: ZW0 - ZP - 3.5, steps: 2, tone: "mid", material: "gunmetal" });

const PL = { group: pitch, layer: plane };

// wings: fabric over ribs, one rib every 11 units, stitched lines on the covering
const ribs = (a, b) => Array.from({ length: 17 }, (_, i) => -88 + 11 * i).filter((y) => y > a + 1 && y < b - 1);
const LOWER_CUT = 1 - AIL_CHORD / CHORD; // where the aileron hinge face sits, as a fraction of chord
const hingeX = LOWER_LE - LOWER_CUT * CHORD; // trailing face of the fixed lower wing
const hingeH = CHORD * hOf(LOWER_CUT);
const AIL_KR = hingeH / 2;
const upperWing = T.prism({ name: "wing.upper", ...PL, F: SPANWISE, polygon: airfoil(UPPER_LE, ZU), s0: -SPAN, s1: SPAN, tone: "hi", crease: "lo", bevel: 0.5, details: { seams: ribs(-SPAN, SPAN) } });
const lowerWing = T.prism({ name: "wing.lower", ...PL, F: SPANWISE, polygon: airfoil(LOWER_LE, ZW0), s0: -AIL_IN, s1: AIL_IN, tone: "hi", crease: "lo", bevel: 0.5, details: { seams: ribs(-AIL_IN, AIL_IN).filter((y) => Math.abs(y) > FUS_R + 2) } });
for (const [side, s0, s1] of [["l", AIL_IN, SPAN], ["r", -SPAN, -AIL_IN]]) {
  T.prism({ name: `wing.lower.${side}`, ...PL, F: SPANWISE, polygon: airfoil(LOWER_LE, ZW0, LOWER_CUT), s0, s1, tone: "hi", crease: "lo", bevel: 0.5, details: { seams: ribs(s0, s1) } });
  const g = T.group(`ail.${side}`, { parent: pitch, hinge: { point: [hingeX - AIL_KR, 0, ZW0 + AIL_KR], axis: [0, 1, 0], range: [-18, 18] } });
  const pad = 0.6;
  T.round({ name: `ail.${side}.knuckle`, group: g, layer: plane, F: ALONG_Y(hingeX - AIL_KR, ZW0 + AIL_KR), s0: s0 + pad, s1: s1 - pad, r: AIL_KR, tone: "hi", lit: true });
  const back = LOWER_LE - CHORD;
  const xs = hingeX - 2 * AIL_KR;
  T.prism({ name: `ail.${side}.body`, group: g, layer: plane, F: SPANWISE, polygon: sec([[xs, ZW0 + AIL_KR - AIL_KR * 0.98], [xs, ZW0 + AIL_KR + AIL_KR * 0.98], [back, ZW0 + AIL_KR + 0.25], [back, ZW0 + AIL_KR - 0.25]]), s0: s0 + pad, s1: s1 - pad, tone: "hi", crease: "lo", lit: true });
}

// wool tufts on the crest of both wings: they stream aft in attached flow and flick forward
// when the flow separates at the stall (the page swaps the two sets)
const tuftSvg = (ys) => {
  const calm = ys.map((y) => `M0 ${y}L-5 ${(y + 0.3).toFixed(2)}`).join("");
  const torn = ys.map((y, i) => `M0 ${y}C1.6 ${(y + (i % 2 ? 1.6 : -1.6)).toFixed(2)} 3.2 ${(y + (i % 2 ? -0.6 : 0.8)).toFixed(2)} 3.6 ${(y + (i % 2 ? 0.9 : -1)).toFixed(2)}`).join("");
  const roots = ys.map((y) => `M-0.35 ${y}a.35 .35 0 1 0 .7 0a.35 .35 0 1 0 -.7 0`).join("");
  return `<g class="bp-tufts"><path class="iso-line bp-tuft-calm" data-tone="mid" data-free="end" d="${calm}"/><path class="iso-line bp-tuft-torn" data-tone="mid" data-free="end" d="${torn}"/><path class="iso-line" data-tone="lo" d="${roots}"/></g>`;
};
const CREST = 0.3;
const tuftYs = (from, to) => Array.from({ length: 40 }, (_, i) => -84 + 8.4 * i).filter((y) => y > from && y < to && Math.abs(y) > FUS_R + 3).map((y) => +y.toFixed(1));
T.plane({ part: upperWing, o: [UPPER_LE - CREST * CHORD, 0, ZU + H_MAX + 0.05], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1], svg: tuftSvg(tuftYs(-SPAN + 2, SPAN - 2)) });
T.plane({ part: lowerWing, o: [LOWER_LE - CREST * CHORD, 0, ZW0 + H_MAX + 0.05], u: [1, 0, 0], v: [0, 1, 0], normal: [0, 0, 1], svg: tuftSvg(tuftYs(-AIL_IN + 2, AIL_IN - 2)) });

// fuselage
const FUS = ALONG_X(0, ZF);
T.round({ name: "fus.cowl", ...PL, F: FUS, s0: 38, s1: 60, r: [FUS_R, 8.6], tone: "hi", crease: "lo", material: "steel", details: { seams: [44], bolts: [{ s: 59.2, r: 8.65, count: 14, size: 0.4 }] } });
T.round({ name: "fus.nose", ...PL, F: FUS, s0: 60, s1: 61.5, r: 5.2, tone: "mid", material: "gunmetal" });
T.round({
  name: "fus.front",
  ...PL,
  F: FUS,
  s0: -12,
  s1: 38,
  r: FUS_R,
  tone: "hi",
  crease: "lo",
  details: {
    seams: [30],
    rings: [
      { at: [16, FUS_R, 0], normal: [0, 0, 1], r: 4.4, tone: "mid" },
      { at: [-17, FUS_R, 0], normal: [0, 0, 1], r: 4.4, tone: "mid" },
    ],
  },
});
T.round({ name: "fus.rear", ...PL, F: FUS, s0: -60, s1: -12, r: [5, FUS_R], tone: "hi", crease: "lo", details: { seams: [-36] } });
T.round({ name: "fus.boom", ...PL, F: FUS, s0: -88, s1: -60, r: 5, tone: "hi", crease: "lo" });
T.round({ name: "fus.exhaust", ...PL, F: ALONG_X(FUS_R + 1.2, ZF), s0: 4, s1: 38, r: 1.2, tone: "mid", material: "gunmetal" });
for (const [name, x] of [["screen.front", 22.4], ["screen.rear", -10.6]]) {
  T.prism({ name: `fus.${name}`, ...PL, F: SPANWISE, polygon: sec([[x, ZF + FUS_R], [x - 0.6, ZF + FUS_R], [x - 2.2, ZF + FUS_R + 3.6], [x - 1.6, ZF + FUS_R + 3.6]]), s0: -2.4, s1: 2.4, tone: "lo", material: "chrome" });
}

// struts and wires: each end is seated rim-on-surface, touching at one point and sunk nowhere
const seat = (p, d, r, f, side, eps = 0.02, rim = null) => {
  const F = G.frameAlong(p, d);
  const g = (t) => {
    let least = Infinity;
    const points = rim ? rim(t) : Array.from({ length: 72 }, (_, j) => G.pointOf(F, t, r, (j / 72) * Math.PI * 2));
    for (const q of points) least = Math.min(least, side * (q[2] - f(q[0], q[1])));
    return least - eps;
  };
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (g(mid) * Math.sign(d[2] * side || 1) >= 0) hi = mid;
    else lo = mid;
  }
  return G.add3(p, G.mul3(d, hi));
};
const strut = (name, a, b, r = 1.1, { from, to, ...extra } = {}) => {
  const d = G.unit3(G.sub3(b, a));
  const a2 = from ? seat(a, d, r, from[0], from[1]) : a;
  const b2 = to ? seat(b, G.mul3(d, -1), r, to[0], to[1]) : b;
  const dd = G.sub3(b2, a2);
  T.round({ name, ...PL, F: fr(a2, dd, [0, 0, 1]), s0: 0, s1: G.len3(dd), r, tone: "mid", material: "steel", ...extra });
};
// a faired strut: a streamlined section with its chord along the flight path, ends seated like a round's
const LENS = Array.from({ length: 12 }, (_, i) => {
  const t = (i / 12) * Math.PI * 2;
  return [1.7 * Math.cos(t) * (Math.cos(t) > 0 ? 0.8 : 1.15), 0.7 * Math.sin(t)];
});
const fairing = (name, a, b, { from, to, ...extra } = {}) => {
  const d = G.unit3(G.sub3(b, a));
  const u = G.unit3(G.sub3([-1, 0, 0], G.mul3(d, -d[0])));
  const v = G.cross3(d, u);
  const rimAt = (o) => (t) => LENS.map(([x, y]) => G.add3(G.add3(o, G.mul3(d, t)), G.add3(G.mul3(u, x), G.mul3(v, y))));
  const seatPoly = (p, dir, f, side) => {
    const sign = G.dot3(dir, d) > 0 ? 1 : -1;
    const rim = (t) => rimAt(p)(t * sign);
    return seat(p, dir, 0, f, side, -0.05, rim);
  };
  const a2 = from ? seatPoly(a, d, from[0], from[1]) : a;
  const b2 = to ? seatPoly(b, G.mul3(d, -1), to[0], to[1]) : b;
  T.prism({ name, ...PL, F: { o: a2, a: d, u, v }, polygon: LENS, s0: 0, s1: G.len3(G.sub3(b2, a2)), tone: "mid", material: "steel", ...extra });
};
const lowerTop = (x) => topOf(LOWER_LE, ZW0, x);
const upperBottom = () => ZU;
const fusTop = (x, y) => ZF + Math.sqrt(Math.max(0, FUS_R ** 2 - y ** 2));
const AXZ = ZW0 - 24;
const HUB = { x: 33, w: 10, z: AXZ - 3, h: 6, y: [13.6, 17.4] };
for (const [side, y] of [["l", 1], ["r", -1]]) {
  strut(`strut.front.${side}`, [14, 70 * y, lowerTop(14)], [22, 70 * y, ZU], 1.1, { from: [lowerTop, 1], to: [upperBottom, -1] });
  strut(`strut.rear.${side}`, [0, 70 * y, lowerTop(0)], [8, 70 * y, ZU], 1.1, { from: [lowerTop, 1], to: [upperBottom, -1] });
  strut(`cabane.front.${side}`, [20, 6 * y, fusTop(20, 6)], [26, 8 * y, ZU], 0.9, { from: [fusTop, 1], to: [upperBottom, -1] });
  strut(`cabane.rear.${side}`, [4, 6 * y, fusTop(4, 6)], [10, 8 * y, ZU], 0.9, { from: [fusTop, 1], to: [upperBottom, -1] });
  strut(`wire.lift.${side}`, [15.6, 14 * y, lowerTop(15.6)], [23.6, 66 * y, ZU], 0.3, { from: [lowerTop, 1], to: [upperBottom, -1] });
  strut(`wire.land.${side}`, [11.6, 66 * y, lowerTop(11.6)], [19.6, 12 * y, ZU], 0.3, { from: [lowerTop, 1], to: [upperBottom, -1] });
  // landing gear: two legs from the wing's flat underside to a hub block that carries axle and wheel
  const hubY = y > 0 ? HUB.y : [-HUB.y[1], -HUB.y[0]];
  const blockTop = () => HUB.z + HUB.h;
  T.prism({ name: `gear.hub.${side}`, ...PL, plan: { x: HUB.x, y: hubY[0], w: HUB.w, d: hubY[1] - hubY[0], r: 0.6 }, z: HUB.z, h: HUB.h, steps: 2, bevel: 0.25, tone: "mid", material: "gunmetal" });
  fairing(`gear.front.${side}`, [17, 9 * y, ZW0], [HUB.x + 7.8, 16.2 * y, HUB.z + HUB.h], { from: [() => ZW0, -1], to: [blockTop, 1] });
  fairing(`gear.rear.${side}`, [2, 9 * y, ZW0], [HUB.x + 2.6, 16.2 * y, HUB.z + HUB.h], { from: [() => ZW0, -1], to: [blockTop, 1] });
  const w0 = y > 0 ? HUB.y[1] : -HUB.y[1] - 4.5;
  T.round({ name: `gear.wheel.${side}`, ...PL, F: ALONG_Y(HUB.x + HUB.w / 2, AXZ), s0: w0, s1: w0 + 4.5, r: 8.5, tone: "mid", crease: "lo", material: "rubber", details: { seams: [w0 + 2.25], bolts: [{ s: y > 0 ? w0 + 4.5 : w0, r: 3, count: 5, size: 0.4, phase: 0.2 }] } });
}
T.round({ name: "gear.axle", ...PL, F: ALONG_Y(HUB.x + HUB.w / 2, AXZ), s0: -HUB.y[0], s1: HUB.y[0], r: 1.2, tone: "mid", material: "steel" });

// tail: stabiliser halves, fin, elevator and rudder
const ZT = ZF + 5;
const STAB_LE = -70;
const STAB_C = 16;
const STAB_CUT = 0.82;
const STAB_T = 0.13;
const stabSection = (cut) => {
  const n = 12;
  const top = Array.from({ length: n + 1 }, (_, i) => {
    const xi = cut * (1 - Math.cos((i / n) * (Math.PI / 2))) ** 1.15;
    return [STAB_LE - xi * STAB_C, ZT + STAB_C * hOf(xi, STAB_T)];
  });
  return sec([[STAB_LE, ZT], ...top.slice(1), [STAB_LE - cut * STAB_C, ZT]]);
};
const EKR = (STAB_C * hOf(STAB_CUT, STAB_T)) / 2;
const EX = STAB_LE - STAB_CUT * STAB_C - EKR;
for (const [side, s0, s1] of [["l", 1.6, 30], ["r", -30, -1.6]]) T.prism({ name: `tail.stab.${side}`, ...PL, F: SPANWISE, polygon: stabSection(STAB_CUT), s0, s1, tone: "hi", crease: "lo", bevel: 0.3 });
T.prism({ name: "tail.fin", ...PL, F: SPANWISE, polygon: sec([[-72, ZT], [-88, ZT], [-88, ZT + 24], [-83, ZT + 24]]), s0: -1.6, s1: 1.6, tone: "hi", crease: "lo", bevel: 0.3 });
T.round({ name: "fus.tailcap", ...PL, F: FUS, s0: -88.6, s1: -88, r: 5, tone: "mid", material: "gunmetal" });
const elev = T.group("elev", { parent: pitch, hinge: { point: [EX, 0, ZT + EKR], axis: [0, 1, 0], range: [-12, 22] } });
for (const [side, s0, s1] of [["l", 5, 30], ["r", -30, -5]]) {
  T.round({ name: `elev.${side}.knuckle`, group: elev, layer: plane, F: ALONG_Y(EX, ZT + EKR), s0, s1, r: EKR, tone: "hi", lit: true });
  T.prism({ name: `elev.${side}.body`, group: elev, layer: plane, F: SPANWISE, polygon: sec([[EX - EKR, ZT + EKR - EKR * 0.98], [EX - EKR, ZT + EKR + EKR * 0.98], [EX - 10, ZT + EKR + 0.2], [EX - 10, ZT + EKR - 0.2]]), s0, s1, tone: "hi", crease: "lo", lit: true });
}
const RKR = 1;
const RX = -88.6 - RKR;
const rud = T.group("rud", { parent: pitch, hinge: { point: [RX, 0, ZT], axis: [0, 0, 1], range: [-18, 18] } });
T.round({ name: "rud.knuckle", group: rud, layer: plane, F: fr([RX, 0, ZF - 5], [0, 0, 1], [1, 0, 0]), s0: 0, s1: ZT + 24 - (ZF - 5), r: RKR, tone: "hi", lit: true });
T.prism({ name: "rud.body", group: rud, layer: plane, F: SPANWISE, polygon: sec([[RX - RKR, ZF - 5], [RX - RKR, ZT + 24], [RX - 8, ZT + 22], [RX - 11, ZT + 16], [RX - 11, ZF - 2]]), s0: -0.6, s1: 0.6, tone: "hi", crease: "lo", lit: true });
strut("tail.skid", [-78, 0, ZF - 5], [-86, 0, ZF - 11], 0.8, { from: [(x, y) => ZF - Math.sqrt(Math.max(0, 25 - y * y)), -1] });

// propeller
const PROP_X = 61.5;
const prop = T.group("prop", { parent: pitch, hinge: { point: [PROP_X, 0, ZF], axis: [1, 0, 0], range: [0, 360] } });
const PR = 6;
T.round({ name: "prop.plate", group: prop, layer: plane, F: FUS, s0: PROP_X, s1: PROP_X + 1, r: PR, tone: "mid", material: "gunmetal", details: { bolts: [{ s: PROP_X + 1, r: 4.6, count: 6, size: 0.4 }] } });
const spinner = T.round({ name: "prop.spinner", group: prop, layer: plane, F: FUS, s0: PROP_X + 1, s1: PROP_X + 2.6, r: PR, ends: ["flat", "dome"], tone: "hi", crease: "lo", material: "chrome" });
const BLADE_X = PROP_X + 2;
const lens = Array.from({ length: 14 }, (_, i) => {
  const t = (i / 14) * Math.PI * 2;
  const x = 3.6 * Math.cos(t);
  const y = 0.55 * Math.sin(t) + 0.25;
  const a = (18 * Math.PI) / 180;
  return [x * Math.sin(a) + y * Math.cos(a), x * Math.cos(a) - y * Math.sin(a)];
});
const PROP_R = 30;
for (const [name, dir] of [["a", 1], ["b", -1]]) {
  T.prism({ name: `prop.blade.${name}`, group: prop, layer: plane, F: { o: [BLADE_X, 0, ZF], a: [0, 0, dir], u: [1, 0, 0], v: [0, dir, 0] }, polygon: lens, s0: PR, s1: PROP_R, tone: "hi", crease: "lo", material: "copper" });
}
const disc = (r, steps = 96) => Array.from({ length: steps }, (_, j) => `${j ? "L" : "M"}${(r * Math.cos((j / steps) * Math.PI * 2)).toFixed(3)} ${(r * Math.sin((j / steps) * Math.PI * 2)).toFixed(3)}`).join("") + "Z";
T.plane({ part: spinner, o: [BLADE_X + 0.6, 0, ZF], u: [0, 1, 0], v: [0, 0, 1], normal: [1, 0, 0], fade: [0.02, 0.2], svg: `<g class="bp-disc"><path class="bp-disc-fill" d="${disc(PROP_R)}${disc(PR + 0.4)}" fill-rule="evenodd"/><path class="iso-line" data-tone="faint" d="${disc(PROP_R)}"/><path class="iso-line" data-tone="faint" d="${disc(PROP_R - 5)}"/></g>` });

// ---------- console: instruments, stick and throttle ----------
const STICK = [-26, 118];
const STICK_BOOT = 5;
const BALL = [STICK[0], STICK[1], CONSOLE_H + STICK_BOOT + 3];
const DIAL_R = 8.4;
const DIAL_H = 2.4;
export const DIALS = { asi: [-66, 113], vsi: [-46, 113] };
const QUAD = { x: -40, w: 8, z: CONSOLE_H };
const THR_Y = [126.4, 129.6];
const THR_PIVOT = [QUAD.x + QUAD.w / 2, 0, CONSOLE_H + 5];

function consoleStatic() {
  const out = [];
  out.push(`<path class="iso-halo" d="${k.haloOf(CONSOLE, 0, CONSOLE_H, P)}" style="opacity:.5"/>`);
  out.push(S(k.slabOf(CONSOLE, 0, CONSOLE_H, P, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(CONSOLE, 5, P, 4), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(CONSOLE, 3), CONSOLE_H, P), { tone: "faint" }));
  const screws = k.corners(CONSOLE, 4);
  out.push(D(screws.map(([x, y]) => at([x, y, CONSOLE_H])), { size: 0.45 }));
  for (const [name, [x, y]] of Object.entries(DIALS)) {
    const top = CONSOLE_H + DIAL_H;
    out.push(S(k.cylinder(x, y, DIAL_R + 1.2, CONSOLE_H, 0.8, P, 48), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, DIAL_R, CONSOLE_H + 0.8, DIAL_H - 0.8, P, 56, 0.4), { tone: "hi", crease: "lo" }));
    out.push(L(k.ring(x, y, DIAL_R - 1.1, top, P, 56), { tone: "lo" }));
    if (name === "asi") {
      // 0–250 km/h over 300°, ticks every 10 km/h, majors every 50
      const t = k.radialTicks(x, y, DIAL_R - 1.4, 30, 5, top, [0.9, 1.9], P, (-150 * Math.PI) / 180, (300 * Math.PI) / 180);
      out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
      // the arc runs from the stall speed to Vne
      const arc = (a0, a1, r) => k.onTop(Array.from({ length: 13 }, (_, i) => { const a = ((a0 + (a1 - a0) * (i / 12)) * Math.PI) / 180; return [x + r * Math.sin(a), y - r * Math.cos(a)]; }), top, P);
      out.push(L(arc(-150 + 300 * (MODEL.vStallKmh / 250), -150 + 300 * (MODEL.vneKmh / 250), DIAL_R - 3.6), { tone: "mid", free: true }));
    } else {
      // ±10 m/s, zero at 9 o'clock, ±170°
      const t = k.radialTicks(x, y, DIAL_R - 1.4, 40, 5, top, [0.9, 1.9], P, (-90 - 170) * (Math.PI / 180) + Math.PI, (340 * Math.PI) / 180);
      out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
    }
    out.push(L(k.ring(x, y, 1.2, top, P, 16), { tone: "mid" }));
  }
  const lamp = [-50, CONSOLE.y + CONSOLE.d - 5];
  out.push(S(k.cylinder(lamp[0], lamp[1], 2.6, CONSOLE_H, 0.8, P, 24), { tone: "lo" }));
  out.push(`<g class="bp-lamp">${S(k.cylinder(lamp[0], lamp[1], 1.8, CONSOLE_H + 0.8, 1.4, P, 24), { tone: "mid", crease: "lo" })}</g>`);
  out.push(k.faceTextSvg(k.topMatrix([CONSOLE.x + 11, CONSOLE.y + CONSOLE.d - 6], CONSOLE_H, P, "x"), "BANCO N. 1", { size: 2.4, tone: "lo", anchor: "start" }));
  return out.join("");
}
put({ name: "stand.console", layer: "mid", at: [CONSOLE.x + CONSOLE.w / 2, CONSOLE.y + CONSOLE.d / 2, 0], svg: consoleStatic(), shapes: [A.slab(CONSOLE, 0, CONSOLE_H, { ground: true }) ] });
T.round({ name: "stand.boot.flange", layer: desk, F: VERT(STICK[0], STICK[1]), s0: CONSOLE_H, s1: CONSOLE_H + 1.2, r: 6.2, tone: "lo", details: { bolts: [{ s: CONSOLE_H + 1.2, r: 5.3, count: 6, size: 0.4 }] } });
T.round({ name: "stand.boot", layer: desk, F: VERT(STICK[0], STICK[1]), s0: CONSOLE_H + 1.2, s1: CONSOLE_H + STICK_BOOT, r: [4.6, 3.4], tone: "mid", crease: "lo", material: "rubber", details: { seams: [CONSOLE_H + 2.6, CONSOLE_H + 3.8] } });

// throttle quadrant plates are live-layer statics so the lever sorts against them
for (const [side, y0] of [["a", THR_Y[0] - 1.4], ["b", THR_Y[1]]]) {
  T.prism({ name: `stand.quadrant.${side}`, layer: desk, F: SPANWISE, polygon: sec([[QUAD.x, CONSOLE_H], [QUAD.x + QUAD.w, CONSOLE_H], [QUAD.x + QUAD.w, CONSOLE_H + 7.4], [QUAD.x + QUAD.w / 2, CONSOLE_H + 9.6], [QUAD.x, CONSOLE_H + 7.4]]), s0: y0, s1: y0 + 1.4, tone: "mid", bevel: 0.25, material: "gunmetal", details: { dots: [{ at: [y0 + (side === "a" ? 0 : 1.4), CONSOLE_H + 5, QUAD.x + QUAD.w / 2], normal: [0, side === "a" ? -1 : 1, 0], size: 0.45 }] } });
}
const thr = T.group("thr", { hinge: { point: [THR_PIVOT[0], 0, THR_PIVOT[2]], axis: [0, 1, 0], range: [-24, 24] } });
T.round({ name: "thr.knuckle", group: thr, layer: desk, F: ALONG_Y(THR_PIVOT[0], THR_PIVOT[2]), s0: THR_Y[0], s1: THR_Y[1], r: 1.6, tone: "mid", material: "steel" });
T.prism({ name: "thr.lever", group: thr, layer: desk, F: SPANWISE, polygon: sec([[THR_PIVOT[0] - 0.8, THR_PIVOT[2] + 1.6], [THR_PIVOT[0] + 0.8, THR_PIVOT[2] + 1.6], [THR_PIVOT[0] + 0.5, THR_PIVOT[2] + 13], [THR_PIVOT[0] - 0.5, THR_PIVOT[2] + 13]]), s0: THR_Y[0] + 0.5, s1: THR_Y[1] - 0.5, tone: "mid", material: "steel" });
T.ball({ name: "thr.knob", group: thr, layer: desk, c: [THR_PIVOT[0], (THR_Y[0] + THR_Y[1]) / 2, THR_PIVOT[2] + 13 + 2.2], r: 2.2, tone: "hi", lit: true, material: "rubber" });

// stick: a free group turned about the ball
const stick = T.group("stick", { free: { origin: BALL } });
T.ball({ name: "stick.ball", group: stick, layer: desk, c: BALL, r: 3, tone: "mid", material: "chrome" });
T.round({ name: "stick.rod", group: stick, layer: desk, F: VERT(BALL[0], BALL[1]), s0: BALL[2] + 3, s1: BALL[2] + 18, r: 0.9, tone: "mid", material: "steel", fixed: false });
T.round({ name: "stick.grip", group: stick, layer: desk, F: VERT(BALL[0], BALL[1]), s0: BALL[2] + 18, s1: BALL[2] + 25, r: 1.7, ends: ["flat", "dome"], tone: "hi", lit: true, material: "rubber", fixed: false, details: { seams: [BALL[2] + 19.2] } });

// ---------- motion ----------
const D2R = Math.PI / 180;
export const rot = (rollDeg, pitchDeg) => {
  const a = rollDeg * D2R;
  const b = pitchDeg * D2R;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  // Rx(a) · Ry(b)
  return [cb, 0, sb, sa * sb, ca, -sa * cb, -ca * sb, sa, ca * cb];
};
// figure values → group values; one source for the page, the build and the audit
export const follow = (v) => {
  const sp = v.sp ?? 0;
  const sr = v.sr ?? 0;
  const ang = (v.prop ?? 0) % 360;
  return {
    roll: v.bank ?? 0,
    pitch: v.alpha ?? 0,
    elev: 22 * sp,
    "ail.l": -18 * sr,
    "ail.r": 18 * sr,
    rud: 15 * sr,
    prop: ang < 0 ? ang + 360 : ang,
    thr: -24 + 48 * (v.thr ?? 0.5),
    stick: sp || sr ? { R: rot(14 * sr, -14 * sp), t: [0, 0, 0] } : null,
  };
};
const rand = (() => {
  let seed = 11;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
})();
export const poses = () => {
  const out = [];
  for (let i = 0; i < 420; i++) out.push(follow({ alpha: 18 * rand(), bank: -12 + 24 * rand(), sp: -0.5 + 1.5 * rand(), sr: -1 + 2 * rand(), thr: rand(), prop: 360 * rand() }));
  for (const alpha of [0, 18]) for (const bank of [-12, 12]) for (const sp of [-0.5, 1]) for (const sr of [-1, 1]) for (const thr of [0, 1]) out.push(follow({ alpha, bank, sp, sr, thr, prop: 45 }));
  return out;
};

// ---------- build ----------
base();
cable();
const out = T.build({ statics: R.items, poses });
A.settle(R, P);
const layerOf = (name) => R.items.filter((item) => item.layer === name).sort((a, b) => a.key - b.key).map((item) => item.svg);
const BACK = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P)}"/>`, ...layerOf("back")];
const MID = layerOf("mid");
const needles = Object.keys(DIALS).map((name) => `<path data-needle="${name}" class="iso-line" data-tone="lit" data-free="start" d="" style="stroke-width:.9"/>`).join("");
if (argv.includes("--audit")) {
  A.auditOrExit(R, P);
  const tour = (t) => follow({ alpha: 9 + 9 * Math.sin(t * 0.9), bank: 12 * Math.sin(t * 0.6), sp: 0.25 + 0.75 * Math.sin(t * 0.9), sr: Math.sin(t * 0.6), thr: 0.5 + 0.5 * Math.sin(t * 0.4), prop: (t * 400) % 360 });
  if (!argv.includes("--kit")) TA.orbitOrExit(T, R, P, {
    clips: [{ name: "tour", at: tour, from: 0, to: 12, frame: 1 / 30 }],
    quick: argv.includes("--quick"),
    only: argv.find((a) => a.startsWith("--only="))?.slice(7).split(",") ?? null,
    log: argv.includes("--verbose") ? (text) => console.log(`  … ${text}`) : null,
  });
}

const LABEL = "Un biplano da addestramento su un banco di prova a giunto cardanico: due ali sovrapposte unite da montanti e tiranti, elica, carrello, impennaggi con equilibratore e timone, alettoni sull'ala inferiore. Davanti, una console con cloche, manetta, anemometro e variometro.";
const backSvg = k.figureSvg({ width: WIDTH, height: HEIGHT, label: LABEL, body: BACK });
const staticSvg = (list) => `<svg xmlns="http://www.w3.org/2000/svg" class="iso-svg iso-layer" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">${list.join("")}</svg>`;
const stage = `<div class="iso-stage iso-turn bp-stage" tabindex="0" role="group" aria-label="Biplano sul banco: muovi il puntatore sulla figura per muovere la cloche, frecce per cloche, più e meno o Pagina su e giù per la manetta">${backSvg}${out.layerSvg("plane", { width: WIDTH, height: HEIGHT })}${staticSvg([...MID, needles])}${out.layerSvg("desk", { width: WIDTH, height: HEIGHT })}</div>`;

const controls = `<div class="bp-controls">
<label class="bp-control"><span>Manetta</span><input type="range" min="0" max="100" value="62" data-input="thr"><output data-show="thr">62%</output></label>
<label class="bp-control"><span>Cloche avanti / indietro</span><input type="range" min="-50" max="100" value="0" data-input="sp"><output data-show="sp">0</output></label>
<label class="bp-control"><span>Cloche sinistra / destra</span><input type="range" min="-100" max="100" value="0" data-input="sr"><output data-show="sr">0</output></label>
</div><p class="bp-live" aria-live="polite" data-phase></p>`;

const DATA = { turn: out.data, P, dials: DIALS, dialTop: CONSOLE_H + DIAL_H, dialR: DIAL_R, model: MODEL };
const FOLLOW = `const rot = ${rot.toString()};\nconst D2R = Math.PI / 180;\nconst follow = ${follow.toString()};`;
const CSS = out.css + "\n" + readFileSync(join(HERE, "biplano.css"), "utf8");
const LIVE = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "") + "\n" + readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA)).replace("const follow = null;", FOLLOW);
const body = k.plateHtml({
  fig: "Fig 1",
  title: "Biplano",
  hint: "Puntatore: cloche",
  readout: "",
  keys: [
    { mark: "lit", label: "Superfici di comando: alettoni, equilibratore, timone, e la cloche che le muove" },
    { mark: "raised", label: "Due ali, una sopra l'altra: tanta superficie in poca apertura" },
  ],
  caption:
    "Un biplano vola perché le due ali spingono l'aria verso il basso: la portanza cresce con il quadrato della velocità e con l'angolo d'attacco, finché oltre circa 14° il flusso si stacca e l'ala stalla. La cloche avanti/indietro muove l'equilibratore e quindi l'angolo d'attacco, cioè la velocità; la manetta dà la spinta che avanza o manca, cioè la salita. Valori in scala reale per un biplano da scuola: 828 kg, 22,2 m² di ala, 97 kW.",
  body: `<style>${CSS}</style>${stage}${controls}`,
});
let page = k.pageHtml({ title: "Biplano — come vola", theme: "light", body, script: kitScript() + turnScript() + LIVE, width: 760 });
page = page.replace("<html lang=\"en\">", "<html lang=\"it\">").replace(/<body class="iso" data-theme="light">/, `<body class="iso" data-theme="light"><script>if(matchMedia("(prefers-color-scheme: dark)").matches&&!/tema=chiaro/.test(location.search)||/tema=scuro/.test(location.search))document.body.setAttribute("data-theme","dark")</script>`).replace("</head>", `<script src="../preview.js"></script><script>if(/[?&]preview/.test(location.search))document.documentElement.classList.add("bp-preview")</script></head>`);
writeFileSync(join(OUT, "index.html"), page);
console.log(`wrote public/designs/biplano/index.html · ${(page.length / 1024).toFixed(0)} KB · ${out.report.parts} parts · ${out.report.layers.map((l) => `${l.name}: ${l.planar} planes, ${l.dynamic} dynamic`).join(" · ")} · build ${out.report.seconds.toFixed(1)} s`);
