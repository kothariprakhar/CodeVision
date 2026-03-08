'use client';

import { useMemo, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';
import type { BusinessFlow } from '@/components/BusinessFlowView';
import { buildDomainColors, colorFromDomain } from './domain-utils';
import type { ArchitectureDomain, ArchitectureVisualization, BusinessContext } from './types';

interface MetroMapViewProps {
  architecture: ArchitectureVisualization;
  flows: BusinessFlow[];
  founderMode?: boolean;
  businessContext?: BusinessContext | null;
  founderDescriptions?: Record<string, string>;
  architectureDomains?: ArchitectureDomain[];
}

interface StationLayout {
  id: string;
  label: string;
  x: number;
  y: number;
  journeys: number[];
  domain: string;
}

const JOURNEY_COLORS = [
  'hsl(220, 80%, 65%)',
  'hsl(150, 70%, 50%)',
  'hsl(35, 90%, 58%)',
  'hsl(310, 65%, 58%)',
  'hsl(190, 70%, 58%)',
];

function sortedSteps(flow: BusinessFlow): BusinessFlow['steps'] {
  return [...flow.steps].sort((a, b) => a.order - b.order);
}

function linePath(a: StationLayout, b: StationLayout): string {
  if (a.y === b.y) return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  const midX = (a.x + b.x) / 2;
  return `M ${a.x} ${a.y} L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
}

function buildMetroLayout(architecture: ArchitectureVisualization, flows: BusinessFlow[]) {
  const nodeById = new Map(architecture.nodes.map(node => [node.id, node]));
  const stationOrder = new Map<string, number>();
  let currentOrder = 0;

  flows.forEach((flow) => {
    sortedSteps(flow).forEach((step) => {
      if (!stationOrder.has(step.moduleId)) {
        stationOrder.set(step.moduleId, currentOrder);
        currentOrder += 1;
      }
    });
  });

  const stations = new Map<string, StationLayout>();
  const paths: Array<{
    id: string;
    flowId: string;
    from: string;
    to: string;
    path: string;
    color: string;
    dataPassed: string;
  }> = [];

  const startX = 120;
  const startY = 90;
  const xGap = 200;
  const yGap = 130;

  flows.forEach((flow, journeyIndex) => {
    const steps = sortedSteps(flow);
    steps.forEach((step) => {
      const index = stationOrder.get(step.moduleId) || 0;
      const x = startX + index * xGap;
      const y = startY + journeyIndex * yGap;

      if (!stations.has(step.moduleId)) {
        stations.set(step.moduleId, {
          id: step.moduleId,
          label: nodeById.get(step.moduleId)?.name || step.moduleId,
          x,
          y,
          journeys: [journeyIndex],
          domain: step.domain,
        });
      } else {
        const existing = stations.get(step.moduleId) as StationLayout;
        if (!existing.journeys.includes(journeyIndex)) existing.journeys.push(journeyIndex);
      }
    });

    for (let i = 0; i < steps.length - 1; i += 1) {
      const fromStation = stations.get(steps[i].moduleId);
      const toStation = stations.get(steps[i + 1].moduleId);
      if (!fromStation || !toStation) continue;
      paths.push({
        id: `${flow.id}-${i}`,
        flowId: flow.id,
        from: fromStation.id,
        to: toStation.id,
        path: linePath(fromStation, toStation),
        color: JOURNEY_COLORS[journeyIndex % JOURNEY_COLORS.length],
        dataPassed: steps[i].data_passed || '',
      });
    }
  });

  const stationList = Array.from(stations.values());
  const width = Math.max(920, stationList.reduce((max, station) => Math.max(max, station.x), 0) + 240);
  const height = Math.max(420, stationList.reduce((max, station) => Math.max(max, station.y), 0) + 160);

  return { stations: stationList, paths, width, height };
}

export default function MetroMapView({
  architecture,
  flows,
  founderMode = false,
  businessContext,
  founderDescriptions,
  architectureDomains,
}: MetroMapViewProps) {
  const [hoveredStationId, setHoveredStationId] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);

  const layout = useMemo(() => buildMetroLayout(architecture, flows), [architecture, flows]);
  const nodeById = useMemo(() => new Map(architecture.nodes.map(node => [node.id, node])), [architecture.nodes]);
  const selectedNode = selectedStationId ? nodeById.get(selectedStationId) || null : null;

  const allDomains = useMemo(
    () => Array.from(new Set((architectureDomains || []).map(domain => domain.name).concat(flows.flatMap(flow => flow.steps.map(step => step.domain))))),
    [architectureDomains, flows]
  );
  const domainColors = useMemo(
    () => buildDomainColors(architectureDomains, allDomains),
    [architectureDomains, allDomains]
  );

  if (!flows.length) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        No user flows detected. Re-analyze for flow visualization.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-gray-300">
        {businessContext?.problem_statement
          ? simplifyForFounder(businessContext.problem_statement, founderMode)
          : 'This map shows how user journeys move across core modules in your system.'}
      </div>

      <div className="overflow-auto rounded-2xl border border-white/10 bg-[#05070d]">
        <div className="relative" style={{ width: layout.width, height: layout.height }}>
          <svg width={layout.width} height={layout.height} className="absolute inset-0">
            <rect width="100%" height="100%" fill="rgba(4,7,14,0.95)" />
            {layout.paths.map((segment) => {
              const active = !hoveredStationId || segment.from === hoveredStationId || segment.to === hoveredStationId;
              const fromStation = layout.stations.find(station => station.id === segment.from);
              const toStation = layout.stations.find(station => station.id === segment.to);
              const labelX = fromStation && toStation ? (fromStation.x + toStation.x) / 2 : 0;
              const labelY = fromStation && toStation ? ((fromStation.y + toStation.y) / 2) - 10 : 0;
              return (
                <g key={segment.id} opacity={active ? 1 : 0.2}>
                  <path
                    d={segment.path}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {segment.dataPassed && (
                    <text
                      x={labelX}
                      y={labelY}
                      fill="rgba(179, 191, 217, 0.9)"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {segment.dataPassed}
                    </text>
                  )}
                </g>
              );
            })}

            {layout.stations.map((station) => {
              const transfer = station.journeys.length > 1;
              const hovered = hoveredStationId === station.id;
              return (
                <g
                  key={station.id}
                  transform={`translate(${station.x}, ${station.y})`}
                  onMouseEnter={() => setHoveredStationId(station.id)}
                  onMouseLeave={() => setHoveredStationId(null)}
                  onClick={() => setSelectedStationId(station.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {transfer ? (
                    <>
                      {station.journeys.slice(0, 3).map((journeyIndex, idx) => (
                        <circle
                          key={`${station.id}-ring-${journeyIndex}`}
                          r={18 - idx * 4}
                          fill="transparent"
                          stroke={JOURNEY_COLORS[journeyIndex % JOURNEY_COLORS.length]}
                          strokeWidth={3}
                        />
                      ))}
                      <circle r={6} fill="white" />
                    </>
                  ) : (
                    <circle
                      r={12}
                      fill={domainColors[station.domain] || colorFromDomain(station.domain)}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth={hovered ? 3 : 1.5}
                    />
                  )}
                  <text x={0} y={28} textAnchor="middle" fill="rgba(230,236,250,0.95)" fontSize="11" fontWeight="600">
                    {station.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {selectedNode && (
            <div className="absolute right-4 top-4 z-10 w-80 rounded-2xl border border-white/15 bg-[#0a0f1a]/95 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
              <button
                onClick={() => setSelectedStationId(null)}
                className="absolute right-3 top-3 text-xs text-gray-400 hover:text-white"
                aria-label="Close details"
              >
                x
              </button>
              <div className="text-xs uppercase tracking-wide text-gray-400">Module</div>
              <div className="mt-1 text-base font-semibold text-white">{selectedNode.name}</div>
              <p className="mt-2 text-sm text-gray-300">
                {founderMode && founderDescriptions?.[selectedNode.id]
                  ? founderDescriptions[selectedNode.id]
                  : simplifyForFounder(selectedNode.description || 'Core system module', founderMode)}
              </p>
              <div className="mt-3 rounded-lg border border-white/10 bg-black/25 p-2 text-xs text-gray-400">
                {selectedNode.files?.length || 0} files involved
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
