// Fourier: a page that explains the Fourier series and transform with two figures built
// with the anatomy kit. `node scripts/fourier/build.mjs` writes public/designs/fourier/index.html.
// Fig 1 is a harmonic synthesiser in the manner of Kelvin's tide predictor: seven cranks
// geared 1:1 … 7:1, each crank pin set to one coefficient, Scotch yokes that lift seven
// pulleys, and one wire that adds their heights and moves a pen over a strip of paper.
// Fig 2 is a winding table: the signal drawn round a turntable that turns at f, its centre
// of mass, and a plotter that draws how far that centre sits from the spindle.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../anatomy/kit/iso-kit.mjs";
import * as G from "../anatomy/kit/lathe.mjs";
import { kitScript } from "../anatomy/scripts/inline-kit.mjs";
import { SIGNALS, HARMONICS, termsOf, peakOf, WIND, centroid } from "./model.mjs";
import { prose } from "./prose.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "..", "..", "public", "designs", "fourier");

const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const f2 = (v) => +v.toFixed(2);
const pathOf = (points, closed = false) => points.map(([x, y], i) => `${i ? "L" : "M"}${f2(x)} ${f2(y)}`).join("") + (closed ? "Z" : "");
const circleD = (cx, cy, r, steps = 32) => pathOf(Array.from({ length: steps }, (_, i) => [cx + r * Math.cos((i / steps) * 2 * Math.PI), cy + r * Math.sin((i / steps) * 2 * Math.PI)]), true);
// a closed slot from (x0, y) to (x1, y), half height h, in flat coordinates
const slotD = (x0, x1, y, h, steps = 10) => {
  const pts = [];
  for (let i = 0; i <= steps; i++) pts.push([x1 + h * Math.sin((i / steps) * Math.PI), y - h * Math.cos((i / steps) * Math.PI)]);
  for (let i = 0; i <= steps; i++) pts.push([x0 - h * Math.sin((i / steps) * Math.PI), y + h * Math.cos((i / steps) * Math.PI)]);
  return pathOf(pts, true);
};

// ====================================================================================
// Fig 1: the harmonic synthesiser
// ====================================================================================
const W1 = 720;
const H1 = 400;
const SPACING = 26;
const COLS = Array.from({ length: HARMONICS }, (_, i) => (i - (HARMONICS - 1) / 2) * SPACING); // x of each column
const X1 = COLS[0];
const X7 = COLS[HARMONICS - 1];
const RMAX = 7; // the longest crank throw
const PEN_SWING = 20; // the pen's largest excursion either side of its rest height

// heights (z) and depths (y): the mechanism works in the plane y = WY, in front of the gearbox
const BOX = { x: X1 - 14, y: -26, w: X7 + 26 - (X1 - 14), d: 20, r: 2 };
const BOX_H = 44;
const ZD = 30; // crank axis
const DISC_R = 10;
const WY = -1.5; // wire, pulleys and rods
const ROD_R = 1.1;
const ROD_Y = -1.6;
const YOKE_H = 5;
const AXLE0 = ZD + YOKE_H / 2 + 40; // moving pulley axle at rest
const MP_R = 3.5;
const FP_R = (SPACING - 2 * MP_R) / 2; // fixed pulleys fill the gap, so every run of wire hangs plumb
const FP_Z = 98;
const RAIL = { z: 50, h: 5 };
const BUSH = { z: 47, top: 58 };
const BEAM = { y: -8, d: 4, z: 92, h: 12 };
const POST = { x: X7 + 15, w: 6 };
const X_PEN = X1 - SPACING / 2 - FP_R; // the pen hangs from the first fixed pulley's left side
const ANCHOR = [X7 + SPACING / 2 + FP_R, 43];
const ZP0 = 62; // the pen's rest height
const PAPER = { x0: -193, x1: X_PEN + 3.5 - 1, y: -3.95, z0: 36, z1: 86 };
const BOARD = { x: -200, y: -8, w: BOX.x - -200, d: 4, r: 0.8 };
const ROLLER_Y = -3;
const ROLLER_R = 0.95;
const GUIDE = { x: X_PEN + 6.9, y: -0.6, r: 0.9, z0: 36, z1: 88 };
const CARRIAGE = { x: X_PEN - 1.5, y: -1.9, w: GUIDE.x + 1.2 - (X_PEN - 1.5), d: 2.6, r: 0.6 };
const WHEEL = { x: BOX.x + BOX.w, y: -16, z: 24 };
const BASE = { x: -212, y: -34, w: 334, d: 52, r: 8 };
const BASE_H = 12;
const FOOT_H = 5;
// paper speed: one and a half periods of the fundamental across the visible strip
const PAPER_V = (PAPER.x1 - PAPER.x0) / (1.5 * 2 * Math.PI);

const P1 = k.fitProjection(
  [...k.boxCorners(BASE, -BASE_H - FOOT_H, 0), [BOARD.x, BOARD.y, 112], [POST.x + POST.w, BEAM.y, BEAM.z + BEAM.h], [WHEEL.x + 11, WHEEL.y - 11, WHEEL.z + 11]],
  W1,
  H1,
  { pad: 22, azimuth: 60, elevation: 26 },
);
const at = (p) => k.iso(p, P1);
const byDepth = (points, P = P1) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
// frames: along y through (x, z), along x through (y, z)
const FY = (x, z) => G.frameOf([x, 0, z], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
const FX = (y, z) => G.frameOf([0, y, z], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
// a vertical plane y = const: local (x, −z)
const planeY = (y) => k.sideMatrix([0, y], 0, P1, "left");
// a vertical plane x = const: local (−y, −z)
const planeX = (x) => k.sideMatrix([x, 0], 0, P1, "right");

function baseFig1() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P1)}"/>`];
  for (const [x, y] of byDepth(k.corners(BASE, 18))) {
    out.push(S(k.cylinder(x, y, 7, -BASE_H - FOOT_H, 1.6, P1, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, P1, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(BASE, -BASE_H, BASE_H, P1, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(BASE, -BASE_H + 4, P1, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(BASE, 5), 0, P1), { tone: "lo" }));
  const screws = k.corners(BASE, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P1, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // a ruler under the paper: the time axis, a tick every 2 units
  const strip = { x: PAPER.x0, y: 6, w: PAPER.x1 - PAPER.x0, d: 6, r: 1 };
  const ticks = k.topTicks(strip.x + 2, strip.x + strip.w - 2, 2, 5, strip.y + 0.8, 0.6, [1.6, 3], P1);
  out.push(S(k.slabOf(strip, 0, 0.6, P1, 3), { tone: "lo", crease: "none" }), L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(D([at([strip.x + 1.2, strip.y + 4.6, 0.6]), at([strip.x + strip.w - 1.2, strip.y + 4.6, 0.6])], { size: 0.4 }));
  // label plate, front right
  const label = { x: 62, y: 4, w: 40, d: 10, r: 1.4 };
  out.push(S(k.slabOf(label, 0, 0.8, P1, 4), { tone: "lo", crease: "none" }));
  out.push(L(k.planOutline(k.insetPlan(label, 1.4), 0.8, P1), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([label.x + 4, label.y + 6.6], 0.8, P1, "x"), "SINTESI · 7 ARMONICHE", { size: 2.2, tone: "lo", anchor: "start" }));
  out.push(D([at([label.x + 2.4, label.y + 2.4, 0.8]), at([label.x + label.w - 2.4, label.y + label.d - 2.4, 0.8])], { size: 0.42 }));
  return out.join("");
}

// the recorder board: a tall plate on a foot rail, paper strip between two rollers
function board() {
  const out = [];
  const foot = { x: BOARD.x - 4, y: -14, w: BOARD.w + 4, d: 16, r: 1.5 };
  out.push(S(k.slabOf(foot, 0, 6, P1, 4, 0.6), { tone: "mid", inner: L(k.sideSeam(foot, 1.6, P1, 4), { tone: "faint" }) }));
  out.push(D([[foot.x + 4, foot.y + 4], [foot.x + 4, foot.y + foot.d - 4], [foot.x + foot.w - 4, foot.y + foot.d - 4]].map(([x, y]) => at([x, y, 6])), { size: 0.45 }));
  out.push(S(k.slabOf(BOARD, 6, 106, P1, 3, 0.5), { tone: "mid", inner: L(k.sideSeam(BOARD, 100, P1, 3), { tone: "faint" }) }));
  // screws on the board face, above and below the paper
  const face = planeY(BOARD.y + BOARD.d);
  const screwsAt = [[-196, 96], [-196, 14], [-102, 14], [-140, 96], [-140, 14]];
  out.push(`<g transform="${face}">${screwsAt.map(([x, z]) => `<path class="iso-line" data-tone="lo" d="${circleD(x, -z, 1.6, 16)}"/>`).join("")}</g>`);
  out.push(D(screwsAt.map(([x, z]) => at([x, BOARD.y + BOARD.d, z])), { size: 0.45 }));
  return out.join("");
}

function paperStatic() {
  // the sheet runs on to where it wraps each roller, behind the roller's axis
  const x0 = PAPER.x0 - ROLLER_R + 0.05;
  const x1 = PAPER.x1 + ROLLER_R + 0.05;
  const { z0, z1 } = PAPER;
  const lines = [-20, -10, 10, 20].map((dz) => `M${x0} ${-(ZP0 + dz)}H${x1}`).join("");
  return `<g transform="${planeY(PAPER.y)}">
<path class="fx-paper" d="M${x0} ${-z1}H${x1}V${-z0}H${x0}Z"/>
<path class="iso-line" data-tone="faint" d="${lines}"/>
<path class="iso-line" data-tone="lo" d="M${x0} ${-ZP0}H${x1}"/>
<clipPath id="fx-paper-clip"><path d="M${x0} ${-z1}H${x1}V${-z0}H${x0}Z"/></clipPath>
<g clip-path="url(#fx-paper-clip)">
<path class="iso-line" data-tone="faint" data-fx="grid" d=""/>
<path class="iso-line fx-ghost" data-tone="mid" data-fx="ghost" d=""/>
<path class="iso-line fx-trace" data-tone="lit" data-fx="trace" d=""/>
</g>
<path class="iso-line" data-tone="lo" d="M${x0} ${-z1}H${x1}M${x0} ${-z0}H${x1}"/>
</g>`;
}

function rollers() {
  const out = [];
  for (const x of [PAPER.x0 - ROLLER_R + 0.05, PAPER.x1 + ROLLER_R + 0.05]) {
    for (const z of [PAPER.z0 - 4.2, PAPER.z1 + 1.6]) out.push(S(k.slabOf({ x: x - 2, y: BOARD.y + BOARD.d, w: 4, d: 3, r: 0.5 }, z, 1.6, P1, 2, 0.3), { tone: "mid" }));
    out.push(S(k.cylinder(x, ROLLER_Y, ROLLER_R, PAPER.z0 - 2.6, PAPER.z1 - PAPER.z0 + 4.2, P1, 16), { tone: "hi", crease: "none", inner: L([PAPER.z0, PAPER.z1].map((z) => k.sideArc(x, ROLLER_Y, ROLLER_R, z, P1, 8)).join(""), { tone: "faint" }) }));
  }
  // the take-up roller's knurled knob
  const kx = PAPER.x0 - ROLLER_R + 0.05;
  out.push(S(k.cylinder(kx, ROLLER_Y, 0.6, PAPER.z1 + 3.2, 1.4, P1, 12), { tone: "mid" }));
  out.push(S(k.cylinder(kx, ROLLER_Y, 2.4, PAPER.z1 + 4.6, 2.2, P1, 24), { tone: "mid" }), L(k.knurl(kx, ROLLER_Y, 2.4, PAPER.z1 + 4.6, PAPER.z1 + 6.8, 18, P1), { tone: "lo" }));
  return out.join("");
}

function gearbox() {
  const out = [`<path class="iso-halo" d="${k.haloOf(BOX, 0, BOX_H, P1)}" style="opacity:.45"/>`];
  const seams = L(k.sideSeam(BOX, 40, P1, 3) + k.sideSeam(BOX, 4, P1, 3), { tone: "faint" });
  out.push(S(k.slabOf(BOX, 0, BOX_H, P1, 3, 0.8), { tone: "mid", inner: seams }));
  // lid bolts along the visible edges
  const bolts = [];
  for (let x = BOX.x + 6; x < BOX.x + BOX.w - 3; x += 13) bolts.push([x, BOX.y + BOX.d - 2.4]);
  for (let y = BOX.y + 4; y < BOX.y + BOX.d - 3; y += 6) bolts.push([BOX.x + BOX.w - 2.4, y]);
  out.push(D(bolts.map(([x, y]) => at([x, y, BOX_H])), { size: 0.42 }));
  // oil filler on the lid
  out.push(S(k.cylinder(BOX.x + 30, BOX.y + 8, 3.2, BOX_H, 1, P1, 24), { tone: "lo" }));
  out.push(S(k.cylinder(BOX.x + 30, BOX.y + 8, 2.4, BOX_H + 1, 2.4, P1, 20), { tone: "mid" }), L(k.knurl(BOX.x + 30, BOX.y + 8, 2.4, BOX_H + 1, BOX_H + 3.4, 14, P1), { tone: "lo" }));
  // ratio plaques under each column: n dots for the n:1 gear
  COLS.forEach((x, i) => {
    const n = i + 1;
    const plaque = { x: x - 7, y: BOX.y + BOX.d, w: 14, d: 0.6, r: 0.3 };
    out.push(S(k.slabOf(plaque, 7, 6, P1, 2), { tone: "lo", crease: "none" }));
    const dots = Array.from({ length: n }, (_, j) => at([x + (j - (n - 1) / 2) * 1.7, BOX.y + BOX.d + 0.6, 10]));
    out.push(D(dots, { size: 0.55, tone: "hi" }));
  });
  // inspection cover on the end face
  const end = planeX(BOX.x + BOX.w);
  out.push(`<g transform="${end}"><path class="iso-line" data-tone="lo" d="${slotD(8, 18, -9, 3.5)}"/></g>`);
  return out.join("");
}

// the hand wheel that drives the shaft, on the gearbox end
const WHEEL_S = { boss: [0, 2], rim: [3.5, 5.5], hub: [2, 6] };
const KNOB_R = 8.4;
function wheelStatic() {
  const F = FX(WHEEL.y, WHEEL.z);
  const x0 = WHEEL.x;
  const out = [];
  out.push(S(G.disc(x0, x0 + WHEEL_S.boss[1], 4.2, F, P1), { tone: "mid" }));
  out.push(S(G.ringBand(x0 + WHEEL_S.rim[0], x0 + WHEEL_S.rim[1], 8.4, 10.6, F, P1), { tone: "mid", crease: "lo", inner: L(G.arcOf(F, x0 + 4.5, 10.6, P1), { tone: "faint" }) }));
  out.push(S(G.disc(x0 + WHEEL_S.hub[0], x0 + WHEEL_S.hub[1], 2.4, F, P1), { tone: "mid" }));
  return out.join("");
}
function wheelSpokes() {
  // four spokes on the wheel's outer face, turned by the live code
  const sp = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * 2 * Math.PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const w = 0.9;
    return pathOf([[2.4 * c - w * s, 2.4 * s + w * c], [8.5 * c - w * s, 8.5 * s + w * c], [8.5 * c + w * s, 8.5 * s - w * c], [2.4 * c + w * s, 2.4 * s - w * c]], true);
  }).join("");
  // local plane coords (−y, −z), centred on the axle
  return `<g transform="${planeX(WHEEL.x + WHEEL_S.rim[1])}"><g transform="translate(${-WHEEL.y} ${-WHEEL.z})"><g data-fx="wheel"><path class="fx-spoke" d="${sp}"/><path class="iso-line" data-tone="lo" d="${circleD(0, 0, 1.3, 16)}"/></g></g></g>`;
}
function wheelKnob() {
  // the handle: a turned knob standing off the rim face, moved round by translation
  const F = FX(WHEEL.y + KNOB_R, WHEEL.z);
  const s0 = WHEEL.x + WHEEL_S.rim[1];
  return `<g data-fx="knob">${S(G.disc(s0, s0 + 1.2, 1.6, F, P1), { tone: "mid" })}${S(G.solidOf([[s0 + 1.2, 1.1], [s0 + 4.5, 1.25, 1], [s0 + 6.5, 1.0, 1]], F, P1), { tone: "hi", crease: "lo" })}</g>`;
}

function postAndBeam() {
  const out = [];
  const post = { x: POST.x, y: BEAM.y, w: POST.w, d: BEAM.d, r: 0.8 };
  out.push(S(k.slabOf({ x: post.x - 2, y: post.y - 2, w: post.w + 4, d: post.d + 4, r: 1 }, BOX_H, 2, P1, 3, 0.4), { tone: "lo" }));
  out.push(D([at([post.x - 0.8, post.y + post.d + 1, BOX_H + 2]), at([post.x + post.w + 0.8, post.y + post.d + 1, BOX_H + 2])], { size: 0.4 }));
  out.push(S(k.slabOf(post, BOX_H + 2, BEAM.z + BEAM.h - BOX_H - 2, P1, 3, 0.5), { tone: "mid" }));
  const beam = { x: BOX.x, y: BEAM.y, w: POST.x - BOX.x, d: BEAM.d, r: 0.4 };
  out.push(S(k.slabOf(beam, BEAM.z, BEAM.h, P1, 2, 0.5), { tone: "mid", inner: L(k.sideSeam(beam, BEAM.z + 3, P1, 2), { tone: "faint" }) }));
  return out.join("");
}

// fixed pulleys on studs from the beam: x positions and their lightening holes
const FPX = Array.from({ length: HARMONICS + 1 }, (_, i) => X1 - SPACING / 2 + i * SPACING);
function fixedPulleys() {
  const out = [];
  for (const x of FPX) {
    const F = FY(x, FP_Z);
    out.push(S(G.disc(BEAM.y + BEAM.d, -2.6, 2.2, F, P1), { tone: "lo" }));
    out.push(S(G.disc(-2.6, -0.4, FP_R, F, P1), { tone: "mid", crease: "lo", inner: L(G.arcOf(F, -1.5, FP_R, P1), { tone: "faint" }) }));
    const holes = Array.from({ length: 5 }, (_, j) => circleD(5.4 * Math.cos((j / 5) * 2 * Math.PI), 5.4 * Math.sin((j / 5) * 2 * Math.PI), 1.7, 20)).join("");
    out.push(`<g transform="${planeY(-0.4)}"><g transform="translate(${x} ${-FP_Z})"><g data-fx="fp"><path class="fx-hole" d="${holes}"/><path class="iso-line" data-tone="lo" d="${holes}"/></g><path class="iso-line" data-tone="lo" d="${circleD(0, 0, 2.6, 20)}"/><path class="iso-line" data-tone="mid" d="${circleD(0, 0, 1.1, 14)}"/></g></g>`);
  }
  return out.join("");
}

// crank discs: boss and disc are static, the face (slot, rim ticks) turns
function discs() {
  const out = [];
  for (const x of COLS) {
    const F = FY(x, ZD);
    out.push(S(G.disc(BOX.y + BOX.d, -5, 4.4, F, P1), { tone: "mid" }));
    out.push(S(G.disc(-5, -3, DISC_R, F, P1), { tone: "hi", crease: "lo" }));
  }
  return out.join("");
}
function discFaces() {
  const ticks = [];
  for (let j = 0; j < 36; j++) {
    const a = (j / 36) * 2 * Math.PI;
    const r0 = j % 9 === 0 ? 7.6 : 8.6;
    ticks.push(`M${f2(r0 * Math.cos(a))} ${f2(r0 * Math.sin(a))}L${f2(9.4 * Math.cos(a))} ${f2(9.4 * Math.sin(a))}`);
  }
  // scale along the slot: a tick every unit of throw
  const scale = [];
  for (let r = 1; r <= RMAX; r++) for (const sgn of [-1, 1]) scale.push(`M${sgn * r} -1.25L${sgn * r} ${r % 5 ? -1.75 : -2.1}`);
  return COLS.map((x) => `<g transform="${planeY(-3)}"><g transform="translate(${x} ${-ZD})"><g data-fx="disc">
<path class="iso-line" data-tone="lo" d="${ticks.join("")}"/>
<path class="fx-void" d="${slotD(-RMAX - 0.6, RMAX + 0.6, 0, 1.25)}"/>
<path class="iso-line" data-tone="mid" d="${slotD(-RMAX - 0.6, RMAX + 0.6, 0, 1.25)}"/>
<path class="iso-line" data-tone="faint" d="${scale.join("")}"/>
</g></g></g>`).join("");
}

// the Scotch yoke: crosshead with its slot, the rod below the bushing, all lifted by dz
function yoke(x) {
  const out = [];
  const head = { x: x - 10, y: -2.6, w: 20, d: 2, r: 0.6 };
  out.push(S(k.cylinder(x, ROD_Y, ROD_R, ZD + YOKE_H / 2, AXLE0 - 5.5 - (ZD + YOKE_H / 2), P1, 16), { tone: "hi", crease: "none" }));
  out.push(S(k.slabOf(head, ZD - YOKE_H / 2, YOKE_H, P1, 3, 0.4), { tone: "mid" }));
  out.push(`<g transform="${planeY(-0.6)}"><path class="fx-void" d="${slotD(x - RMAX - 0.4, x + RMAX + 0.4, -ZD, 1.25)}"/><path class="iso-line" data-tone="lo" d="${slotD(x - RMAX - 0.4, x + RMAX + 0.4, -ZD, 1.25)}"/></g>`);
  out.push(D([at([x - 8.9, -0.6, ZD + 1.6]), at([x + 8.9, -0.6, ZD + 1.6])], { size: 0.38 }));
  return out.join("");
}
// the crank pin: shaft through the slot and a washer, built at the disc centre and moved
function pin(x) {
  const F = FY(x, ZD);
  return S(G.disc(-3, -0.2, 1.05, F, P1), { tone: "hi" }) + S(G.disc(-0.2, 0.4, 1.9, F, P1), { tone: "hi", crease: "lo", lit: true }) + D([at([x, 0.4, ZD])], { size: 0.45, tone: "hi" });
}

function railAndBushings() {
  const out = [];
  for (const x of [X1 - 12, X7 + 12]) {
    const b = { x: x - 2, y: BOX.y + BOX.d, w: 4, d: 10, r: 0.6 };
    out.push(S(k.slabOf(b, 38, RAIL.z - 38, P1, 2, 0.3), { tone: "mid" }));
  }
  const rail = { x: X1 - 14, y: 0, w: X7 - X1 + 28, d: 4, r: 0.6 };
  out.push(S(k.slabOf(rail, RAIL.z, RAIL.h, P1, 2, 0.4), { tone: "mid" }));
  out.push(D([X1 - 12, X7 + 12].map((x) => at([x, 2, RAIL.z + RAIL.h])), { size: 0.42 }));
  for (const x of COLS) {
    const b = { x: x - 3, y: -3.4, w: 6, d: 7.8, r: 0.9 };
    out.push(S(k.slabOf(b, BUSH.z, BUSH.top - BUSH.z, P1, 3, 0.4), { tone: "mid", inner: L(k.sideSeam(b, RAIL.z + RAIL.h / 2, P1, 3), { tone: "faint" }) }));
    out.push(L(k.ring(x, ROD_Y, ROD_R + 0.6, BUSH.top, P1, 16), { tone: "lo" }));
    out.push(D([at([x - 1.8, 3.2, BUSH.top]), at([x + 1.8, 3.2, BUSH.top])], { size: 0.38 }));
  }
  return out.join("");
}

// rod above the bushing: the same rod, drawn again over the bushing and clipped to what
// rises out of its top face (the clip stays put while the rod moves)
function rodUpper(x, i) {
  const ring = Array.from({ length: 24 }, (_, j) => at([x + (ROD_R + 0.2) * Math.cos((j / 24) * 2 * Math.PI), ROD_Y + (ROD_R + 0.2) * Math.sin((j / 24) * 2 * Math.PI), BUSH.top]));
  const xs = ring.map((p) => p[0]);
  const [cx, cy] = at([x, ROD_Y, BUSH.top]);
  const rect = `M${f2(Math.min(...xs) - 0.4)} ${f2(cy)}H${f2(Math.max(...xs) + 0.4)}V-20H${f2(Math.min(...xs) - 0.4)}Z`;
  return `<clipPath id="fx-rod-${i}"><path d="${pathOf(ring, true)}${rect}"/></clipPath><g clip-path="url(#fx-rod-${i})"><g data-fx="rodup">${S(k.cylinder(x, ROD_Y, ROD_R, ZD + YOKE_H / 2, AXLE0 - 5.5 - (ZD + YOKE_H / 2), P1, 16), { tone: "hi", crease: "none" })}</g></g>`;
}
// the pulley block on top of the rod: back cheek, cross bar, pulley
function block(x) {
  const out = [];
  out.push(S(k.slabOf({ x: x - 4.4, y: -3.6, w: 8.8, d: 0.8, r: 0.3 }, AXLE0 - 5.5, 9.2, P1, 2), { tone: "mid" }));
  out.push(S(k.slabOf({ x: x - 4.4, y: -3.6, w: 8.8, d: 4.2, r: 0.4 }, AXLE0 - 5.5, 1.4, P1, 2, 0.3), { tone: "mid" }));
  const F = FY(x, AXLE0);
  out.push(S(G.disc(-2.6, -0.4, MP_R, F, P1), { tone: "hi", crease: "lo", inner: L(G.arcOf(F, -1.5, MP_R, P1), { tone: "faint" }) }));
  out.push(`<g transform="${planeY(-0.4)}"><path class="iso-line" data-tone="lo" d="${circleD(x, -AXLE0, 1.3, 16)}"/></g>`);
  return out.join("");
}
// the front strap of the pulley block, over the wire
function strap(x) {
  return S(k.slabOf({ x: x - 1, y: -0.4, w: 2, d: 0.7, r: 0.3 }, AXLE0 - 5.5, 5.5 + 1.2, P1, 2), { tone: "mid" }) + D([at([x, 0.3, AXLE0])], { size: 0.42, tone: "hi" });
}

function anchor() {
  const [x, z] = ANCHOR;
  return S(k.slabOf({ x: x - 2, y: BOX.y + BOX.d, w: 4, d: 6.2, r: 0.5 }, z - 3, 3, P1, 2, 0.3), { tone: "mid" }) + L(k.ring(x, WY, 0.7, z, P1, 12), { tone: "lo" });
}

function guide() {
  const out = [];
  for (const z of [GUIDE.z0 - 2, GUIDE.z1]) out.push(S(k.slabOf({ x: GUIDE.x - 1.6, y: BOARD.y + BOARD.d, w: 3.2, d: GUIDE.y - (BOARD.y + BOARD.d) + 1.5, r: 0.5 }, z, 2, P1, 2, 0.3), { tone: "mid" }));
  out.push(S(k.cylinder(GUIDE.x, GUIDE.y, GUIDE.r, GUIDE.z0, GUIDE.z1 - GUIDE.z0, P1, 14), { tone: "hi", crease: "none" }));
  return out.join("");
}
// the pen carriage, built at the rest height ZP0
function carriage() {
  const out = [];
  const F = FY(X_PEN, ZP0);
  out.push(S(G.disc(PAPER.y, CARRIAGE.y, 0.35, F, P1), { tone: "hi" }));
  out.push(S(k.slabOf(CARRIAGE, ZP0 - 2.5, 5, P1, 2, 0.4), { tone: "mid", inner: L(k.sideSeam(CARRIAGE, ZP0, P1, 2), { tone: "faint" }) }));
  out.push(S(k.cylinder(X_PEN + 2.2, GUIDE.y, 1, ZP0 + 2.5, 3.2, P1, 16), { tone: "hi", crease: "lo" }));
  out.push(S(k.cylinder(X_PEN + 2.2, GUIDE.y, 0.55, ZP0 + 5.7, 0.8, P1, 12), { tone: "mid" }));
  out.push(L(k.ring(X_PEN, WY, 0.5, ZP0 + 2.5, P1, 12), { tone: "lo" }));
  out.push(L(k.ring(GUIDE.x, GUIDE.y, GUIDE.r + 0.4, ZP0 + 2.5, P1, 14), { tone: "lo" }));
  return out.join("");
}
// the guide rod above the carriage, clipped to what rises out of its top face
function guideUpper() {
  const ring = Array.from({ length: 20 }, (_, j) => at([GUIDE.x + (GUIDE.r + 0.2) * Math.cos((j / 20) * 2 * Math.PI), GUIDE.y + (GUIDE.r + 0.2) * Math.sin((j / 20) * 2 * Math.PI), ZP0 + 2.5]));
  const xs = ring.map((p) => p[0]);
  const [, cy] = at([GUIDE.x, GUIDE.y, ZP0 + 2.5]);
  const rect = `M${f2(Math.min(...xs) - 0.4)} ${f2(cy)}H${f2(Math.max(...xs) + 0.4)}V-20H${f2(Math.min(...xs) - 0.4)}Z`;
  return `<clipPath id="fx-guide"><path data-fx="guideclip" d="${pathOf(ring, true)}${rect}"/></clipPath><g clip-path="url(#fx-guide)">${S(k.cylinder(GUIDE.x, GUIDE.y, GUIDE.r, ZP0, GUIDE.z1 - ZP0, P1, 14), { tone: "hi", crease: "none" })}</g>`;
}

const fig1Body = [
  baseFig1(),
  board(),
  paperStatic(),
  rollers(),
  guide(),
  gearbox(),
  wheelStatic(),
  wheelSpokes(),
  wheelKnob(),
  postAndBeam(),
  fixedPulleys(),
  discs(),
  discFaces(),
  COLS.map((x) => `<g data-fx="yoke">${yoke(x)}</g>`).join(""),
  COLS.map((x) => `<g data-fx="pin">${pin(x)}</g>`).join(""),
  railAndBushings(),
  COLS.map((x, i) => rodUpper(x, i)).join(""),
  COLS.map((x) => `<g data-fx="block">${block(x)}</g>`).join(""),
  anchor(),
  `<g transform="${planeY(WY)}"><path class="iso-line fx-wire" data-tone="hi" data-fx="wire" d=""/></g>`,
  COLS.map((x) => `<g data-fx="strap">${strap(x)}</g>`).join(""),
  `<g data-fx="carriage">${carriage()}</g>`,
  guideUpper(),
  `<g data-fx="ends"></g>`,
];

const LABEL1 =
  "Un sintetizzatore armonico: sette manovelle mosse da un riduttore in rapporto 1, 2, 3 … 7 a 1, ciascuna con il perno a una distanza dal centro pari a un coefficiente di Fourier. Ogni perno alza e abbassa un giogo con una puleggia; un unico filo passa sotto le sette pulegge mobili e sopra otto pulegge fisse, così somma le loro altezze e muove una penna che scrive su una striscia di carta che scorre.";
const fig1Svg = k.figureSvg({ width: W1, height: H1, label: LABEL1, body: fig1Body });

// per signal: the scale that turns coefficients into crank throws, bounded by the pen's swing
const SCALE = Object.fromEntries(
  Object.keys(SIGNALS).map((key) => {
    const terms = termsOf(key);
    const top = Math.max(...terms.map((t) => Math.abs(t.amp)));
    return [key, Math.min(RMAX / top, PEN_SWING / (2 * peakOf(key)))];
  }),
);

// ====================================================================================
// Fig 2: the winding table
// ====================================================================================
const W2 = 720;
const H2 = 330;
const B2 = { x: -110, y: -70, w: 250, d: 120, r: 8 };
const PLINTH = { x: -100, y: -60, w: 120, d: 100, r: 5 };
const PLINTH_H = 14;
const TT = [-40, -10]; // turntable spindle
const TT_R = 40;
const TT_Z = PLINTH_H + 1.5; // platter bottom
const TT_H = 4;
const TT_TOP = TT_Z + TT_H + 0.4; // the paper on the platter
const WIND_R = 32; // radius drawn for the largest value of g
const G_MAX = WIND.mean + WIND.tones.reduce((s, t) => s + t.amp, 0);
const PLOT = { x: 34, y: -50, w: 96, d: 76, r: 3 }; // the plotter table
const PLOT_H = 8;
const CHART = { x0: PLOT.x + 8, x1: PLOT.x + PLOT.w - 8, y0: PLOT.y + 10, y1: PLOT.y + PLOT.d - 14 };
const C_MAX = 0.36; // full scale of the plot
const KNOB2 = [PLINTH.x + PLINTH.w - 14, PLINTH.y + PLINTH.d - 12];
const knobAngle = (f) => ((-135 + (270 * (f - WIND.range[0])) / (WIND.range[1] - WIND.range[0])) * Math.PI) / 180;

const P2 = k.fitProjection([...k.boxCorners(B2, -17, 0), [TT[0] + TT_R + 9, TT[1] - 22, TT_TOP + 13]], W2, H2, { pad: 20, azimuth: 62, elevation: 34 });
const at2 = (p) => k.iso(p, P2);

function baseFig2() {
  const out = [`<path class="iso-halo" d="${k.haloOf(B2, -17, 12, P2)}"/>`];
  for (const [x, y] of byDepth(k.corners(B2, 18), P2)) {
    out.push(S(k.cylinder(x, y, 7, -17, 1.6, P2, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 5.4, -15.4, 3.4, P2, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(B2, -12, 12, P2, 8, 1.6), { tone: "mid", inner: L(k.sideSeam(B2, -8, P2, 8), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(B2, 5), 0, P2), { tone: "lo" }));
  const screws = k.corners(B2, 9);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P2, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => at2([x, y, 0])), { size: 0.5 }));
  return out.join("");
}

function plinth() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLINTH, 0, PLINTH_H, P2)}" style="opacity:.5"/>`];
  out.push(S(k.slabOf(PLINTH, 0, PLINTH_H, P2, 6, 1), { tone: "mid", inner: L(k.sideSeam(PLINTH, 4, P2, 6), { tone: "faint" }) }));
  out.push(L(k.planOutline(k.insetPlan(PLINTH, 3.5), PLINTH_H, P2, 6), { tone: "faint" }));
  out.push(D(k.corners(PLINTH, 6).map(([x, y]) => at2([x, y, PLINTH_H])), { size: 0.45 }));
  // bearing ring under the platter
  out.push(S(k.cylinder(TT[0], TT[1], TT_R - 6, PLINTH_H, 1.5, P2, 72), { tone: "lo" }));
  // the frequency knob and its dial: 0.5 … 4.5 Hz over 270°, a tick every 0.25 Hz, majors on whole hertz
  const [kx, ky] = KNOB2;
  out.push(S(k.cylinder(kx, ky, 8.6, PLINTH_H, 0.6, P2, 48), { tone: "lo", crease: "none" }));
  const minor = [];
  const major = [];
  for (let f = WIND.range[0]; f <= WIND.range[1] + 1e-9; f += 0.25) {
    const a = knobAngle(f);
    const big = Math.abs(f - Math.round(f)) < 1e-6;
    const r0 = 8.2 - (big ? 2 : 1);
    (big ? major : minor).push(k.lineOnTop([kx + r0 * Math.sin(a), ky - r0 * Math.cos(a)], [kx + 8.2 * Math.sin(a), ky - 8.2 * Math.cos(a)], PLINTH_H + 0.6, P2));
  }
  out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  out.push(S(k.cylinder(kx, ky, 4.4, PLINTH_H + 0.6, 4, P2, 32), { tone: "mid" }), L(k.knurl(kx, ky, 4.4, PLINTH_H + 0.6, PLINTH_H + 4.6, 30, P2), { tone: "lo" }));
  out.push(`<path class="iso-line" data-tone="lit" data-free="start" data-fx="knob2" d="" style="stroke-width:1"/>`);
  out.push(k.faceTextSvg(k.topMatrix([kx - 9, ky + 11], PLINTH_H, P2, "x"), "f (Hz)", { size: 2.4, tone: "lo", anchor: "start" }));
  return out.join("");
}

function platter() {
  const out = [];
  const [x, y] = TT;
  out.push(S(k.cylinder(x, y, TT_R, TT_Z, TT_H, P2, 96, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(x, y, TT_R, TT_Z + 0.6, TT_Z + TT_H - 0.6, 120, P2, 0.4), { tone: "faint" }));
  out.push(S(k.cylinder(x, y, TT_R - 3, TT_Z + TT_H, 0.4, P2, 96), { tone: "hi", crease: "none", flat: true }));
  return out.join("");
}
// on the paper: the ticks, the wound curve and the centroid vector, all redrawn as it turns
function platterLive() {
  const t = k.radialTicks(TT[0], TT[1], TT_R - 3.6, 72, 6, TT_TOP, [1.2, 2.6], P2);
  return `<path class="iso-line" data-tone="lo" d="${t.minor}"/><path class="iso-line" data-tone="mid" d="${t.major}"/><path class="iso-line" data-tone="faint" d="${k.ring(TT[0], TT[1], WIND_R * (WIND.mean / G_MAX), TT_TOP, P2, 72)}"/><path class="iso-line fx-wound" data-tone="hi" data-fx="wound" d=""/><path class="iso-line" data-tone="lit" data-fx="vector" d="" style="stroke-width:1"/>`;
}
function spindle() {
  const [x, y] = TT;
  return S(k.cylinder(x, y, 2.2, TT_TOP, 1.2, P2, 20), { tone: "mid" }) + S(k.cylinder(x, y, 0.9, TT_TOP + 1.2, 3, P2, 14), { tone: "hi", crease: "lo" });
}
function puck() {
  // the centre of mass: a small brass weight that sits on the paper, moved by translation
  const [x, y] = TT;
  return `<g data-fx="puck">${S(k.cylinder(x, y, 2.6, TT_TOP, 1.6, P2, 24), { tone: "hi", crease: "lo", lit: true })}${D([at2([x, y, TT_TOP + 1.6])], { size: 0.5, tone: "hi" })}</g>`;
}
// the tonearm: a post beside the platter and an arm whose pen rests where every drawing starts
// and ends: g(0) = g(4 s) is the largest value, drawn at the full radius toward +x
const ARM = { post: [TT[0] + TT_R + 9, TT[1] - 22], head: [TT[0] + WIND_R, TT[1]], z: TT_TOP + 9 };
function tonearm() {
  const out = [];
  const { post, head, z } = ARM;
  const len = Math.hypot(head[0] - post[0], head[1] - post[1]);
  const d = [(head[0] - post[0]) / len, (head[1] - post[1]) / len];
  const n = [-d[1], d[0]];
  const bar = (from, to, w) => [[from[0] + n[0] * w, from[1] + n[1] * w], [to[0] + n[0] * w, to[1] + n[1] * w], [to[0] - n[0] * w, to[1] - n[1] * w], [from[0] - n[0] * w, from[1] - n[1] * w]];
  const tail = [post[0] - d[0] * 9, post[1] - d[1] * 9];
  out.push(S(k.cylinder(post[0], post[1], 5, PLINTH_H, 1.4, P2, 32), { tone: "lo" }));
  out.push(D(Array.from({ length: 4 }, (_, i) => at2([post[0] + 4 * Math.cos(i * 1.57 + 0.4), post[1] + 4 * Math.sin(i * 1.57 + 0.4), PLINTH_H + 1.4])), { size: 0.4 }));
  out.push(S(k.extrude(bar(tail, post, 1.2), z + 0.6, 1.6, P2), { tone: "mid" }));
  out.push(S(k.cylinder(tail[0], tail[1], 3.2, z - 0.6, 4, P2, 24), { tone: "mid", inner: L(k.sideArc(tail[0], tail[1], 3.2, z + 1.4, P2, 16), { tone: "faint" }) }));
  out.push(S(k.cylinder(post[0], post[1], 2.4, PLINTH_H + 1.4, z - PLINTH_H - 1.4, P2, 20), { tone: "mid", inner: L(k.sideArc(post[0], post[1], 2.4, PLINTH_H + 6, P2, 12), { tone: "faint" }) }));
  out.push(S(k.cylinder(post[0], post[1], 3.2, z, 3, P2, 24), { tone: "mid" }), L(k.knurl(post[0], post[1], 3.2, z, z + 3, 20, P2), { tone: "lo" }));
  out.push(S(k.extrude(bar(post, head, 1.1), z + 0.8, 1.4, P2), { tone: "mid" }));
  out.push(S(k.cylinder(head[0], head[1], 0.45, TT_TOP, z - 0.4 - TT_TOP, P2, 10), { tone: "hi", crease: "none" }));
  out.push(S(k.cylinder(head[0], head[1], 2.2, z - 0.4, 3.4, P2, 18), { tone: "hi", crease: "lo" }));
  out.push(D([at2([head[0], head[1], z + 3])], { size: 0.45, tone: "hi" }));
  return out.join("");
}

function plotter() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLOT, 0, PLOT_H, P2)}" style="opacity:.5"/>`];
  out.push(S(k.slabOf(PLOT, 0, PLOT_H, P2, 4, 0.8), { tone: "mid", inner: L(k.sideSeam(PLOT, 3, P2, 4), { tone: "faint" }) }));
  const z = PLOT_H;
  const { x0, x1, y0, y1 } = CHART;
  out.push(`<path class="fx-paper" d="${k.onTop([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z, P2, true)}"/>`);
  out.push(L(k.onTop([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z, P2, true), { tone: "lo" }));
  // grid: a line every 0.5 Hz, and every 0.1 of |c|
  const fx = (f) => x0 + ((f - WIND.range[0]) / (WIND.range[1] - WIND.range[0])) * (x1 - x0);
  const cy = (c) => y1 - (c / C_MAX) * (y1 - y0);
  const grid = [];
  for (let f = WIND.range[0] + 0.5; f < WIND.range[1]; f += 0.5) grid.push(k.lineOnTop([fx(f), y0], [fx(f), y1], z, P2));
  for (let c = 0.1; c < C_MAX; c += 0.1) grid.push(k.lineOnTop([x0, cy(c)], [x1, cy(c)], z, P2));
  out.push(L(grid.join(""), { tone: "faint" }));
  // the spectrum |c(f)|, drawn from the model
  const curve = [];
  for (let i = 0; i <= 320; i++) {
    const f = WIND.range[0] + (i / 320) * (WIND.range[1] - WIND.range[0]);
    curve.push([fx(f), cy(Math.hypot(...centroid(f)))]);
  }
  out.push(L(k.onTop(curve, z, P2), { tone: "mid", className: "fx-spectrum" }));
  // the ruler of frequencies along the front edge
  const strip = { x: x0, y: y1 + 3, w: x1 - x0, d: 6, r: 0.8 };
  out.push(S(k.slabOf(strip, z, 0.5, P2, 3), { tone: "lo", crease: "none" }));
  const ticks = { minor: [], major: [] };
  for (let f = WIND.range[0]; f <= WIND.range[1] + 1e-9; f += 0.1) {
    const big = Math.abs(f * 2 - Math.round(f * 2)) < 1e-6;
    (big ? ticks.major : ticks.minor).push(k.lineOnTop([fx(f), strip.y + 0.6], [fx(f), strip.y + 0.6 + (big ? 2.8 : 1.4)], z + 0.5, P2));
  }
  out.push(L(ticks.minor.join(""), { tone: "lo" }), L(ticks.major.join(""), { tone: "mid" }));
  for (const f of [1, 2, 3, 4]) out.push(k.faceTextSvg(k.topMatrix([fx(f), strip.y + 5.4], z + 0.5, P2, "x"), String(f), { size: 2.2, tone: "lo", anchor: "middle" }));
  // the rail along the back and the screws
  const rail = { x: PLOT.x + 3, y: PLOT.y + 2.5, w: PLOT.w - 6, d: 4, r: 0.8 };
  out.push(S(k.slabOf(rail, z, 2.5, P2, 2, 0.4), { tone: "mid" }));
  out.push(D([at2([rail.x + 2, rail.y + 2, z + 2.5]), at2([rail.x + rail.w - 2, rail.y + 2, z + 2.5])], { size: 0.42 }));
  out.push(D(k.corners(PLOT, 4).map(([x, y]) => at2([x, y, z])), { size: 0.42 }));
  return out.join("");
}
// the plotter's carriage (moved along x by f) with its cross arm over the chart, and the pen (moved in y by |c|)
function plotCarriage() {
  const x = CHART.x0;
  const z = PLOT_H + 2.5;
  const arm = { x: x - 1.4, y: PLOT.y + 2, w: 2.8, d: CHART.y1 - PLOT.y, r: 0.6 };
  return S(k.slabOf({ x: x - 4, y: PLOT.y + 1.5, w: 8, d: 5, r: 0.8 }, z, 3, P2, 2, 0.4), { tone: "mid" }) + S(k.slabOf(arm, z + 1, 1.2, P2, 2, 0.3), { tone: "mid", crease: "none" });
}
function plotPen() {
  const x = CHART.x0;
  const y = CHART.y1;
  return S(k.cylinder(x, y, 1.8, PLOT_H + 2.2, 1.6, P2, 18), { tone: "hi", crease: "lo", lit: true }) + D([at2([x, y, PLOT_H + 3.8])], { size: 0.5, tone: "hi" });
}

const fig2Body = [
  baseFig2(),
  plinth(),
  platter(),
  platterLive(),
  spindle(),
  puck(),
  tonearm(),
  plotter(),
  `<g data-fx="plotcar">${plotCarriage()}</g>`,
  `<g data-fx="plotpen">${plotPen()}</g>`,
];
const LABEL2 =
  "Un tavolo ad avvolgimento: un piatto girevole su cui una penna, mossa avanti e indietro sul raggio dal segnale, disegna il segnale avvolto attorno al perno. Un peso indica il baricentro della curva; accanto, un plotter traccia quanto il baricentro dista dal perno al variare della frequenza di rotazione.";
const fig2Svg = k.figureSvg({ width: W2, height: H2, label: LABEL2, body: fig2Body });

// ====================================================================================
// page
// ====================================================================================
const DATA = {
  fig1: {
    P: P1,
    cols: COLS,
    ZD,
    axle0: AXLE0,
    zp0: ZP0,
    xPen: X_PEN,
    wy: WY,
    paper: PAPER,
    v: PAPER_V,
    fpx: FPX,
    fpz: FP_Z,
    fpr: FP_R,
    mpr: MP_R,
    anchor: ANCHOR,
    carriageTop: ZP0 + 2.5,
    guide: GUIDE,
    wheel: { y: WHEEL.y, z: WHEEL.z, r: KNOB_R },
    scale: SCALE,
  },
  fig2: { P: P2, tt: TT, top: TT_TOP, R: TT_R, windR: WIND_R, gMax: G_MAX, chart: CHART, cMax: C_MAX, knob: KNOB2, knobTop: PLINTH_H + 4.6, plotZ: PLOT_H },
};

const fig1 = k.plateHtml({
  fig: "Fig 1",
  title: "Sintetizzatore armonico",
  hint: "Trascina: gira la manovella",
  readout: "",
  keys: [
    { mark: "lit", label: "La penna e la curva che scrive: la somma delle armoniche" },
    { mark: "dotted", label: "Il segnale cercato, stampato sulla carta" },
    { mark: "raised", label: "Sette manovelle, rapporti 1:1 … 7:1 (i punti sotto ciascuna)" },
  ],
  caption:
    "Ogni manovella gira n volte per ogni giro della prima, e il suo perno sta a una distanza dal centro pari al coefficiente bₙ: il giogo trasforma il giro in un'oscillazione pura, bₙ·sin(nθ). Il filo passa sotto le sette pulegge mobili e sopra otto fisse, con ogni tratto a piombo, quindi la penna si sposta esattamente del doppio della somma delle altezze. Con poche armoniche la curva arrotonda gli spigoli; con tutte e sette, sui salti resta il picco di Gibbs (circa il 9% del salto).",
  body: `<div class="iso-stage fx-stage" data-fig="1" tabindex="0" role="group" aria-label="Sintetizzatore armonico: trascina orizzontalmente per girare la manovella; frecce sinistra e destra per togliere o aggiungere armoniche; tasti da 1 a 4 per cambiare segnale">${fig1Svg}</div>
<div class="fx-controls">
<div class="fx-seg" role="radiogroup" aria-label="Segnale">${Object.entries(SIGNALS).map(([key, s], i) => `<button type="button" role="radio" data-signal="${key}" aria-checked="${i === 0}">${s.name}</button>`).join("")}</div>
<label class="fx-control"><span>Armoniche</span><input type="range" min="1" max="${HARMONICS}" value="${HARMONICS}" data-input="count"><output data-show="count">${HARMONICS}</output></label>
<div class="fx-coefs" aria-hidden="true">${Array.from({ length: HARMONICS }, (_, i) => `<span><i data-coef="${i}"></i><b>${i + 1}</b></span>`).join("")}</div>
</div>`,
});

const fig2 = k.plateHtml({
  fig: "Fig 2",
  title: "Tavolo ad avvolgimento",
  hint: "Manopola: frequenza",
  readout: "",
  keys: [
    { mark: "lit", label: "Il baricentro della curva avvolta e il suo vettore dal perno" },
    { mark: "raised", label: "Il segnale g(t) avvolto: una penna sul raggio, il piatto che gira a f" },
  ],
  caption:
    "Il segnale g(t) = 1 + 0,6·cos(2π·2t) + 0,4·cos(2π·3t), lungo 4 secondi, viene disegnato come raggio mentre il piatto compie f giri al secondo. Per quasi ogni f la curva si distribuisce tutta intorno al perno e il baricentro resta al centro; quando f coincide con una frequenza contenuta nel segnale, i lobi si allineano da una parte e il baricentro si sposta: di 0,30 a 2 Hz e di 0,20 a 3 Hz, metà delle ampiezze. Quella distanza, con il suo angolo, è ĝ(f). A 0 Hz il baricentro sarebbe a 1, la media del segnale, fuori scala.",
  body: `<div class="iso-stage fx-stage" data-fig="2" tabindex="0" role="slider" aria-label="Tavolo ad avvolgimento: frecce per cambiare la frequenza di rotazione" aria-valuemin="${WIND.range[0]}" aria-valuemax="${WIND.range[1]}" aria-valuenow="1">${fig2Svg}</div>
<div class="fx-controls"><label class="fx-control fx-wide"><span>Frequenza di avvolgimento</span><input type="range" min="${WIND.range[0] * 100}" max="${WIND.range[1] * 100}" value="100" step="1" data-input="freq"><output data-show="freq">1,00 Hz</output></label></div>`,
});

const CSS = readFileSync(join(HERE, "fourier.css"), "utf8");
const MODEL = readFileSync(join(HERE, "model.mjs"), "utf8").replace(/^export /gm, "");
const LIVE = MODEL + "\n" + readFileSync(join(HERE, "live.js"), "utf8").replace("__DATA__", JSON.stringify(DATA));
const text = prose({ fig1, fig2 });
const KATEX_CSS = `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.47/dist/katex.min.css" crossorigin="anonymous">`;
let page = k.pageHtml({ title: "Fourier — scomporre un segnale in cerchi", theme: "light", body: `<style>${CSS}</style>${text}`, script: kitScript() + LIVE, width: 760 });
page = page
  .replace('<html lang="en">', '<html lang="it">')
  .replace(/<body class="iso" data-theme="light">/, `<body class="iso" data-theme="light"><script>if(matchMedia("(prefers-color-scheme: dark)").matches&&!/tema=chiaro/.test(location.search)||/tema=scuro/.test(location.search))document.body.setAttribute("data-theme","dark")</script>`)
  .replace("</head>", `${KATEX_CSS}<script src="../preview.js"></script><script>if(/[?&]preview/.test(location.search))document.documentElement.classList.add("fx-preview")</script></head>`);
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), page);
console.log(`wrote public/designs/fourier/index.html · ${(page.length / 1024).toFixed(0)} KB`);
