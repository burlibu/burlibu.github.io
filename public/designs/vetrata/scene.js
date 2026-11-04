// The stained-glass world. Reads phases and trips from story.js and turns them into motion,
// on one continuous camera rail. Throws if WebGL is missing, script.js handles that.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/RoomEnvironment.js";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";

const PAPER = "#e6e0cf";
const INK = "#16130e";
const RED = "#b8352a";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const SERIF = '"Goudy Bookletter 1911",serif';
const INK_W = 0.055;
const MOVE = 2.1; // seconds of the camera move between phases
const WALL = -6;
const WIN = { y: 17.4, w: 20, h: 13.8 };
const TAN_BASE = Math.tan((14.5 * Math.PI) / 180);
const TAN_MAX = 0.5;

const smooth = (k) => k * k * (3 - 2 * k);
const clamp01 = (k) => Math.min(1, Math.max(0, k));
const io = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function createScene(canvas, { story, onPick, preview = false, reduced = false, hq = false }) {
  const TECH = story.TECH;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 140);

  const allGlass = [];
  const targets = {};
  const pickable = [];

  function glass(tint, distance = 2.6) {
    const m = new THREE.MeshPhysicalMaterial({
      transmission: 1, roughness: 0.1, thickness: 1.1, ior: 1.35, envMapIntensity: 0.55,
      specularIntensity: 1, color: "#ffffff", emissive: tint ? TECH[tint].color : "#ffffff", emissiveIntensity: 0,
    });
    if (tint) { m.attenuationColor = new THREE.Color(TECH[tint].color); m.attenuationDistance = distance; }
    allGlass.push(m);
    return m;
  }

  function register(id, mat) { (targets[id] = targets[id] || []).push(mat); }

  // Ink outline: an inflated back-face shell. Flagged transparent so it stays out of the
  // transmission pass, otherwise the glass would refract its own black inside.
  function inked(geo, mat, id, ink = INK_W) {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(geo, mat);
    grp.add(body);
    const shell = geo.clone();
    const p = shell.attributes.position;
    const n = shell.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) + n.getX(i) * ink, p.getY(i) + n.getY(i) * ink, p.getZ(i) + n.getZ(i) * ink);
    }
    grp.add(new THREE.Mesh(shell, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, transparent: true, toneMapped: false })));
    if (id) {
      register(id, mat);
      body.userData.pick = id;
      pickable.push(body);
    }
    return grp;
  }

  const labels = [];
  // A plane carrying canvas text. mesh.draw(fn) repaints it.
  function label(wu, hu, draw, res = 220) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(wu * res);
    c.height = Math.ceil(hu * res);
    const g = c.getContext("2d");
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wu, hu),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    mesh.draw = (fn) => {
      mesh.lastDraw = fn;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, c.width, c.height);
      g.scale(c.width / wu, c.height / hu);
      g.fillStyle = g.strokeStyle = INK;
      g.textBaseline = "middle";
      fn(g, wu, hu);
      t.needsUpdate = true;
    };
    if (draw) mesh.draw(draw);
    labels.push(mesh);
    return mesh;
  }
  const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

  // A paper pill with ink border and centred text, always readable over anything.
  function tag(wu = 2.4, hu = 0.42) {
    const m = label(wu, hu, null, 200);
    m.say = (text, red) => {
      m.draw((g, W, H) => {
        g.font = `600 ${H * 0.44}px ${MONO}`;
        const tw = Math.min(g.measureText(text).width + H * 0.8, W - 0.02);
        rr(g, (W - tw) / 2, 0.012, tw, H - 0.024, H * 0.46);
        g.fillStyle = red ? RED : PAPER;
        g.fill();
        g.lineWidth = 0.022;
        g.strokeStyle = INK;
        g.stroke();
        g.fillStyle = red ? "#fff8ec" : INK;
        g.textAlign = "center";
        g.fillText(text, W / 2, H * 0.53, W - H * 0.8);
      });
    };
    m.renderOrder = 5;
    return m;
  }

  /* ---------- wall: paper, the stained window, the ink sea ---------- */

  const winCanvas = document.createElement("canvas");
  winCanvas.width = 1800;
  winCanvas.height = 1240;
  const winTex = new THREE.CanvasTexture(winCanvas);
  winTex.colorSpace = THREE.SRGBColorSpace;
  winTex.anisotropy = 8;
  const win = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w, WIN.h), new THREE.MeshBasicMaterial({ map: winTex, toneMapped: false }));
  win.position.set(0, WIN.y, WALL);
  scene.add(win);

  let litNow = new Set();
  function drawWindow(lit) {
    litNow = lit;
    const g = winCanvas.getContext("2d");
    const X = 90, Y = 430, W = 1620, H = 760;
    const cols = 4;
    const cw = W / cols;
    const ch = H / 2;
    g.fillStyle = PAPER;
    g.fillRect(0, 0, 1800, 1240);
    const outline = () => {
      g.beginPath();
      g.moveTo(X, Y + H);
      g.lineTo(X, Y);
      g.bezierCurveTo(X, 240, 560, 90, 900, 24);
      g.bezierCurveTo(1240, 90, X + W, 240, X + W, Y);
      g.lineTo(X + W, Y + H);
      g.closePath();
    };
    story.PHASES.forEach((p, i) => {
      const cx = X + (i % cols) * cw;
      const cy = Y + Math.floor(i / cols) * ch;
      const on = lit.has(i);
      if (on) {
        g.globalAlpha = 0.72;
        g.fillStyle = TECH[p.tint].color;
        g.fillRect(cx, cy, cw, ch);
        g.globalAlpha = 1;
      }
      g.globalAlpha = on ? 1 : 0.5;
      g.fillStyle = INK;
      g.textBaseline = "alphabetic";
      g.font = `400 34px "Sorts Mill Goudy",serif`;
      g.fillText(String(i + 1), cx + 30, cy + 54);
      g.font = `400 58px ${SERIF}`;
      g.fillText(p.title, cx + 30, cy + 118, cw - 56);
      g.font = `500 25px ${MONO}`;
      let line = 0;
      for (const c of p.chips) {
        if (c.extra || line >= 6 || g.measureText(c.name).width > cw - 60) continue;
        g.fillText(c.name, cx + 30, cy + 170 + line * 34);
        line++;
      }
      g.globalAlpha = 1;
    });
    // Tracery: the head of the arch fans out from the rose.
    outline();
    g.save();
    g.clip();
    g.strokeStyle = INK;
    g.lineWidth = 9;
    for (let a = -7; a <= 7; a++) {
      g.beginPath();
      g.moveTo(900, 250);
      g.lineTo(900 + a * 180, Y);
      g.stroke();
    }
    g.restore();
    g.beginPath();
    g.arc(900, 250, 118, 0, 7);
    g.fillStyle = lit.size === 8 ? TECH.cookie.color : PAPER;
    g.fill();
    g.lineWidth = 15;
    g.stroke();
    g.fillStyle = INK;
    g.textAlign = "center";
    g.font = `400 54px ${SERIF}`;
    g.fillText("Lo stack", 900, 266);
    g.textAlign = "left";
    g.lineWidth = 15;
    for (let i = 1; i < cols; i++) { g.beginPath(); g.moveTo(X + i * cw, Y); g.lineTo(X + i * cw, Y + H); g.stroke(); }
    for (let i = 0; i <= 1; i++) { g.beginPath(); g.moveTo(X, Y + i * ch); g.lineTo(X + W, Y + i * ch); g.stroke(); }
    outline();
    g.lineWidth = 26;
    g.stroke();
    winTex.needsUpdate = true;
  }

  const WAVE_LAYERS = [
    { y: 0.1, a: 15, k: 1.5, v: 0.9, ph: 0, fill: "#d7d2c2" },
    { y: 0.22, a: 17, k: 1.9, v: 1.15, ph: 1.7, fill: PAPER },
    { y: 0.35, a: 19, k: 1.7, v: 1.3, ph: 3.1, fill: "#dcd7c7" },
    { y: 0.43, a: 11, k: 2.4, v: 1, ph: 4.4, span: [0.05, 0.4] },
    { y: 0.52, a: 16, k: 1.45, v: 1.4, ph: 0.6, fill: PAPER },
    { y: 0.62, a: 10, k: 2.1, v: 1.2, ph: 5.1, span: [0.55, 0.97] },
    { y: 0.72, a: 14, k: 1.8, v: 1.25, ph: 2.2, fill: PAPER },
    { y: 0.86, a: 12, k: 2.2, v: 1.05, ph: 1.1, fill: "#dcd7c7" },
  ];
  const seaC = document.createElement("canvas");
  seaC.width = 1536;
  seaC.height = 420;
  const sea = seaC.getContext("2d");
  const seaTex = new THREE.CanvasTexture(seaC);
  seaTex.colorSpace = THREE.SRGBColorSpace;
  const SEA = { w: 44, h: 12 };
  const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(SEA.w, SEA.h), new THREE.MeshBasicMaterial({ map: seaTex, toneMapped: false }));
  seaMesh.position.set(0, 1.6 - SEA.h / 2, WALL + 0.05);
  scene.add(seaMesh);

  function drawSea(t) {
    sea.fillStyle = PAPER;
    sea.fillRect(0, 0, seaC.width, seaC.height);
    sea.strokeStyle = INK;
    sea.lineWidth = 3.4;
    sea.lineCap = "round";
    sea.lineJoin = "round";
    for (const l of WAVE_LAYERS) {
      const x0 = l.span ? l.span[0] * seaC.width : -20;
      const x1 = l.span ? l.span[1] * seaC.width : seaC.width + 20;
      const f = (6.283 / 800) * l.k;
      sea.beginPath();
      for (let x = x0; x <= x1; x += 12) {
        const y = l.y * seaC.height + l.a * Math.sin(f * x + t * l.v + l.ph) + l.a * 0.45 * Math.sin(f * 2.3 * x - t * l.v * 0.7 + l.ph * 1.7);
        if (x === x0) sea.moveTo(x, y); else sea.lineTo(x, y);
      }
      if (l.fill) {
        sea.lineTo(x1, seaC.height + 10);
        sea.lineTo(x0, seaC.height + 10);
        sea.closePath();
        sea.fillStyle = l.fill;
        sea.fill();
      }
      sea.stroke();
    }
    seaTex.needsUpdate = true;
  }

  // Coloured light each pane throws on the paper. Multiply over a white-edged gradient.
  function lightBlob(tint) {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    // Each stack throws three overlapping lights: keep them pale or they multiply to mud.
    grad.addColorStop(0, `#${new THREE.Color("#ffffff").lerp(new THREE.Color(TECH[tint].color), 0.42).getHexString()}`);
    grad.addColorStop(1, "#ffffff");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
      map: t, transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false, opacity: 1,
    }));
    m.scale.set(6.4, 3.6, 1);
    scene.add(m);
    return m;
  }

  /* ---------- client: three plates ---------- */

  const client = new THREE.Group();
  client.position.set(-4.7, 0.2, 0);
  client.rotation.set(-0.04, 0.34, 0);
  scene.add(client);

  const drawForm = (g) => {
    g.lineWidth = 0.018;
    [0.17, 0.33, 0.49].forEach((x) => { g.beginPath(); g.arc(x, 0.17, 0.055, 0, 7); g.stroke(); });
    rr(g, 0.72, 0.07, 2.56, 0.2, 0.1);
    g.stroke();
    g.font = `.105px ${MONO}`;
    g.fillText("saw.dibris.unige.it/login.php", 0.85, 0.175);
    g.font = `.31px ${SERIF}`;
    g.fillText("Accedi", 0.22, 0.6);
    g.lineWidth = 0.016;
    rr(g, 0.22, 0.86, 2.96, 0.3, 0.05);
    g.stroke();
    rr(g, 0.22, 1.28, 2.96, 0.3, 0.05);
    g.stroke();
    g.font = `.12px ${MONO}`;
    g.fillText(formUser, 0.34, 1.015, 2.7);
    g.fillText("••••••••", 0.34, 1.435);
    rr(g, 0.22, 1.72, 1.3, 0.3, 0.15);
    g.fill();
    g.fillStyle = PAPER;
    g.fillText("Accedi", 0.6, 1.875);
  };
  let formUser = "pippo";

  const plates = {};
  [["html", "<form>"], ["css", ".pill { }"], ["js", "fetch()"]].forEach(([id, code], i) => {
    const plate = inked(new RoundedBoxGeometry(3.5, 2.5, 0.14, 4, 0.05), glass(id), id);
    const name = TECH[id].name;
    const t = label(1.9, 0.3, (g) => {
      g.font = `.2px ${SERIF}`;
      g.fillText(name, 0.02, 0.15);
      g.font = `.1px ${MONO}`;
      g.fillText(code, 1.05, 0.16);
    });
    t.position.set(0.72, -1.04, 0.09);
    plate.add(t);
    plates[id] = plate;
    client.add(plate);
  });
  const formLabel = label(3.4, 2.1, drawForm);
  formLabel.position.set(0, 0.16, 0.09);
  plates.html.add(formLabel);
  const clientName = label(3.2, 0.4, (g) => { g.font = `400 .34px ${SERIF}`; g.fillText("Il tuo browser", 0, 0.2); });
  clientName.position.set(-0.08, 1.75, 0);
  client.add(clientName);

  /* ---------- server: three slabs ---------- */

  const server = new THREE.Group();
  server.position.set(4.7, 0.1, 0);
  server.rotation.set(0.16, -0.42, 0);
  scene.add(server);
  const slabs = {};
  [["apache", "porta 443, chiama PHP se .php"], ["php", "$_POST, $_SESSION, echo"], ["mysql", "SELECT … WHERE username = ?"]].forEach(([id, code]) => {
    const slab = inked(new RoundedBoxGeometry(3.1, 0.76, 1.8, 5, 0.1), glass(id, 2), id);
    const name = TECH[id].name;
    const t = label(3, 0.66, (g) => {
      g.font = `.28px ${SERIF}`;
      g.fillText(name, 0.12, 0.23);
      g.font = `.1px ${MONO}`;
      g.fillText(code, 0.12, 0.5);
    });
    t.position.z = 0.92;
    slab.add(t);
    slabs[id] = slab;
    server.add(slab);
  });
  const serverName = label(3, 0.4, (g) => { g.font = `400 .34px ${SERIF}`; g.fillText("Il server", 0, 0.2); });
  serverName.rotation.x = -0.1;
  server.add(serverName);
  const seaName = label(2.4, 0.4, (g) => { g.font = `400 .32px ${SERIF}`; g.textAlign = "center"; g.fillText("La rete", 1.2, 0.2); });
  seaName.position.set(0, -2.9, -1.5);
  scene.add(seaName);

  const blobs = {};
  for (const id of ["html", "css", "js", "apache", "php", "mysql"]) blobs[id] = lightBlob(id);

  /* ---------- DNS, URL sheets, TLS tube ---------- */

  const dns = inked(new THREE.CylinderGeometry(0.62, 0.62, 0.42, 6), glass("http", 1.5), "dns");
  dns.position.set(-0.3, 2.5, -0.4);
  dns.rotation.set(0.5, 0.3, 0);
  const dnsTag = tag(1, 0.36);
  dnsTag.say("DNS");
  dnsTag.position.set(-0.3, 3.25, 0);
  const dnsGroup = new THREE.Group();
  dnsGroup.add(dns, dnsTag);
  scene.add(dnsGroup);

  const urlGroup = new THREE.Group();
  urlGroup.position.set(-4.7, 2.75, 0.6);
  let ux = -2.3;
  [["https://", 1.25, "schema"], ["saw.dibris.unige.it", 2.7, "host"], [":443", 0.8, "porta"], ["/login.php", 1.6, "percorso"]].forEach(([text, w, name], i) => {
    const sheet = inked(new RoundedBoxGeometry(w, 0.5, 0.1, 3, 0.04), glass("http", 1.2), "url", 0.035);
    const l = label(w, 0.5, (g, W) => { g.textAlign = "center"; g.font = `600 .16px ${MONO}`; g.fillText(text, W / 2, 0.25, W - 0.1); });
    l.position.z = 0.07;
    sheet.add(l);
    const n = label(w, 0.24, (g, W) => { g.textAlign = "center"; g.font = `.13px ${SERIF}`; g.fillText(name, W / 2, 0.12); });
    n.position.set(0, -0.42, 0);
    sheet.add(n);
    sheet.position.set(ux + w / 2, (i % 2) * 0.1, 0);
    sheet.userData.home = sheet.position.y;
    ux += w + 0.13;
    urlGroup.add(sheet);
  });
  scene.add(urlGroup);

  /* ---------- anchors and routes ---------- */

  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  function anchor(name) {
    if (name === "client") return client.localToWorld(v(1.95, 0.35, 0.2));
    if (name === "dns") return dnsGroup.localToWorld(v(-0.3, 2.5, -0.1));
    return slabs[name].localToWorld(v(-1.62, 0, 0.7));
  }
  function curveFor(from, to, forceUp) {
    const a = anchor(from);
    const b = anchor(to);
    if (from === to) return new THREE.QuadraticBezierCurve3(a, a.clone().add(v(0.5, 2.2, 0.3)), a.clone().add(v(-0.5, 0.8, 0.2)));
    const d = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    if (Math.abs(a.x - b.x) < 1) mid.x -= 1.5 + d * 0.2;
    else if (b.x > a.x || forceUp) mid.y += d * 0.34 + 0.5;
    else mid.y -= d * 0.34 + 0.2;
    mid.z += 0.3;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  }

  const routeMat = new LineMaterial({ color: INK, linewidth: 2.8, dashed: true, dashSize: 0.17, gapSize: 0.13, toneMapped: false });
  const routeLine = new Line2(new LineGeometry(), routeMat);
  routeLine.frustumCulled = false;
  routeLine.visible = false;
  scene.add(routeLine);
  function setRoute(curve) {
    routeLine.geometry.dispose();
    const g = new LineGeometry();
    g.setPositions(curve.getPoints(48).flatMap((p) => [p.x, p.y, p.z]));
    routeLine.geometry = g;
    routeLine.computeLineDistances();
    routeLine.visible = true;
  }

  const tubeGroup = new THREE.Group();
  const tubeMat = glass("http", 2);
  tubeMat.roughness = 0.04;
  let tubeMesh = null;
  scene.add(tubeGroup);
  function buildTube() {
    if (tubeMesh) { tubeGroup.remove(tubeMesh); tubeMesh.geometry.dispose(); }
    tubeMesh = new THREE.Mesh(new THREE.TubeGeometry(curveFor("client", "apache", true), 48, 0.46, 14), tubeMat);
    tubeGroup.add(tubeMesh);
    if (!targets.tube) { register("tube", tubeMat); }
  }

  /* ---------- packet ---------- */

  const packet = new THREE.Group();
  packet.visible = false;
  scene.add(packet);
  const envMat = glass("http", 1.1);
  const ballMat = glass("http", 0.9);
  const jsonMat = glass("js", 0.4);
  const bodies = {
    env: inked(new RoundedBoxGeometry(1.1, 0.66, 0.14, 4, 0.05), envMat, "packet", 0.04),
    ball: inked(new THREE.SphereGeometry(0.2, 24, 16), ballMat, "packet", 0.035),
    json: inked(new RoundedBoxGeometry(0.86, 0.58, 0.16, 4, 0.1), jsonMat, "packet", 0.04),
  };
  const bodyMat = { env: envMat, ball: ballMat, json: jsonMat };
  for (const b of Object.values(bodies)) packet.add(b);
  const flap = label(1.1, 0.66, (g) => {
    g.lineWidth = 0.018;
    g.beginPath(); g.moveTo(0.03, 0.05); g.lineTo(0.55, 0.38); g.lineTo(1.07, 0.05); g.stroke();
  });
  flap.position.z = 0.09;
  bodies.env.add(flap);
  const braces = label(0.86, 0.58, (g) => { g.textAlign = "center"; g.font = `600 .28px ${MONO}`; g.fillText("{ }", 0.43, 0.3); });
  braces.position.z = 0.1;
  bodies.json.add(braces);
  const packetTag = tag(2.6, 0.4);
  packetTag.position.y = 0.6;
  packet.add(packetTag);

  const cookieMat = glass("cookie", 0.3);
  const makeCookie = (id) => {
    const c = inked(new THREE.CylinderGeometry(0.24, 0.24, 0.08, 32), id ? cookieMat : glass("cookie", 0.3), id, 0.03);
    c.rotation.x = Math.PI / 2;
    return c;
  };
  const crumbs = () => {
    const d = label(0.44, 0.44, (g) => { [[0.14, 0.16], [0.28, 0.12], [0.22, 0.28], [0.33, 0.3], [0.11, 0.29]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 0.024, 0, 7); g.fill(); }); });
    d.position.z = 0.07;
    return d;
  };
  const cookie = new THREE.Group();
  cookie.add(makeCookie("cookie"), crumbs());
  cookie.position.set(0.66, 0.3, 0.1);
  packet.add(cookie);
  const jar = new THREE.Group();
  jar.add(makeCookie("cookie"), crumbs());
  jar.position.set(1.62, 1.36, 0.4);
  jar.visible = false;
  client.add(jar);

  // The envelope opens into its sheets: first line, headers, body.
  const sheetGroup = new THREE.Group();
  const sheets = [0, 1, 2].map(() => {
    const m = inked(new RoundedBoxGeometry(3.8, 0.74, 0.08, 3, 0.03), glass("http", 1.6), null, 0.03);
    const l = label(3.8, 0.74);
    l.position.z = 0.06;
    m.add(l);
    m.text = l;
    sheetGroup.add(m);
    return m;
  });
  sheetGroup.visible = false;
  scene.add(sheetGroup);

  /* ---------- fx: the code that stays behind, DOM tree, Promise ---------- */

  const code = label(3, 0.5, (g) => { g.font = `600 .13px ${MONO}`; g.fillStyle = "#fff8ec"; rr(g, 0, 0, 3, 0.5, 0.06); g.fillStyle = TECH.php.color; g.fill(); g.fillStyle = "#fff8ec"; g.fillText('<?php echo "Accedi"; ?>', 0.14, 0.26); });
  code.position.set(0, -0.56, 1.05);
  code.renderOrder = 4;
  slabs.php.add(code);
  const stays = tag(2.6, 0.34);
  stays.say("resta qui");
  stays.position.set(1.05, -0.92, 1.1);
  slabs.php.add(stays);
  const output = label(2.3, 0.44, (g) => { g.font = `600 .14px ${MONO}`; rr(g, 0.01, 0.01, 2.28, 0.42, 0.05); g.fillStyle = TECH.html.color; g.fill(); g.lineWidth = 0.02; g.strokeStyle = INK; g.stroke(); g.fillStyle = INK; g.fillText("<h1>Accedi</h1>", 0.2, 0.23); });
  output.renderOrder = 6;
  scene.add(output);

  const tree = new THREE.Group();
  const NODE = { w: 0.98, h: 0.38 };
  const nodeGeo = new RoundedBoxGeometry(NODE.w, NODE.h, 0.1, 3, 0.04);
  const TREE = {
    html: [0, 1.5, null, "html"], head: [-1.25, 0.72, "html", "head"], body: [0.85, 0.72, "html", "html"],
    title: [-1.25, -0.06, "head", "html"], h1: [-0.15, -0.06, "body", "html"], form: [1.3, -0.06, "body", "html"],
    input: [0.25, -0.84, "form", "html"], "input ": [1.3, -0.84, "form", "html"], button: [2.35, -0.84, "form", "html"],
  };
  const treeNodes = {};
  const treeEdges = {};
  for (const [name, [x, y, parent]] of Object.entries(TREE)) {
    const mat = glass("html", 1);
    const n = inked(nodeGeo, mat, "dom", 0.03);
    n.position.set(x, y, 0);
    const l = label(NODE.w, NODE.h, (g, W, H) => { rr(g, 0.05, 0.05, W - 0.1, H - 0.1, 0.03); g.fillStyle = "rgba(246,226,184,.86)"; g.fill(); g.fillStyle = INK; g.textAlign = "center"; g.font = `600 .13px ${MONO}`; g.fillText(`<${name.trim()}>`, W / 2, H / 2 + 0.01); });
    l.position.z = 0.07;
    n.add(l);
    n.userData.mat = mat;
    tree.add(n);
    treeNodes[name] = n;
    if (parent) {
      const [px, py] = TREE[parent];
      const lg = new LineGeometry();
      lg.setPositions([px, py - NODE.h / 2, -0.02, x, y + NODE.h / 2, -0.02]);
      const line = new Line2(lg, new LineMaterial({ color: INK, linewidth: 2.2, toneMapped: false }));
      line.computeLineDistances();
      tree.add(line);
      treeEdges[name] = line;
    }
  }
  const bubble = inked(new THREE.SphereGeometry(0.1, 16, 12), glass("js", 0.2), null, 0.025);
  const bubbleTag = tag(1.2, 0.3);
  bubbleTag.position.y = 0.3;
  bubble.add(bubbleTag);
  tree.add(bubble);
  scene.add(tree);

  // The single DOM node fetch rewrites: it sits over the page heading, the rest stays put.
  const saluto = tag(1.9, 0.44);
  saluto.position.set(-0.6, 0.72, 0.16);
  saluto.visible = false;
  plates.html.add(saluto);

  const promiseTag = tag(3.6, 0.46);
  promiseTag.position.set(-4.7, 2.45, 0.5);
  promiseTag.visible = false;
  scene.add(promiseTag);

  /* ---------- camera rail ---------- */

  let phases = story.PHASES;
  let railPos;
  let railLook;
  let tanHalf = TAN_BASE;
  let dolly = 1;
  let freeW = 1;
  const insets = { x: 0, y: 0 };

  function buildRail() {
    const widthPerDist = 2 * tanHalf * (freeW / Math.max(1, canvas.clientHeight || 1));
    const finalDist = Math.max(12.1 / tanHalf, 23 / widthPerDist);
    const lookKeys = phases.map((p) => v(...p.cam.look));
    const posKeys = phases.map((p, i) => v(...p.cam.pos).sub(lookKeys[i]).multiplyScalar(dolly).add(lookKeys[i]));
    posKeys.push(v(0, 16.5, WALL + finalDist));
    lookKeys.push(v(0, 16.5, WALL));
    railPos = new THREE.CatmullRomCurve3(posKeys, false, "centripetal");
    railLook = new THREE.CatmullRomCurve3(lookKeys, false, "centripetal");
  }

  function resize() {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth || 1;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    freeW = Math.max(1, w - insets.x);
    // The two shores must fit in the width the panel leaves free. Past a natural field
    // of view the camera backs away instead of distorting.
    const wanted = TAN_BASE * Math.max(1, (16 / 9) * (h / freeW));
    tanHalf = Math.min(wanted, TAN_MAX);
    dolly = wanted / tanHalf;
    camera.fov = (2 * Math.atan(tanHalf) * 180) / Math.PI;
    camera.setViewOffset(w, h, insets.x / 2, insets.y / 2, w, h);
    camera.updateProjectionMatrix();
    buildRail();
    dirty = true;
  }

  /* ---------- state ---------- */

  let dirty = true;
  let view = { phase: null, index: 0, trips: [], broken: null };
  let railFrom = 0;
  let railTo = 0;
  let railStart = -1;
  let railU = 0;
  let openClient = 0;
  let openServer = 0;
  let wantClient = 0;
  let wantServer = 0;
  const fxLevel = { url: 0, tube: 0, evaporate: 0, dom: 0 };
  const fxWant = { url: 0, tube: 0, evaporate: 0, dom: 0 };
  let userFocus = null;
  let tripFocus = null;
  let tripIndex = -1;
  let tripClock = 0;
  let tripDelay = 0;
  let sheetK = 0;
  let curve = null;

  function placeStacks() {
    const c = smooth(clamp01(openClient));
    ["html", "css", "js"].forEach((id, i) => {
      plates[id].position.set(i * (0.3 + 0.5 * c), -i * (0.27 + 0.1 * c), -i * (0.5 + 1 * c));
    });
    const s = smooth(clamp01(openServer));
    ["apache", "php", "mysql"].forEach((id, i) => { slabs[id].position.y = (1 - i) * (0.9 + 0.75 * s); });
    serverName.position.set(-0.05, 1.72 + 0.75 * s, 0.4);
    for (const [id, grp] of [...Object.entries(plates), ...Object.entries(slabs)]) {
      const p = grp.getWorldPosition(new THREE.Vector3());
      blobs[id].position.set(p.x * 1.08 + 0.3, p.y * 1.08 - 0.7, WALL + 0.1);
    }
    scene.updateMatrixWorld();
  }

  function startTrip(i) {
    const list = view.trips;
    tripIndex = i;
    tripClock = 0;
    if (i === 0) saluto.visible = false;
    const t = list[i];
    if (!t) return;
    curve = curveFor(t.from, t.to, fxLevel.tube > 0 || fxWant.tube > 0);
    setRoute(curve);
    for (const [k, b] of Object.entries(bodies)) b.visible = k === t.kind;
    const mat = bodyMat[t.kind];
    if (mat.attenuationColor) mat.attenuationColor.set(t.red ? RED : TECH[t.tint || "http"].color);
    cookie.visible = !!t.cookie;
    packetTag.say(t.label, t.red);
    tripFocus = t.focus || null;
    if (t.promise) promiseTag.say(`Promise: ${t.promise}`, t.promise === "rejected");
    packet.visible = true;
    if (t.sheets) {
      t.sheets.forEach((text, n) => {
        sheets[n].text.draw((g) => {
          g.font = `600 .15px ${MONO}`;
          text.split("\n").forEach((line, li, all) => g.fillText(line, 0.15, 0.37 + (li - (all.length - 1) / 2) * 0.21, 3.5));
        });
      });
    }
    if (view.phase && view.phase.id === "memoria") jar.visible = i > 0 && view.broken !== "nocookie";
  }

  function tripLength(t) { return (t.dur || 2.6) + (t.hold || 0); }

  function updateTrips(dt) {
    const list = view.trips;
    if (!list.length) {
      packet.visible = false;
      routeLine.visible = false;
      sheetGroup.visible = false;
      return;
    }
    if (tripDelay > 0) { tripDelay -= dt; packet.visible = false; routeLine.visible = false; return; }
    if (tripIndex < 0) startTrip(0);
    tripClock += dt;
    if (list[tripIndex].sets && tripClock > (list[tripIndex].dur || 2.6) && !saluto.visible) {
      saluto.say(list[tripIndex].sets);
      saluto.visible = true;
    }
    let t = list[tripIndex];
    if (tripClock > tripLength(t) + 0.45) {
      startTrip((tripIndex + 1) % list.length);
      t = list[tripIndex];
    }
    const dur = t.dur || 2.6;
    let e;
    let open = 0;
    if (t.sheets) {
      // Stops halfway, opens, closes, goes on.
      const leg = dur / 2;
      if (tripClock < leg) e = smooth(tripClock / leg) * 0.5;
      else if (tripClock < leg + t.hold) { e = 0.5; open = 1; }
      else e = 0.5 + smooth(clamp01((tripClock - leg - t.hold) / leg)) * 0.5;
    } else {
      e = smooth(clamp01(tripClock / dur));
    }
    placePacket(e, open, dt, t);
  }

  function placePacket(e, open, dt, t) {
    packet.position.copy(curve.getPoint(e));
    packet.rotation.set(Math.sin(clock * 1.1) * 0.07, Math.sin(clock * 0.7) * 0.18, Math.sin(clock * 1.4) * 0.05);
    packetTag.quaternion.copy(packet.quaternion).invert().multiply(camera.quaternion);
    sheetK += ((open ? 1 : 0) - sheetK) * Math.min(1, dt * 4.5);
    sheetGroup.visible = !!t.sheets && sheetK > 0.02;
    if (sheetGroup.visible) {
      sheetGroup.position.copy(packet.position);
      sheetGroup.quaternion.copy(camera.quaternion);
      sheets.forEach((s, i) => {
        s.position.set(0, (1 - i) * 0.92 * sheetK - 1.15 * sheetK, 0.4);
        s.scale.setScalar(Math.max(0.01, sheetK));
      });
      bodies.env.visible = sheetK < 0.5;
      packetTag.visible = sheetK < 0.5;
    } else {
      packetTag.visible = true;
      bodies.env.visible = t.kind === "env";
    }
  }

  function applyFx(dt) {
    for (const k of Object.keys(fxLevel)) {
      const rate = reduced ? 1 : Math.min(1, dt * 2.6);
      fxLevel[k] += (fxWant[k] - fxLevel[k]) * rate;
    }
    const url = smooth(clamp01(fxLevel.url));
    urlGroup.visible = dnsGroup.visible = url > 0.02;
    urlGroup.scale.setScalar(Math.max(0.01, url));
    dnsGroup.scale.setScalar(Math.max(0.01, url));
    tubeGroup.visible = fxLevel.tube > 0.02;
    if (tubeMesh) tubeMesh.scale.setScalar(1);

    const ev = clamp01(fxLevel.evaporate);
    code.visible = stays.visible = ev > 0.05;
    code.material.opacity = stays.material.opacity = ev;
    const broken = view.broken === "500";
    output.visible = ev > 0.05 && !broken;
    if (output.visible) {
      // <h1> comes out of PHP towards Apache; the code never moves.
      const c = (clock % 5) / 5;
      const a = slabs.php.localToWorld(v(-0.4, 0, 1.3));
      const b = slabs.apache.localToWorld(v(-2.6, 0.3, 1.1));
      const k = smooth(clamp01(c / 0.8));
      output.position.lerpVectors(a, b, k);
      output.quaternion.copy(camera.quaternion);
      output.material.opacity = ev * Math.min(1, c * 8) * (1 - smooth(clamp01((c - 0.86) / 0.14)));
    }

    const d = smooth(clamp01(fxLevel.dom));
    tree.visible = d > 0.02;
    if (tree.visible) {
      tree.position.set(-1.1, 0, 1.2);
      tree.scale.setScalar(Math.max(0.01, d * 0.88));
      const noForm = view.broken === "ordine";
      for (const n of ["form", "input", "input ", "button"]) {
        treeNodes[n].visible = !noForm;
        treeEdges[n].visible = !noForm;
      }
      for (const [name, n] of Object.entries(treeNodes)) n.userData.mat.emissiveIntensity = 0;
      const path = noForm ? ["body", "html"] : ["button", "form", "body", "html"];
      const c = (clock % 5) / 5;
      const seg = Math.min(path.length - 2, Math.floor(c * (path.length - 1)));
      const k = smooth(c * (path.length - 1) - seg);
      bubble.position.lerpVectors(treeNodes[path[seg]].position, treeNodes[path[seg + 1]].position, k);
      bubble.position.z = 0.22;
      bubbleTag.quaternion.copy(camera.quaternion);
      treeNodes[path[seg]].userData.mat.emissiveIntensity = 0.45 * (1 - k);
      treeNodes[path[seg + 1]].userData.mat.emissiveIntensity = 0.45 * k;
    }
    promiseTag.visible = !!(view.phase && view.phase.fx.includes("promise")) && view.trips.some((t) => t.promise);
    promiseTag.quaternion.copy(camera.quaternion);
  }

  function applyFocus() {
    const on = userFocus || tripFocus;
    for (const [id, mats] of Object.entries(targets)) {
      if (id === "dom" && view.phase && !on) continue; // the tree animates its own nodes
      const level = id === on ? 0.3 + 0.2 * Math.sin(clock * 3.2) : 0;
      for (const m of mats) m.emissiveIntensity = level;
    }
  }

  /* ---------- loop ---------- */

  let clock = 0;
  let last = 0;
  let seaTick = 0;
  let slowFor = 0;
  let degraded = false;
  let inView = true;
  let lastDraw = 0;

  function degrade() {
    degraded = true;
    for (const m of allGlass) {
      m.transmission = 0;
      m.transparent = true;
      m.opacity = 0.6;
      if (m.attenuationColor) m.color.copy(m.attenuationColor);
      m.needsUpdate = true;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    if (!inView || document.hidden) { last = now; return; }
    if (preview && now - lastDraw < 66) return;
    if (reduced && !dirty) return;
    lastDraw = now;
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016);
    if (!degraded && !hq && !preview && !reduced) {
      slowFor = dt > 0.04 ? slowFor + dt : 0;
      if (slowFor > 2) degrade();
    }
    last = now;
    if (!reduced) clock += dt;
    step(reduced ? 1 : dt, now);
    renderer.render(scene, camera);
    dirty = false;
  }

  function step(dt, now) {
    const k = reduced ? 1 : clamp01((now - railStart) / (MOVE * 1000));
    railU = railFrom + (railTo - railFrom) * io(k);
    const last8 = phases.length;
    camera.position.copy(railPos.getPoint(railU / last8));
    const look = railLook.getPoint(railU / last8);
    camera.position.x += Math.sin(clock * 0.2) * 0.1;
    camera.position.y += Math.cos(clock * 0.17) * 0.06;
    camera.lookAt(look);

    const rate = reduced ? 1 : Math.min(1, dt * 2.2);
    openClient += (wantClient - openClient) * rate;
    openServer += (wantServer - openServer) * rate;
    placeStacks();
    client.rotation.y = 0.34 + Math.sin(clock * 0.42) * 0.025;
    server.rotation.y = -0.42 + Math.sin(clock * 0.36 + 1) * 0.025;
    for (const s of urlGroup.children) s.position.y = s.userData.home + Math.sin(clock + s.position.x) * 0.04;

    if ((seaTick++ % (degraded ? 4 : preview ? 1 : 2)) === 0) drawSea(reduced ? 2 : clock);

    updateTrips(reduced ? 0.016 : dt);
    if (reduced && curve && view.trips[tripIndex]) placePacket(0.5, 0, 1, view.trips[tripIndex]);
    applyFx(dt);
    applyFocus();
  }

  new IntersectionObserver(([e]) => { inView = e.isIntersecting; }).observe(canvas);
  new ResizeObserver(resize).observe(canvas);
  canvas.addEventListener("click", (e) => {
    const r = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
    const hit = ray.intersectObjects(pickable.filter((m) => { let o = m; while (o) { if (!o.visible) return false; o = o.parent; } return true; }))[0];
    if (hit && onPick) onPick(hit.object.userData.pick);
  });

  drawWindow(new Set());
  drawSea(0);
  placeStacks();
  buildTube();
  resize();
  railPos.getPoint(0);
  requestAnimationFrame(frame);

  return {
    resize,
    // Index 8 is the pull-back onto the whole window, with no phase.
    show(index, phase, trips, broken) {
      const now = performance.now();
      if (railStart < 0) {
        railFrom = railTo = railU = index;
        railStart = now - MOVE * 1000;
      } else if (index !== view.index) {
        railFrom = railU;
        railTo = index;
        railStart = now;
      }
      const moved = index !== view.index;
      view = { phase, index, trips: trips || [], broken: broken || null };
      for (const k of Object.keys(fxWant)) fxWant[k] = phase && phase.fx.includes(k) ? 1 : 0;
      if (broken === "http") fxWant.tube = 0;
      wantClient = phase ? phase.open.client : 0;
      wantServer = phase ? phase.open.server : 0;
      tripIndex = -1;
      tripClock = 0;
      tripFocus = null;
      userFocus = null;
      jar.visible = false;
      saluto.visible = false;
      curve = null;
      tripDelay = reduced ? 0 : moved ? MOVE * 0.75 : 0.25;
      packet.visible = false;
      routeLine.visible = false;
      if (reduced && view.trips.length) { placeStacks(); startTrip(0); }
      bubbleTag.say("submit");
      seaName.visible = true;
      dirty = true;
    },
    setLit(indexes) { drawWindow(new Set(indexes)); dirty = true; },
    // Canvas text painted before a web font arrives stays in the fallback until repainted.
    refreshText() {
      for (const m of labels) if (m.lastDraw) m.draw(m.lastDraw);
      drawWindow(litNow);
      dirty = true;
    },
    setFocus(id) { userFocus = id; dirty = true; },
    setUser(name) { formUser = name; formLabel.draw(drawForm); dirty = true; },
    setInset(x, y) {
      if (insets.x === x && insets.y === y) return;
      insets.x = x;
      insets.y = y;
      resize();
    },
  };
}
