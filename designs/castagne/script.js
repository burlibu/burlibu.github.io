// Castagne Bacci: the season read from today's date, the crate builder (the
// label fills in as you choose), the price list, the flour booking and the
// entrances. Orders go out as an email: there is no checkout behind the page.
(() => {
  const $ = (id) => document.getElementById(id);
  const preview = new URLSearchParams(location.search).has("preview");
  const MAIL = "ordini@castagnebacci.it";

  // ---------- the season ----------
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const Y = today.getFullYear();
  const day = (m, d, y = Y) => new Date(y, m - 1, d);
  const DAY = 864e5;
  const days = (a, b) => Math.round((b - a) / DAY);
  const plus = (d, n) => new Date(d.getTime() + n * DAY);
  const fmt = (d, o = { day: "numeric", month: "long" }) => d.toLocaleDateString("it-IT", o);
  const doy = (d) => days(new Date(d.getFullYear(), 0, 0), d);

  const HARVEST = [day(10, 5), day(11, 14)]; // 41 days
  const METATO = [day(11, 15), day(12, 24)]; // 40 days
  const MILL = day(1, 15);
  const inRange = (d, [a, b]) => d >= a && d <= b;
  const harvesting = inRange(today, HARVEST);

  function seasonLine() {
    const when = `Oggi, ${fmt(today, { weekday: "long", day: "numeric", month: "long" })}`;
    if (harvesting) return `${when}: <b>raccolta in corso, giorno ${days(HARVEST[0], today) + 1} di 41.</b> La cassetta di domattina parte con i marroni raccolti all'alba.`;
    if (inRange(today, METATO)) return `${when}: <b>il metato è acceso, giorno ${days(METATO[0], today) + 1} di 40.</b> I marroni freschi tornano il 5 ottobre.`;
    if (today > METATO[1] || today < MILL) return `${when}: <b>le castagne secche sono pronte.</b> La farina nuova si macina a metà gennaio.`;
    const next = today < HARVEST[0] ? HARVEST[0] : day(10, 5, Y + 1);
    return `${when}: <b>la farina nuova è in vendita.</b> La prossima raccolta comincia il 5 ottobre, tra ${days(today, next)} giorni.`;
  }
  $("today").innerHTML = seasonLine();
  $("year").textContent = Y;
  if (harvesting) $("heroLot").textContent = `La cassetta n. ${doy(plus(today, 1))} parte domattina`;

  // ---------- products: sizes in kg with the price, shipping included ----------
  const kg = (n) => `${String(n).replace(".", ",")} kg`;
  const P = {
    marroni: {
      name: "Marroni freschi",
      of: "di marroni",
      desc: "Raccolti la mattina stessa della spedizione, calibrati a mano: tre al massimo per riccio, la buccia chiara e striata.",
      sizes: { 2: 24, 5: 42, 10: 78 },
      def: 5,
      when: "Dal 5 ottobre al 14 novembre",
      // fresh ones leave the morning they are picked, or are booked for next autumn
      lot() {
        const morning = plus(today, 1);
        const pick = harvesting && morning <= HARVEST[1] ? morning : today < HARVEST[0] ? HARVEST[0] : day(10, 5, Y + 1);
        const booked = !(harvesting && morning <= HARVEST[1]);
        return { no: `n. ${doy(pick)}`, label: "Raccolta", when: (booked ? "prenotata per il " : "") + fmt(pick), arrive: fmt(plus(pick, 2)), booked };
      },
    },
    secche: {
      name: "Castagne secche",
      of: "di castagne secche",
      desc: "Quaranta giorni sul graticcio del metato, poi battute per togliere la buccia. Si ammollano una notte e si cuociono nel latte.",
      sizes: { 0.5: 10, 1: 18, 2: 34 },
      def: 1,
      when: "Tutto l'anno, finché durano",
      lot() {
        const winter = today > METATO[1] ? Y : Y - 1;
        return { no: `S-${String(winter).slice(2)}`, label: "Seccate", when: `nel metato, inverno ${winter}`, arrive: fmt(plus(today, 3)) };
      },
    },
    farina: {
      name: "Farina dolce",
      of: "di farina dolce",
      desc: "Castagne secche macinate a pietra al mulino, a gennaio. Dolce da sola: per necci, castagnaccio e polenta di castagne.",
      sizes: { 1: 14, 2: 26, 5: 60 },
      def: 2,
      when: "Nuova da metà gennaio",
      lot() {
        const year = today >= MILL ? Y : Y - 1;
        return { no: `F-${String(year).slice(2)}`, label: "Macinata", when: `a gennaio ${year}`, arrive: fmt(plus(today, 3)) };
      },
    },
  };

  // ---------- the crate builder ----------
  const state = { p: "marroni", size: 5 };
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  function flash(id, text) {
    const el = $(id);
    if (el.textContent === text) return;
    el.textContent = text;
    el.classList.remove("flash");
    void el.offsetWidth;
    el.classList.add("flash");
  }
  function render() {
    const p = P[state.p], lot = p.lot(), price = p.sizes[state.size];
    tabs.forEach((t) => {
      const on = t.dataset.p === state.p;
      t.setAttribute("aria-selected", on);
      t.tabIndex = on ? 0 : -1;
    });
    $("crate").setAttribute("aria-labelledby", "t-" + state.p);
    document.querySelectorAll(".plate-pic").forEach((f) => {
      const on = f.dataset.for === state.p;
      if (on && f.hidden) {
        f.classList.remove("swap");
        void f.offsetWidth;
        f.classList.add("swap");
      }
      f.hidden = !on;
    });
    $("pName").textContent = p.name;
    $("pDesc").textContent = p.desc;
    $("sizes").innerHTML = Object.keys(p.sizes)
      .map(Number)
      .sort((a, b) => a - b)
      .map((s) => `<button type="button" class="size" data-s="${s}" aria-pressed="${s === state.size}">${kg(s)}</button>`)
      .join("");
    flash("lLot", lot.no);
    flash("lWhat", `${kg(state.size)} ${p.of}`);
    document.querySelector("#lHarvest").previousElementSibling.textContent = lot.label;
    flash("lHarvest", lot.when);
    flash("lArrive", lot.arrive);
    flash("lPrice", `${price} €`);
    const body = [
      `Buongiorno, vorrei ordinare:`,
      `${kg(state.size)} ${p.of} (${price} €, spedizione compresa)`,
      `Cassetta ${lot.no}, ${lot.label.toLowerCase()} ${lot.when}`,
      ``,
      `Nome:`,
      `Indirizzo di consegna:`,
      `Telefono:`,
    ].join("\n");
    $("orderBtn").textContent = lot.booked ? "Prenota per email" : "Ordina per email";
    $("orderBtn").href = `mailto:${MAIL}?subject=${encodeURIComponent(`Ordine: ${kg(state.size)} ${p.of}`)}&body=${encodeURIComponent(body)}`;
  }
  function choose(p, size) {
    if (!P[p]) return;
    state.p = p;
    state.size = P[p].sizes[size] ? size : P[p].def;
    render();
  }
  tabs.forEach((t) => (t.onclick = () => choose(t.dataset.p)));
  document.querySelector(".tabs").addEventListener("keydown", (e) => {
    const i = tabs.indexOf(document.activeElement);
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (i < 0 || to === undefined) return;
    e.preventDefault();
    const t = tabs[(to + tabs.length) % tabs.length];
    choose(t.dataset.p);
    t.focus();
  });
  $("sizes").addEventListener("click", (e) => {
    const b = e.target.closest(".size");
    if (!b) return;
    state.size = +b.dataset.s;
    render();
    $("sizes").querySelector(`[data-s="${b.dataset.s}"]`).focus();
  });

  // ---------- the price list, from the same data ----------
  $("priceRows").innerHTML = Object.entries(P)
    .map(([id, p]) => {
      const sizes = Object.entries(p.sizes)
        .sort((a, b) => a[0] - b[0])
        .map(([s, price]) => `<button type="button" data-pick="${id}:${s}">${kg(+s)} · ${price} €</button>`)
        .join("");
      return `<tr><td>${p.name}</td><td>${sizes}</td><td>${p.when}</td></tr>`;
    })
    .join("");
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-pick]");
    if (!b) return;
    e.preventDefault();
    const [p, s] = b.dataset.pick.split(":");
    choose(p, +s);
    $("cassetta").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    tabs.find((t) => t.dataset.p === p).focus({ preventScroll: true });
  });

  // ---------- the burr's spines, drawn once ----------
  const spines = [];
  for (let k = 0; k < 72; k++) {
    const a = (k / 72) * Math.PI * 2, w = 0.05, r1 = 118, r2 = 176 + (k % 3) * 8;
    const pt = (ang, r) => `${(200 + Math.cos(ang) * r).toFixed(1)},${(215 + Math.sin(ang) * r).toFixed(1)}`;
    spines.push(`<polygon points="${pt(a - w, r1)} ${pt(a, r2)} ${pt(a + w, r1)}" />`);
  }
  $("spines").innerHTML = spines.join("");

  // ---------- booking the January flour: an email, nothing is stored ----------
  $("coupon").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.reportValidity()) return;
    const v = (n) => f.elements[n].value.trim().replace(/[\r\n]+/g, " ").slice(0, 120);
    const body = [`Prenoto ${v("kg")} kg di farina dolce di gennaio.`, ``, `Nome: ${v("nome")}`, `Email: ${v("email")}`, `Comune di consegna: ${v("comune")}`].join("\n");
    location.href = `mailto:${MAIL}?subject=${encodeURIComponent("Prenotazione farina di gennaio")}&body=${encodeURIComponent(body)}`;
    $("cMsg").textContent = "Si apre il tuo programma di posta con la prenotazione già scritta.";
  });

  // ---------- entrances: heading, then text, then picture, once ----------
  const groups = [
    ".intro-row > *", ".facts > div", ".intro-photo",
    ".plate", ".show-text > *",
    ".process-text > *", ".slip",
    ".prices h2", ".ticket", ".list",
    ".faq-text > *", ".faq-pics > *",
    ".c-left > *", ".c-right",
  ];
  const items = [];
  groups.forEach((sel) => document.querySelectorAll(sel).forEach((el, i) => {
    el.classList.add("rise");
    el.style.setProperty("--i", Math.min(i, 6));
    items.push(el);
  }));
  if (preview || !("IntersectionObserver" in window)) items.forEach((el) => el.classList.add("in"));
  else {
    const io = new IntersectionObserver((list) => list.forEach((x) => {
      if (!x.isIntersecting) return;
      x.target.classList.add("in");
      io.unobserve(x.target);
    }), { rootMargin: "0px 0px -8% 0px" });
    items.forEach((el) => io.observe(el));
  }

  // ---------- the wordmark runs margin to margin: fit the box to the letters ----------
  const fit = () => {
    const t = $("wordmark").querySelector("text"), b = t.getBBox();
    if (b.width) $("wordmark").setAttribute("viewBox", `${b.x} ${-b.height * 0.7} ${b.width} ${b.height * 0.7}`);
  };
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);

  choose("marroni", 5);
})();
