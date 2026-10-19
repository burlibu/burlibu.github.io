const cursor = document.getElementById("cursor");
let hasMouse = false;

window.addEventListener(
  "mousemove",
  () => {
    if (!hasMouse) {
      hasMouse = true;
      cursor.classList.add("visible");
      document.body.style.cursor = "none";
    }
  },
  { once: false },
);

document.addEventListener("mousemove", (e) => {
  cursor.style.left = e.clientX + "px";
  cursor.style.top = e.clientY + "px";
});

document.querySelectorAll("a, label").forEach((el) => {
  el.addEventListener("mouseenter", () => cursor.classList.add("big"));
  el.addEventListener("mouseleave", () => cursor.classList.remove("big"));
});
