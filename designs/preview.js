// Loaded before each design's own script. In a home tile (?preview) the page is
// rendered at 4x and scaled to 0.25, so canvases only need a quarter of the real
// pixel ratio, and resize work can wait until the tile's grow/shrink transition
// settles instead of rebuilding the scene on every frame of it. Animation loops
// are held while the tile is scrolled out of view (the observer's implicit root
// is the top-level viewport, even from inside an iframe).
if (new URLSearchParams(location.search).has("preview")) {
  let visible = true;
  const held = [];
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => (visible ? raf(cb) : (held.push(cb), 0));
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) held.splice(0).forEach(raf);
  }).observe(document.documentElement);

  const dpr = (window.devicePixelRatio || 1) / 4;
  Object.defineProperty(window, "devicePixelRatio", { get: () => dpr });

  const add = window.addEventListener.bind(window);
  window.addEventListener = (type, fn, opts) => {
    if (type !== "resize") return add(type, fn, opts);
    let timer;
    add(type, (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => (typeof fn === "function" ? fn.call(window, e) : fn.handleEvent(e)), 200);
    }, opts);
  };
}
