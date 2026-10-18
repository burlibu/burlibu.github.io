import React, { useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { FaReact, FaGithub, FaNodeJs, FaDatabase } from "react-icons/fa";

const nodes = [
  { id: 0, icon: FaReact, position: [2, 0, 0] },
  { id: 1, icon: FaGithub, position: [-2, 0, 0] },
  { id: 2, icon: FaNodeJs, position: [0, 2, 0] },
  { id: 3, icon: FaDatabase, position: [0, -2, 0] },
];

function Node({ icon: Icon, position }) {
  const [hovered, setHovered] = useState(false);
  return (
    <mesh
      position={position}
      scale={hovered ? 1.5 : 1}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color={hovered ? "#61dafb" : "#888"} />
      <Html center>
        <Icon size={32} color={hovered ? "#61dafb" : "#ddd"} />
      </Html>
    </mesh>
  );
}

// Pull the camera back on narrow screens so the side nodes (x = ±2.5 with radius) stay in view
function FitCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    camera.position.z = Math.max(8, 6.5 / (size.width / size.height));
    camera.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function Graph3D() {
  return (
    <Canvas
      camera={{ position: [0, 0, 8], fov: 50 }}
      style={{ height: "100vh", width: "100%" }}
    >
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <FitCamera />
      {nodes.map((node) => (
        <Node key={node.id} icon={node.icon} position={node.position} />
      ))}
      <OrbitControls />
    </Canvas>
  );
}
