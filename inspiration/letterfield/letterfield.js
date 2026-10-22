import { Pane } from "https://esm.sh/tweakpane";
import { Vec2 } from "https://esm.sh/wtc-math";

console.clear();

const SETTINGS = {
  fontSize: 150,
  char: 'a',
  pattern: 'Cycle',
  paletteScale: .5,
  paletteOffset: 1.2,
  timeScale: 1,
  palette: {
    a: { r: 0.5, g: 0.5, b: 0.5 },
    b: { r: 0.5, g: 0.5, b: 0.5 },
    c: { r: 1.0, g: 1.0, b: 1.0 },
    d: { r: 0.3, g: 0.1, b: 0.67 }
  },
  LUT_STEPS: 64 // LUTs are used to save a cache of expensive calculations
};

// State
let gridItems = [];
let mouse = new Vec2(window.innerWidth / 2, window.innerHeight / 2);
let WWidth = 0;
let dims = new Vec2(0);
let hdims = new Vec2(0);
let gridDim = new Vec2(0);
// Lookup tables
let colorLUT = [];
let weightLUT = [];
let oobColor,oobWeight;
// Transition state
const ts = {
  currentState: 0,
  previousState: -1,
  transitionProgress: 1,
  TRANSITION_DURATION: 1500,
  transitionStartTime: 0,
}

// Utilities
function buildLUTs() {
  colorLUT = new Array(SETTINGS.LUT_STEPS);
  weightLUT = new Array(SETTINGS.LUT_STEPS);
  oobColor = palette(-.2, SETTINGS.palette);
  oobWeight = 100;
  for (let i = 0; i < SETTINGS.LUT_STEPS; i++) {
    const t = i / (SETTINGS.LUT_STEPS - 1);
    colorLUT[i] = palette(t, SETTINGS.palette);
    weightLUT[i] = Math.round(100 + t * 800);
  }
}
function getTextWidth(text, font) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = font;
  const metrics = context.measureText(text);
  const width = metrics.width;
  const height = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
  
  return Math.max(width, height);
}
function htmlToElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstChild;
}
function palette(t, p) {
  t = t * SETTINGS.paletteScale + SETTINGS.paletteOffset;
  const r = (p.a.r + p.b.r * Math.cos(6.28318 * (p.c.r * t + p.d.r))) * 255;
  const g = (p.a.g + p.b.g * Math.cos(6.28318 * (p.c.g * t + p.d.g))) * 255;
  const b = (p.a.b + p.b.b * Math.cos(6.28318 * (p.c.b * t + p.d.b))) * 255;
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

// Ripple character transition, when changing characters
let transitionTimers = [];
function updateCharacter(newChar) {
  const totalDuration = 600; // ms for the full ripple to propagate
  const flipDuration = 150;  // ms for each cell's shrink-grow
  
  for (const id of transitionTimers) clearTimeout(id);
  transitionTimers = [];
  
  const origin = { x: dims.x * 0.95, y: dims.y * 0.5 }

  // Compute distances
  const distances = [];
  let maxDist = 0;
  for (let i = 0; i < gridItems.length; i++) {
    const item = gridItems[i];
    const d = { x: item.x - origin.x, y: item.y - origin.y }
    const dist = Math.hypot(d.x,d.y);
    distances.push(dist);
    if (dist > maxDist) maxDist = dist;
  }

  for (let i = 0; i < gridItems.length; i++) {
    const item = gridItems[i];
    const delay = (distances[i] / maxDist) * totalDuration;
    item.el.style.transition = `transform ${flipDuration}ms ease-in`;
    item.el.style.transformOrigin = 'center center';
    // Schedule shrink
    const t1 = setTimeout(() => {
      item.el.style.transform = 'scale(0)';
    }, delay);
    // Schedule char swap + grow
    const t2 = setTimeout(() => {
      item.el.textContent = newChar;
      item.el.style.transition = `transform ${flipDuration}ms ease-out`;
      item.el.style.transform = 'scale(1)';
    }, delay + flipDuration);
    // Clean up inline transition
    const t3 = setTimeout(() => {
      item.el.style.transition = '';
      item.el.style.transform = '';
    }, delay + flipDuration * 2 + 50);
    transitionTimers.push(t1, t2, t3);
  }
}

function init() {
  dims.reset(window.innerWidth, window.innerHeight );
  hdims.reset(window.innerWidth / 2, window.innerHeight / 2 );

  WWidth = getTextWidth(SETTINGS.char, `900 ${SETTINGS.fontSize}px Inter`);
  gridDim.resetToVector(dims.scaleNew(1/WWidth)).ceil();

  letterfield.innerHTML = '';
  letterfield.style.setProperty('--w-width', `${WWidth}px`);
  letterfield.style.setProperty('font-size', `${SETTINGS.fontSize}px`);
  letterfield.style.setProperty('width', `${WWidth * gridDim.x}px`);
  letterfield.style.setProperty('height', `${WWidth * gridDim.y}px`);

  gridItems = [];
  for (let i = 0; i < gridDim.x * gridDim.y; i++) {
    const el = htmlToElement(`<div>${SETTINGS.char}</div>`);
    letterfield.appendChild(el);
    gridItems.push({
      el,
      pos: new Vec2(
        (i % gridDim.x) * WWidth + WWidth / 2, 
        Math.floor(i / gridDim.x) * WWidth + WWidth / 2
      ),
      x: (i % gridDim.x) * WWidth + WWidth / 2,
      y: Math.floor(i / gridDim.x) * WWidth + WWidth / 2,
      bucket: -1
    });
  }

  buildLUTs();
}

function getStateVal(state, item, time, cosA, sinA) {
  if (state === 3) {
    const dx = item.x - hdims.x;
    const dy = item.y - hdims.y + hdims.y / 2.5;
    return (dy + Math.cos(dx * .002 + time * .003) * 150) * .004 - .5;
  } else if (state === 0) {
    const dx = item.x - hdims.x;
    const dy = item.y - hdims.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.sin(dist * 0.01 - time * 0.005) * 0.5 + 0.5;
  } else if (state === 1) {
    const v = (cosA * item.x + sinA * item.y) * 0.002;
    return Math.cos(v * 2) * .5 + .5;
  } else {
    const dx = item.x - mouse.x;
    const dy = item.y - mouse.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    return Math.max(0, 1 - dist / 500);
  }
}

function animate(time) {
  time = time * SETTINGS.timeScale;
  const cycleDuration = 20000;
  const progress = (time % cycleDuration) / (cycleDuration / 4);

  let activeState;
  if (SETTINGS.pattern === 'Cycle') {
    activeState = Math.floor(progress);
  } else {
    activeState = ['Ripple', 'Gradient', 'Mouse', "Wave"].indexOf(SETTINGS.pattern);
  }

  const mx = mouse.x;
  const my = mouse.y;
  const maxBucket = SETTINGS.LUT_STEPS - 1;

  const angle = time * 0.001;
  const cosA = Math.cos(angle) * 2;
  const sinA = Math.sin(angle) * 2;
  
  // Detect state change
  if (activeState !== ts.currentState) {
    ts.previousState = ts.currentState;
    ts.currentState = activeState;
    ts.transitionStartTime = time;
    ts.transitionProgress = 0;
  }

  // Update transition progress with easing
  if (ts.transitionProgress < 1) 
    ts.transitionProgress = Math.min(1,
      (time - ts.transitionStartTime) / ts.TRANSITION_DURATION);
  const t = ts.transitionProgress * ts.transitionProgress * (3 - 2 * ts.transitionProgress); // smoothstep

  for (let i = 0, len = gridItems.length; i < len; i++) {
    const item = gridItems[i];
    
    const newVal = getStateVal(ts.currentState, item, time, cosA, sinA);
    let val;
    if (t < 1 && ts.previousState >= 0) {
      const oldVal = getStateVal(ts.previousState, item, time, cosA, sinA);
      val = oldVal + (newVal - oldVal) * t;
    } else {
      val = newVal;
    }

    const bucket = Math.min(Math.round(val * maxBucket), maxBucket) | 0;

    if (bucket === item.bucket) continue;
    item.bucket = bucket;

    
    // letterfield.style.setProperty('--font-weight', weightLUT[bucket] || oobWeight);
    // letterfield.style.setProperty('--color', colorLUT[bucket] || oobColor);
    item.el.style.fontWeight = weightLUT[bucket] || oobWeight;
    item.el.style.color = colorLUT[bucket] || oobColor;
  }

  requestAnimationFrame(animate);
}

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(init, 100);
});
window.addEventListener('load', () => {
  document.fonts.ready.then(() => {
    init();
    requestAnimationFrame(animate);
  });
});

const pane = new Pane({ title: "Letterfield", expanded: false });
pane.addBinding(SETTINGS, 'fontSize', { min: 50, max: 300 }).on('change', () => init());
const charBinding = pane.addBinding(SETTINGS, 'char', { label: "Character" });
const inputElement = charBinding.controller.valueController.view.inputElement;
inputElement.addEventListener('keyup', (event) => {
  updateCharacter(event.key);
});
pane.addBinding(SETTINGS, 'pattern', {
  options: { Cycle: 'Cycle', Ripple: 'Ripple', Gradient: 'Gradient', Mouse: 'Mouse', Wave: 'Wave' }
});
pane.addBinding(SETTINGS, 'timeScale', { min: 0, max: 2 });
pane.addButton({ title: "Re-initialize" }).on("click", () => {
  init();
});
const f = pane.addFolder({ title: 'Palette (IQ)', expanded: false });
f.addBinding(SETTINGS, 'paletteOffset', { min: 0, max: 2 }).on('change', () => buildLUTs());
f.addBinding(SETTINGS, 'paletteScale', { min: 0, max: 2 }).on('change', () => buildLUTs());
f.addBinding(SETTINGS.palette.d, 'r', { min: 0, max: 1, label: 'Phase R' }).on('change', buildLUTs);
f.addBinding(SETTINGS.palette.d, 'g', { min: 0, max: 1, label: 'Phase G' }).on('change', buildLUTs);
f.addBinding(SETTINGS.palette.d, 'b', { min: 0, max: 1, label: 'Phase B' }).on('change', buildLUTs);