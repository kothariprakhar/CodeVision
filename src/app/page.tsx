'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/hooks/useAuth';

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
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
              <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
          </div>
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
            <span className="gradient-text">Chrome DevTools</span>
            <br />
            <span className="text-white">for Understanding Code</span>
          </h1>
          <p className="text-2xl text-gray-300 max-w-3xl mx-auto mb-4 leading-relaxed">
            Right-click any UI element to see its complete technical stack
          </p>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10">
            From button clicks to database queries—trace the entire data flow instantly
          </p>
          <div className="flex items-center justify-center gap-4 mb-12">
            <Link
              href="/signup"
              className="btn-primary inline-flex items-center gap-2 text-white px-10 py-5 rounded-xl text-xl font-semibold shadow-xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Get Early Access
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-gray-300 hover:text-white px-10 py-5 rounded-xl text-xl font-medium transition-colors border border-white/10 hover:border-white/20"
            >
              Sign In
            </Link>
          </div>

          {/* Chrome Extension Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-purple-500/30 text-sm text-gray-300">
            <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 2c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 17.52 2 12 6.48 2 12 2zm0 3c-3.87 0-7 3.13-7 7s3.13 7 7 7 7-3.13 7-7-3.13-7-7-7zm0 2c2.76 0 5 2.24 5 5s-2.24 5-5 5-5-2.24-5-5 2.24-5 5-5z"/>
            </svg>
            <span>Chrome Extension</span>
            <span className="text-purple-400">•</span>
            <span>Coming Soon</span>
          </div>
        </div>

        {/* Inspect Element Demo Visual */}
        <div className="mb-20 glass-strong rounded-3xl p-8 border border-purple-500/20">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-medium mb-4">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></span>
                HOW IT WORKS
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Inspect Element, Meet Inspect Stack
              </h2>
              <p className="text-gray-400 mb-6 leading-relaxed">
                Just like Chrome DevTools reveals HTML and CSS, Code Vision reveals the complete technical architecture behind every UI element.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-purple-400 font-bold">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Right-click any element</h4>
                    <p className="text-gray-400 text-sm">Button, form, table—anything on the page</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-indigo-400 font-bold">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">See the complete flow</h4>
                    <p className="text-gray-400 text-sm">UI → API → Controller → Database</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-1">
                    <span className="text-blue-400 font-bold">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Jump to code instantly</h4>
                    <p className="text-gray-400 text-sm">Click any layer to open in your editor</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              {/* Visual representation of the flow */}
              <div className="space-y-3">
                <div className="glass rounded-xl p-4 border-l-4 border-purple-500">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <span className="text-white font-medium text-sm">UI Component</span>
                  </div>
                  <code className="text-purple-300 text-xs">{"<Button onClick={handleSubmit}>"}</code>
                </div>
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="glass rounded-xl p-4 border-l-4 border-indigo-500">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="text-white font-medium text-sm">API Route</span>
                  </div>
                  <code className="text-indigo-300 text-xs">POST /api/users/create</code>
                </div>
                <div className="flex justify-center">
                  <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
                <div className="glass rounded-xl p-4 border-l-4 border-blue-500">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    <span className="text-white font-medium text-sm">Database</span>
                  </div>
                  <code className="text-blue-300 text-xs">INSERT INTO users (name, email)</code>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Three Audience Sections */}
        <div className="mb-20">
          <h2 className="text-4xl font-bold text-center text-white mb-12">
            Built for Everyone in the Software Lifecycle
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {/* Developers */}
            <div className="glass rounded-2xl p-8 hover-lift">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">For Developers</h3>
              <p className="text-gray-400 mb-4">
                Onboard to unfamiliar codebases 10x faster. Understand legacy systems without reading thousands of lines of code.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Trace data flow from UI to database</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Find API endpoints instantly</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Debug production issues faster</span>
                </li>
              </ul>
            </div>

            {/* Founders/PMs */}
            <div className="glass rounded-2xl p-8 hover-lift">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">For Founders & PMs</h3>
              <p className="text-gray-400 mb-4">
                Verify contractors deliver what they promised. Audit code quality before acquisition. Make technical decisions with confidence.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Verify requirements vs implementation</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Assess technical debt before buying</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Get non-technical clarity on code</span>
                </li>
              </ul>
            </div>

            {/* Investors */}
            <div className="glass rounded-2xl p-8 hover-lift">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-3">For Investors</h3>
              <p className="text-gray-400 mb-4">
                Conduct technical due diligence in hours, not weeks. Understand architecture risks before investment decisions.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>AI-powered technical due diligence</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Identify scalability bottlenecks</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Assess engineering team capabilities</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Current Features */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Available Today</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Start analyzing your codebase now with our AI-powered analysis platform
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="glass rounded-2xl p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2 text-center">Requirements Analysis</h3>
              <p className="text-gray-400 text-sm text-center">Upload specs, PRDs, or design docs—we compare them against your actual code</p>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2 text-center">AI-Powered Insights</h3>
              <p className="text-gray-400 text-sm text-center">Claude AI analyzes architecture, identifies gaps, and suggests improvements</p>
            </div>
            <div className="glass rounded-2xl p-6">
              <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2 text-center">Interactive Reports</h3>
              <p className="text-gray-400 text-sm text-center">Explore findings, chat with AI, visualize architecture—all in one dashboard</p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="glass-strong rounded-3xl p-12 text-center border border-purple-500/20">
          <h2 className="text-4xl font-bold text-white mb-4">
            Be First to Try the Chrome Extension
          </h2>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            Join our early access program and get the Chrome DevTools experience for understanding any codebase
          </p>
          <Link
            href="/signup"
            className="btn-primary inline-flex items-center gap-3 text-white px-12 py-5 rounded-xl text-xl font-semibold shadow-2xl shadow-purple-500/30 hover:shadow-purple-500/50 transition-all"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Get Early Access
          </Link>
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
