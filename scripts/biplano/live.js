const DATA = __DATA__;
const follow = null;
const stage = document.querySelector(".bp-stage");
const readout = document.querySelector("[data-readout]");
const live = document.querySelector("[data-phase]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const hoverable = matchMedia("(hover: hover) and (pointer: fine)");
const preview = new URLSearchParams(location.search).has("preview");
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const ease = (x, target, dt, tau, calm) => (calm ? target : x + (target - x) * (1 - Math.exp(-dt / tau)));

// what the reader sets, and what the rig shows
const want = { sp: 0, sr: 0, thr: 0.62 };
const now = { sp: 0, sr: 0, thr: 0.62, alpha: 6, bank: 0, prop: 0 };
const alphaOf = (sp) => 6 + 11 * sp;

// idle tour: cruise, full power climb, slow to the stall, recover, roll each way
const TOUR = [
  [0, { sp: 0, sr: 0, thr: 0.62 }],
  [3.5, { sp: 0, sr: 0, thr: 1 }],
  [7, { sp: -0.3, sr: 0, thr: 0.45 }],
  [10, { sp: 0.55, sr: 0, thr: 0.3 }],
  [13, { sp: 1, sr: 0, thr: 0.3 }],
  [16, { sp: 0.1, sr: 0, thr: 1 }],
  [19, { sp: 0.1, sr: -0.85, thr: 0.7 }],
  [21.5, { sp: 0.1, sr: 0.85, thr: 0.7 }],
  [24, { sp: 0, sr: 0, thr: 0.62 }],
];
const TOUR_END = 27;
const tourAt = (t) => {
  const time = t % TOUR_END;
  let pick = TOUR[0][1];
  for (const [from, values] of TOUR) if (time >= from) pick = values;
  return pick;
};

let touring = !still.matches;
let clock = 0;
let idle = 0;
let frame = 0;
let last = 0;
let visible = false;
let phase = "";
const hold = () => {
  touring = false;
  clearTimeout(idle);
  idle = setTimeout(() => {
    touring = !still.matches;
    clock = 0;
    run();
  }, 4000);
};

const controller = TURN.mount(stage, DATA.turn, { follow, onHold: () => { touring = false; clearTimeout(idle); } });
const P = DATA.P;
const needles = Object.fromEntries([...document.querySelectorAll("[data-needle]")].map((el) => [el.dataset.needle, el]));
const needleAt = ([x, y], deg) => {
  const a = (deg * Math.PI) / 180;
  const r = DATA.dialR;
  return lineOnTop([x - Math.sin(a) * 1.8, y + Math.cos(a) * 1.8], [x + Math.sin(a) * (r - 2), y - Math.cos(a) * (r - 2)], DATA.dialTop + 0.2, P);
};
const blades = [...stage.querySelectorAll('[data-name^="prop.blade"]')];
const inputs = Object.fromEntries([...document.querySelectorAll("[data-input]")].map((el) => [el.dataset.input, el]));
const shows = Object.fromEntries([...document.querySelectorAll("[data-show]")].map((el) => [el.dataset.show, el]));
const showInputs = () => {
  const values = { thr: Math.round(want.thr * 100), sp: Math.round(want.sp * 100), sr: Math.round(want.sr * 100) };
  for (const [key, value] of Object.entries(values)) {
    if (inputs[key] && document.activeElement !== inputs[key] && Number(inputs[key].value) !== value) inputs[key].value = String(value);
  }
  if (shows.thr) shows.thr.textContent = `${values.thr}%`;
  if (shows.sp) shows.sp.textContent = values.sp > 4 ? "tirata" : values.sp < -4 ? "spinta" : "al centro";
  if (shows.sr) shows.sr.textContent = values.sr > 4 ? "a destra" : values.sr < -4 ? "a sinistra" : "al centro";
};

const fmt = (x, digits = 0) => x.toFixed(digits).replace(".", ",").replace("-", "−");
function draw() {
  const f = flight(now.alpha, now.thr);
  controller.set({ alpha: now.alpha, bank: now.bank, sp: now.sp, sr: now.sr, thr: now.thr, prop: now.prop });
  const kmh = Math.min(250, f.kmh);
  needles.asi?.setAttribute("d", needleAt(DATA.dials.asi, -150 + 300 * (kmh / 250)));
  needles.vsi?.setAttribute("d", needleAt(DATA.dials.vsi, -90 + 17 * clamp(f.climb, -10, 10)));
  const blur = clamp((f.rpm - 900) / 1300, 0, 1);
  stage.style.setProperty("--bp-blur", blur.toFixed(3));
  for (const el of blades) el.style.opacity = String(1 - 0.72 * blur);
  const climbWord = f.stalled ? "stallo" : f.climb > 0.3 ? `sale ${fmt(f.climb, 1)} m/s` : f.climb < -0.3 ? `scende ${fmt(-f.climb, 1)} m/s` : "in quota";
  const text = `${fmt(f.kmh)} km/h · α ${fmt(now.alpha, 1)}° · ${climbWord}`;
  if (readout.textContent !== text) readout.textContent = text;
  stage.toggleAttribute("data-stall", f.stalled);
  const next = f.stalled ? "Stallo: oltre 14° il flusso si stacca dall'ala, la portanza crolla sotto il peso" : f.climb > 0.3 ? "In salita: la spinta supera la resistenza" : f.climb < -0.3 ? "In discesa: la spinta non basta a vincere la resistenza" : "In volo livellato";
  if (next !== phase) {
    phase = next;
    if (!touring) live.textContent = phase;
  }
  showInputs();
}

function tick(time) {
  const dt = last ? Math.min((time - last) / 1000, 1 / 30) : 1 / 60;
  last = time;
  const calm = still.matches;
  if (calm && touring) touring = false;
  if (touring) {
    clock += dt;
    Object.assign(want, tourAt(clock));
  }
  const before = JSON.stringify(now);
  now.sp = ease(now.sp, want.sp, dt, 0.18, calm);
  now.sr = ease(now.sr, want.sr, dt, 0.18, calm);
  now.thr = ease(now.thr, want.thr, dt, 0.35, calm);
  // the rig answers the controls with the slower response of the whole aircraft
  now.alpha = ease(now.alpha, alphaOf(now.sp), dt, 0.7, calm);
  now.bank = ease(now.bank, 12 * now.sr, dt, 0.6, calm);
  for (const key of ["sp", "sr", "thr", "alpha", "bank"]) if (Math.abs(now[key] - (key === "alpha" ? alphaOf(want.sp) : key === "bank" ? 12 * want.sr : want[key])) < 1e-4) now[key] = key === "alpha" ? alphaOf(want.sp) : key === "bank" ? 12 * want.sr : want[key];
  // the propeller is drawn as if under a strobe: a fraction of its true speed
  const rpm = flight(now.alpha, now.thr).rpm;
  if (!calm) now.prop = (now.prop + (rpm / 60) * 360 * dt * 0.06) % 360;
  draw();
  const settled = calm && !touring && before === JSON.stringify(now);
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => {
  if (!frame && visible) {
    last = 0;
    frame = requestAnimationFrame(tick);
  }
};
new IntersectionObserver(
  (entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
    else if (frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  },
  { rootMargin: "120px 0px" },
).observe(stage);

const steer = (values) => {
  hold();
  Object.assign(want, values);
  want.sp = clamp(want.sp, -0.5, 1);
  want.sr = clamp(want.sr, -1, 1);
  want.thr = clamp(want.thr, 0, 1);
  run();
};
if (!preview) {
  stage.addEventListener("pointermove", (event) => {
    if (!hoverable.matches) return;
    const box = stage.getBoundingClientRect();
    const fx = (event.clientX - box.left) / box.width;
    const fy = (event.clientY - box.top) / box.height;
    steer({ sr: clamp((fx - 0.5) / 0.38, -1, 1), sp: -0.5 + 1.5 * clamp((fy - 0.1) / 0.8, 0, 1) });
  });
  stage.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.25 : 0.1;
    const keys = {
      ArrowUp: { sp: want.sp - step },
      ArrowDown: { sp: want.sp + step },
      ArrowLeft: { sr: want.sr - step },
      ArrowRight: { sr: want.sr + step },
      PageUp: { thr: want.thr + step },
      "+": { thr: want.thr + step },
      PageDown: { thr: want.thr - step },
      "-": { thr: want.thr - step },
      Home: { sp: 0, sr: 0 },
    };
    const values = keys[event.key];
    if (!values) return;
    event.preventDefault();
    steer(values);
  });
  for (const [key, input] of Object.entries(inputs)) input.addEventListener("input", () => steer({ [key]: Number(input.value) / 100 }));
  stage.addEventListener("focus", () => (live.textContent = phase));
}
if (still.matches) touring = false;
draw();
