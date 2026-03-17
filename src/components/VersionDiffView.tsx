'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';
import RefSelector from './RefSelector';
import type { GitRefItem } from './RefSelector';
import BreakingChangesAlert from './BreakingChangesAlert';
import DependencyCascadeView from './DependencyCascadeView';
import FileDiffPanel from './FileDiffPanel';

type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

interface AnalysisVersion {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
  branch?: string | null;
  commit_hash?: string | null;
  commit_url?: string | null;
  summary?: string | null;
  ref_type?: string | null;
  ref_label?: string | null;
}

interface ModuleDiff {
  id: string;
  name: string;
  status: DiffChangeType;
  reasons: string[];
  before?: { type: string; complexity: string; description: string; files: string[] };
  after?: { type: string; complexity: string; description: string; files: string[] };
  degree_before: number;
  degree_after: number;
}

interface EdgeDiff {
  id: string;
  from: string;
  to: string;
  edge_type: 'imports' | 'calls' | 'stores' | 'renders';
  status: DiffChangeType;
  label_before?: string;
  label_after?: string;
}

interface JourneyDiff {
  id: string;
  name: string;
  status: DiffChangeType;
  before_steps: number;
  after_steps: number;
  summary: string;
}

interface RiskDiff {
  key: string;
  title: string;
  status: DiffChangeType;
  severity_before?: string;
  severity_after?: string;
}

interface TechDiff {
  name: string;
  status: DiffChangeType;
}

interface FileDiffItem {
  path: string;
  status: DiffChangeType;
  module_id?: string;
}

interface BreakingChangeRiskItem {
  module_id: string;
  module_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  affected_dependents: string[];
}

interface DependencyCascadeItem {
  changed_module_id: string;
  changed_module_name: string;
  directly_affected: string[];
  transitively_affected: string[];
  total_blast_radius: number;
}

interface VersionDiffSummary {
  modules_added: number;
  modules_removed: number;
  modules_modified: number;
  edges_added: number;
  edges_removed: number;
  edges_modified: number;
  journeys_added: number;
  journeys_removed: number;
  journeys_modified: number;
  risks_increased: number;
  risks_decreased: number;
  tech_added: number;
  tech_removed: number;
}

interface VersionDiffResult {
  from: { analysis_id: string; analyzed_at: string; branch?: string; commit_hash?: string; commit_url?: string };
  to: { analysis_id: string; analyzed_at: string; branch?: string; commit_hash?: string; commit_url?: string };
  summary: VersionDiffSummary;
  module_changes: ModuleDiff[];
  edge_changes: EdgeDiff[];
  journey_changes: JourneyDiff[];
  risk_changes: RiskDiff[];
  tech_changes: TechDiff[];
  file_changes: FileDiffItem[];
  breaking_change_risks: BreakingChangeRiskItem[];
  dependency_cascades: DependencyCascadeItem[];
  business_impact_notes: string[];
  generated_at: string;
}

interface VersionDiffViewProps {
  projectId: string;
  versions: AnalysisVersion[];
  founderMode?: boolean;
  githubUrl?: string;
}

interface RenderNode {
  id: string;
  label: string;
  status: DiffChangeType;
  x: number;
  y: number;
  width: number;
  height: number;
  score: number;
}

interface RenderEdge {
  id: string;
  from: string;
  to: string;
  status: DiffChangeType;
  label: string;
}

const STATUS_COLORS: Record<DiffChangeType, string> = {
  added: 'hsl(145, 62%, 48%)',
  removed: 'hsl(4, 74%, 56%)',
  modified: 'hsl(38, 90%, 55%)',
  unchanged: 'hsl(220, 12%, 46%)',
};

function formatVersionLabel(version: AnalysisVersion): string {
  const label = version.ref_label || version.branch || (version.commit_hash ? version.commit_hash.slice(0, 7) : `v-${version.id.slice(0, 6)}`);
  const date = new Date(version.analyzed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${label} · ${date}`;
}

function timeStampLabel(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function buildDeltaLayout(
  modules: ModuleDiff[],
  edges: EdgeDiff[],
  statuses: Set<DiffChangeType>
): { nodes: RenderNode[]; edges: RenderEdge[]; width: number; height: number } {
  const chosenModules = modules.filter(m => statuses.has(m.status));
  const chosenEdges = edges.filter(e => statuses.has(e.status));

  const nodeById = new Map(chosenModules.map(m => [m.id, m]));
  chosenEdges.forEach((edge) => {
    if (!nodeById.has(edge.from)) {
      const fb = modules.find(m => m.id === edge.from);
      if (fb) nodeById.set(edge.from, fb);
    }
    if (!nodeById.has(edge.to)) {
      const fb = modules.find(m => m.id === edge.to);
      if (fb) nodeById.set(edge.to, fb);
    }
  });

  const nodes = Array.from(nodeById.values());
  const graphNodes = new Map(
    nodes.map(m => [m.id, { id: m.id, label: m.name, status: m.status, score: m.degree_before + m.degree_after + (m.status === 'modified' ? 2 : 0) }])
  );

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  graphNodes.forEach((_, id) => { indegree.set(id, 0); outgoing.set(id, []); });

  chosenEdges.forEach((edge) => {
    if (!graphNodes.has(edge.from) || !graphNodes.has(edge.to)) return;
    indegree.set(edge.to, (indegree.get(edge.to) || 0) + 1);
    outgoing.get(edge.from)?.push(edge.to);
  });

  const level = new Map<string, number>();
  graphNodes.forEach((_, id) => level.set(id, 0));
  const queue = Array.from(graphNodes.keys()).filter(id => (indegree.get(id) || 0) === 0);

  while (queue.length > 0) {
    const current = queue.shift() as string;
    const nextLevel = (level.get(current) || 0) + 1;
    (outgoing.get(current) || []).forEach((target) => {
      if (nextLevel > (level.get(target) || 0)) level.set(target, nextLevel);
      indegree.set(target, (indegree.get(target) || 0) - 1);
      if ((indegree.get(target) || 0) === 0) queue.push(target);
    });
  }

  const layers = new Map<number, Array<{ id: string; label: string; status: DiffChangeType; score: number }>>();
  graphNodes.forEach((node, id) => {
    const l = level.get(id) || 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)?.push(node);
  });

  const xStart = 64, yStart = 64, xGap = 320, yGap = 160, w = 240, h = 96;
  const renderNodes: RenderNode[] = [];
  Array.from(layers.keys()).sort((a, b) => a - b).forEach((layer, layerIndex) => {
    const layerNodes = layers.get(layer) || [];
    layerNodes.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));
    layerNodes.forEach((node, index) => {
      renderNodes.push({ id: node.id, label: node.label, status: node.status, x: xStart + index * xGap, y: yStart + layerIndex * yGap, width: w, height: h, score: node.score });
    });
  });

  const renderNodeMap = new Map(renderNodes.map(n => [n.id, n]));
  const renderEdges: RenderEdge[] = chosenEdges
    .filter(e => renderNodeMap.has(e.from) && renderNodeMap.has(e.to))
    .map(e => ({ id: e.id, from: e.from, to: e.to, status: e.status, label: e.label_after || e.label_before || e.edge_type }));

  const canvasWidth = Math.max(1200, renderNodes.reduce((max, n) => Math.max(max, n.x + n.width), 0) + 160);
  const canvasHeight = Math.max(720, renderNodes.reduce((max, n) => Math.max(max, n.y + n.height), 0) + 160);

  return { nodes: renderNodes, edges: renderEdges, width: canvasWidth, height: canvasHeight };
}

export default function VersionDiffView({ projectId, versions, founderMode = false, githubUrl }: VersionDiffViewProps) {
  // Base version: default to latest analysis with no ref_type (main branch)
  const baseVersion = useMemo(() => {
    return versions.find(v => !v.ref_type) || versions[0] || null;
  }, [versions]);

  const [baseVersionId, setBaseVersionId] = useState('');
  const [compareVersionId, setCompareVersionId] = useState('');
  const [diff, setDiff] = useState<VersionDiffResult | null>(null);
  const [diffPairKey, setDiffPairKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeStatuses, setActiveStatuses] = useState<Set<DiffChangeType>>(new Set(['added', 'removed', 'modified']));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [analyzingRef, setAnalyzingRef] = useState<string | null>(null);

  const effectiveBaseId = useMemo(() => {
    if (versions.some(v => v.id === baseVersionId)) return baseVersionId;
    return baseVersion?.id || '';
  }, [versions, baseVersionId, baseVersion]);

  const effectiveCompareId = useMemo(() => {
    if (versions.some(v => v.id === compareVersionId)) return compareVersionId;
    // Default: latest non-base version
    const nonBase = versions.find(v => v.id !== effectiveBaseId);
    return nonBase?.id || '';
  }, [versions, compareVersionId, effectiveBaseId]);

  const validPair = Boolean(effectiveBaseId && effectiveCompareId && effectiveBaseId !== effectiveCompareId);
  const activePairKey = `${effectiveBaseId}:${effectiveCompareId}`;
  const loading = validPair && diffPairKey !== activePairKey && !error;

  useEffect(() => {
    if (!validPair) return;
    let cancelled = false;

    fetch(`/api/analysis/${projectId}/diff?from=${encodeURIComponent(effectiveBaseId)}&to=${encodeURIComponent(effectiveCompareId)}`)
      .then(async (res) => {
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.error || 'Failed to fetch version diff');
        if (!cancelled) {
          setDiff(payload.diff as VersionDiffResult);
          setDiffPairKey(activePairKey);
          setSelectedNodeId(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to fetch version diff');
      });

    return () => { cancelled = true; };
  }, [projectId, effectiveBaseId, effectiveCompareId, validPair, activePairKey]);

  const layout = useMemo(() => {
    if (!diff) return { nodes: [], edges: [], width: 1200, height: 720 };
    return buildDeltaLayout(diff.module_changes, diff.edge_changes, activeStatuses);
  }, [diff, activeStatuses]);

  const selectedNode = useMemo(() => {
    if (!diff || !selectedNodeId) return null;
    return diff.module_changes.find(m => m.id === selectedNodeId) || null;
  }, [diff, selectedNodeId]);

  const moduleNameMap = useMemo(() => {
    if (!diff) return {};
    const map: Record<string, string> = {};
    for (const m of diff.module_changes) {
      map[m.id] = m.name;
    }
    return map;
  }, [diff]);

  const toggleStatus = (status: DiffChangeType) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next.size > 0 ? next : new Set<DiffChangeType>(['added', 'removed', 'modified']);
    });
  };

  const handleAnalyzeRef = useCallback(async (ref: GitRefItem) => {
    const refLabel = ref.type === 'pr' ? `PR #${ref.prNumber}` : ref.name;
    setAnalyzingRef(refLabel);
    setError(null);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          ref_type: ref.type,
          ref_value: ref.type === 'pr' ? String(ref.prNumber) : (ref.type === 'commit' ? ref.sha : ref.name),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Analysis failed');

      // Reload versions to pick up the new analysis
      if (data.id) {
        setCompareVersionId(data.id);
      }
      // Trigger re-fetch of versions by reloading the page data
      window.location.reload();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzingRef(null);
    }
  }, [projectId]);

  const handleSelectRef = useCallback((ref: GitRefItem) => {
    // Find a matching analysis version
    const match = versions.find(v =>
      v.ref_label === ref.name ||
      v.ref_label === `PR #${ref.prNumber}` ||
      v.branch === ref.name ||
      v.branch === ref.headBranch ||
      v.commit_hash === ref.sha
    );
    if (match) {
      setCompareVersionId(match.id);
      setError(null);
    }
  }, [versions]);

  // Empty state
  if (versions.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">
        No analyses yet. Run an analysis first, then compare versions here.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Ref Selector Panel */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Base Version */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-gray-400">Base (Deployed)</div>
          {baseVersion && (
            <div className="rounded-lg border border-indigo-400/40 bg-indigo-500/10 p-3">
              <div className="text-sm font-semibold text-white">{formatVersionLabel(baseVersion)}</div>
              <div className="mt-1 text-xs text-gray-400">{timeStampLabel(baseVersion.analyzed_at)}</div>
              {baseVersion.branch && <div className="mt-1 text-[11px] text-gray-500">Branch: {baseVersion.branch}</div>}
            </div>
          )}
          {versions.length > 1 && (
            <label className="mt-3 block text-xs text-gray-300">
              Change base
              <select
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1120] px-2 py-2 text-xs text-gray-200"
                value={effectiveBaseId}
                onChange={(e) => { setError(null); setBaseVersionId(e.target.value); }}
              >
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>{formatVersionLabel(v)}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        {/* Compare Version */}
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-gray-400">Compare</div>

          {/* If we have a github URL, show the ref selector */}
          {githubUrl ? (
            <RefSelector
              projectId={projectId}
              onSelect={handleSelectRef}
              onAnalyze={handleAnalyzeRef}
              analyzingRef={analyzingRef}
            />
          ) : (
            /* Fallback: simple dropdown for existing versions */
            <label className="block text-xs text-gray-300">
              Select version
              <select
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1120] px-2 py-2 text-xs text-gray-200"
                value={effectiveCompareId}
                onChange={(e) => { setError(null); setCompareVersionId(e.target.value); }}
              >
                {versions.filter(v => v.id !== effectiveBaseId).map((v) => (
                  <option key={v.id} value={v.id}>{formatVersionLabel(v)}</option>
                ))}
              </select>
            </label>
          )}

          {/* Also show dropdown for already-analyzed versions */}
          {githubUrl && versions.length > 1 && (
            <label className="mt-3 block text-xs text-gray-300">
              Or pick an existing analysis
              <select
                className="mt-1 w-full rounded-lg border border-white/15 bg-[#0b1120] px-2 py-2 text-xs text-gray-200"
                value={effectiveCompareId}
                onChange={(e) => { setError(null); setCompareVersionId(e.target.value); }}
              >
                <option value="">Select...</option>
                {versions.filter(v => v.id !== effectiveBaseId).map((v) => (
                  <option key={v.id} value={v.id}>{formatVersionLabel(v)}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-sm text-gray-300">
          Computing architecture and business impact diff...
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-400/35 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Diff Results */}
      {diff && diffPairKey === activePairKey && validPair && (
        <>
          {/* Breaking Change Warnings */}
          <BreakingChangesAlert risks={diff.breaking_change_risks} />

          {/* Summary Cards */}
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
              <div className="text-xs uppercase tracking-wide text-emerald-200">Modules</div>
              <div className="mt-1 text-sm text-white">
                +{diff.summary.modules_added} / -{diff.summary.modules_removed} / ~{diff.summary.modules_modified}
              </div>
            </div>
            <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-3">
              <div className="text-xs uppercase tracking-wide text-indigo-200">Journeys</div>
              <div className="mt-1 text-sm text-white">
                +{diff.summary.journeys_added} / -{diff.summary.journeys_removed} / ~{diff.summary.journeys_modified}
              </div>
            </div>
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3">
              <div className="text-xs uppercase tracking-wide text-amber-200">Risk Shift</div>
              <div className="mt-1 text-sm text-white">
                ↑ {diff.summary.risks_increased} / ↓ {diff.summary.risks_decreased}
              </div>
            </div>
            <div className="rounded-lg border border-purple-400/30 bg-purple-500/10 p-3">
              <div className="text-xs uppercase tracking-wide text-purple-200">Tech Stack</div>
              <div className="mt-1 text-sm text-white">
                +{diff.summary.tech_added} / -{diff.summary.tech_removed}
              </div>
            </div>
          </div>

          {/* Architecture Delta Map */}
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-white">Architecture Delta Map</div>
              <div className="ml-auto flex gap-2">
                {(['added', 'removed', 'modified', 'unchanged'] as DiffChangeType[]).map((status) => (
                  <button
                    key={status}
                    onClick={() => toggleStatus(status)}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${activeStatuses.has(status) ? 'text-white' : 'text-gray-500'}`}
                    style={{
                      borderColor: activeStatuses.has(status) ? `${STATUS_COLORS[status]}B0` : 'rgba(255,255,255,0.15)',
                      background: activeStatuses.has(status) ? `${STATUS_COLORS[status]}33` : 'rgba(255,255,255,0.02)',
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-auto rounded-xl border border-white/10 bg-[#060915]">
              <div className="relative" style={{ width: layout.width, height: layout.height }}>
                <svg width={layout.width} height={layout.height} className="absolute inset-0" aria-hidden>
                  {layout.edges.map((edge) => {
                    const source = layout.nodes.find(n => n.id === edge.from);
                    const target = layout.nodes.find(n => n.id === edge.to);
                    if (!source || !target) return null;
                    const sx = source.x + source.width / 2, sy = source.y + source.height / 2;
                    const tx = target.x + target.width / 2, ty = target.y + target.height / 2;
                    const midY = sy + (ty - sy) / 2;
                    return (
                      <path key={edge.id} d={`M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`}
                        fill="none" stroke={STATUS_COLORS[edge.status]}
                        strokeWidth={edge.status === 'modified' ? 2.5 : 2}
                        strokeDasharray={edge.status === 'removed' ? '6 4' : undefined} opacity={0.8}
                      />
                    );
                  })}
                </svg>

                {layout.nodes.map((node) => (
                  <button key={node.id} onClick={() => setSelectedNodeId(node.id)}
                    className="absolute rounded-xl border px-3 py-2 text-left transition-all hover:scale-[1.01]"
                    style={{
                      left: node.x, top: node.y, width: node.width, height: node.height,
                      borderColor: `${STATUS_COLORS[node.status]}B3`, background: 'rgba(8, 12, 24, 0.9)',
                      boxShadow: `0 0 0 1px ${STATUS_COLORS[node.status]}24`,
                    }}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: STATUS_COLORS[node.status] }}>
                      {node.status}
                    </div>
                    <div className="mt-1 truncate text-sm font-semibold text-white">{node.label}</div>
                  </button>
                ))}
              </div>
            </div>

            {selectedNode && (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-semibold text-white">{selectedNode.name}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide" style={{ color: STATUS_COLORS[selectedNode.status] }}>
                  {selectedNode.status}
                </div>
                {selectedNode.reasons.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-gray-300">
                    {selectedNode.reasons.map(reason => <li key={reason}>• {reason}</li>)}
                  </ul>
                )}
                <div className="mt-2 grid gap-2 text-xs text-gray-300 md:grid-cols-2">
                  <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                    <div className="text-gray-400">Before</div>
                    <div className="mt-1">Files: {selectedNode.before?.files.length || 0}</div>
                    <div>Complexity: {selectedNode.before?.complexity || 'n/a'}</div>
                  </div>
                  <div className="rounded border border-white/10 bg-white/[0.03] p-2">
                    <div className="text-gray-400">After</div>
                    <div className="mt-1">Files: {selectedNode.after?.files.length || 0}</div>
                    <div>Complexity: {selectedNode.after?.complexity || 'n/a'}</div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* File Changes */}
          <FileDiffPanel files={diff.file_changes} moduleNames={moduleNameMap} />

          {/* Dependency Cascade */}
          <DependencyCascadeView cascades={diff.dependency_cascades} />

          {/* Business Impact */}
          <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="text-sm font-semibold text-white">Business Impact</div>
            <ul className="mt-3 space-y-2 text-sm text-gray-300">
              {diff.business_impact_notes.map((note) => (
                <li key={note}>• {simplifyForFounder(note, founderMode)}</li>
              ))}
            </ul>
          </section>

          {/* Journey / Risk / Tech Changes */}
          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">Journey Changes</div>
              <div className="mt-2 space-y-2 text-xs text-gray-300">
                {diff.journey_changes.filter(i => i.status !== 'unchanged').slice(0, 8).map((item) => (
                  <div key={item.id} className="rounded border border-white/10 bg-black/20 p-2">
                    <div className="font-semibold text-white">{item.name}</div>
                    <div className="mt-1">{item.summary}</div>
                  </div>
                ))}
                {diff.journey_changes.filter(i => i.status !== 'unchanged').length === 0 && (
                  <div className="text-gray-500">No journey changes detected.</div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">Risk Changes</div>
              <div className="mt-2 space-y-2 text-xs text-gray-300">
                {diff.risk_changes.filter(i => i.status !== 'unchanged').slice(0, 8).map((item) => (
                  <div key={item.key} className="rounded border border-white/10 bg-black/20 p-2">
                    <div className="font-semibold text-white">{item.title}</div>
                    <div className="mt-1">
                      {item.status === 'modified' ? `${item.severity_before} → ${item.severity_after}` : item.status}
                    </div>
                  </div>
                ))}
                {diff.risk_changes.filter(i => i.status !== 'unchanged').length === 0 && (
                  <div className="text-gray-500">No risk deltas detected.</div>
                )}
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="text-sm font-semibold text-white">Tech Changes</div>
              <div className="mt-2 space-y-2 text-xs text-gray-300">
                {diff.tech_changes.filter(i => i.status !== 'unchanged').slice(0, 10).map((item) => (
                  <div key={item.name} className="rounded border border-white/10 bg-black/20 p-2">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{ background: `${STATUS_COLORS[item.status]}22`, color: STATUS_COLORS[item.status] }}
                    >
                      {item.status}
                    </span>
                    <span className="ml-2">{item.name}</span>
                  </div>
                ))}
                {diff.tech_changes.filter(i => i.status !== 'unchanged').length === 0 && (
                  <div className="text-gray-500">No technology set changes detected.</div>
                )}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
