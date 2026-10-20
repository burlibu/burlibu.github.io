import React, { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Link } from "react-router-dom";
import { SECTIONS } from "./resourcesData";
import "./resources.css";

// Plotter pens: every card takes the next pen and the next frame style, so neighbours
// never match but the whole sheet is drawn with the same set.
export const PENS = ["#1f3a93", "#c8102e", "#0f7c7a", "#b7791f", "#6b3fa0", "#2f7d32", "#b0306a", "#1976d2", "#d9541e", "#2b2f33"];
const STYLES = 8;
const TYPES = ["Tutto", "Doc", "Corso", "Tip", "Snippet", "Tool", "Ispirazione", "Asset"];
const host = (url) => new URL(url).hostname.replace(/^www\./, "");
const favicon = (url) => `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`;

// Technical sketches, one per section; strokes use currentColor
export function Glyph({ name, className }) {
  const g = {
    golden: (
      <>
        <rect x="4" y="12" width="92" height="57" />
        <line x1="61" y1="12" x2="61" y2="69" />
        <line x1="61" y1="47" x2="96" y2="47" />
        <line x1="74" y1="47" x2="74" y2="69" />
        <path d="M61 69 A57 57 0 0 1 4 12 M61 12 A35 35 0 0 1 96 47 M96 47 A22 22 0 0 1 74 69" />
      </>
    ),
    tags: (
      <>
        <path d="M30 22 L8 40 L30 58 M70 22 L92 40 L70 58 M58 14 L42 66" />
        <circle cx="50" cy="40" r="34" strokeDasharray="3 4" />
      </>
    ),
    box: (
      <>
        <rect x="6" y="8" width="88" height="64" strokeDasharray="5 3" />
        <rect x="18" y="18" width="64" height="44" />
        <rect x="30" y="28" width="40" height="24" />
        <path d="M6 4 H94 M6 1 V7 M94 1 V7" />
      </>
    ),
    braces: (
      <>
        <path d="M30 10 C18 10 22 36 12 40 C22 44 18 70 30 70 M70 10 C82 10 78 36 88 40 C78 44 82 70 70 70" />
        <circle cx="40" cy="40" r="3" />
        <circle cx="50" cy="40" r="3" />
        <circle cx="60" cy="40" r="3" />
      </>
    ),
    curve: (
      <>
        <path d="M6 72 H94 M6 72 V6" />
        <path d="M6 72 C40 72 30 8 94 8" />
        <path d="M6 72 L40 72 M94 8 L30 8" strokeDasharray="2 3" />
        <circle cx="40" cy="72" r="3" />
        <circle cx="30" cy="8" r="3" />
      </>
    ),
    cube: (
      <>
        <path d="M50 6 L88 26 L88 62 L50 78 L12 62 L12 26 Z M12 26 L50 44 L88 26 M50 44 V78" />
        <path d="M50 6 L50 44 M12 62 L50 44" strokeDasharray="3 3" />
      </>
    ),
    gear: (
      <>
        <circle cx="50" cy="40" r="14" />
        <path d="M50 8 V18 M50 62 V72 M18 40 H28 M72 40 H82 M27 17 L34 24 M66 56 L73 63 M27 63 L34 56 M66 24 L73 17" />
        <circle cx="50" cy="40" r="26" strokeDasharray="4 3" />
      </>
    ),
  }[name];
  return (
    <svg className={className} viewBox="0 0 100 80" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      {g}
    </svg>
  );
}

function Card({ item, code, pen, style, glyph, delay }) {
  const [title, url, type, desc] = item;
  // a fixed "measurement" per card for the dimension-line style
  const mm = 40 + ((code.charCodeAt(0) * 7 + code.length * 13 + title.length * 5) % 80);
  return (
    <a
      className={`rs-card rs-v${style}`}
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ "--pen": pen, "--d": `${delay}ms`, viewTransitionName: `rs-${code.replace(/\W/g, "")}` }}
    >
      {style === 4 && <span className="rs-dim" data-mm={`${mm} mm`} aria-hidden="true" />}
      {style === 6 && <span className="rs-tab">{type}</span>}
      <Glyph name={glyph} className="rs-card-glyph" />
      <div className="rs-card-head">
        <span className="rs-mark">
          <img src={favicon(url)} alt="" loading="lazy" width="20" height="20" />
        </span>
        <span className="rs-code">{code}</span>
        <span className="rs-arrow" aria-hidden="true">↗</span>
      </div>
      <h3>{title}</h3>
      <p>{desc}</p>
      <div className="rs-card-foot">
        <span className="rs-type">{type}</span>
        <span className="rs-host">{host(url)}</span>
      </div>
    </a>
  );
}

// Reveal each card as it scrolls into view
function useReveal(ref, deps) {
  useEffect(() => {
    const els = ref.current.querySelectorAll(".rs-card:not(.is-in)");
    if (!("IntersectionObserver" in window)) return els.forEach((el) => el.classList.add("is-in"));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export default function Resources() {
  const [type, setType] = useState("Tutto");
  const [query, setQuery] = useState("");
  const sheet = useRef(null);
  const tools = useRef(null);

  const total = SECTIONS.reduce((n, s) => n + s.items.length, 0);
  const sections = useMemo(() => {
    let i = 0;
    const q = query.trim().toLowerCase();
    return SECTIONS.map((s) => ({
      ...s,
      cards: s.items
        .map((item, k) => ({ item, code: `${s.id}·${String(k + 1).padStart(2, "0")}`, n: i++ }))
        .filter(({ item: [title, url, t, desc] }) => (type === "Tutto" || t === type) && (!q || `${title} ${desc} ${url}`.toLowerCase().includes(q))),
    })).filter((s) => s.cards.length);
  }, [type, query]);
  const shown = sections.reduce((n, s) => n + s.cards.length, 0);

  useReveal(sheet, [sections]);

  // drafting tools drift with the scroll: one transform on their layer
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => tools.current?.style.setProperty("transform", `translateY(${window.scrollY * -0.25}px)`));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // filter changes morph the grid with the View Transitions API where available
  const pick = (t) => {
    if (!document.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) return setType(t);
    document.startViewTransition(() => flushSync(() => setType(t)));
  };

  return (
    <div className="rs-desk">
      <Link to="/" className="back-link">
        ← Bento
      </Link>

      <div className="rs-tools" ref={tools} aria-hidden="true">
        <svg className="rs-tool rs-compass" viewBox="0 0 100 140" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="50" cy="16" r="9" />
          <path d="M45 24 L20 132 M55 24 L80 132 M30 88 H70" />
          <path d="M20 132 l-3 6 M80 132 l2 6" />
        </svg>
        <svg className="rs-tool rs-protractor" viewBox="0 0 200 110" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M10 100 A90 90 0 0 1 190 100 Z M50 100 A50 50 0 0 1 150 100" />
          {Array.from({ length: 19 }, (_, i) => {
            const a = Math.PI - (i * Math.PI) / 18;
            const r1 = i % 3 ? 82 : 74;
            return <line key={i} x1={100 + Math.cos(a) * 90} y1={100 - Math.sin(a) * 90} x2={100 + Math.cos(a) * r1} y2={100 - Math.sin(a) * r1} />;
          })}
        </svg>
        <svg className="rs-tool rs-square" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 114 L6 6 L114 114 Z M24 96 L24 50 L70 96 Z" />
        </svg>
        <svg className="rs-tool rs-gear" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="50" cy="50" r="12" />
          <path d="M50 8 l6 12 h-12z M50 92 l6 -12 h-12z M8 50 l12 6 v-12z M92 50 l-12 6 v-12z M20 20 l13 4 l-9 9z M80 80 l-13 -4 l9 -9z M80 20 l-4 13 l-9 -9z M20 80 l4 -13 l9 9z" />
          <circle cx="50" cy="50" r="30" />
        </svg>
      </div>

      <main className="rs-sheet">
        <div className="rs-zones rs-zones--top" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <span key={i}>{i + 1}</span>)}
        </div>
        <div className="rs-zones rs-zones--bottom" aria-hidden="true">
          {Array.from({ length: 8 }, (_, i) => <span key={i}>{i + 1}</span>)}
        </div>
        <div className="rs-zones rs-zones--left" aria-hidden="true">
          {SECTIONS.map((s) => <span key={s.id}>{s.id}</span>)}
        </div>
        <div className="rs-zones rs-zones--right" aria-hidden="true">
          {SECTIONS.map((s) => <span key={s.id}>{s.id}</span>)}
        </div>

        <div className="rs-drawing" ref={sheet}>
          <header className="rs-head">
            <div className="rs-plotter" aria-hidden="true">
              <span className="rs-rail" />
              <span className="rs-trace" />
              <span className="rs-head-pen" />
            </div>
            <div>
              <p className="rs-kicker">Tavola R-01 · cassetta degli attrezzi</p>
              <h1>
                Risorse per fare
                <br />
                <em>siti</em> e <em>design</em> web
              </h1>
            </div>
            <div className="rs-intro">
              <p>
                Documentazione, corsi, trucchi, snippet e strumenti: le migliori risorse su web design, HTML, CSS, JavaScript,
                Anime.js e Three.js, raccolte in una tavola sola. Ogni riquadro apre il sito in una nuova scheda.
              </p>
              <div className="rs-gears" aria-hidden="true">
                <Glyph name="gear" className="rs-gear-a" />
                <Glyph name="gear" className="rs-gear-b" />
              </div>
            </div>
          </header>

          <div className="rs-controls">
            <div className="rs-toggle" role="group" aria-label="Tipo di risorsa">
              {TYPES.map((t) => (
                <button key={t} type="button" aria-pressed={type === t} onClick={() => pick(t)}>
                  {t}
                </button>
              ))}
            </div>
            <label className="rs-search">
              <span>Cerca</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="es. shader, grid, easing" />
            </label>
            <span className="rs-count">
              {shown} / {total}
            </span>
          </div>

          <nav className="rs-index" aria-label="Sezioni">
            {SECTIONS.map((s) => (
              <a key={s.id} href={`#sez-${s.id}`} onClick={(e) => {
                e.preventDefault();
                document.getElementById(`sez-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>
                <b>{s.id}</b>
                {s.name}
              </a>
            ))}
          </nav>

          {sections.map((s) => (
            <section key={s.id} className="rs-section" id={`sez-${s.id}`} aria-labelledby={`h-${s.id}`}>
              <div className="rs-caption">
                <span className="rs-view">{s.id}</span>
                <h2 id={`h-${s.id}`}>{s.name}</h2>
                <span className="rs-measure" aria-hidden="true" />
                <span className="rs-note">
                  {s.note} · {s.cards.length}
                </span>
              </div>
              <div className="rs-grid">
                {s.cards.map(({ item, code, n }, k) => (
                  <Card key={code} item={item} code={code} pen={PENS[(n * 3) % PENS.length]} style={(n * 5 + 1) % STYLES} glyph={s.glyph} delay={(k % 4) * 70} />
                ))}
              </div>
            </section>
          ))}
          {!shown && <p className="rs-empty">Nessuna risorsa corrisponde. Prova un altro filtro.</p>}

          <footer className="rs-title-block">
            <div className="rs-tb rs-tb--wide"><span>Progetto</span><b>Burlibu · burlibu.github.io</b></div>
            <div className="rs-tb"><span>Tavola n.</span><b>R-01</b></div>
            <div className="rs-tb rs-tb--wide rs-tb--title"><span>Titolo</span><b>Risorse per il web design</b></div>
            <div className="rs-tb"><span>Revisione</span><b>C</b></div>
            <div className="rs-tb"><span>Voci</span><b>{total}</b></div>
            <div className="rs-tb"><span>Sezioni</span><b>{SECTIONS.length}</b></div>
            <div className="rs-tb"><span>Scala</span><b>1 : 1</b></div>
            <div className="rs-tb"><span>Foglio</span><b>1 / 1</b></div>
          </footer>
        </div>
      </main>
    </div>
  );
}
