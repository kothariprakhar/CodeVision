'use client';

import { useMemo, useState } from 'react';

interface RepoUrlHeroProps {
  onAnalyze: (repoUrl: string) => void;
  ctaLabel?: string;
}

export function isValidGitHubRepoUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const regex = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\.git)?\/?$/;
  return regex.test(trimmed);
}

function DemoAnalysisStrip() {
  return (
    <div className="mx-auto mt-8 w-full max-w-3xl">
      <div className="demo-surface rounded-2xl border border-white/10 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-xs uppercase tracking-[0.14em] text-gray-400">Live Preview</div>
          <div className="rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-200">
            Demo Analysis Ready
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="demo-card rounded-xl border border-indigo-400/20 bg-indigo-500/10 p-3">
            <div className="text-xs text-indigo-200">Architecture</div>
            <div className="mt-2 h-2.5 rounded-full bg-indigo-300/15">
              <div className="h-2.5 w-[72%] rounded-full bg-indigo-300/65 demo-progress" />
            </div>
            <p className="mt-2 text-xs text-gray-300">12 core components mapped</p>
          </div>
          <div className="demo-card rounded-xl border border-teal-400/20 bg-teal-500/10 p-3">
            <div className="text-xs text-teal-200">Business Flows</div>
            <div className="mt-2 h-2.5 rounded-full bg-teal-300/15">
              <div className="h-2.5 w-[64%] rounded-full bg-teal-300/65 demo-progress" />
            </div>
            <p className="mt-2 text-xs text-gray-300">4 user journeys identified</p>
          </div>
          <div className="demo-card rounded-xl border border-amber-400/20 bg-amber-500/10 p-3">
            <div className="text-xs text-amber-200">Risk Scan</div>
            <div className="mt-2 h-2.5 rounded-full bg-amber-300/15">
              <div className="h-2.5 w-[48%] rounded-full bg-amber-300/65 demo-progress" />
            </div>
            <p className="mt-2 text-xs text-gray-300">2 high-priority risks surfaced</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RepoUrlHero({ onAnalyze, ctaLabel = 'Analyze Repository' }: RepoUrlHeroProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState('');

  const isValid = useMemo(() => isValidGitHubRepoUrl(repoUrl), [repoUrl]);

  return (
    <section className="hero-stage relative mx-auto max-w-5xl overflow-hidden rounded-3xl px-4 py-12 text-center md:px-8 md:py-14">
      <div className="hero-orb hero-orb-left" aria-hidden />
      <div className="hero-orb hero-orb-right" aria-hidden />
      <h1 className="hero-title text-5xl font-semibold tracking-tight text-white md:text-6xl">
        See What a Repository Really Does
      </h1>
      <p className="hero-subtitle mx-auto mt-4 max-w-2xl text-lg text-gray-300">
        Paste a GitHub repository link and get architecture, business flows, risks, and strategy insights in plain language.
      </p>

      <form
        className="mx-auto mt-8 w-full max-w-3xl"
        onSubmit={event => {
          event.preventDefault();
          if (!isValid) {
            setError('Please enter a valid GitHub repository URL.');
            return;
          }
          setError('');
          onAnalyze(repoUrl.trim());
        }}
      >
        <div className="repo-url-glow rounded-2xl p-[1.5px]">
          <div className="repo-url-shell flex flex-col gap-3 rounded-2xl border border-white/10 bg-[#0b1020]/85 p-3 md:flex-row">
            <input
              aria-label="GitHub repository URL"
              value={repoUrl}
              onChange={event => {
                setRepoUrl(event.target.value);
                if (error) setError('');
              }}
              placeholder="Paste a GitHub repo URL"
              className="w-full rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white placeholder:text-gray-500 transition-colors duration-200 focus:border-indigo-400/60 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!isValid}
              className="rounded-xl border border-indigo-400/45 bg-indigo-500/20 px-5 py-3 text-sm font-semibold text-indigo-100 transition-all duration-200 hover:-translate-y-0.5 hover:bg-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
            >
              {ctaLabel}
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-left text-xs text-red-300">{error}</p>}
      </form>

      <div className="hero-demo-entry">
        <DemoAnalysisStrip />
      </div>

      <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs uppercase tracking-[0.16em] text-gray-300">
        Analyzed 10,000+ repositories
      </div>
    </section>
  );
}
