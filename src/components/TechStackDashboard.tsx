'use client';

import { useEffect, useMemo, useState } from 'react';
import { simplifyForFounder } from '@/lib/utils/founder-language';

interface TechItem {
  name: string;
  category: string;
  evidence: string[];
  founder_note: string;
}

interface LanguageSlice {
  language: string;
  file_count: number;
  percentage: number;
}

interface TechStackResponse {
  analysis_id: string;
  languages: LanguageSlice[];
  frameworks: TechItem[];
  infrastructure: TechItem[];
  external_services: TechItem[];
  architecture_pattern: { label: string; explanation: string };
  complexity_score: number;
  complexity_factors: Array<{
    label: string;
    value: number;
    weight: number;
    weighted_score: number;
  }>;
  what_this_means: Array<{
    technology: string;
    explanation: string;
  }>;
}

interface TechStackDashboardProps {
  analysisId: string;
  founderMode?: boolean;
  technologyChoices?: string[];
  scaleAssessment?: string;
  dataUsage?: Array<{
    data_type: string;
    collected_from: string;
    used_for: string;
    stored_in: string;
  }>;
  externalDeps?: Array<{
    name: string;
    why_needed: string;
    what_breaks_without_it: string;
  }>;
}

const LANGUAGE_COLORS = ['#6EA8FE', '#47D7AC', '#F9C74F', '#C084FC', '#FB7185', '#94A3B8'];

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, radius: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', start.x, start.y, 'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(' ');
}

type LayoutMode = 'sparse' | 'balanced' | 'imbalanced';

function getLayoutMode(counts: number[]): LayoutMode {
  const nonZero = counts.filter((count) => count > 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total <= 6) return 'sparse';
  if (nonZero.length <= 1) return 'imbalanced';

  const max = Math.max(...nonZero);
  const min = Math.min(...nonZero);
  if (min === 0) return 'imbalanced';
  return max / min <= 1.8 ? 'balanced' : 'imbalanced';
}

export default function TechStackDashboard({
  analysisId,
  founderMode = false,
  technologyChoices,
  scaleAssessment,
  dataUsage,
  externalDeps,
}: TechStackDashboardProps) {
  const [data, setData] = useState<TechStackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!analysisId) return;

    async function fetchTechStack() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/analysis/${analysisId}/techstack`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Failed to load tech stack dashboard');
        setData(payload);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tech stack dashboard');
      } finally {
        setLoading(false);
      }
    }

    fetchTechStack();
  }, [analysisId]);

  useEffect(() => {
    setExpandedSections({});
  }, [analysisId]);

  const donutStyle = useMemo(() => {
    if (!data || data.languages.length === 0) {
      return { background: 'conic-gradient(#334155 0deg 360deg)' };
    }
    let acc = 0;
    const segments = data.languages.map((slice, index) => {
      const start = acc;
      const end = acc + (slice.percentage / 100) * 360;
      acc = end;
      return `${LANGUAGE_COLORS[index % LANGUAGE_COLORS.length]} ${start}deg ${end}deg`;
    });
    return { background: `conic-gradient(${segments.join(', ')})` };
  }, [data]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading technology dashboard...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>;
  }

  if (!data) {
    return <div className="text-sm text-gray-400">No technology data available.</div>;
  }

  const complexityPercent = Math.max(0, Math.min(100, (data.complexity_score / 10) * 100));
  const gaugeAngle = (complexityPercent / 100) * 360;
  const categories = [
    {
      key: 'frameworks',
      title: 'Frameworks & Tooling',
      items: data.frameworks,
      emptyMessage: 'No major framework signals detected.',
    },
    {
      key: 'infrastructure',
      title: 'Infrastructure',
      items: data.infrastructure,
      emptyMessage: 'No infrastructure signals detected.',
    },
    {
      key: 'external',
      title: 'External Services',
      items: data.external_services,
      emptyMessage: 'No major external services detected.',
    },
  ] as const;
  const layoutMode = getLayoutMode(categories.map(category => category.items.length));
  const dominantCategoryKey = layoutMode === 'imbalanced'
    ? [...categories].sort((a, b) => b.items.length - a.items.length)[0]?.key
    : null;
  const compactLanguagePanel = data.languages.length > 6 || data.languages.some(slice => slice.percentage < 4);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Architecture Pattern</div>
          <div className="mt-2 flex items-center gap-3">
            <span className="rounded-full border border-indigo-400/40 bg-indigo-500/15 px-3 py-1 text-sm font-semibold text-indigo-100">
              {titleCase(data.architecture_pattern.label)}
            </span>
            <p className="text-sm text-gray-300">{simplifyForFounder(data.architecture_pattern.explanation, founderMode)}</p>
          </div>
          {scaleAssessment && (
            <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
              Scale & Reliability: {simplifyForFounder(scaleAssessment, founderMode)}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Complexity Score</div>
          <div className="mt-3 flex items-center gap-4">
            <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
              <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="10" />
              <path
                d={describeArc(55, 55, 42, 0, gaugeAngle)}
                fill="none"
                stroke="rgba(129,140,248,0.95)"
                strokeWidth="10"
                strokeLinecap="round"
              />
              <text x="55" y="53" textAnchor="middle" fill="white" fontSize="20" fontWeight="700">
                {data.complexity_score.toFixed(1)}
              </text>
              <text x="55" y="71" textAnchor="middle" fill="rgba(148,163,184,0.9)" fontSize="10">
                out of 10
              </text>
            </svg>
            <div className="space-y-1 text-xs text-gray-300">
              {data.complexity_factors.slice(0, 4).map(factor => (
                <div key={factor.label} className="flex items-center justify-between gap-3">
                  <span>{factor.label}</span>
                  <span className="text-gray-400">{factor.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,340px)_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Languages</div>
          {!compactLanguagePanel ? (
            <div className="mt-4 flex items-center gap-4">
              <div className="relative h-28 w-28 rounded-full" style={donutStyle}>
                <div className="absolute inset-[18px] rounded-full bg-[#0b1020]" />
              </div>
              <div className="space-y-2 text-xs text-gray-300">
                {data.languages.slice(0, 8).map((slice, index) => (
                  <div key={slice.language} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length] }}
                    />
                    <span>{slice.language}</span>
                    <span className="text-gray-500">{slice.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2 text-xs text-gray-300">
              {data.languages.slice(0, 8).map((slice, index) => (
                <div key={slice.language}>
                  <div className="mb-1 flex items-center justify-between">
                    <span>{slice.language}</span>
                    <span className="text-gray-500">{slice.percentage}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(3, Math.min(100, slice.percentage))}%`,
                        backgroundColor: LANGUAGE_COLORS[index % LANGUAGE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
              {data.languages.length > 8 && (
                <div className="pt-1 text-[11px] text-gray-500">
                  +{data.languages.length - 8} more languages
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-3">
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Stack at a glance</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {categories.map((category) => (
                <span
                  key={`summary-${category.key}`}
                  className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-xs text-gray-200"
                >
                  {category.title} ({category.items.length})
                </span>
              ))}
            </div>
          </div>

          <div
            data-testid="techstack-category-grid"
            data-layout-mode={layoutMode}
            className={`grid items-start gap-4 ${
              layoutMode === 'sparse'
                ? 'md:grid-cols-2'
                : 'md:grid-cols-2 xl:grid-cols-3'
            }`}
          >
            {categories.map((category) => {
              const isDominant = layoutMode === 'imbalanced' && dominantCategoryKey === category.key;
              const defaultLimit = category.key === 'infrastructure' ? 4 : 6;
              const expanded = Boolean(expandedSections[category.key]);
              const visibleItems = expanded ? category.items : category.items.slice(0, defaultLimit);

              return (
                <section
                  key={category.key}
                  className={`self-start rounded-2xl border border-white/10 bg-white/[0.02] p-4 ${
                    isDominant ? 'xl:col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-white">{category.title}</h3>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-gray-400">
                      {category.items.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    {visibleItems.map(item => (
                      <div key={item.name} className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <div className="text-sm text-white">{item.name}</div>
                        <div className="mt-0.5 line-clamp-3 text-xs leading-relaxed text-gray-400">
                          {simplifyForFounder(item.founder_note, founderMode)}
                        </div>
                      </div>
                    ))}
                    {category.items.length === 0 && (
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-gray-400">
                        {category.emptyMessage}
                      </div>
                    )}
                  </div>

                  {category.items.length > defaultLimit && (
                    <button
                      type="button"
                      onClick={() => setExpandedSections((current) => ({
                        ...current,
                        [category.key]: !expanded,
                      }))}
                      className="mt-3 text-xs font-medium text-indigo-300 transition-colors hover:text-indigo-200"
                    >
                      {expanded ? 'Show less' : `Show ${category.items.length - defaultLimit} more`}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-semibold text-white">What This Means (Founder View)</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.what_this_means.slice(0, 12).map(card => (
            <article key={card.technology} className="rounded-lg border border-white/10 bg-black/20 p-3">
              <h4 className="text-sm font-semibold text-indigo-200">{card.technology}</h4>
              <p className="mt-1 text-xs leading-relaxed text-gray-300">
                {simplifyForFounder(card.explanation, founderMode)}
              </p>
            </article>
          ))}
        </div>
      </section>

      {technologyChoices && technologyChoices.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white">Why These Technologies</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {technologyChoices.slice(0, 16).map(choice => (
              <span key={choice} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-gray-200">
                {simplifyForFounder(choice, founderMode)}
              </span>
            ))}
          </div>
        </section>
      )}

      {dataUsage && dataUsage.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white">Data Architecture</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-gray-300">
              <thead className="text-gray-400">
                <tr>
                  <th className="py-2 pr-3">Data Type</th>
                  <th className="py-2 pr-3">Collected From</th>
                  <th className="py-2 pr-3">Used For</th>
                  <th className="py-2">Stored In</th>
                </tr>
              </thead>
              <tbody>
                {dataUsage.slice(0, 12).map((item, index) => (
                  <tr key={`${item.data_type}-${index}`} className="border-t border-white/10 align-top">
                    <td className="py-2 pr-3 text-white">{item.data_type}</td>
                    <td className="py-2 pr-3">{simplifyForFounder(item.collected_from, founderMode)}</td>
                    <td className="py-2 pr-3">{simplifyForFounder(item.used_for, founderMode)}</td>
                    <td className="py-2">{simplifyForFounder(item.stored_in || 'Not specified', founderMode)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {externalDeps && externalDeps.length > 0 && (
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <h3 className="text-sm font-semibold text-white">External Services (Business Impact)</h3>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {externalDeps.slice(0, 8).map(dep => (
              <article key={dep.name} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <h4 className="text-sm font-semibold text-indigo-200">{dep.name}</h4>
                <p className="mt-1 text-xs text-gray-300">
                  Why needed: {simplifyForFounder(dep.why_needed, founderMode)}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Without it: {simplifyForFounder(dep.what_breaks_without_it, founderMode)}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
