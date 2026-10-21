import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import katex from "katex";
import "katex/dist/katex.min.css";
import "./fcq.css";
import {
  GATES, BASIS, apply1, fromAngles, bloch, toAngles, rotate, run, probs, concurrence,
  measureQubit, ketTex,
} from "./qmath";

// /fcq: "Fondamenti di Computazione Quantistica", four interactive plates drawn from
// the course notes (cap. 2-4), as a dark blueprint version of the /resources sheet.
// Standard convention throughout: |0> at the north pole, Z|0> = |0>.

const fmt = (x, d = 3) => (Math.abs(x) < 5e-4 ? 0 : x).toFixed(d);
const pct = (p) => `${(p * 100).toFixed(1)}%`;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Tex({ children, block = false }) {
  const html = useMemo(() => katex.renderToString(children, { displayMode: block, throwOnError: false }), [children, block]);
  return <span className={block ? "qc-tex qc-tex--block" : "qc-tex"} dangerouslySetInnerHTML={{ __html: html }} />;
}

function useInView(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
}

// one requestAnimationFrame tween at a time, cancelled on unmount
function useTween() {
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return useCallback((ms, onFrame, onDone) => {
    cancelAnimationFrame(raf.current);
    const duration = reducedMotion() ? 0 : ms;
    const t0 = performance.now();
    const step = (now) => {
      const t = duration ? Math.min(1, (now - t0) / duration) : 1;
      onFrame(t);
      if (t < 1) raf.current = requestAnimationFrame(step);
      else if (onDone) onDone();
    };
    raf.current = requestAnimationFrame(step);
  }, []);
}

// ---------------------------------------------------------------- Bloch sphere
// Bloch (x, y, z) to three.js: x toward the viewer, y to the right, z up.
// A cyclic swap of axes, so the frame stays right-handed.
const toThree = ([x, y, z]) => [y, z, x];
const ring = (f, n = 72) => Array.from({ length: n + 1 }, (_, i) => toThree(f((i / n) * 2 * Math.PI)));
const SPHERE_LINES = [
  { pts: ring((t) => [Math.cos(t), Math.sin(t), 0]), o: 0.55 },
  { pts: ring((t) => [Math.cos(t), 0, Math.sin(t)]), o: 0.4 },
  { pts: ring((t) => [0, Math.cos(t), Math.sin(t)]), o: 0.4 },
  ...[-0.5, 0.5].map((z) => ({ pts: ring((t) => [Math.cos(t) * 0.866, Math.sin(t) * 0.866, z]), o: 0.18 })),
  ...[Math.PI / 4, -Math.PI / 4].map((a) => ({ pts: ring((t) => [Math.cos(t) * Math.cos(a), Math.cos(t) * Math.sin(a), Math.sin(t)]), o: 0.14 })),
];
const POLES = [
  ["|0\\rangle", [0.12, 0.12, 1.14]], ["|1\\rangle", [0.12, 0.12, -1.14]],
  ["|+\\rangle", [1.22, 0, 0]], ["|-\\rangle", [-1.22, 0, 0]],
  ["|{+i}\\rangle", [0, 1.22, 0]], ["|{-i}\\rangle", [0, -1.22, 0]],
];
const AXES = [["x", [1, 0, 0], "#ff5fd2"], ["y", [0, 1, 0], "#8b8cff"], ["z", [0, 0, 1], "#3ee6ff"]];
const UP = new THREE.Vector3(0, 1, 0);

function Arrow({ vec, color }) {
  const tip = toThree(vec);
  const len = Math.hypot(...vec);
  const quat = useMemo(() => {
    const d = new THREE.Vector3(...tip);
    return d.lengthSq() > 1e-12 ? new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()) : new THREE.Quaternion();
  }, [tip[0], tip[1], tip[2]]); // eslint-disable-line react-hooks/exhaustive-deps
  const shaft = tip.map((c) => (c * Math.max(0, len - 0.1)) / (len || 1));
  return (
    <group>
      <Line points={[[0, 0, 0], shaft]} color={color} lineWidth={3.2} />
      <mesh position={tip.map((c) => (c * (len - 0.07)) / (len || 1))} quaternion={quat}>
        <coneGeometry args={[0.055, 0.15, 20]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={tip}>
        <sphereGeometry args={[0.035, 16, 12]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

function BlochScene({ vec, trail, axis }) {
  const [x, y, z] = vec;
  return (
    <>
      <mesh>
        <sphereGeometry args={[1, 48, 32]} />
        <meshBasicMaterial color="#3ee6ff" transparent opacity={0.05} depthWrite={false} />
      </mesh>
      {SPHERE_LINES.map((l, i) => (
        <Line key={i} points={l.pts} color="#6fdcff" lineWidth={1} transparent opacity={l.o} />
      ))}
      {AXES.map(([name, d, color]) => (
        <group key={name}>
          <Line points={[toThree(d.map((c) => -c * 1.32)), toThree(d.map((c) => c * 1.32))]} color={color} lineWidth={1.2} transparent opacity={0.7} />
          <Html position={toThree(d.map((c) => c * 1.36))} center className="qc-axis-label" style={{ color }}>
            {name}
          </Html>
        </group>
      ))}
      {POLES.map(([tex, p]) => (
        <Html key={tex} position={toThree(p)} center className="qc-pole">
          <Tex>{tex}</Tex>
        </Html>
      ))}
      {axis && (
        <Line points={[toThree(axis.map((c) => -c * 1.4)), toThree(axis.map((c) => c * 1.4))]} color="#ffc85a" lineWidth={1.6} dashed dashSize={0.06} gapSize={0.05} />
      )}
      {trail && trail.length > 1 && <Line points={trail.map(toThree)} color="#ffc85a" lineWidth={2.2} />}
      {/* projections that read theta and phi off the sphere */}
      <Line points={[toThree([x, y, z]), toThree([x, y, 0])]} color="#cfe7ff" lineWidth={1} dashed dashSize={0.04} gapSize={0.04} transparent opacity={0.6} />
      <Line points={[[0, 0, 0], toThree([x, y, 0])]} color="#cfe7ff" lineWidth={1} dashed dashSize={0.04} gapSize={0.04} transparent opacity={0.6} />
      <Arrow vec={vec} color="#3ee6ff" />
    </>
  );
}

function BlochCanvas({ vec, trail, axis, label }) {
  const box = useRef(null);
  const visible = useInView(box);
  return (
    <div className="qc-bloch" ref={box} role="img" aria-label={label}>
      <Canvas
        frameloop={visible ? "demand" : "never"}
        dpr={[1, 2]}
        camera={{ position: [1.65, 1.6, 3.9], fov: 36 }}
        gl={{ antialias: true, alpha: true }}
      >
        <BlochScene vec={vec} trail={trail} axis={axis} />
        <OrbitControls enablePan={false} minDistance={2.6} maxDistance={7} rotateSpeed={0.7} />
      </Canvas>
      <span className="qc-bloch-hint" aria-hidden="true">trascina per ruotare · rotella o pizzico per lo zoom</span>
    </div>
  );
}

// ---------------------------------------------------------------- layout pieces
function Plate({ id, letter, title, refs, children }) {
  return (
    <section className="qc-plate" id={id} aria-labelledby={`${id}-title`}>
      <header className="qc-plate-head">
        <span className="qc-plate-letter" aria-hidden="true">{letter}</span>
        <div>
          <p className="qc-kicker">Tavola {letter}</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        <dl className="qc-titleblock">
          <div><dt>Rif.</dt><dd>{refs}</dd></div>
          <div><dt>Conv.</dt><dd><Tex>{"|0\\rangle = \\text{nord}"}</Tex></dd></div>
        </dl>
      </header>
      {children}
    </section>
  );
}

function Slider({ label, tex, value, min, max, step, onChange, display }) {
  return (
    <label className="qc-slider">
      <span className="qc-slider-top">
        <span>{tex ? <Tex>{tex}</Tex> : null} {label}</span>
        <output>{display}</output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} aria-valuetext={display} />
    </label>
  );
}

function Note({ title, children, tone }) {
  return (
    <aside className={`qc-note${tone ? ` qc-note--${tone}` : ""}`}>
      <p className="qc-note-title">{title}</p>
      {children}
    </aside>
  );
}

// ---------------------------------------------------------------- A: bit vs qubit
function PlateA() {
  const [theta, setTheta] = useState(Math.PI / 3);
  const [bit, setBit] = useState(0);
  const [collapsed, setCollapsed] = useState(null);
  const [counts, setCounts] = useState([0, 0]);
  const tween = useTween();
  const alpha = Math.cos(theta / 2), beta = Math.sin(theta / 2);
  const p0 = alpha * alpha, p1 = beta * beta;
  const total = counts[0] + counts[1];

  const change = (t) => {
    setTheta(t);
    setCollapsed(null);
    setCounts([0, 0]);
  };
  const shot = () => {
    const b = Math.random() < p1 ? 1 : 0;
    setCollapsed(b);
    setCounts((c) => (b ? [c[0], c[1] + 1] : [c[0] + 1, c[1]]));
  };
  // many shots, counted in over ~0.9 s so the histogram visibly converges
  const runShots = (n) => {
    setCollapsed(null);
    let done = 0;
    tween(900, (t) => {
      const target = Math.round(n * t);
      let zeros = 0, ones = 0;
      for (; done < target; done++) (Math.random() < p1 ? ones++ : zeros++);
      if (zeros || ones) setCounts((c) => [c[0] + zeros, c[1] + ones]);
    });
  };

  const shown = collapsed === null ? theta / 2 : collapsed * (Math.PI / 2);
  const r = 92, cx = 120, cy = 128;
  const tip = [cx + r * Math.sin(shown), cy - r * Math.cos(shown)];

  return (
    <Plate id="qc-a" letter="A" title="Bit classico e qubit: la sovrapposizione" refs="cap. 3 §2–3">
      <div className="qc-grid">
        <div className="qc-col">
          <p>
            Un bit classico vale <b>0 oppure 1</b>: leggerlo non lo cambia. Un qubit è un sistema a due stati descritto da un
            vettore di norma unitaria in uno spazio complesso di dimensione 2:
          </p>
          <Tex block>{"|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle, \\qquad |\\alpha|^2 + |\\beta|^2 = 1"}</Tex>
          <p>
            Gli stati possibili sono <b>infiniti</b> (principio di sovrapposizione), ma la misura nella base{" "}
            <Tex>{"\\{|0\\rangle,|1\\rangle\\}"}</Tex> dà solo due esiti: 0 con probabilità <Tex>{"|\\alpha|^2"}</Tex>, 1 con
            probabilità <Tex>{"|\\beta|^2"}</Tex>. Dopo la misura lo stato <b>collassa</b> sull'autostato trovato, e una seconda
            misura nella stessa base ripete lo stesso esito.
          </p>
          <div className="qc-bitbox">
            <span className="qc-label">Bit classico</span>
            <button type="button" className={`qc-switch qc-switch--${bit}`} onClick={() => setBit(1 - bit)} aria-pressed={bit === 1}>
              <span className="qc-switch-knob">{bit}</span>
            </button>
            <span className="qc-muted">letto: {bit}, sempre</span>
          </div>
          <Slider
            label="angolo dello stato"
            tex="\theta"
            value={theta}
            min={0}
            max={Math.PI}
            step={0.01}
            onChange={change}
            display={`${((theta * 180) / Math.PI).toFixed(0)}°`}
          />
          <Tex block>{`|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}|0\\rangle + \\sin\\tfrac{\\theta}{2}|1\\rangle = ${fmt(alpha)}\\,|0\\rangle + ${fmt(beta)}\\,|1\\rangle`}</Tex>
          <div className="qc-probs" aria-label={`Probabilità: 0 ${pct(p0)}, 1 ${pct(p1)}`}>
            {[["0", p0, "alpha"], ["1", p1, "beta"]].map(([k, p, a]) => (
              <div className="qc-prob" key={k}>
                <span className="qc-prob-label"><Tex>{`P(${k}) = |\\${a}|^2`}</Tex></span>
                <span className="qc-prob-bar"><span style={{ width: `${p * 100}%` }} /></span>
                <output>{pct(p)}</output>
              </div>
            ))}
          </div>
          <Note title="Esempio dalle dispense">
            <p>
              Con <Tex>{"|a\\rangle=\\sqrt{0.75}\\,|0\\rangle+\\sqrt{0.25}\\,|1\\rangle"}</Tex> la misura dà 0 nel 75% dei casi e 1
              nel 25%: porta lo slider a <b>60°</b> e controlla.
            </p>
          </Note>
        </div>

        <div className="qc-col qc-col--visual">
          <svg className="qc-circle" viewBox="0 0 250 250" role="img" aria-label={`Vettore di stato a ${((shown * 360) / Math.PI).toFixed(0)} gradi da |0⟩`}>
            <defs>
              <marker id="qc-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0 10 5 0 10z" fill="currentColor" />
              </marker>
            </defs>
            <circle cx={cx} cy={cy} r={r} className="qc-c-ring" />
            <path d={`M${cx} ${cy} V${cy - r - 18}`} className="qc-c-axis" markerEnd="url(#qc-head)" />
            <path d={`M${cx} ${cy} H${cx + r + 18}`} className="qc-c-axis" markerEnd="url(#qc-head)" />
            <text x={cx - 6} y={cy - r - 22} className="qc-c-tag" textAnchor="end">|0⟩</text>
            <text x={cx + r + 22} y={cy + 4} className="qc-c-tag">|1⟩</text>
            <line x1={tip[0]} y1={tip[1]} x2={cx} y2={tip[1]} className="qc-c-proj" />
            <line x1={tip[0]} y1={tip[1]} x2={tip[0]} y2={cy} className="qc-c-proj" />
            <text x={cx - 8} y={(tip[1] + cy) / 2 + 4} className="qc-c-amp" textAnchor="end">α</text>
            <text x={cx + 40 * Math.sin(shown / 2) + 4} y={cy - 40 * Math.cos(shown / 2)} className="qc-c-theta">θ/2</text>
            <text x={(tip[0] + cx) / 2} y={cy + 18} className="qc-c-amp" textAnchor="middle">β</text>
            <path d={`M${cx} ${cy - 34} A34 34 0 0 1 ${cx + 34 * Math.sin(shown)} ${cy - 34 * Math.cos(shown)}`} className="qc-c-arc" />
            <g className="qc-c-vec" style={{ transform: `rotate(${(shown * 180) / Math.PI}deg)`, transformOrigin: `${cx}px ${cy}px` }}>
              <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} markerEnd="url(#qc-head)" />
            </g>
            <text x={18} y={238} className="qc-c-note">raggio 1: |α|² + |β|² = 1</text>
          </svg>
          {collapsed !== null && (
            <p className="qc-collapse" role="status">
              Esito <b>{collapsed}</b>: lo stato è collassato su <Tex>{`|${collapsed}\\rangle`}</Tex>
            </p>
          )}
          <div className="qc-actions">
            <button type="button" className="qc-btn qc-btn--primary" onClick={shot}>Misura (collasso)</button>
            <button type="button" className="qc-btn" onClick={() => runShots(100)}>× 100</button>
            <button type="button" className="qc-btn" onClick={() => runShots(1000)}>× 1000</button>
            <button type="button" className="qc-btn qc-btn--ghost" onClick={() => { setCounts([0, 0]); setCollapsed(null); }}>Azzera</button>
          </div>
          <div className="qc-hist" role="img" aria-label={`Istogramma su ${total} misure: ${counts[0]} volte 0, ${counts[1]} volte 1`}>
            {[0, 1].map((k) => {
              const f = total ? counts[k] / total : 0;
              return (
                <div className="qc-hist-col" key={k}>
                  <div className="qc-hist-track">
                    <span className="qc-hist-bar" style={{ height: `${f * 100}%` }} />
                    <span className="qc-hist-theory" style={{ bottom: `${(k ? p1 : p0) * 100}%` }} />
                  </div>
                  <span className="qc-hist-k">{k}</span>
                  <span className="qc-hist-n">{counts[k]}</span>
                </div>
              );
            })}
            <p className="qc-hist-caption">
              {total ? `${total} misure · frequenza di 1: ${pct(counts[1] / total)} (teoria ${pct(p1)})` : "Nessuna misura: la linea tratteggiata è la probabilità teorica."}
            </p>
          </div>
        </div>
      </div>
    </Plate>
  );
}

// ---------------------------------------------------------------- B: Bloch sphere
const PRESETS = [
  ["|0\\rangle", 0, 0], ["|1\\rangle", Math.PI, 0], ["|+\\rangle", Math.PI / 2, 0],
  ["|-\\rangle", Math.PI / 2, Math.PI], ["|{+i}\\rangle", Math.PI / 2, Math.PI / 2], ["|{-i}\\rangle", Math.PI / 2, (3 * Math.PI) / 2],
];

function PlateB() {
  const [theta, setTheta] = useState(Math.PI / 3);
  const [phi, setPhi] = useState((2 * Math.PI) / 3);
  const psi = fromAngles(theta, phi);
  const vec = bloch(psi);
  const deg = (r) => `${((r * 180) / Math.PI).toFixed(0)}°`;
  return (
    <Plate id="qc-b" letter="B" title="La sfera di Bloch" refs="cap. 3 §8">
      <div className="qc-grid">
        <div className="qc-col">
          <p>
            Due numeri complessi con <Tex>{"|\\alpha|^2+|\\beta|^2=1"}</Tex> e una fase globale non osservabile lasciano due soli
            parametri reali. Ogni stato puro si scrive
          </p>
          <Tex block>{"|\\psi\\rangle = \\cos\\tfrac{\\theta}{2}\\,|0\\rangle + e^{i\\phi}\\sin\\tfrac{\\theta}{2}\\,|1\\rangle, \\qquad \\theta\\in[0,\\pi],\\ \\phi\\in[0,2\\pi)"}</Tex>
          <p>
            e i valori medi degli operatori di Pauli sono le coordinate di un punto sulla sfera unitaria:
          </p>
          <Tex block>{"\\langle X\\rangle = \\sin\\theta\\cos\\phi,\\quad \\langle Y\\rangle = \\sin\\theta\\sin\\phi,\\quad \\langle Z\\rangle = \\cos\\theta"}</Tex>
          <Slider label="latitudine (da |0⟩)" tex="\theta" value={theta} min={0} max={Math.PI} step={0.01} onChange={setTheta} display={deg(theta)} />
          <Slider label="fase relativa (longitudine)" tex="\phi" value={phi} min={0} max={2 * Math.PI} step={0.01} onChange={setPhi} display={deg(phi)} />
          <div className="qc-presets" role="group" aria-label="Stati notevoli">
            {PRESETS.map(([tex, t, p]) => (
              <button key={tex} type="button" className="qc-chip" onClick={() => { setTheta(t); setPhi(p); }}>
                <Tex>{tex}</Tex>
              </button>
            ))}
          </div>
          <div className="qc-readout">
            <Tex block>{`|\\psi\\rangle = ${ketTex(psi, ["0", "1"])}`}</Tex>
            <p className="qc-mono">
              (x, y, z) = ({fmt(vec[0], 2)}, {fmt(vec[1], 2)}, {fmt(vec[2], 2)}) · P(0) = {pct(Math.cos(theta / 2) ** 2)}
            </p>
          </div>
          <Note title="Fase globale e fase relativa">
            <p>
              <Tex>{"|\\psi\\rangle"}</Tex> e <Tex>{"e^{i\\gamma}|\\psi\\rangle"}</Tex> danno le stesse probabilità per ogni misura: sono
              lo stesso punto. La fase <b>relativa</b> φ invece si misura: <Tex>{"|+\\rangle"}</Tex> e <Tex>{"|-\\rangle"}</Tex>{" "}
              hanno P(0) = 50% entrambi, ma una misura di X li distingue con certezza.
            </p>
          </Note>
          <Note title="Nelle dispense" tone="amber">
            <p>
              Le dispense usano la convenzione opposta: <Tex>{"|1\\rangle"}</Tex> al polo nord, <Tex>{"Z|0\\rangle=-|0\\rangle"}</Tex>, matrici
              nella base <Tex>{"\\{|1\\rangle,|0\\rangle\\}"}</Tex> e{" "}
              <Tex>{"|\\psi\\rangle=\\cos\\tfrac{\\theta}{2}|1\\rangle+e^{i\\phi}\\sin\\tfrac{\\theta}{2}|0\\rangle"}</Tex>. Qui si usa quella
              standard (Nielsen–Chuang): per passare dall'una all'altra basta scambiare le etichette 0 ↔ 1.
            </p>
          </Note>
        </div>
        <div className="qc-col qc-col--visual">
          <BlochCanvas vec={vec} label={`Sfera di Bloch: stato con theta ${deg(theta)} e phi ${deg(phi)}`} />
        </div>
      </div>
    </Plate>
  );
}

// ---------------------------------------------------------------- C: gates
const GATE_INFO = {
  X: { name: "Pauli-X", tex: "\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}", action: "X|0\\rangle=|1\\rangle,\\ X|1\\rangle=|0\\rangle", rot: "π attorno a x", note: "Il NOT quantistico." },
  Y: { name: "Pauli-Y", tex: "\\begin{pmatrix}0&-i\\\\i&0\\end{pmatrix}", action: "Y|0\\rangle=i|1\\rangle,\\ Y|1\\rangle=-i|0\\rangle", rot: "π attorno a y", note: "Y = iXZ: bit flip e phase flip insieme." },
  Z: { name: "Pauli-Z", tex: "\\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}", action: "Z|0\\rangle=|0\\rangle,\\ Z|1\\rangle=-|1\\rangle", rot: "π attorno a z", note: "Phase flip: cambia la fase relativa." },
  H: { name: "Hadamard", tex: "\\tfrac{1}{\\sqrt2}\\begin{pmatrix}1&1\\\\1&-1\\end{pmatrix}", action: "H|0\\rangle=|+\\rangle,\\ H|1\\rangle=|-\\rangle", rot: "π attorno a (x+z)/√2", note: "Crea la sovrapposizione simmetrica; è il cambio di base dei tre polarizzatori." },
  S: { name: "Fase S", tex: "\\begin{pmatrix}1&0\\\\0&i\\end{pmatrix}", action: "S = U_{ph}(\\pi/2):\\ |1\\rangle\\to i|1\\rangle", rot: "π/2 attorno a z", note: "Phase gate delle dispense con fase π/2." },
  T: { name: "Fase T", tex: "\\begin{pmatrix}1&0\\\\0&e^{i\\pi/4}\\end{pmatrix}", action: "T = U_{ph}(\\pi/4):\\ |1\\rangle\\to e^{i\\pi/4}|1\\rangle", rot: "π/4 attorno a z", note: "Phase gate con fase π/4; T² = S." },
};

function PlateC() {
  const [psi, setPsi] = useState(fromAngles(0, 0));
  const [anim, setAnim] = useState(null); // { vec, trail, axis } while a gate turns the sphere
  const [trace, setTrace] = useState(null); // the last gate's path, kept after it ends
  const [history, setHistory] = useState([]);
  const last = useRef(null);
  const tween = useTween();
  const busy = anim !== null;

  const applyGate = (name) => {
    if (busy) return;
    const g = GATES[name], v0 = bloch(psi);
    const next = apply1(g.m, psi);
    tween(
      Math.max(450, g.angle * 260),
      (t) => {
        const e = easeInOut(t), n = Math.max(2, Math.round(40 * e) + 1);
        const trail = Array.from({ length: n }, (_, k) => rotate(v0, g.axis, (g.angle * e * k) / (n - 1)));
        last.current = { trail, axis: g.axis };
        setAnim({ vec: trail[trail.length - 1], ...last.current });
      },
      () => {
        setPsi(next);
        setHistory((h) => [...h.slice(-7), name]);
        setTrace(last.current);
        setAnim(null);
      },
    );
  };
  const reset = (t, p) => {
    setPsi(fromAngles(t, p));
    setHistory([]);
    setTrace(null);
  };

  const vec = anim ? anim.vec : bloch(psi);
  const onZ = Math.abs(Math.abs(vec[2]) - 1) < 1e-6;
  const [t, p] = toAngles(bloch(psi));

  return (
    <Plate id="qc-c" letter="C" title="Porte quantistiche: rotazioni della sfera" refs="cap. 3 §7–9">
      <div className="qc-grid">
        <div className="qc-col">
          <p>
            Le sole trasformazioni ammesse sono <b>unitarie</b>: lineari e con <Tex>{"U^{-1}=U^\\dagger"}</Tex>. Conservano il prodotto scalare,
            quindi norme e probabilità, e sono sempre reversibili, al contrario di una porta AND classica. Su un qubit ogni unitaria è,
            a meno di una fase globale,
          </p>
          <Tex block>{"U = \\cos\\tfrac{\\alpha}{2}\\,I - i\\sin\\tfrac{\\alpha}{2}\\,(n_xX+n_yY+n_zZ)"}</Tex>
          <p>
            cioè una <b>rotazione di un angolo α attorno all'asse n</b> della sfera di Bloch. Tocca una porta e guarda il vettore ruotare.
          </p>
          <div className="qc-gates">
            {Object.entries(GATE_INFO).map(([k, g]) => (
              <article className="qc-gate" key={k}>
                <button type="button" className="qc-gate-badge" onClick={() => applyGate(k)} disabled={busy} aria-label={`Applica ${g.name}`}>
                  {k}
                </button>
                <div className="qc-gate-body">
                  <p className="qc-gate-name">{g.name} <span className="qc-muted">· {g.rot}</span></p>
                  <div className="qc-gate-math">
                    <Tex>{`${k} = ${g.tex}`}</Tex>
                    <Tex>{g.action}</Tex>
                  </div>
                  <p className="qc-gate-note">{g.note}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="qc-col qc-col--visual">
          <BlochCanvas
            vec={vec}
            trail={anim ? anim.trail : trace && trace.trail}
            axis={anim ? anim.axis : trace && trace.axis}
            label="Sfera di Bloch: effetto dell'ultima porta applicata"
          />
          <div className="qc-readout">
            <Tex block>{`|\\psi\\rangle = ${ketTex(psi, ["0", "1"])}`}</Tex>
            <p className="qc-mono" aria-live="polite">
              {history.length ? `|0⟩ → ${history.join(" → ")}` : "Parti da |0⟩ e applica una porta."} · θ = {((t * 180) / Math.PI).toFixed(0)}°, φ = {((p * 180) / Math.PI).toFixed(0)}°
            </p>
          </div>
          {onZ && !busy && (
            <p className="qc-hint">Sui poli Z, S e T lasciano il vettore fermo: cambiano solo una fase globale. Prova prima H.</p>
          )}
          <div className="qc-actions">
            <button type="button" className="qc-btn qc-btn--ghost" onClick={() => reset(0, 0)} disabled={busy}>Riparti da |0⟩</button>
            <button type="button" className="qc-btn qc-btn--ghost" onClick={() => reset(Math.PI / 2, 0)} disabled={busy}>Riparti da |+⟩</button>
          </div>
        </div>
      </div>

      <div className="qc-cnot">
        <div>
          <p className="qc-gate-name">CNOT · Controlled-NOT <span className="qc-muted">· due qubit</span></p>
          <p>
            Agisce sul prodotto tensoriale <Tex>{"V\\otimes W"}</Tex> (dimensione 2 × 2 = 4): nega il qubit bersaglio se il controllo vale 1,
            altrimenti non fa nulla. È la porta che genera entanglement.
          </p>
          <Tex block>{"\\text{CNOT}=\\begin{pmatrix}1&0&0&0\\\\0&1&0&0\\\\0&0&0&1\\\\0&0&1&0\\end{pmatrix}, \\qquad \\text{CNOT}\\left(\\tfrac{|0\\rangle+|1\\rangle}{\\sqrt2}\\otimes|0\\rangle\\right)=\\tfrac{|00\\rangle+|11\\rangle}{\\sqrt2}=|\\Phi^+\\rangle"}</Tex>
        </div>
        <table className="qc-truth">
          <caption>Base canonica (controllo, bersaglio)</caption>
          <thead><tr><th>ingresso</th><th>uscita</th></tr></thead>
          <tbody>
            {[["00", "00"], ["01", "01"], ["10", "11"], ["11", "10"]].map(([a, b]) => (
              <tr key={a}><td><Tex>{`|${a}\\rangle`}</Tex></td><td className={a[0] === "1" ? "qc-flip" : ""}><Tex>{`|${b}\\rangle`}</Tex></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Plate>
  );
}

// ---------------------------------------------------------------- D: entanglement + composer
const SLOTS = 5;
const PALETTE = ["H", "X", "Z", "S", "CNOT"];
const emptyCircuit = () => Array.from({ length: SLOTS }, () => ({ q0: null, q1: null }));
const bellCircuit = () => {
  const c = emptyCircuit();
  c[0] = { q0: "H", q1: null };
  c[1] = { cnot: 0 };
  return c;
};

function PlateD() {
  const [cols, setCols] = useState(emptyCircuit);
  const [tool, setTool] = useState("H");
  const [measured, setMeasured] = useState(null); // { bits: [b0|null, b1|null], state }
  const [stats, setStats] = useState([0, 0, 0, 0]);
  const tween = useTween();

  const states = useMemo(() => run(cols), [cols]);
  const final = states[states.length - 1];
  const shown = measured ? measured.state : final;
  const P = probs(shown);
  const conc = concurrence(final);
  const entangled = conc > 1e-6;
  const total = stats.reduce((a, b) => a + b, 0);

  const edit = (next) => {
    setCols(next);
    setMeasured(null);
    setStats([0, 0, 0, 0]);
  };
  const place = (i, wire, gate) => {
    const next = cols.map((c) => ({ ...c }));
    if (gate === "CNOT") next[i] = next[i].cnot !== undefined ? { q0: null, q1: null } : { cnot: 0 };
    else {
      const col = next[i].cnot !== undefined ? { q0: null, q1: null } : next[i];
      col[wire] = col[wire] === gate ? null : gate;
      next[i] = col;
    }
    edit(next);
  };

  const definite = (state, q) => {
    const p1 = q === 0 ? probs(state)[2] + probs(state)[3] : probs(state)[1] + probs(state)[3];
    return p1 < 1e-9 ? 0 : p1 > 1 - 1e-9 ? 1 : null;
  };
  const measure = (q) => {
    const m = measureQubit(shown, q);
    const bits = [definite(m.state, 0), definite(m.state, 1)];
    setMeasured({ bits, state: m.state, first: q });
  };
  const runShots = (n) => {
    setMeasured(null);
    const cum = probs(final).reduce((a, p) => [...a, (a[a.length - 1] || 0) + p], []);
    let done = 0;
    tween(900, (t) => {
      const target = Math.round(n * t), add = [0, 0, 0, 0];
      for (; done < target; done++) {
        const r = Math.random();
        add[cum.findIndex((c) => r < c + 1e-12)]++;
      }
      if (add.some(Boolean)) setStats((s) => s.map((v, i) => v + add[i]));
    });
  };

  const onDrop = (e, i, wire) => {
    e.preventDefault();
    const g = e.dataTransfer.getData("text/plain");
    if (PALETTE.includes(g)) place(i, wire, g);
  };
  const lamp = (q) => (measured ? measured.bits[q] : null);
  const agree = total ? (stats[0] + stats[3]) / total : 0;

  const cellFor = (c, i, wire) => {
    const isC = c.cnot !== undefined;
    const g = isC ? (wire === "q0" ? "●" : "⊕") : c[wire];
    return (
      <button
        type="button"
        key={wire}
        className={`qc-slot${g ? " qc-slot--full" : ""}${isC ? ` qc-slot--cnot qc-slot--${wire}` : ""}`}
        onClick={() => place(i, wire, g && !isC ? c[wire] : isC ? "CNOT" : tool)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, i, wire)}
        aria-label={`Passo ${i + 1}, ${wire === "q0" ? "q zero" : "q uno"}: ${isC ? (wire === "q0" ? "controllo CNOT" : "bersaglio CNOT") : g || "vuoto"}. ${g ? "Tocca per togliere." : `Tocca per inserire ${tool}.`}`}
      >
        {g || ""}
      </button>
    );
  };

  return (
    <Plate id="qc-d" letter="D" title="Entanglement e circuito interattivo" refs="cap. 2 §2 · cap. 3 §6–7">
      <div className="qc-grid">
        <div className="qc-col">
          <p>
            Lo stato di due qubit vive nel prodotto tensoriale <Tex>{"V\\otimes W"}</Tex>, con base{" "}
            <Tex>{"\\{|00\\rangle,|01\\rangle,|10\\rangle,|11\\rangle\\}"}</Tex>. Gli stati <b>fattorizzabili</b> si scrivono{" "}
            <Tex>{"(\\alpha|0\\rangle+\\beta|1\\rangle)\\otimes(\\gamma|0\\rangle+\\delta|1\\rangle)"}</Tex>: misurare il primo non cambia il
            secondo. Ma non tutti i vettori di <Tex>{"V\\otimes W"}</Tex> sono così:
          </p>
          <Tex block>{"|\\Phi^+\\rangle = \\frac{|00\\rangle+|11\\rangle}{\\sqrt2} \\overset{?}{=} \\alpha\\gamma|00\\rangle+\\alpha\\delta|01\\rangle+\\beta\\gamma|10\\rangle+\\beta\\delta|11\\rangle"}</Tex>
          <p>
            richiede <Tex>{"\\alpha\\delta=\\beta\\gamma=0"}</Tex> ma <Tex>{"\\alpha\\gamma=\\beta\\delta=\\tfrac{1}{\\sqrt2}"}</Tex>: impossibile. Lo stato è{" "}
            <b>entangled</b>. In generale <Tex>{"a_{00}a_{11}=a_{01}a_{10}"}</Tex> se e solo se lo stato è separabile.
          </p>
          <Tex block>{"|\\Phi^\\pm\\rangle=\\tfrac{|00\\rangle\\pm|11\\rangle}{\\sqrt2},\\qquad |\\Psi^\\pm\\rangle=\\tfrac{|01\\rangle\\pm|10\\rangle}{\\sqrt2}"}</Tex>
          <p className="qc-muted">I quattro stati di Bell: una base ortonormale dello spazio a due qubit.</p>
          <Note title="Approfondimento · paradosso EPR">
            <p>
              Misurando <Tex>{"q_0"}</Tex> di <Tex>{"|\\Phi^+\\rangle"}</Tex> anche <Tex>{"q_1"}</Tex> collassa, sullo stesso valore, pure se i
              qubit sono a chilometri. Einstein, Podolsky e Rosen (1935) lo presero come segno di una teoria incompleta. Le correlazioni però
              non trasportano informazione: da solo, chi misura <Tex>{"q_1"}</Tex> vede 0 e 1 al 50% qualunque cosa accada all'altro qubit
              (lo stesso argomento del teletrasporto, cap. 4 §4).
            </p>
          </Note>
        </div>

        <div className="qc-col qc-col--visual">
          <div className="qc-palette" role="group" aria-label="Porte da inserire">
            {PALETTE.map((g) => (
              <button
                key={g}
                type="button"
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", g)}
                className={`qc-tool${tool === g ? " qc-tool--on" : ""}`}
                onClick={() => setTool(g)}
                aria-pressed={tool === g}
              >
                {g}
              </button>
            ))}
            <span className="qc-muted qc-palette-hint">scegli o trascina, poi tocca uno slot</span>
          </div>
          <div className="qc-circuit" style={{ "--slots": SLOTS }}>
            {["q0", "q1"].map((wire, w) => (
              <div className="qc-wire" key={wire}>
                <span className="qc-wire-label"><Tex>{`q_${w}\\;|0\\rangle`}</Tex></span>
                <div className="qc-wire-slots">{cols.map((c, i) => cellFor(c, i, wire))}</div>
                <span className={`qc-lamp${lamp(w) !== null ? ` qc-lamp--on qc-lamp--${lamp(w)}` : ""}`} aria-label={`Lettura ${wire}: ${lamp(w) ?? "non misurato"}`}>
                  {lamp(w) ?? "?"}
                </span>
              </div>
            ))}
          </div>
          <div className="qc-actions">
            <button type="button" className="qc-btn qc-btn--primary" onClick={() => edit(bellCircuit())}>Prepara |Φ⁺⟩ (H, CNOT)</button>
            <button type="button" className="qc-btn qc-btn--ghost" onClick={() => edit(emptyCircuit())}>Svuota</button>
          </div>

          <div className="qc-statevec">
            <div className="qc-amps">
              {BASIS.map((b, i) => (
                <div className={`qc-amp${measured && P[i] < 1e-9 ? " qc-amp--gone" : ""}`} key={b}>
                  <span className="qc-amp-track"><span className="qc-amp-bar" style={{ height: `${P[i] * 100}%` }} /></span>
                  <Tex>{`|${b}\\rangle`}</Tex>
                  <output>{pct(P[i])}</output>
                </div>
              ))}
            </div>
            <div className="qc-statevec-side">
              <span className={`qc-badge${entangled ? " qc-badge--ent" : ""}`}>
                {entangled ? `entangled · concurrence ${fmt(conc, 2)}` : "separabile"}
              </span>
              <Tex block>{`|\\psi\\rangle = ${ketTex(shown, BASIS)}`}</Tex>
            </div>
          </div>

          <div className="qc-actions">
            <button type="button" className="qc-btn" onClick={() => measure(0)} disabled={measured && measured.bits[0] !== null}>Misura q₀</button>
            <button type="button" className="qc-btn" onClick={() => measure(1)} disabled={measured && measured.bits[1] !== null}>Misura q₁</button>
            <button type="button" className="qc-btn" onClick={() => runShots(1000)}>1000 coppie</button>
            {measured && <button type="button" className="qc-btn qc-btn--ghost" onClick={() => setMeasured(null)}>Ripristina |ψ⟩</button>}
          </div>
          {measured && (
            <p className="qc-collapse" role="status">
              {(() => {
                const q = measured.first, other = 1 - q;
                const b = measured.bits[q], o = measured.bits[other];
                if (o === null) return `q${q} = ${b}. L'altro qubit è ancora indeterminato: lo stato era separabile in questa direzione.`;
                return entangled
                  ? `q${q} = ${b} ⇒ anche q${other} = ${o}, nello stesso istante: un'unica misura ha fissato entrambi.`
                  : `q${q} = ${b}; q${other} era già determinato (${o}) e non è cambiato.`;
              })()}
            </p>
          )}
          {total > 0 && (
            <div className="qc-joint" aria-live="polite">
              <table>
                <thead><tr><th /><th>q₁ = 0</th><th>q₁ = 1</th></tr></thead>
                <tbody>
                  <tr><th>q₀ = 0</th><td>{stats[0]}</td><td>{stats[1]}</td></tr>
                  <tr><th>q₀ = 1</th><td>{stats[2]}</td><td>{stats[3]}</td></tr>
                </tbody>
              </table>
              <p>
                {total} coppie · q₀ = q₁ nel <b>{pct(agree)}</b> dei casi · q₁ = 1 nel {pct((stats[1] + stats[3]) / total)}
              </p>
            </div>
          )}
          {cols.some((c) => c.cnot !== undefined || c.q0 || c.q1) && (
            <ol className="qc-steps" aria-label="Stato dopo ogni passo">
              {cols.map((c, i) =>
                c.cnot !== undefined || c.q0 || c.q1 ? (
                  <li key={i}>
                    <span className="qc-muted qc-step-op">{c.cnot !== undefined ? "CNOT" : [c.q0 && `${c.q0}⊗·`, c.q1 && `·⊗${c.q1}`].filter(Boolean).join(" ")}</span>
                    <Tex>{ketTex(states[i + 1], BASIS)}</Tex>
                  </li>
                ) : null,
              )}
            </ol>
          )}
        </div>
      </div>
    </Plate>
  );
}

// ---------------------------------------------------------------- page
const PLATES = [["qc-a", "A", "Superposizione"], ["qc-b", "B", "Sfera di Bloch"], ["qc-c", "C", "Porte"], ["qc-d", "D", "Entanglement"]];

export default function Fcq() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Fondamenti di Computazione Quantistica";
    return () => { document.title = prev; };
  }, []);
  // HashRouter owns the hash, so the index scrolls instead of linking to anchors
  const go = (id) => document.getElementById(id).scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
  return (
    <div className="qc-desk">
      <main className="qc-sheet">
        <header className="qc-hero">
          <p className="qc-kicker">Corso FCQ · a.a. 2025–26 · dalle dispense, cap. 2–4</p>
          <h1>Fondamenti di Computazione Quantistica</h1>
          <p className="qc-lead">
            Algebra lineare e meccanica quantistica in quattro tavole da manipolare: dal qubit alla sfera di Bloch, dalle porte come
            rotazioni all'entanglement.
          </p>
          <nav className="qc-index" aria-label="Tavole">
            {PLATES.map(([id, l, t]) => (
              <button key={id} type="button" onClick={() => go(id)}>
                <b>{l}</b> {t}
              </button>
            ))}
          </nav>
        </header>
        <PlateA />
        <PlateB />
        <PlateC />
        <PlateD />
        <footer className="qc-foot">
          Fonti: dispense del corso (cap. 2 apparato matematico, cap. 3 fenomeni quantistici, cap. 4 informazione quantistica),
          Nielsen &amp; Chuang. Convenzione standard: <Tex>{"|0\\rangle"}</Tex> al polo nord.
        </footer>
      </main>
    </div>
  );
}
