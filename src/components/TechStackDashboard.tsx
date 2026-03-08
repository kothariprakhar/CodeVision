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

export default function TechStackDashboard({ analysisId, founderMode = false }: TechStackDashboardProps) {
  const [data, setData] = useState<TechStackResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
          <div className="text-xs uppercase tracking-wide text-gray-400">Languages</div>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-28 w-28 rounded-full" style={donutStyle}>
              <div className="absolute inset-[18px] rounded-full bg-[#0b1020]" />
            </div>
            <div className="space-y-2 text-xs text-gray-300">
              {data.languages.map((slice, index) => (
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
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white">Frameworks & Tooling</h3>
            <div className="mt-3 space-y-2">
              {data.frameworks.slice(0, 8).map(item => (
                <div key={item.name} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-sm text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">{simplifyForFounder(item.founder_note, founderMode)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white">Infrastructure</h3>
            <div className="mt-3 space-y-2">
              {data.infrastructure.slice(0, 8).map(item => (
                <div key={item.name} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-sm text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">{simplifyForFounder(item.founder_note, founderMode)}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <h3 className="text-sm font-semibold text-white">External Services</h3>
            <div className="mt-3 space-y-2">
              {data.external_services.slice(0, 8).map(item => (
                <div key={item.name} className="rounded-lg border border-white/10 bg-black/20 p-2">
                  <div className="text-sm text-white">{item.name}</div>
                  <div className="text-xs text-gray-400">{simplifyForFounder(item.founder_note, founderMode)}</div>
                </div>
              ))}
              {data.external_services.length === 0 && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-gray-400">
                  No major external services detected.
                </div>
              )}
            </div>
          </section>
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
    </div>
  );
}
