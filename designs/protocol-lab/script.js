// Protocol Lab lesson: a packet walks the diagram one hop at a time, each hop
// adds a row to the packet table and moves the active step. ?preview plays itself.
(() => {
  const $ = (id) => document.getElementById(id);
  const preview = new URLSearchParams(location.search).has("preview");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // node centres in the svg, in user units
  const N = { client: [120, 110], dns: [320, 50], web: [520, 110] };
  // one entry per packet: where it goes, what the table says, which step it belongs to
  const EV = [
    { from: "client", to: "dns", time: "0.000s", src: "192.168.1.10", dst: "8.8.8.8", proto: "DNS", info: "Standard query A www.example.com", size: "75 B", step: 1 },
    { from: "dns", to: "client", time: "0.012s", src: "8.8.8.8", dst: "192.168.1.10", proto: "DNS", info: "Standard query response A 203.0.113.10", size: "91 B", step: 1 },
    { from: "client", to: "web", time: "0.024s", src: "192.168.1.10", dst: "203.0.113.10", proto: "TCP", info: "52344 → 80 [SYN] Seq=0", size: "66 B", step: 2 },
    { from: "web", to: "client", time: "0.041s", src: "203.0.113.10", dst: "192.168.1.10", proto: "TCP", info: "80 → 52344 [SYN, ACK] Seq=0 Ack=1", size: "66 B", step: 2 },
    { from: "client", to: "web", time: "0.058s", src: "192.168.1.10", dst: "203.0.113.10", proto: "TCP", info: "52344 → 80 [ACK] Seq=1 Ack=1", size: "60 B", step: 2 },
    { from: "client", to: "web", time: "0.058s", src: "192.168.1.10", dst: "203.0.113.10", proto: "HTTP", info: "GET / HTTP/1.1", size: "484 B", step: 3 },
    { from: "web", to: "client", time: "0.076s", src: "203.0.113.10", dst: "192.168.1.10", proto: "HTTP", info: "HTTP/1.1 200 OK (text/html), 9 segments", size: "12.8 KB", step: 3 },
  ];
  const STEP_COUNT = 4;
  const HOP_MS = reduce ? 1 : 1100; // time for one packet to cross one link at 1×

  const pk = $("pk");
  const rows = $("rows");
  const steps = Array.from(document.querySelectorAll("#steps li"));
  const playBtn = $("play");

  let cur = -1; // index of the last packet that has arrived
  let anim = null; // { i, t } while a packet is in flight
  let playing = false;
  let speed = 1;
  let last = 0;

  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

  function stepOf() {
    return cur < 0 ? 1 : EV[cur].step;
  }

  function render() {
    rows.innerHTML = EV.slice(0, cur + 1)
      .map((e, k) => `<tr class="${k === cur ? "is-new" : ""}">
        <td>${k + 1}</td><td>${e.time}</td><td class="addr">${esc(e.src)}</td><td class="addr">${esc(e.dst)}</td>
        <td>${e.proto}</td><td>${esc(e.info)}</td><td>${e.size}</td></tr>`)
      .join("");
    const s = stepOf();
    $("stepLabel").textContent = `STEP ${s} OF ${STEP_COUNT}`;
    steps.forEach((li) => li.classList.toggle("is-on", +li.dataset.step === s - 1));
    $("total").textContent = cur < 0 ? "0.000 s" : EV[cur].time;
  }

  function place(x, y) {
    pk.setAttribute("cx", x);
    pk.setAttribute("cy", y);
  }

  function setPlaying(on) {
    playing = on;
    playBtn.textContent = on ? "Pausa" : cur >= EV.length - 1 ? "Ricomincia" : "Play";
    playBtn.setAttribute("aria-pressed", String(on));
  }

  function frame(now) {
    const dt = last ? now - last : 0;
    last = now;
    if (playing) {
      if (!anim) {
        const next = cur + 1;
        if (next >= EV.length) {
          setPlaying(false);
          pk.style.display = "none";
        } else {
          anim = { i: next, t: 0 };
          pk.style.display = "";
        }
      }
      if (anim) {
        const e = EV[anim.i];
        anim.t += (dt * speed) / HOP_MS;
        const p = Math.min(1, anim.t);
        const [x1, y1] = N[e.from];
        const [x2, y2] = N[e.to];
        place(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p);
        if (p >= 1) {
          cur = anim.i;
          anim = null;
          render();
          if (cur >= EV.length - 1) setPlaying(false);
        }
      }
    }
    requestAnimationFrame(frame);
  }

  function reset() {
    cur = -1;
    anim = null;
    setPlaying(false);
    pk.style.display = "none";
    place(...N.client);
    render();
  }

  playBtn.addEventListener("click", () => {
    if (!playing && cur >= EV.length - 1) reset();
    setPlaying(!playing);
  });
  $("reset").addEventListener("click", reset);
  document.querySelectorAll("[data-speed]").forEach((b) =>
    b.addEventListener("click", () => {
      speed = +b.dataset.speed;
      document.querySelectorAll("[data-speed]").forEach((x) => {
        x.classList.toggle("is-on", x === b);
        x.setAttribute("aria-pressed", String(x === b));
      });
    }));

  reset();
  requestAnimationFrame(frame);
  if (preview) setPlaying(true);
})();
