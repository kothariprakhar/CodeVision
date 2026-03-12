'use client';

// ABOUTME: Interactive physics-based architecture diagram with domain coloring and particle system.
// ABOUTME: Renders nodes as SVG cards with force-directed layout, fullscreen mode, and founder-friendly mode.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { simplifyForFounder } from '@/lib/utils/founder-language';
import { normalizeDiagramText, sanitizeDiagramText } from '@/lib/utils/text-quality';
import type { BusinessFlow } from './BusinessFlowView';
import { buildDomainColors, buildNodeDomainMap, colorFromDomain } from './diagram/domain-utils';
import type { ArchitectureDomain, ArchitectureVisualization } from './diagram/types';
import ParticleSystem from './diagram/ParticleSystem';
import FlowControlBar, { type FlowScenario } from './diagram/FlowControlBar';

type DiagramNodeKind = 'service' | 'database' | 'external' | 'queue' | 'domain';
const FIXED_SIM_SPEED = 0.5;

interface ArchitectureDiagramProps {
  architecture: ArchitectureVisualization;
  highlightedNodeId?: string | null;
  founderMode?: boolean;
  founderDescriptions?: Record<string, string>;
  flows?: BusinessFlow[];
  architectureDomains?: ArchitectureDomain[];
}

interface RenderNode {
  id: string;
  label: string;
  description: string;
  businessRole?: string;
  domain: string;
  kind: DiagramNodeKind;
  fileCount: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RenderEdge {
  id: string;
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
  label: string;
  data_flow?: string;
  trigger?: string;
  styleKind: 'data_flow' | 'reads_from' | 'triggers';
  weight: number;
}

function titleCase(input: string): string {
  if (!input) return '';
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function inferNodeKind(type: string, name: string): Exclude<DiagramNodeKind, 'domain'> {
  const joined = `${type} ${name}`.toLowerCase();
  if (/(database|db|storage|cache|redis|postgres|mongo)/.test(joined)) return 'database';
  if (/(external|third|stripe|twilio|s3|gcp|azure)/.test(joined)) return 'external';
  if (/(queue|worker|job|celery|bull|sidekiq)/.test(joined)) return 'queue';
  return 'service';
}

function edgeVisual(type: RenderEdge['type']): { styleKind: RenderEdge['styleKind']; label: string } {
  if (type === 'stores') return { styleKind: 'reads_from', label: 'reads/stores data' };
  if (type === 'calls') return { styleKind: 'triggers', label: 'triggers action' };
  if (type === 'renders') return { styleKind: 'data_flow', label: 'renders output' };
  return { styleKind: 'data_flow', label: 'sends data' };
}

function nodeSize(kind: DiagramNodeKind): { width: number; height: number } {
  if (kind === 'domain') return { width: 270, height: 115 };
  if (kind === 'database' || kind === 'external' || kind === 'queue') return { width: 260, height: 95 };
  return { width: 270, height: 105 };
}

function buildDetailedLayout(
  architecture: ArchitectureVisualization,
  nodeDomains: Map<string, string>
): { nodes: RenderNode[]; edges: RenderEdge[]; width: number; height: number } {
  const rankedNodes = architecture.nodes.map(node => ({
    id: node.id,
    label: sanitizeDiagramText(node.name, 'node_label', { target: node.name }),
    description: sanitizeDiagramText(node.description || '', 'node_description', { target: node.name }),
    businessRole: normalizeDiagramText(node.business_role || ''),
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
    const next = outgoing.get(edge.from);
    if (next) next.push(edge.to);
  });

  const queue = rankedNodes
    .filter(node => (indegree.get(node.id) || 0) === 0)
    .map(node => node.id);
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
      if ((indegree.get(target) || 0) === 0) {
        queue.push(target);
      }
    });
  }

  rankedNodes.forEach(node => {
    const base = level.get(node.id) || 0;
    const kindBoost = node.kind === 'database' ? 2 : node.kind === 'queue' ? 1 : 0;
    level.set(node.id, base + kindBoost);
  });

  const layers = new Map<number, typeof rankedNodes>();
  rankedNodes.forEach(node => {
    const l = level.get(node.id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)?.push(node);
  });

  const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);
  const positioned: RenderNode[] = [];

  const xStart = 70;
  const yStart = 70;
  const xGap = 380;
  const yGap = 220;

  sortedLayerKeys.forEach((layer, layerIndex) => {
    const layerNodes = layers.get(layer) || [];
    layerNodes.sort((a, b) => b.fileCount - a.fileCount || a.label.localeCompare(b.label));
    layerNodes.forEach((node, index) => {
      const dims = nodeSize(node.kind);
      positioned.push({
        ...node,
        x: xStart + index * xGap,
        y: yStart + layerIndex * yGap,
        width: dims.width,
        height: dims.height,
      });
    });
  });

  const nonExternal = positioned.filter(node => node.kind !== 'external');
  const external = positioned.filter(node => node.kind === 'external');
  const maxX = nonExternal.reduce((max, node) => Math.max(max, node.x), xStart);
  const maxY = nonExternal.reduce((max, node) => Math.max(max, node.y), yStart);

  external.forEach((node, index) => {
    node.x = maxX + 330;
    node.y = yStart + index * yGap;
  });

  const databases = positioned.filter(node => node.kind === 'database');
  const floorY = Math.max(maxY + 180, yStart + sortedLayerKeys.length * yGap);
  databases.forEach((node, index) => {
    node.y = floorY + index * 16;
  });

  const finalMaxX = positioned.reduce((max, node) => Math.max(max, node.x + node.width), 0);
  const finalMaxY = positioned.reduce((max, node) => Math.max(max, node.y + node.height), 0);

  const edgeWeightByPair = new Map<string, number>();
  architecture.edges.forEach((edge) => {
    const key = `${edge.from}->${edge.to}:${edge.type}`;
    edgeWeightByPair.set(key, (edgeWeightByPair.get(key) || 0) + 1);
  });

  const edges: RenderEdge[] = architecture.edges
    .filter(edge => nodeById.has(edge.from) && nodeById.has(edge.to))
    .map((edge, index) => {
      const visual = edgeVisual(edge.type);
      const key = `${edge.from}->${edge.to}:${edge.type}`;
      return {
        id: `${edge.from}-${edge.to}-${index}`,
        from: edge.from,
        to: edge.to,
        type: edge.type,
        label: sanitizeDiagramText(
          edge.label || visual.label,
          'edge_label',
          { relation: edge.type, source: edge.from, target: edge.to.replace(/^external:/, '') }
        ),
        data_flow: edge.data_flow ? normalizeDiagramText(edge.data_flow) : edge.data_flow,
        trigger: edge.trigger ? normalizeDiagramText(edge.trigger) : edge.trigger,
        styleKind: visual.styleKind,
        weight: edgeWeightByPair.get(key) || 1,
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 30);

  return {
    nodes: positioned,
    edges,
    width: Math.max(1200, finalMaxX + 140),
    height: Math.max(760, finalMaxY + 140),
  };
}

function buildGroupedLayout(
  architecture: ArchitectureVisualization,
  nodeDomains: Map<string, string>
): { nodes: RenderNode[]; edges: RenderEdge[]; width: number; height: number } {
  const counts = new Map<string, number>();

  architecture.nodes.forEach(node => {
    const domain = nodeDomains.get(node.id) || 'core';
    counts.set(domain, (counts.get(domain) || 0) + 1);
  });

  const domains = Array.from(counts.keys()).filter(domain => (counts.get(domain) || 0) > 0);

  const columns = 3;
  const xStart = 110;
  const yStart = 110;
  const xGap = 360;
  const yGap = 235;

  const nodes: RenderNode[] = domains.map((domain, idx) => {
    const row = Math.floor(idx / columns);
    const col = idx % columns;
    const dims = nodeSize('domain');
    return {
      id: `domain:${domain}`,
      label: `${titleCase(domain)} Domain`,
      description: sanitizeDiagramText(`${counts.get(domain) || 0} major modules`, 'node_description', {
        target: `${titleCase(domain)} domain`,
      }),
      domain,
      kind: 'domain',
      fileCount: counts.get(domain) || 0,
      x: xStart + col * xGap,
      y: yStart + row * yGap,
      width: dims.width,
      height: dims.height,
      businessRole: '',
    };
  });

  const edgeWeights = new Map<string, number>();
  architecture.edges.forEach(edge => {
    const sourceDomain = nodeDomains.get(edge.from);
    const targetDomain = nodeDomains.get(edge.to);
    if (!sourceDomain || !targetDomain || sourceDomain === targetDomain) return;
    const key = `${sourceDomain}->${targetDomain}`;
    edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
  });

  const edges: RenderEdge[] = Array.from(edgeWeights.entries()).map(([key, weight], index) => {
    const [sourceDomain, targetDomain] = key.split('->');
    return {
      id: `group-${index}`,
      from: `domain:${sourceDomain}`,
      to: `domain:${targetDomain}`,
      type: 'imports',
      label: sanitizeDiagramText(`Connects ${sourceDomain} to ${targetDomain}`, 'edge_label', {
        relation: 'imports',
        source: sourceDomain,
        target: targetDomain,
      }),
      styleKind: 'data_flow',
      weight,
    };
  });

  return {
    nodes,
    edges,
    width: Math.max(1280, xStart + columns * xGap + 120),
    height: Math.max(760, yStart + Math.ceil(domains.length / columns) * yGap),
  };
}

function edgeStyle(edge: RenderEdge, isActive: boolean): { stroke: string; width: number; dash?: string; opacity: number } {
  const baseWidth = edge.styleKind === 'data_flow' ? 2 : edge.styleKind === 'triggers' ? 2.4 : 1.9;
  const width = Math.min(5.4, baseWidth + edge.weight * 0.2 + (isActive ? 0.8 : 0));
  if (edge.styleKind === 'reads_from') {
    return {
      stroke: 'rgba(120, 220, 190, 0.95)',
      width,
      dash: '7 5',
      opacity: isActive ? 1 : 0.5,
    };
  }
  if (edge.styleKind === 'triggers') {
    return {
      stroke: 'rgba(255, 208, 112, 0.96)',
      width,
      dash: '2 6',
      opacity: isActive ? 1 : 0.56,
    };
  }
  return {
    stroke: 'rgba(138, 168, 255, 0.94)',
    width,
    opacity: isActive ? 1 : 0.55,
  };
}

function businessAnalogy(kind: DiagramNodeKind): string {
  if (kind === 'database') return 'filing cabinet for reliable records';
  if (kind === 'external') return 'outside specialist your team calls when needed';
  if (kind === 'queue') return 'back-office task line that keeps user actions fast';
  if (kind === 'domain') return 'cross-functional team responsible for one business area';
  return 'operational team executing a key workflow';
}

function buildScenarios(flows: BusinessFlow[], edges: RenderEdge[]): FlowScenario[] {
  const edgeMap = new Map<string, RenderEdge[]>();
  edges.forEach(edge => {
    const key = `${edge.from}->${edge.to}`;
    if (!edgeMap.has(key)) edgeMap.set(key, []);
    edgeMap.get(key)?.push(edge);
  });

  return flows
    .filter(flow => flow.steps.length > 1)
    .map(flow => {
      const moduleSequence = flow.steps
        .slice()
        .sort((a, b) => a.order - b.order)
        .map(step => step.moduleId);

      const stepEdges: string[][] = [];
      for (let i = 0; i < moduleSequence.length - 1; i += 1) {
        const key = `${moduleSequence[i]}->${moduleSequence[i + 1]}`;
        const matching = (edgeMap.get(key) || []).map(edge => edge.id);
        stepEdges.push(matching);
      }

      const involvedEdges = Array.from(new Set(stepEdges.flat()));
      return {
        id: flow.id,
        name: flow.title,
        trigger: flow.trigger,
        steps: flow.steps
          .slice()
          .sort((a, b) => a.order - b.order)
          .map(step => ({
            moduleId: step.moduleId,
            label: `${step.actor} ${step.action}`,
            duration: 1800,
          })),
        involvedEdges,
        stepEdges,
      };
    });
}

export default function ArchitectureDiagram({
  architecture,
  highlightedNodeId,
  founderMode = false,
  founderDescriptions,
  flows = [],
  architectureDomains,
}: ArchitectureDiagramProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hiddenDomains, setHiddenDomains] = useState<Set<string>>(new Set());
  const [animMode, setAnimMode] = useState<'off' | 'ambient' | 'scenario'>('off');
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepProgress, setStepProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [canvasViewport, setCanvasViewport] = useState({
    left: 0,
    top: 0,
    scrollLeft: 0,
    scrollTop: 0,
    width: 0,
    height: 0,
    windowWidth: 0,
    windowHeight: 0,
  });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const stepStartRef = useRef<number | null>(null);
  const originalBodyOverflowRef = useRef<string>('');

  const nodeDomains = useMemo(
    () => buildNodeDomainMap(architecture.nodes, architectureDomains),
    [architecture.nodes, architectureDomains]
  );

  const discoveredDomains = useMemo(() => {
    const ranked = Array.from(new Set(Array.from(nodeDomains.values())));
    return ranked.length ? ranked : ['core'];
  }, [nodeDomains]);

  const domainColors = useMemo(
    () => buildDomainColors(architectureDomains, discoveredDomains),
    [architectureDomains, discoveredDomains]
  );

  const domainPurposeByName = useMemo(
    () => new Map((architectureDomains || []).map(domain => [domain.name, domain.purpose])),
    [architectureDomains]
  );

  const detailed = useMemo(() => buildDetailedLayout(architecture, nodeDomains), [architecture, nodeDomains]);
  const grouped = useMemo(() => buildGroupedLayout(architecture, nodeDomains), [architecture, nodeDomains]);
  const scenarios = useMemo(() => buildScenarios(flows, detailed.edges), [flows, detailed.edges]);
  const activeScenario = useMemo(
    () => scenarios.find(scenario => scenario.id === activeScenarioId) || null,
    [scenarios, activeScenarioId]
  );

  const semanticMode = animMode === 'scenario' ? 'detailed' : (zoomLevel < 0.78 ? 'grouped' : 'detailed');
  const baseGraph = semanticMode === 'grouped' ? grouped : detailed;

  const stickyIds = useMemo(() => {
    const next = new Set<string>();
    if (selectedNodeId) next.add(selectedNodeId);
    if (highlightedNodeId) next.add(highlightedNodeId);
    return next;
  }, [selectedNodeId, highlightedNodeId]);

  const renderedNodes = useMemo(
    () => baseGraph.nodes.filter(node => !hiddenDomains.has(node.domain) || stickyIds.has(node.id)),
    [baseGraph.nodes, hiddenDomains, stickyIds]
  );

  const renderedNodeIds = useMemo(() => new Set(renderedNodes.map(node => node.id)), [renderedNodes]);

  const renderedEdges = useMemo(
    () => baseGraph.edges.filter(edge => renderedNodeIds.has(edge.from) && renderedNodeIds.has(edge.to)),
    [baseGraph.edges, renderedNodeIds]
  );

  const renderedNodeMap = useMemo(
    () => new Map(renderedNodes.map(node => [node.id, node])),
    [renderedNodes]
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
    if (!activeScenario) return null;
    if (activeScenario.steps.length === 0) return null;
    return activeScenario.steps[normalizedStepIndex] || null;
  }, [activeScenario, normalizedStepIndex]);

  const focusNodeId = hoveredNodeId || highlightedNodeId || null;

  const connectedNodeIds = useMemo(() => {
    if (!focusNodeId) return new Set<string>();
    const connected = new Set<string>([focusNodeId]);
    renderedEdges.forEach(edge => {
      if (edge.from === focusNodeId || edge.to === focusNodeId) {
        connected.add(edge.from);
        connected.add(edge.to);
      }
    });
    return connected;
  }, [focusNodeId, renderedEdges]);

  const selectedNode = useMemo(() => {
    const selectedId = selectedNodeId || highlightedNodeId || '';
    return renderedNodes.find(node => node.id === selectedId)
      || detailed.nodes.find(node => node.id === selectedId)
      || grouped.nodes.find(node => node.id === selectedId)
      || null;
  }, [renderedNodes, detailed.nodes, grouped.nodes, selectedNodeId, highlightedNodeId]);

  const selectedNodeEdgeInsights = useMemo(() => {
    if (!selectedNode) return [];
    return renderedEdges
      .filter(edge => edge.from === selectedNode.id || edge.to === selectedNode.id)
      .slice(0, 4);
  }, [renderedEdges, selectedNode]);

  const popupPosition = useMemo(() => {
    if (!selectedNode) return null;

    const popupWidth = 320;
    const popupHeight = 420;

    if (isFullscreen) {
      const nodeLeft = canvasViewport.left + (selectedNode.x * zoomLevel) - canvasViewport.scrollLeft;
      const nodeRight = nodeLeft + (selectedNode.width * zoomLevel);
      const nodeTop = canvasViewport.top + (selectedNode.y * zoomLevel) - canvasViewport.scrollTop;

      const fitsRight = nodeRight + popupWidth + 16 < canvasViewport.windowWidth - 8;
      const rawLeft = fitsRight ? nodeRight + 16 : nodeLeft - popupWidth - 16;
      const rawTop = nodeTop - 20;

      return {
        left: Math.min(Math.max(8, rawLeft), Math.max(8, canvasViewport.windowWidth - popupWidth - 8)),
        top: Math.min(Math.max(8, rawTop), Math.max(8, canvasViewport.windowHeight - popupHeight - 8)),
        mode: 'fixed' as const,
      };
    }

    const graphWidth = baseGraph.width * zoomLevel;
    const graphHeight = baseGraph.height * zoomLevel;
    const nodeRight = (selectedNode.x + selectedNode.width) * zoomLevel;
    const nodeTop = selectedNode.y * zoomLevel;
    const fitsRight = nodeRight + popupWidth + 24 < graphWidth;

    return {
      left: fitsRight
        ? nodeRight + 16
        : Math.max(8, (selectedNode.x * zoomLevel) - popupWidth - 16),
      top: Math.min(
        Math.max(8, nodeTop - 20),
        Math.max(8, graphHeight - 260)
      ),
      mode: 'absolute' as const,
    };
  }, [selectedNode, zoomLevel, baseGraph.width, baseGraph.height, isFullscreen, canvasViewport]);

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
      if (stepStartRef.current === null) {
        stepStartRef.current = timestamp;
      }

      const safeIndex = Math.min(normalizedStepIndex, activeScenario.steps.length - 1);
      const step = activeScenario.steps[safeIndex];
      const duration = Math.max(450, step.duration / FIXED_SIM_SPEED);
      const elapsed = timestamp - stepStartRef.current;
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
  }, [animMode, activeScenario, isAnimating, normalizedStepIndex, prefersReducedMotion]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || animMode === 'off') return;
    if (isAnimating) svg.unpauseAnimations();
    else svg.pauseAnimations();
  }, [animMode, isAnimating, renderedEdges.length]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    originalBodyOverflowRef.current = document.body.style.overflow;
    return () => {
      document.body.style.overflow = originalBodyOverflowRef.current;
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (selectedNodeId) {
        setSelectedNodeId(null);
        return;
      }
      if (isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isFullscreen, selectedNodeId]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = isFullscreen ? 'hidden' : originalBodyOverflowRef.current;
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen || typeof window === 'undefined') return;

    const updateViewport = () => {
      const canvas = canvasScrollRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      setCanvasViewport({
        left: rect.left,
        top: rect.top,
        scrollLeft: canvas.scrollLeft,
        scrollTop: canvas.scrollTop,
        width: rect.width,
        height: rect.height,
        windowWidth: window.innerWidth,
        windowHeight: window.innerHeight,
      });
    };

    updateViewport();
    const canvas = canvasScrollRef.current;
    canvas?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);

    return () => {
      canvas?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, [isFullscreen, zoomLevel, selectedNodeId, highlightedNodeId]);

  const toggleDomain = (domain: string): void => {
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

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const target = e.target as Element;
    if (e.target === svgRef.current || target.tagName.toLowerCase() === 'svg') {
      setSelectedNodeId(null);
    }
  };

  if (!architecture || architecture.nodes.length === 0) {
    return <div className="py-10 text-center text-sm text-gray-400">No architecture data available.</div>;
  }

  const graphCanvasWidth = Math.max(400, baseGraph.width * zoomLevel);
  const graphCanvasHeight = Math.max(320, baseGraph.height * zoomLevel);

  const nodeDescription = (node: RenderNode): string => {
    if (founderMode && founderDescriptions?.[node.id]) {
      return normalizeDiagramText(founderDescriptions[node.id]);
    }
    return normalizeDiagramText(simplifyForFounder(node.description || 'Core system module', founderMode));
  };

  const diagramContent = (
    <div
      data-testid="architecture-diagram-root"
      className={isFullscreen
        ? 'fixed inset-0 z-50 flex flex-col gap-4 bg-[hsl(220,25%,6%)] p-4'
        : 'space-y-4'}
    >
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
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
            title={domainPurposeByName.get(domain) || undefined}
          >
            {titleCase(domain)}
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
          <button
            onClick={() => setIsFullscreen(value => !value)}
            className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs text-gray-300 transition-colors hover:bg-white/10"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? '⤓ Exit' : '⤢ Expand'}
          </button>
        </div>
      </div>

      <div className="flex-shrink-0">
        <FlowControlBar
          isAnimating={isAnimating}
          mode={animMode}
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          speed={FIXED_SIM_SPEED}
          disabled={prefersReducedMotion}
          showSpeedControls={false}
          currentStep={currentStep && activeScenario
            ? {
              index: normalizedStepIndex,
              total: activeScenario.steps.length,
              label: currentStep.label,
            }
            : undefined}
          onToggle={handleAnimationToggle}
          onSelectScenario={handleScenarioSelect}
          onSpeedChange={() => {}}
        />
      </div>

      {animMode === 'scenario' && isAnimating && currentStep && activeScenario && (
        <div className="flex-shrink-0 rounded-xl border border-white/10 bg-[#0b1120]/85 px-4 py-3">
          <div className="text-xs font-medium text-gray-200">
            Step {normalizedStepIndex + 1}/{activeScenario.steps.length}: {currentStep.label}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
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

      <div className={isFullscreen ? 'min-h-0 flex-1 overflow-hidden' : 'overflow-hidden'}>
        <div
          ref={canvasScrollRef}
          className={`overflow-auto rounded-2xl border border-white/10 bg-[#05070d] ${
            isFullscreen ? 'h-full' : 'h-[620px]'
          }`}
        >
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
                width: baseGraph.width,
                height: baseGraph.height,
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'top left',
              }}
            >
              <svg
                ref={svgRef}
                width={baseGraph.width}
                height={baseGraph.height}
                className="absolute inset-0"
                aria-hidden
                onClick={handleSvgClick}
              >
                <defs>
                  <pattern id="grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(122,136,166,0.12)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                {renderedEdges.map(edge => {
                  const source = renderedNodeMap.get(edge.from);
                  const target = renderedNodeMap.get(edge.to);
                  if (!source || !target) return null;
                  const edgePath = edgePaths.get(edge.id);
                  if (!edgePath) return null;

                  const isActive = !focusNodeId || edge.from === focusNodeId || edge.to === focusNodeId;
                  let style = edgeStyle(edge, isActive);
                  if (animMode === 'scenario' && isAnimating && activeScenario) {
                    if (scenarioActiveEdgeIds.has(edge.id)) {
                      style = { ...style, width: Math.max(style.width, 4), opacity: 1 };
                    } else {
                      style = { ...style, width: Math.max(1, style.width * 0.7), opacity: 0.12 };
                    }
                  }

                  const sx = source.x + source.width / 2;
                  const sy = source.y + source.height / 2;
                  const tx = target.x + target.width / 2;
                  const ty = target.y + target.height / 2;
                  const midY = sy + (ty - sy) / 2;
                  const selectedFocusId = selectedNodeId || highlightedNodeId;
                  const showEdgeLabel = hoveredEdgeId === edge.id
                    || (Boolean(selectedFocusId) && (edge.from === selectedFocusId || edge.to === selectedFocusId));

                  return (
                    <g key={edge.id}>
                      <path
                        d={edgePath.path}
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={style.width}
                        strokeDasharray={style.dash}
                        opacity={style.opacity}
                        markerEnd="url(#arrowhead)"
                        onMouseEnter={() => setHoveredEdgeId(edge.id)}
                        onMouseLeave={() => setHoveredEdgeId(null)}
                        style={{ cursor: 'pointer', pointerEvents: 'stroke' }}
                      />
                      {showEdgeLabel && (
                        <text
                          x={(sx + tx) / 2}
                          y={midY - 8}
                          fill="rgba(230,236,250,0.9)"
                          fontSize="15"
                          textAnchor="middle"
                          opacity={0.85}
                        >
                          {normalizeDiagramText(edge.label)}
                        </text>
                      )}
                    </g>
                  );
                })}

                {animMode !== 'off' && (
                  <ParticleSystem
                    edges={renderedEdges}
                    nodes={renderedNodes.map(node => ({ id: node.id, domain: node.domain }))}
                    edgePaths={edgePaths}
                    mode={animMode}
                    activeScenario={activeScenario}
                    speed={FIXED_SIM_SPEED}
                    isAnimating={isAnimating}
                    activeEdgeIds={scenarioActiveEdgeIds}
                    domainColors={domainColors}
                  />
                )}

                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="rgba(186,202,248,0.9)" />
                  </marker>
                </defs>
              </svg>

              {renderedNodes.map(node => {
                const isDimmed = connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id);
                const isScenarioPlaying = animMode === 'scenario' && isAnimating && activeScenario;
                const isScenarioDimmed = isScenarioPlaying && !activeNodeIds.has(node.id);
                const isSelected = selectedNodeId === node.id || highlightedNodeId === node.id;
                const borderColor = domainColors[node.domain] || colorFromDomain(node.domain);
                const nodeStyle: CSSProperties & Record<string, string | number> = {
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  borderColor: `${borderColor}B3`,
                  background: node.kind === 'domain' ? 'rgba(8,13,22,0.84)' : 'rgba(7,10,17,0.82)',
                  boxShadow: `0 0 0 1px ${borderColor}24`,
                  opacity: isScenarioDimmed ? 0.25 : (isDimmed ? 0.4 : 1),
                  '--domain-color': borderColor,
                };
                return (
                  <button
                    key={node.id}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    className={`absolute rounded-xl border text-left transition-all ${isSelected ? 'node-selected' : ''}`}
                    style={nodeStyle}
                  >
                    <div className="p-3">
                      <div className="mt-1 truncate text-sm font-semibold text-white">{node.label}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-gray-300">
                        {nodeDescription(node)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedNode && popupPosition && (
              <div
                className={`animate-fade-in z-30 w-80 rounded-2xl border border-white/15 bg-[#0a0f1a]/95 shadow-2xl shadow-black/40 backdrop-blur-xl ${
                  popupPosition.mode === 'absolute' ? 'absolute' : ''
                }`}
                style={{
                  left: popupPosition.left,
                  top: popupPosition.top,
                  position: popupPosition.mode,
                }}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  onClick={() => setSelectedNodeId(null)}
                  className="absolute right-3 top-3 text-sm text-gray-500 transition-colors hover:text-white"
                  aria-label="Close details"
                >
                  x
                </button>
                <div className="space-y-3 p-5">
                  <div
                    className="text-[11px] uppercase tracking-wide"
                    style={{ color: domainColors[selectedNode.domain] || colorFromDomain(selectedNode.domain) }}
                  >
                    {selectedNode.domain}
                  </div>
                  <div className="text-base font-semibold text-white">{selectedNode.label}</div>
                  {selectedNode.businessRole && (
                    <div className="text-xs text-indigo-200">
                      {normalizeDiagramText(simplifyForFounder(selectedNode.businessRole, founderMode))}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-gray-300">
                    {founderMode && founderDescriptions?.[selectedNode.id]
                      ? normalizeDiagramText(founderDescriptions[selectedNode.id])
                      : normalizeDiagramText(
                        simplifyForFounder(
                          selectedNode.description || `${selectedNode.label} supports a core capability in this system.`,
                          founderMode
                        )
                      )}
                  </p>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {selectedNode.kind}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                      {selectedNode.fileCount} files
                    </span>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-xs text-gray-400">
                    Think of this as the {businessAnalogy(selectedNode.kind)}.
                  </div>
                  {selectedNodeEdgeInsights.length > 0 && (
                    <div className="space-y-2 rounded-lg border border-white/10 bg-black/25 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">Connected Flows</div>
                      {selectedNodeEdgeInsights.map(edge => (
                        <div key={`edge-insight-${edge.id}`} className="text-xs text-gray-300">
                          <div className="font-semibold text-gray-200">{normalizeDiagramText(edge.label)}</div>
                          {edge.data_flow && (
                            <div className="mt-0.5">{normalizeDiagramText(simplifyForFounder(edge.data_flow, founderMode))}</div>
                          )}
                          {edge.trigger && (
                            <div className="mt-0.5 text-gray-400">
                              Trigger: {normalizeDiagramText(simplifyForFounder(edge.trigger, founderMode))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(diagramContent, document.body);
  }

  return diagramContent;
}
