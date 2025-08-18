import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

function Home() {
  return (
    <main className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow mt-8">
      <h1 className="text-3xl font-bold mb-4">
        Benvenuto nel sito di Burlibu!
      </h1>
      <p>
        Questo è il sito personale di Burlibu. Scopri chi sono e come
        contattarmi.
      </p>
    </main>
  );
}

function About() {
  return (
    <main className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow mt-8">
      <h1 className="text-3xl font-bold mb-4">Chi sono</h1>
      <p>
        Ciao! Sono Burlibu, appassionato di programmazione e tecnologia. Questo
        sito è il mio spazio personale dove condivido idee e progetti.
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
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;
