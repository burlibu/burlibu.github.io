// Blasone 0.0.6: with reduced motion the end sheet still waits for the last
// move to be seen, then opens with no transition and takes focus at once.
(() => {
  const $ = (id) => document.getElementById(id), R = [];
  for (let t = 0; t < 6; t++) { document.querySelector(".hand .card").click(); document.querySelector(".row.me.open").click(); }
  setTimeout(() => R.push(($("end").hidden ? "OK   " : "FAIL ") + "ridotto: ancora scoperto a 1 s"), 1000);
  setTimeout(() => {
    R.push((!$("end").hidden && !$("end").inert && document.activeElement === $("againBtn") ? "OK   " : "FAIL ") + "ridotto: aperto senza transizione, focus pronto");
    R.push((getComputedStyle($("end")).transitionDuration === "0s" ? "OK   " : "FAIL ") + "ridotto: nessuna transizione");
    const pre = document.createElement("pre"); pre.id = "results"; pre.textContent = R.join("\n"); document.body.appendChild(pre);
  }, 2200);
})();
