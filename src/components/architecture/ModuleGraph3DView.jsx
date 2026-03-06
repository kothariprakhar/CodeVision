'use client';

import { useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls } from '@react-three/drei';
import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force-3d';
import * as THREE from 'three';

function computeLayout(nodes, edges) {
  const layoutNodes = nodes.map(node => ({
    id: node.id,
    x: node.position_seed?.x ?? ((Math.random() - 0.5) * 18),
    y: node.position_seed?.y ?? ((Math.random() - 0.5) * 6),
    z: node.position_seed?.z ?? ((Math.random() - 0.5) * 18),
  }));

  const layoutLinks = edges
    .filter(edge => nodes.some(node => node.id === edge.from) && nodes.some(node => node.id === edge.to))
    .map(edge => ({ source: edge.from, target: edge.to }));

  const simulation = forceSimulation(layoutNodes)
    .force('charge', forceManyBody().strength(-30))
    .force('center', forceCenter(0, 0, 0))
    .force('link', forceLink(layoutLinks).id(node => node.id).distance(3.8).strength(0.18))
    .stop();

  for (let i = 0; i < 120; i += 1) {
    simulation.tick();
  }

  return new Map(layoutNodes.map(node => [node.id, [node.x || 0, node.y || 0, node.z || 0]]));
}

function hotnessColor(hotness) {
  const cool = new THREE.Color('#32425c');
  const warm = new THREE.Color('#ff5dd8');
  return cool.clone().lerp(warm, Math.max(0, Math.min(1, hotness)));
}

function CameraFocus({ targetPosition }) {
  const { camera } = useThree();

  useFrame(() => {
    if (!targetPosition) return;
    const desired = new THREE.Vector3(
      targetPosition[0] + 4,
      targetPosition[1] + 2.5,
      targetPosition[2] + 5
    );
    camera.position.lerp(desired, 0.065);
    camera.lookAt(targetPosition[0], targetPosition[1], targetPosition[2]);
  });

  return null;
}

function GraphScene({ graphData, selectedNodeId, onSelectNode }) {
  const layout = useMemo(
    () => computeLayout(graphData.nodes, graphData.edges),
    [graphData.nodes, graphData.edges]
  );
  const [hoveredNodeId, setHoveredNodeId] = useState(null);

  const selectedPosition = selectedNodeId ? layout.get(selectedNodeId) : null;

  const lineGeometry = useMemo(() => {
    const positions = [];
    graphData.edges.forEach(edge => {
      const from = layout.get(edge.from);
      const to = layout.get(edge.to);
      if (!from || !to) return;
      positions.push(from[0], from[1], from[2], to[0], to[1], to[2]);
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [graphData.edges, layout]);

  useEffect(() => {
    return () => {
      lineGeometry.dispose();
    };
  }, [lineGeometry]);

  return (
    <>
      <color attach="background" args={['#05070c']} />
      <fog attach="fog" args={['#05070c', 18, 60]} />

      <ambientLight intensity={0.48} />
      <pointLight position={[10, 12, 8]} intensity={1.1} color="#78b8ff" />
      <pointLight position={[-10, 9, -8]} intensity={0.8} color="#ff6df0" />

      <gridHelper args={[70, 70, '#1d2b44', '#111826']} position={[0, -2.5, 0]} />

      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#7ea6ff" transparent opacity={0.22} />
      </lineSegments>

      {graphData.nodes.map(node => {
        const position = layout.get(node.id) || [0, 0, 0];
        const isSelected = selectedNodeId === node.id;
        const isDirectory = node.node_kind === 'directory';
        const scale = isDirectory
          ? 0.55 + (node.importance_score || 0) * 0.75
          : 0.12 + Math.min((node.loc || 1) / 260, 0.48);
        const color = hotnessColor(node.hotness_score || 0.2);
        const emissiveIntensity = isSelected ? 0.55 : 0.2 + (node.hotness_score || 0) * 0.32;

        return (
          <mesh
            key={node.id}
            position={position}
            scale={[scale, scale, scale]}
            onClick={() => onSelectNode(node.id)}
            onPointerOver={event => {
              event.stopPropagation();
              setHoveredNodeId(node.id);
            }}
            onPointerOut={() => setHoveredNodeId(current => (current === node.id ? null : current))}
          >
            <sphereGeometry args={[1, isDirectory ? 22 : 14, isDirectory ? 22 : 14]} />
            <meshStandardMaterial
              color={color}
              transparent
              opacity={isDirectory ? 0.9 : 0.82}
              roughness={isDirectory ? 0.2 : 0.55}
              metalness={isDirectory ? 0.52 : 0.18}
              emissive={color}
              emissiveIntensity={emissiveIntensity}
            />
            {hoveredNodeId === node.id && (
              <Html distanceFactor={16} position={[0, 1.4, 0]} center>
                <div className="rounded-lg border border-white/25 bg-black/70 px-2 py-1 text-[11px] text-white shadow-lg backdrop-blur-sm">
                  <p className="font-semibold">{node.label}</p>
                  <p className="text-[10px] text-gray-300">
                    {node.node_kind} · LOC {node.loc} · Hotness {Math.round((node.hotness_score || 0) * 100)}%
                  </p>
                </div>
              </Html>
            )}
          </mesh>
        );
      })}

      <CameraFocus targetPosition={selectedPosition} />
      <OrbitControls enablePan enableZoom enableRotate dampingFactor={0.12} />
    </>
  );
}

export default function ModuleGraph3DView({ graphData, selectedNodeId, onSelectNode }) {
  return (
    <div className="h-[560px] w-full rounded-xl border border-white/10 bg-black/30">
      <Canvas camera={{ position: [10, 8, 14], fov: 52 }} dpr={[1, 1.6]}>
        <GraphScene
          graphData={graphData}
          selectedNodeId={selectedNodeId}
          onSelectNode={onSelectNode}
        />
      </Canvas>
    </div>
  );
}
