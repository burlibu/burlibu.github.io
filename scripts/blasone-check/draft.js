// Blasone 0.0.7 draft flow, run by scripts/blasone-check.js on a page whose
// prefs pick the Draft delle Casate and whose ?seed is 77.
(() => {
  const R = [], $ = (id) => document.getElementById(id);
  const ok = (n, c) => R.push((c ? "OK   " : "FAIL ") + n);
  const offer = () => [...$("draftOffer").querySelectorAll("button[data-id]")];
  const free = () => offer().filter((b) => !b.disabled);
  ok("draft: foglio aperto, otto carte, mano vuota", !$("draft").hidden && offer().length === 8 && !$("hand").children.length);
  ok("draft: tasti nativi, raggiungibili da tastiera", offer().every((b) => b.tagName === "BUTTON" && b.tabIndex === 0));
  ok("draft: il quarto non accetta carte", !document.querySelector(".row.me.open"));
  const order = [];
  // the keyboard path: a button activated with detail 0, like Enter or Space
  free()[0].dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
  ok("draft: dopo la scelta il Conte risponde due volte", /Il Conte sceglie .+ e .+\./.test($("draftMsg").textContent) && offer().filter((b) => b.disabled).length === 3);
  ok("draft: focus su una carta ancora libera", document.activeElement && document.activeElement.matches("#draftOffer button:not(:disabled)"));
  const taken = offer().find((b) => b.disabled);
  taken.click();
  ok("draft: una carta già presa non si sceglie", offer().filter((b) => b.disabled).length === 3);
  while (free().length && $("draftRecap").hidden) {
    order.push(free()[0].dataset.id);
    free()[0].click();
  }
  ok("draft: concluso con il riepilogo", !$("draftRecap").hidden && $("draftRecap").querySelectorAll("li").length === 4);
  ok("draft: focus su Al duello", document.activeElement === $("duelBtn"));
  ok("draft: mai due copie, quattro per lato", document.querySelectorAll(".beast.offer.taken.me").length === 4 && document.querySelectorAll(".beast.offer.taken.foe").length === 4);
  const recap = $("draftRecap").textContent;
  $("duelBtn").click();
  ok("draft: Al duello chiude il foglio e porta alla mano", $("draft").hidden && $("hand").children.length === 4 && document.activeElement === $("hand").querySelector(".card"));
  ok("draft: cronaca del draft", /Draft · prima del duello/.test($("log").textContent));
  $("menuBtn").click();
  const code = $("gameCode").textContent;
  ok("draft: codice " + code, /^77-dn[psv]$/.test(code));
  // replaying the code with the same picks gives the same Conte
  $("codeInput").value = code;
  $("codeForm").requestSubmit();
  $("confirmYes").click();
  for (const id of [offer()[0].dataset.id].concat(order)) {
    const b = offer().find((x) => x.dataset.id === id && !x.disabled);
    if (b) b.click();
  }
  ok("draft: stesso codice e stesse scelte, stesse scelte del Conte", $("draftRecap").textContent === recap);
  document.querySelector("#duelBtn").click();
  document.querySelector(".hand .card").click();
  document.querySelector(".row.me.open").click();
  ok("draft: si gioca dopo il draft", /Turno II/.test($("turn").textContent));
  const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre);
})();
