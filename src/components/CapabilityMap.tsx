'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CapabilityGraph, QualityReport } from '@/lib/db';

interface LinkedJourney {
  journey_id: string;
  journey_name: string;
  step_ids: string[];
}

interface NodeDrilldown {
  node: CapabilityGraph['nodes'][number];
  children: CapabilityGraph['nodes'];
  linked_journeys: LinkedJourney[];
  quality: {
    confidence: number;
    evidence_count: number;
    missing_fields: string[];
  };
}

interface CapabilityMapProps {
  projectId: string;
  analysisId: string;
}

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return 'High confidence';
  if (confidence >= 0.6) return 'Medium confidence';
  return 'Low confidence';
}

function riskTint(maturity: string): string {
  switch (maturity) {
    case 'advanced':
      return 'border-emerald-500/40 bg-emerald-500/10';
    case 'stable':
      return 'border-green-500/40 bg-green-500/10';
    case 'developing':
      return 'border-yellow-500/40 bg-yellow-500/10';
    case 'nascent':
      return 'border-red-500/40 bg-red-500/10';
    default:
      return 'border-white/10 bg-white/[0.03]';
  }
}

export default function CapabilityMap({ projectId, analysisId }: CapabilityMapProps) {
  const [graph, setGraph] = useState<CapabilityGraph | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<NodeDrilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!analysisId) return;

    async function fetchCapabilities() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/analysis/${projectId}/capabilities?version=${analysisId}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch capability architecture');
        }
        setGraph(data.capability_graph || null);
        setQuality(data.quality_report || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch capabilities');
      } finally {
        setLoading(false);
      }
    }

    fetchCapabilities();
  }, [projectId, analysisId]);

  const groupedByDomain = useMemo(() => {
    if (!graph) return [];
    const domains = graph.nodes.filter(node => node.node_type === 'capability_domain');
    const capabilities = graph.nodes.filter(node => node.node_type === 'capability');
    const edges = graph.edges;

    return domains.map(domain => {
      const capabilityIds = edges
        .filter(edge => edge.from === domain.id && edge.relation === 'contains')
        .map(edge => edge.to);
      return {
        domain,
        capabilities: capabilities.filter(cap => capabilityIds.includes(cap.id)),
      };
    });
  }, [graph]);

  const handleSelectCapability = async (nodeId: string) => {
    if (!analysisId) return;
    setActiveNodeId(nodeId);
    setDrilldownLoading(true);
    try {
      const response = await fetch(
        `/api/analysis/lenses/${analysisId}/node/${nodeId}?depth=2`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch node details');
      }
      setDrilldown(data);
    } catch {
      const fallbackNode = graph?.nodes.find(node => node.id === nodeId);
      if (fallbackNode) {
        setDrilldown({
          node: fallbackNode,
          children: [],
          linked_journeys: [],
          quality: {
            confidence: 0,
            evidence_count: 0,
            missing_fields: ['details_unavailable'],
          },
        });
      }
    } finally {
      setDrilldownLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Loading capability architecture...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!graph) {
    return (
      <div className="text-sm text-gray-400">
        Capability architecture is not available for this analysis version.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Capability Summary</h3>
        <p className="mt-2 text-sm text-gray-300">{graph.top_level_summary}</p>
        {quality && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">
            <span className="rounded-full bg-white/10 px-2 py-1">
              Coverage: {Math.round(quality.coverage_score * 100)}%
            </span>
            <span className="rounded-full bg-white/10 px-2 py-1">
              Evidence density: {Math.round(quality.evidence_density * 100)}%
            </span>
            <span className="rounded-full bg-white/10 px-2 py-1">
              Low confidence: {Math.round(quality.low_confidence_ratio * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-4">
          {groupedByDomain.map(group => (
            <div key={group.domain.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h4 className="text-sm font-semibold text-indigo-300">{group.domain.name}</h4>
              <p className="mt-1 text-xs text-gray-500">{group.domain.description}</p>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {group.capabilities.map(capability => (
                  <button
                    key={capability.id}
                    onClick={() => handleSelectCapability(capability.id)}
                    className={`rounded-lg border p-3 text-left transition-colors ${riskTint(capability.maturity)} ${
                      activeNodeId === capability.id ? 'ring-1 ring-indigo-400/70' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{capability.name}</p>
                    <p className="mt-1 text-xs text-gray-300">{capability.business_value}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                      <span className="rounded-full bg-black/20 px-2 py-0.5">
                        {capability.maturity}
                      </span>
                      <span className="rounded-full bg-black/20 px-2 py-0.5">
                        {confidenceLabel(capability.confidence)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h4 className="text-sm font-semibold text-white">Capability Drill-Down</h4>
          {drilldownLoading ? (
            <p className="mt-2 text-xs text-gray-400">Loading details...</p>
          ) : !drilldown ? (
            <p className="mt-2 text-xs text-gray-400">
              Select a capability card to inspect linked systems and journeys.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-sm font-semibold text-indigo-300">{drilldown.node.name}</p>
                <p className="mt-1 text-xs text-gray-300">{drilldown.node.description}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-400">Linked Systems</p>
                {drilldown.children.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">No downstream components identified.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs text-gray-300">
                    {drilldown.children.map(child => (
                      <li key={child.id} className="rounded bg-white/[0.03] px-2 py-1">
                        {child.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs font-medium text-gray-400">Linked Journeys</p>
                {drilldown.linked_journeys.length === 0 ? (
                  <p className="mt-1 text-xs text-gray-500">No direct journey linkage detected.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs text-gray-300">
                    {drilldown.linked_journeys.map(journey => (
                      <li key={journey.journey_id} className="rounded bg-white/[0.03] px-2 py-1">
                        {journey.journey_name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded border border-white/10 bg-black/20 p-2 text-[11px] text-gray-400">
                Evidence count: {drilldown.quality.evidence_count} · Confidence:{' '}
                {Math.round(drilldown.quality.confidence * 100)}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
