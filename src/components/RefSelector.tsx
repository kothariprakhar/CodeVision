'use client';

import { useEffect, useState, useMemo } from 'react';

export interface GitRefItem {
  name: string;
  sha: string;
  type: 'branch' | 'pr' | 'commit';
  hasAnalysis: boolean;
  prNumber?: number;
  prTitle?: string;
  prState?: string;
  headBranch?: string;
  message?: string;
  author?: string;
  date?: string;
}

interface GitRefsResponse {
  branches: GitRefItem[];
  pullRequests: GitRefItem[];
  recentCommits: GitRefItem[];
  defaultBranch: string;
}

interface RefSelectorProps {
  projectId: string;
  onSelect: (ref: GitRefItem) => void;
  onAnalyze: (ref: GitRefItem) => void;
  analyzingRef?: string | null;
}

type RefTab = 'branches' | 'prs' | 'commits';

export default function RefSelector({ projectId, onSelect, onAnalyze, analyzingRef }: RefSelectorProps) {
  const [refs, setRefs] = useState<GitRefsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RefTab>('branches');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/github/refs?project_id=${encodeURIComponent(projectId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to fetch refs');
        return res.json() as Promise<GitRefsResponse>;
      })
      .then(setRefs)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const filteredItems = useMemo(() => {
    if (!refs) return [];
    let items: GitRefItem[];
    if (activeTab === 'branches') items = refs.branches;
    else if (activeTab === 'prs') items = refs.pullRequests;
    else items = refs.recentCommits;

    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.message?.toLowerCase().includes(q) ||
      item.prTitle?.toLowerCase().includes(q) ||
      item.author?.toLowerCase().includes(q)
    );
  }, [refs, activeTab, search]);

  const tabs: { key: RefTab; label: string; count: number }[] = [
    { key: 'branches', label: 'Branches', count: refs?.branches.length || 0 },
    { key: 'prs', label: 'PRs', count: refs?.pullRequests.length || 0 },
    { key: 'commits', label: 'Commits', count: refs?.recentCommits.length || 0 },
  ];

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-gray-400">
        Loading branches, PRs, and commits...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-purple-400/50 bg-purple-500/15 text-purple-200'
                : 'border-white/10 bg-white/[0.02] text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder={`Search ${activeTab}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-purple-400/40"
      />

      <div className="max-h-[240px] space-y-1 overflow-y-auto">
        {filteredItems.length === 0 && (
          <div className="py-4 text-center text-xs text-gray-500">No results found</div>
        )}
        {filteredItems.map((item) => {
          const isAnalyzing = analyzingRef === (item.prNumber ? `PR #${item.prNumber}` : item.name);
          return (
            <div
              key={`${item.type}-${item.sha}`}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] p-2.5 transition-colors hover:bg-white/[0.05]"
            >
              <button
                className="flex-1 text-left"
                onClick={() => onSelect(item)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">
                    {item.type === 'pr' ? item.prTitle || item.name : item.name}
                  </span>
                  {item.type === 'pr' && (
                    <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] text-purple-300">
                      #{item.prNumber}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-gray-500">
                  <span>{item.sha.slice(0, 7)}</span>
                  {item.message && <span className="truncate">{item.message}</span>}
                  {item.author && <span>by {item.author}</span>}
                  {item.date && (
                    <span>{new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  )}
                </div>
              </button>

              <div className="ml-2 shrink-0">
                {item.hasAnalysis ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                    Ready
                  </span>
                ) : isAnalyzing ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-300">
                    Analyzing...
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); onAnalyze(item); }}
                    className="rounded-full border border-purple-400/40 bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-medium text-purple-200 transition-colors hover:bg-purple-500/25"
                  >
                    Analyze
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
