// Benchmark dei modelli AI. Reads data.json (rebuilt every morning by
// scripts/ai-bench/fetch.mjs) and, on each visit, OpenRouter's live price list.
// Five views on the hash: #classifica, #benchmark/<name>, #prezzi, #aa, #fonti.
(() => {
  const $ = (id) => document.getElementById(id);
  const preview = new URLSearchParams(location.search).has("preview");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  // ---------- formatting: comma decimals, fixed decimals per metric ----------
  const nf = (d) => new Intl.NumberFormat("it-IT", { minimumFractionDigits: d, maximumFractionDigits: d });
  const f0 = nf(0), f1 = nf(1), f2 = nf(2);
  const DASH = '<span class="dash">–</span>';
  const pct = (v) => (v == null ? DASH : `${f1.format(v * 100)}%`);
  const eciF = (v) => (v == null ? DASH : f1.format(v));
  const money = (v) => (v == null ? DASH : v === 0 ? "$0" : v < 0.1 ? `$${nf(3).format(v)}` : `$${f2.format(v)}`);
  const tokens = (v) => (v == null ? DASH : v >= 1e6 ? `${nf(v % 1e6 ? 2 : 0).format(v / 1e6)} M` : `${f0.format(Math.round(v / 1000))} k`);
  const dateLong = (iso) => new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const stamp = (iso) => new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const t = (iso) => (iso ? Date.parse(iso) : NaN);
  const initials = (s) => (s || "?").replace(/\(.*?\)/g, "").split(/[\s,.-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  // names compared across sources: drop the "Org: " prefix, brackets and punctuation
  const norm = (s) => String(s || "").toLowerCase().replace(/^[^:]{1,40}:\s*/, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

  let D, models = [], orRows = [], orLive = false;
  const ACCESS = { "API access": "API", "Unknown": "n.d.", "Hosted access (no API)": "senza API", "Unreleased": "non uscito", "Limited access": "accesso limitato", "Open weights (unrestricted)": "aperti", "Open weights (restricted use)": "aperti, con limiti", "Open weights (non-commercial)": "aperti, non commerciali" };
  const accessTag = (m) => (m.open === 1 ? `<span class="tag open">aperti</span>` : m.open === 0 ? `<span class="tag">chiusi</span>` : `<span class="tag">${esc(ACCESS[m.access] || m.access || "n.d.")}</span>`);

  // ---------- load ----------
  async function load() {
    const r = await fetch(`data.json?d=${new Date().toISOString().slice(0, 13)}`);
    if (!r.ok) throw new Error(`data.json: HTTP ${r.status}`);
    D = await r.json();
    models = D.epoch ? D.epoch.models : [];
    orRows = D.openrouter || [];
    render();
    if (!preview) refreshPrices();
  }
  // OpenRouter answers the browser directly: its list replaces the morning copy
  async function refreshPrices() {
    try {
      const r = await fetch("https://openrouter.ai/api/v1/models");
      if (!r.ok) return;
      const { data } = await r.json();
      const n = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
      orRows = data
        .map((m) => ({
          id: m.id, name: m.name,
          created: m.created ? new Date(m.created * 1000).toISOString().slice(0, 10) : null,
          ctx: m.context_length || null,
          out: (m.top_provider && m.top_provider.max_completion_tokens) || null,
          pin: m.pricing && n(m.pricing.prompt) != null ? n(m.pricing.prompt) * 1e6 : null,
          pout: m.pricing && n(m.pricing.completion) != null ? n(m.pricing.completion) * 1e6 : null,
          mod: (m.architecture && m.architecture.modality) || null,
          cutoff: m.knowledge_cutoff || null,
        }))
        .filter((m) => m.pin == null || m.pin >= 0);
      orLive = new Date();
      linkPrices();
      if (current().view === "prezzi") renderPrices();
      $("pDate").innerHTML = priceDate();
    } catch (e) {}
  }

  // ---------- joining OpenRouter to the index by name (exact match only) ----------
  let byNorm = {};
  function linkPrices() {
    byNorm = {};
    for (const o of orRows) {
      if (/:free$/.test(o.id)) continue;
      const k = norm(o.name);
      if (!byNorm[k] || (o.pin ?? 1e9) < (byNorm[k].pin ?? 1e9)) byNorm[k] = o;
    }
    models.forEach((m) => (m.or = byNorm[norm(m.name)] || null));
    const eciByNorm = Object.fromEntries(models.map((m) => [norm(m.name), m]));
    orRows.forEach((o) => {
      o.m = /:free$/.test(o.id) ? null : eciByNorm[norm(o.name)] || null;
      o.avg = o.pin != null && o.pout != null ? (o.pin * 3 + o.pout) / 4 : null;
      o.prov = o.id.split("/")[0];
      o.free = o.pin === 0 && o.pout === 0;
    });
  }

  // ---------- router ----------
  const VIEWS = ["classifica", "benchmark", "prezzi", "aa", "fonti"];
  function current() {
    const [view, ...rest] = decodeURIComponent(location.hash.slice(1)).split("/");
    return { view: VIEWS.includes(view) ? view : view === "tutti" ? "classifica" : "classifica", arg: rest.join("/") };
  }
  const rendered = {};
  function show() {
    const { view, arg } = current();
    VIEWS.forEach((v) => ($("v-" + v).hidden = v !== view));
    document.querySelectorAll(".nav").forEach((a) => (a.dataset.view === view ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current")));
    document.title = { classifica: "Benchmark dei modelli AI", benchmark: "Benchmark · modelli AI", prezzi: "Prezzi e contesto · modelli AI", aa: "Artificial Analysis · modelli AI", fonti: "Fonti e metodo · modelli AI" }[view];
    if (view === "benchmark") renderBench(arg);
    else if (!rendered[view]) ({ classifica: renderOverview, prezzi: renderPrices, aa: renderAA, fonti: renderSources })[view]();
    rendered[view] = true;
    if (location.hash === "#tutti") $("tutti").scrollIntoView();
    else window.scrollTo(0, 0);
  }
  addEventListener("hashchange", show);

  function render() {
    $("loading").hidden = true;
    linkPrices();
    const up = D.updated ? `Aggiornato il ${stamp(D.updated)}` : "";
    const stale = Object.entries(D.sources || {}).filter(([, s]) => s.status === "stale").map(([k]) => NAMES[k]);
    document.querySelectorAll("[data-updated]").forEach((p) => (p.innerHTML = esc(up) + (stale.length ? ` · <span class="stale">non aggiornati oggi: ${esc(stale.join(", "))}</span>` : "")));
    $("pDate").innerHTML = priceDate();
    $("navAa").hidden = !D.aa;
    show();
  }
  const NAMES = { epoch: "Epoch AI", openrouter: "OpenRouter", aa: "Artificial Analysis" };
  const priceDate = () => (orLive ? `Listino di OpenRouter letto dal vivo alle ${orLive.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}` : D.sources?.openrouter?.fetched ? `Listino di OpenRouter del ${stamp(D.sources.openrouter.fetched)}` : "Listino di OpenRouter");

  // ---------- tooltip ----------
  const tip = $("tip");
  function tipAt(e, html) {
    tip.innerHTML = html;
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + w > innerWidth - 8) x = e.clientX - w - 14;
    if (y + h > innerHeight - 8) y = e.clientY - h - 14;
    tip.style.left = x + "px";
    tip.style.top = y + "px";
  }
  const tipOff = () => (tip.hidden = true);

  // ---------- scatter: dots per series, step lines, one scale per axis ----------
  // opts: { series: [{ color, r, alpha, points: [{ x, y, ref }] }], lines: [{ color, pts }],
  //         x: { type: "time" | "log", min, max }, y: { min, max, fmt }, tip(ref), click(ref) }
  function niceTicks(min, max, n = 5) {
    const span = max - min, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  }
  function scatter(el, o) {
    const W = el.clientWidth || 600, H = el.clientHeight || 280, L = 44, R = 12, T = 10, B = 26;
    const all = o.series.flatMap((s) => s.points);
    if (!all.length) return (el.innerHTML = `<p class="empty">Nessun risultato in questo periodo.</p>`);
    const xs = all.map((p) => p.x), ys = all.map((p) => p.y);
    let x0 = o.x.min ?? Math.min(...xs), x1 = o.x.max ?? Math.max(...xs);
    const log = o.x.type === "log";
    if (log) (x0 = 10 ** Math.floor(Math.log10(x0))), (x1 = 10 ** Math.ceil(Math.log10(x1)));
    else if (x1 === x0) (x0 -= 864e5 * 30), (x1 += 864e5 * 30);
    const yt = niceTicks(o.y.min ?? Math.min(...ys), o.y.max ?? Math.max(...ys));
    // the top tick sits above the maximum, so no dot touches the plot's edge
    const ymax = Math.max(...ys);
    if (yt[yt.length - 1] <= ymax) yt.push(+(yt[yt.length - 1] + (yt[1] - yt[0])).toFixed(10));
    // and the bottom tick below the minimum: the baseline is under every dot
    while (yt[0] > Math.min(...ys)) yt.unshift(+(yt[0] - (yt[1] - yt[0])).toFixed(10));
    const y0 = yt[0], y1 = yt[yt.length - 1];
    const sx = (v) => L + ((log ? Math.log10(v) - Math.log10(x0) : v - x0) / (log ? Math.log10(x1) - Math.log10(x0) : x1 - x0)) * (W - L - R);
    const sy = (v) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    let g = "";
    yt.forEach((v, i) => {
      g += `<line class="${i ? "grid" : "base"}" x1="${L}" x2="${W - R}" y1="${sy(v)}" y2="${sy(v)}" />`;
      g += `<text x="${L - 8}" y="${sy(v) + 4}" text-anchor="end">${o.y.fmt(v)}</text>`;
    });
    // x ticks: years (or half years on a short window), or powers of ten on a log scale
    let xt = [];
    if (log) for (let e = Math.log10(x0); e <= Math.log10(x1) + 1e-9; e++) xt.push([10 ** e, 10 ** e >= 1 ? `$${f0.format(10 ** e)}` : `$${10 ** e}`]);
    else {
      const a = new Date(x0), b = new Date(x1), months = (b - a) / 2.63e9;
      const step = months > 30 ? 12 : months > 12 ? 6 : 3;
      for (let d = new Date(a.getFullYear(), 0, 1); d <= b; d.setMonth(d.getMonth() + step))
        if (d >= a) xt.push([+d, step === 12 ? String(d.getFullYear()) : d.toLocaleDateString("it-IT", { month: "short", year: "2-digit" })]);
    }
    xt.forEach(([v, label], i) => {
      const x = sx(v), anchor = x < L + 20 ? "start" : x > W - R - 20 ? "end" : "middle";
      g += `<text x="${x}" y="${H - 6}" text-anchor="${anchor}">${label}</text>`;
    });
    for (const ln of o.lines || []) {
      if (ln.pts.length < 1) continue;
      let d = "";
      ln.pts.forEach(([x, y], i) => {
        const px = sx(x), py = sy(y);
        d += i ? (ln.step ? `H${px}V${py}` : `L${px},${py}`) : `M${px},${py}`;
      });
      if (ln.step && ln.to) d += `H${sx(ln.to)}`;
      g += `<path d="${d}" fill="none" stroke="${ln.color}" stroke-width="2" stroke-linejoin="round" />`;
    }
    const placed = [];
    for (const s of o.series)
      for (const p of s.points) {
        const px = sx(p.x), py = sy(p.y);
        placed.push({ px, py, p });
        g += `<circle cx="${px}" cy="${py}" r="${s.r || 3}" fill="${s.color}" fill-opacity="${s.alpha ?? 1}" />`;
      }
    for (const lab of o.labels || []) {
      const px = sx(lab.x), py = sy(lab.y);
      const anchor = px > W - 160 ? "end" : "start";
      g += `<text x="${px + (anchor === "end" ? -8 : 8)}" y="${py - 8}" text-anchor="${anchor}" style="fill:var(--text)">${esc(lab.text)}</text>`;
    }
    g += `<circle class="hover" r="5" fill="none" stroke="#fff" stroke-width="1.5" visibility="hidden" />`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label)}">${g}<rect class="hit" x="${L}" y="0" width="${W - L - R}" height="${H - B}" /></svg>`;
    const svg = el.querySelector("svg"), ring = svg.querySelector(".hover");
    const nearest = (e) => {
      const b = svg.getBoundingClientRect(), mx = ((e.clientX - b.left) / b.width) * W, my = ((e.clientY - b.top) / b.height) * H;
      let best = null, bd = 18 * 18;
      for (const q of placed) {
        const d = (q.px - mx) ** 2 + (q.py - my) ** 2;
        if (d < bd) (bd = d), (best = q);
      }
      return best;
    };
    svg.onmousemove = (e) => {
      const q = nearest(e);
      if (!q) return ring.setAttribute("visibility", "hidden"), tipOff();
      ring.setAttribute("cx", q.px);
      ring.setAttribute("cy", q.py);
      ring.setAttribute("visibility", "visible");
      tipAt(e, o.tip(q.p.ref));
    };
    svg.onmouseleave = () => (ring.setAttribute("visibility", "hidden"), tipOff());
    svg.onclick = (e) => {
      const q = nearest(e);
      if (q && o.click) o.click(q.p.ref);
    };
  }
  // the running best: each point that beats every earlier one
  function frontier(rows, x, y) {
    const out = [];
    let best = -Infinity;
    rows.filter((r) => !isNaN(x(r)) && y(r) != null).sort((a, b) => x(a) - x(b)).forEach((r) => {
      if (y(r) > best) (best = y(r)), out.push([x(r), y(r)]);
    });
    return out;
  }
  const charts = [];
  let resizeTimer;
  addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => charts.forEach((c) => !c.el.closest("[hidden]") && c.draw()), 150);
  });
  const chart = (el, draw) => {
    const c = { el, draw };
    charts.push(c);
    draw();
    return c;
  };

  // ---------- generic sortable table ----------
  // cols: [{ key, label, num, html(row), val(row), cls, key2 }]
  function table(el, cols, rows, state, onRow) {
    const thead = el.querySelector("thead"), tbody = el.querySelector("tbody");
    thead.innerHTML = `<tr>${cols
      .map((c) => {
        const on = state.sort === c.key;
        return `<th scope="col" class="${c.num ? "n" : ""}" ${on ? `aria-sort="${state.dir > 0 ? "ascending" : "descending"}"` : ""}>${
          c.val ? `<button type="button" data-k="${esc(c.key)}">${esc(c.label)}${on ? `<span class="dir">${state.dir > 0 ? "↑" : "↓"}</span>` : ""}</button>` : esc(c.label)
        }</th>`;
      })
      .join("")}</tr>`;
    const col = cols.find((c) => c.key === state.sort);
    const sorted = col
      ? rows.slice().sort((a, b) => {
          const va = col.val(a), vb = col.val(b);
          if (va == null && vb == null) return 0;
          if (va == null) return 1;
          if (vb == null) return -1;
          return (va < vb ? -1 : va > vb ? 1 : 0) * state.dir;
        })
      : rows;
    const shown = sorted.slice(0, state.limit || sorted.length);
    tbody.innerHTML = shown.length
      ? shown.map((r, i) => `<tr data-i="${rows.indexOf(r)}">${cols.map((c) => `<td class="${[c.num ? "n" : "", c.cls || "", c.key2 ? "key2" : ""].join(" ")}">${c.html(r, i)}</td>`).join("")}</tr>`).join("")
      : `<tr><td class="empty" colspan="${cols.length}">Nessun risultato con questi filtri.</td></tr>`;
    thead.onclick = (e) => {
      const b = e.target.closest("button[data-k]");
      if (!b) return;
      const k = b.dataset.k;
      state.dir = state.sort === k ? -state.dir : cols.find((c) => c.key === k).num ? -1 : 1;
      state.sort = k;
      table(el, cols, rows, state, onRow);
    };
    tbody.onclick = (e) => {
      const tr = e.target.closest("tr[data-i]");
      if (tr && onRow) onRow(rows[+tr.dataset.i]);
    };
    return sorted.length;
  }

  // =====================================================================
  // CLASSIFICA
  // =====================================================================
  const CLOSED = "var(--chart-1)", OPEN = "var(--chart-3)";
  function lagMonths() {
    const open = models.filter((m) => m.open === 1);
    if (!open.length) return null;
    const best = open.reduce((a, b) => (b.eci > a.eci ? b : a));
    const first = models.filter((m) => m.open === 0 && m.eci >= best.eci && m.date).sort((a, b) => t(a.date) - t(b.date))[0];
    if (!first) return { best, months: 0 };
    return { best, first, months: Math.max(0, Math.round((t(best.date) - t(first.date)) / 2.63e9)) };
  }
  function renderOverview() {
    const top = models[0], second = models[1];
    const lag = lagMonths();
    const tie = top.lo <= second.hi;
    $("finding").innerHTML =
      `<b>${esc(top.name)}</b> (${esc(top.org)}) guida l'indice ECI con ${eciF(top.eci)}, ${(top.eci - second.eci < 0.1 ? f2 : f1).format(top.eci - second.eci)} punti sopra ${esc(second.name)}` +
      (tie ? ": gli intervalli si sovrappongono, quindi i due sono alla pari." : ".") +
      (lag && lag.first
        ? ` Il miglior modello a pesi aperti, <b>${esc(lag.best.name)}</b>, è a ${eciF(lag.best.eci)}: i modelli chiusi c'erano arrivati ${lag.months} ${lag.months === 1 ? "mese" : "mesi"} prima, con ${esc(lag.first.name)}.`
        : lag ? ` Il miglior modello a pesi aperti, <b>${esc(lag.best.name)}</b>, è davanti a tutti i chiusi.` : "");
    const nResults = models.reduce((s, m) => s + Object.keys(m.s).length, 0);
    $("kpis").innerHTML = [
      ["Modelli nell'indice", `${f0.format(models.length)}`],
      ["Benchmark", `${f0.format(D.epoch.benchmarks.length)}<small>${f0.format(nResults)} risultati</small>`],
      ["Primo per ECI", `${eciF(top.eci)}<small>${esc(top.name)}</small>`],
      ["Ritardo dei pesi aperti", lag && lag.first ? `${lag.months}<small>${lag.months === 1 ? "mese" : "mesi"}</small>` : DASH],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
    $("rank").innerHTML = models
      .slice(0, 14)
      .map(
        (m, i) => `<li data-i="${i}" title="${esc(m.name)}"><span class="pos">${i + 1}</span><span class="org-dot" aria-hidden="true">${esc(initials(m.org))}</span>
        <span class="who"><b>${esc(m.name)}</b><span>${esc(m.org || "")}</span></span><span class="ci">${f1.format(m.lo)}–${f1.format(m.hi)}</span><span class="val">${eciF(m.eci)}</span></li>`
      )
      .join("");
    $("rank").onclick = (e) => {
      const li = e.target.closest("li[data-i]");
      if (li) openModel(models[+li.dataset.i]);
    };
    $("rank").parentElement.querySelector(".more").textContent = `Tutti i ${models.length} modelli`;
    $("frontLegend").innerHTML = `<li style="color:var(--chart-1)"><i class="line"></i><span style="color:var(--muted)">Pesi chiusi</span></li><li style="color:var(--chart-3)"><i class="line"></i><span style="color:var(--muted)">Pesi aperti</span></li>`;
    // the range selector: the same 1px line marks the chosen window
    const R = [["1A", 12], ["2A", 24], ["3A", 36], ["Tutto", 0]];
    let months = 0;
    $("frontRange").innerHTML = R.map(([l, m]) => `<button type="button" data-m="${m}" aria-pressed="${m === months}">${l}</button>`).join("");
    const draw = () => {
      const from = months ? Date.now() - months * 2.63e9 : -Infinity;
      const inWin = models.filter((m) => m.date && t(m.date) >= from);
      const pts = (open) => inWin.filter((m) => m.open === open).map((m) => ({ x: t(m.date), y: m.eci, ref: m }));
      const end = Math.max(...models.map((m) => t(m.date)).filter((v) => !isNaN(v)));
      const fr = (open) => frontier(models.filter((m) => m.open === open), (m) => t(m.date), (m) => m.eci).filter(([x], i, a) => x >= from || (a[i + 1] && a[i + 1][0] >= from));
      const clip = (pts) => pts.map(([x, y]) => [Math.max(x, from), y]);
      scatter($("frontChart"), {
        label: "Indice ECI dei modelli per data di uscita, con la frontiera dei modelli chiusi e di quelli aperti",
        series: [
          { color: CLOSED, alpha: 0.35, r: 2.5, points: pts(0) },
          { color: OPEN, alpha: 0.55, r: 2.5, points: pts(1) },
          { color: "var(--muted)", alpha: 0.35, r: 2, points: inWin.filter((m) => m.open == null).map((m) => ({ x: t(m.date), y: m.eci, ref: m })) },
        ],
        lines: [
          { color: CLOSED, step: true, pts: clip(fr(0)), to: end },
          { color: OPEN, step: true, pts: clip(fr(1)), to: end },
        ],
        x: { type: "time", min: months ? from : undefined, max: end },
        y: { fmt: (v) => f0.format(v) },
        tip: (m) => `<b>${esc(m.name)}</b><br>${esc(m.org || "")} · ${m.date}<br>ECI <span class="num">${eciF(m.eci)}</span> (${f1.format(m.lo)}–${f1.format(m.hi)})`,
        click: openModel,
      });
      $("frontNote").textContent = `${inWin.length} modelli · fonte Epoch AI`;
    };
    $("frontRange").onclick = (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      months = +b.dataset.m;
      $("frontRange").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      draw();
    };
    chart($("frontChart"), draw);
    setupModelTable();
  }

  // ---------- the models table ----------
  const COLS_KEY = "aibench.cols";
  const DEFAULT_COLS = ["GPQA diamond", "FrontierMath-Tiers-1-3-v2-Private", "SWE-Bench verified", "ARC-AGI-2", "Terminal Bench", "SimpleQA Verified", "METR Time Horizons"];
  const SHORT = { "FrontierMath-Tiers-1-3-v2-Private": "FrontierMath 1-3", "FrontierMath-Tier-4-v2-Private": "FrontierMath 4", "OTIS Mock AIME 2024-2025": "OTIS AIME", "SWE-Bench verified": "SWE-bench V.", "SimpleQA Verified": "SimpleQA V." };
  const short = (b) => SHORT[b] || b;
  function setupModelTable() {
    const known = new Set(D.epoch.benchmarks.map((b) => b.name));
    let cols = DEFAULT_COLS.filter((b) => known.has(b));
    try {
      const saved = JSON.parse(localStorage.getItem(COLS_KEY) || "null");
      if (Array.isArray(saved) && saved.every((b) => typeof b === "string")) cols = saved.filter((b) => known.has(b)).slice(0, 12);
    } catch (e) {}
    const orgs = [...new Set(models.map((m) => m.org).filter(Boolean).flatMap((o) => o.split(",")))].sort((a, b) => a.localeCompare(b));
    $("fOrg").innerHTML += orgs.map((o) => `<option>${esc(o)}</option>`).join("");
    const years = [...new Set(models.map((m) => m.date && m.date.slice(0, 4)).filter(Boolean))].sort().reverse();
    $("fYear").innerHTML += years.map((y) => `<option>${y}</option>`).join("");
    $("colsList").innerHTML = D.epoch.benchmarks
      .map((b) => `<label><input type="checkbox" value="${esc(b.name)}" ${cols.includes(b.name) ? "checked" : ""} /> ${esc(b.name)}<span>${b.n}</span></label>`)
      .join("");
    const state = { sort: "eci", dir: -1, limit: 50 };
    const draw = () => {
      const q = $("q").value.trim().toLowerCase(), open = $("fOpen").value, org = $("fOrg").value, year = $("fYear").value;
      const rows = models.filter(
        (m) =>
          (!q || `${m.name} ${m.org}`.toLowerCase().includes(q)) &&
          (open === "" || String(m.open) === open) &&
          (!org || (m.org || "").split(",").includes(org)) &&
          (!year || (m.date || "").startsWith(year))
      );
      const spec = [
        { key: "rank", label: "#", num: true, html: (m) => `<span class="dash">${models.indexOf(m) + 1}</span>` },
        { key: "name", label: "Modello", cls: "id", val: (m) => m.name.toLowerCase(), html: (m) => `${esc(m.name)}<small>${esc(m.org || "–")}</small>` },
        { key: "date", label: "Uscita", num: true, val: (m) => m.date, html: (m) => m.date || DASH },
        { key: "open", label: "Pesi", val: (m) => m.open, html: accessTag },
        { key: "eci", label: "ECI", num: true, cls: "key top", val: (m) => m.eci, html: (m) => `${eciF(m.eci)}<span class="sub">${f1.format(m.lo)}–${f1.format(m.hi)}</span>` },
        ...cols.map((b) => ({ key: "b:" + b, label: short(b), num: true, val: (m) => m.s[b], html: (m) => pct(m.s[b]) })),
        { key: "n", label: "Prove", num: true, val: (m) => Object.keys(m.s).length, html: (m) => Object.keys(m.s).length },
        { key: "price", label: "$ in / out", num: true, cls: "key2", val: (m) => (m.or ? m.or.avg : null), html: (m) => (m.or ? `${money(m.or.pin)} / ${money(m.or.pout)}` : DASH) },
      ];
      const total = table($("tModels"), spec, rows, state, openModel);
      $("tCount").textContent = `${Math.min(total, state.limit)} di ${total} modelli`;
      $("tMore").parentElement.hidden = total <= state.limit;
    };
    ["q", "fOpen", "fOrg", "fYear"].forEach((id) => $(id).addEventListener("input", () => ((state.limit = 50), draw())));
    $("tMore").onclick = () => ((state.limit += 50), draw());
    $("colsList").onchange = () => {
      cols = [...$("colsList").querySelectorAll("input:checked")].map((i) => i.value).slice(0, 12);
      try {
        localStorage.setItem(COLS_KEY, JSON.stringify(cols));
      } catch (e) {}
      draw();
    };
    document.addEventListener("click", (e) => !e.target.closest("#colsBox") && $("colsBox").removeAttribute("open"));
    draw();
  }

  // ---------- one model's sheet ----------
  function openModel(m) {
    $("sheetTitle").textContent = m.name;
    $("sheetSub").textContent = [m.org, m.country, m.date && `uscito il ${dateLong(m.date)}`].filter(Boolean).join(" · ");
    const rank = models.indexOf(m) + 1;
    const scores = Object.entries(m.s).sort((a, b) => b[1] - a[1]);
    const o = m.or;
    $("sheetBody").innerHTML =
      `<dl class="kpis"><div><dt>ECI</dt><dd>${eciF(m.eci)}<small>${rank}º di ${models.length}</small></dd></div>
        <div><dt>Intervallo al 90%</dt><dd>${f1.format(m.lo)}–${f1.format(m.hi)}</dd></div>
        <div><dt>Pesi</dt><dd style="font-family:var(--sans)">${esc(ACCESS[m.access] || m.access || "n.d.")}</dd></div></dl>` +
      (o
        ? `<h3>Su OpenRouter</h3><dl class="kpis"><div><dt>Input</dt><dd>${money(o.pin)}<small>/M token</small></dd></div><div><dt>Output</dt><dd>${money(o.pout)}<small>/M token</small></dd></div><div><dt>Contesto</dt><dd>${tokens(o.ctx)}</dd></div></dl>`
        : "") +
      `<h3>${scores.length} benchmark</h3><ul class="bars">${scores
        .map(([b, v]) => `<li><a class="lbl" href="#benchmark/${encodeURIComponent(b)}">${esc(b)}</a><span class="num">${pct(v)}</span><span class="track"><i style="width:${Math.max(0, Math.min(1, v)) * 100}%"></i></span></li>`)
        .join("")}</ul>`;
    const sheet = $("sheet");
    if (!sheet.open) sheet.showModal();
    sheet.scrollTop = 0;
  }
  $("sheetClose").onclick = () => $("sheet").close();
  $("sheet").addEventListener("click", (e) => (e.target === $("sheet") || e.target.closest("a")) && $("sheet").close());

  // =====================================================================
  // BENCHMARK
  // =====================================================================
  function benchList() {
    const list = D.epoch.benchmarks.map((b) => ({ ...b, rows: models.filter((m) => m.s[b.name] != null).map((m) => ({ name: m.name, org: m.org, date: m.date, open: m.open, v: m.s[b.name], m })) }));
    for (const [name, rows] of Object.entries(D.epoch.extra || {}))
      if (rows.length) list.push({ name, n: rows.length, eci: false, out: true, released: null, rows: rows.map((r) => ({ ...r, open: null, m: models.find((m) => norm(m.name) === norm(r.name)) || null })) });
    return list;
  }
  let BL;
  function renderBench(arg) {
    BL ||= benchList();
    const b = BL.find((x) => x.name === arg) || BL[0];
    $("bCount").textContent = `${BL.length} prove`;
    const drawList = () => {
      const q = $("bq").value.trim().toLowerCase();
      $("blist").innerHTML = BL.filter((x) => !q || x.name.toLowerCase().includes(q))
        .map(
          (x) => `<li><button type="button" data-b="${esc(x.name)}" ${x === b ? 'aria-current="true"' : ""} style="--w:${Math.min(90, x.name.length * 1.4)}%"><span>${esc(x.name)}${x.out ? `<span class="out">fuori indice</span>` : ""}</span><span class="num">${x.rows.length}</span></button></li>`
        )
        .join("");
    };
    $("bq").oninput = drawList;
    $("blist").onclick = (e) => {
      const btn = e.target.closest("button[data-b]");
      if (btn) location.hash = "benchmark/" + encodeURIComponent(btn.dataset.b);
    };
    drawList();
    $("blist").querySelector('[aria-current="true"]')?.scrollIntoView({ block: "nearest" });

    const rows = b.rows.slice().sort((a, z) => z.v - a.v);
    const best = rows[0];
    $("h-benchmark").textContent = b.name;
    $("bFinding").innerHTML = best
      ? `Il punteggio più alto è di <b>${esc(best.name)}</b> (${esc(best.org || "–")}), ${pct(best.v)}` +
        (b.baseline ? `; rispondendo a caso si fa ${pct(b.baseline)}` : "") +
        (b.ceiling != null ? `. Epoch stima il tetto raggiungibile al ${pct(b.ceiling)}${best.v > b.ceiling ? ", già superato" : ""}.` : ".") +
        (b.superseded ? ` Questa versione è stata sostituita da ${esc(b.superseded)}.` : "")
      : "Nessun risultato.";
    $("bKpis").innerHTML = [
      ["Risultati", f0.format(rows.length)],
      ["Miglior punteggio", best ? pct(best.v) : DASH],
      ["A caso", b.baseline != null ? pct(b.baseline) : DASH],
      ["Pubblicato", b.released ? `<span style="font-size:16px">${b.released}</span>` : DASH],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
    $("bLegend").innerHTML = `<li style="color:var(--chart-1)"><i></i><span style="color:var(--muted)">Un modello</span></li><li style="color:var(--chart-3)"><i class="line"></i><span style="color:var(--muted)">Miglior punteggio fino a quella data</span></li>`;
    const dated = rows.filter((r) => r.date);
    const draw = () =>
      scatter($("bChart"), {
        label: `${b.name}: punteggio dei modelli per data di uscita`,
        series: [{ color: CLOSED, alpha: 0.6, r: 3, points: dated.map((r) => ({ x: t(r.date), y: r.v * 100, ref: r })) }],
        lines: [{ color: OPEN, step: true, pts: frontier(dated, (r) => t(r.date), (r) => r.v * 100), to: Math.max(...dated.map((r) => t(r.date))) }],
        x: { type: "time" },
        y: { min: 0, fmt: (v) => `${f0.format(v)}%` },
        tip: (r) => `<b>${esc(r.name)}</b><br>${esc(r.org || "")} · ${r.date}<br><span class="num">${pct(r.v)}</span>`,
        click: (r) => r.m && openModel(r.m),
      });
    if (!$("bChart").dataset.bound) {
      $("bChart").dataset.bound = 1;
      chart($("bChart"), () => $("bChart")._draw && $("bChart")._draw());
    }
    $("bChart")._draw = draw;
    draw();
    $("bNote").textContent = `${dated.length} modelli con data · fonte Epoch AI`;
    $("bTableTitle").textContent = `Tutti i risultati su ${b.name}`;
    const state = { sort: "v", dir: -1 };
    table(
      $("tBench"),
      [
        { key: "pos", label: "#", num: true, html: (r) => `<span class="dash">${rows.indexOf(r) + 1}</span>` },
        { key: "name", label: "Modello", cls: "id", val: (r) => r.name.toLowerCase(), html: (r) => `${esc(r.name)}<small>${esc(r.org || "–")}</small>` },
        { key: "date", label: "Uscita", num: true, val: (r) => r.date, html: (r) => r.date || DASH },
        { key: "open", label: "Pesi", val: (r) => r.open, html: (r) => (r.open === 1 ? `<span class="tag open">aperti</span>` : r.open === 0 ? `<span class="tag">chiusi</span>` : DASH) },
        { key: "v", label: "Punteggio", num: true, cls: "key top", val: (r) => r.v, html: (r) => pct(r.v) },
        { key: "eci", label: "ECI", num: true, cls: "key2", val: (r) => (r.m ? r.m.eci : null), html: (r) => (r.m ? eciF(r.m.eci) : DASH) },
      ],
      rows,
      state,
      (r) => r.m && openModel(r.m)
    );
  }

  // =====================================================================
  // PREZZI
  // =====================================================================
  let priceSetup = false;
  function renderPrices() {
    const linked = orRows.filter((o) => o.m && o.avg > 0);
    // the price-capability frontier: nobody else is more capable for less
    const pareto = linked
      .slice()
      .sort((a, b) => a.avg - b.avg || b.m.eci - a.m.eci)
      .filter(((best) => (o) => o.m.eci > best && ((best = o.m.eci), true))(-Infinity));
    const cheapTop = pareto[pareto.length - 1];
    const paid = orRows.filter((o) => o.avg > 0);
    const med = paid.map((o) => o.avg).sort((a, b) => a - b)[Math.floor(paid.length / 2)];
    $("pFinding").innerHTML =
      `${f0.format(orRows.length)} modelli in listino, ${f0.format(orRows.filter((o) => o.free).length)} gratuiti; il prezzo medio mediano è ${money(med)} per milione di token.` +
      (cheapTop ? ` Il più capace della frontiera prezzo-capacità è <b>${esc(cheapTop.m.name)}</b> a ${money(cheapTop.avg)}.` : "");
    $("pRank").innerHTML = pareto
      .slice()
      .reverse()
      .slice(0, 14)
      .map((o, i) => `<li data-id="${esc(o.id)}"><span class="pos">${i + 1}</span><span class="org-dot" aria-hidden="true">${esc(initials(o.prov))}</span><span class="who"><b>${esc(o.m.name)}</b><span>ECI ${eciF(o.m.eci)}</span></span><span class="ci"></span><span class="val">${money(o.avg)}</span></li>`)
      .join("") || `<li class="empty">Nessun modello del listino ha un indice ECI.</li>`;
    $("pRank").onclick = (e) => {
      const li = e.target.closest("li[data-id]");
      const o = li && orRows.find((x) => x.id === li.dataset.id);
      if (o && o.m) openModel(o.m);
    };
    $("pLegend").innerHTML = `<li style="color:var(--chart-1)"><i></i><span style="color:var(--muted)">Un modello</span></li><li style="color:var(--chart-3)"><i class="line"></i><span style="color:var(--muted)">Frontiera prezzo-capacità</span></li>`;
    const draw = () =>
      scatter($("pChart"), {
        label: "Indice ECI contro prezzo medio per milione di token",
        series: [{ color: CLOSED, alpha: 0.55, r: 3, points: linked.map((o) => ({ x: o.avg, y: o.m.eci, ref: o })) }],
        lines: [{ color: OPEN, pts: pareto.map((o) => [o.avg, o.m.eci]) }],
        x: { type: "log" },
        y: { fmt: (v) => f0.format(v) },
        tip: (o) => `<b>${esc(o.m.name)}</b><br>ECI <span class="num">${eciF(o.m.eci)}</span><br><span class="num">${money(o.pin)}</span> input · <span class="num">${money(o.pout)}</span> output /M`,
        click: (o) => openModel(o.m),
      });
    $("pChart")._draw = draw;
    if (!priceSetup) chart($("pChart"), () => $("pChart")._draw());
    else draw();

    if (!priceSetup) {
      priceSetup = true;
      ["pq", "pProv", "pFree", "pMod", "pEci"].forEach((id) => $(id).addEventListener("input", () => ((pState.limit = 50), drawPrices())));
      $("pMore").onclick = () => ((pState.limit += 50), drawPrices());
    }
    const provs = [...new Set(orRows.map((o) => o.prov))].sort();
    const keep = $("pProv").value;
    $("pProv").innerHTML = `<option value="">Tutti i fornitori</option>` + provs.map((p) => `<option ${p === keep ? "selected" : ""}>${esc(p)}</option>`).join("");
    const mods = [...new Set(orRows.map((o) => o.mod).filter(Boolean))].sort();
    const keepM = $("pMod").value;
    $("pMod").innerHTML = `<option value="">Tutte le modalità</option>` + mods.map((p) => `<option ${p === keepM ? "selected" : ""}>${esc(p)}</option>`).join("");
    drawPrices();
  }
  const pState = { sort: "created", dir: -1, limit: 50 };
  function drawPrices() {
    const q = $("pq").value.trim().toLowerCase(), prov = $("pProv").value, free = $("pFree").value, mod = $("pMod").value, eci = $("pEci").checked;
    const rows = orRows.filter(
      (o) =>
        (!q || `${o.name} ${o.id}`.toLowerCase().includes(q)) &&
        (!prov || o.prov === prov) &&
        (!free || (free === "free" ? o.free : !o.free)) &&
        (!mod || o.mod === mod) &&
        (!eci || o.m)
    );
    const total = table(
      $("tPrice"),
      [
        { key: "name", label: "Modello", cls: "id", val: (o) => o.name.toLowerCase(), html: (o) => `${esc(o.name)}<small>${esc(o.id)}</small>` },
        { key: "pin", label: "Input $/M", num: true, val: (o) => o.pin, html: (o) => money(o.pin) },
        { key: "pout", label: "Output $/M", num: true, cls: "key", val: (o) => o.pout, html: (o) => money(o.pout) },
        { key: "avg", label: "Medio $/M", num: true, val: (o) => o.avg, html: (o) => money(o.avg) },
        { key: "ctx", label: "Contesto", num: true, cls: "key2", val: (o) => o.ctx, html: (o) => tokens(o.ctx) },
        { key: "out", label: "Output max", num: true, val: (o) => o.out, html: (o) => tokens(o.out) },
        { key: "mod", label: "Modalità", val: (o) => o.mod, html: (o) => esc(o.mod || "–") },
        { key: "created", label: "In listino dal", num: true, val: (o) => o.created, html: (o) => o.created || DASH },
        { key: "eci", label: "ECI", num: true, val: (o) => (o.m ? o.m.eci : null), html: (o) => (o.m ? eciF(o.m.eci) : DASH) },
      ],
      rows,
      pState,
      (o) => o.m && openModel(o.m)
    );
    $("pCount").textContent = `${Math.min(total, pState.limit)} di ${total} modelli`;
    $("pMore").parentElement.hidden = total <= pState.limit;
  }

  // =====================================================================
  // ARTIFICIAL ANALYSIS
  // =====================================================================
  function renderAA() {
    const rows = D.aa || [];
    $("aaDate").textContent = D.sources?.aa?.fetched ? `Dati del ${stamp(D.sources.aa.fetched)}` : "";
    if (!rows.length) {
      $("aaBody").innerHTML = `<p class="finding">Artificial Analysis non è collegato: la sua API richiede una chiave gratuita. Quando il secret <b>AA_API_KEY</b> è impostato nel repository, l'aggiornamento del mattino aggiunge qui i suoi indici, la velocità e il prezzo.</p>`;
      return;
    }
    $("aaBody").innerHTML = `<p class="finding">Indici, velocità e prezzo misurati da <a href="https://artificialanalysis.ai/">Artificial Analysis</a> su ${rows.length} modelli.</p><h2 class="section">Tutti i modelli</h2><div class="table-wrap"><table class="data" id="tAA"><thead></thead><tbody></tbody></table></div>`;
    const num1 = (v) => (v == null ? DASH : f1.format(v));
    table(
      $("tAA"),
      [
        { key: "name", label: "Modello", cls: "id", val: (r) => r.name.toLowerCase(), html: (r) => `${esc(r.name)}<small>${esc(r.creator || "–")}</small>` },
        { key: "intel", label: "Intelligence", num: true, cls: "key top", val: (r) => r.intel, html: (r) => num1(r.intel) },
        { key: "coding", label: "Coding", num: true, val: (r) => r.coding, html: (r) => num1(r.coding) },
        { key: "math", label: "Math", num: true, val: (r) => r.math, html: (r) => num1(r.math) },
        { key: "price", label: "$/M (3:1)", num: true, cls: "key2", val: (r) => r.price, html: (r) => money(r.price) },
        { key: "tps", label: "Token/s", num: true, val: (r) => r.tps, html: (r) => (r.tps == null ? DASH : f0.format(r.tps)) },
        { key: "ttft", label: "Primo token", num: true, val: (r) => r.ttft, html: (r) => (r.ttft == null ? DASH : `${f2.format(r.ttft)} s`) },
        { key: "date", label: "Uscita", num: true, val: (r) => r.date, html: (r) => r.date || DASH },
      ],
      rows,
      { sort: "intel", dir: -1 }
    );
  }

  // =====================================================================
  // FONTI
  // =====================================================================
  function renderSources() {
    const S = D.sources || {};
    const st = (k) => {
      const s = S[k] || {};
      return s.status === "ok"
        ? `<span class="status ok">aggiornata il ${esc(stamp(s.fetched))}</span>`
        : s.status === "stale"
        ? `<span class="status stale">non aggiornata: copia del ${s.fetched ? esc(stamp(s.fetched)) : "–"}</span>`
        : `<span class="status">non collegata</span>`;
    };
    const card = (k, title, what, licence, link, extra = "") =>
      `<article class="card"><h2>${title}</h2><p>${what}</p><dl><dt>Stato</dt><dd>${st(k)}</dd><dt>Licenza</dt><dd>${licence}</dd><dt>Fonte</dt><dd><a href="${link}">${link.replace(/^https:\/\//, "")}</a></dd>${extra}</dl></article>`;
    $("sources").innerHTML =
      card("epoch", "Epoch AI", "Benchmarking Hub: l'indice ECI di ogni modello con il suo intervallo, e i risultati sui benchmark da cui è calcolato, valutati da Epoch o raccolti da classifiche esterne.", "CC BY 4.0, citando Epoch AI", "https://epoch.ai/benchmarks", `<dt>Contenuto</dt><dd class="num">${f0.format(models.length)} modelli, ${D.epoch ? D.epoch.benchmarks.length : 0} benchmark</dd>`) +
      card("openrouter", "OpenRouter", "Il listino pubblico dei modelli: prezzo per milione di token in input e in output, finestra di contesto e output massimo del fornitore principale.", "API pubblica", "https://openrouter.ai/models", `<dt>Contenuto</dt><dd class="num">${f0.format(orRows.length)} modelli${orLive ? ", letto dal vivo" : ""}</dd>`) +
      card("aa", "Artificial Analysis", "Intelligence, Coding e Math Index, velocità di output, tempo al primo token e prezzo misurati in modo indipendente. Si attiva con una chiave API gratuita.", "uso gratuito citando Artificial Analysis", "https://artificialanalysis.ai/");
  }

  load().catch((e) => {
    $("loading").textContent = `Non riesco a leggere i dati (${e.message}). Riprova tra poco.`;
  });
})();
