// Stelle Erranti UI: renders the engine state (game.js) as gold-framed glass
// panels, a constellation map and modal screens for battles, events and wishes.
// In a home tile (?preview) the engine's autopilot plays the run by itself.
(() => {
  const G = window.Stelle;
  const $ = (id) => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  const preview = params.has("preview");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ROMAN = ["I", "II", "III"];
  const NODE = { start: "Partenza", battle: "Battaglia", elite: "Élite", boss: "Boss", chest: "Forziere", fountain: "Fontana", event: "Evento" };
  const RARITY = { 3: ["#6fa0e8", "var(--r3)"], 4: ["#a65bfa", "var(--r4)"], 5: ["#ffd175", "var(--r5)"] };

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const use = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const elIcon = (el) => `<span class="el" style="color:${G.EL[el].color}">${use("el-" + el)}</span>`;
  const stars = (n) => `<span class="stars" aria-label="${n} stelle">${use("star").repeat(n)}</span>`;
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const meter = (f, extra = "") => `<div class="meter" ${extra}><div class="bar"><i style="width:${f * 100}%"></i></div><b class="tip" style="left:${f * 100}%"></b></div>`;
  const medal = (id) => {
    const h = G.HEROES[id];
    return `<span class="medal s${h.stars}"><b>${h.name[0]}</b>${elIcon(h.el)}</span>`;
  };

  // corner ornaments: a lanceolate diamond with two gold rules along the border
  const ORN = `<svg viewBox="0 0 26 26"><path d="M1 1 9.6 4.6 13 13 4.6 9.6Z" fill="url(#gold)"/><path d="M12.5 7H26M7 12.5V26" stroke="currentColor" stroke-width="1.4"/><circle cx="17" cy="7" r="1.6" fill="currentColor"/><circle cx="7" cy="17" r="1.6" fill="currentColor"/></svg>`;
  function decorate(el) {
    ["tl", "tr", "bl", "br"].forEach((c) => el.insertAdjacentHTML("beforeend", `<i class="orn ${c}" aria-hidden="true">${ORN}</i>`));
  }
  document.querySelectorAll(".panel.frame").forEach(decorate);

  // ---------- theme ----------
  const MOON = "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z";
  const SUN = "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1";
  function setTheme(t) {
    document.documentElement.dataset.theme = t;
    $("themeIcon").setAttribute("d", t === "night" ? SUN : MOON);
    try { localStorage.setItem("stelle-theme", t); } catch (e) {}
  }
  let saved = null;
  try { saved = localStorage.getItem("stelle-theme"); } catch (e) {}
  setTheme(params.get("tema") === "pergamena" ? "parchment" : preview ? "night" : saved || "night");
  $("theme").onclick = () => setTheme(document.documentElement.dataset.theme === "night" ? "parchment" : "night");

  // ---------- run ----------
  let s, sky;
  function newRun() {
    s = G.create(+params.get("seed") || (Math.random() * 1e9) | 0);
    sky = null;
    render();
  }

  // ---------- map ----------
  // on narrow screens the map runs top to bottom instead of left to right
  const vertical = () => innerWidth < 720;
  const P = (n) => (vertical() ? { x: n.y, y: n.x } : n);

  function skyFor() {
    // background stars and rings, fixed for each region's map
    const v = vertical(), w = v ? 560 : 1000, h = v ? 1000 : 560, cx = w / 2, cy = h / 2;
    if (sky && sky.map === s.map && sky.v === v) return sky.svg;
    let r = s.seed + s.region * 977;
    const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    let svg = `<g class="rings"><circle cx="${cx}" cy="${cy}" r="120"/><circle cx="${cx}" cy="${cy}" r="210"/><circle cx="${cx}" cy="${cy}" r="320" stroke-dasharray="2 8"/><circle cx="${cx}" cy="${cy}" r="440"/></g>`;
    for (let i = 0; i < 90; i++) {
      const sz = rand() * 1.6 + 0.4;
      svg += `<circle class="bgstar" cx="${(rand() * w).toFixed(1)}" cy="${(rand() * h).toFixed(1)}" r="${sz.toFixed(2)}" opacity="${(0.15 + rand() * 0.5).toFixed(2)}"/>`;
    }
    sky = { map: s.map, v, svg };
    return svg;
  }

  function renderMap() {
    const open = G.options(s);
    const here = G.here(s);
    const walked = new Set(); // edges along the path taken: done nodes linked to done nodes
    s.map.forEach((n) => n.next.forEach((m) => s.map[m].done && n.done && walked.add(n.id + "-" + m)));
    let edges = "", nodes = "";
    s.map.forEach((n) =>
      n.next.forEach((m) => {
        const t = P(s.map[m]), a = P(n);
        const cls = walked.has(n.id + "-" + m) ? "walked" : n === here && open.includes(m) ? "open" : "";
        edges += `<line class="edge ${cls}" x1="${a.x}" y1="${a.y}" x2="${t.x}" y2="${t.y}"/>`;
      })
    );
    s.map.forEach((node) => {
      const n = { ...node, ...P(node) };
      const isOpen = open.includes(n.id), r = n.type === "boss" ? 30 : 22;
      const cls = ["node", n.type, n.done ? "done" : "", isOpen ? "open" : "", node === here ? "here" : ""].join(" ");
      const attrs = isOpen ? `tabindex="0" role="button" aria-label="Vai a: ${NODE[n.type]}" data-id="${n.id}"` : `aria-hidden="true"`;
      nodes += `<g class="${cls}" ${attrs}>
        <circle class="ring" cx="${n.x}" cy="${n.y}" r="${r + 5}"/>
        <circle class="disc" cx="${n.x}" cy="${n.y}" r="${r}"/>
        <svg class="glyph" x="${n.x - r * 0.55}" y="${n.y - r * 0.55}" width="${r * 1.1}" height="${r * 1.1}"><use href="#n-${n.type}"/></svg>
        ${isOpen || n.type === "boss" ? `<text x="${n.x}" y="${n.y + r + 22}">${NODE[n.type]}</text>` : ""}
      </g>`;
    });
    const hp = P(here);
    const you = `<svg class="you" x="${hp.x - 17}" y="${hp.y - 52}" width="34" height="34"><use href="#star"/></svg>`;
    $("map").setAttribute("viewBox", vertical() ? "0 0 560 1000" : "0 0 1000 560");
    $("map").innerHTML = skyFor() + edges + nodes + you;

    const R = G.REGIONS[s.region];
    $("mapTitle").textContent = R.name;
    $("regionName").textContent = R.name;
    $("regionNum").textContent = "Regione " + ROMAN[s.region];
    const step = s.region * 6 + here.layer + 1, f = step / 18;
    $("journeyBar").style.width = f * 100 + "%";
    $("journeyTip").style.left = f * 100 + "%";
    $("journeyTxt").textContent = `Tappa ${step} / 18`;
  }

  $("map").addEventListener("click", (e) => {
    const g = e.target.closest("[data-id]");
    if (g) go(+g.dataset.id);
  });
  $("map").addEventListener("keydown", (e) => {
    const g = e.target.closest("[data-id]");
    if (g && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      go(+g.dataset.id);
    }
  });
  function go(id) {
    if (G.travel(s, id)) render();
  }

  // ---------- side panels ----------
  function renderRoster() {
    const fighting = s.screen && s.screen.type === "battle";
    $("roster").innerHTML = Object.keys(s.roster)
      .map((id) => {
        const h = G.HEROES[id], r = s.roster[id], st = G.stat(s, id), inP = s.party.includes(id);
        return `<button class="hero ${inP ? "in" : "out"} ${r.hp <= 0 ? "ko" : ""}" data-id="${id}" ${fighting ? "disabled" : ""} aria-pressed="${inP}">
          ${medal(id)}
          <span class="h-top"><b>${h.name}</b><small>${stars(h.stars)} · Liv. ${r.lvl}${r.cons ? ` · C${r.cons}` : ""}</small></span>
          <span class="h-bars">${meter(Math.max(0, r.hp) / st.maxhp)}<span>${num(Math.max(0, r.hp))} / ${num(st.maxhp)}</span></span>
        </button>`;
      })
      .join("");
    $("partyCount").textContent = `${s.party.length} / 4`;
  }
  $("roster").addEventListener("click", (e) => {
    const b = e.target.closest(".hero");
    if (!b) return;
    G.toggle(s, b.dataset.id);
    renderRoster();
  });

  function renderLog() {
    $("log").innerHTML = s.log.map((l) => `<li class="${l.tone || ""}">${esc(l.text)}</li>`).join("");
  }

  // ---------- modal screens ----------
  const crest = `<div class="crest" aria-hidden="true"><i></i>${use("star")}<i></i></div>`;
  function openModal(html, cls = "") {
    const m = $("modal");
    m.className = "modal frame " + cls;
    m.innerHTML = html;
    decorate(m);
    $("overlay").hidden = false;
    if (!preview) {
      const f = m.querySelector("button:not(:disabled)");
      if (f) f.focus({ preventScroll: true });
    }
  }
  const closeModal = () => ($("overlay").hidden = true);

  function renderScreen() {
    const sc = s.screen;
    if (s.over) return renderOver();
    if (!sc) return closeModal();
    if (sc.type === "battle") return renderBattle(sc, true);
    if (sc.type === "event") {
      const e = sc.event;
      return openModal(
        `${crest}<p class="eyebrow">Evento</p><h2 id="modalTitle">${esc(e.title)}</h2><p class="body">${esc(e.text)}</p>
        <div class="choices">${e.options
          .map((o, i) => `<button class="btn ${i ? "ghost" : "primary"}" data-choice="${i}" ${o.ok && !o.ok(s) ? "disabled" : ""}><span>${esc(o.label)}</span><small>${esc(o.sub)}</small></button>`)
          .join("")}</div>`
      );
    }
    if (sc.type === "result")
      return openModal(
        `${crest}<p class="eyebrow">${sc.boss ? "Regione liberata" : "Esito"}</p><h2 id="modalTitle">${esc(sc.title)}</h2><p class="body">${esc(sc.text)}</p>
        ${sc.gems ? `<div class="reward"><span class="gem">${use("star")}</span>+${sc.gems}</div>` : ""}
        <div class="actions"><button class="btn primary" data-go>${use("star")}<span>${sc.boss ? (s.region === 2 ? "Verso le stelle" : "Prossima regione") : "Continua"}</span></button></div>`
      );
    if (sc.type === "wish") return renderWish(sc.out);
  }

  function renderOver() {
    const won = s.over === "vittoria";
    openModal(
      `${crest}<p class="eyebrow">${won ? "Fine del viaggio" : "Viaggio interrotto"}</p>
      <h2 id="modalTitle">${won ? "La regina dell'inverno è caduta" : "La compagnia si è arresa"}</h2>
      <p class="body">${won ? "Le tre regioni sono libere e il cielo torna a brillare. Il tuo nome entra nelle cronache dei viandanti." : `Il viaggio si ferma nei ${G.REGIONS[s.region].name}. Le stelle aspettano un altro tentativo.`}</p>
      <div class="tags" style="margin-top:18px">
        <span class="tag">${use("n-battle")}${s.stats.battles} battaglie vinte</span>
        <span class="tag">${use("el-anemo")}${s.stats.reactions} reazioni</span>
        <span class="tag">${use("n-elite")}colpo migliore ${num(s.stats.best)}</span>
        <span class="tag">${use("star")}${s.stats.wishes} desideri</span>
      </div>
      <div class="actions"><button class="btn primary" data-new>${use("star")}<span>Nuovo viaggio</span></button></div>`
    );
  }

  function renderWish(o) {
    const [rc, rb] = RARITY[o.stars];
    const h = o.id && G.HEROES[o.id];
    const card = h
      ? `<div class="card" style="--rb:${rb}">${medal(o.id).replace("medal", "medal big")}<h3>${h.name}</h3><small>${h.title} · ${G.EL[h.el].name}</small>${stars(o.stars)}</div>`
      : `<div class="card" style="--rb:${rb}"><span class="medal">${use("n-elite", "item")}</span><h3>${esc(o.item)}</h3><small>Arma</small>${stars(3)}</div>`;
    const text = h
      ? o.fresh ? `${h.name} si unisce ai tuoi viandanti!` : o.dupe ? `${h.name} risveglia una costellazione: +10% di attacco.` : `${h.name} è già al massimo: ricevi 40 gemme.`
      : `+6 di attacco per ${G.HEROES[o.to].name}.`;
    openModal(
      `<div class="wish-fx" aria-hidden="true"><div class="rays" style="--rc:${rc}"></div><div class="meteor" style="--rc:${rc}"></div></div>
      <p class="eyebrow" style="position:relative">Desiderio</p>
      <div style="position:relative;--rc:${rc}">${card}<div class="wish-text"><h2 id="modalTitle">${o.stars === 5 ? "Leggendario!" : o.stars === 4 ? "Epico!" : "Una nuova arma"}</h2><p>${esc(text)}</p>
      <p class="pity">5★ garantito entro ${G.PITY - s.pity} desideri</p></div></div>
      <div class="actions" style="position:relative"><button class="btn primary" data-wish ${s.gems < G.WISH ? "disabled" : ""}>${use("star")}<span>Ancora</span><small>${G.WISH}</small></button><button class="btn ghost" data-go><span>Chiudi</span></button></div>`,
      "wish"
    );
  }

  function renderBattle(b, live) {
    const f = b.foe, R = G.REGIONS[s.region], a = b.active, h = G.HEROES[a], r = s.roster[a];
    const kind = { battle: "Battaglia", elite: "Élite", boss: "Boss" }[b.kind];
    const sk = live && G.preview(s, a, "skill"), bu = live && G.preview(s, a, "burst"), at = live && G.preview(s, a, "attack");
    const tags = [];
    tags.push(f.aura ? `<span class="tag">${elIcon(f.aura)}Aura: ${G.EL[f.aura].name}</span>` : `<span class="tag">Nessuna aura</span>`);
    if (f.frozen) tags.push(`<span class="tag" style="color:var(--cryo)">${use("el-cryo")}Congelato</span>`);
    else if (f.intent === "charge") tags.push(`<span class="tag warn">${use("n-elite")}Sta caricando un colpo potente</span>`);
    else if (f.intent === "sweep") tags.push(`<span class="tag warn">${use("n-boss")}Prepara un attacco su tutti</span>`);
    else tags.push(`<span class="tag">${use("n-battle")}Colpo da ~${num(f.atk)}</span>`);
    if (f.vuln) tags.push(`<span class="tag" style="color:var(--electro)">${use("el-electro")}Difese rotte</span>`);
    if (f.burn) tags.push(`<span class="tag" style="color:var(--pyro)">${use("el-pyro")}In fiamme</span>`);
    if (b.shield) tags.push(`<span class="tag" style="color:var(--geo)">${use("el-geo")}Scudo ${num(b.shield)}</span>`);

    const chips = s.party
      .map((id) => {
        const rr = s.roster[id], st = G.stat(s, id), hh = G.HEROES[id];
        const re = id !== a && rr.hp > 0 && hh.el !== f.el && G.reaction(f.aura, hh.el);
        const pips = Array.from({ length: 5 }, (_, i) => `<i class="${rr.energy >= (i + 1) * 20 ? "on" : ""}"></i>`).join("");
        return `<button class="chip ${id === a ? "on" : ""}" data-switch="${id}" ${rr.hp <= 0 || !live ? "disabled" : ""} aria-pressed="${id === a}" aria-label="${hh.name}, ${num(Math.max(0, rr.hp))} PV">
          ${re ? `<span class="hint-re">${re.name}</span>` : ""}${b.shield && id === a ? `<span class="shield"></span>` : ""}
          ${medal(id)}<b class="n">${hh.name}</b>${meter(Math.max(0, rr.hp) / st.maxhp)}<span class="pips">${pips}</span></button>`;
      })
      .join("");

    const dis = (p) => (live && p ? "" : "disabled");
    openModal(
      `<div class="battle-top"><span>${R.name} · ${kind}</span><span>Turno ${b.turn}</span></div>
      <div class="foe ${f.frozen ? "frozen" : ""}" id="foe" style="--c:${G.EL[f.el].color}">
        <div class="foe-orb"><span class="halo"></span><span class="rings"></span><span class="core">${use("el-" + f.el)}</span></div>
        <h3 id="modalTitle">${esc(f.name)}</h3>
        <div class="foe-hp">${meter(f.hp / f.maxhp)}<span>${num(f.hp)} / ${num(f.maxhp)}</span></div>
        <div class="tags">${tags.join("")}</div>
      </div>
      <div class="banner" id="banner"></div>
      <div class="team" style="--n:${s.party.length}">${chips}</div>
      <div class="moves">
        <button class="btn ghost" data-act="attack" ${dis(at)}><span class="lbl">Attacco<small>~${num(at ? at.dmg : 0)} danni</small></span></button>
        <button class="btn primary" data-act="skill" ${dis(sk)}>${use("el-" + h.el)}<span class="lbl">${esc(h.skill)}<small>${sk ? `~${num(sk.dmg)}${sk.re ? " · " + sk.re.name : ""}` : `ricarica ${r.cd}`}</small></span></button>
        <button class="burst ${bu ? "ready" : ""}" data-act="burst" style="--c:${G.EL[h.el].color};--e:${r.energy}" ${dis(bu)} aria-label="${esc(h.burst)}: energia ${r.energy}%">${use("el-" + h.el)}<span>${bu ? esc(h.burst) : r.energy + "%"}</span></button>
      </div>
      <p class="blog" aria-live="polite">${esc(b.last || `${h.name} è in prima linea. Applica un elemento, poi cambia viandante per scatenare una reazione.`)}</p>`,
      "wide battle"
    );
  }

  // floating numbers and the reaction banner for the last exchange
  function effects(b) {
    const m = $("modal");
    let delay = 0;
    b.fx.forEach((x) => {
      const host = x.to === "foe" ? m.querySelector("#foe") : m.querySelector(`[data-switch="${x.to}"]`);
      if (!host) return;
      const color = x.el ? G.EL[x.el].color : "#fff";
      const span = document.createElement("span");
      span.className = "float";
      span.style.color = color;
      span.style.animationDelay = delay + "ms";
      span.style.top = x.to === "foe" ? "35%" : "10%";
      span.innerHTML = (x.dmg ? num(x.dmg) : x.shield ? "Parato" : "0") + (x.re ? `<small>${esc(x.re)}</small>` : "");
      host.appendChild(span);
      if (x.to === "foe") host.classList.add("hit");
      else host.classList.add("hurt");
      delay += 220;
    });
    const re = b.fx.find((x) => x.re && x.re !== "Bruciatura");
    if (re) {
      const ban = m.querySelector("#banner");
      ban.textContent = re.re;
      ban.style.color = G.EL[re.el].color;
      ban.classList.add("show");
    }
  }

  // run an engine call that may resolve a battle; show its blows first
  function play(fn) {
    const before = s.screen;
    fn();
    if (before && before.type === "battle" && before.fx.length) {
      if (s.screen === before && !s.over) {
        render();
        effects(before);
      } else {
        renderBattle(before, false);
        effects(before);
        lock = true;
        setTimeout(() => ((lock = false), render()), reduced ? 300 : 1100);
        renderSide();
      }
    } else render();
  }
  let lock = false;

  $("modal").addEventListener("click", (e) => {
    if (lock) return;
    const t = e.target.closest("button");
    if (!t || t.disabled) return;
    if (t.dataset.act) play(() => G.act(s, t.dataset.act));
    else if (t.dataset.switch) {
      G.switchTo(s, t.dataset.switch);
      render();
    } else if (t.dataset.choice) {
      G.choose(s, +t.dataset.choice);
      render();
    } else if ("go" in t.dataset) {
      G.proceed(s);
      render();
    } else if ("wish" in t.dataset) {
      G.wish(s);
      render();
    } else if ("new" in t.dataset) newRun();
  });

  $("wishBtn").onclick = () => {
    if (G.wish(s)) render();
  };

  function renderSide() {
    $("gems").textContent = num(s.gems);
    $("wishBtn").disabled = s.gems < G.WISH || !!s.screen || !!s.over;
    renderRoster();
    renderLog();
  }
  function render() {
    renderMap();
    renderSide();
    renderScreen();
  }

  // ---------- golden dust ----------
  const cv = $("dust"), ctx = cv.getContext("2d");
  let motes = [], W = 0, H = 0;
  function sizeDust() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    motes = Array.from({ length: Math.round(Math.min(120, (W * H) / 14000)) }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.4,
      v: Math.random() * 0.25 + 0.05, p: Math.random() * Math.PI * 2, star: Math.random() < 0.08,
    }));
    if (reduced) drawDust(0);
  }
  function drawDust(t) {
    ctx.clearRect(0, 0, W, H);
    const night = document.documentElement.dataset.theme === "night";
    for (const m of motes) {
      if (!reduced) {
        m.y -= m.v;
        m.x += Math.sin(t / 2000 + m.p) * 0.15;
        if (m.y < -10) (m.y = H + 10), (m.x = Math.random() * W);
      }
      const a = (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 700 + m.p * 3))) * (night ? 0.8 : 0.55);
      ctx.fillStyle = night ? `rgba(255,214,140,${a})` : `rgba(190,140,60,${a})`;
      if (m.star) {
        // a tiny four-pointed star
        const s2 = m.r * 4;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - s2);
        ctx.quadraticCurveTo(m.x, m.y, m.x + s2, m.y);
        ctx.quadraticCurveTo(m.x, m.y, m.x, m.y + s2);
        ctx.quadraticCurveTo(m.x, m.y, m.x - s2, m.y);
        ctx.quadraticCurveTo(m.x, m.y, m.x, m.y - s2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // one loop: dust, plus the autopilot in the tile preview
  let last = 0;
  function loop(t) {
    if (!reduced) drawDust(t);
    if (preview && !lock && t - last > 900) {
      last = t;
      if (s.over) newRun();
      else play(() => G.auto(s));
    }
    requestAnimationFrame(loop);
  }

  sizeDust();
  let wasVertical = vertical();
  window.addEventListener("resize", () => {
    sizeDust();
    if (vertical() !== wasVertical) (wasVertical = vertical()), renderMap();
  });
  newRun();
  requestAnimationFrame(loop);
})();
