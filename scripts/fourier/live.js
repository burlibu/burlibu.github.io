const DATA = __DATA__;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const preview = new URLSearchParams(location.search).has("preview");
const TAU = Math.PI * 2;
const comma = (v, d) => v.toFixed(d).replace(".", ",");
const ease = (x, target, dt, tau, calm) => (calm ? target : x + (target - x) * (1 - Math.exp(-dt / tau)));
const deg = (a) => (a * 180) / Math.PI;
const f2 = (v) => Math.round(v * 100) / 100;

// a frame loop that runs only while its stage is on screen
function loop(stage, tick) {
  let frame = 0;
  let last = 0;
  let visible = false;
  const step = (now) => {
    const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
    last = now;
    const more = tick(dt, still.matches);
    frame = visible && more ? requestAnimationFrame(step) : 0;
  };
  const run = () => {
    if (!frame && visible) {
      last = 0;
      frame = requestAnimationFrame(step);
    }
  };
  new IntersectionObserver((entries) => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible) run();
  }, { rootMargin: "80px 0px" }).observe(stage);
  return run;
}

// ------------------------------------------------------------------------------------
// Fig 1: the harmonic synthesiser
// ------------------------------------------------------------------------------------
(() => {
  const F = DATA.fig1;
  const P = F.P;
  const stage = document.querySelector('.fx-stage[data-fig="1"]');
  if (!stage) return;
  const figure = stage.closest(".iso-figure");
  const readout = figure.querySelector("[data-readout]");
  const all = (name) => [...stage.querySelectorAll(`[data-fx="${name}"]`)];
  const one = (name) => stage.querySelector(`[data-fx="${name}"]`);
  const els = { disc: all("disc"), pin: all("pin"), yoke: all("yoke"), rod: all("rodup"), block: all("block"), strap: all("strap"), fp: all("fp") };
  const wire = one("wire");
  const grid = one("grid");
  const ghost = one("ghost");
  const trace = one("trace");
  const carriage = one("carriage");
  const guideClip = one("guideclip");
  const wheel = one("wheel");
  const knob = one("knob");
  const buttons = [...figure.querySelectorAll("[data-signal]")];
  const countInput = figure.querySelector('[data-input="count"]');
  const countShow = figure.querySelector('[data-show="count"]');
  const bars = [...figure.querySelectorAll("[data-coef]")];

  const N = F.cols.length;
  let key = "quadra";
  let count = N;
  let theta = 0;
  const r = new Array(N).fill(0);
  const ph = new Array(N).fill(0);
  const rT = new Array(N).fill(0);
  const phT = new Array(N).fill(0);
  let history = [];
  let ghostKey = key;
  let ghostFade = 1;

  const retarget = () => {
    const terms = termsOf(key, count);
    const K = F.scale[key];
    terms.forEach((t, i) => {
      // the throw is set opposite to the coefficient: a pulley that rises lets the pen drop
      rT[i] = -K * t.amp;
      phT[i] = t.phase;
    });
    const top = Math.max(...termsOf(key).map((t) => Math.abs(t.amp)));
    bars.forEach((bar, i) => {
      const a = terms[i].amp;
      bar.style.setProperty("--h", `${(Math.abs(a) / top) * 100}%`);
      bar.toggleAttribute("data-neg", a < 0);
      bar.toggleAttribute("data-cos", Math.abs(a) > 1e-9 && terms[i].phase !== 0);
      bar.parentElement.toggleAttribute("data-off", i >= count);
    });
    buttons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.signal === key)));
    countInput.value = String(count);
    countShow.textContent = String(count);
    const err = rmsError(key, terms);
    const text = `${SIGNALS[key].name} · ${count} ${count === 1 ? "armonica" : "armoniche"} · scarto RMS ${comma(err * 100, 1)}%`;
    if (readout.textContent !== text) readout.textContent = text;
  };

  const penOf = () => {
    let sum = 0;
    for (let i = 0; i < N; i++) sum += r[i] * Math.sin((i + 1) * theta + ph[i]);
    return F.zp0 - 2 * sum;
  };

  // the wire: plumb runs between pulleys, wrapped over the fixed ones and under the moving ones
  const tangent = (c1, p1, c2, p2) => {
    const dx = c2[0] - c1[0];
    const dz = c2[1] - c1[1];
    const len = Math.hypot(dx, dz);
    const h = (p1 - p2) / len;
    const s = Math.sqrt(Math.max(0, 1 - h * h));
    const n = [h * (dx / len) + s * (-dz / len), h * (dz / len) + s * (dx / len)];
    return [[c1[0] + p1 * n[0], c1[1] + p1 * n[1]], [c2[0] + p2 * n[0], c2[1] + p2 * n[1]]];
  };
  const arc = (c, rad, from, to, over) => {
    let a0 = Math.atan2(from[1] - c[1], from[0] - c[0]);
    let a1 = Math.atan2(to[1] - c[1], to[0] - c[0]);
    // over a pulley the wire turns clockwise (angle falls), under one anticlockwise
    if (over) while (a1 > a0) a1 -= TAU;
    else while (a1 < a0) a1 += TAU;
    const steps = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 0.2));
    const out = [];
    for (let i = 1; i < steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      out.push([c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a)]);
    }
    return out;
  };
  const wirePath = (pen, axles) => {
    const nodes = [{ c: [F.xPen, F.carriageTop + pen - F.zp0], p: 0 }];
    for (let i = 0; i <= N; i++) {
      nodes.push({ c: [F.fpx[i], F.fpz], p: F.fpr, over: true });
      if (i < N) nodes.push({ c: [F.cols[i], axles[i]], p: -F.mpr, over: false });
    }
    nodes.push({ c: F.anchor, p: 0 });
    const pts = [];
    let into = null;
    for (let i = 0; i < nodes.length - 1; i++) {
      const [a, b] = tangent(nodes[i].c, nodes[i].p, nodes[i + 1].c, nodes[i + 1].p);
      if (i === 0) pts.push(a);
      else pts.push(into, ...arc(nodes[i].c, Math.abs(nodes[i].p), into, a, nodes[i].over), a);
      into = b;
    }
    pts.push(into);
    return pts.map(([x, z], i) => `${i ? "L" : "M"}${f2(x)} ${f2(-z)}`).join("");
  };

  const span = (F.xPen - F.paper.x0) / F.v; // radians of θ across the paper left of the pen
  const ahead = (F.paper.x1 - F.xPen) / F.v;
  const ghostPath = () => {
    const K = F.scale[ghostKey];
    const f = SIGNALS[ghostKey].f;
    const pts = [];
    const steps = 480;
    for (let i = 0; i <= steps; i++) {
      const t = theta - span - 0.3 + ((span + ahead + 0.6) * i) / steps;
      pts.push(`${i ? "L" : "M"}${f2(F.xPen - F.v * (theta - t))} ${f2(-(F.zp0 + 2 * K * f(t)))}`);
    }
    return pts.join("");
  };
  const gridPath = () => {
    let d = "";
    const q = Math.PI / 2;
    for (let m = Math.ceil((theta - span) / q); m * q <= theta + ahead; m++) {
      const x = f2(F.xPen - F.v * (theta - m * q));
      d += `M${x} ${-F.paper.z1}V${-F.paper.z0}`;
    }
    return d;
  };
  const tracePath = () => history.map(([t, z], i) => `${i ? "L" : "M"}${f2(F.xPen - F.v * (theta - t))} ${f2(-z)}`).join("");

  const record = () => {
    while (history.length && history[history.length - 1][0] > theta + 1e-9) history.pop();
    const last = history[history.length - 1];
    if (!last || theta - last[0] > 0.004) history.push([theta, penOf()]);
    while (history.length > 2 && theta - history[1][0] > span + 0.3) history.shift();
  };

  const draw = () => {
    const axles = [];
    for (let i = 0; i < N; i++) {
      const psi = (i + 1) * theta + ph[i];
      const dz = r[i] * Math.sin(psi);
      axles.push(F.axle0 + dz);
      els.disc[i].setAttribute("transform", `rotate(${f2(-deg(psi))})`);
      els.pin[i].setAttribute("transform", translateAlong(P, [r[i] * Math.cos(psi), 0, dz]));
      const lift = translateAlong(P, [0, 0, dz]);
      els.yoke[i].setAttribute("transform", lift);
      els.rod[i].setAttribute("transform", lift);
      els.block[i].setAttribute("transform", lift);
      els.strap[i].setAttribute("transform", lift);
    }
    const pen = penOf();
    wire.setAttribute("d", wirePath(pen, axles));
    // wire travelled over each fixed pulley turns it
    let run = F.fpz - (F.carriageTop + pen - F.zp0);
    els.fp.forEach((el, i) => {
      if (i) run += 2 * (F.fpz - axles[i - 1]);
      el.setAttribute("transform", `rotate(${f2(deg(run / F.fpr))})`);
    });
    const lift = [0, 0, pen - F.zp0];
    carriage.setAttribute("transform", translateAlong(P, lift));
    const [sx, sy] = axisVector(P, lift);
    guideClip.setAttribute("transform", `translate(${f2(sx)} ${f2(sy)})`);
    wheel.setAttribute("transform", `rotate(${f2(deg(theta) + 180)})`);
    knob.setAttribute("transform", translateAlong(P, [0, F.wheel.r * Math.cos(theta) - F.wheel.r, F.wheel.r * Math.sin(theta)]));
    grid.setAttribute("d", gridPath());
    ghost.setAttribute("d", ghostPath());
    ghost.style.opacity = String(ghostFade);
    trace.setAttribute("d", tracePath());
  };

  // fill the paper with what the machine would have written already
  const prefill = () => {
    for (let i = 0; i < N; i++) {
      r[i] = rT[i];
      ph[i] = phT[i];
    }
    const end = theta;
    history = [];
    for (theta = end - span - 0.3; theta < end; theta += 0.01) history.push([theta, penOf()]);
    theta = end;
    record();
  };

  const OMEGA = TAU / 6; // one period of the fundamental every six seconds
  let turning = !still.matches || preview;
  let idle = 0;
  let drag = null;
  const hold = (ms = 2600) => {
    turning = false;
    clearTimeout(idle);
    idle = setTimeout(() => {
      turning = !still.matches;
      run();
    }, ms);
  };

  const tick = (dt, calm) => {
    if (turning) theta += OMEGA * dt;
    let moving = turning;
    for (let i = 0; i < N; i++) {
      r[i] = ease(r[i], rT[i], dt, 0.45, calm);
      ph[i] = ease(ph[i], phT[i], dt, 0.45, calm);
      if (Math.abs(r[i] - rT[i]) > 1e-3 || Math.abs(ph[i] - phT[i]) > 1e-3) moving = true;
      else {
        r[i] = rT[i];
        ph[i] = phT[i];
      }
    }
    if (ghostKey !== key) {
      ghostFade = calm ? 0 : Math.max(0, ghostFade - dt / 0.25);
      if (ghostFade === 0) ghostKey = key;
      moving = true;
    } else if (ghostFade < 1) {
      ghostFade = calm ? 1 : Math.min(1, ghostFade + dt / 0.35);
      moving = true;
    }
    record();
    draw();
    return moving || drag !== null;
  };
  const run = loop(stage, tick);

  const setSignal = (next) => {
    if (next === key) return;
    key = next;
    retarget();
    run();
  };
  const setCount = (next) => {
    next = Math.max(1, Math.min(N, next));
    if (next === count) return;
    count = next;
    retarget();
    run();
  };
  buttons.forEach((b) => b.addEventListener("click", () => setSignal(b.dataset.signal)));
  countInput.addEventListener("input", () => setCount(Number(countInput.value)));
  stage.addEventListener("keydown", (event) => {
    const keys = Object.keys(SIGNALS);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") setCount(count - 1);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") setCount(count + 1);
    else if (/^[1-4]$/.test(event.key)) setSignal(keys[Number(event.key) - 1]);
    else return;
    event.preventDefault();
  });
  // dragging across the figure turns the crank: the figure's width is one period
  stage.addEventListener("pointerdown", (event) => {
    drag = { x: event.clientX, id: event.pointerId };
    stage.setPointerCapture(event.pointerId);
    turning = false;
    clearTimeout(idle);
    run();
  });
  stage.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const width = stage.getBoundingClientRect().width;
    theta += ((event.clientX - drag.x) / width) * TAU;
    drag.x = event.clientX;
  });
  const release = () => {
    if (!drag) return;
    drag = null;
    hold();
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);

  retarget();
  prefill();
  draw();
  run();
})();

// ------------------------------------------------------------------------------------
// Fig 2: the winding table
// ------------------------------------------------------------------------------------
(() => {
  const F = DATA.fig2;
  const P = F.P;
  const stage = document.querySelector('.fx-stage[data-fig="2"]');
  if (!stage) return;
  const figure = stage.closest(".iso-figure");
  const readout = figure.querySelector("[data-readout]");
  const one = (name) => stage.querySelector(`[data-fx="${name}"]`);
  const wound = one("wound");
  const vector = one("vector");
  const puck = one("puck");
  const knob = one("knob2");
  const car = one("plotcar");
  const pen = one("plotpen");
  const input = figure.querySelector('[data-input="freq"]');
  const show = figure.querySelector('[data-show="freq"]');
  const [lo, hi] = WIND.range;
  const k = F.windR / F.gMax;
  const fx = (f) => F.chart.x0 + ((f - lo) / (hi - lo)) * (F.chart.x1 - F.chart.x0);
  const cy = (c) => F.chart.y1 - (c / F.cMax) * (F.chart.y1 - F.chart.y0);
  const knobAngle = (f) => ((-135 + (270 * (f - lo)) / (hi - lo)) * Math.PI) / 180;

  let f = 1;
  let fT = 1;
  // idle tour: a slow sweep up and back, lingering where the signal has something
  let touring = !still.matches || preview;
  let clock = 0;
  let idle = 0;
  const TOUR = 44;
  const tourAt = (t) => {
    const u = (t % TOUR) / TOUR;
    const s = u < 0.5 ? u * 2 : 2 - u * 2;
    // a monotone warp that slows the sweep near 2 Hz and 3 Hz
    const raw = lo + (hi - lo) * s;
    return raw - 0.09 * Math.sin(2 * Math.PI * (raw - 2));
  };

  const draw = () => {
    const pts = [];
    const steps = 900;
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * WIND.span;
      const rho = k * WIND.g(t);
      const a = -TAU * f * t;
      pts.push([F.tt[0] + rho * Math.cos(a), F.tt[1] + rho * Math.sin(a)]);
    }
    wound.setAttribute("d", onTop(pts, F.top, P));
    const [re, im] = centroid(f);
    const c = Math.hypot(re, im);
    vector.setAttribute("d", c * k > 0.6 ? lineOnTop(F.tt, [F.tt[0] + re * k, F.tt[1] + im * k], F.top + 0.05, P) : "");
    puck.setAttribute("transform", translateAlong(P, [re * k, im * k, 0]));
    const a = knobAngle(f);
    knob.setAttribute("d", lineOnTop([F.knob[0] - Math.sin(a) * 1.2, F.knob[1] + Math.cos(a) * 1.2], [F.knob[0] + Math.sin(a) * 4, F.knob[1] - Math.cos(a) * 4], F.knobTop + 0.05, P));
    car.setAttribute("transform", translateAlong(P, [fx(f) - F.chart.x0, 0, 0]));
    pen.setAttribute("transform", translateAlong(P, [fx(f) - F.chart.x0, cy(Math.min(c, F.cMax)) - F.chart.y1, 0]));
    const text = `f = ${comma(f, 2)} Hz · |ĝ(f)| = ${comma(c, 3)}`;
    if (readout.textContent !== text) readout.textContent = text;
    stage.setAttribute("aria-valuenow", f.toFixed(2));
    stage.setAttribute("aria-valuetext", text);
    show.textContent = `${comma(f, 2)} Hz`;
    if (document.activeElement !== input) input.value = String(Math.round(f * 100));
  };

  const tick = (dt, calm) => {
    if (touring) {
      clock += dt;
      fT = tourAt(clock);
    }
    f = touring ? fT : ease(f, fT, dt, 0.25, calm);
    if (Math.abs(f - fT) < 1e-4) f = fT;
    draw();
    return touring || f !== fT;
  };
  const run = loop(stage, tick);
  const steer = (next) => {
    touring = false;
    fT = Math.max(lo, Math.min(hi, next));
    clearTimeout(idle);
    idle = setTimeout(() => {
      touring = !still.matches;
      // resume the tour from where the reader left it
      const s = (f - lo) / (hi - lo);
      clock = (s / 2) * TOUR;
      run();
    }, 5000);
    run();
  };
  input.addEventListener("input", () => steer(Number(input.value) / 100));
  stage.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 0.25 : 0.05;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") steer(fT + step);
    else if (event.key === "ArrowLeft" || event.key === "ArrowDown") steer(fT - step);
    else if (event.key === "Home") steer(lo);
    else if (event.key === "End") steer(hi);
    else return;
    event.preventDefault();
  });
  draw();
  run();
})();
