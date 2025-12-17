'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';
import { LogoMark } from '@/components/Logo';

interface Project {
  id: string;
  name: string;
  description: string | null;
  github_url: string;
  status: string;
  created_at: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchProjects();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(projects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'status-completed';
      case 'analyzing':
        return 'status-analyzing';
      case 'failed':
        return 'status-failed';
      default:
        return 'status-pending';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Landing page for logged out users
  if (!user) {
    return (
      <div>
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="inline-block animate-float mb-6">
            <LogoMark className="w-24 h-24 mx-auto" />
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Understand Any Codebase</span>
            <br />
            <span className="text-white">in Minutes, Not Weeks</span>
          </h1>
          <p className="text-2xl text-gray-300 max-w-3xl mx-auto mb-4 leading-relaxed">
            AI-powered analysis for requirements validation and instant architecture understanding
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            Whether it's AI-generated, outsourced, or inherited—master unfamiliar codebases fast
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="btn-primary inline-flex items-center gap-2 text-white px-10 py-5 rounded-xl text-xl font-semibold shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
            >
              Start Analyzing
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white px-10 py-5 rounded-xl text-xl font-medium transition-colors border border-white/10 hover:border-white/20"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Two Products Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Two Tools, One Goal</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Deep analysis for quality audits, live exploration for daily development
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Website Analysis */}
            <div className="glass-strong rounded-3xl p-8 border border-purple-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Analysis Platform</h3>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-green-500/20 text-green-300 text-xs font-medium">Available Now</span>
                </div>
              </div>
              <p className="text-gray-400 mb-6">
                Upload requirements and connect your GitHub repo. AI analyzes code quality, identifies gaps, and generates interactive architecture visualizations.
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Requirements vs implementation analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">AI-powered architecture visualization</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Interactive chat with your analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Detailed reports with prioritized findings</span>
                </li>
              </ul>
            </div>

            {/* Chrome Plugin */}
            <div className="glass-strong rounded-3xl p-8 border border-indigo-500/20">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 3c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Chrome Extension</h3>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-medium">Coming Soon</span>
                </div>
              </div>
              <p className="text-gray-400 mb-6">
                Right-click any UI element in your running app to instantly see its complete technical stack—from frontend to database.
              </p>
              <ul className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Inspect any element like DevTools</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">See full data flow (UI → API → Database)</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">Multi-repo support for microservices</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-gray-300">AI assistant in side panel</span>
                </li>
              </ul>
            </div>
          </div>
        </div>


        {/* Key Use Cases */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center text-white mb-4">
            Built for Modern Development Challenges
          </h2>
          <p className="text-center text-gray-400 max-w-2xl mx-auto mb-12">
            Whether you're inheriting code, auditing contractors, or onboarding new developers
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            {/* AI-Generated Code */}
            <div className="glass rounded-2xl p-8 hover-lift">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">AI-Generated Codebases</h3>
              <p className="text-gray-400 mb-4">
                Cursor, v0, and Bolt generated your app—now understand what they built. See architecture, trace data flows, verify quality.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Verify AI implementation matches requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Understand generated architecture instantly</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Audit quality before deployment</span>
                </li>
              </ul>
            </div>

            {/* Developer Onboarding */}
            <div className="glass rounded-2xl p-8 hover-lift">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Developer Onboarding</h3>
              <p className="text-gray-400 mb-4">
                New team members go from confused to productive in days instead of weeks. Explore architecture visually, ask AI questions, learn by clicking.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Visual exploration of codebase structure</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>AI assistant answers architecture questions</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Reduce ramp-up time by 70%</span>
                </li>
              </ul>
            </div>

            {/* Inherited/Outsourced Code */}
            <div className="glass rounded-2xl p-8 hover-lift">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">Inherited & Outsourced Code</h3>
              <p className="text-gray-400 mb-4">
                Contractors left. Acquired a company. Previous team moved on. Understand what you inherited before it becomes your problem.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Rapid technical due diligence</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Identify technical debt and risks</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Get maintainable documentation instantly</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="glass-strong rounded-3xl p-12 text-center border border-purple-500/20">
          <h2 className="text-4xl font-bold text-white mb-4">
            Stop Reading Code. Start Understanding It.
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Whether it's AI-generated, outsourced, or inherited—get instant clarity on any codebase
          </p>
          <Link
            href="/signup"
            className="btn-primary inline-flex items-center gap-3 text-white px-12 py-5 rounded-xl text-xl font-semibold shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
          >
            Start Your First Analysis
          </Link>
          <p className="text-sm text-gray-500 mt-4">
            Analysis platform available now • Chrome extension coming soon
          </p>
        </div>
      </div>
    );
  }

  // Dashboard for logged in users
  return (
    <div>
      {/* Simplified Header for logged-in users */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          <span className="text-white">Your Projects</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-6">
          Analyze codebases and explore architecture with AI-powered insights
        </p>
        <Link
          href="/projects/new"
          className="btn-primary inline-flex items-center gap-2 text-white px-8 py-4 rounded-xl text-lg font-semibold shadow-xl shadow-purple-500/20 hover:shadow-purple-500/40 transition-all"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start New Analysis
        </Link>
      </div>

      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Your Projects</h2>
          <span className="text-gray-400">{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
        </div>

        {projects.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gray-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <p className="text-gray-400 mb-6">No projects yet. Create your first project to get started.</p>
            <Link
              href="/projects/new"
              className="text-purple-400 hover:text-purple-300 font-medium transition-colors"
            >
              Create your first project →
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <div
                key={project.id}
                className="glass rounded-2xl p-6 hover-lift group"
              >
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {project.name}
                  </h3>
                  <span className={`status-badge ${getStatusClass(project.status)}`}>
                    {project.status}
                  </span>
                </div>
                {project.description && (
                  <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <p className="text-gray-500 text-xs truncate flex-1">
                    {project.github_url}
                  </p>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                  <Link
                    href={`/projects/${project.id}`}
                    className="text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                  >
                    View Details →
                  </Link>
                  <button
                    onClick={() => deleteProject(project.id)}
                    className="text-gray-500 hover:text-red-400 text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
