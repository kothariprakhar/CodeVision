'use client';

import { useEffect, useMemo, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';

interface RiskItem {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  category: 'security' | 'reliability' | 'delivery' | 'maintainability' | 'operations';
  impact: string;
  why_it_matters: string;
  estimated_effort_days: number;
  remediation_cost_usd: number;
  evidence: string[];
  source: 'static' | 'ai';
}

interface RiskResponse {
  analysis_id: string;
  summary: string;
  totals: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  estimated_remediation_days: number;
  estimated_remediation_cost_usd: number;
  checks_run: string[];
  risks: RiskItem[];
}

interface RiskPanelProps {
  analysisId: string;
  founderMode?: boolean;
  founderRiskRewrites?: Array<{
    original_title: string;
    title: string;
    impact: string;
    why_it_matters: string;
  }>;
}

function severityStyles(severity: RiskItem['severity']): string {
  if (severity === 'critical') return 'border-red-500/45 bg-red-500/10 text-red-200';
  if (severity === 'high') return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
  if (severity === 'medium') return 'border-yellow-500/35 bg-yellow-500/10 text-yellow-100';
  return 'border-blue-500/35 bg-blue-500/10 text-blue-100';
}

export default function RiskPanel({
  analysisId,
  founderMode = false,
  founderRiskRewrites,
}: RiskPanelProps) {
  const [data, setData] = useState<RiskResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!analysisId) return;

    async function fetchRisks() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/analysis/${analysisId}/risks`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to fetch risk data');
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch risk data');
      } finally {
        setLoading(false);
      }
    }

    fetchRisks();
  }, [analysisId]);

  const grouped = useMemo(() => {
    const map: Record<RiskItem['severity'], RiskItem[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    (data?.risks || []).forEach(risk => {
      map[risk.severity].push(risk);
    });
    return map;
  }, [data]);

  const rewriteByOriginalTitle = useMemo(() => {
    const map = new Map<string, {
      title: string;
      impact: string;
      why_it_matters: string;
    }>();
    (founderRiskRewrites || []).forEach(rewrite => {
      map.set(rewrite.original_title, {
        title: rewrite.title,
        impact: rewrite.impact,
        why_it_matters: rewrite.why_it_matters,
      });
    });
    return map;
  }, [founderRiskRewrites]);

  if (loading) return <div className="text-sm text-gray-400">Loading risk assessment...</div>;
  if (error) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>;
  if (!data) return <div className="text-sm text-gray-400">No risk data available.</div>;

  const toggle = (id: string): void => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-lg font-semibold text-white">Risk & Technical Debt Overview</h3>
        <p className="mt-1 text-sm text-gray-300">{simplifyForFounder(data.summary, founderMode)}</p>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-red-300">{data.totals.critical}</div>
            <div className="text-xs uppercase tracking-wide text-red-200/85">Critical</div>
          </div>
          <div className="rounded-lg border border-orange-500/40 bg-orange-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-orange-300">{data.totals.high}</div>
            <div className="text-xs uppercase tracking-wide text-orange-200/85">High</div>
          </div>
          <div className="rounded-lg border border-yellow-500/35 bg-yellow-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-yellow-200">{data.totals.medium}</div>
            <div className="text-xs uppercase tracking-wide text-yellow-100/85">Medium</div>
          </div>
          <div className="rounded-lg border border-blue-500/35 bg-blue-500/10 p-3 text-center">
            <div className="text-2xl font-bold text-blue-200">{data.totals.low}</div>
            <div className="text-xs uppercase tracking-wide text-blue-100/85">Low</div>
          </div>
        </div>

      </div>

      {(['critical', 'high', 'medium', 'low'] as Array<RiskItem['severity']>).map(severity => (
        <section key={severity} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h4 className="text-sm font-semibold uppercase tracking-wide text-white">
            {severity} Priority ({grouped[severity].length})
          </h4>
          <div className="mt-3 space-y-3">
            {grouped[severity].length === 0 && (
              <div className="rounded-lg border border-white/10 bg-black/25 p-3 text-sm text-gray-400">
                No {severity} risks detected.
              </div>
            )}

            {grouped[severity].map(risk => {
              const isExpanded = expanded.has(risk.id);
              const rewrite = founderMode ? rewriteByOriginalTitle.get(risk.title) : undefined;
              const displayTitle = rewrite?.title || risk.title;
              const displayImpact = rewrite?.impact || risk.impact;
              const displayWhyItMatters = rewrite?.why_it_matters || risk.why_it_matters;
              return (
                <article key={risk.id} className={`rounded-xl border p-3 ${severityStyles(risk.severity)}`}>
                  <button className="flex w-full items-start justify-between gap-3 text-left" onClick={() => toggle(risk.id)}>
                    <div>
                      <div className="text-xs uppercase tracking-wide opacity-80">
                        {risk.category} · {risk.source === 'static' ? 'deterministic check' : 'analysis narrative'}
                      </div>
                      <h5 className="mt-1 text-sm font-semibold">{displayTitle}</h5>
                      <p className="mt-1 text-xs opacity-90">{simplifyForFounder(displayImpact, founderMode)}</p>
                    </div>
                    <span className="text-xs opacity-85">{isExpanded ? 'Hide' : 'Details'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 border-t border-white/15 pt-3 text-xs">
                      <p>{simplifyForFounder(displayWhyItMatters, founderMode)}</p>
                      {risk.evidence.length > 0 && (
                        <ul className="list-disc space-y-1 pl-5 opacity-90">
                          {risk.evidence.slice(0, 5).map(item => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
