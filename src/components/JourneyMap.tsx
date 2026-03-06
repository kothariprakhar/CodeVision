'use client';

import { useEffect, useState } from 'react';
import type { JourneyGraph, QualityReport } from '@/lib/db';

interface JourneyMapProps {
  projectId: string;
  analysisId: string;
}

function riskPill(risk: string): string {
  switch (risk) {
    case 'critical':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'high':
      return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
    default:
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
  }
}

export default function JourneyMap({ projectId, analysisId }: JourneyMapProps) {
  const [journeyGraph, setJourneyGraph] = useState<JourneyGraph | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);

  useEffect(() => {
    if (!analysisId) return;

    async function fetchJourneys() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/analysis/${projectId}/journeys?version=${analysisId}`
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch user journeys');
        }
        setJourneyGraph(data.journey_graph || null);
        setQuality(data.quality_report || null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch journeys');
      } finally {
        setLoading(false);
      }
    }

    fetchJourneys();
  }, [projectId, analysisId]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading journey architecture...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (!journeyGraph || journeyGraph.journeys.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        No user journeys were detected for this analysis version.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <h3 className="text-sm font-semibold text-white">Journey Summary</h3>
        <p className="mt-2 text-sm text-gray-300">{journeyGraph.summary}</p>
        {quality && quality.missing_signals.length > 0 && (
          <p className="mt-2 text-xs text-yellow-300">
            Missing signals: {quality.missing_signals.join(', ')}
          </p>
        )}
      </div>

      <div className="space-y-4">
        {journeyGraph.journeys.map(journey => (
          <div key={journey.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-semibold text-indigo-300">{journey.name}</h4>
                <p className="text-xs text-gray-500">
                  Persona: {journey.persona} · KPI: {journey.kpi}
                </p>
              </div>
              <span className="rounded-full bg-indigo-500/15 px-2 py-1 text-xs text-indigo-200">
                {journey.steps.length} steps
              </span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {journey.steps.map(step => (
                <button
                  key={step.id}
                  onClick={() => setExpandedStepId(expandedStepId === step.id ? null : step.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    expandedStepId === step.id
                      ? 'border-indigo-400/70 bg-indigo-500/10'
                      : 'border-white/10 bg-black/20 hover:border-indigo-400/40'
                  }`}
                >
                  <p className="text-xs text-gray-500">Step {step.order}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{step.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-gray-300">{step.business_outcome}</p>
                  <span
                    className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[11px] ${riskPill(step.friction_risk)}`}
                  >
                    {step.friction_risk} friction
                  </span>
                </button>
              ))}
            </div>

            {expandedStepId && (
              <div className="mt-3 rounded-lg border border-white/10 bg-black/20 p-3">
                {journey.steps
                  .filter(step => step.id === expandedStepId)
                  .map(step => (
                    <div key={step.id}>
                      <p className="text-sm font-semibold text-white">{step.name}</p>
                      <p className="mt-1 text-xs text-gray-300">{step.description}</p>
                      <div className="mt-2">
                        <p className="text-xs font-medium text-gray-400">Systems touched</p>
                        {step.systems_touched.length === 0 ? (
                          <p className="mt-1 text-xs text-gray-500">No linked systems detected.</p>
                        ) : (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {step.systems_touched.map(system => (
                              <span
                                key={`${step.id}-${system}`}
                                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-gray-300"
                              >
                                {system}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
