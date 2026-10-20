// Vault UI: renders the engine state (game.js) into the bento and drives the
// chart, the monthly plan, toggles and autopilot. In a home tile (?preview)
// the autopilot plays on its own and picks every choice at random.
(() => {
  const V = window.Vault;
  const $ = (id) => document.getElementById(id);
  const preview = new URLSearchParams(location.search).has("preview");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const NAMES = { save: "Conto deposito", index: "ETF globale", crypto: "Crypto" };
  const COLORS = { save: "#3a4fff", index: "#d946ef", crypto: "#ff6b35" };
  const REGIME = { calm: "MERCATO CALMO", bull: "MERCATO TORO", bear: "MERCATO ORSO" };

  const group = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const eur = (n, sign) => (n < -0.5 ? "−" : sign && n > 0.5 ? "+" : "") + "€" + group(n);
  const pct = (r) => (r >= 0 ? "+" : "−") + Math.abs(r * 100).toFixed(1).replace(".", ",") + "%";
  const pad = (n) => String(n).padStart(2, "0");

  const plan = { save: 20, index: 50, crypto: 10 };
  const opt = { emergency: true, frugal: false, auto: preview };
  let s;

  function newGame() {
    const seed = +new URLSearchParams(location.search).get("seed") || (Math.random() * 0xffff) | 0;
    s = V.create(seed);
    $("seed").textContent = "SEED 0x" + seed.toString(16).toUpperCase().padStart(4, "0");
    render(false);
  }

  // ---------- chart: one gradient bar per month, with a blurred glow copy ----------
  const cv = $("chart");
  const ctx = cv.getContext("2d");
  let grow = 1; // 0..1 height of the newest bar while it animates in

  // colour at f (0..1) along cobalt, violet, magenta, orange, peach
  const RAMP = [[58, 79, 255], [123, 44, 191], [217, 70, 239], [255, 107, 53], [255, 160, 122]];
  function hue(f) {
    const x = Math.min(0.999, Math.max(0, f)) * (RAMP.length - 1), i = Math.floor(x), k = x - i;
    return "rgb(" + RAMP[i].map((c, j) => Math.round(c + (RAMP[i + 1][j] - c) * k)).join(",") + ")";
  }

  function sizeChart() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(cv.clientWidth * dpr);
    cv.height = Math.round(cv.clientHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }

  function drawChart() {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    const H = s.history;
    const top = Math.max(V.GOAL * 1.15, ...H.map((p) => p.net));
    const low = Math.min(0, ...H.map((p) => p.net));
    const padL = 0, padB = 22, padT = 8;
    const y = (v) => padT + (h - padB - padT) * (1 - (v - low) / (top - low));
    const n = V.MONTHS + 1, slot = (w - padL) / n, bw = Math.max(2, slot * 0.62);

    // gridlines and month labels
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#5c6273";
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let v = 0; v <= top; v += 20000) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y(v)) + 0.5);
      ctx.lineTo(w, Math.round(y(v)) + 0.5);
      ctx.stroke();
      if (v) ctx.fillText("€" + v / 1000 + "K", 4, y(v) - 5);
    }
    [0, 12, 24, 36].forEach((m) => {
      ctx.textAlign = m === 36 ? "right" : m ? "center" : "left";
      ctx.fillText("M" + pad(m), m === 36 ? w : padL + slot * m + (m ? slot / 2 : 0), h - 6);
    });
    ctx.textAlign = "left";

    // future months: faint stubs
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = H.length; i < n; i++) ctx.fillRect(padL + slot * i + (slot - bw) / 2, y(0) - 3, bw, 3);

    const bars = () =>
      H.forEach((p, i) => {
        const v = i === H.length - 1 ? H[Math.max(0, i - 1)].net + (p.net - H[Math.max(0, i - 1)].net) * grow : p.net;
        const y0 = y(0), y1 = y(v);
        // each bar fades up from its base into its month's hue along the iridescent ramp
        const grad = ctx.createLinearGradient(0, y0, 0, y1);
        grad.addColorStop(0, "rgba(58,79,255,0.25)");
        grad.addColorStop(1, v < 0 ? "#ff6b35" : hue(i / V.MONTHS));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(padL + slot * i + (slot - bw) / 2, Math.min(y0, y1), bw, Math.max(1, Math.abs(y1 - y0)), Math.min(4, bw / 2));
        ctx.fill();
      });
    ctx.save();
    ctx.filter = "blur(10px)";
    ctx.globalAlpha = 0.55;
    bars();
    ctx.restore();
    bars();

    // goal line
    ctx.strokeStyle = "#ffa07a";
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(y(V.GOAL)) + 0.5);
    ctx.lineTo(w, Math.round(y(V.GOAL)) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffa07a";
    ctx.textAlign = "right";
    ctx.fillText("OBIETTIVO €50K", w - 2, y(V.GOAL) - 6);
    ctx.textAlign = "left";
  }

  function animateChart() {
    if (reduced || preview) return drawChart();
    const t0 = performance.now();
    grow = 0;
    const tick = (t) => {
      grow = Math.max(0, Math.min(1, (t - t0) / 450));
      grow = 1 - Math.pow(1 - grow, 3);
      drawChart();
      if (grow < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---------- render ----------
  function render(advanced) {
    const net = V.net(s);
    const prev = s.history.length > 1 ? s.history[s.history.length - 2].net : net;
    $("nw").textContent = eur(net);
    $("dockNw").textContent = eur(net);
    const d = $("nwDelta");
    d.textContent = s.month ? `${eur(net - prev, true)} QUESTO MESE` : "PRONTO A PARTIRE";
    d.className = "delta micro " + (s.month ? (net >= prev ? "up" : "down") : "");
    const g = Math.max(0, Math.min(1, net / V.GOAL));
    $("goalPct").textContent = Math.round(g * 100) + "%";
    $("goalBar").style.width = g * 100 + "%";
    $("month").textContent = `MESE ${pad(s.month)} / ${V.MONTHS}`;
    $("dockMonth").textContent = `MESE ${pad(s.month)}`;

    const pill = $("regime");
    pill.className = "pill " + s.regime;
    pill.lastElementChild.textContent = REGIME[s.regime];

    renderEvent(advanced);
    renderPlan();
    renderMetrics();
    renderRows();
    renderLog();
    const blocked = !!s.over || !!(s.event && s.event.options);
    $("next").disabled = $("dockNext").disabled = blocked;
    advanced ? animateChart() : drawChart();
    if (s.over) finish();
  }

  function renderEvent(advanced) {
    const e = s.event || {
      tag: "TUTTO TRANQUILLO",
      title: "Un mese qualunque",
      text: "Stipendio accreditato, bollette pagate, nessuna sorpresa. Il piano lavora per te.",
    };
    $("evNum").textContent = `M${pad(s.month)} /`;
    $("evTag").textContent = e.tag;
    $("evTitle").textContent = e.title;
    $("evText").textContent = e.text;
    const v = $("evV");
    v.textContent = e.v ? eur(e.v, true) + (e.tag === "COSTI FISSI" ? "/mese" : "") : "";
    v.className = "ev-v " + (e.v > 0 ? "up" : e.v < 0 ? "down" : "");
    const box = $("choices");
    box.replaceChildren(
      ...(e.options || []).map((o, i) => {
        const b = document.createElement("button");
        b.innerHTML = `<b></b><span class="micro"></span>`;
        b.firstChild.textContent = o.label;
        b.lastChild.textContent = o.sub;
        b.onclick = () => {
          V.choose(s, i);
          render(false);
        };
        return b;
      })
    );
    if (advanced && s.event && !reduced) {
      const ev = $("event");
      ev.classList.remove("flash");
      void ev.offsetWidth;
      ev.classList.add("flash");
    }
  }

  function renderPlan() {
    let used = 0;
    document.querySelectorAll(".slider").forEach((l) => {
      const k = l.dataset.k, input = l.querySelector("input");
      input.value = plan[k];
      input.style.setProperty("--v", plan[k] + "%");
      l.querySelector("output").textContent = plan[k] + "%";
      document.querySelector(".s-" + k).style.flexGrow = plan[k];
      used += plan[k];
    });
    document.querySelector(".s-cash").style.flexGrow = 100 - used;
    $("cashPct").textContent = 100 - used + "%";
    const spend = Math.round(s.expenses * (opt.frugal ? 0.85 : 1));
    $("free").textContent = `${eur(s.salary - spend)} / MESE`;
    $("fIn").textContent = "+" + eur(s.salary);
    $("fOut").textContent = eur(-spend);
    $("fDebt").textContent = eur(-s.debt);
    $("fDebt").className = s.debt ? "down" : "";
  }

  function renderMetrics() {
    const spend = s.expenses * (opt.frugal ? 0.85 : 1);
    $("runway").textContent = ((s.cash + s.save) / spend).toFixed(1).replace(".", ",");
    const total = s.save + s.index + s.crypto + s.cash || 1;
    const risk = (s.index * 0.12 + s.crypto * 0.6) / total; // rough yearly volatility
    const lvl = risk < 0.04 ? 1 : risk < 0.08 ? 2 : risk < 0.14 ? 3 : risk < 0.25 ? 4 : 5;
    $("risk").textContent = ["", "MINIMO", "BASSO", "MEDIO", "ALTO", "ESTREMO"][lvl];
    const meter = $("riskMeter");
    meter.className = "meter " + (lvl >= 4 ? "high" : lvl === 3 ? "mid" : "");
    [...meter.children].forEach((i, n) => i.classList.toggle("on", n < lvl));
    const gains = $("gains");
    gains.textContent = eur(s.gains, true);
    gains.className = s.gains > 0.5 ? "up" : s.gains < -0.5 ? "down" : "";
    $("mood").textContent = Math.round(s.mood) + "%";
    $("moodBar").style.width = s.mood + "%";
  }

  function renderRows() {
    const row = (sw, name, sub, val, chg, k) =>
      `<li><i class="sw" style="background:${sw}"></i><span><b>${name}</b><small class="micro">${sub}</small></span>` +
      `<span class="val">${val}</span><span class="chg ${chg && (chg[0] === "+" ? "up" : "down")}">${chg || "—"}</span>` +
      `<button class="sell ${k ? "" : "blank"}" data-k="${k || ""}" ${k && s[k] > 1 && !s.over ? "" : "disabled"} aria-label="Vendi un quarto di ${name}">VENDI 25%</button></li>`;
    $("rows").innerHTML =
      row("repeating-linear-gradient(135deg,#cfd3dc 0 2px,transparent 2px 4px)", "Liquidità", "CONTO CORRENTE", eur(s.cash)) +
      V.ASSETS.map((k) =>
        row(COLORS[k], NAMES[k], { save: "3,6% ANNUO", index: "MSCI WORLD", crypto: "BTC · ETH" }[k], eur(s[k]), s.month && s[k] > 1 ? pct(s.last[k]) : "", k)
      ).join("") +
      (s.debt ? row("#ff6b35", "Carta revolving", "DEBITO · 24% ANNUO", eur(-s.debt)) : "");
  }

  function renderLog() {
    $("log").innerHTML = s.log
      .map(
        (l) =>
          `<li><span>M${pad(l.m)}</span><span></span><span class="${l.v > 0 ? "up" : l.v < 0 ? "down" : "dim"}">${l.v ? eur(l.v, true) : "·"}</span></li>`
      )
      .join("");
    // texts go in with textContent: event titles are trusted, but keep it clean
    [...$("log").children].forEach((li, i) => (li.children[1].textContent = s.log[i].text));
  }

  function finish() {
    const { pts, grade } = V.score(s);
    if (preview) return setTimeout(newGame, 2500);
    const broke = s.over === "bancarotta";
    $("endTag").textContent = broke ? `BANCAROTTA · MESE ${pad(s.month)}` : "RESOCONTO · 36 MESI";
    $("grade").textContent = grade;
    $("endTitle").textContent = broke
      ? "Il debito ti ha travolto"
      : V.net(s) >= V.GOAL
        ? "Obiettivo raggiunto"
        : { S: "Gestione impeccabile", A: "Ottima gestione", B: "Buona gestione", C: "Si poteva fare meglio", D: "Anni difficili" }[grade];
    const stats = [
      ["Patrimonio netto", eur(V.net(s))],
      ["Benessere", Math.round(s.mood) + "%"],
      ["Guadagno dai mercati", eur(s.gains, true)],
      ["Interessi pagati", eur(s.interest)],
      ["Punteggio", group(pts)],
    ];
    $("endStats").innerHTML = stats.map(([a, b]) => `<dt>${a}</dt><dd>${b}</dd>`).join("");
    if (!$("end").open) $("end").showModal();
  }

  // ---------- input ----------
  function next() {
    if (V.step(s, plan, opt)) render(true);
  }
  $("next").onclick = next;
  $("dockNext").onclick = next;
  $("again").onclick = () => {
    $("end").close();
    newGame();
  };

  document.querySelectorAll(".slider").forEach((l) => {
    const k = l.dataset.k;
    l.querySelector("input").addEventListener("input", (e) => {
      const others = V.ASSETS.filter((o) => o !== k).reduce((t, o) => t + plan[o], 0);
      plan[k] = Math.min(+e.target.value, 100 - others);
      renderPlan();
    });
  });

  $("rows").addEventListener("click", (e) => {
    const b = e.target.closest(".sell");
    if (!b || !b.dataset.k) return;
    V.sell(s, b.dataset.k, 0.25);
    render(false);
  });

  document.querySelectorAll(".switch").forEach((b) => {
    const k = b.dataset.opt;
    b.setAttribute("aria-checked", opt[k]);
    b.onclick = () => {
      opt[k] = !opt[k];
      b.setAttribute("aria-checked", opt[k]);
      renderPlan();
      renderMetrics();
    };
  });

  // autopilot runs on requestAnimationFrame so it pauses with an off-screen tile
  let last = 0;
  function loop(t) {
    const every = preview ? 650 : 1000;
    if (opt.auto && !s.over && t - last > every) {
      last = t;
      if (s.event && s.event.options) {
        if (preview) {
          V.choose(s, Math.random() < 0.6 ? 0 : 1);
          render(false);
        }
      } else next();
    }
    requestAnimationFrame(loop);
  }

  // radial rays in the hero
  const rays = document.querySelector(".rays");
  rays.innerHTML =
    `<defs><radialGradient id="rf" gradientUnits="userSpaceOnUse" cx="400" cy="0" r="560"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>` +
    Array.from({ length: 28 }, (_, i) => {
      const a = Math.PI / 2 + (i / 27) * (Math.PI / 2);
      return `<line x1="400" y1="0" x2="${400 + Math.cos(a) * 560}" y2="${Math.sin(a) * 560}" stroke="url(#rf)" stroke-width="${i % 4 ? 0.6 : 1.2}"/>`;
    }).join("");

  newGame();
  sizeChart();
  window.addEventListener("resize", sizeChart);
  if (document.fonts) document.fonts.ready.then(drawChart);
  requestAnimationFrame(loop);
})();
