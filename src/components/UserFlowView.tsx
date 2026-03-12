'use client';

// ABOUTME: User flow / data flow visualization as a vertical flowchart.
// ABOUTME: Shows explicit dataFlow steps from Claude analysis, or falls back to inferred type-based stages.

import { useMemo } from 'react';
import { ArchitectureVisualization, ArchitectureNode } from '@/lib/db';

interface UserFlowViewProps {
  architecture: ArchitectureVisualization;
}

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

const TYPE_DOTS: Record<ArchitectureNode['type'], string> = {
  ui: 'bg-purple-400', api: 'bg-blue-400', service: 'bg-cyan-400',
  component: 'bg-indigo-400', database: 'bg-green-400', external: 'bg-orange-400',
};

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

export default function UserFlowView({ architecture }: UserFlowViewProps) {
  const inferredFlowStages = useMemo(() => {
    const byType = new Map<string, ArchitectureNode[]>();
    architecture.nodes.forEach(n => {
      byType.set(n.type, [...(byType.get(n.type) || []), n]);
    });
    return INFERRED_STAGES
      .map(s => ({ ...s, nodes: s.types.flatMap(t => byType.get(t) || []) }))
      .filter(s => s.nodes.length > 0);
  }, [architecture.nodes]);

  return (
    <div>
      <p className="text-xs text-gray-500 mb-5">
        High-level view of how data moves through the system.
      </p>
      <div className="flex flex-col items-center">
        {/* Starting node */}
        <div className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-center w-full max-w-sm">
          <div className="text-sm font-semibold text-white">User / Browser</div>
          <div className="text-xs text-gray-500 mt-0.5">Initiates requests</div>
        </div>

        {architecture.dataFlow && architecture.dataFlow.length > 0 ? (
          // Explicit steps from Claude
          architecture.dataFlow.map(step => {
            const nodesInStep = step.nodeIds
              .map(id => architecture.nodes.find(n => n.id === id))
              .filter((n): n is ArchitectureNode => !!n);
            return (
              <div key={step.step} className="flex flex-col items-center w-full max-w-sm">
                <DownArrow />
                <div className="w-full rounded-xl border p-3" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}>
                  <h3 className="font-semibold text-sm text-white mb-1">{step.label}</h3>
                  <p className="text-xs text-gray-400 mb-2 leading-relaxed">{step.description}</p>
                  {nodesInStep.length > 0 && (
                    <div className="space-y-1">
                      {nodesInStep.slice(0, 4).map(node => (
                        <div key={node.id} className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_DOTS[node.type]}`} />
                          <span className="text-xs text-gray-400">{node.name}</span>
                        </div>
                      ))}
                      {nodesInStep.length > 4 && <div className="text-xs text-gray-600">+{nodesInStep.length - 4} more</div>}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          // Fallback: inferred stages
          inferredFlowStages.map(stage => (
            <div key={stage.label} className="flex flex-col items-center w-full max-w-sm">
              <DownArrow />
              <div className="w-full rounded-xl border p-3" style={{ background: stage.bg, borderColor: stage.border }}>
                <h3 className={`font-semibold text-sm mb-2 ${stage.textClass}`}>{stage.label}</h3>
                <div className="space-y-1">
                  {stage.nodes.slice(0, 4).map(node => (
                    <div key={node.id} className="text-xs text-gray-400">• {node.name}</div>
                  ))}
                  {stage.nodes.length > 4 && <div className="text-xs text-gray-600">+{stage.nodes.length - 4} more</div>}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
