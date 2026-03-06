'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type {
  ModuleGraph,
  ModuleGraph3D,
  ModuleLayoutHints,
  ModuleQualityReport,
  VisualQualityReport,
} from '@/lib/db';
import ModuleGraph2DView from './architecture/ModuleGraph2DView';

const ModuleGraph3DView = dynamic(
  () => import('./architecture/ModuleGraph3DView'),
  { ssr: false }
);

interface ModuleDrilldown {
  node: ModuleGraph['nodes'][number];
  children: ModuleGraph['nodes'];
  connected_edges: ModuleGraph['edges'];
  linked_files: Array<{
    id: string;
    label: string;
    path: string;
    loc: number;
    hotness_score: number;
  }>;
  quality: {
    evidence_count: number;
  };
}

interface ArchitectureModuleMapProps {
  projectId: string;
  analysisId: string;
}

export default function ArchitectureModuleMap({
  projectId,
  analysisId,
}: ArchitectureModuleMapProps) {
  const [moduleGraph, setModuleGraph] = useState<ModuleGraph | null>(null);
  const [moduleQuality, setModuleQuality] = useState<ModuleQualityReport | null>(null);
  const [moduleGraph3D, setModuleGraph3D] = useState<ModuleGraph3D | null>(null);
  const [visualQuality, setVisualQuality] = useState<VisualQualityReport | null>(null);
  const [moduleLayoutHints, setModuleLayoutHints] = useState<ModuleLayoutHints | null>(null);
  const [drilldown, setDrilldown] = useState<ModuleDrilldown | null>(null);
  const [selectedModuleNodeId, setSelectedModuleNodeId] = useState<string | null>(null);
  const [selectedVisualNodeId, setSelectedVisualNodeId] = useState<string | null>(null);
  const [mode, setMode] = useState<'2d' | '3d'>('2d');
  const [labelMode, setLabelMode] = useState<'business' | 'technical'>('business');
  const [groupBy, setGroupBy] = useState<'layer' | 'directory' | 'service'>('layer');
  const [graph3DLayer, setGraph3DLayer] = useState<'directories' | 'all' | 'hotspots'>('directories');
  const [webglSupported, setWebglSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [graph3DError, setGraph3DError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const supported = Boolean(
      canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    );
    setWebglSupported(supported);
  }, []);

  useEffect(() => {
    if (mode === '3d' && !webglSupported) {
      setMode('2d');
    }
  }, [mode, webglSupported]);

  useEffect(() => {
    if (!analysisId) return;
    async function fetchModuleGraphs() {
      setLoading(true);
      setError('');

      try {
        const [moduleGraphResponse, moduleGraph3DResponse] = await Promise.all([
          fetch(`/api/analysis/${projectId}/module-graph?version=${analysisId}`),
          fetch(`/api/analysis/${projectId}/module-graph-3d?version=${analysisId}`),
        ]);

        const graphPayload = await moduleGraphResponse.json();
        const graph3DPayload = await moduleGraph3DResponse.json();

        if (!moduleGraphResponse.ok) {
          throw new Error(graphPayload.error || 'Failed to load architecture diagram');
        }

        setModuleGraph(graphPayload.module_graph || null);
        setModuleQuality(graphPayload.module_quality_report || null);
        setModuleLayoutHints(graphPayload.module_layout_hints || null);
        setModuleGraph3D(moduleGraph3DResponse.ok ? (graph3DPayload.module_graph_3d || null) : null);
        setVisualQuality(moduleGraph3DResponse.ok ? (graph3DPayload.visual_quality_report || null) : null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load architecture diagram');
      } finally {
        setLoading(false);
      }
    }

    fetchModuleGraphs();
  }, [projectId, analysisId]);

  useEffect(() => {
    if (!selectedModuleNodeId || !analysisId) {
      setDrilldown(null);
      return;
    }

    async function fetchDrilldown() {
      try {
        const response = await fetch(
          `/api/analysis/lenses/${analysisId}/module/${selectedModuleNodeId}?depth=2`
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load module details');
        }
        setDrilldown(payload);
      } catch {
        setDrilldown(null);
      }
    }

    fetchDrilldown();
  }, [selectedModuleNodeId, analysisId]);

  const filteredNodes = useMemo(() => {
    if (!moduleGraph) return [];
    return moduleGraph.nodes.slice().sort((a, b) => b.importance_score - a.importance_score);
  }, [moduleGraph]);

  const groupedNodes = useMemo(() => {
    const groups = new Map<string, typeof filteredNodes>();
    filteredNodes.forEach(node => {
      let key = 'Other';
      if (groupBy === 'layer') key = node.layer;
      if (groupBy === 'directory') key = node.paths[0]?.split('/')[0] || 'root';
      if (groupBy === 'service') key = node.module_type;
      const entries = groups.get(key) || [];
      entries.push(node);
      groups.set(key, entries);
    });
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredNodes, groupBy]);

  const selected3DNode = useMemo(
    () => moduleGraph3D?.nodes.find(node => node.id === selectedVisualNodeId) || null,
    [moduleGraph3D, selectedVisualNodeId]
  );

  const renderGraph3D = useMemo(() => {
    if (!moduleGraph3D) return null;

    const directoryNodes = moduleGraph3D.nodes.filter(node => node.node_kind === 'directory');
    const fileNodes = moduleGraph3D.nodes.filter(node => node.node_kind === 'file');
    const hotspotIds = new Set(moduleLayoutHints?.hotspots || []);

    let selectedNodes = directoryNodes;
    if (graph3DLayer === 'all') {
      selectedNodes = [
        ...directoryNodes,
        ...fileNodes
          .slice()
          .sort((a, b) => b.importance_score - a.importance_score)
          .slice(0, 220),
      ];
    }
    if (graph3DLayer === 'hotspots') {
      const hintedHotspotDirectories = directoryNodes.filter(node => hotspotIds.has(node.cluster_id));
      selectedNodes = [
        ...hintedHotspotDirectories,
        ...fileNodes
          .slice()
          .sort((a, b) => b.hotness_score - a.hotness_score)
          .slice(0, 120),
      ];
    }

    const selectedNodeIds = new Set(selectedNodes.map(node => node.id));
    const selectedEdges = moduleGraph3D.edges
      .filter(edge => selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to))
      .slice(0, graph3DLayer === 'directories' ? 140 : 380);

    return {
      nodes: selectedNodes,
      edges: selectedEdges,
      hotspotNodeIds: moduleLayoutHints?.hotspots || [],
    };
  }, [moduleGraph3D, graph3DLayer, moduleLayoutHints]);

  const handleSelectModuleNode = (nodeId: string) => {
    setSelectedModuleNodeId(nodeId);
    setSelectedVisualNodeId(`directory:${nodeId}`);
  };

  const handleSelectVisualNode = (visualNodeId: string) => {
    setSelectedVisualNodeId(visualNodeId);
    if (visualNodeId.startsWith('directory:')) {
      setSelectedModuleNodeId(visualNodeId.replace('directory:', ''));
      return;
    }
    if (!moduleGraph3D) return;
    const fileNode = moduleGraph3D.nodes.find(node => node.id === visualNodeId);
    if (!fileNode) return;
    setSelectedModuleNodeId(fileNode.cluster_id);
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Loading architecture diagram...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!moduleGraph) {
    return (
      <div className="text-sm text-gray-400">
        Architecture diagram is unavailable for this analysis version.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Architecture Diagram</h3>
            <p className="mt-1 text-xs text-gray-300">{moduleGraph.root_summary}</p>
            <p className="mt-1 text-[11px] text-gray-500">
              Archetype: {moduleGraph.repo_archetype}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              onClick={() => setMode('2d')}
              className={`rounded-full px-3 py-1 ${mode === '2d' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/10 text-gray-300'}`}
            >
              2D Overview
            </button>
            <button
              onClick={() => setMode('3d')}
              className={`rounded-full px-3 py-1 ${mode === '3d' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/10 text-gray-300'}`}
            >
              3D Graph
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-400">
          {moduleQuality && (
            <>
              <span className="rounded-full bg-white/10 px-2 py-1">
                Coverage {Math.round(moduleQuality.coverage_score * 100)}%
              </span>
              <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-yellow-200">
                Fallback: {moduleQuality.fallback_mode}
              </span>
            </>
          )}
          {visualQuality && (
            <span className="rounded-full bg-white/10 px-2 py-1">
              History {visualQuality.history_available ? 'available' : 'unavailable'}
            </span>
          )}
        </div>
        {moduleLayoutHints?.narrative ? (
          <p className="mt-2 text-xs text-gray-400">{moduleLayoutHints.narrative}</p>
        ) : null}
      </div>

      {mode === '2d' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs">
            <label className="flex items-center gap-2 text-gray-300">
              Label view
              <select
                value={labelMode}
                onChange={e => setLabelMode(e.target.value as 'business' | 'technical')}
                className="rounded bg-black/30 px-2 py-1 text-gray-200"
              >
                <option value="business">Business labels</option>
                <option value="technical">Technical ids</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-gray-300">
              Group by
              <select
                value={groupBy}
                onChange={e => setGroupBy(e.target.value as 'layer' | 'directory' | 'service')}
                className="rounded bg-black/30 px-2 py-1 text-gray-200"
              >
                <option value="layer">Layer</option>
                <option value="directory">Directory</option>
                <option value="service">Service Type</option>
              </select>
            </label>
          </div>

          <div className="grid gap-5 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              <ModuleGraph2DView
                graph={moduleGraph}
                layoutHints={moduleLayoutHints}
                selectedNodeId={selectedModuleNodeId}
                onSelectNode={handleSelectModuleNode}
              />

              {groupedNodes.map(([group, nodes]) => (
                <div key={group} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">{group}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {nodes.map(node => (
                      <button
                        key={node.id}
                        onClick={() => handleSelectModuleNode(node.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          selectedModuleNodeId === node.id
                            ? 'border-indigo-400/70 bg-indigo-500/10'
                            : 'border-white/10 bg-black/20 hover:border-indigo-400/40'
                        }`}
                      >
                        <p className="text-sm font-semibold text-white">
                          {labelMode === 'business' ? node.label : node.id}
                        </p>
                        <p className="mt-1 text-xs text-gray-300">{node.module_type}</p>
                        <p className="mt-1 text-[11px] text-gray-500">
                          {node.paths.length} paths · Importance {Math.round(node.importance_score * 100)}%
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Top Relationships</p>
                {moduleGraph.edges.length === 0 ? (
                  <p className="mt-2 text-xs text-gray-400">Interaction signals unavailable for this repo version.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                    {moduleGraph.edges.slice(0, 14).map(edge => (
                      <li key={`${edge.from}-${edge.to}`} className="rounded bg-white/[0.03] px-2 py-1">
                        {edge.from} → {edge.to} ({edge.relation})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">Module Details</p>
              {!drilldown ? (
                <p className="mt-2 text-xs text-gray-400">
                  Select a module to inspect dependencies, evidence, and linked files.
                </p>
              ) : (
                <div className="mt-3 space-y-3 text-xs">
                  <div>
                    <p className="text-sm font-semibold text-white">{drilldown.node.label}</p>
                    <p className="text-gray-400">
                      {drilldown.node.module_type} · {drilldown.node.layer}
                    </p>
                  </div>
                  <div className="rounded border border-white/10 bg-black/20 p-2 text-gray-300">
                    Evidence {drilldown.quality.evidence_count}
                  </div>
                  <div>
                    <p className="font-medium text-gray-300">Downstream Modules</p>
                    {drilldown.children.length === 0 ? (
                      <p className="mt-1 text-gray-500">No downstream modules found.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-gray-300">
                        {drilldown.children.slice(0, 10).map(child => (
                          <li key={child.id} className="rounded bg-white/[0.03] px-2 py-1">
                            {child.label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-300">Linked Files</p>
                    {drilldown.linked_files.length === 0 ? (
                      <p className="mt-1 text-gray-500">No linked files in current depth.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-gray-300">
                        {drilldown.linked_files.slice(0, 8).map(file => (
                          <li key={file.id} className="rounded bg-white/[0.03] px-2 py-1">
                            {file.label} · LOC {file.loc} · Hotness {Math.round(file.hotness_score * 100)}%
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {mode === '3d' && (
        <div className="space-y-3">
          {!webglSupported && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-sm text-yellow-200">
              WebGL is not available in this environment. Falling back to 2D view.
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2 text-xs">
            <button
              onClick={() => setGraph3DLayer('directories')}
              className={`rounded-full px-3 py-1 ${graph3DLayer === 'directories' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/10 text-gray-300'}`}
            >
              Directories Only
            </button>
            <button
              onClick={() => setGraph3DLayer('hotspots')}
              className={`rounded-full px-3 py-1 ${graph3DLayer === 'hotspots' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/10 text-gray-300'}`}
            >
              Hotspots
            </button>
            <button
              onClick={() => setGraph3DLayer('all')}
              className={`rounded-full px-3 py-1 ${graph3DLayer === 'all' ? 'bg-indigo-500/30 text-indigo-100' : 'bg-white/10 text-gray-300'}`}
            >
              Directories + Files
            </button>
          </div>

          {visualQuality?.notes?.length ? (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-gray-300">
              {visualQuality.notes.join(' ')}
            </div>
          ) : null}
          {webglSupported && renderGraph3D ? (
            <ModuleGraph3DView
              graphData={renderGraph3D}
              selectedNodeId={selectedVisualNodeId}
              onSelectNode={(nodeId: string) => handleSelectVisualNode(nodeId)}
              onRenderError={(message: string) => {
                setGraph3DError(message);
                setMode('2d');
              }}
            />
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-400">
              3D graph unavailable for this analysis version. Use the 2D overview mode.
            </div>
          )}
          {graph3DError ? (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs text-yellow-200">
              3D renderer fallback triggered: {graph3DError}
            </div>
          ) : null}

          {selected3DNode && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-gray-300">
              <p className="font-semibold text-white">{selected3DNode.label}</p>
              <p>
                {selected3DNode.node_kind} · LOC {selected3DNode.loc} · Hotness {Math.round(selected3DNode.hotness_score * 100)}%
              </p>
              <p className="text-gray-400">{selected3DNode.path}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
