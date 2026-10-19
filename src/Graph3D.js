import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { Link, useNavigate } from "react-router-dom";
import { NOTES, LINKS, AREA_NAMES, AREA_COLORS, slugify } from "./knowledge";

// Knowledge-base graph in a luminous "memory simulation" style: glowing nodes and
// links over drifting bokeh, a band of light, a rippling wave grid and frequency
// lines. Nodes open /graph3d/nodo/<slug>.

const EDGES = (() => {
  const seen = new Set();
  return LINKS.filter(([a, b]) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
})();
const NEIGHBORS = NOTES.map(() => new Set());
EDGES.forEach(([a, b]) => {
  NEIGHBORS[a].add(b);
  NEIGHBORS[b].add(a);
});
const GRAPH_RADIUS = 13;
const colorOf = (n) => new THREE.Color(n.area >= 0 ? AREA_COLORS[n.area] : "#ffffff");

// 3D force-directed layout: pairwise repulsion, springs on links, a pull toward
// each area's centroid so areas read as clusters, and gentle centering.
function layout() {
  let seed = 42;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = NOTES.length;
  const p = NOTES.map(() => new THREE.Vector3((rand() - 0.5) * 20, (rand() - 0.5) * 20, (rand() - 0.5) * 20));
  const v = NOTES.map(() => new THREE.Vector3());
  const d = new THREE.Vector3();
  for (let it = 0; it < 360; it++) {
    const cool = 1 - it / 360;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        d.subVectors(p[i], p[j]);
        const l2 = Math.max(0.3, d.lengthSq());
        d.multiplyScalar(3 / (l2 * Math.sqrt(l2)));
        v[i].add(d);
        v[j].sub(d);
      }
    for (const [a, b] of EDGES) {
      d.subVectors(p[b], p[a]);
      const l = d.length() || 1e-3;
      d.multiplyScalar(((l - 2.6) / l) * 0.06);
      v[a].add(d);
      v[b].sub(d);
    }
    const centroids = AREA_NAMES.map(() => [new THREE.Vector3(), 0]);
    NOTES.forEach((note, i) => {
      if (note.area >= 0) {
        centroids[note.area][0].add(p[i]);
        centroids[note.area][1]++;
      }
    });
    NOTES.forEach((note, i) => {
      if (note.area >= 0) {
        const [c, k] = centroids[note.area];
        d.copy(c).divideScalar(k).sub(p[i]).multiplyScalar(0.03);
        v[i].add(d);
      }
      v[i].addScaledVector(p[i], -0.004);
      p[i].addScaledVector(v[i], 0.5 * cool + 0.05);
      v[i].multiplyScalar(0.6);
    });
  }
  // center and scale so the graph always spans the same radius
  const c = p.reduce((acc, q) => acc.add(q), new THREE.Vector3()).divideScalar(n);
  p.forEach((q) => q.sub(c));
  const radii = p.map((q) => q.length()).sort((a, b) => a - b);
  const k = GRAPH_RADIUS / radii[Math.floor(n * 0.95)];
  p.forEach((q) => q.multiplyScalar(k));
  return p;
}

const glowVertex = /* glsl */ `
  attribute float size;
  attribute float lit;
  attribute vec3 tint;
  uniform float uScale;
  varying vec3 vTint;
  varying float vLit;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = size * uScale * (lit > 1.0 ? 1.45 : 1.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
    vTint = tint;
    vLit = lit;
  }
`;
const glowFragment = /* glsl */ `
  varying vec3 vTint;
  varying float vLit;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float halo = pow(max(0.0, 1.0 - d), 2.4);
    float core = smoothstep(0.22, 0.0, d);
    float a = (halo * 0.75 + core) * min(vLit, 1.0);
    gl_FragColor = vec4(vTint * halo + vec3(core), a);
  }
`;

// Point sizes are in world units: scale by viewport height and fov
function usePointScale(material) {
  const { size, viewport, camera } = useThree();
  useFrame(() => {
    material.uniforms.uScale.value = (size.height * viewport.dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  });
}

function Graph({ positions, active, onHover, onPick }) {
  const cores = useRef();
  const hits = useRef();
  const count = NOTES.length;
  const sizes = useMemo(() => NOTES.map((n) => (n.kind === "note" ? 0.9 + NEIGHBORS[n.id].size * 0.12 : 2.2)), []);
  const lit = useMemo(() => {
    const out = new Float32Array(count).fill(1);
    if (!active) return out;
    out.fill(0.12);
    active.forEach((id) => (out[id] = 2));
    return out;
  }, [active, count]);

  // node cores, plus a larger invisible twin that takes the pointer (one raycast -> instance id)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    NOTES.forEach((_, i) => {
      for (const [mesh, k] of [[cores, 0.15], [hits, 0.5]]) {
        const s = sizes[i] * k;
        mesh.current.setMatrixAt(i, m.makeScale(s, s, s).setPosition(positions[i]));
      }
    });
    cores.current.instanceMatrix.needsUpdate = true;
    hits.current.instanceMatrix.needsUpdate = true;
    hits.current.computeBoundingSphere();
  }, [positions, sizes]);
  useLayoutEffect(() => {
    const c = new THREE.Color();
    NOTES.forEach((n, i) => cores.current.setColorAt(i, c.copy(colorOf(n)).multiplyScalar(lit[i] < 1 ? 0.18 : 1)));
    cores.current.instanceColor.needsUpdate = true;
  }, [lit]);

  const glow = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions.flatMap((p) => p.toArray()), 3));
    g.setAttribute("size", new THREE.Float32BufferAttribute(sizes.map((s) => s * 2.6), 1));
    g.setAttribute("tint", new THREE.Float32BufferAttribute(NOTES.flatMap((n) => colorOf(n).toArray()), 3));
    g.setAttribute("lit", new THREE.Float32BufferAttribute(new Float32Array(count).fill(1), 1));
    return g;
  }, [positions, sizes, count]);
  useEffect(() => {
    glow.attributes.lit.array.set(lit);
    glow.attributes.lit.needsUpdate = true;
  }, [glow, lit]);

  const glowMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glowVertex,
        fragmentShader: glowFragment,
        uniforms: { uScale: { value: 1 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  );
  usePointScale(glowMat);

  // links: one LineSegments, brightness by vertex color (additive blending)
  const lines = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(EDGES.flatMap(([a, b]) => [...positions[a].toArray(), ...positions[b].toArray()]), 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(EDGES.length * 6), 3));
    return g;
  }, [positions]);
  useEffect(() => {
    const col = lines.attributes.color.array;
    EDGES.forEach(([a, b], i) => {
      const on = active && active.has(a) && active.has(b);
      const k = !active ? 0.32 : on ? 0.95 : 0.04;
      const c = on ? [1, 1, 1] : [0.55, 0.9, 1];
      for (let j = 0; j < 2; j++) col.set(c.map((x) => x * k), i * 6 + j * 3);
    });
    lines.attributes.color.needsUpdate = true;
  }, [lines, active]);

  // data pulses travelling along every link
  const pulses = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(EDGES.length * 3), 3));
    g.setAttribute("size", new THREE.Float32BufferAttribute(EDGES.map(() => 0.55), 1));
    g.setAttribute("tint", new THREE.Float32BufferAttribute(EDGES.flatMap(() => [0.7, 0.95, 1]), 3));
    g.setAttribute("lit", new THREE.Float32BufferAttribute(new Float32Array(EDGES.length).fill(0.8), 1));
    return g;
  }, []);
  const phase = useMemo(() => EDGES.map((_, i) => (i * 0.618) % 1), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = pulses.attributes.position.array;
    const lp = pulses.attributes.lit.array;
    EDGES.forEach(([a, b], i) => {
      const u = (t * 0.22 + phase[i]) % 1;
      const pa = positions[a];
      const pb = positions[b];
      pos[i * 3] = pa.x + (pb.x - pa.x) * u;
      pos[i * 3 + 1] = pa.y + (pb.y - pa.y) * u;
      pos[i * 3 + 2] = pa.z + (pb.z - pa.z) * u;
      lp[i] = !active ? 0.8 : active.has(a) && active.has(b) ? 1.5 : 0.05;
    });
    pulses.attributes.position.needsUpdate = true;
    pulses.attributes.lit.needsUpdate = true;
  });

  return (
    <group>
      <lineSegments geometry={lines}>
        <lineBasicMaterial vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={pulses} material={glowMat} />
      <points geometry={glow} material={glowMat} />
      <instancedMesh ref={cores} args={[null, null, count]} raycast={() => null}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <instancedMesh
        ref={hits}
        args={[null, null, count]}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(e.instanceId);
        }}
        onPointerOut={() => onHover(null)}
        onClick={(e) => {
          e.stopPropagation();
          if (e.delta < 6) onPick(e.instanceId, e.nativeEvent.pointerType);
        }}
      >
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </instancedMesh>
    </group>
  );
}

// ---------- background: bokeh, light band, wave grid, frequency lines ----------
const particleVertex = /* glsl */ `
  attribute float seed;
  attribute float kind;
  uniform float uTime;
  uniform float uScale;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    if (kind < 0.5) {
      p.y = mod(p.y + uTime * (0.25 + seed * 0.6) + 15.0, 50.0) - 15.0;   // bokeh rising
      p.x += sin(uTime * 0.2 + seed * 40.0) * 1.5;
    } else {
      p.x += sin(uTime * 0.15 + seed * 30.0) * 2.5;                       // light band shimmering
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = kind < 0.5 ? mix(0.15, 1.4, pow(seed, 3.0)) : mix(0.08, 0.35, seed);
    gl_PointSize = size * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.55 + 0.45 * sin(uTime * (1.0 + seed * 3.0) + seed * 100.0);
    float far = 1.0 - smoothstep(60.0, 140.0, -mv.z);
    vAlpha = twinkle * far * (kind < 0.5 ? mix(0.9, 0.25, pow(seed, 3.0)) : 0.85);
  }
`;
const particleFragment = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.2, d) * vAlpha;
    gl_FragColor = vec4(vec3(0.75, 0.97, 1.0), a);
  }
`;

function Particles() {
  const { geometry, material } = useMemo(() => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const pos = [];
    const seeds = [];
    const kinds = [];
    for (let i = 0; i < 2600; i++) {
      pos.push((rand() - 0.5) * 160, rand() * 50 - 15, (rand() - 0.5) * 160);
      seeds.push(rand());
      kinds.push(0);
    }
    for (let i = 0; i < 1800; i++) {
      // a long glowing strip of light far behind the graph
      pos.push((rand() - 0.5) * 220, 3 + (rand() - 0.5) * (rand() * 5), -55 - rand() * 25);
      seeds.push(rand());
      kinds.push(1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
    g.setAttribute("kind", new THREE.Float32BufferAttribute(kinds, 1));
    const m = new THREE.ShaderMaterial({
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);
  usePointScale(material);
  useFrame(({ clock }) => (material.uniforms.uTime.value = clock.elapsedTime));
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

const waveVertex = /* glsl */ `
  uniform float uTime;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float t = uTime;
    p.y += sin(p.x * 0.09 + t * 0.6) * 1.6 + cos(p.z * 0.07 - t * 0.45) * 1.4
         + sin((p.x + p.z) * 0.05 + t * 0.3) * 2.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float r = length(p.xz);
    vAlpha = (1.0 - smoothstep(25.0, 85.0, r)) * (0.35 + 0.65 * smoothstep(-2.0, 3.0, p.y + 14.0));
  }
`;
const waveFragment = /* glsl */ `
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vec3(0.45, 0.85, 1.0), vAlpha * 0.32); }
`;

function WaveGrid() {
  const { geometry, material } = useMemo(() => {
    const L = 170;
    const lines = 64;
    const steps = 140;
    const pos = [];
    for (let i = 0; i <= lines; i++) {
      const a = -L / 2 + (i / lines) * L;
      for (let s = 0; s < steps; s++) {
        const b0 = -L / 2 + (s / steps) * L;
        const b1 = -L / 2 + ((s + 1) / steps) * L;
        pos.push(a, 0, b0, a, 0, b1, b0, 0, a, b1, 0, a);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.ShaderMaterial({
      vertexShader: waveVertex,
      fragmentShader: waveFragment,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    return { geometry: g, material: m };
  }, []);
  useFrame(({ clock }) => (material.uniforms.uTime.value = clock.elapsedTime));
  return <lineSegments geometry={geometry} material={material} position={[0, -16, 0]} frustumCulled={false} />;
}

const freqVertex = /* glsl */ `
  uniform float uTime;
  uniform float uLine;
  varying float vAlpha;
  float hash(float n) { return fract(sin(n) * 43758.5453); }
  void main() {
    vec3 p = position;
    float x = p.x * 0.18 + uLine * 7.0;
    float cell = floor(x);
    float spike = pow(abs(sin(x * 1.7 + uTime * (0.8 + uLine * 0.2))), 18.0) * (2.0 + 6.0 * hash(cell + uLine));
    p.y += sin(x * 0.35 + uTime * 0.5) * 0.8 + spike;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = (1.0 - smoothstep(60.0, 110.0, abs(p.x))) * (0.25 + 0.18 * uLine);
  }
`;
const freqFragment = /* glsl */ `
  varying float vAlpha;
  void main() { gl_FragColor = vec4(vec3(0.6, 0.92, 1.0), vAlpha); }
`;

function FrequencyLines() {
  const geometry = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 900; i++) pts.push(-120 + (i / 900) * 240, 0, 0);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  const materials = useMemo(
    () =>
      [0, 1, 2, 3].map(
        (i) =>
          new THREE.ShaderMaterial({
            vertexShader: freqVertex,
            fragmentShader: freqFragment,
            uniforms: { uTime: { value: 0 }, uLine: { value: i } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          })
      ),
    []
  );
  useFrame(({ clock }) => materials.forEach((m) => (m.uniforms.uTime.value = clock.elapsedTime)));
  return materials.map((m, i) => (
    <line key={i} geometry={geometry} material={m} position={[0, 20 + i * 2.2, -70 - i * 6]} frustumCulled={false} />
  ));
}

// ---------- camera: auto-orbit until touched, smooth flight to a focused node ----------
function Rig({ positions, focus, onInteract }) {
  const controls = useThree((s) => s.controls);
  const camera = useThree((s) => s.camera);
  const flight = useRef(null);
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      controls.autoRotate = false;
      flight.current = null;
      onInteract();
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls, onInteract]);
  useEffect(() => {
    if (!controls || focus == null) return;
    const to = positions[focus].clone();
    const dir = camera.position.clone().sub(controls.target).normalize();
    flight.current = {
      t0: performance.now(),
      fromT: controls.target.clone(),
      fromC: camera.position.clone(),
      toT: to,
      toC: to.clone().addScaledVector(dir, 13),
    };
    controls.autoRotate = false;
  }, [focus, controls, camera, positions]);
  useFrame(() => {
    const f = flight.current;
    if (!f || !controls) return;
    const u = Math.min(1, (performance.now() - f.t0) / 1100);
    const e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2;
    controls.target.lerpVectors(f.fromT, f.toT, e);
    camera.position.lerpVectors(f.fromC, f.toC, e);
    if (u === 1) flight.current = null;
  });
  return null;
}

// Distance at which the graph's bounding sphere fits the narrower field of view
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const half = (camera.fov * Math.PI) / 360;
    const narrow = Math.min(half, Math.atan(Math.tan(half) * (size.width / size.height)));
    camera.position.setLength((GRAPH_RADIUS / Math.sin(narrow)) * 1.08);
  }, [camera, size]);
  return null;
}

export default function Graph3D() {
  const navigate = useNavigate();
  const positions = useMemo(layout, []);
  const [hover, setHover] = useState(null);
  const [focus, setFocus] = useState(null);
  const [query, setQuery] = useState("");
  const [touched, setTouched] = useState(false);
  const [recent, setRecent] = useState(null); // keeps the card up while the pointer travels to it
  const onInteract = useCallback(() => setTouched(true), []);
  const onHover = useCallback((id) => {
    setHover(id);
    if (id != null) setRecent(id);
    document.body.style.cursor = id == null ? "" : "pointer";
  }, []);
  useEffect(() => () => (document.body.style.cursor = ""), []);

  const q = slugify(query);
  const matches = useMemo(() => (q ? NOTES.filter((n) => n.slug.includes(q)) : []), [q]);
  const lead = hover ?? focus;
  const active = useMemo(() => {
    if (lead != null) return new Set([lead, ...NEIGHBORS[lead]]);
    if (matches.length) return new Set(matches.map((n) => n.id));
    return null;
  }, [lead, matches]);
  const card = (lead ?? recent) != null ? NOTES[lead ?? recent] : null;
  const open = (id) => navigate(`/graph3d/nodo/${NOTES[id].slug}`);
  const labelled = useMemo(() => {
    const ids = new Set(NOTES.filter((n) => n.kind !== "note").map((n) => n.id));
    if (active) active.forEach((id) => ids.add(id));
    return [...ids];
  }, [active]);

  return (
    <div className="kb">
      <Canvas camera={{ position: [0, 7, 36], fov: 55, near: 0.1, far: 400 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <FitCamera />
        <Particles />
        <WaveGrid />
        <FrequencyLines />
        <Graph
          positions={positions}
          active={active}
          onHover={onHover}
          onPick={(id, pointerType) => {
            // on touch the first tap selects, the second opens
            if (pointerType === "touch" && focus !== id) setFocus(id);
            else open(id);
          }}
        />
        {labelled.map((id) => (
          <Html key={id} position={positions[id]} center distanceFactor={30} style={{ pointerEvents: "none" }} zIndexRange={[10, 0]}>
            <span className={`kb-label${NOTES[id].kind !== "note" ? " hub" : ""}${id === lead ? " lead" : ""}`}>{NOTES[id].title}</span>
          </Html>
        ))}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          autoRotate={!touched}
          autoRotateSpeed={0.35}
          screenSpacePanning
          minDistance={4}
          maxDistance={120}
        />
        <Rig positions={positions} focus={focus} onInteract={onInteract} />
      </Canvas>

      <div className="kb-scan" aria-hidden="true" />

      <header className="kb-head">
        <div className="kb-brand">
          <span className="kb-sigil" aria-hidden="true" />
          <div>
            <h1>Archivio</h1>
            <p>
              Knowledge base · {NOTES.length} nodi · {EDGES.length} collegamenti
            </p>
          </div>
        </div>
        <div className="kb-search">
          <input
            type="search"
            value={query}
            placeholder="Cerca un nodo…"
            aria-label="Cerca un nodo"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && matches[0] && open(matches[0].id)}
          />
          {matches.length > 0 && (
            <ul>
              {matches.slice(0, 6).map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => setFocus(n.id)}>
                    {n.title}
                    <small>{n.area >= 0 ? AREA_NAMES[n.area] : "Archivio"}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <ul className="kb-legend" aria-label="Aree">
        {AREA_NAMES.map((name, i) => (
          <li key={name}>
            <i style={{ background: AREA_COLORS[i], boxShadow: `0 0 8px ${AREA_COLORS[i]}` }} />
            {name}
          </li>
        ))}
      </ul>

      {card && (
        <aside className="kb-card">
          <small>{card.area >= 0 ? AREA_NAMES[card.area] : "Archivio"}</small>
          <h2>{card.title}</h2>
          <p>
            {card.links.length} collegamenti · {card.backlinks.length} citazioni
          </p>
          <Link to={`/graph3d/nodo/${card.slug}`}>Apri nodo →</Link>
        </aside>
      )}

      <p className="kb-hint">Trascina per ruotare · Tasto destro o due dita per spostare · Rotella o pizzico per lo zoom · Click su un nodo per aprirlo</p>
    </div>
  );
}
