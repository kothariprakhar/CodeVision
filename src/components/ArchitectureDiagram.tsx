'use client';

// ABOUTME: Architecture and data flow visualization component for analyzed projects.
// ABOUTME: Renders a module grid and a data flow flowchart derived from Claude's analysis.

import { useState, useMemo } from 'react';
import type { ArchitectureVisualization, ArchitectureNode } from '@/lib/db';

interface ArchitectureDiagramProps {
  architecture: ArchitectureVisualization;
}

const TYPE_CONFIG: Record<ArchitectureNode['type'], {
  label: string;
  dotClass: string;
  textClass: string;
  iconBgClass: string;
  selectedBorderClass: string;
  selectedBg: string;
}> = {
  ui:        { label: 'Frontend',   dotClass: 'bg-purple-400', textClass: 'text-purple-400', iconBgClass: 'bg-purple-500/20', selectedBorderClass: 'border-purple-500 ring-2 ring-purple-500/60', selectedBg: 'rgba(168,85,247,0.15)' },
  api:       { label: 'API',        dotClass: 'bg-blue-400',   textClass: 'text-blue-400',   iconBgClass: 'bg-blue-500/20',   selectedBorderClass: 'border-blue-500 ring-2 ring-blue-500/60',     selectedBg: 'rgba(59,130,246,0.15)' },
  service:   { label: 'Service',    dotClass: 'bg-cyan-400',   textClass: 'text-cyan-400',   iconBgClass: 'bg-cyan-500/20',   selectedBorderClass: 'border-cyan-500 ring-2 ring-cyan-500/60',     selectedBg: 'rgba(6,182,212,0.15)' },
  component: { label: 'Component',  dotClass: 'bg-indigo-400', textClass: 'text-indigo-400', iconBgClass: 'bg-indigo-500/20', selectedBorderClass: 'border-indigo-500 ring-2 ring-indigo-500/60', selectedBg: 'rgba(99,102,241,0.15)' },
  database:  { label: 'Database',   dotClass: 'bg-green-400',  textClass: 'text-green-400',  iconBgClass: 'bg-green-500/20',  selectedBorderClass: 'border-green-500 ring-2 ring-green-500/60',   selectedBg: 'rgba(34,197,94,0.15)' },
  external:  { label: 'External',   dotClass: 'bg-orange-400', textClass: 'text-orange-400', iconBgClass: 'bg-orange-500/20', selectedBorderClass: 'border-orange-500 ring-2 ring-orange-500/60', selectedBg: 'rgba(249,115,22,0.15)' },
};

// SVG icon paths (Heroicons outline, viewBox 0 0 24 24) for each node type
const TYPE_ICONS: Record<ArchitectureNode['type'], string> = {
  ui:        'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  api:       'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4',
  service:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  component: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
  database:  'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
  external:  'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9',
};


// Ordered stages used when architecture.dataFlow is absent (fallback)
const INFERRED_STAGES: {
  types: ArchitectureNode['type'][];
  label: string;
  bg: string;
  border: string;
  textClass: string;
}[] = [
  { types: ['ui'],                  label: 'Frontend',          bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', textClass: 'text-purple-400' },
  { types: ['api'],                 label: 'API Routes',        bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', textClass: 'text-blue-400' },
  { types: ['service','component'], label: 'Business Logic',    bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.3)',  textClass: 'text-cyan-400' },
  { types: ['database'],            label: 'Data Storage',      bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)',  textClass: 'text-green-400' },
  { types: ['external'],            label: 'External Services', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', textClass: 'text-orange-400' },
];

function DownArrow() {
  return (
    <div className="flex flex-col items-center my-1" aria-hidden="true">
      <div className="w-px h-4 bg-gray-600" />
      <svg width="10" height="7" viewBox="0 0 10 7" className="text-gray-600 fill-current">
        <polygon points="5,7 0,0 10,0" />
      </svg>
    </div>
  );
}

export default function ArchitectureDiagram({ architecture }: ArchitectureDiagramProps) {
  const [view, setView] = useState<'architecture' | 'dataflow'>('architecture');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const connections = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [], incoming: [] };
    const outgoing = architecture.edges
      .filter(e => e.from === selectedNodeId)
      .map(e => ({ node: architecture.nodes.find(n => n.id === e.to)!, edgeType: e.type }))
      .filter(c => c.node);
    const incoming = architecture.edges
      .filter(e => e.to === selectedNodeId)
      .map(e => ({ node: architecture.nodes.find(n => n.id === e.from)!, edgeType: e.type }))
      .filter(c => c.node);
    return { outgoing, incoming };
  }, [selectedNodeId, architecture]);

  const connectedNodeIds = useMemo(() => new Set([
    ...connections.outgoing.map(c => c.node.id),
    ...connections.incoming.map(c => c.node.id),
  ]), [connections]);

  const selectedNode = selectedNodeId
    ? architecture.nodes.find(n => n.id === selectedNodeId)
    : null;

  // Inferred flow stages for fallback when architecture.dataFlow is absent
  const inferredFlowStages = useMemo(() => {
    const byType = new Map<string, ArchitectureNode[]>();
    architecture.nodes.forEach(n => {
      byType.set(n.type, [...(byType.get(n.type) || []), n]);
    });
    return INFERRED_STAGES
      .map(s => ({
        ...s,
        nodes: s.types.flatMap(t => byType.get(t) || []),
      }))
      .filter(s => s.nodes.length > 0);
  }, [architecture.nodes]);

  if (!architecture || architecture.nodes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No architecture data available
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-1 mb-5 p-1 bg-white/5 rounded-xl w-fit">
        <button
          onClick={() => { setView('architecture'); setSelectedNodeId(null); }}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            view === 'architecture' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Modules
        </button>
        <button
          onClick={() => { setView('dataflow'); setSelectedNodeId(null); }}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            view === 'dataflow' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          User Flow
        </button>
      </div>

      {/* Architecture view */}
      {view === 'architecture' && (
        <div>
          <p className="text-xs text-gray-500 mb-4">
            {architecture.nodes.length} modules · {architecture.edges.length} connections · Click a module to explore connections
          </p>
          <div className="flex gap-5">
            {/* Module grid */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              {architecture.nodes.map(node => {
                const config = TYPE_CONFIG[node.type];
                const isSelected = selectedNodeId === node.id;
                const isOutgoing = connections.outgoing.some(c => c.node.id === node.id);
                const isIncoming = connections.incoming.some(c => c.node.id === node.id);
                const isDimmed   = !!selectedNodeId && !isSelected && !connectedNodeIds.has(node.id);

                let cardClass = 'w-full text-left p-3 rounded-xl border transition-all duration-150 ';
                let cardStyle: React.CSSProperties = {};

                if (isSelected) {
                  cardClass += config.selectedBorderClass;
                  cardStyle = { background: config.selectedBg };
                } else if (isOutgoing) {
                  cardClass += 'border-yellow-500/60 bg-yellow-500/5';
                } else if (isIncoming) {
                  cardClass += 'border-blue-500/60 bg-blue-500/5';
                } else if (isDimmed) {
                  cardClass += 'border-white/5 opacity-40';
                } else {
                  cardClass += 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]';
                }

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                    className={cardClass}
                    style={cardStyle}
                  >
                    {/* Header row: icon + name + relation badge */}
                    <div className="flex items-start gap-2 mb-2">
                      {/* Type icon */}
                      <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${config.iconBgClass}`}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className={`w-4 h-4 ${config.textClass}`}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={TYPE_ICONS[node.type]} />
                        </svg>
                      </div>
                      {/* Node name */}
                      <p className="font-bold text-sm text-white leading-tight flex-1 mt-0.5">{node.name}</p>
                      {/* Relation / selected badge */}
                      {isSelected && (
                        <span className={`flex-shrink-0 w-2 h-2 rounded-full mt-1 ${config.dotClass}`} aria-label="selected" />
                      )}
                      {!isSelected && isOutgoing && (
                        <span className="flex-shrink-0 text-[10px] font-bold text-yellow-400 mt-0.5 leading-none">→</span>
                      )}
                      {!isSelected && isIncoming && (
                        <span className="flex-shrink-0 text-[10px] font-bold text-blue-400 mt-0.5 leading-none">←</span>
                      )}
                    </div>
                    {/* File count */}
                    <div className="flex items-center gap-1">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5 text-gray-500 flex-shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                      </svg>
                      <span className="text-sm text-gray-400">
                        {node.files.length} {node.files.length === 1 ? 'file' : 'files'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="w-56 flex-shrink-0">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] min-h-[200px] p-3">
                {selectedNode ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedNode.name}</p>
                      <span className={`text-xs ${TYPE_CONFIG[selectedNode.type].textClass}`}>
                        {TYPE_CONFIG[selectedNode.type].label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{selectedNode.description}</p>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Files ({selectedNode.files.length})</div>
                      <div className="space-y-0.5 max-h-16 overflow-y-auto">
                        {selectedNode.files.map((f, i) => (
                          <div key={i} className="text-xs text-gray-400 truncate">{f}</div>
                        ))}
                      </div>
                    </div>
                    {connections.outgoing.length > 0 && (
                      <div>
                        <div className="text-xs text-yellow-500/80 mb-1">→ Calls / Uses</div>
                        <div className="space-y-0.5">
                          {connections.outgoing.map((c, i) => (
                            <div key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 flex-shrink-0" />
                              <span className="truncate">{c.node.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {connections.incoming.length > 0 && (
                      <div>
                        <div className="text-xs text-blue-400/80 mb-1">← Used by</div>
                        <div className="space-y-0.5">
                          {connections.incoming.map((c, i) => (
                            <div key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 flex-shrink-0" />
                              <span className="truncate">{c.node.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-xs pt-16">
                    Select a module to explore
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Flow view */}
      {view === 'dataflow' && (
        <div>
          <p className="text-xs text-gray-500 mb-5">
            High-level view of how data moves through the system.
          </p>
          <div className="flex flex-col items-center">
            {/* Starting node — always shown */}
            <div className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-center w-full max-w-sm">
              <div className="text-sm font-semibold text-white">User / Browser</div>
              <div className="text-xs text-gray-500 mt-0.5">Initiates requests</div>
            </div>

            {/* Explicit dataFlow steps from Claude */}
            {architecture.dataFlow && architecture.dataFlow.length > 0 ? (
              architecture.dataFlow.map(step => {
                const nodesInStep = step.nodeIds
                  .map(id => architecture.nodes.find(n => n.id === id))
                  .filter((n): n is ArchitectureNode => !!n);
                return (
                  <div key={step.step} className="flex flex-col items-center w-full max-w-sm">
                    <DownArrow />
                    <div
                      className="w-full rounded-xl border p-3"
                      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}
                    >
                      <h3 className="font-semibold text-sm text-white mb-1">{step.label}</h3>
                      <p className="text-xs text-gray-400 mb-2 leading-relaxed">{step.description}</p>
                      {nodesInStep.length > 0 && (
                        <div className="space-y-1">
                          {nodesInStep.slice(0, 4).map(node => (
                            <div key={node.id} className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_CONFIG[node.type].dotClass}`} />
                              <span className="text-xs text-gray-400">{node.name}</span>
                            </div>
                          ))}
                          {nodesInStep.length > 4 && (
                            <div className="text-xs text-gray-600">+{nodesInStep.length - 4} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* Fallback: inferred stages from node types */
              inferredFlowStages.map(stage => (
                <div key={stage.label} className="flex flex-col items-center w-full max-w-sm">
                  <DownArrow />
                  <div
                    className="w-full rounded-xl border p-3"
                    style={{ background: stage.bg, borderColor: stage.border }}
                  >
                    <h3 className={`font-semibold text-sm mb-2 ${stage.textClass}`}>{stage.label}</h3>
                    <div className="space-y-1">
                      {stage.nodes.slice(0, 4).map(node => (
                        <div key={node.id} className="text-xs text-gray-400">• {node.name}</div>
                      ))}
                      {stage.nodes.length > 4 && (
                        <div className="text-xs text-gray-600">+{stage.nodes.length - 4} more</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
