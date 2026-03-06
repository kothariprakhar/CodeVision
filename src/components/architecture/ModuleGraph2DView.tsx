'use client';

import { useMemo } from 'react';
import type { ModuleGraph, ModuleLayoutHints } from '@/lib/db';

interface ModuleGraph2DViewProps {
  graph: ModuleGraph;
  layoutHints?: ModuleLayoutHints | null;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

interface PositionedNode {
  id: string;
  label: string;
  x: number;
  y: number;
  layer: string;
  importance: number;
}

const LAYER_ORDER = [
  'presentation',
  'application',
  'domain',
  'data',
  'infrastructure',
  'shared',
  'unknown',
];

function layerColor(layer: string): string {
  switch (layer) {
    case 'presentation':
      return '#7dd3fc';
    case 'application':
      return '#a5b4fc';
    case 'domain':
      return '#c4b5fd';
    case 'data':
      return '#6ee7b7';
    case 'infrastructure':
      return '#fca5a5';
    case 'shared':
      return '#fcd34d';
    default:
      return '#94a3b8';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export default function ModuleGraph2DView({
  graph,
  layoutHints,
  selectedNodeId,
  onSelectNode,
}: ModuleGraph2DViewProps) {
  const width = 1180;
  const height = 460;
  const paddingX = 80;
  const paddingY = 50;

  const layout = useMemo(() => {
    const graphNodeIds = new Set(graph.nodes.map(node => node.id));
    const lanesFromHints = (layoutHints?.lanes || [])
      .map(lane => ({
        id: lane.id,
        label: lane.label,
        node_ids: lane.node_ids.filter(nodeId => graphNodeIds.has(nodeId)),
      }))
      .filter(lane => lane.node_ids.length > 0);

    const nodeById = new Map(graph.nodes.map(node => [node.id, node]));
    const layerBuckets = new Map<string, typeof graph.nodes>();
    for (const node of graph.nodes) {
      const layer = LAYER_ORDER.includes(node.layer) ? node.layer : 'unknown';
      const entries = layerBuckets.get(layer) || [];
      entries.push(node);
      layerBuckets.set(layer, entries);
    }

    const orderedLanes = lanesFromHints.length > 0
      ? lanesFromHints.map(lane => lane.id)
      : (LAYER_ORDER.filter(layer => (layerBuckets.get(layer) || []).length > 0).length > 0
        ? LAYER_ORDER.filter(layer => (layerBuckets.get(layer) || []).length > 0)
        : ['unknown']);

    const laneCount = orderedLanes.length;
    const layerGap = laneCount === 1 ? 0 : (width - paddingX * 2) / (laneCount - 1);

    const positionedNodes: PositionedNode[] = [];
    orderedLanes.forEach((laneId, laneIndex) => {
      const hintLane = lanesFromHints.find(lane => lane.id === laneId);
      const bucket = hintLane
        ? hintLane.node_ids
          .map(nodeId => nodeById.get(nodeId))
          .filter((node): node is NonNullable<typeof node> => Boolean(node))
        : (layerBuckets.get(laneId) || [])
          .slice()
          .sort((a, b) => b.importance_score - a.importance_score);
      const yGap = bucket.length <= 1 ? 0 : (height - paddingY * 2) / (bucket.length - 1);
      bucket.forEach((node, rowIndex) => {
        positionedNodes.push({
          id: node.id,
          label: node.label,
          x: paddingX + laneIndex * layerGap,
          y: paddingY + rowIndex * yGap,
          layer: node.layer,
          importance: node.importance_score,
        });
      });
    });

    return {
      nodes: positionedNodes,
      nodeById: new Map(positionedNodes.map(node => [node.id, node])),
      lanes: orderedLanes.map(laneId => lanesFromHints.find(lane => lane.id === laneId)?.label || laneId),
      focusPathKeys: new Set((layoutHints?.focus_paths || []).map(path => `${path.from}->${path.to}`)),
    };
  }, [graph, layoutHints]);

  return (
    <div className="rounded-xl border border-white/10 bg-[#060b17]/90 p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[420px] w-full"
        role="img"
        aria-label="Module dependency graph"
      >
        <defs>
          <linearGradient id="edgeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7ea6ff" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff88ee" stopOpacity="0.22" />
          </linearGradient>
        </defs>

        {layout.lanes.map((lane, index) => {
          const x = layout.lanes.length === 1
            ? width / 2
            : paddingX + ((width - paddingX * 2) / (layout.lanes.length - 1)) * index;
          return (
            <g key={lane}>
              <line
                x1={x}
                y1={18}
                x2={x}
                y2={height - 18}
                stroke="#1f2a3f"
                strokeWidth="1"
                strokeDasharray="4 6"
              />
              <text
                x={x}
                y={14}
                textAnchor="middle"
                fill="#7c8aa6"
                fontSize="11"
                style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                {lane}
              </text>
            </g>
          );
        })}

        {graph.edges.map((edge, index) => {
          const from = layout.nodeById.get(edge.from);
          const to = layout.nodeById.get(edge.to);
          if (!from || !to) return null;
          const cp1x = from.x + (to.x - from.x) * 0.35;
          const cp2x = from.x + (to.x - from.x) * 0.7;
          const path = `M ${from.x} ${from.y} C ${cp1x} ${from.y}, ${cp2x} ${to.y}, ${to.x} ${to.y}`;
          const isFocusPath = layout.focusPathKeys.has(`${edge.from}->${edge.to}`);
          return (
            <path
              key={`${edge.from}-${edge.to}-${index}`}
              d={path}
              fill="none"
              stroke="url(#edgeGradient)"
              strokeWidth={isFocusPath ? 2.1 : 1.3}
              opacity={isFocusPath ? 0.92 : 0.8}
            />
          );
        })}

        {layout.nodes.map(node => {
          const selected = selectedNodeId === node.id;
          const radius = 8 + clamp(node.importance * 14, 2, 14);
          const fill = layerColor(node.layer);
          return (
            <g
              key={node.id}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => onSelectNode(node.id)}
              style={{ cursor: 'pointer' }}
            >
              <circle
                r={radius + 3}
                fill={selected ? '#f59cf2' : '#6a89c8'}
                opacity={selected ? 0.34 : 0.18}
              />
              <circle
                r={radius}
                fill={fill}
                stroke={selected ? '#f5d0fe' : '#111827'}
                strokeWidth={selected ? 2.4 : 1.4}
              />
              <text
                x={radius + 8}
                y={4}
                fill="#e5edf9"
                fontSize="11"
                fontWeight={selected ? 700 : 500}
              >
                {node.label.length > 32 ? `${node.label.slice(0, 29)}...` : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
