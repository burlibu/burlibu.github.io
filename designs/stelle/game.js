// Stelle Erranti engine: a short elemental adventure across three star-map
// regions. DOM-free, so whole runs can be played in node (module.exports at
// the bottom) to tune the numbers. All randomness comes from the seeded rng.
(function (root) {
  const EL = {
    anemo: { name: "Vento", color: "#48e5c2" },
    geo: { name: "Roccia", color: "#edb840" },
    electro: { name: "Tuono", color: "#a65bfa" },
    dendro: { name: "Natura", color: "#86dc3d" },
    hydro: { name: "Acqua", color: "#2980fe" },
    pyro: { name: "Fuoco", color: "#ff5a36" },
    cryo: { name: "Ghiaccio", color: "#8be3ff" },
  };

  const HEROES = {
    aria: { name: "Aria", el: "anemo", stars: 4, hp: 900, atk: 62, title: "Bardo dei venti", skill: "Raffica", burst: "Occhio del ciclone" },
    brann: { name: "Brann", el: "pyro", stars: 4, hp: 1000, atk: 70, title: "Fabbro di braci", skill: "Brace", burst: "Pioggia di braci" },
    lin: { name: "Lin", el: "hydro", stars: 4, hp: 950, atk: 58, title: "Danzatrice di marea", skill: "Onda lunare", burst: "Alta marea" },
    noor: { name: "Noor", el: "dendro", stars: 4, hp: 1000, atk: 62, title: "Erborista del bosco", skill: "Germoglio", burst: "Foresta antica" },
    sera: { name: "Sera", el: "cryo", stars: 5, hp: 1050, atk: 84, title: "Custode della brina", skill: "Fiore di brina", burst: "Inverno eterno" },
    kael: { name: "Kael", el: "electro", stars: 5, hp: 1050, atk: 88, title: "Lancia del tuono", skill: "Fulmine", burst: "Tempesta viola" },
    tor: { name: "Tor", el: "geo", stars: 5, hp: 1350, atk: 72, title: "Guardiano dei monti", skill: "Pilastro", burst: "Cuore di monte" },
  };
  const ITEMS = ["Spada del viandante", "Arco del cacciatore", "Catalizzatore di quarzo", "Lancia di ferro nero", "Spadone di quercia"];

  const REGIONS = [
    {
      name: "Prati del Vento",
      foes: [["Melma di fuoco", "pyro"], ["Melma d'acqua", "hydro"], ["Guardiano di rovi", "dendro"]],
      elite: ["Mago dell'abisso", "hydro"], boss: ["Drago dei venti", "anemo"],
      hp: 560, atk: 62,
    },
    {
      name: "Gole di Roccia",
      foes: [["Lupo di pietra", "geo"], ["Spirito del tuono", "electro"], ["Arciere di cenere", "pyro"]],
      elite: ["Sentinella runica", "electro"], boss: ["Golem antico", "geo"],
      hp: 900, atk: 84,
    },
    {
      name: "Cime di Brina",
      foes: [["Spettro di brina", "cryo"], ["Cavaliere del tuono", "electro"], ["Lupo del gelo", "cryo"]],
      elite: ["Strega del gelo", "cryo"], boss: ["Regina dell'inverno", "cryo"],
      hp: 1300, atk: 104,
    },
  ];
  const KIND = { battle: [1, 1], elite: [1.8, 1.25], boss: [3.4, 1.4] }; // hp, atk multipliers
  const REWARD = { battle: [60, 90], elite: [150, 190], boss: [320, 320] };
  const XP = { battle: 40, elite: 90, boss: 160 };
  const WISH = 160;
  const PITY = 20;

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
  const between = (s, a, b) => a + Math.floor(s.rand() * (b - a + 1));
  const oneOf = (s, list) => list[Math.floor(s.rand() * list.length)];

  // ---------- elemental reactions: the aura already on the foe meets a new element ----------
  const SWIRL = ["pyro", "hydro", "electro", "cryo"];
  const PAIRS = {
    "hydro+pyro": { name: "Vaporizzazione", mult: 2 },
    "cryo+pyro": { name: "Fusione", mult: 2 },
    "electro+pyro": { name: "Sovraccarico", mult: 1.7 },
    "electro+hydro": { name: "Elettrocarica", mult: 1.6 },
    "cryo+hydro": { name: "Congelamento", mult: 1.2, freeze: 1 },
    "cryo+electro": { name: "Superconduzione", mult: 1.4, vuln: 2 },
    "dendro+hydro": { name: "Fioritura", mult: 1.8 },
    "dendro+pyro": { name: "Combustione", mult: 1.5, burn: 2 },
    "dendro+electro": { name: "Catalisi", mult: 1.6 },
  };
  function reaction(aura, el) {
    if (!aura || aura === el) return null;
    if (el === "anemo") return SWIRL.includes(aura) ? { name: "Turbine", mult: 1.5 } : null;
    if (el === "geo") return SWIRL.includes(aura) ? { name: "Cristallizzazione", mult: 1.3, shield: true } : null;
    return PAIRS[[aura, el].sort().join("+")] || null;
  }

  // ---------- heroes ----------
  const stat = (s, id) => {
    const h = HEROES[id], r = s.roster[id], g = 1 + 0.08 * (r.lvl - 1);
    return { maxhp: Math.round(h.hp * g), atk: Math.round(h.atk * g * (1 + 0.1 * r.cons) + r.bonus) };
  };
  function join(s, id, lvl) {
    s.roster[id] = { lvl, xp: 0, cons: 0, bonus: 0, hp: 0, energy: 0, cd: 0 };
    s.roster[id].hp = stat(s, id).maxhp;
    if (s.party.length < 4) s.party.push(id);
  }
  const alive = (s) => s.party.filter((id) => s.roster[id].hp > 0);
  function heal(s, frac) {
    for (const id of s.party) {
      const r = s.roster[id];
      r.hp = Math.min(stat(s, id).maxhp, Math.max(r.hp, 0) + stat(s, id).maxhp * frac);
    }
  }
  function gainXp(s, n) {
    const ups = [];
    for (const id of s.party) {
      const r = s.roster[id];
      if (r.hp <= 0) continue;
      r.xp += n;
      while (r.xp >= 100 * r.lvl && r.lvl < 20) {
        const before = stat(s, id).maxhp;
        r.xp -= 100 * r.lvl;
        r.lvl++;
        r.hp += stat(s, id).maxhp - before;
        ups.push(HEROES[id].name);
      }
    }
    return ups;
  }

  // ---------- star map: six layers per region, start to boss ----------
  function buildMap(s) {
    const L = 6, nodes = [];
    const layers = [];
    for (let l = 0; l < L; l++) {
      const n = l === 0 || l === L - 1 ? 1 : between(s, 2, 3);
      layers.push(
        Array.from({ length: n }, (_, i) => {
          const type =
            l === 0 ? "start" : l === L - 1 ? "boss" : l === L - 2 ? (i === 0 ? "fountain" : oneOf(s, ["event", "battle", "chest"])) : l === 3 && i === n - 1 ? "elite" : pickType(s);
          const node = {
            id: nodes.length, layer: l, type, next: [], done: false,
            x: 90 + (l * 820) / (L - 1) + (l && l < L - 1 ? (s.rand() - 0.5) * 50 : 0),
            y: n === 1 ? 280 : 90 + (i * 380) / (n - 1) + (s.rand() - 0.5) * 40,
          };
          nodes.push(node);
          return node;
        })
      );
    }
    // link each node to the matching node(s) of the next layer, then make
    // sure nobody in the next layer is unreachable
    for (let l = 0; l < L - 1; l++) {
      const a = layers[l], b = layers[l + 1];
      a.forEach((node, i) => {
        const j = a.length === 1 ? Math.floor(s.rand() * b.length) : Math.round((i * (b.length - 1)) / (a.length - 1));
        node.next.push(b[j].id);
        if (j + 1 < b.length && s.rand() < 0.5) node.next.push(b[j + 1].id);
        else if (j > 0 && s.rand() < 0.3) node.next.push(b[j - 1].id);
      });
      b.forEach((node) => {
        if (!a.some((p) => p.next.includes(node.id))) {
          const near = a.reduce((m, p) => (Math.abs(p.y - node.y) < Math.abs(m.y - node.y) ? p : m));
          near.next.push(node.id);
        }
      });
    }
    nodes[0].done = true;
    return nodes;
  }
  function pickType(s) {
    const r = s.rand();
    return r < 0.5 ? "battle" : r < 0.68 ? "event" : r < 0.84 ? "chest" : "fountain";
  }

  // ---------- events met on the map ----------
  const EVENTS = [
    {
      title: "Statua dei sette venti",
      text: "Una statua consumata dal tempo stringe una sfera che brilla appena. L'aria intorno è tiepida.",
      options: [
        { label: "Prega", sub: "cura la compagnia del 40%", apply(s) { heal(s, 0.4); return "La luce della statua richiude le ferite."; } },
        { label: "Prosegui", sub: "nessun effetto", apply() { return "Saluti la statua con un cenno e riprendi il cammino."; } },
      ],
    },
    {
      title: "Mercante errante",
      text: "Un mercante con un carretto pieno di ampolle ti fa cenno di avvicinarti.",
      options: [
        {
          label: "Pozione d'ambra", sub: "80 gemme · cura completa", ok: (s) => s.gems >= 80,
          apply(s) { s.gems -= 80; heal(s, 1); return "La pozione sa di miele e di sole. Tutti in forze."; },
        },
        {
          label: "Mappa stellare", sub: "120 gemme · +80 esperienza", ok: (s) => s.gems >= 120,
          apply(s) { s.gems -= 120; const u = gainXp(s, 80); return "La mappa svela scorciatoie antiche." + (u.length ? ` Sale di livello: ${u.join(", ")}.` : ""); },
        },
        { label: "Grazie, no", sub: "tieni le gemme", apply() { return "Il mercante alza le spalle e riparte cantando."; } },
      ],
    },
    {
      title: "Forziere sigillato",
      text: "Un forziere avvolto da catene di luce. Il sigillo vibra: forzarlo potrebbe costare caro.",
      options: [
        {
          label: "Forza il sigillo", sub: "60%: 240 gemme · 40%: −20% PV",
          apply(s) {
            if (s.rand() < 0.6) { s.gems += 240; return "Il sigillo cede: dentro, un mucchio di gemme astrali."; }
            for (const id of s.party) { const r = s.roster[id]; if (r.hp > 0) r.hp = Math.max(1, r.hp - stat(s, id).maxhp * 0.2); }
            return "Il sigillo esplode in una pioggia di scintille. Ferite leggere per tutti.";
          },
        },
        { label: "Lascialo", sub: "nessun rischio", apply() { return "Meglio non svegliare ciò che dorme."; } },
      ],
    },
    {
      title: "Lago di stelle",
      text: "Uno specchio d'acqua riflette un cielo che non è quello sopra di te.",
      options: [
        { label: "Immergiti", sub: "+60 esperienza", apply(s) { const u = gainXp(s, 60); return "Visioni di battaglie antiche ti insegnano qualcosa." + (u.length ? ` Sale di livello: ${u.join(", ")}.` : ""); } },
        { label: "Bevi", sub: "cura del 25%", apply(s) { heal(s, 0.25); return "L'acqua è fredda come la notte, e rinfranca."; } },
      ],
    },
    {
      title: "Viaggiatore ferito",
      text: "Un viaggiatore è seduto sul ciglio della strada, con una gamba fasciata alla meglio.",
      options: [
        {
          label: "Aiutalo", sub: "−10% PV · ricompensa?",
          apply(s) {
            for (const id of s.party) { const r = s.roster[id]; if (r.hp > 0) r.hp = Math.max(1, r.hp - stat(s, id).maxhp * 0.1); }
            const g = between(s, 100, 200); s.gems += g;
            return `Lo accompagni fino al villaggio. Per ringraziarti ti dona ${g} gemme.`;
          },
        },
        { label: "Prosegui", sub: "nessun effetto", apply() { return "Ti volti, e la strada sembra più lunga."; } },
      ],
    },
  ];

  // ---------- run ----------
  function create(seed) {
    const s = {
      seed, rand: rng(seed), region: 0, at: 0, gems: 320, pity: 0,
      roster: {}, party: [], log: [], screen: null, over: null,
      stats: { battles: 0, reactions: 0, wishes: 0, best: 0 },
    };
    ["aria", "brann", "lin"].forEach((id) => join(s, id, 1));
    s.map = buildMap(s);
    note(s, `Il viaggio comincia nei ${REGIONS[0].name}.`);
    return s;
  }
  function note(s, text, tone) {
    s.log.unshift({ text, tone });
    s.log.length = Math.min(s.log.length, 50);
  }
  const here = (s) => s.map[s.at];
  const options = (s) => (s.screen || s.over ? [] : here(s).next);

  function travel(s, id) {
    if (!options(s).includes(id)) return false;
    s.at = id;
    const n = here(s);
    n.done = true;
    if (n.type === "battle" || n.type === "elite" || n.type === "boss") startBattle(s, n.type);
    else if (n.type === "event") {
      const e = oneOf(s, EVENTS.filter((x) => x !== s.lastEvent));
      s.lastEvent = e;
      s.screen = { type: "event", event: e };
    } else if (n.type === "chest") {
      const g = between(s, 160, 240);
      s.gems += g;
      note(s, `Forziere prezioso: +${g} gemme.`, "gold");
      s.screen = { type: "result", tone: "gold", title: "Forziere prezioso", text: `Fra monete e cianfrusaglie, ${g} gemme astrali.`, gems: g };
    } else if (n.type === "fountain") {
      for (const id of s.party) s.roster[id].hp = stat(s, id).maxhp;
      note(s, "Fontana dei viandanti: compagnia rimessa in forze.", "good");
      s.screen = { type: "result", tone: "good", title: "Fontana dei viandanti", text: "L'acqua scintilla di luce stellare: ferite chiuse, compagni rianimati." };
    }
    return true;
  }

  function choose(s, i) {
    if (!s.screen || s.screen.type !== "event") return;
    const e = s.screen.event, o = e.options[i];
    if (!o || (o.ok && !o.ok(s))) return;
    const text = o.apply(s);
    note(s, `${e.title}: ${o.label.toLowerCase()}.`);
    s.screen = { type: "result", title: e.title, text };
  }

  // close a result screen; after a boss, move on to the next region
  function proceed(s) {
    if (!s.screen || s.screen.type === "battle" || s.screen.type === "event") return;
    const boss = s.screen.boss;
    s.screen = null;
    if (boss) {
      if (s.region === REGIONS.length - 1) return void (s.over = "vittoria");
      s.region++;
      s.map = buildMap(s);
      s.at = 0;
      heal(s, 0.5);
      for (const id of s.party) if (s.roster[id].hp <= 0) s.roster[id].hp = stat(s, id).maxhp * 0.3;
      note(s, `Nuova regione: ${REGIONS[s.region].name}.`, "gold");
    }
  }

  // ---------- battle ----------
  function startBattle(s, kind) {
    const R = REGIONS[s.region];
    const [name, el] = kind === "boss" ? R.boss : kind === "elite" ? R.elite : oneOf(s, R.foes);
    const [hm, am] = KIND[kind];
    const maxhp = Math.round(R.hp * hm * (0.9 + s.rand() * 0.2));
    for (const id of s.party) Object.assign(s.roster[id], { energy: 0, cd: 0 });
    s.screen = {
      type: "battle", kind, turn: 1, shield: 0, fx: [],
      active: s.party.find((id) => s.roster[id].hp > 0),
      foe: { name, el, hp: maxhp, maxhp, atk: Math.round(R.atk * am), aura: null, frozen: 0, vuln: 0, burn: 0, intent: "strike" },
    };
    note(s, `${kind === "boss" ? "Boss" : kind === "elite" ? "Élite" : "Battaglia"}: ${name}.`);
  }

  function switchTo(s, id) {
    const b = s.screen;
    if (!b || b.type !== "battle" || !s.party.includes(id) || s.roster[id].hp <= 0) return;
    b.active = id;
  }

  // what an action of hero id would do right now (for the UI and the autopilot)
  function preview(s, id, action) {
    const b = s.screen, f = b.foe, h = HEROES[id], r = s.roster[id];
    if (action === "skill" && r.cd > 0) return null;
    if (action === "burst" && r.energy < 100) return null;
    const el = action === "attack" ? null : h.el;
    const re = el && f.el !== el ? reaction(f.aura, el) : null;
    const base = { attack: 1, skill: 1.9, burst: 3.6 }[action];
    const dmg = stat(s, id).atk * base * (re ? re.mult : 1) * (f.vuln ? 1.25 : 1) * (el && el === f.el ? 0.5 : 1);
    return { dmg, re };
  }

  function act(s, action) {
    const b = s.screen;
    if (!b || b.type !== "battle") return;
    const id = b.active, r = s.roster[id], h = HEROES[id], f = b.foe;
    const p = preview(s, id, action);
    if (!p) return;
    b.fx = [];
    const dmg = Math.round(p.dmg * (0.92 + s.rand() * 0.16));
    f.hp = Math.max(0, f.hp - dmg);
    b.fx.push({ to: "foe", dmg, el: action === "attack" ? null : h.el, re: p.re && p.re.name });
    const el = action === "attack" ? null : h.el;
    if (p.re) {
      s.stats.reactions++;
      f.aura = null;
      if (p.re.freeze) f.frozen = p.re.freeze;
      if (p.re.vuln) f.vuln = p.re.vuln;
      if (p.re.burn) f.burn = p.re.burn;
      if (p.re.shield) b.shield += Math.round(stat(s, id).atk * 3);
    } else if (el && el !== "anemo" && el !== "geo" && el !== f.el) f.aura = el;
    s.stats.best = Math.max(s.stats.best, dmg);

    r.energy = action === "burst" ? 0 : Math.min(100, r.energy + (action === "skill" ? 30 : 12) + (p.re ? 10 : 0));
    if (action === "skill") r.cd = 2;
    for (const k of s.party) if (k !== id || action !== "skill") s.roster[k].cd = Math.max(0, s.roster[k].cd - 1);
    b.last = `${h.name} usa ${action === "attack" ? "un attacco" : action === "skill" ? h.skill : h.burst}` + (p.re ? `: ${p.re.name}!` : ".");

    if (f.hp > 0) foeTurn(s);
    if (f.hp <= 0) return win(s);
    if (!alive(s).length) return lose(s);
    b.turn++;
  }

  function foeTurn(s) {
    const b = s.screen, f = b.foe;
    if (f.burn) {
      const d = Math.round(f.maxhp * 0.05);
      f.hp = Math.max(0, f.hp - d);
      f.burn--;
      b.fx.push({ to: "foe", dmg: d, el: "pyro", re: "Bruciatura" });
      if (f.hp <= 0) return;
    }
    if (f.vuln) f.vuln--;
    if (f.frozen) {
      f.frozen--;
      f.intent = "strike";
      b.last += ` ${f.name} è congelato.`;
      return;
    }
    const boss = b.kind === "boss";
    const hit = (id, mult) => {
      let d = Math.round(f.atk * mult * (0.9 + s.rand() * 0.2));
      const absorbed = Math.min(b.shield, d);
      b.shield -= absorbed;
      d -= absorbed;
      const r = s.roster[id];
      r.hp = Math.max(0, r.hp - d);
      b.fx.push({ to: id, dmg: d, el: f.el, shield: absorbed });
    };
    if (f.intent === "charge") {
      hit(b.active, 2.2);
      b.last += ` ${f.name} scatena il colpo caricato!`;
    } else if (f.intent === "sweep") {
      alive(s).forEach((id) => hit(id, 0.6));
      b.last += ` ${f.name} colpisce tutta la compagnia.`;
    } else hit(b.active, 1);
    // aura from the foe's own element never sticks to itself; pick next intent
    const t = s.rand();
    f.intent = boss && b.turn % 3 === 2 ? "sweep" : t < 0.3 ? "charge" : "strike";
    if (s.roster[b.active].hp <= 0) {
      const next = alive(s)[0];
      if (next) {
        b.last += ` ${HEROES[b.active].name} è esausto: entra ${HEROES[next].name}.`;
        b.active = next;
      }
    }
  }

  function win(s) {
    const b = s.screen, k = b.kind;
    const [a, z] = REWARD[k];
    const g = between(s, a, z);
    s.gems += g;
    s.stats.battles++;
    const ups = gainXp(s, XP[k] + s.region * 20);
    note(s, `Vittoria su ${b.foe.name}: +${g} gemme.`, "gold");
    s.screen = {
      type: "result", tone: "gold", boss: k === "boss",
      title: k === "boss" ? "Boss sconfitto" : "Vittoria",
      text: `${b.foe.name} si dissolve in polvere di stelle.` + (ups.length ? ` Sale di livello: ${ups.join(", ")}.` : ""),
      gems: g,
    };
  }
  function lose(s) {
    note(s, "La compagnia è caduta.", "bad");
    s.screen = null;
    s.over = "sconfitta";
  }

  // ---------- wishes ----------
  function wish(s) {
    if (s.gems < WISH || (s.screen && s.screen.type !== "wish") || s.over) return null;
    s.gems -= WISH;
    s.pity++;
    s.stats.wishes++;
    const r = s.rand();
    const party = s.party.length ? s.party : Object.keys(s.roster);
    let out;
    if (s.pity >= PITY || r < 0.07) {
      s.pity = 0;
      out = { stars: 5, id: oneOf(s, ["sera", "kael", "tor"]) };
    } else if (r < 0.4) out = { stars: 4, id: oneOf(s, ["aria", "brann", "lin", "noor"]) };
    else {
      const to = oneOf(s, party);
      s.roster[to].bonus += 6;
      out = { stars: 3, item: oneOf(s, ITEMS), to };
    }
    if (out.id) {
      if (s.roster[out.id]) {
        const c = s.roster[out.id];
        out.dupe = c.cons < 6;
        if (out.dupe) c.cons++;
        else s.gems += 40;
      } else {
        const lv = Math.max(1, Math.round(party.reduce((t, id) => t + s.roster[id].lvl, 0) / party.length));
        join(s, out.id, lv);
        out.fresh = true;
      }
    }
    note(s, out.item ? `Desiderio: ${out.item} per ${HEROES[out.to].name}.` : `Desiderio: ${HEROES[out.id].name} ${"★".repeat(out.stars)}${out.fresh ? " si unisce!" : ""}`, out.stars === 5 ? "gold" : out.stars === 4 ? "epic" : null);
    s.screen = { type: "wish", out };
    return out;
  }

  // add or remove a hero from the party between fights (1 to 4 members)
  function toggle(s, id) {
    if (s.screen && s.screen.type === "battle") return;
    if (!s.roster[id]) return;
    const i = s.party.indexOf(id);
    if (i >= 0) { if (s.party.length > 1) s.party.splice(i, 1); }
    else if (s.party.length < 4) s.party.push(id);
  }

  // ---------- autopilot: a decent player, used by the tile preview and node tests ----------
  function auto(s) {
    if (s.over) return "over";
    const sc = s.screen;
    if (!sc) {
      if (s.gems >= WISH + 60 && s.rand() < 0.5) return wish(s), "wish";
      const opts = options(s).map((id) => s.map[id]);
      const hurt = s.party.some((id) => s.roster[id].hp < stat(s, id).maxhp * 0.5);
      const rank = (n) => (n.type === "fountain" ? (hurt ? 0 : 3) : n.type === "chest" ? 1 : n.type === "battle" ? 2 : n.type === "event" ? 2.5 : 4);
      opts.sort((a, b) => rank(a) - rank(b));
      return travel(s, opts[0].id), "travel";
    }
    if (sc.type === "event") {
      const i = sc.event.options.findIndex((o) => !o.ok || o.ok(s));
      return choose(s, i), "event";
    }
    if (sc.type === "battle") {
      let best = null;
      for (const id of alive(s))
        for (const a of ["burst", "skill", "attack"]) {
          const p = preview(s, id, a);
          if (!p) continue;
          const v = p.dmg + (p.re ? 40 : 0) + (a === "attack" ? 0 : 15) - (id === sc.active ? 0 : 5);
          if (!best || v > best.v) best = { id, a, v };
        }
      switchTo(s, best.id);
      return act(s, best.a), "act";
    }
    proceed(s);
    return "proceed";
  }

  const api = { EL, HEROES, REGIONS, WISH, PITY, create, stat, here, options, travel, choose, proceed, switchTo, preview, act, wish, toggle, auto, reaction };
  if (typeof module !== "undefined") module.exports = api;
  else root.Stelle = api;
})(this);
