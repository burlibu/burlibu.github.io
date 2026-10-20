// Vault engine: a 36-month personal finance game. DOM-free, so whole games
// can be played in node to tune the numbers (module.exports at the bottom).
(function (root) {
  const MONTHS = 36;
  const GOAL = 50000;
  const ASSETS = ["save", "index", "crypto"];

  // monthly return [mean, deviation] per market regime
  const MARKET = {
    calm: { index: [0.0075, 0.035], crypto: [0.02, 0.15] },
    bull: { index: [0.02, 0.03], crypto: [0.06, 0.2] },
    bear: { index: [-0.02, 0.05], crypto: [-0.06, 0.2] },
  };
  const SAVE_RATE = 0.003; // deposit account, ~3.6% a year

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
  const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const between = (s, a, b) => a + Math.floor(s.rand() * (b - a + 1));

  // schedule an effect from LATER a few months from now
  const later = (s, months, id) => s.queue.push({ at: s.month + months, id });

  const WELCOME = {
    tag: "BRIEFING",
    title: "Benvenuto nel Vault",
    text: "Hai €3.000 e 36 mesi. Ogni mese entrano €2.600 di stipendio ed escono €1.750 di spese: decidi tu dove far lavorare il resto. Obiettivo: €50.000 di patrimonio netto, senza perdere la testa.",
  };

  // info events change things at once; choice events wait for the player
  const EVENTS = [
    { id: "bonus", w: 3, tag: "ENTRATA", title: "Bonus di produzione", text: "Il trimestre è andato bene e l'azienda divide gli utili.", cash: 1200 },
    { id: "caldaia", w: 3, tag: "IMPREVISTO", title: "Caldaia guasta", text: "Riparazione urgente: il tecnico arriva in giornata, il conto anche.", cash: -950 },
    { id: "multa", w: 2, tag: "IMPREVISTO", title: "Multa per eccesso di velocità", text: "Il tutor in autostrada ti ha visto, e non perdona.", cash: -210 },
    { id: "rimborso", w: 2, tag: "ENTRATA", title: "Rimborso del 730", text: "Lo Stato ti restituisce una parte delle tasse dell'anno scorso.", cash: 680 },
    { id: "dentista", w: 2, tag: "IMPREVISTO", title: "Dentista", text: "Una carie e una pulizia. Niente di grave, tranne il preventivo.", cash: -460 },
    { id: "affitto", w: 1, once: true, tag: "COSTI FISSI", title: "Aumento dell'affitto", text: "Il contratto si rinnova con l'adeguamento ISTAT: €120 in più al mese.", expenses: 120 },
    {
      id: "crollo", w: 1.3, tag: "MERCATO", title: "Crollo dei mercati",
      text: "Una banca regionale fallisce e il panico si allarga: ETF −14%, crypto −38%.",
      apply(s) { s.index *= 0.86; s.crypto *= 0.62; s.regime = "bear"; },
    },
    {
      id: "euforia", w: 1.3, tag: "MERCATO", title: "Euforia sulle crypto",
      text: "Approvato un nuovo ETF spot: tutti vogliono entrare. Crypto +30%.",
      apply(s) { s.crypto *= 1.3; s.regime = "bull"; },
    },
    {
      id: "corso", w: 2.2, once: true, tag: "OPPORTUNITÀ", title: "Corso di specializzazione",
      text: "Sei mesi di lezioni serali per €1.500. Chi l'ha finito ha ottenuto un aumento.",
      options: [
        { label: "Iscriviti", sub: "−€1.500 · +€320/mese fra 4 mesi", apply(s) { s.cash -= 1500; s.mood -= 4; later(s, 4, "aumento"); } },
        { label: "Non ora", sub: "nessun costo", apply() {} },
      ],
    },
    {
      id: "startup", w: 1.6, once: true, when: (s) => s.month > 5, tag: "CARRIERA", title: "Offerta da una startup",
      text: "€550 in più al mese, ma i fondi bastano per un anno. Forse.",
      options: [
        {
          label: "Accetta", sub: "+€550/mese · rischio chiusura",
          apply(s) { s.salary += 550; s.mood += 6; if (s.rand() < 0.4) later(s, between(s, 5, 10), "chiusura"); },
        },
        { label: "Resta dove sei", sub: "stipendio sicuro", apply() {} },
      ],
    },
    {
      id: "meme", w: 1.8, tag: "TENTAZIONE", title: "Il token del tuo amico",
      text: "«È il prossimo Dogecoin, fidati.» Servono €800, entro stasera.",
      options: [
        { label: "Investi €800", sub: "tutto o niente, il mese prossimo", apply(s) { s.cash -= 800; later(s, 1, "meme"); } },
        { label: "Passo", sub: "tieni i soldi", apply() {} },
      ],
    },
    {
      id: "vacanza", w: 2, tag: "BENESSERE", title: "Vacanza con gli amici",
      text: "Una settimana in Grecia, volo e casa divisi in quattro.",
      options: [
        { label: "Parti", sub: "−€1.100 · benessere +22", apply(s) { s.cash -= 1100; s.mood += 22; } },
        { label: "Resta a casa", sub: "benessere −10", apply(s) { s.mood -= 10; } },
      ],
    },
    {
      id: "auto", w: 1.2, once: true, tag: "SPESA", title: "La tua auto ha 15 anni",
      text: "Il concessionario propone un finanziamento a tasso zero su un'ibrida nuova.",
      options: [
        { label: "Auto nuova", sub: "+€290/mese di rata · benessere +12", apply(s) { s.expenses += 290; s.mood += 12; } },
        { label: "Tienila", sub: "rischio di un guasto", apply(s) { if (s.rand() < 0.55) later(s, between(s, 2, 7), "guasto"); } },
      ],
    },
    {
      id: "telefono", w: 1.5, tag: "TENTAZIONE", title: "È uscito il nuovo telefono",
      text: "Il tuo funziona ancora benissimo. Però la fotocamera nuova…",
      options: [
        { label: "Compralo", sub: "−€1.050 · benessere +8", apply(s) { s.cash -= 1050; s.mood += 8; } },
        { label: "Resisti", sub: "benessere −2", apply(s) { s.mood -= 2; } },
      ],
    },
    {
      id: "prestito", w: 1, once: true, tag: "FAMIGLIA", title: "Tuo cugino chiede un prestito",
      text: "€2.000 per aprire un food truck. Giura che li restituirà con gli interessi.",
      options: [
        {
          label: "Presta", sub: "70% di riaverli, +15%",
          apply(s) { s.cash -= 2000; s.mood += 4; later(s, between(s, 6, 11), s.rand() < 0.7 ? "restituito" : "perso"); },
        },
        { label: "Rifiuta", sub: "benessere −6", apply(s) { s.mood -= 6; } },
      ],
    },
  ];

  // delayed outcomes: each returns the news shown and logged that month
  const LATER = {
    aumento: (s) => ((s.salary += 320), { tag: "CARRIERA", title: "Aumento ottenuto", text: "Il corso ha funzionato: €320 in più in busta paga, ogni mese.", v: 320 }),
    chiusura: (s) => {
      s.salary -= 550;
      s.cash -= 2 * s.salary;
      s.mood -= 15;
      return { tag: "CARRIERA", title: "La startup chiude", text: "Due mesi senza stipendio, poi torni al vecchio lavoro.", v: -2 * s.salary };
    },
    meme: (s) => {
      if (s.rand() < 0.4) {
        s.cash += 3200;
        return { tag: "TENTAZIONE", title: "Il token è esploso", text: "Il tuo amico aveva ragione, per una volta: €800 diventano €3.200.", v: 3200 };
      }
      return { tag: "TENTAZIONE", title: "Il token è sparito", text: "Il sito non risponde più. Gli €800 sono andati.", v: 0 };
    },
    guasto: (s) => ((s.cash -= 1300), { tag: "IMPREVISTO", title: "Si rompe la frizione", text: "La vecchia auto ha ceduto: carro attrezzi e officina.", v: -1300 }),
    restituito: (s) => ((s.cash += 2300), { tag: "FAMIGLIA", title: "Prestito restituito", text: "Il food truck va forte: tuo cugino ti ridà €2.300.", v: 2300 }),
    perso: (s) => ((s.mood -= 8), { tag: "FAMIGLIA", title: "Il food truck ha chiuso", text: "Tuo cugino non risponde più al telefono.", v: 0 }),
    burnout: (s) => ((s.cash -= 600), (s.mood += 25), { tag: "BENESSERE", title: "Esaurimento", text: "Troppi sacrifici: due settimane di stop e un weekend alle terme.", v: -600 }),
  };

  const net = (s) => s.cash + s.save + s.index + s.crypto - s.debt;
  const snap = (s) => ({ m: s.month, net: net(s), cash: s.cash, save: s.save, index: s.index, crypto: s.crypto, debt: s.debt });

  function create(seed) {
    const s = {
      seed, rand: rng(seed), month: 0,
      cash: 3000, save: 0, index: 0, crypto: 0, debt: 0,
      salary: 2600, expenses: 1750, mood: 70, regime: "calm",
      gains: 0, interest: 0, last: { save: 0, index: 0, crypto: 0 },
      queue: [], seen: {}, history: [], log: [], event: WELCOME, over: null,
    };
    s.history.push(snap(s));
    return s;
  }

  function log(s, text, v) {
    s.log.unshift({ m: s.month, text, v });
    s.log.length = Math.min(s.log.length, 60);
  }

  // negative cash becomes credit card debt; spare cash pays it back
  function settle(s) {
    if (s.cash < 0) { s.debt += -s.cash; s.cash = 0; }
    const pay = Math.min(s.debt, s.cash);
    s.debt -= pay;
    s.cash -= pay;
    if (s.debt < 0.5) s.debt = 0;
    s.mood = clamp(s.mood, 0, 100);
  }

  function pick(s) {
    const pool = EVENTS.filter((e) => !(e.once && s.seen[e.id]) && (!e.when || e.when(s)) && e.id !== s.lastEvent);
    let r = s.rand() * pool.reduce((t, e) => t + e.w, 0);
    return pool.find((e) => (r -= e.w) < 0) || pool[0];
  }

  // plan: % of the spare cash moved into each asset; opt: {emergency, frugal}
  function step(s, plan, opt = {}) {
    if (s.over || (s.event && s.event.options)) return false;
    s.event = null;
    s.month++;
    let news = null;

    const spend = Math.round(s.expenses * (opt.frugal ? 0.85 : 1));
    s.cash += s.salary - spend;
    s.mood += opt.frugal ? -2.5 : 0.6;
    if (s.debt) {
      const fee = s.debt * 0.018;
      s.debt += fee;
      s.interest += fee;
    }
    settle(s);

    // markets move before this month's money goes in
    const t = s.rand();
    if (s.regime === "calm") s.regime = t < 0.07 ? "bull" : t < 0.13 ? "bear" : "calm";
    else if (t < (s.regime === "bull" ? 0.25 : 0.3)) s.regime = "calm";
    const m = MARKET[s.regime];
    const z = gauss(s.rand);
    const r = {
      save: SAVE_RATE,
      index: m.index[0] + m.index[1] * z,
      crypto: Math.max(-0.6, m.crypto[0] + m.crypto[1] * (0.6 * z + 0.8 * gauss(s.rand))),
    };
    for (const k of ASSETS) {
      const g = s[k] * r[k];
      s[k] += g;
      s.gains += g;
    }
    s.last = r;

    const free = Math.max(0, s.cash - (opt.emergency ? spend * 3 : 0));
    for (const k of ASSETS) {
      const a = (free * (plan[k] || 0)) / 100;
      s[k] += a;
      s.cash -= a;
    }

    s.queue = s.queue.filter((q) => {
      if (q.at > s.month) return true;
      news = LATER[q.id](s);
      log(s, news.title, news.v);
      return false;
    });
    if (s.mood < 18 && !s.queue.some((q) => q.id === "burnout")) later(s, 1, "burnout");

    if (s.month < MONTHS && s.rand() < 0.5) {
      const e = pick(s);
      s.seen[e.id] = true;
      s.lastEvent = e.id;
      if (e.options) {
        s.event = e;
      } else {
        if (e.cash) s.cash += e.cash;
        if (e.expenses) s.expenses += e.expenses;
        if (e.apply) e.apply(s);
        s.event = { tag: e.tag, title: e.title, text: e.text, v: e.cash || (e.expenses ? -e.expenses : null) };
        log(s, e.title, e.cash || 0);
      }
    }
    if (!s.event && news) s.event = news;
    settle(s);

    s.history.push(snap(s));
    if (s.debt > 12000) s.over = "bancarotta";
    else if (s.month >= MONTHS) s.over = "fine";
    if (s.over) s.event = null;
    return true;
  }

  function choose(s, i) {
    const e = s.event;
    if (!e || !e.options || s.over) return;
    const o = e.options[i];
    const before = s.cash;
    o.apply(s);
    log(s, `${e.title}: ${o.label.toLowerCase()}`, s.cash - before);
    s.event = { tag: e.tag, title: e.title, text: `Hai scelto: ${o.label.toLowerCase()}. ${o.sub}.`, chosen: true };
    settle(s);
    s.history[s.history.length - 1] = snap(s);
  }

  // sell a share of one asset back to cash (crypto pays a 1% fee)
  function sell(s, k, frac) {
    if (s.over || !s[k]) return;
    const a = s[k] * frac;
    s[k] -= a;
    s.cash += k === "crypto" ? a * 0.99 : a;
    settle(s);
    log(s, `Vendita ${{ save: "conto deposito", index: "ETF", crypto: "crypto" }[k]}`, 0);
    s.history[s.history.length - 1] = snap(s);
  }

  function score(s) {
    const pts = Math.round(net(s) + s.mood * 150);
    const grade = s.over === "bancarotta" ? "F" : pts >= 66000 ? "S" : pts >= 54000 ? "A" : pts >= 44000 ? "B" : pts >= 34000 ? "C" : "D";
    return { pts, grade };
  }

  const api = { MONTHS, GOAL, ASSETS, create, step, choose, sell, net, score };
  if (typeof module !== "undefined") module.exports = api;
  else root.Vault = api;
})(this);
