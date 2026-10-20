// Prisma Dash engine: levels, physics and collisions, with no DOM so the same code
// runs in the page and in a solver that proves every level can be finished.
// Units are blocks and seconds; y points up and the ground is y = 0.
(function (root) {
  "use strict";

  const DT = 1 / 240;
  const SPEEDS = [8.4, 10.4, 12.9, 15.6]; // portal speeds 0.8x, 1x, 1.25x, 1.5x
  const P = {
    cubeG: 86, cubeJump: 19.5, cubeMaxV: 26,
    shipUp: 44, shipDown: 38, shipMaxV: 9.5,
    ballG: 68, ballMaxV: 20,
    swingG: 46, swingMaxV: 11,
    snap: 0.13, // how far below a block's edge you can still land on it
  };
  // orbs and pads: [vy toward "up" (away from gravity), flips gravity]
  const ORBS = {
    yellow: [19.5, 0], pink: [14, 0], red: [24, 0], blue: [-8, 1], green: [18, 1], black: [-26, 0], dash: [0, 0],
  };
  const PADS = { yellow: [27, 0], pink: [16, 0], red: [34, 0], blue: [-12, 1] };
  // orbs give less push when flying, like the original
  const MODE_PUSH = { cube: 1, ball: 0.75, ship: 0.55, swing: 0.6, wave: 0 };
  const HALF = { cube: 0.5, ship: 0.5, ball: 0.5, swing: 0.5, wave: 0.3 };

  // ---------- level builder ----------

  function Builder() {
    const o = [];
    const b = {
      o,
      block: (x, y, w = 1, h = 1, s = 0) => (o.push({ t: "B", x, y, w, h, s }), b),
      spike: (x, y = 0, n = 1, dir = 1, small = false) => {
        for (let i = 0; i < n; i++) o.push({ t: "S", x: x + i, y, w: 1, h: 1, dir, small });
        return b;
      },
      // a row of spikes hanging under a ceiling at height `y`
      hang: (x, y, n = 1, small = false) => b.spike(x, y - 1, n, -1, small),
      orb: (x, y, kind = "yellow") => (o.push({ t: "O", x: x - 0.5, cx: x, cy: y, w: 1, kind }), b),
      pad: (x, y = 0, kind = "yellow", dir = 1) => (o.push({ t: "P", x, y, w: 1, kind, dir }), b),
      // portals: kind = cube|ship|ball|wave|swing|grav|speed|tele; arg depends on kind
      portal: (x, cy, kind, arg, h = 3) => (o.push({ t: "G", x, cy, w: 1, h, kind, arg }), b),
      saw: (x, y, r = 1, amp = 0, period = 2, ph = 0, ax = 0) => (o.push({ t: "W", x: x - r - Math.abs(ax), cx: x, cy: y, r, amp, period, ph, ax, w: 2 * (r + Math.abs(ax)) }), b),
      crumble: (x, y, w = 1) => {
        for (let i = 0; i < w; i++) o.push({ t: "C", x: x + i, y, w: 1, h: 1 });
        return b;
      },
      mover: (x, y, w, amp, period, ph = 0, h = 1) => (o.push({ t: "M", x, y, w, h, amp, period, ph }), b),
      laser: (x, y0, y1, period, duty, ph = 0) => (o.push({ t: "L", x, y0, y1, w: 1, period, duty, ph }), b),
      coin: (x, y) => (o.push({ t: "K", x: x - 0.5, cx: x, cy: y, w: 1 }), b),
      theme: (x, i) => (o.push({ t: "T", x, w: 0, i }), b),
      deco: (x, y, kind) => (o.push({ t: "D", x, y, w: 1, kind }), b),
    };
    return b;
  }

  function compile(def) {
    const b = Builder();
    def.build(b);
    const objs = b.o.sort((a, c) => a.x - c.x);
    const group = (types) => {
      const list = objs.filter((o) => types.includes(o.t));
      return { list, span: list.reduce((m, o) => Math.max(m, o.w || 1), 1) + 1 };
    };
    let trig = 0, crum = 0;
    for (const o of objs) {
      if ("OPGK".includes(o.t)) o.id = trig++;
      if (o.t === "C") o.id = crum++;
    }
    return {
      ...def,
      objs,
      solids: group(["B", "C", "M"]),
      hazards: group(["S", "W", "L"]),
      triggers: group(["O", "P", "G", "K"]),
      themes: objs.filter((o) => o.t === "T"),
      coins: objs.filter((o) => o.t === "K").length,
      nTrig: trig,
      nCrum: crum,
    };
  }

  // objects of a group whose span may touch [x0, x1]
  function query(g, x0, x1, fn) {
    const a = g.list;
    let lo = 0, hi = a.length;
    const from = x0 - g.span;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (a[m].x < from) lo = m + 1;
      else hi = m;
    }
    for (let i = lo; i < a.length && a[i].x <= x1; i++) if (fn(a[i]) === false) return;
  }

  // ---------- state ----------

  function newState(L) {
    return {
      x: 0, y: 0.5, vy: 0, t: 0,
      mode: L.mode || "cube", grav: -1, speed: L.speed ?? 1,
      lo: 0, hi: Infinity,
      grounded: true, held: false, buffer: 0, dash: false,
      dead: false, won: false, jumps: 0, coins: 0,
      used: new Uint8Array(L.nTrig),
      crumble: new Float32Array(L.nCrum).fill(-1),
      events: null,
    };
  }
  function clone(s) {
    const c = Object.assign({}, s);
    c.used = s.used.slice();
    c.crumble = s.crumble.slice();
    c.events = null;
    return c;
  }
  const emit = (s, type, a, b) => s.events && s.events.push({ type, a, b, x: s.x, y: s.y });

  // ---------- dynamic objects at time t ----------

  const moverY = (o, t) => o.y + o.amp * Math.sin((2 * Math.PI * t) / o.period + o.ph);
  const crumbleOn = (o, s) => s.crumble[o.id] < 0 || s.t < s.crumble[o.id] + 0.2;
  const sawPos = (o, t) => {
    const k = Math.sin((2 * Math.PI * t) / o.period + o.ph);
    return [o.cx + o.ax * k, o.cy + o.amp * k];
  };
  const laserOn = (o, t) => ((t / o.period + o.ph) % 1 + 1) % 1 < o.duty;

  function solidRect(o, s, out) {
    if (o.t === "C" && !crumbleOn(o, s)) return false;
    out.x0 = o.x;
    out.x1 = o.x + o.w;
    out.y0 = o.t === "M" ? moverY(o, s.t) : o.y;
    out.y1 = out.y0 + o.h;
    return true;
  }

  const overlap = (ax0, ax1, ay0, ay1, bx0, bx1, by0, by1) => ax0 < bx1 && ax1 > bx0 && ay0 < by1 && ay1 > by0;

  // ---------- interactions: pads, orbs, portals, coins ----------

  function interact(L, s) {
    const h = HALF[s.mode];
    const x0 = s.x - h, x1 = s.x + h, y0 = s.y - h, y1 = s.y + h;
    query(L.triggers, x0, x1, (o) => {
      if (s.used[o.id]) return;
      if (o.t === "K") {
        if (Math.hypot(clampTo(o.cx, x0, x1) - o.cx, clampTo(o.cy, y0, y1) - o.cy) < 0.55) {
          s.used[o.id] = 1;
          s.coins++;
          emit(s, "coin", o);
        }
      } else if (o.t === "P") {
        const py0 = o.dir > 0 ? o.y : o.y + 0.75;
        if (!overlap(x0, x1, y0, y1, o.x + 0.1, o.x + 0.9, py0, py0 + 0.25)) return;
        s.used[o.id] = 1;
        const [v, flip] = PADS[o.kind];
        if (flip) s.grav *= -1;
        s.vy = -s.grav * v * (MODE_PUSH[s.mode] || 0.6);
        s.grounded = false;
        s.dash = false;
        emit(s, "pad", o);
      } else if (o.t === "O") {
        if (s.buffer <= 0) return;
        if (Math.hypot(clampTo(o.cx, x0, x1) - o.cx, clampTo(o.cy, y0, y1) - o.cy) > 0.62) return;
        s.used[o.id] = 1;
        s.buffer = 0;
        const [v, flip] = ORBS[o.kind];
        if (flip) s.grav *= -1;
        if (o.kind === "dash") s.dash = true;
        else if (s.mode === "wave") s.dash = false;
        else s.vy = -s.grav * v * MODE_PUSH[s.mode];
        s.grounded = false;
        if (s.mode === "cube") s.jumps++;
        emit(s, "orb", o);
      } else if (o.t === "G") {
        if (!overlap(x0, x1, y0, y1, o.x + 0.2, o.x + 0.8, o.cy - o.h / 2, o.cy + o.h / 2)) return;
        s.used[o.id] = 1;
        portal(s, o);
        emit(s, "portal", o);
      }
    });
  }

  function portal(s, o) {
    switch (o.kind) {
      case "grav":
        s.grav = o.arg === "toggle" ? -s.grav : o.arg === "up" ? 1 : -1;
        if (s.mode === "cube") s.vy *= 0.5;
        break;
      case "speed":
        s.speed = o.arg;
        break;
      case "tele":
        s.y = o.arg;
        break;
      default: {
        // a mode portal; arg = [floor, ceiling] for the flying modes
        s.mode = o.kind;
        const [lo, hi] = o.kind === "cube" ? [0, Infinity] : o.arg || [0, 9];
        s.lo = lo;
        s.hi = hi;
        s.vy *= o.kind === "cube" ? 0.5 : 0.4;
        s.dash = false;
        if (s.mode === "wave") s.vy = 0;
      }
    }
  }

  const clampTo = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ---------- one physics step ----------

  const R = { x0: 0, x1: 0, y0: 0, y1: 0 };

  function step(L, s, held) {
    if (s.dead || s.won) return;
    const press = held && !s.held;
    s.held = held;
    s.buffer = press ? 0.1 : Math.max(0, s.buffer - DT);
    s.t += DT;

    interact(L, s);
    const g = s.grav, up = -g, v = SPEEDS[s.speed];

    if (s.dash) {
      s.vy = 0;
      if (!held) s.dash = false;
    } else
      switch (s.mode) {
        case "cube":
          if (s.grounded && held) {
            s.vy = up * P.cubeJump;
            s.grounded = false;
            s.jumps++;
            emit(s, "jump");
          }
          s.vy = clampTo(s.vy + g * P.cubeG * DT, -P.cubeMaxV, P.cubeMaxV);
          break;
        case "ship":
          s.vy = clampTo(s.vy + (held ? up * P.shipUp : g * P.shipDown) * DT, -P.shipMaxV, P.shipMaxV);
          break;
        case "ball":
          if (s.grounded && s.buffer > 0) {
            s.grav = -s.grav;
            s.buffer = 0;
            s.vy = s.grav * 5;
            s.grounded = false;
            s.jumps++;
            emit(s, "flip");
          }
          s.vy = clampTo(s.vy + s.grav * P.ballG * DT, -P.ballMaxV, P.ballMaxV);
          break;
        case "swing":
          if (s.buffer > 0) {
            s.grav = -s.grav;
            s.buffer = 0;
            s.jumps++;
            emit(s, "flip");
          }
          s.vy = clampTo(s.vy + s.grav * P.swingG * DT, -P.swingMaxV, P.swingMaxV);
          break;
        case "wave":
          s.vy = held ? up * v : g * v;
          break;
      }

    const prevY = s.y;
    s.x += v * DT;
    s.y += s.vy * DT;
    resolve(L, s, prevY);
    if (!s.dead) hazards(L, s);
    if (s.y > 40 || s.y < -5) die(s, "void");
    if (!s.dead && s.x >= L.end) {
      s.won = true;
      emit(s, "win");
    }
  }

  function die(s, why) {
    if (s.dead) return;
    s.dead = true;
    emit(s, "die", why);
  }

  // land on, bump into, or crash against surfaces
  function resolve(L, s, prevY) {
    const h = HALF[s.mode];
    const flying = s.mode !== "cube";
    let grounded = false;

    const surface = (x0, x1, y0, y1, crumbleObj) => {
      if (!overlap(s.x - h, s.x + h, s.y - h, s.y + h, x0, x1, y0, y1)) return;
      const fromAbove = prevY - h >= y1 - P.snap;
      const fromBelow = prevY + h <= y0 + P.snap;
      if (fromAbove && (s.vy <= 0 || !fromBelow)) {
        if (s.grav < 0) {
          s.y = y1 + h;
          s.vy = Math.max(0, s.vy);
          grounded = true;
          if (crumbleObj && s.crumble[crumbleObj.id] < 0) s.crumble[crumbleObj.id] = s.t;
        } else if (flying || s.dash) {
          s.y = y1 + h;
          s.vy = Math.max(0, s.vy);
        } else die(s, "head");
      } else if (fromBelow) {
        if (s.grav > 0) {
          s.y = y0 - h;
          s.vy = Math.min(0, s.vy);
          grounded = true;
          if (crumbleObj && s.crumble[crumbleObj.id] < 0) s.crumble[crumbleObj.id] = s.t;
        } else if (flying || s.dash) {
          s.y = y0 - h;
          s.vy = Math.min(0, s.vy);
        } else die(s, "head");
      }
    };

    // world floor, and the ceiling of the flying modes
    surface(s.x - 2, s.x + 2, -10, 0);
    if (s.lo > 0) surface(s.x - 2, s.x + 2, s.lo - 10, s.lo);
    if (s.hi < Infinity) surface(s.x - 2, s.x + 2, s.hi, s.hi + 10);

    query(L.solids, s.x - h, s.x + h, (o) => {
      if (solidRect(o, s, R)) surface(R.x0, R.x1, R.y0, R.y1, o.t === "C" ? o : null);
    });
    if (s.dead) return;
    s.grounded = grounded;
    if (grounded && s.mode === "wave") s.vy = 0;

    // the small inner box hitting a block's side is a crash
    const k = h * 0.36;
    query(L.solids, s.x - k, s.x + k, (o) => {
      if (solidRect(o, s, R) && overlap(s.x - k, s.x + k, s.y - k, s.y + k, R.x0, R.x1, R.y0, R.y1)) {
        die(s, "wall");
        return false;
      }
    });
    if (!flying && s.grav > 0 && s.hi === Infinity && s.y > 30) die(s, "void");
  }

  function hazards(L, s) {
    const h = HALF[s.mode] * (s.mode === "wave" ? 0.7 : 0.8);
    const x0 = s.x - h, x1 = s.x + h, y0 = s.y - h, y1 = s.y + h;
    query(L.hazards, x0, x1, (o) => {
      let hit = false;
      if (o.t === "S") {
        const sh = o.small ? 0.25 : 0.5;
        const by0 = o.dir > 0 ? o.y : o.y + 1 - sh;
        hit = overlap(x0, x1, y0, y1, o.x + 0.36, o.x + 0.64, by0, by0 + sh);
      } else if (o.t === "W") {
        const [cx, cy] = sawPos(o, s.t);
        hit = Math.hypot(clampTo(cx, x0, x1) - cx, clampTo(cy, y0, y1) - cy) < o.r * 0.86;
      } else if (o.t === "L") {
        hit = laserOn(o, s.t) && overlap(x0, x1, y0, y1, o.x + 0.4, o.x + 0.6, o.y0, o.y1);
      }
      if (hit) {
        die(s, o.t);
        return false;
      }
    });
  }

  // ---------- levels ----------

  // colour themes: sky top, sky bottom, ground, line/glow, block, accent
  const THEMES = [
    ["#1a0b3d", "#5a1e78", "#2a0f55", "#ff6ad5", "#3b1a7a", "#ffd166"], // 0 alba viola
    ["#0b2140", "#1f5f8b", "#0d2c4f", "#5ff2ff", "#14457a", "#ffe066"], // 1 cielo
    ["#0c3326", "#1c7a55", "#0b3a2a", "#7dffb2", "#145f43", "#fff38a"], // 2 smeraldo
    ["#2b0a0a", "#8a2a12", "#3a0d0d", "#ff9e3d", "#6b1c12", "#fff1a8"], // 3 lava
    ["#06060f", "#1b1440", "#0a0a1f", "#a98bff", "#221a55", "#7dffea"], // 4 vuoto
    ["#330a2a", "#a3245e", "#3d0c33", "#ff7ab8", "#6e1650", "#ffe3f1"], // 5 magenta
    ["#001a1f", "#00586b", "#00262e", "#33fff0", "#00434f", "#fffb8a"], // 6 abisso
    ["#1d1d1d", "#4a4a4a", "#141414", "#ffffff", "#2e2e2e", "#ff4d6d"], // 7 acciaio
  ];

  const LEVELS = [
    {
      name: "Alba al Neon",
      diff: "Facile",
      stars: 2,
      bpm: 128,
      song: 0,
      end: 236,
      build(b) {
        b.theme(0, 0);
        b.spike(14).spike(21, 0, 2);
        b.block(28, 0, 3, 1).block(32, 0, 3, 2).block(36, 0, 3, 3);
        b.spike(44, 0, 2);
        b.pad(51).block(55, 2, 6, 1).spike(58, 3).coin(62.5, 5.2);
        b.spike(66, 0, 4).orb(66.5, 2.4);
        b.spike(74, 0, 3);
        // ship
        b.theme(80, 1).portal(80, 2, "ship", [0, 10], 4);
        b.block(88, 0, 2, 3).block(88, 7, 2, 3);
        b.block(96, 0, 2, 5).block(96, 9, 2, 1);
        b.block(104, 0, 2, 1).block(104, 5, 2, 5);
        b.spike(108, 0, 12).saw(114, 6.5, 1.1, 0.8, 2.2);
        b.block(122, 0, 2, 4).block(122, 7.5, 2, 2.5).coin(129, 1.2);
        b.block(132, 3, 6, 1).block(132, 7, 6, 3);
        b.portal(141, 5, "cube", null, 10).theme(141, 2);
        // cube again
        b.spike(150).block(155, 0, 5, 1).spike(162, 0, 3);
        b.pad(170, 0, "pink").block(172, 0, 2, 2).spike(174, 0, 3).block(177, 0, 2, 2);
        b.spike(183, 0, 3).orb(184.5, 2.6, "pink");
        b.block(191, 0, 2, 1).spike(193, 0, 2).block(195, 0, 2, 2).spike(197, 0, 2).block(199, 0, 2, 3).coin(200.5, 5.6);
        b.spike(205, 0, 3);
        b.spike(214, 0, 2).spike(221, 0, 3);
      },
    },
    {
      name: "Gravità Zero",
      diff: "Normale",
      stars: 4,
      bpm: 140,
      song: 1,
      end: 270,
      build(b) {
        b.theme(0, 1);
        b.spike(13).spike(19, 0, 2);
        // gravity flip onto a ceiling
        b.block(26, 6, 30, 1);
        b.portal(28, 2, "grav", "up");
        b.hang(36, 6, 2).hang(44, 6, 3);
        b.portal(52, 4.5, "grav", "down", 3);
        b.spike(62, 0, 2);
        // crumbling bridge over a spike pit
        b.spike(68, 0, 10).crumble(68, 2, 10).block(66, 0, 2, 2).coin(73, 5);
        b.spike(84, 0, 2);
        // ball
        b.theme(90, 6).portal(90, 2, "ball", [0, 8], 4);
        b.spike(98, 0, 2).hang(104, 8, 2).spike(110, 0, 3).hang(117, 8, 3);
        b.block(124, 0, 4, 2).hang(124, 8, 4).spike(130, 0, 2);
        b.orb(136.5, 4, "blue").spike(134, 0, 6).hang(138, 8, 4);
        b.coin(144, 7.2);
        b.spike(146, 0, 3).hang(152, 8, 3);
        b.portal(158, 4, "cube", null, 8).theme(158, 2);
        // moving platforms over a pit
        b.spike(166, 0, 22);
        b.mover(166, 1.2, 4, 0.7, 2.4).mover(171, 2, 4, 0.8, 2.4, 1.6).mover(176, 1.2, 4, 0.7, 2.4, 3.1).mover(181, 2, 3, 0.8, 2.4, 4.7).block(185, 0, 3, 2);
        b.coin(175.5, 5);
        b.spike(192, 0, 2).orb(194, 2.4, "green").block(195, 6, 12, 1).hang(201, 6, 1).portal(207, 3.5, "grav", "down", 4);
        b.spike(214, 0, 3).spike(221, 0, 2);
        b.pad(228, 0, "blue").block(230, 6, 10, 1).portal(240, 3.5, "grav", "down", 4);
        b.spike(246, 0, 3).spike(254, 0, 2);
      },
    },
    {
      name: "Onda Cromatica",
      diff: "Difficile",
      stars: 6,
      bpm: 150,
      song: 2,
      end: 300,
      build(b) {
        b.theme(0, 5);
        b.spike(13).spike(19, 0, 3);
        b.portal(25, 1.5, "speed", 2);
        b.spike(32, 0, 2).block(38, 0, 4, 1).spike(42, 0, 3).spike(51, 0, 3);
        // wave
        b.theme(58, 4).portal(58, 2, "wave", [0, 10], 4);
        b.block(66, 0, 3, 4).block(66, 7, 3, 3);
        b.block(74, 0, 3, 6).block(74, 9, 3, 1);
        b.block(82, 0, 3, 1).block(82, 4, 3, 6);
        b.saw(90, 5, 1.1, 2.5, 2);
        b.block(96, 0, 3, 3).block(96, 6, 3, 4).coin(100, 4.5);
        b.laser(104, 0, 4.5, 1.2, 0.5).laser(104, 5.5, 10, 1.2, 0.5, 0.5);
        b.block(110, 0, 2, 5).block(110, 8, 2, 2).block(116, 0, 2, 2).block(116, 5, 2, 5);
        b.portal(122, 3.5, "tele", 7.5, 7).block(123, 5.5, 10, 0.5).saw(128, 2.5, 1.2);
        b.block(134, 0, 3, 5).block(134, 9.2, 3, 0.8);
        b.portal(140, 6.5, "cube", null, 7).theme(140, 7);
        // cube at speed with lasers and saws
        b.spike(147, 0, 3).saw(155, 0.2, 1.1);
        b.block(160, 0, 3, 1).laser(165, 0, 3, 1.2, 0.45, 0.2).block(166, 0, 3, 1);
        b.spike(172, 0, 3).orb(173.5, 2.7, "yellow").coin(176, 5.5);
        b.pad(181).block(184, 3, 8, 1).saw(188, 6.2, 1, 0.6, 1.5).spike(194, 0, 6);
        b.portal(202, 1.5, "speed", 1);
        b.spike(208, 0, 2).block(214, 0, 2, 2).block(219, 0, 2, 3).spike(216, 0, 3);
        b.spike(224, 0, 3).orb(225.5, 2.6, "pink");
        b.theme(232, 4).portal(232, 2, "wave", [1, 9], 4).block(232, 0, 40, 1).block(232, 9, 40, 1);
        b.spike(240, 1, 3).hang(246, 9, 3).coin(249, 5).spike(252, 1, 3).hang(258, 9, 3).saw(264, 5, 1.2, 2.2, 1.6);
        b.portal(272, 5, "cube", null, 8);
        b.spike(282, 0, 2).spike(290, 0, 2);
      },
    },
    {
      name: "Prisma Infernale",
      diff: "Estremo",
      stars: 9,
      bpm: 170,
      song: 3,
      end: 320,
      speed: 2,
      build(b) {
        b.theme(0, 3);
        b.spike(15, 0, 2).spike(24, 0, 3).block(32, 0, 2, 2).spike(34, 0, 3).block(37, 0, 2, 2);
        b.spike(44, 0, 9).orb(46, 2.5, "dash").orb(51.5, 2.5, "yellow");
        b.coin(58, 4);
        // swing
        b.theme(62, 5).portal(62, 2, "swing", [0, 10], 4);
        b.block(70, 0, 2, 4).block(70, 8, 2, 2);
        b.block(77, 0, 2, 1).block(77, 5, 2, 5);
        b.block(84, 0, 2, 6).block(84, 9.3, 2, 0.7);
        b.saw(92, 2, 1, 1.5, 1.4).saw(92, 8, 1, 1.5, 1.4, Math.PI);
        b.block(99, 0, 2, 3).block(99, 7, 2, 3).coin(106, 5);
        b.laser(110, 0, 5, 1, 0.5).laser(110, 5, 10, 1, 0.5, 0.5);
        b.block(116, 0, 2, 5).block(116, 8.5, 2, 1.5);
        b.portal(124, 5, "ball", [0, 9], 9).theme(124, 3);
        b.spike(130, 0, 2).hang(135, 9, 2).spike(140, 0, 2).hang(145, 9, 3).orb(150, 4.5, "green").spike(148, 0, 5);
        b.portal(158, 4.5, "ship", [0, 10], 9).theme(158, 4);
        b.block(165, 0, 2, 5).block(165, 8, 2, 2).block(172, 0, 2, 2).block(172, 5, 2, 5);
        b.saw(180, 5, 1.2, 3, 1.3);
        b.block(186, 0, 6, 3).block(186, 6, 6, 4);
        b.portal(196, 1.5, "speed", 3).portal(196, 5, "wave", [0, 10], 9);
        b.block(204, 0, 3, 4).block(204, 7, 3, 3).block(212, 0, 3, 2).block(212, 5, 3, 5).block(220, 0, 3, 6).block(220, 9, 3, 1);
        b.coin(228, 4.5);
        b.portal(230, 5, "speed", 2).portal(230, 5, "cube", null, 10).theme(230, 3);
        b.spike(238, 0, 3).pad(245, 0, "red").orb(250, 5.5, "black").block(254, 2.6, 8, 5);
        b.spike(264, 0, 4).orb(265.5, 2.4, "yellow").block(272, 0, 2, 2).spike(274, 0, 2).block(276, 0, 2, 3);
        b.spike(283, 0, 3).orb(284.5, 2.6, "pink").spike(292, 0, 3).spike(300, 0, 2).spike(307, 0, 3);
      },
    },
  ];

  const api = { DT, SPEEDS, P, HALF, THEMES, LEVELS, compile, query, newState, clone, step, moverY, crumbleOn, sawPos, laserOn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Dash = api;
})(this);
