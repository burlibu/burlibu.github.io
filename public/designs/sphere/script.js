/*
  No JavaScript — pure HTML & CSS.

  Made with @property, sin(), cos() and attr().

  Made by Pavel Troshkin
  https://x.com/troshkin_pavel
  */
// The diameter is in viewport units, so every glyph's calc() depends on the window
// size and any resize restyles ~1300 pseudo-elements per frame (e.g. while a home
// tile grows). Pin it in px and re-pin on resize, which preview.js debounces.
const scene = document.querySelector(".scene");
const pin = () => {
  scene.style.removeProperty("--diameter");
  scene.style.setProperty("--diameter", `${scene.offsetWidth}px`);
};
pin();
addEventListener("resize", pin);
