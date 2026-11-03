// BB84 page: scroll (Lenis into ScrollTrigger), the reticle canvas, and the five
// phases. The physics lives in protocol.js; this file only lays it out.
(() => {
  const B = window.BB84;
  const $ = (id) => document.getElementById(id);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const KET_TEX = { "|0⟩": "\\vert 0\\rangle", "|1⟩": "\\vert 1\\rangle", "|+⟩": "\\vert +\\rangle", "|−⟩": "\\vert -\\rangle" };
  const SYM = (b) => B.BASES[b].sym;
  const NAME = (b) => B.BASES[b].name;
  const cls = (b) => (b === "rect" ? "tag-r" : "tag-d");
  const FORK = '<svg viewBox="0 0 40 20" width="40" height="20" aria-hidden="true"><path d="M2 10H14L36 2M14 10L36 18" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  gsap.registerPlugin(ScrollTrigger);

  const st = { basis: "rect", bit: 0, eve: false, photons: null, measured: false, announced: false, dropped: false };
  let scrambleId = 0;

  // ---------- reticle canvas ----------
  const cv = document.querySelector(".bb84-exp-grid");
  const g = cv.getContext("2d");
  const STEP = 56;
  let W = 0, H = 0, raf = 0, rt = 0;
  function paint() {
    g.clearRect(0, 0, W, H);
    const oy = (window.scrollY * 0.15) % STEP;
    g.strokeStyle = "rgba(0,245,255,0.10)";
    g.lineWidth = 1;
    g.beginPath();
    for (let x = STEP / 2; x < W; x += STEP)
      for (let y = STEP / 2 - oy; y < H; y += STEP) {
        g.moveTo(x - 4, y); g.lineTo(x + 4, y);
        g.moveTo(x, y - 4); g.lineTo(x, y + 4);
      }
    g.stroke();
    g.fillStyle = "rgba(160,200,230,0.35)";
    for (let k = 0; k < 24; k++) g.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }
  const onResize = () => { clearTimeout(rt); rt = setTimeout(resize, 120); };
  resize();
  addEventListener("resize", onResize);
  const loop = () => { paint(); raf = requestAnimationFrame(loop); };
  if (!reduce) raf = requestAnimationFrame(loop);

  // ---------- smooth scroll ----------
  let lenis = null;
  const tick = (t) => lenis && lenis.raf(t * 1000);
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.08, smoothWheel: true, syncTouch: true, syncTouchLerp: 0.075 });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
  }
  function go(id) {
    const el = $(id);
    if (!el) return;
    if (lenis) lenis.scrollTo(el, { offset: -72 });
    else el.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  }
  const onClick = (e) => {
    const a = e.target.closest("a[href^='#fase'], [data-go]");
    if (!a) return;
    e.preventDefault();
    go(a.dataset.go || a.getAttribute("href").slice(1));
  };
  document.addEventListener("click", onClick);

  // ---------- helpers ----------
  function tex(el, s) { katex.render(s, el, { throwOnError: false }); }
  function setNav(id) { $$(".bb84-exp-nav nav a").forEach((a) => a.classList.toggle("is-on", a.dataset.nav === id)); }
  function fnv(bits) {
    let h = 2166136261;
    for (const b of bits) { h ^= b; h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function bitsToText(bits) {
    let s = "";
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      let c = 0;
      for (let k = 0; k < 8; k++) c = (c << 1) | bits[i + k];
      s += String.fromCharCode(c);
    }
    return s;
  }
  function bitsToHex(bits) {
    const out = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      let c = 0;
      for (let k = 0; k < 8; k++) c = (c << 1) | bits[i + k];
      out.push(c.toString(16).padStart(2, "0"));
    }
    return out.join(" ");
  }

  // ---------- scramble on the title ----------
  function scramble(el) {
    const final = el.dataset.scramble;
    const chars = "01+×−|⟩⟨";
    let f = 0;
    clearInterval(scrambleId);
    scrambleId = setInterval(() => {
      f++;
      const done = Math.floor(f / 2);
      el.textContent = final
        .split("")
        .map((c, i) => (i < done ? c : chars[Math.floor(Math.random() * chars.length)]))
        .join("");
      if (f >= 14) { clearInterval(scrambleId); el.textContent = final; }
    }, 60);
  }

  // ---------- GSAP: reveals, progress, nav, magnetic buttons, card glow ----------
  const ctx = gsap.context(() => {
    if (!reduce) {
      gsap.utils.toArray(".bb84-exp-reveal").forEach((el) => {
        gsap.from(el, {
          y: 28, opacity: 0, filter: "blur(10px)", duration: 1.2, ease: "power4.out",
          clearProps: "transform,opacity,filter",
          scrollTrigger: { trigger: el, start: "top 90%", once: true },
        });
      });
      gsap.fromTo(".bb84-exp-photon-hero",
        { left: "0%", opacity: 0 },
        { left: "100%", opacity: 1, duration: 2.8, ease: "none", repeat: -1, repeatDelay: 0.6 });
      scramble(document.querySelector("[data-scramble]"));
    }
    gsap.to(".bb84-exp-progress", {
      scaleX: 1, ease: "none",
      scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: true },
    });
    $$(".bb84-exp-stage").forEach((sec) =>
      ScrollTrigger.create({
        trigger: sec, start: "top 55%", end: "bottom 55%",
        onToggle: (s) => s.isActive && setNav(sec.id),
      }));
    if (!reduce && matchMedia("(hover: hover)").matches) {
      $$(".bb84-exp-magnetic").forEach((el) => {
        const x = gsap.quickTo(el, "x", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
        const y = gsap.quickTo(el, "y", { duration: 0.6, ease: "elastic.out(1, 0.4)" });
        el.addEventListener("pointermove", (e) => {
          const r = el.getBoundingClientRect();
          x((e.clientX - r.left - r.width / 2) * 0.3);
          y((e.clientY - r.top - r.height / 2) * 0.3);
        });
        el.addEventListener("pointerleave", () => { x(0); y(0); });
      });
    }
  });
  $$(".bb84-exp-card").forEach((c) =>
    c.addEventListener("pointermove", (e) => {
      const r = c.getBoundingClientRect();
      c.style.setProperty("--mx", e.clientX - r.left + "px");
      c.style.setProperty("--my", e.clientY - r.top + "px");
    }));

  // ---------- phase 1: basis and bit ----------
  const needle = $("polarizer");
  const packet1 = $("packet1");
  function packetD() {
    let d = "M-600 60";
    for (let x = -600; x <= 1400; x += 6) {
      const env = Math.exp(-((x - 300) ** 2) / (2 * 110 ** 2));
      d += ` L${x} ${(60 - 34 * env * Math.sin(x * 0.09)).toFixed(1)}`;
    }
    return d;
  }
  packet1.setAttribute("d", packetD());

  function renderState() {
    const { angle, ket, name, sym } = B.BASES[st.basis];
    const a = angle[st.bit];
    gsap.to(needle, { rotation: a, svgOrigin: "80 80", duration: reduce ? 0 : 1, ease: "elastic.out(1, 0.45)" });
    tex($("ketOut"), KET_TEX[ket[st.bit]]);
    $("angleOut").textContent = `${a}° · base ${sym}`;
    $("explain1").textContent =
      `Base ${name} (${sym}): il bit ${st.bit} diventa ${ket[st.bit]}, polarizzazione a ${a}°. ` +
      (st.basis === "rect" ? "Orizzontale e verticale sono la base rettilineare." : "Le diagonali a 45° e 135° sono la base diagonale.");
    $("fase-1").querySelector(".bb84-exp-card").style.setProperty("--glow", st.basis === "rect" ? "rgba(0,245,255,0.5)" : "rgba(255,0,127,0.5)");
  }
  $$("[data-basis]").forEach((b) => b.addEventListener("click", () => {
    st.basis = b.dataset.basis;
    $$("[data-basis]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    renderState();
  }));
  $$("[data-bit]").forEach((b) => b.addEventListener("click", () => {
    st.bit = +b.dataset.bit;
    $$("[data-bit]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    renderState();
  }));
  $("emit").addEventListener("click", () => {
    packet1.setAttribute("class", "bb84-exp-packet" + (st.basis === "diag" ? " is-magenta" : ""));
    gsap.killTweensOf(packet1);
    if (reduce) { gsap.set(packet1, { x: 0, opacity: 1 }); return; }
    gsap.fromTo(packet1, { x: -300, opacity: 1 }, { x: 700, duration: 1.8, ease: "power1.in" });
    $("explain1").textContent =
      `Fotone emesso: ${B.BASES[st.basis].ket[st.bit]} nella base ${NAME(st.basis)}. Bob non lo ha ancora misurato.`;
  });
  renderState();

  // ---------- phase 2: Eve and collapse ----------
  const eveEl = $("eve");
  const fiber2 = $("fiber2");

  function renderRow2(animate) {
    const list = $("row2");
    const p = st.photons;
    if (!p) {
      list.innerHTML = "";
      $("collapseCount").textContent = "Collassi: 0 / 0";
      return;
    }
    let intercepted = 0, collapsed = 0;
    list.innerHTML = p
      .map((x) => {
        const ic = x.interception;
        if (ic) { intercepted++; if (ic.collapsed) collapsed++; }
        const eve = ic
          ? `<span class="${cls(ic.basis)}">Eve ${SYM(ic.basis)}${ic.collapsed ? " · collassa" : " · ok"}</span>`
          : "<span>nessun intercettatore</span>";
        return `<li class="${ic && ic.collapsed ? "is-collapsed" : ""}"><span class="${cls(x.aBasis)}">Alice ${SYM(x.aBasis)}</span><b>${B.BASES[x.aBasis].ket[x.bit]}</b>${eve}</li>`;
      })
      .join("");
    $("collapseCount").textContent = `Collassi: ${collapsed} / ${intercepted}`;
    if (animate && !reduce) {
      gsap.from(list.children, { opacity: 0, y: 14, stagger: 0.08, duration: 0.6, ease: "power3.out" });
      if (collapsed) { shake(); burst(); }
    }
  }
  function shake() {
    fiber2.style.filter = "drop-shadow(-3px 0 #ff007f) drop-shadow(3px 0 #00f5ff)";
    gsap.fromTo(fiber2, { x: -6 }, { x: 0, duration: 0.5, ease: "elastic.out(1, 0.2)" });
    gsap.delayedCall(0.6, () => { fiber2.style.filter = ""; });
  }
  function burst() {
    const cx = fiber2.clientWidth / 2, cy = fiber2.clientHeight / 2;
    for (let k = 0; k < 14; k++) {
      const d = document.createElement("span");
      d.className = "bb84-exp-burst";
      fiber2.appendChild(d);
      gsap.fromTo(d,
        { left: cx, top: cy, opacity: 1, scale: 1 },
        {
          left: cx + (Math.random() - 0.5) * 260, top: cy + (Math.random() - 0.5) * 120,
          opacity: 0, scale: 0.2, duration: 0.9, ease: "power3.out", onComplete: () => d.remove(),
        });
    }
  }
  function explain2() {
    const p = st.photons;
    if (!p) {
      $("explain2").textContent = st.eve
        ? "Eve è attiva. Eve non può copiare il fotone: deve misurarlo, e misurando lo cambia. Invia i fotoni per vedere quali collassano."
        : "Canale pulito. Invia i fotoni: arrivano come sono partiti.";
      return;
    }
    const n = p.filter((x) => x.interception).length;
    const k = p.filter((x) => x.interception && x.interception.collapsed).length;
    $("explain2").textContent = st.eve
      ? `Eve ha misurato ${n} fotoni e ne ha sbagliati ${k} di base. Quelli collassati arrivano a Bob già alterati.`
      : "Nessun intercettatore: il canale è pulito.";
  }
  $("eveToggle").addEventListener("click", () => {
    st.eve = !st.eve;
    $("eveToggle").setAttribute("aria-pressed", String(st.eve));
    eveEl.classList.toggle("is-on", st.eve);
    reset();
    explain2();
  });

  // one transmission of 8 photons; phases 3 to 4 read from it
  function send() {
    const seed = (Math.random() * 1e9) | 0;
    st.photons = B.run({ n: 8, eve: st.eve ? 1 : 0, seed });
    st.measured = false;
    st.announced = false;
    st.dropped = false;
    renderRow2(true);
    renderDetect(false);
    renderSift();
    explain2();
  }
  $("send").addEventListener("click", send);

  // ---------- phase 3: Bob ----------
  function renderDetect(animate) {
    const list = $("row3");
    const p = st.photons;
    if (!st.measured || !p) {
      list.innerHTML = "";
      $("matchOut").textContent = "Corrispondenze: 0 / 0";
      return;
    }
    let same = 0;
    list.innerHTML = p
      .map((x) => {
        const match = x.aBasis === x.bBasis;
        if (match) same++;
        return `<li>
          <span class="${cls(x.bBasis)}">Bob ${SYM(x.bBasis)}</span>
          <div class="det"><span class="det-cell ${x.bBit === 0 ? "is-hit" : ""}">0</span><span class="det-cell ${x.bBit === 1 ? "is-hit" : ""}">1</span></div>
          <span class="fork">${match ? "100% · click certo" : FORK + " 50 / 50"}</span>
        </li>`;
      })
      .join("");
    $("matchOut").textContent = `Corrispondenze: ${same} / ${p.length}`;
    $("explain3").textContent = `Su ${same} fotoni la base coincide: il rivelatore dà il bit di Alice. Sugli altri ${p.length - same} Bob ottiene un risultato casuale.`;
    if (animate && !reduce) gsap.from(list.children, { opacity: 0, y: 12, stagger: 0.07, duration: 0.6 });
  }
  $("measure").addEventListener("click", () => {
    if (!st.photons) send();
    st.measured = true;
    renderDetect(true);
  });

  // ---------- phase 4: sifting ----------
  function renderSift() {
    const body = $("sift-body");
    const p = st.photons;
    if (!p) {
      body.innerHTML = "";
      $("rawKey").textContent = "";
      return;
    }
    // once dropped, the mismatched columns are gone: only the sifted key is listed
    body.innerHTML = p
      .filter((x) => !st.dropped || x.aBasis === x.bBasis)
      .map((x) => {
        const match = x.aBasis === x.bBasis;
        const bob = st.announced ? `<span class="${cls(x.bBasis)}">${SYM(x.bBasis)} ${NAME(x.bBasis)}</span>` : "in attesa";
        const state = !st.announced ? "—" : match ? '<span class="ok">tenuta</span>' : '<span class="no">scartata</span>';
        return `<tr data-i="${x.i}">
          <td data-label="#">${x.i + 1}</td>
          <td data-label="Base di Alice"><span class="${cls(x.aBasis)}">${SYM(x.aBasis)} ${NAME(x.aBasis)}</span></td>
          <td data-label="Base di Bob">${bob}</td>
          <td data-label="Stato">${state}</td>
        </tr>`;
      })
      .join("");
    const kept = p.filter((x) => x.aBasis === x.bBasis).map((x) => x.bit);
    $("rawKey").textContent = st.dropped
      ? `Chiave grezza: ${kept.length} bit · ${kept.join(" ")}`
      : st.announced
        ? "Basi annunciate. Restano da scartare le colonne diverse."
        : "";
  }
  function announce() {
    if (!st.photons || st.announced) return;
    st.announced = true;
    renderSift();
    if (!reduce) gsap.from("#sift-body tr td:nth-child(3)", { opacity: 0, x: 12, stagger: 0.05, duration: 0.5 });
  }
  function sift() {
    if (!st.photons || st.dropped) return;
    announce();
    st.dropped = true;
    const bad = $$("#sift-body tr").filter((tr) => {
      const x = st.photons[+tr.dataset.i];
      return x.aBasis !== x.bBasis;
    });
    $("rawKey").textContent = "";
    const finish = () => renderSift();
    if (reduce) return finish();
    gsap.to(bad, {
      opacity: 0, y: 34, rotation: () => gsap.utils.random(-14, 14), filter: "blur(6px)",
      stagger: 0.06, duration: 0.8, ease: "power3.in", onComplete: finish,
    });
  }
  $("announce").addEventListener("click", announce);
  $("sift").addEventListener("click", sift);

  // ---------- phase 5: QBER ----------
  const noise = $("noise");
  const eveRate = $("eveRate");

  // the bar runs from 0% to 40%; the 11% marker sits at 27.5% (see style.css)
  function setQber(q, label) {
    gsap.to("#qFill", { width: Math.min(100, (q / 0.4) * 100) + "%", duration: reduce ? 0 : 0.6, ease: "power3.out" });
    $("qOut").textContent = label;
  }
  function updateSliders() {
    $("noiseOut").textContent = noise.value + "%";
    $("eveOut").textContent = eveRate.value + "%";
    const q = noise.value / 100 + (eveRate.value / 100) * 0.25;
    setQber(q, `Stima: ${(q * 100).toFixed(1)}% (decoerenza + Eve)`);
  }
  noise.addEventListener("input", updateSliders);
  eveRate.addEventListener("input", updateSliders);
  updateSliders();

  $("verifyBtn").addEventListener("click", () => {
    const seed = (Math.random() * 1e9) | 0;
    const r = B.sift(B.run({ n: 400, eve: eveRate.value / 100, noise: noise.value / 100, seed }), seed);
    const pct = (r.qber * 100).toFixed(1);
    setQber(r.qber, `QBER misurato: ${pct}% su ${r.sampleSize} bit, ${r.errors} errori`);
    const stage = $("fase-5");
    const res = $("result");
    const hA = $("hashA"), hB = $("hashB");
    gsap.killTweensOf([hA, hB]);
    if (r.compromised) {
      stage.classList.add("is-alert");
      res.className = "bb84-exp-result is-alert";
      $("resultText").textContent =
        `Allarme: QBER ${pct}% supera l'11%. Il canale è compromesso: la chiave viene scartata e il canale si svuota.`;
      hA.textContent = hB.textContent = "chiave scartata";
      $("otpOut").textContent = "";
      return;
    }
    stage.classList.remove("is-alert");
    res.className = "bb84-exp-result is-ok";
    // Reconciliation of the few residual errors is assumed, not simulated: both
    // sides end with the same bits, so both fingerprints show Alice's.
    const h = fnv(r.keyA);
    hA.textContent = hB.textContent = `${h.slice(0, 4)} · ${h.slice(4)}`;
    if (!reduce) {
      gsap.fromTo(hA, { x: -70, opacity: 0.2 }, { x: 0, opacity: 1, duration: 1.1, ease: "expo.out" });
      gsap.fromTo(hB, { x: 70, opacity: 0.2 }, { x: 0, opacity: 1, duration: 1.1, ease: "expo.out" });
    }
    $("resultText").textContent =
      `Canale sicuro: QBER ${pct}% sotto l'11%. Le impronte coincidono e la chiave di ${r.keyA.length} bit è pronta per il One-Time Pad.`;
    const msg = "SEGRETO";
    const bytes = Array.from(msg, (c) => c.charCodeAt(0));
    const cipher = B.otp(bytes, r.keyA);
    $("otpOut").textContent = cipher
      ? `OTP: "${msg}" → ${bitsToHex(cipher)} · decifrato: "${bitsToText(cipher.map((b, i) => b ^ r.keyA[i]))}"`
      : "Chiave troppo corta per questo messaggio.";
  });

  // ---------- first paint ----------
  explain2();
  renderSift();
  if (!reduce) setNav("fase-1");

  // ---------- teardown: the page is single-shot, but leave nothing running ----------
  const teardown = () => {
    cancelAnimationFrame(raf);
    clearInterval(scrambleId);
    clearTimeout(rt);
    removeEventListener("resize", onResize);
    document.removeEventListener("click", onClick);
    gsap.ticker.remove(tick);
    if (lenis) lenis.destroy();
    ctx.revert();
    ScrollTrigger.getAll().forEach((t) => t.kill());
  };
  addEventListener("pagehide", teardown);

  function reset() {
    st.photons = null;
    st.measured = false;
    st.announced = false;
    st.dropped = false;
    renderRow2(false);
    renderDetect(false);
    renderSift();
  }
})();
