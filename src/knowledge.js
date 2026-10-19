// Dummy knowledge base behind /graph3d: one hub note per area (Obsidian-style
// "map of content"), 13 notes under each, plus an index and an experiments note.
// Links and text come from a seeded RNG, so every slug always opens the same page.

const AREAS = [
  ["Animazione", ["Easing", "Stagger", "Tweening", "Keyframe", "Interpolazione lineare", "Curve di Bézier", "Fisica a molla", "Motion blur", "Timeline", "Morphing", "Parallasse", "Animazioni da scroll", "requestAnimationFrame"]],
  ["Grafica 3D", ["Proiezione prospettica", "Proiezione ortografica", "Quaternioni", "Matrice di vista", "Shader GLSL", "Vertex shader", "Fragment shader", "Raycasting", "Instancing", "Bloom", "Occlusione ambientale", "Normal map", "Scene graph"]],
  ["Matematica", ["Seno e coseno", "Rumore di Perlin", "Interpolazione sferica", "Distanza geodetica", "Coordinate polari", "Vettori", "Prodotto scalare", "Trasformata di Fourier", "Frattali", "Sezione aurea", "Teoria dei grafi", "Layout force-directed", "Numeri pseudocasuali"]],
  ["Tipografia", ["Kerning", "Interlinea", "Font variabili", "Graziato", "Lineare", "Monospaziato", "Gerarchia tipografica", "Lettering", "Glifi", "Legature", "Tracking", "Griglia di base", "Leggibilità"]],
  ["Storia dell'arte", ["Art Déco", "Art Nouveau", "Barocco", "Bauhaus", "Costruttivismo", "Futurismo", "Minimalismo", "Pop art", "Brutalismo", "Arte cinetica", "Op art", "Rinascimento", "Arte generativa"]],
  ["Web", ["HTML semantico", "CSS Grid", "Flexbox", "Custom properties", "Container queries", "Canvas 2D", "WebGL", "SVG", "Service worker", "Accessibilità", "Responsive design", "Compositing", "Layout thrashing"]],
  ["Colore", ["Teoria del colore", "Palette", "HSL", "OKLCH", "Contrasto cromatico", "Gradienti", "Complementari", "Saturazione", "Luminanza", "Modalità scura", "Color grading", "Dithering", "Spazio colore"]],
];

export const AREA_COLORS = ["#8fe9ff", "#a7ffe0", "#ffffff", "#d7c6ff", "#ffd59a", "#7fb8ff", "#ff8a8a"];

export const slugify = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const OPENERS = [
  (t, a) => `${t} è uno dei concetti che tornano più spesso nell'area ${a}.`,
  (t, a) => `Questa nota raccoglie appunti su ${t}, nel contesto più ampio di ${a}.`,
  (t, a) => `${t}: una voce dell'archivio ${a}, scritta come promemoria per i prossimi esperimenti.`,
];
const MIDDLES = [
  "L'idea di fondo è semplice, ma i dettagli fanno la differenza quando la si porta in un design reale.",
  "Conviene partire da un esempio minimo, misurarlo, e solo dopo aggiungere complessità.",
  "Spesso il risultato migliore nasce dal vincolo: meno parametri, scelti con cura.",
  "Il rischio tipico è esagerare: l'effetto deve servire la lettura, non coprirla.",
  "Funziona bene insieme ad altre tecniche, soprattutto quando condividono lo stesso ritmo.",
  "Vale la pena tenere a portata di mano un piccolo banco di prova per confrontare le varianti.",
  "Le prestazioni contano: quello che sembra leggero su desktop può pesare su un telefono.",
];
const CLOSERS = [
  "Da approfondire con un prototipo dedicato.",
  "Appunti in evoluzione: questa nota verrà estesa.",
  "Vedi i collegamenti qui sotto per il contesto.",
];

function build() {
  const rand = rng(1907);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  // k distinct items, so a note never repeats the same sentence
  const pickN = (arr, k) => {
    const pool = [...arr];
    return Array.from({ length: k }, () => pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  };
  const notes = [];
  const add = (title, area, kind) => {
    const n = { id: notes.length, slug: slugify(title), title, area, kind, links: new Set() };
    notes.push(n);
    return n;
  };

  const index = add("Indice", -1, "index");
  const hubs = AREAS.map(([name], a) => add(name, a, "hub"));
  const items = AREAS.flatMap(([, titles], a) => titles.map((t) => add(t, a, "note")));
  const lab = add("Esperimenti", -1, "hub");

  const link = (a, b) => {
    if (a !== b) a.links.add(b.id);
  };
  hubs.forEach((h) => link(index, h));
  link(index, lab);
  for (const n of items) {
    link(hubs[n.area], n);
    const extra = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < extra; i++) {
      const same = rand() < 0.7;
      const pool = same ? items.filter((m) => m.area === n.area) : items;
      link(n, pick(pool));
    }
  }
  // the site's own designs as a cross-area hub
  for (const t of ["Art Déco", "Barocco", "Easing", "Stagger", "Proiezione ortografica", "Rumore di Perlin", "Canvas 2D", "WebGL", "Shader GLSL", "Layout force-directed", "Palette", "Futurismo"])
    link(lab, notes.find((n) => n.title === t));

  for (const n of notes) {
    const areaName = n.area >= 0 ? AREAS[n.area][0] : "Archivio";
    const paras = [];
    if (n.kind === "note") {
      const [m1, m2, m3] = pickN(MIDDLES, 3);
      paras.push(`${pick(OPENERS)(n.title, areaName)} ${m1}`);
      paras.push(`${m2} ${m3}`);
      paras.push(pick(CLOSERS));
    } else if (n.kind === "hub") {
      paras.push(`Mappa dei contenuti per ${n.title}: da qui partono tutte le note collegate di quest'area.`);
      paras.push(pick(MIDDLES));
    } else {
      paras.push("Punto di ingresso dell'archivio. Ogni area ha una propria mappa dei contenuti; il grafo mostra come le note si richiamano a vicenda.");
    }
    n.body = paras;
    n.links = [...n.links];
  }
  for (const n of notes) n.backlinks = notes.filter((m) => m.links.includes(n.id)).map((m) => m.id);
  return notes;
}

export const NOTES = build();
export const AREA_NAMES = AREAS.map(([name]) => name);
export const LINKS = NOTES.flatMap((n) => n.links.map((t) => [n.id, t]));
export const bySlug = (slug) => NOTES.find((n) => n.slug === slug);
