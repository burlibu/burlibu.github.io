// Blasone 0.0.7 Prove dell'Araldo flow, run by scripts/blasone-check.js on a
// page opened with ?codice=prova-2 whose stored list of passed trials is
// hostile.
(() => {
  const R = [], $ = (id) => document.getElementById(id);
  const ok = (n, c) => R.push((c ? "OK   " : "FAIL ") + n);
  const done = () => { const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre); };
  ok("prova da ?codice: obiettivo mostrato", !$("goal").hidden && $("goalTitle").textContent === "Oltre la piega");
  ok("prova: mano del Conte scoperta", $("foeHand").querySelectorAll(".chip").length === 1 && $("foeHand").getAttribute("aria-hidden") === null);
  ok("prova: niente pesca", /nessuna pesca/.test($("deckInfo").textContent));
  $("hintBtn").click();
  ok("prova: suggerimento a richiesta", !$("hintText").hidden && $("hintBtn").getAttribute("aria-expanded") === "true" && $("hintText").textContent.length > 20);
  $("menuBtn").click();
  $("tab-prove").click();
  const marks = [...$("trialList").querySelectorAll(".trial-btn")].map((b) => /superata/.test(b.textContent));
  ok("prove salvate malevole filtrate: solo la 2", marks.length === 6 && marks.filter(Boolean).length === 1 && marks[1]);
  ok("nessun markup iniettato dalle prove salvate", !document.querySelector("img[src='x']") && !window.__pwned);
  $("menuClose").click();
  // the winning move: the Cigno into quarter I
  [...$("hand").querySelectorAll(".card")].find((b) => /Cigno/.test(b.getAttribute("aria-label"))).click();
  document.querySelector('.row.me.open[data-q="0"]').click();
  ok("prova: risultato non immediato", $("end").hidden);
  setTimeout(() => {
    ok("prova superata, verificata dall'engine", !$("end").hidden && $("endTitle").textContent === "Prova superata");
    ok("prova: spiegazione delle mosse decisive", /Le mosse decisive/.test($("endSum").textContent));
    ok("prova: Riprova e Prossima prova", $("againBtn").textContent === "Riprova" && !$("endNext").hidden && $("endCode").textContent === "prova-2");
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem("blasone.prove")); } catch (e) {}
    ok("prova: superata salvata, senza doppioni", JSON.stringify(saved) === "[1]");
    $("endNext").click();
    ok("Prossima prova: la 3", $("end").hidden && $("goalTitle").textContent === "Il mondo alla rovescia" && $("hintText").hidden);
    // a wrong move: the Conte's answers are fixed, the goal is missed
    $("menuBtn").click();
    $("codeInput").value = "prova-1";
    $("codeForm").requestSubmit();
    if ($("menu").open) $("confirmYes").click();
    [...$("hand").querySelectorAll(".card")].find((b) => /Gallo/.test(b.getAttribute("aria-label"))).click();
    document.querySelector('.row.me.open[data-q="2"]').click();
  }, 2600);
  setTimeout(() => {
    ok("prova 1 con il Gallo: non superata", !$("end").hidden && $("endTitle").textContent === "Prova non superata");
    $("againBtn").click();
    ok("Riprova: stessa prova da capo", $("goalTitle").textContent === "Metallo su colore" && $("hand").children.length === 3);
    done();
  }, 5200);
})();
