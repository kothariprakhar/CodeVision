'use client';

import { useMemo } from 'react';
import type { FlowScenario } from './FlowControlBar';

type Domain = 'auth' | 'data' | 'payments' | 'comms' | 'core' | 'infra';

type EdgeKind = 'imports' | 'calls' | 'stores' | 'renders';

interface RenderNode {
  id: string;
  domain: Domain;
}

interface RenderEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeKind;
  weight: number;
}

interface ParticleSystemProps {
  edges: RenderEdge[];
  nodes: RenderNode[];
  edgePaths: Map<string, { path: string }>;
  mode: 'off' | 'ambient' | 'scenario';
  activeScenario: FlowScenario | null;
  speed: number;
  isAnimating: boolean;
  activeEdgeIds?: Set<string>;
  domainColors: Record<Domain, string>;
}

interface Particle {
  id: string;
  edgeId: string;
  color: string;
  size: number;
  duration: number;
  delay: number;
  trailLength: number;
  opacity: number;
}

const MAX_PARTICLES = 60;

function durationForEdge(type: EdgeKind, mode: 'ambient' | 'scenario', speed: number): number {
  if (mode === 'scenario') {
    return type === 'calls' ? 1.1 / speed : type === 'stores' ? 1.8 / speed : 1.4 / speed;
  }
  if (type === 'calls') return 1.8 / speed;
  if (type === 'stores') return 2.9 / speed;
  if (type === 'renders') return 2.3 / speed;
  return 2.5 / speed;
}

function sizeForEdge(weight: number): number {
  return Math.min(6, 3 + Math.max(0, weight - 1) * 0.35);
}

export default function ParticleSystem({
  edges,
  nodes,
  edgePaths,
  mode,
  activeScenario,
  speed,
  isAnimating,
  activeEdgeIds,
  domainColors,
}: ParticleSystemProps) {
  const particles = useMemo(() => {
    if (!isAnimating || mode === 'off') return [] as Particle[];

    const nodeDomain = new Map(nodes.map(node => [node.id, node.domain]));
    const filteredEdges = mode === 'scenario' && activeEdgeIds
      ? edges.filter(edge => activeEdgeIds.has(edge.id))
      : edges;

    const next: Particle[] = [];

    filteredEdges.forEach((edge, edgeIndex) => {
      if (!edgePaths.has(edge.id)) return;

      const domain = nodeDomain.get(edge.from) || 'core';
      const color = domainColors[domain];
      const duration = durationForEdge(edge.type, mode, speed);
      const baseSize = sizeForEdge(edge.weight);
      const count = mode === 'scenario'
        ? Math.min(3, Math.max(1, Math.round(edge.weight) + 1))
        : edge.type === 'calls'
          ? 2
          : 1;

      for (let i = 0; i < count; i += 1) {
        next.push({
          id: `${edge.id}-p-${i}`,
          edgeId: edge.id,
          color,
          size: baseSize - i * 0.4,
          duration,
          delay: (edgeIndex % 5) * 0.14 + i * 0.2,
          trailLength: edge.type === 'calls' ? 2 : edge.type === 'stores' ? 1 : 1,
          opacity: mode === 'scenario' ? 0.95 : 0.78,
        });
      }
    });

    return next.slice(0, MAX_PARTICLES);
  }, [edges, nodes, edgePaths, mode, speed, isAnimating, activeEdgeIds, domainColors]);

  if (!particles.length) return null;

  return (
    <g className="pointer-events-none">
      <defs>
        <filter id="particle-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {particles.map(particle => {
        const edge = edgePaths.get(particle.edgeId);
        if (!edge) return null;

        return (
          <g key={particle.id}>
            <circle
              r={Math.max(1.5, particle.size * 1.9)}
              fill={particle.color}
              opacity={particle.opacity * 0.25}
              filter="url(#particle-glow)"
            >
              <animateMotion
                dur={`${particle.duration}s`}
                begin={`${particle.delay}s`}
                repeatCount="indefinite"
                path={edge.path}
              />
            </circle>

            <circle
              r={Math.max(1.4, particle.size)}
              fill={particle.color}
              opacity={particle.opacity}
            >
              <animateMotion
                dur={`${particle.duration}s`}
                begin={`${particle.delay}s`}
                repeatCount="indefinite"
                path={edge.path}
              />
            </circle>

            {Array.from({ length: particle.trailLength }).map((_, index) => (
              <circle
                key={`${particle.id}-trail-${index}`}
                r={Math.max(1, particle.size * (1 - (index + 1) * 0.24))}
                fill={particle.color}
                opacity={Math.max(0.2, particle.opacity - (index + 1) * 0.25)}
              >
                <animateMotion
                  dur={`${particle.duration}s`}
                  begin={`${particle.delay + (index + 1) * 0.08}s`}
                  repeatCount="indefinite"
                  path={edge.path}
                />
              </circle>
            ))}
          </g>
        );
      })}

      {mode === 'scenario' && activeScenario && (
        <title>{activeScenario.trigger}</title>
      )}
    </g>
  );
}
