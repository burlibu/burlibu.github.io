// Blasone 0.0.6 input and flow checks, run by scripts/blasone-check.js on a
// page whose stored prefs are hostile and whose ?seed is a script tag.
(() => {
  const R = [], $ = (id) => document.getElementById(id);
  const ok = (n, c) => R.push((c ? "OK   " : "FAIL ") + n);
  const noInjected = () => !document.querySelector("img[src='x'], script[data-evil]") && !window.__pwned;
  ok("prototipo non inquinato", ({}).polluted === undefined);
  ok("colors:false valido applicato", document.documentElement.dataset.cards === "");
  ok("size stringa rifiutata -> zoom 1", document.documentElement.style.getPropertyValue("--zoom").trim() === "1");
  ok("formato malevolo ignorato -> Classico", /Classico/.test($("deckInfo").textContent));
  $("menuBtn").click();
  ok("?seed malevolo ignorato, codice valido: " + $("gameCode").textContent, Blasone.parseCode($("gameCode").textContent) !== null);
  ok("versione mostrata", $("version").textContent === "0.0.8");
  ok("rivalita non booleana ignorata", !/r$/.test($("gameCode").textContent) && !$("rivalPref").checked);
  $("codeInput").value = "<img src=x onerror=window.__pwned=1>";
  $("codeForm").requestSubmit();
  ok("codice malevolo rifiutato", /non valido/.test($("codeMsg").textContent) && noInjected());
  $("codeInput").value = "4242-rev";
  $("codeForm").requestSubmit();
  ok("codice valido rigiocato (Crepuscolo, Editto)", !$("menu").open && /Crepuscolo/.test($("deckInfo").textContent) && !$("edictBtn").hidden);
  ok("codice conservato", (() => { $("menuBtn").click(); const c = $("gameCode").textContent; $("menuClose").click(); return c === "4242-rev"; })());
  // play the whole game
  for (let t = 0; t < 6; t++) { document.querySelector(".hand .card").click(); document.querySelector(".row.me.open").click(); }
  ok("fine: riepilogo non immediato", $("end").hidden);
  ok("cronaca: rivelate insieme", /rivelate insieme/.test($("log").textContent));
  setTimeout(() => ok("dopo 1 s il tabellone è ancora scoperto", $("end").hidden), 1000);
  setTimeout(() => {
    ok("dopo 3 s riepilogo aperto e interattivo", !$("end").hidden && !$("end").inert);
    ok("focus su Nuova partita", document.activeElement === $("againBtn"));
    ok("tavolo inerte sotto il riepilogo", document.querySelector(".desk").inert);
    const b = document.querySelector(".q-btn"); b.click();
    ok("quarto espandibile", b.getAttribute("aria-expanded") === "true" && !$(b.getAttribute("aria-controls")).hidden && /Perché/.test($(b.getAttribute("aria-controls")).textContent));
    ok("codice nel riepilogo", $("endCode").textContent === "4242-rev");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    ok("Esc chiude il riepilogo, focus su Rivedi", $("end").hidden && document.activeElement === $("endBtn") && !document.querySelector(".desk").inert);
    $("endBtn").click();
    $("endReport").click();
    ok("riscontro aperto dal riepilogo", $("menu").open && !$("pane-riscontro").hidden);
    $("rNotes").value = '=HYPERLINK("http://x")\u0007\n@riga2 <b>grassetto</b>';
    $("rDecisive").value = "+cmd" + "x".repeat(400);
    // a refused clipboard shows the sheet's text in place, where it can be read
    navigator.clipboard.writeText = () => Promise.reject(new Error("negato"));
    $("reportCopy").click();
  }, 3000);
  setTimeout(() => {
    const out = $("reportOut");
    if (!out.hidden) {
      const v = out.value;
      ok("formula disinnescata", /\n'=HYPERLINK/.test(v) && /\n'@riga2/.test(v) && /decisive: '\+cmd/.test(v));
      ok("caratteri di controllo rimossi", !/[\u0000-\u0008]/.test(v));
      ok("lunghezza limitata", v.split("\n").find((l) => l.startsWith("Abilità")).length < 260);
      ok("testo resta testo", /<b>grassetto<\/b>/.test(v) && noInjected());
    } else R.push("FAIL scheda: il testo di riserva non è comparso");
    ok("nessun markup iniettato in tutta la prova", noInjected());
    const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre);
  }, 3600);
})();
