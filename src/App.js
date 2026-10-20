import React, { Suspense, lazy } from "react";
// HashRouter: GitHub Pages has no SPA fallback, so BrowserRouter deep links break
import { HashRouter as Router, Routes, Route, Link } from "react-router-dom";
import { FaGithub, FaProjectDiagram, FaEnvelope, FaBook } from "react-icons/fa";
// three.js is ~1 MB: load it only when /graph3d is opened
const Graph3D = lazy(() => import("./Graph3D"));
const NotePage = lazy(() => import("./NotePage"));

const design = (name) => `${process.env.PUBLIC_URL}/designs/${name}/index.html`;

// Live preview of a standalone design; inert so clicks reach the tile link
function Preview({ name }) {
  return (
    <iframe
      className="bento-preview"
      src={`${design(name)}?preview`}
      title={name}
      loading="lazy"
      scrolling="no"
      tabIndex={-1}
      aria-hidden="true"
    />
  );
}

// [col, row, route, label, preview]; external routes are plain links
const tiles = [
  [0, 0, "/wind", "Mediterranean Drift", <Preview name="wind" />],
  [1, 0, "/contact", "Contatti", <FaEnvelope className="bento-icon" />],
  [2, 0, "/sphere", "Sphere Marquee", <Preview name="sphere" />],
  [0, 1, "/resources", "Resources", <FaBook className="bento-icon" />],
  [2, 1, "/graph3d", "3D Graph", <FaProjectDiagram className="bento-icon" />],
  [0, 2, "/baroque", "Barocco", <Preview name="baroque" />],
  [1, 2, "https://github.com/burlibu/burlibu.github.io", "GitHub", <FaGithub className="bento-icon" />],
  [2, 2, "/valhalla", "Valhalla", <Preview name="valhalla" />],
];

// [route, label, preview]; overflow tiles once the 3x3 bento is full, shown below it
const more = [
  ["/futuro", "Futuro", <Preview name="futuro" />],
  ["/stagger", "Stagger", <Preview name="stagger" />],
  ["/osservatorio", "Osservatorio", <Preview name="osservatorio" />],
  ["/caramelle", "Caramelle", <Preview name="caramelle" />],
  ["/deco", "Art Deco", <Preview name="deco" />],
  ["/kinetic", "Kinetic", <Preview name="kinetic" />],
  ["/buconero", "Orizzonte degli eventi", <Preview name="buconero" />],
  ["/manga", "Manga", <Preview name="manga" />],
  ["/circuito", "Circuito", <Preview name="circuito" />],
];

function Tile({ to, label, preview, ...props }) {
  const inner = (
    <>
      {preview}
      <span className="bento-label">{label}</span>
    </>
  );
  if (!to)
    return (
      <div {...props} className="bento-item is-empty" tabIndex={0}>
        {inner}
      </div>
    );
  if (to.startsWith("http"))
    return (
      <a {...props} className="bento-item" href={to} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  return (
    <Link {...props} className="bento-item" to={to}>
      {inner}
    </Link>
  );
}

function Home() {
  return (
    <main className="bento-page">
      <div className="bento">
        {tiles.map(([col, row, to, label, preview]) => (
          <Tile key={`${col}${row}`} data-col={col} data-row={row} to={to} label={label} preview={preview} />
        ))}
        <div className="bento-item center-piece" data-col="1" data-row="1" tabIndex={0}>
          <h1>Burlibu</h1>
          <p>Una collezione di esperimenti di design. Scegli una tessera.</p>
        </div>
      </div>
      <p className="more-hint">Scorri per altri design ↓</p>
      <div className="bento-more">
        {more.map(([to, label, preview], i) => (
          <Tile key={i} to={to} label={label} preview={preview} />
        ))}
      </div>
    </main>
  );
}

function Back() {
  return (
    <Link to="/" className="back-link">
      ← Bento
    </Link>
  );
}

// Full-screen standalone design from public/designs
function DesignFrame({ name, title }) {
  return (
    <>
      <Back />
      <iframe className="design-frame" src={design(name)} title={title} />
    </>
  );
}

function Panel({ title, children }) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 p-8">
      <Back />
      <div className="max-w-2xl mx-auto mt-16 bg-neutral-900 border border-neutral-800 p-8 rounded-xl">
        <h1 className="text-3xl font-bold mb-4">{title}</h1>
        {children}
      </div>
    </main>
  );
}

function Contact() {
  return (
    <Panel title="Contatti">
      <p>
        Puoi contattarmi via email:{" "}
        <a className="text-sky-400 underline" href="mailto:burlibu@email.com">
          burlibu@email.com
        </a>
      </p>
    </Panel>
  );
}

const resources = [
  ["React Docs", "https://react.dev/"],
  ["Tailwind CSS Docs", "https://tailwindcss.com/docs"],
  ["Repository GitHub", "https://github.com/burlibu/burlibu.github.io"],
];

function Resources() {
  return (
    <Panel title="Resources">
      <p>Qui troverai link utili, documentazione e risorse consigliate.</p>
      <ul className="list-disc ml-6 mt-4">
        {resources.map(([label, href]) => (
          <li key={href}>
            <a className="text-sky-400 underline" href={href} target="_blank" rel="noopener noreferrer">
              {label}
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wind" element={<DesignFrame name="wind" title="Mediterranean Drift" />} />
        <Route path="/sphere" element={<DesignFrame name="sphere" title="Sphere Marquee" />} />
        <Route path="/baroque" element={<DesignFrame name="baroque" title="Barocco" />} />
        <Route path="/valhalla" element={<DesignFrame name="valhalla" title="Valhalla" />} />
        <Route path="/futuro" element={<DesignFrame name="futuro" title="Futuro" />} />
        <Route path="/stagger" element={<DesignFrame name="stagger" title="Stagger" />} />
        <Route path="/osservatorio" element={<DesignFrame name="osservatorio" title="Osservatorio" />} />
        <Route path="/caramelle" element={<DesignFrame name="caramelle" title="Caramelle" />} />
        <Route path="/deco" element={<DesignFrame name="deco" title="Art Deco" />} />
        <Route path="/kinetic" element={<DesignFrame name="kinetic" title="Kinetic Interface" />} />
        <Route path="/buconero" element={<DesignFrame name="buconero" title="Orizzonte degli eventi" />} />
        <Route path="/manga" element={<DesignFrame name="manga" title="Manga" />} />
        <Route path="/circuito" element={<DesignFrame name="circuito" title="Circuito" />} />
        <Route path="/contact"element={<Contact />} />
        <Route path="/resources" element={<Resources />} />
        <Route
          path="/graph3d"
          element={
            <>
              <Suspense fallback={<div className="kb" />}>
                <Graph3D />
              </Suspense>
              <Back />
            </>
          }
        />
        <Route
          path="/graph3d/nodo/:slug"
          element={
            <>
              <Suspense fallback={<div className="kb-page" />}>
                <NotePage />
              </Suspense>
              <Back />
            </>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
