'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';
import type { BusinessFlow } from '@/components/BusinessFlowView';
import FlowControlBar, { type FlowScenario } from './FlowControlBar';
import ParticleSystem from './ParticleSystem';
import { buildDomainColors, buildNodeDomainMap, colorFromDomain } from './domain-utils';
import type { ArchitectureDomain, ArchitectureVisualization, BusinessContext } from './types';

interface LiveSystemViewProps {
  architecture: ArchitectureVisualization;
  flows: BusinessFlow[];
  founderMode?: boolean;
  founderDescriptions?: Record<string, string>;
  businessContext?: BusinessContext | null;
  architectureDomains?: ArchitectureDomain[];
}

interface RenderNode {
  id: string;
  label: string;
  description: string;
  domain: string;
  complexity: 'low' | 'medium' | 'high';
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
  styleKind: 'data_flow' | 'reads_from' | 'triggers';
  weight: number;
}

function inferNodeKind(type: string, name: string): 'database' | 'external' | 'queue' | 'service' {
  const joined = `${type} ${name}`.toLowerCase();
  if (/(database|db|storage|cache|redis|postgres|mongo)/.test(joined)) return 'database';
  if (/(external|third|stripe|twilio|s3|gcp|azure)/.test(joined)) return 'external';
  if (/(queue|worker|job|celery|bull|sidekiq)/.test(joined)) return 'queue';
  return 'service';
}

function buildLayout(architecture: ArchitectureVisualization, nodeDomains: Map<string, string>) {
  const rankedNodes = architecture.nodes.map((node) => ({
    id: node.id,
    label: node.name,
    description: node.description || '',
    complexity: node.complexity,
    domain: nodeDomains.get(node.id) || 'core',
    kind: inferNodeKind(node.type, node.name),
    fileCount: node.files?.length || 0,
  }));

  const nodeById = new Map(rankedNodes.map(node => [node.id, node]));
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();

  rankedNodes.forEach(node => {
    indegree.set(node.id, 0);
    outgoing.set(node.id, []);
  });

  architecture.edges.forEach(edge => {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) return;
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  });

  const queue = rankedNodes.filter(node => (indegree.get(node.id) || 0) === 0).map(node => node.id);
  const level = new Map<string, number>();
  rankedNodes.forEach(node => level.set(node.id, 0));

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const nextLevel = (level.get(current) || 0) + 1;
    (outgoing.get(current) || []).forEach(target => {
      if (nextLevel > (level.get(target) || 0)) {
        level.set(target, nextLevel);
      }
      indegree.set(target, (indegree.get(target) || 0) - 1);
      if ((indegree.get(target) || 0) === 0) queue.push(target);
    });
  }

  const xStart = 70;
  const yStart = 70;
  const xGap = 320;
  const yGap = 175;

  const layers = new Map<number, typeof rankedNodes>();
  rankedNodes.forEach(node => {
    const layer = level.get(node.id) || 0;
    if (!layers.has(layer)) layers.set(layer, []);
    layers.get(layer)?.push(node);
  });

  const nodes: RenderNode[] = [];
  Array.from(layers.keys()).sort((a, b) => a - b).forEach((layer, layerIndex) => {
    const layerNodes = layers.get(layer) || [];
    layerNodes.sort((a, b) => b.fileCount - a.fileCount || a.label.localeCompare(b.label));
    layerNodes.forEach((node, index) => {
      nodes.push({
        id: node.id,
        label: node.label,
        description: node.description,
        complexity: node.complexity,
        domain: node.domain,
        x: xStart + index * xGap,
        y: yStart + layerIndex * yGap,
        width: 270,
        height: 104,
      });
    });
  });

  const finalMaxX = nodes.reduce((max, node) => Math.max(max, node.x + node.width), 0);
  const finalMaxY = nodes.reduce((max, node) => Math.max(max, node.y + node.height), 0);

  const edges: RenderEdge[] = architecture.edges
    .filter(edge => nodeById.has(edge.from) && nodeById.has(edge.to))
    .map((edge, index) => ({
      id: `${edge.from}-${edge.to}-${index}`,
      from: edge.from,
      to: edge.to,
      type: edge.type,
      label: edge.label || (edge.type === 'stores' ? 'reads/stores data' : edge.type === 'calls' ? 'triggers action' : 'sends data'),
      styleKind: edge.type === 'stores' ? 'reads_from' : edge.type === 'calls' ? 'triggers' : 'data_flow',
      weight: 1,
    }));

  return {
    nodes,
    edges,
    width: Math.max(1200, finalMaxX + 140),
    height: Math.max(760, finalMaxY + 140),
  };
}

function edgeStyle(edge: RenderEdge, isActive: boolean): { stroke: string; width: number; dash?: string; opacity: number } {
  const baseWidth = edge.styleKind === 'data_flow' ? 2 : edge.styleKind === 'triggers' ? 2.4 : 1.9;
  const width = Math.min(5.4, baseWidth + edge.weight * 0.2 + (isActive ? 0.8 : 0));
  if (edge.styleKind === 'reads_from') {
    return { stroke: 'rgba(120, 220, 190, 0.95)', width, dash: '7 5', opacity: isActive ? 1 : 0.5 };
  }
  if (edge.styleKind === 'triggers') {
    return { stroke: 'rgba(255, 208, 112, 0.96)', width, dash: '2 6', opacity: isActive ? 1 : 0.56 };
  }
  return { stroke: 'rgba(138, 168, 255, 0.94)', width, opacity: isActive ? 1 : 0.55 };
}

function buildScenarios(flows: BusinessFlow[], edges: RenderEdge[]): Array<FlowScenario & { dataByStep: string[]; personaByStep: string[] }> {
  const edgeMap = new Map<string, RenderEdge[]>();
  edges.forEach(edge => {
    const key = `${edge.from}->${edge.to}`;
    if (!edgeMap.has(key)) edgeMap.set(key, []);
    edgeMap.get(key)?.push(edge);
  });

  return flows
    .filter(flow => flow.steps.length > 1)
    .map(flow => {
      const steps = [...flow.steps].sort((a, b) => a.order - b.order);
      const moduleSequence = steps.map(step => step.moduleId);
      const stepEdges: string[][] = [];

      for (let i = 0; i < moduleSequence.length - 1; i += 1) {
        const key = `${moduleSequence[i]}->${moduleSequence[i + 1]}`;
        stepEdges.push((edgeMap.get(key) || []).map(edge => edge.id));
      }

      return {
        id: flow.id,
        name: flow.title,
        trigger: flow.trigger,
        steps: steps.map(step => ({
          moduleId: step.moduleId,
          label: `${step.actor} ${step.action}`,
          duration: 1800,
        })),
        involvedEdges: Array.from(new Set(stepEdges.flat())),
        stepEdges,
        dataByStep: steps.map(step => step.data_passed || ''),
        personaByStep: steps.map(step => step.actor || 'The system'),
      };
    });
}

export default function LiveSystemView({
  architecture,
  flows,
  founderMode = false,
  founderDescriptions,
  businessContext,
  architectureDomains,
}: LiveSystemViewProps) {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [animMode, setAnimMode] = useState<'off' | 'ambient' | 'scenario'>('off');
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [animSpeed, setAnimSpeed] = useState(1);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());

  const svgRef = useRef<SVGSVGElement | null>(null);
  const stepStartRef = useRef<number | null>(null);

  const nodeDomains = useMemo(
    () => buildNodeDomainMap(architecture.nodes, architectureDomains),
    [architecture.nodes, architectureDomains]
  );
  const discoveredDomains = useMemo(() => {
    const domains = Array.from(new Set(Array.from(nodeDomains.values())));
    return domains.length ? domains : ['core'];
  }, [nodeDomains]);
  const domainColors = useMemo(
    () => buildDomainColors(architectureDomains, discoveredDomains),
    [architectureDomains, discoveredDomains]
  );

  const layout = useMemo(() => buildLayout(architecture, nodeDomains), [architecture, nodeDomains]);

  const renderedNodes = useMemo(
    () => layout.nodes.filter(node => !hiddenDomains.has(node.domain)),
    [layout.nodes, hiddenDomains]
  );
  const renderedNodeMap = useMemo(() => new Map(renderedNodes.map(node => [node.id, node])), [renderedNodes]);
  const renderedNodeIds = useMemo(() => new Set(renderedNodes.map(node => node.id)), [renderedNodes]);
  const renderedEdges = useMemo(
    () => layout.edges.filter(edge => renderedNodeIds.has(edge.from) && renderedNodeIds.has(edge.to)),
    [layout.edges, renderedNodeIds]
  );
  const edgePaths = useMemo(() => {
    const map = new Map<string, { path: string }>();
    renderedEdges.forEach(edge => {
      const source = renderedNodeMap.get(edge.from);
      const target = renderedNodeMap.get(edge.to);
      if (!source || !target) return;
      const sx = source.x + source.width / 2;
      const sy = source.y + source.height / 2;
      const tx = target.x + target.width / 2;
      const ty = target.y + target.height / 2;
      const midY = sy + (ty - sy) / 2;
      map.set(edge.id, { path: `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}` });
    });
    return map;
  }, [renderedEdges, renderedNodeMap]);

  const scenarios = useMemo(() => buildScenarios(flows, layout.edges), [flows, layout.edges]);
  const activeScenario = useMemo(
    () => scenarios.find(scenario => scenario.id === activeScenarioId) || null,
    [scenarios, activeScenarioId]
  );

  const normalizedStepIndex = useMemo(() => {
    if (!activeScenario || activeScenario.steps.length === 0) return 0;
    return currentStepIndex % activeScenario.steps.length;
  }, [activeScenario, currentStepIndex]);

  const scenarioActiveEdgeIds = useMemo(() => {
    if (animMode !== 'scenario' || !activeScenario || !isAnimating) return new Set<string>();
    const upToStep = activeScenario.stepEdges.slice(0, Math.max(0, normalizedStepIndex + 1));
    return new Set(upToStep.flat());
  }, [animMode, activeScenario, isAnimating, normalizedStepIndex]);

  const activeNodeIds = useMemo(() => {
    if (animMode !== 'scenario' || !activeScenario || !isAnimating) return new Set<string>();
    const current = activeScenario.steps[normalizedStepIndex];
    return current ? new Set([current.moduleId]) : new Set<string>();
  }, [animMode, activeScenario, isAnimating, normalizedStepIndex]);

  const currentStep = useMemo(() => {
    if (!activeScenario || activeScenario.steps.length === 0) return null;
    return activeScenario.steps[normalizedStepIndex] || null;
  }, [activeScenario, normalizedStepIndex]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const applyPreference = () => {
      const reduced = mediaQuery.matches;
      setPrefersReducedMotion(reduced);
      if (reduced) {
        setAnimMode('off');
        setIsAnimating(false);
      }
    };

    applyPreference();
    mediaQuery.addEventListener('change', applyPreference);
    return () => mediaQuery.removeEventListener('change', applyPreference);
  }, []);

  useEffect(() => {
    if (animMode !== 'scenario' || !activeScenario || !isAnimating || prefersReducedMotion) {
      stepStartRef.current = null;
      return;
    }

    let frameId = 0;
    const tick = (timestamp: number) => {
      if (!activeScenario || activeScenario.steps.length === 0) return;
      if (stepStartRef.current === null) stepStartRef.current = timestamp;

      const safeIndex = Math.min(normalizedStepIndex, activeScenario.steps.length - 1);
      const step = activeScenario.steps[safeIndex];
      const duration = Math.max(450, step.duration / animSpeed);
      const elapsed = timestamp - (stepStartRef.current || timestamp);
      const progress = Math.min(1, elapsed / duration);
      setStepProgress(progress);

      if (elapsed >= duration) {
        setCurrentStepIndex(prev => (prev + 1) % activeScenario.steps.length);
        stepStartRef.current = timestamp;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [animMode, activeScenario, isAnimating, normalizedStepIndex, animSpeed, prefersReducedMotion]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || animMode === 'off') return;
    if (isAnimating) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [animMode, isAnimating, renderedEdges.length]);

  const toggleDomain = (domain: string) => {
    setHiddenDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) {
        next.delete(domain);
      } else {
        next.add(domain);
      }
      if (next.size >= discoveredDomains.length) return new Set<string>();
      return next;
    });
  };

  const handleAnimationToggle = () => {
    if (prefersReducedMotion) return;
    if (animMode === 'off') {
      setAnimMode(activeScenarioId ? 'scenario' : 'ambient');
      setIsAnimating(true);
      return;
    }
    setIsAnimating(value => !value);
  };

  const handleScenarioSelect = (id: string | null) => {
    setActiveScenarioId(id);
    setCurrentStepIndex(0);
    setStepProgress(0);
    stepStartRef.current = null;

    if (prefersReducedMotion) return;
    if (id) {
      setAnimMode('scenario');
      setIsAnimating(true);
      return;
    }
    setAnimMode(isAnimating ? 'ambient' : 'off');
  };

  const graphCanvasWidth = Math.max(400, layout.width * zoomLevel);
  const graphCanvasHeight = Math.max(320, layout.height * zoomLevel);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        {discoveredDomains.map(domain => (
          <button
            key={domain}
            onClick={() => toggleDomain(domain)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              hiddenDomains.has(domain) ? 'text-gray-400' : 'text-white'
            }`}
            style={{
              borderColor: hiddenDomains.has(domain) ? 'rgba(255,255,255,0.16)' : `${(domainColors[domain] || colorFromDomain(domain))}CC`,
              background: hiddenDomains.has(domain) ? 'rgba(255,255,255,0.02)' : `${(domainColors[domain] || colorFromDomain(domain))}33`,
            }}
          >
            {domain}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2 text-xs text-gray-300">
          <span>Zoom</span>
          <input
            aria-label="Diagram zoom"
            type="range"
            min={0.45}
            max={1.3}
            step={0.01}
            value={zoomLevel}
            onChange={event => setZoomLevel(Number(event.target.value))}
            className="h-1.5 w-28 accent-indigo-400"
          />
          <span className="w-14 text-right">{Math.round(zoomLevel * 100)}%</span>
        </div>
      </div>

      <FlowControlBar
        isAnimating={isAnimating}
        mode={animMode}
        scenarios={scenarios}
        activeScenarioId={activeScenarioId}
        speed={animSpeed}
        disabled={prefersReducedMotion}
        currentStep={currentStep && activeScenario
          ? { index: normalizedStepIndex, total: activeScenario.steps.length, label: currentStep.label }
          : undefined}
        onToggle={handleAnimationToggle}
        onSelectScenario={handleScenarioSelect}
        onSpeedChange={setAnimSpeed}
      />

      <div className="overflow-auto rounded-2xl border border-white/10 bg-[#05070d]">
        <div
          className="relative"
          style={{
            width: graphCanvasWidth,
            height: graphCanvasHeight,
          }}
        >
          <div
            className="relative"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'top left',
            }}
          >
            <svg ref={svgRef} width={layout.width} height={layout.height} className="absolute inset-0">
              <defs>
                <pattern id="live-grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                  <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(122,136,166,0.12)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#live-grid-pattern)" />

              {renderedEdges.map(edge => {
                const source = renderedNodeMap.get(edge.from);
                const target = renderedNodeMap.get(edge.to);
                if (!source || !target) return null;
                const edgePath = edgePaths.get(edge.id);
                if (!edgePath) return null;

                let style = edgeStyle(edge, true);
                const isScenarioPlaying = animMode === 'scenario' && isAnimating && activeScenario;
                if (isScenarioPlaying) {
                  if (scenarioActiveEdgeIds.has(edge.id)) {
                    style = { ...style, width: Math.max(style.width, 4), opacity: 1 };
                  } else {
                    style = { ...style, width: Math.max(1, style.width * 0.7), opacity: 0.08 };
                  }
                }

                return (
                  <path
                    key={edge.id}
                    d={edgePath.path}
                    fill="none"
                    stroke={style.stroke}
                    strokeWidth={style.width}
                    strokeDasharray={style.dash}
                    opacity={style.opacity}
                  />
                );
              })}

              {animMode !== 'off' && (
                <ParticleSystem
                  edges={renderedEdges}
                  nodes={renderedNodes.map(node => ({ id: node.id, domain: node.domain }))}
                  edgePaths={edgePaths}
                  mode={animMode}
                  activeScenario={activeScenario}
                  speed={animSpeed}
                  isAnimating={isAnimating}
                  activeEdgeIds={scenarioActiveEdgeIds}
                  domainColors={domainColors}
                />
              )}
            </svg>

            {renderedNodes.map(node => {
              const isScenarioPlaying = animMode === 'scenario' && isAnimating && activeScenario;
              const isScenarioActiveNode = activeNodeIds.has(node.id);
              const isScenarioDimmed = isScenarioPlaying && !isScenarioActiveNode;
              const color = domainColors[node.domain] || colorFromDomain(node.domain);
              const nodeStyle: CSSProperties = {
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                borderColor: `${color}B3`,
                background: 'rgba(7,10,17,0.82)',
                boxShadow: `0 0 0 1px ${color}24`,
                opacity: isScenarioDimmed ? 0.25 : 1,
                transform: isScenarioActiveNode ? 'scale(1.05)' : 'scale(1)',
                '--domain-color': color,
              } as CSSProperties;

              const pulseClass = node.complexity === 'high'
                ? 'live-node-high'
                : node.complexity === 'medium'
                  ? 'live-node-medium'
                  : 'live-node-low';

              return (
                <div
                  key={node.id}
                  className={`absolute rounded-xl border px-3 py-2 text-left transition-all ${pulseClass}`}
                  style={nodeStyle}
                >
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{node.domain}</div>
                  <div className="mt-1 truncate text-sm font-semibold text-white">{node.label}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-gray-300">
                    {founderMode && founderDescriptions?.[node.id]
                      ? founderDescriptions[node.id]
                      : simplifyForFounder(node.description || 'Core system module', founderMode)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {animMode === 'scenario' && isAnimating && currentStep && activeScenario && (
        <div className="rounded-2xl border border-white/10 bg-black/70 p-4 backdrop-blur-lg">
          <div className="text-xs text-indigo-300">
            {activeScenario.name}
            {businessContext?.problem_statement ? ` - ${simplifyForFounder(businessContext.problem_statement, true)}` : ''}
          </div>
          <div className="mt-1 text-sm leading-relaxed text-white/90">
            {currentStep.label}
          </div>
          {activeScenario.dataByStep[normalizedStepIndex] && (
            <div className="mt-1 text-xs text-emerald-400/80">
              → Passing: {simplifyForFounder(activeScenario.dataByStep[normalizedStepIndex], founderMode)}
            </div>
          )}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full transition-[width] duration-150 ease-out"
              style={{
                width: `${Math.round(stepProgress * 100)}%`,
                background: domainColors[renderedNodeMap.get(currentStep.moduleId)?.domain || 'core'] || colorFromDomain('core'),
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
