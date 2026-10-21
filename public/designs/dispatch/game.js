// Fire Dispatch HQ engine: a seeded city grid, fires that grow, spread and
// bring buildings down, and a fleet that drives the streets by A*, sprays,
// runs dry, refills at hydrants or at the station and comes home. DOM-free, so
// node can play whole shifts with auto() when retuning the numbers.
(function (root) {
  const B = 100; // block size in world units (one unit = 1.2 m)
  const W = 10, H = 7; // blocks across and down; intersections are (W+1) x (H+1)
  const M_PER_UNIT = 1.2;
  const DT = 1 / 30; // fixed logic step, game seconds
  const SHIFT = 480; // game seconds from 20:00 to 02:00
  const CLOCK0 = 20 * 3600, CLOCK_RATE = (6 * 3600) / SHIFT; // simulated seconds per game second
  const STAFF = 14, HIRE = { cost: 7500, staff: 2, max: 3 };
  const KILL = 0.04; // fire points knocked down per litre
  const DAMAGE = 0.011; // structure lost per second per fire point
  const FUEL_PER_UNIT = 0.028; // % of tank per world unit driven
  const FUEL_PRICE = 22; // € per % refuelled

  const TRUCKS = {
    engine: { label: "Autopompa", code: "APS", speed: 58, tank: 2500, flow: 42, crew: 4 },
    ladder: { label: "Autoscala", code: "AS", speed: 42, tank: 1500, flow: 34, crew: 3, ladder: true },
    quick: { label: "Unità rapida", code: "UR", speed: 86, tank: 900, flow: 30, crew: 2 },
  };
  const FLEET = [["engine", 1], ["engine", 2], ["ladder", 1], ["quick", 1], ["quick", 2]];

  // grow: fire points per second at the start; tall: needs a ladder on scene;
  // chem: water only 75% effective
  const KINDS = {
    res: { label: "Residenziale", value: 420000, grow: 0.55 },
    tower: { label: "Grattacielo", value: 2600000, grow: 0.6, tall: true },
    ind: { label: "Industriale", value: 1300000, grow: 0.8, chem: true },
    hosp: { label: "Ospedale", value: 9000000, grow: 0.5, tall: true },
  };
  const CALLS = {
    res: ["Fumo visibile dalle finestre", "Odore di bruciato nel vano scale", "Fiamme in cucina", "Incendio canna fumaria", "Fumo dal sottotetto"],
    tower: ["Fumo dai piani alti", "Persone bloccate ai piani superiori", "Allarme antincendio, fumo nero", "Fiamme da un balcone al 9° piano"],
    ind: ["Fusti chimici in fiamme", "Nube scura dal capannone", "Esplosione segnalata, fumo acre", "Cisterna di solventi in fiamme"],
    hosp: ["Fumo nel reparto, evacuazione in corso", "Allarme nel blocco operatorio"],
  };
  const STATUS = {
    base: "IN CASERMA", refill: "IN RIFORNIMENTO", enroute: "IN VIAGGIO", engaged: "INGAGGIATO",
    tohydrant: "VERSO IDRANTE", hydrant: "IN RIFORNIMENTO", returning: "IN RIENTRO",
  };
  const VSTREETS = ["Via Roma", "Via Garibaldi", "Via Mazzini", "Via Cavour", "Corso Italia", "Via Verdi", "Via Dante", "Via Manzoni", "Via Leopardi", "Via Petrarca", "Via Galilei"];
  const HSTREETS = ["Viale Europa", "Via XX Settembre", "Via Matteotti", "Corso Vittorio Emanuele", "Via Gramsci", "Via Marconi", "Via dei Mille", "Via Carducci"];

  const HQ_BLOCK = [4, 3], HOSP_BLOCK = [7, 1];
  const PARKS = [[1, 5], [2, 5], [6, 4]];
  // the park across (1,5) and (2,5) is one green: Via Mazzini stops at its edge
  const CLOSED = [[2, 5, 2, 6]];

  const nid = (i, j) => j * (W + 1) + i;
  const nodePoint = (n) => ({ x: (n % (W + 1)) * B, y: Math.floor(n / (W + 1)) * B, n });
  const level = (hp) => (hp < 35 ? 1 : hp < 70 ? 2 : 3);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function rng(seed = 1) {
    let a = seed >>> 0 || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pick = (r, list) => list[Math.floor(r() * list.length)];

  // ---------- road graph ----------
  const closed = new Set(CLOSED.flatMap(([a, b, c, d]) => [nid(a, b) + ":" + nid(c, d), nid(c, d) + ":" + nid(a, b)]));
  const NEIGH = [];
  for (let j = 0; j <= H; j++)
    for (let i = 0; i <= W; i++) {
      const n = nid(i, j), out = [];
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const a = i + di, b = j + dj;
        if (a < 0 || b < 0 || a > W || b > H || closed.has(n + ":" + nid(a, b))) continue;
        out.push(nid(a, b));
      }
      NEIGH[n] = out;
    }

  // A* on the intersections; every street segment is one block long
  function astar(from, to) {
    if (from === to) return [from];
    const hx = (n) => (Math.abs((n % (W + 1)) - (to % (W + 1))) + Math.abs(Math.floor(n / (W + 1)) - Math.floor(to / (W + 1)))) * B;
    const g = new Map([[from, 0]]), prev = new Map(), open = [from], done = new Set();
    while (open.length) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (g.get(open[k]) + hx(open[k]) < g.get(open[bi]) + hx(open[bi])) bi = k;
      const n = open.splice(bi, 1)[0];
      if (n === to) break;
      done.add(n);
      for (const m of NEIGH[n]) {
        if (done.has(m)) continue;
        const c = g.get(n) + B;
        if (c < (g.has(m) ? g.get(m) : Infinity)) {
          g.set(m, c);
          prev.set(m, n);
          if (!open.includes(m)) open.push(m);
        }
      }
    }
    const path = [to];
    while (path[0] !== from) path.unshift(prev.get(path[0]));
    return path;
  }

  // ---------- city ----------
  function makeCity(r) {
    const lots = [];
    const R = 9, inner = B - 2 * R, half = (inner - 4) / 2;
    const isPark = (bx, by) => PARKS.some(([a, b]) => a === bx && b === by);
    for (let by = 0; by < H; by++)
      for (let bx = 0; bx < W; bx++) {
        if (isPark(bx, by) || (bx === HQ_BLOCK[0] && by === HQ_BLOCK[1])) continue;
        if (bx === HOSP_BLOCK[0] && by === HOSP_BLOCK[1]) {
          lots.push(lot(lots.length, "hosp", bx, by, 0, 1, bx * B + R, by * B + R, inner, inner));
          continue;
        }
        const downtown = Math.hypot(bx + 0.5 - 5, by + 0.5 - 3.2) < 2.6;
        for (let q = 0; q < 4; q++) {
          const qx = q & 1, qy = q >> 1;
          const kind = bx >= 7 && by >= 4 ? "ind" : r() < (downtown ? 0.45 : 0.08) ? "tower" : "res";
          lots.push(lot(lots.length, kind, bx, by, qx, qy, bx * B + R + qx * (half + 4), by * B + R + qy * (half + 4), half, half));
        }
      }
    // neighbours share a side inside the same block
    for (const a of lots)
      a.near = lots.filter((b) => b !== a && b.bx === a.bx && b.by === a.by && Math.abs(b.qx - a.qx) + Math.abs(b.qy - a.qy) === 1).map((b) => b.id);
    return lots;
  }

  // a lot is reached from its nearest block corner and parked on the street that borders it
  function lot(id, kind, bx, by, qx, qy, x, y, w, h) {
    const node = nid(bx + qx, by + qy);
    const c = nodePoint(node);
    const num = (bx * 2 + qx) * 4 + (qy ? 2 : 1);
    return {
      id, kind, bx, by, qx, qy, x, y, w, h, cx: x + w / 2, cy: y + h / 2,
      node, spot: { x: c.x + (qx ? -26 : 26), y: c.y },
      addr: `${HSTREETS[by + qy]} ${num}`,
      integrity: 100, state: "ok", fire: null, floors: kind === "tower" ? 8 + Math.floor((id * 7) % 9) : kind === "hosp" ? 6 : 2,
    };
  }

  function hydrants(r) {
    const hq = nid(HQ_BLOCK[0], HQ_BLOCK[1] + 1), out = new Set();
    while (out.size < 12) {
      const n = Math.floor(r() * (W + 1) * (H + 1));
      if (n !== hq && NEIGH[n].length) out.add(n);
    }
    return [...out];
  }

  function create(seed = 1) {
    const r = rng(seed);
    const s = {
      seed, r, t: 0, ids: 1,
      lots: makeCity(r), hydrants: hydrants(r),
      hq: nid(HQ_BLOCK[0], HQ_BLOCK[1] + 1),
      fires: [], trucks: [], log: [],
      staff: STAFF, hired: 0, budget: 60000, rep: 80,
      saved: 0, lost: 0, avoided: 0, damage: 0, fuelSpent: 0,
      next: 4, over: null, code: "green",
    };
    FLEET.forEach(([type, n], i) => {
      const bay = bayPoint(i);
      s.trucks.push({
        id: i, type, n, name: `${TRUCKS[type].code} ${n}`, state: "base",
        x: bay.x, y: bay.y, px: bay.x, py: bay.y, dir: -Math.PI / 2, node: s.hq,
        route: [], fire: null, water: TRUCKS[type].tank, fuel: 100, spraying: false, odo: 0,
      });
    });
    say(s, "info", "Inizio turno notturno: 5 mezzi in caserma, 14 operatori in servizio.");
    return s;
  }

  // parking bays inside the station block, nose to the street
  function bayPoint(i) {
    return { x: HQ_BLOCK[0] * B + 22 + i * 14, y: HQ_BLOCK[1] * B + 70, n: nid(HQ_BLOCK[0], HQ_BLOCK[1] + 1) };
  }

  function say(s, kind, text, extra = {}) {
    s.log.push({ id: s.log.length, at: clock(s), kind, text, ...extra });
  }

  // ---------- queries ----------
  const clockSec = (s) => CLOCK0 + s.t * CLOCK_RATE;
  function clock(s) {
    const m = Math.floor(clockSec(s) / 60) % (24 * 60);
    return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
  }
  const fireById = (s, id) => s.fires.find((f) => f.id === id) || null;
  const isOut = (t) => t.state !== "base" && t.state !== "refill";
  const staffFree = (s) => s.staff - s.trucks.reduce((n, t) => n + (isOut(t) ? TRUCKS[t.type].crew : 0), 0);
  const onScene = (s, f) => s.trucks.filter((t) => t.fire === f.id && (t.state === "engaged" || t.state === "enroute"));
  const ladderOn = (s, f) => s.trucks.some((t) => t.fire === f.id && t.state === "engaged" && TRUCKS[t.type].ladder);

  // can this truck take a new call, and if not, why
  function readiness(s, t) {
    if (t.state === "base" || t.state === "refill") {
      if (staffFree(s) < TRUCKS[t.type].crew) return "Personale insufficiente";
      if (t.water < TRUCKS[t.type].tank * 0.25) return "Serbatoio quasi vuoto";
      return null;
    }
    if (t.state === "returning") return t.water < TRUCKS[t.type].tank * 0.25 ? "Serbatoio quasi vuoto" : null;
    return "Già impegnato";
  }

  // driving distance (units) from where the truck stands to the fire's spot
  function distance(s, t, f) {
    const start = t.route.length ? t.route[0] : t.state === "base" || t.state === "refill" ? nodePoint(s.hq) : nodePoint(t.node);
    const lead = Math.hypot(start.x - t.x, start.y - t.y);
    return lead + (astar(start.n, f.lot.node).length - 1) * B + 26;
  }
  const eta = (s, t, f) => distance(s, t, f) / TRUCKS[t.type].speed;

  // ---------- commands ----------
  function routeTo(s, t, node, end) {
    const start = t.route.length ? t.route[0] : t.state === "base" || t.state === "refill" ? nodePoint(s.hq) : nodePoint(t.node);
    t.route = [start, ...astar(start.n, node).slice(1).map(nodePoint)];
    if (end) t.route.push({ ...end, n: node });
  }

  function dispatch(s, truckId, fireId) {
    const t = s.trucks[truckId], f = fireById(s, fireId);
    if (!t || !f || readiness(s, t)) return false;
    // a few metres apart along the kerb, so several trucks on one fire don't overlap
    const k = s.trucks.filter((u) => u.fire === f.id).length;
    const spot = { x: f.lot.spot.x + (f.lot.qx ? -1 : 1) * k * 13, y: f.lot.spot.y + (k % 2 ? 9 : -9) * (k ? 1 : 0) };
    t.fire = f.id;
    t.state = "enroute";
    t.spraying = false;
    routeTo(s, t, f.lot.node, spot);
    if (!f.dispatched) f.dispatched = s.t;
    say(s, "dispatch", `${t.name} inviato in ${f.lot.addr} (ETA ${mmss(eta(s, t, f) * CLOCK_RATE)})`, { fire: f.id });
    return true;
  }

  function recall(s, truckId) {
    const t = s.trucks[truckId];
    if (!t || !isOut(t) || t.state === "returning") return false;
    goHome(s, t);
    say(s, "info", `${t.name} richiamato in caserma.`);
    return true;
  }

  function hire(s) {
    if (s.hired >= HIRE.max || s.budget < HIRE.cost || s.over) return false;
    s.hired++;
    s.staff += HIRE.staff;
    s.budget -= HIRE.cost;
    say(s, "info", `Straordinari: richiamati ${HIRE.staff} operatori fuori turno (−€${HIRE.cost.toLocaleString("it-IT")}).`);
    return true;
  }

  function goHome(s, t) {
    t.fire = null;
    t.state = "returning";
    t.spraying = false;
    routeTo(s, t, s.hq, bayPoint(t.id));
  }

  function toHydrant(s, t) {
    let best = null, bd = Infinity;
    for (const h of s.hydrants) {
      const d = astar(t.node, h).length;
      if (d < bd) (bd = d), (best = h);
    }
    t.state = "tohydrant";
    t.spraying = false;
    const p = nodePoint(best);
    routeTo(s, t, best, { x: p.x + 8, y: p.y + 8 });
    say(s, "warn", `${t.name} a secco: rifornimento all'idrante ${VSTREETS[best % (W + 1)]} / ${HSTREETS[Math.floor(best / (W + 1))]}.`);
  }

  const mmss = (sec) => {
    const m = Math.round(sec / 60);
    return m < 1 ? "<1 min" : m + " min";
  };

  // ---------- simulation ----------
  function step(s, dt = DT) {
    if (s.over) return;
    s.t += dt;
    for (const t of s.trucks) {
      t.px = t.x;
      t.py = t.y;
      truckStep(s, t, dt);
    }
    for (const f of s.fires.slice()) fireStep(s, f, dt);

    s.next -= dt;
    if (s.next <= 0) {
      spawn(s);
      const mean = 34 - 20 * Math.min(1, s.t / SHIFT);
      s.next = mean * (0.5 + s.r());
    }
    s.rep = clamp(s.rep, 0, 100);
    s.code = !s.fires.length ? "green" : s.fires.some((f) => f.level === 3) || s.fires.length >= 4 ? "red" : "yellow";
    if (s.rep <= 0) end(s, "lose");
    else if (s.t >= SHIFT) end(s, "win");
  }

  function end(s, how) {
    s.over = how;
    say(s, how === "win" ? "ok" : "alarm", how === "win" ? "Fine turno: la città passa al turno del mattino." : "La giunta ha perso fiducia nella centrale: turno sospeso.");
  }

  function truckStep(s, t, dt) {
    const k = TRUCKS[t.type];
    if (t.route.length) {
      let left = k.speed * (t.fuel > 0 ? 1 : 0.35) * dt, moved = 0;
      while (left > 1e-9 && t.route.length) {
        const p = t.route[0], dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy);
        if (d > 1e-6) t.dir = Math.atan2(dy, dx);
        if (d <= left) {
          t.x = p.x;
          t.y = p.y;
          t.node = p.n;
          t.route.shift();
          left -= d;
          moved += d;
        } else {
          t.x += (dx / d) * left;
          t.y += (dy / d) * left;
          moved += left;
          left = 0;
        }
      }
      const before = t.fuel;
      t.fuel = Math.max(0, t.fuel - moved * FUEL_PER_UNIT);
      t.odo += moved;
      if (before >= 20 && t.fuel < 20) say(s, "warn", `${t.name}: riserva di carburante.`);
      if (!t.route.length) arrive(s, t);
      return;
    }
    if (t.state === "refill") {
      const fuel = Math.min(100 - t.fuel, 6 * dt);
      t.fuel += fuel;
      s.budget -= fuel * FUEL_PRICE;
      s.fuelSpent += fuel * FUEL_PRICE;
      t.water = Math.min(k.tank, t.water + 160 * dt);
      if (t.fuel >= 100 - 1e-6 && t.water >= k.tank) t.state = "base";
    } else if (t.state === "hydrant") {
      t.water = Math.min(k.tank, t.water + 75 * dt);
      if (t.water >= k.tank) {
        const f = fireById(s, t.fire);
        if (f) {
          t.state = "enroute";
          routeTo(s, t, f.lot.node, { x: f.lot.spot.x, y: f.lot.spot.y + 9 });
        } else goHome(s, t);
      }
    } else if (t.state === "engaged") {
      const f = fireById(s, t.fire);
      if (!f) return goHome(s, t);
      const kind = KINDS[f.lot.kind];
      let eff = kind.chem ? 0.75 : 1;
      if (kind.tall && !k.ladder && !ladderOn(s, f)) eff *= 0.3;
      const use = Math.min(t.water, k.flow * dt);
      t.water -= use;
      f.hp -= use * KILL * eff;
      t.spraying = use > 0;
      if (t.water <= 1e-6) toHydrant(s, t);
    }
  }

  function arrive(s, t) {
    if (t.state === "enroute") {
      const f = fireById(s, t.fire);
      if (f) {
        t.state = "engaged";
        if (!f.arrived) {
          f.arrived = s.t;
          say(s, "info", `${t.name} sul posto in ${f.lot.addr}.`, { fire: f.id });
        }
      } else goHome(s, t);
    } else if (t.state === "tohydrant") t.state = "hydrant";
    else if (t.state === "returning") {
      t.state = "refill";
      t.dir = -Math.PI / 2;
    }
  }

  function spawn(s) {
    if (s.fires.length >= 7) return;
    const free = s.lots.filter((l) => l.state === "ok" && !l.fire);
    if (!free.length) return;
    const l = pick(s.r, free);
    ignite(s, l, 12 + s.r() * 22 + (KINDS[l.kind].chem ? 10 : 0), "call");
  }

  function ignite(s, l, hp, how) {
    const f = { id: s.ids++, lot: l, hp, start: hp, peak: hp, level: level(hp), t0: s.t, spread: 0, dispatched: 0, arrived: 0 };
    l.fire = f.id;
    s.fires.push(f);
    const what = pick(s.r, CALLS[l.kind]);
    if (how === "call") say(s, "call", `Incendio ${l.addr} — ${what} — Priorità ${f.level}`, { fire: f.id, pri: f.level });
    else say(s, "alarm", `Propagazione: fiamme anche in ${l.addr} — Priorità ${f.level}`, { fire: f.id, pri: f.level });
    return f;
  }

  function fireStep(s, f, dt) {
    const l = f.lot, kind = KINDS[l.kind];
    if (f.hp <= 0) return extinguish(s, f);
    const heat = 1 + 0.5 * Math.min(1, s.t / SHIFT);
    f.hp = Math.min(100, f.hp + kind.grow * (0.6 + f.hp / 80) * heat * dt);
    f.peak = Math.max(f.peak, f.hp);
    const lv = level(f.hp);
    if (lv > f.level) say(s, "alarm", `${l.addr}: l'incendio sale a priorità ${lv}.`, { fire: f.id, pri: lv });
    f.level = lv;
    l.integrity -= f.hp * DAMAGE * dt;
    if (lv === 3 && !s.trucks.some((t) => t.fire === f.id && t.state === "engaged")) s.rep -= 0.05 * dt;
    if (l.integrity <= 0) return collapse(s, f);
    if (f.hp > 65) {
      f.spread += dt;
      if (f.spread > 18) {
        f.spread = 0;
        const next = l.near.map((i) => s.lots[i]).filter((n) => n.state === "ok" && !n.fire);
        if (next.length) ignite(s, pick(s.r, next), 18, "spread");
      }
    }
  }

  function extinguish(s, f) {
    const l = f.lot, kind = KINDS[l.kind], peak = level(f.peak);
    s.fires.splice(s.fires.indexOf(f), 1);
    l.fire = null;
    s.saved++;
    s.avoided += (kind.value * l.integrity) / 100;
    s.budget += 1000 + 800 * peak;
    s.rep += 2 + peak;
    for (const t of s.trucks) if (t.fire === f.id && t.state !== "tohydrant" && t.state !== "hydrant") goHome(s, t);
    for (const t of s.trucks) if (t.fire === f.id) t.fire = null;
    say(s, "ok", `Spento in ${l.addr} in ${mmss((s.t - f.t0) * CLOCK_RATE)} — struttura salva al ${Math.round(l.integrity)}%.`, { fire: f.id });
  }

  function collapse(s, f) {
    const l = f.lot, kind = KINDS[l.kind];
    s.fires.splice(s.fires.indexOf(f), 1);
    l.fire = null;
    l.state = "ruin";
    l.integrity = 0;
    s.lost++;
    s.damage += kind.value;
    s.rep -= kind.tall ? 20 : 12;
    for (const t of s.trucks) if (t.fire === f.id) t.state === "tohydrant" || t.state === "hydrant" ? (t.fire = null) : goHome(s, t);
    say(s, "alarm", `Crollo in ${l.addr}: ${kind.label.toLowerCase()} perso (€${Math.round(kind.value / 1000).toLocaleString("it-IT")}k).`);
  }

  // ---------- autopilot: the tile preview and node balance runs ----------
  function auto(s) {
    for (const f of s.fires.slice().sort((a, b) => b.hp - a.hp)) {
      const on = onScene(s, f);
      const tall = KINDS[f.lot.kind].tall;
      const needLadder = tall && !on.some((t) => TRUCKS[t.type].ladder);
      const want = f.hp > 60 ? 3 : f.hp > 30 ? 2 : 1;
      if (on.length >= want && !needLadder) continue;
      const free = s.trucks.filter((t) => !readiness(s, t));
      if (!free.length) continue;
      const pool = needLadder && free.some((t) => TRUCKS[t.type].ladder) ? free.filter((t) => TRUCKS[t.type].ladder) : free;
      const best = pool.reduce((a, b) => (eta(s, a, f) <= eta(s, b, f) ? a : b));
      dispatch(s, best.id, f.id);
    }
    if (staffFree(s) < 2 && s.budget > HIRE.cost * 2) hire(s);
  }

  function score(s) {
    return Math.round(s.saved * 120 + s.avoided / 20000 - s.lost * 150 + s.rep * 10);
  }

  const api = {
    B, W, H, DT, SHIFT, CLOCK_RATE, M_PER_UNIT, STAFF, HIRE, TRUCKS, KINDS, STATUS, VSTREETS, HSTREETS,
    HQ_BLOCK, HOSP_BLOCK, PARKS, CLOSED, NEIGH,
    create, step, dispatch, recall, hire, auto, score, clock, clockSec, staffFree, readiness, distance, eta,
    fireById, nodePoint, nid, level, bayPoint, rng, astar,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.Dispatch = api;
})(this);
