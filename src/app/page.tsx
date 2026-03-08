'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import RepoUrlHero from '@/components/RepoUrlHero';
import { useAuth } from '@/lib/hooks/useAuth';

interface Project {
  id: string;
  name: string;
  description: string | null;
  github_url: string;
  status: string;
  created_at: string;
}

function getStatusClass(status: string): string {
  if (status === 'completed') return 'status-completed';
  if (status === 'analyzing') return 'status-analyzing';
  if (status === 'failed') return 'status-failed';
  return 'status-pending';
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoadingProjects(false);
      return;
    }

    async function fetchProjects() {
      try {
        const response = await fetch('/api/projects');
        if (!response.ok) return;
        const data = await response.json();
        setProjects(data);
      } catch {
        // Ignore and keep fallback UI.
      } finally {
        setLoadingProjects(false);
      }
    }

    fetchProjects();
  }, [user]);

  const deleteProject = async (id: string): Promise<void> => {
    if (!confirm('Delete this project?')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(prev => prev.filter(project => project.id !== id));
    } catch {
      // Ignore for now.
    }
  };

  if (authLoading || loadingProjects) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-indigo-400" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-14 pb-8">
        <RepoUrlHero
          ctaLabel="Analyze Repository"
          onAnalyze={repoUrl => {
            const encoded = encodeURIComponent(repoUrl);
            window.location.href = `/signup?repo_url=${encoded}`;
          }}
        />

        <section className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          <article className="glass-refined rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white">Architecture Maps</h3>
            <p className="mt-2 text-sm text-gray-300">
              Understand key components and dependencies without digging through source files.
            </p>
          </article>
          <article className="glass-refined rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white">Business Flow Views</h3>
            <p className="mt-2 text-sm text-gray-300">
              Follow real user journeys from action to outcome and see where friction appears.
            </p>
          </article>
          <article className="glass-refined rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white">Risk Intelligence</h3>
            <p className="mt-2 text-sm text-gray-300">
              Surface delivery and reliability risks with estimated remediation effort and cost.
            </p>
          </article>
        </section>

        <div className="text-center">
          <Link
            href="/login"
            className="rounded-xl border border-white/20 bg-white/[0.02] px-5 py-3 text-sm font-medium text-gray-200 transition-colors hover:bg-white/[0.08]"
          >
            Sign in to continue
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="glass-refined rounded-2xl p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-white">Your Analyses</h1>
            <p className="mt-2 text-sm text-gray-300">
              Track repositories, rerun analyses, and review architecture and business insights.
            </p>
          </div>
          <Link
            href="/projects/new"
            className="inline-flex items-center justify-center rounded-xl border border-indigo-400/45 bg-indigo-500/20 px-5 py-3 text-sm font-semibold text-indigo-100 transition-colors hover:bg-indigo-500/30"
          >
            Start New Analysis
          </Link>
        </div>
      </section>

      {projects.length === 0 ? (
        <section className="glass-refined rounded-2xl p-12 text-center">
          <p className="text-gray-300">No projects yet. Start your first analysis to populate this dashboard.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map(project => (
            <article key={project.id} className="glass-refined rounded-2xl p-5">
              <div className="mb-3 flex items-start justify-between gap-2">
                <h3 className="text-base font-semibold text-white">{project.name}</h3>
                <span className={`status-badge ${getStatusClass(project.status)}`}>{project.status}</span>
              </div>
              {project.description && <p className="mb-3 text-sm text-gray-300">{project.description}</p>}
              <p className="mb-4 truncate text-xs text-gray-500">{project.github_url}</p>
              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                <Link href={`/projects/${project.id}`} className="text-sm font-medium text-indigo-300 hover:text-indigo-200">
                  Open Analysis
                </Link>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="text-xs text-gray-400 transition-colors hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
