// Universo dei bottoni: genera ogni universo dai dati qui sotto e gestisce i controlli.
(() => {
  const UNI = [
    { id: "neon", nome: "Neon notte", nota: "Space Grotesk · viola e ciano su nero", lab: ["Accendi", "Attiva", "Avvia", "Entra", "Invia", "Sblocca"] },
    { id: "carta", nome: "Carta e inchiostro", nota: "Fraunces · crema, bordeaux e ocra", lab: ["Leggi", "Firma", "Sfoglia", "Scrivi", "Spedisci", "Apri"] },
    { id: "pixel", nome: "Pixel arcade", nota: "Press Start 2P · blu notte e griglia", lab: ["START", "SALVA", "GIOCA", "OK", "PREMI", "VAI"] },
    { id: "terminale", nome: "Terminale", nota: "JetBrains Mono · verde fosforo e scanline", lab: ["run", "sudo", "fetch", "push", "kill", "ls"] },
    { id: "pastello", nome: "Pastello soft", nota: "Nunito · lilla, rosa e ombre morbide", lab: ["Ciao", "Evviva", "Dai!", "Wow", "Grazie", "Piacere"] },
    { id: "brutale", nome: "Brutalismo", nota: "Archivo Black · giallo a righe e ombre dure", lab: ["SÌ", "NO", "ORA", "VAI", "LOL", "STOP"] },
  ];

  const FAM = ["pieno", "contorno", "fantasma", "rilievo", "neon", "gradiente", "riempi", "scorri", "tratteggio", "pillola", "icona", "chip", "shine", "tilt", "caricamento", "ripple", "lettere", "cupo", "toggle", "split", "secondario", "fab"];
  const NOME = {
    pieno: "Pieno", contorno: "Contorno", fantasma: "Fantasma", rilievo: "Rilievo 3D", neon: "Bagliore", gradiente: "Gradiente",
    riempi: "Riempi in hover", scorri: "Scorri in hover", tratteggio: "Tratteggio", pillola: "Pillola + icona", icona: "Solo icona",
    chip: "Chip", shine: "Riflesso", tilt: "Inclinazione", caricamento: "Caricamento", ripple: "Onda al clic",
    lettere: "Lettere che salgono", cupo: "Schiacciato", toggle: "Interruttore", split: "Diviso", secondario: "Secondario", fab: "Flottante",
  };

  // Icone a tratto 24x24 in stile Lucide (scritte qui, stroke 2, caps tondi)
  const ICO = {
    heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .6-4.5 2.1C10.5 3.6 9.3 3 7.5 3A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/>',
    play: '<path d="m6 4 14 8-14 8Z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
  };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;

  // markup di un bottone per famiglia; l è la parola dell'universo
  function bottone(fam, l) {
    switch (fam) {
      case "pillola": return `<button class="b b-pillola" type="button">${icon("zap")}${l}</button>`;
      case "icona": return `<button class="b b-icona" type="button" aria-label="${l}">${icon("heart")}</button>`;
      case "chip": return `<button class="b b-chip" type="button" data-tog aria-pressed="false">${l}</button>`;
      case "caricamento": return `<button class="b b-caricamento" type="button"><span class="spin" aria-hidden="true"></span>${l}</button>`;
      case "lettere": return `<button class="b b-lettere" type="button" aria-label="${l}">${[...l].map((c, k) => `<span class="l" style="--i:${k}" aria-hidden="true">${c}</span>`).join("")}</button>`;
      case "toggle": return `<button class="b b-toggle" type="button" data-tog aria-pressed="false">${l}</button>`;
      case "split": return `<span class="grp"><button class="b b-pieno b-split" type="button">${l}</button><button class="b b-pieno b-split-b" type="button" aria-label="Altre opzioni">${icon("chevron")}</button></span>`;
      case "fab": return `<button class="b b-fab" type="button" aria-label="Aggiungi">${icon("plus")}</button>`;
      default: return `<button class="b b-${fam}" type="button">${l}</button>`;
    }
  }

  const ICON_NAMES = Object.keys(ICO);

  function universo(u, n) {
    const celle = FAM.map((fam, k) => `
      <figure class="cell">${bottone(fam, u.lab[k % u.lab.length])}<figcaption class="cap">${NOME[fam]}</figcaption></figure>`).join("");
    return `
  <section class="uni u-${u.id}" id="u-${u.id}" aria-labelledby="h-${u.id}">
    <div class="uni-in">
      <header class="uni-h">
        <p class="num">${String(n).padStart(2, "0")} / ${UNI.length}</p>
        <h2 id="h-${u.id}">${u.nome}</h2>
        <p>${u.nota}</p>
      </header>
      <div class="grid">${celle}</div>
      <div class="ctrl">
        <div class="stack">
          <h3>Contatore e campo</h3>
          <button class="b b-pieno" type="button" data-count>${u.lab[0]} · <span>0</span></button>
          <div class="field"><input class="inp" placeholder="Cerca…" aria-label="Cerca"><button class="b b-pieno" type="button">${icon("search")}${u.lab[1]}</button></div>
        </div>
        <div class="stack">
          <h3>Selezione e interruttori</h3>
          <div class="seg" role="group" aria-label="Periodo">
            <button type="button" aria-pressed="true" data-seg>Giorno</button>
            <button type="button" aria-pressed="false" data-seg>Settimana</button>
            <button type="button" aria-pressed="false" data-seg>Mese</button>
          </div>
          <div class="row">
            <button class="sw" type="button" role="switch" aria-checked="true" aria-label="Notifiche"></button>
            <button class="sw" type="button" role="switch" aria-checked="false" aria-label="Modalità scura"></button>
          </div>
          <div class="row">${["Tutti", "Lavoro", "Casa", "Idee"].map((t, k) => `<button class="b b-chip${k === 1 ? " is-on" : ""}" type="button" data-tog aria-pressed="${k === 1}">${t}</button>`).join("")}</div>
        </div>
        <div class="stack">
          <h3>Slider</h3>
          <label class="rgw"><span>Volume <output>60</output></span><input class="rg" type="range" min="0" max="100" value="60" style="--p:60"></label>
          <label class="rgw"><span>Luminosità <output>35</output></span><input class="rg sottile" type="range" min="0" max="100" value="35" style="--p:35"></label>
          <label class="rgw"><span>Velocità <output>80</output></span><input class="rg" type="range" min="0" max="100" value="80" style="--p:80"></label>
        </div>
        <div class="stack">
          <h3>Progresso e attesa</h3>
          <div class="bar" role="progressbar" aria-valuenow="64" aria-valuemin="0" aria-valuemax="100"><i style="--p:64"></i></div>
          <div class="dots" aria-hidden="true"><i style="--i:0"></i><i style="--i:1"></i><i style="--i:2"></i></div>
        </div>
        <div class="stack" style="grid-column: 1 / -1">
          <h3>Icone</h3>
          <div class="row">${ICON_NAMES.map((ic) => `<button class="b b-icona" type="button" aria-label="${ic}">${icon(ic)}</button>`).join("")}</div>
        </div>
      </div>
    </div>
  </section>`;
  }

  document.getElementById("universi").innerHTML = UNI.map((u, i) => universo(u, i + 1)).join("");
  document.getElementById("jump").innerHTML = UNI.map((u) => `<a href="#u-${u.id}">${u.nome}</a>`).join("");

  // controlli: interruttori di gruppo, selezione, contatore, onda, caricamento, slider
  let conta = 0;
  document.addEventListener("click", (e) => {
    const tog = e.target.closest("[data-tog]");
    if (tog) {
      const on = !tog.classList.contains("is-on");
      tog.classList.toggle("is-on", on);
      tog.setAttribute("aria-pressed", String(on));
    }
    const seg = e.target.closest("[data-seg]");
    if (seg) seg.parentElement.querySelectorAll("[data-seg]").forEach((b) => b.setAttribute("aria-pressed", String(b === seg)));
    const sw = e.target.closest(".sw");
    if (sw) sw.setAttribute("aria-checked", String(sw.getAttribute("aria-checked") !== "true"));
    const cnt = e.target.closest("[data-count]");
    if (cnt) cnt.querySelector("span").textContent = ++conta;
    const car = e.target.closest(".b-caricamento");
    if (car && !car.classList.contains("is-loading")) {
      car.classList.add("is-loading");
      setTimeout(() => car.classList.remove("is-loading"), 1600);
    }
  });

  document.addEventListener("pointerdown", (e) => {
    const b = e.target.closest(".b-ripple");
    if (!b) return;
    const r = b.getBoundingClientRect();
    const s = document.createElement("span");
    s.className = "rip";
    s.style.left = `${e.clientX - r.left}px`;
    s.style.top = `${e.clientY - r.top}px`;
    b.append(s);
    setTimeout(() => s.remove(), 650);
  });

  document.addEventListener("input", (e) => {
    const r = e.target.closest(".rg");
    if (!r) return;
    r.style.setProperty("--p", r.value);
    r.closest("label").querySelector("output").textContent = r.value;
  });
})();
