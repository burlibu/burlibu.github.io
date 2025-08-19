import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHouse } from "@awesome.me/kit-KIT_CODE/icons/classic/solid";
import Graph3D from "./Graph3D";

function Home() {
  return (
    <main className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow mt-8">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        <FontAwesomeIcon icon={faHouse} className="text-brown-600" />
        Benvenuto nel sito di Burlibu!
      </h1>
      <p>
        Questo è il sito personale di Burlibu. Scopri chi sono e come
        contattarmi.
      </p>
    </main>
  );
}
function Contact() {
  return (
    <main className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow mt-8">
      <h1 className="text-3xl font-bold mb-4">Contatti</h1>
      <p>
        Puoi contattarmi via email:{" "}
        <a className="text-blue-600 underline" href="mailto:burlibu@email.com">
          burlibu@email.com
        </a>
      </p>
    </main>
  );
}

function Resources() {
  return (
    <main className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow mt-8">
      <h1 className="text-3xl font-bold mb-4">Resources</h1>
      <p>Qui troverai link utili, documentazione e risorse consigliate.</p>
      <ul className="list-disc ml-6 mt-4">
        <li>
          <a
            className="text-blue-600 underline"
            href="https://react.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            React Docs
          </a>
        </li>
        <li>
          <a
            className="text-blue-600 underline"
            href="https://tailwindcss.com/docs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Tailwind CSS Docs
          </a>
        </li>
        <li>
          <a
            className="text-blue-600 underline"
            href="https://github.com/burlibu/burlibu.github.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Repository GitHub
          </a>
        </li>
      </ul>
    </main>
  );
}

function Layout({ children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      <nav className="bg-gray-800 text-white p-4 text-center">
        <Link className="mx-2 hover:underline" to="/">
          Home
        </Link>
        <Link className="mx-2 hover:underline" to="/about">
          Chi sono
        </Link>
        <Link className="mx-2 hover:underline" to="/contact">
          Contatti
        </Link>
        <Link className="mx-2 hover:underline" to="/resources">
          Resources
        </Link>
        <Link className="mx-2 hover:underline" to="/graph3d">
          3D Graph
        </Link>
      </nav>
      <div className="flex-1">{children}</div>
      <footer className="bg-gray-800 text-white p-4 text-center mt-8">
        &copy; 2025 Burlibu
      </footer>
    </div>
  );
}

function App() {
  return (
    <Router basename="">
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/resources" element={<Resources />} />
          <Route path="/graph3d" element={<Graph3D />} />
        </Routes>
      </Layout>
    </Router>
  );
}

function Frame() {
  return (
    <main className="bg-[#ff2828] grid justify-items-center [align-items:start] w-screen min-h-screen">
      <div className="bg-[#ff2828] w-[272px] h-[195px]" />
    </main>
  );
}

export default App;
