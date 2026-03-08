'use client';

import { useEffect, useMemo, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';

interface ArchitectureNode {
  id: string;
  name: string;
  type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
  complexity: 'low' | 'medium' | 'high';
  description: string;
  files: string[];
}

interface ArchitectureEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
}

interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

type Domain = 'auth' | 'data' | 'payments' | 'comms' | 'core' | 'infra';
type DiagramNodeKind = 'service' | 'database' | 'external' | 'queue' | 'domain';

interface ArchitectureDiagramProps {
  architecture: ArchitectureVisualization;
  highlightedNodeId?: string | null;
  founderMode?: boolean;
}

interface RenderNode {
  id: string;
  label: string;
  description: string;
  domain: Domain;
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
  type: ArchitectureEdge['type'];
  label: string;
  styleKind: 'data_flow' | 'reads_from' | 'triggers';
  weight: number;
}

const DOMAIN_COLORS: Record<Domain, string> = {
  auth: 'hsl(220, 80%, 60%)',
  data: 'hsl(160, 70%, 45%)',
  payments: 'hsl(45, 90%, 55%)',
  comms: 'hsl(280, 65%, 55%)',
  core: 'hsl(340, 75%, 55%)',
  infra: 'hsl(200, 20%, 50%)',
};

function titleCase(input: string): string {
  return input.charAt(0).toUpperCase() + input.slice(1);
}

function inferDomain(node: ArchitectureNode): Domain {
  const text = `${node.name} ${node.description} ${(node.files || []).join(' ')}`.toLowerCase();
  if (/(auth|login|signup|session|permission|identity)/.test(text)) return 'auth';
  if (/(data|database|db|schema|model|storage|cache)/.test(text)) return 'data';
  if (/(payment|billing|checkout|invoice|subscription|pricing)/.test(text)) return 'payments';
  if (/(email|sms|message|notify|notification|webhook|chat)/.test(text)) return 'comms';
  if (/(queue|worker|job|cron|scheduler|infra|deploy|k8s|docker)/.test(text)) return 'infra';
  return 'core';
}

function inferNodeKind(node: ArchitectureNode): Exclude<DiagramNodeKind, 'domain'> {
  const text = `${node.type} ${node.name}`.toLowerCase();
  if (/(database|db|storage|cache|redis|postgres|mongo)/.test(text)) return 'database';
  if (/(external|third|stripe|twilio|s3|gcp|azure)/.test(text)) return 'external';
  if (/(queue|worker|job|celery|bull|sidekiq)/.test(text)) return 'queue';
  return 'service';
}

function edgeVisual(type: ArchitectureEdge['type']): { styleKind: RenderEdge['styleKind']; label: string } {
  if (type === 'stores') return { styleKind: 'reads_from', label: 'reads/stores data' };
  if (type === 'calls') return { styleKind: 'triggers', label: 'triggers action' };
  if (type === 'renders') return { styleKind: 'data_flow', label: 'renders output' };
  return { styleKind: 'data_flow', label: 'sends data' };
}

function nodeSize(kind: DiagramNodeKind): { width: number; height: number } {
  if (kind === 'domain') return { width: 270, height: 115 };
  if (kind === 'database') return { width: 260, height: 95 };
  if (kind === 'external') return { width: 260, height: 95 };
  if (kind === 'queue') return { width: 260, height: 95 };
  return { width: 270, height: 105 };
}

function buildDetailedLayout(architecture: ArchitectureVisualization): { nodes: RenderNode[]; edges: RenderEdge[]; width: number; height: number } {
  const rankedNodes = architecture.nodes.map(node => ({
    id: node.id,
    label: node.name,
    description: node.description || '',
    domain: inferDomain(node),
    kind: inferNodeKind(node),
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
  const xGap = 320;
  const yGap = 175;

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

  const edges: RenderEdge[] = architecture.edges
    .filter(edge => nodeById.has(edge.from) && nodeById.has(edge.to))
    .map((edge, index) => {
      const visual = edgeVisual(edge.type);
      return {
        id: `${edge.from}-${edge.to}-${index}`,
        from: edge.from,
        to: edge.to,
        type: edge.type,
        label: visual.label,
        styleKind: visual.styleKind,
        weight: 1,
      };
    });

  return {
    nodes: positioned,
    edges,
    width: Math.max(1200, finalMaxX + 140),
    height: Math.max(760, finalMaxY + 140),
  };
}

function buildGroupedLayout(architecture: ArchitectureVisualization): { nodes: RenderNode[]; edges: RenderEdge[]; width: number; height: number } {
  const counts = new Map<Domain, number>();
  const nodeDomain = new Map<string, Domain>();

  architecture.nodes.forEach(node => {
    const domain = inferDomain(node);
    nodeDomain.set(node.id, domain);
    counts.set(domain, (counts.get(domain) || 0) + 1);
  });

  const domains = (['auth', 'data', 'payments', 'comms', 'core', 'infra'] as Domain[])
    .filter(domain => (counts.get(domain) || 0) > 0);

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
      description: `${counts.get(domain) || 0} major modules`,
      domain,
      kind: 'domain',
      fileCount: counts.get(domain) || 0,
      x: xStart + col * xGap,
      y: yStart + row * yGap,
      width: dims.width,
      height: dims.height,
    };
  });

  const edgeWeights = new Map<string, number>();
  architecture.edges.forEach(edge => {
    const sourceDomain = nodeDomain.get(edge.from);
    const targetDomain = nodeDomain.get(edge.to);
    if (!sourceDomain || !targetDomain || sourceDomain === targetDomain) return;
    const key = `${sourceDomain}->${targetDomain}`;
    edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
  });

  const edges: RenderEdge[] = Array.from(edgeWeights.entries()).map(([key, weight], index) => {
    const [sourceDomain, targetDomain] = key.split('->') as [Domain, Domain];
    return {
      id: `group-${index}`,
      from: `domain:${sourceDomain}`,
      to: `domain:${targetDomain}`,
      type: 'imports',
      label: `${weight} connections`,
      styleKind: 'data_flow',
      weight,
    };
  });

  return {
    nodes,
    edges,
    width: Math.max(1280, xStart + columns * xGap + 120),
    height: 760,
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

export default function ArchitectureDiagram({
  architecture,
  highlightedNodeId,
  founderMode = false,
}: ArchitectureDiagramProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeDomains, setActiveDomains] = useState<Set<Domain>>(
    new Set(['auth', 'data', 'payments', 'comms', 'core', 'infra'])
  );

  const detailed = useMemo(() => buildDetailedLayout(architecture), [architecture]);
  const grouped = useMemo(() => buildGroupedLayout(architecture), [architecture]);

  const semanticMode = zoomLevel < 0.78 ? 'grouped' : 'detailed';
  const baseGraph = semanticMode === 'grouped' ? grouped : detailed;

  const renderedNodes = useMemo(
    () => baseGraph.nodes.filter(node => activeDomains.has(node.domain)),
    [baseGraph.nodes, activeDomains]
  );

  const renderedNodeIds = useMemo(
    () => new Set(renderedNodes.map(node => node.id)),
    [renderedNodes]
  );

  const renderedEdges = useMemo(
    () => baseGraph.edges.filter(edge => renderedNodeIds.has(edge.from) && renderedNodeIds.has(edge.to)),
    [baseGraph.edges, renderedNodeIds]
  );

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

  const popupPosition = useMemo(() => {
    if (!selectedNode) return null;

    const graphWidth = baseGraph.width * zoomLevel;
    const graphHeight = baseGraph.height * zoomLevel;
    const popupWidth = 320;
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
    };
  }, [selectedNode, zoomLevel, baseGraph.width, baseGraph.height]);

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
    if (!isFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isFullscreen]);

  const toggleDomain = (domain: Domain): void => {
    setActiveDomains(prev => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      if (next.size === 0) return new Set(['auth', 'data', 'payments', 'comms', 'core', 'infra']);
      return next;
    });
  };

  if (!architecture || architecture.nodes.length === 0) {
    return <div className="py-10 text-center text-sm text-gray-400">No architecture data available.</div>;
  }

  const graphCanvasWidth = Math.max(400, baseGraph.width * zoomLevel);
  const graphCanvasHeight = Math.max(320, baseGraph.height * zoomLevel);

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-50 bg-[hsl(220,25%,6%)] p-4' : 'space-y-4'}>
      <div className={isFullscreen ? 'relative h-full space-y-4' : 'space-y-4'}>
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute right-0 top-0 z-40 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close fullscreen"
            title="Close fullscreen"
          >
            x
          </button>
        )}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        {(['auth', 'data', 'payments', 'comms', 'core', 'infra'] as Domain[]).map(domain => (
          <button
            key={domain}
            onClick={() => toggleDomain(domain)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeDomains.has(domain) ? 'text-white' : 'text-gray-400'
            }`}
            style={{
              borderColor: activeDomains.has(domain) ? `${DOMAIN_COLORS[domain]}CC` : 'rgba(255,255,255,0.16)',
              background: activeDomains.has(domain) ? `${DOMAIN_COLORS[domain]}33` : 'rgba(255,255,255,0.02)',
            }}
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
            {isFullscreen ? 'Exit' : 'Expand'}
          </button>
        </div>
      </div>

      <div>
        <div
          className={`overflow-auto rounded-2xl border border-white/10 bg-[#05070d] ${
            isFullscreen ? 'h-[calc(100vh-80px)]' : 'h-[620px]'
          }`}
        >
          <div
            className="relative"
            style={{
              width: graphCanvasWidth,
              height: graphCanvasHeight,
            }}
            onClick={() => setSelectedNodeId(null)}
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
                width={baseGraph.width}
                height={baseGraph.height}
                className="absolute inset-0"
                aria-hidden
              >
                <defs>
                  <pattern id="grid-pattern" width="28" height="28" patternUnits="userSpaceOnUse">
                    <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(122,136,166,0.12)" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                {renderedEdges.map(edge => {
                  const source = renderedNodes.find(node => node.id === edge.from);
                  const target = renderedNodes.find(node => node.id === edge.to);
                  if (!source || !target) return null;

                  const sx = source.x + source.width / 2;
                  const sy = source.y + source.height / 2;
                  const tx = target.x + target.width / 2;
                  const ty = target.y + target.height / 2;
                  const midY = sy + (ty - sy) / 2;

                  const isActive = !focusNodeId || edge.from === focusNodeId || edge.to === focusNodeId;
                  const style = edgeStyle(edge, isActive);
                  const path = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

                  return (
                    <g key={edge.id}>
                      <path
                        d={path}
                        fill="none"
                        stroke={style.stroke}
                        strokeWidth={style.width}
                        strokeDasharray={style.dash}
                        opacity={style.opacity}
                        markerEnd="url(#arrowhead)"
                      />
                      <text
                        x={(sx + tx) / 2}
                        y={midY - 8}
                        fill="rgba(230,236,250,0.9)"
                        fontSize="11"
                        fontWeight="600"
                        textAnchor="middle"
                        opacity={style.opacity}
                      >
                        {edge.label}
                      </text>
                    </g>
                  );
                })}

                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="rgba(186,202,248,0.9)" />
                  </marker>
                </defs>
              </svg>

              {renderedNodes.map(node => {
                const isDimmed = connectedNodeIds.size > 0 && !connectedNodeIds.has(node.id);
                const isSelected = selectedNodeId === node.id || highlightedNodeId === node.id;
                const borderColor = DOMAIN_COLORS[node.domain];
                return (
                  <button
                    key={node.id}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedNodeId(node.id);
                    }}
                    className={`absolute rounded-xl border text-left transition-all ${
                      isSelected ? 'ring-2 ring-white/65' : ''
                    }`}
                    style={{
                      left: node.x,
                      top: node.y,
                      width: node.width,
                      height: node.height,
                      borderColor: `${borderColor}B3`,
                      background: node.kind === 'domain' ? 'rgba(8,13,22,0.84)' : 'rgba(7,10,17,0.82)',
                      boxShadow: `0 0 0 1px ${borderColor}24`,
                      opacity: isDimmed ? 0.26 : 1,
                    }}
                  >
                    <div className="p-3">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">
                        {node.kind === 'domain' ? 'Domain Group' : titleCase(node.domain)}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold text-white">{node.label}</div>
                      <div className="mt-1 line-clamp-2 text-xs text-gray-300">
                        {simplifyForFounder(node.description || 'Core system module', founderMode)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedNode && popupPosition && (
              <div
                className="animate-fade-in-up absolute z-30 w-80 rounded-2xl border border-white/15 bg-[#0a0f1a]/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
                style={{ left: popupPosition.left, top: popupPosition.top }}
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
                    style={{ color: DOMAIN_COLORS[selectedNode.domain] }}
                  >
                    {selectedNode.domain}
                  </div>
                  <div className="text-base font-semibold text-white">{selectedNode.label}</div>
                  <p className="text-sm leading-relaxed text-gray-300">
                    {simplifyForFounder(
                      selectedNode.description || `${selectedNode.label} supports a core capability in this system.`,
                      founderMode
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
