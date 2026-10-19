import React from "react";
import { Link, useParams } from "react-router-dom";
import { NOTES, AREA_NAMES, AREA_COLORS, bySlug } from "./knowledge";

// One note of the /graph3d knowledge base, in the same luminous style as the graph
const areaOf = (n) => (n.area >= 0 ? AREA_NAMES[n.area] : "Archivio");

function NoteList({ title, ids }) {
  if (!ids.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      <ul className="kb-links">
        {ids.map((id) => {
          const n = NOTES[id];
          return (
            <li key={id}>
              <Link to={`/graph3d/nodo/${n.slug}`}>
                <i style={{ background: n.area >= 0 ? AREA_COLORS[n.area] : "#fff" }} />
                {n.title}
                <small>{areaOf(n)}</small>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function NotePage() {
  const { slug } = useParams();
  const note = bySlug(slug);

  return (
    <main className="kb-page">
      <div className="kb-dust" aria-hidden="true" />
      <nav className="kb-crumbs">
        <Link to="/graph3d">← Grafo</Link>
        {note && (
          <>
            <span>/</span>
            <span>{areaOf(note)}</span>
          </>
        )}
      </nav>
      {note ? (
        <article className="kb-note">
          <p className="kb-kicker" style={{ "--tint": note.area >= 0 ? AREA_COLORS[note.area] : "#fff" }}>
            {note.kind === "note" ? "Nodo" : "Mappa"} #{String(note.id).padStart(3, "0")} · {areaOf(note)}
          </p>
          <h1>{note.title}</h1>
          <div className="kb-sync" aria-hidden="true">
            <span>Sincronizzazione</span>
            <b style={{ width: `${60 + ((note.id * 37) % 41)}%` }} />
          </div>
          {note.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <NoteList title="Collegamenti" ids={note.links} />
          <NoteList title="Citato da" ids={note.backlinks} />
        </article>
      ) : (
        <article className="kb-note">
          <h1>Nodo non trovato</h1>
          <p>
            Questo frammento non esiste nell'archivio. <Link to="/graph3d">Torna al grafo</Link>.
          </p>
        </article>
      )}
    </main>
  );
}
