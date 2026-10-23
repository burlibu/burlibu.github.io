// Laboratorio flow, run by scripts/blasone-check.js on a page whose prefs pick
// the Laboratorio with the Compagnia della Giostra and whose ?seed is 3 (the
// Ariete is in the opening hand): the Scommessa button, its exclusion with
// the Editto, the chronicle, and the module boxes of the menu.
(() => {
  const R = [], $ = (id) => document.getElementById(id);
  const ok = (n, c) => R.push((c ? "OK   " : "FAIL ") + n);
  const cards = () => [...$("hand").querySelectorAll(".card")];
  ok("Laboratorio: formato e moduli nel riepilogo di stato", /Laboratorio · q/.test($("deckInfo").textContent));
  ok("Laboratorio: famiglia stampata sulle carte", cards().every((c) => /Volante|Terrestre|Marino|Draconico|Arcano|Costrutto/.test(c.textContent)));
  const other = cards().find((c) => !/Ariete/i.test(c.getAttribute("aria-label")));
  other.click();
  ok("Scommessa: nascosta se la carta scelta non è l'Ariete", $("betBtn").hidden);
  other.click();
  cards().find((c) => /Ariete/.test(c.getAttribute("aria-label"))).click();
  ok("Scommessa: offerta con l'Ariete", !$("betBtn").hidden && $("betBtn").getAttribute("aria-pressed") === "false");
  $("betBtn").click();
  ok("Scommessa: dichiarata", $("betBtn").getAttribute("aria-pressed") === "true" && /con la Scommessa/.test($("handHint").textContent));
  document.querySelector(".row.me.open").click();
  ok("Scommessa: scritta nella cronaca", /Ariete nel quarto [IV]+, con la Scommessa/.test($("log").textContent));
  ok("Scommessa: il pulsante sparisce dopo la posa", $("betBtn").hidden);
  // the menu: the modules show with the Laboratorio, and a banned pair is refused
  $("menuBtn").click();
  ok("menu: moduli visibili nel Laboratorio", !$("labChoices").hidden && $("labChoices").querySelectorAll("input").length === Object.keys(Blasone.LAB).length);
  const box = (k) => $("labChoices").querySelector(`input[value="${k}"]`);
  box("p").click();
  box("b").click();
  ok("menu: Presidio con Obiettivo rifiutati", box("p").checked && !box("b").checked && /non si provano insieme/.test($("labMsg").textContent));
  ok("menu: preferenza salvata in ordine", JSON.parse(localStorage.getItem("blasone.prefs")).lab === "qp");
  ok("menu: il codice porta i moduli", /-q$/.test($("gameCode").textContent));
  $("menuClose").click();
  const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre);
})();
