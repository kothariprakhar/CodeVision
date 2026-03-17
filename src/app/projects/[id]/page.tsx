'use client';
// ABOUTME: Project detail page showing architecture diagram, issues, and analysis controls.
// ABOUTME: Allows uploading requirement documents and running analysis on a GitHub repository.

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Tabs from '@/components/Tabs';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import AnalysisVersionSelector from '@/components/AnalysisVersionSelector';
import FeedbackPrompt from '@/components/FeedbackPrompt';
import FeedbackPanel from '@/components/FeedbackPanel';
import TechStackDashboard from '@/components/TechStackDashboard';
import ChatPanel from '@/components/ChatPanel';
import RiskPanel from '@/components/RiskPanel';
import VersionDiffView from '@/components/VersionDiffView';
import ModulesView from '@/components/ModulesView';
import UserFlowView from '@/components/UserFlowView';
import { useAuth } from '@/lib/hooks/useAuth';
import type { ArchitectureVisualization, BusinessContext } from '@/lib/db';

interface Project {
  id: string;
  name: string;
  description: string | null;
  github_url: string;
  status: string;
  created_at: string;
}

interface Document {
  id: string;
  filename: string;
  file_type: string;
  uploaded_at: string;
}

interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

interface Analysis {
  id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  founder_content?: {
    node_descriptions?: Record<string, string>;
    journey_rewrites?: Record<string, {
      name: string;
      goal: string;
      step_descriptions: Record<string, string>;
    }>;
    risk_rewrites?: Array<{
      original_title: string;
      title: string;
      impact: string;
      why_it_matters: string;
    }>;
  } | null;
  repo_metadata?: {
    stars?: number;
    primary_language?: string | null;
    contributors_count?: number;
  } | null;
  business_context?: BusinessContext | null;
  analyzed_at: string;
}

interface AnalysisVersion {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
  branch?: string | null;
  commit_hash?: string | null;
  commit_url?: string | null;
  summary?: string | null;
}

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const { user, loading: authLoading } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [versions, setVersions] = useState<AnalysisVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState<{ stage: string; progress: number; message: string } | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('architecture');
  const [highlightedModuleId, setHighlightedModuleId] = useState<string | null>(null);
  const [isFeedbackPanelOpen, setIsFeedbackPanelOpen] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hasShownPrompt, setHasShownPrompt] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'slides' | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const founderMode = true;

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Project not found');
      const data = await response.json();
      setProject(data);
    } catch {
      setError('Failed to load project');
    }
  }, [projectId]);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/documents?project_id=${projectId}`);
      const data = await response.json();
      setDocuments(data);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, [projectId]);

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/analysis/versions/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
        if (data.versions?.length > 0) {
          setSelectedVersion(data.versions[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, [projectId]);

  const fetchAnalysis = useCallback(async (versionId?: string) => {
    try {
      const url = versionId
        ? `/api/analysis/${projectId}?version=${versionId}`
        : `/api/analysis/${projectId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([fetchProject(), fetchDocuments(), fetchVersions()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProject, fetchDocuments, fetchVersions]);

  useEffect(() => {
    if (selectedVersion) {
      fetchAnalysis(selectedVersion);
    }
  }, [selectedVersion, fetchAnalysis]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Poll for analysis completion when project is analyzing
  useEffect(() => {
    if (activeJobId) {
      return;
    }
    if (!project || project.status !== 'analyzing') {
      setAnalyzing(false);
      return;
    }

    // Set analyzing state to show UI feedback
    setAnalyzing(true);

    // Poll every 3 seconds to check if analysis is complete
    const pollInterval = setInterval(async () => {
      await fetchProject();
      await fetchVersions();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [project, fetchProject, fetchVersions, activeJobId]);

  // Show feedback prompt 12 seconds after first analysis completes
  useEffect(() => {
    if (!analysis || hasShownPrompt) return;

    const timer = setTimeout(() => {
      setShowFeedbackPrompt(true);
      setHasShownPrompt(true);
    }, 12000);

    return () => clearTimeout(timer);
  }, [analysis, hasShownPrompt]);

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, []);

  useEffect(() => {
    setExportMenuOpen(false);
  }, [activeTab, selectedVersion]);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [exportMenuOpen]);

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError('');

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('file', file);

        const response = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Upload failed');
        }
      }

      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const deleteDocument = async (docId: string) => {
    try {
      await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      setDocuments(documents.filter(d => d.id !== docId));
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };

  const runAnalysis = async () => {
    setAnalyzing(true);
    setError('');
    setAnalysisProgress(null);

    try {
      const response = await fetch('/api/repo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      const jobId = data.job_id as string;
      setActiveJobId(jobId);
      setAnalysisProgress({
        stage: data.stage || 'queued',
        progress: typeof data.progress === 'number' ? data.progress : 0,
        message: data.message || 'Queued for analysis',
      });

      eventSourceRef.current?.close();
      const eventSource = new EventSource(`/api/repo/${jobId}/events`);
      eventSourceRef.current = eventSource;
      eventSource.onmessage = async (event) => {
        try {
          const payload = JSON.parse(event.data);
          setAnalysisProgress({
            stage: payload.stage || 'queued',
            progress: typeof payload.progress === 'number' ? payload.progress : 0,
            message: payload.message || 'Analyzing...',
          });

          if (payload.status === 'completed') {
            eventSource.close();
            eventSourceRef.current = null;
            setAnalyzing(false);
            setActiveJobId(null);
            if (payload.analysis_id) {
              setSelectedVersion(payload.analysis_id);
            }
            await fetchProject();
            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchVersions();
          }

          if (payload.status === 'failed' || payload.stage === 'failed') {
            eventSource.close();
            eventSourceRef.current = null;
            setAnalyzing(false);
            setActiveJobId(null);
            setError(payload.error || payload.message || 'Analysis failed');
            await fetchProject();
          }
        } catch {
          // Ignore malformed events.
        }
      };
      eventSource.onerror = async () => {
        eventSource.close();
        eventSourceRef.current = null;
        try {
          const statusRes = await fetch(`/api/repo/${jobId}/status`);
          const statusData = await statusRes.json();
          setAnalysisProgress({
            stage: statusData.stage || 'queued',
            progress: typeof statusData.progress === 'number' ? statusData.progress : 0,
            message: statusData.message || 'Analyzing...',
          });
          if (statusData.status === 'completed') {
            setAnalyzing(false);
            setActiveJobId(null);
            await fetchProject();
            await fetchVersions();
            if (statusData.analysis_id) setSelectedVersion(statusData.analysis_id);
            return;
          }
          if (statusData.status === 'failed') {
            setAnalyzing(false);
            setActiveJobId(null);
            setError(statusData.error || statusData.message || 'Analysis failed');
            await fetchProject();
          }
        } catch {
          setAnalyzing(false);
          setActiveJobId(null);
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      await fetchProject();
      setActiveJobId(null);
      setAnalysisProgress(null);
      setAnalyzing(false);
    }
  };

  const exportAnalysis = async (format: 'pdf' | 'slides') => {
    if (!selectedVersion || exporting) return;
    setExporting(format);
    try {
      const response = await fetch(`/api/export/${selectedVersion}/${format}`, {
        method: 'POST',
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Failed to export ${format}`);
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = format === 'pdf'
        ? `${project?.name || 'analysis'}-report.pdf`
        : `${project?.name || 'analysis'}-slides.md`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to export ${format}`);
    } finally {
      setExporting(null);
    }
  };

  const analysisButtonText = (() => {
    if (!analyzing) return 'Run Analysis';
    if (analysisProgress) return `${analysisProgress.progress}% · ${analysisProgress.message}`;
    if (activeJobId) return 'Starting analysis...';
    return 'Analyzing...';
  })();

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'markdown': return '📝';
      case 'text': return '📃';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  const getLastAnalyzedText = () => {
    if (versions.length === 0) return null;
    const latest = versions[0];
    const date = new Date(latest.analyzed_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Last analysed today';
    if (diffDays === 1) return 'Last analysed yesterday';
    return `Last analysed ${diffDays} days ago`;
  };

  const analysisDateText = analysis?.analyzed_at
    ? new Date(analysis.analyzed_at).toLocaleString()
    : 'No analysis yet';
  const repoStars = analysis?.repo_metadata?.stars;
  const repoContributors = analysis?.repo_metadata?.contributors_count;
  const activeNarrative = founderMode
    ? analysis?.business_context?.founder_narrative
    : analysis?.business_context?.technical_narrative;

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading project...</div>;
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-400">Project not found</div>;
  }

  const tabs = [
    { id: 'architecture', label: 'Architecture Map' },
    { id: 'modules', label: 'Modules' },
    { id: 'user-flow', label: 'User Flow' },
    { id: 'techstack', label: 'Tech Stack' },
    { id: 'version-diff', label: 'Version Diff' },
    { id: 'risks', label: 'Risks' },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
          ← Back to Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="glass-refined rounded-2xl p-6 mb-6 transition-all duration-300">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{project.name}</h1>
            {project.description && (
              <p className="text-gray-400 mt-2 leading-relaxed">{project.description}</p>
            )}
            <div className="flex items-center gap-2 mt-3 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              <span className="truncate max-w-md">{project.github_url}</span>
            </div>
            {(activeNarrative?.executive_summary || analysis?.summary) && (
              <p className="mt-3 max-w-3xl text-sm leading-relaxed text-gray-300">
                {activeNarrative?.executive_summary || analysis?.summary}
              </p>
            )}
            {activeNarrative?.how_it_works && (
              <details className="mt-3 max-w-3xl rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-gray-300">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-400">
                  How It Works
                </summary>
                <p className="mt-2 leading-relaxed">{activeNarrative.how_it_works}</p>
              </details>
            )}
          </div>
          {getLastAnalyzedText() && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-full whitespace-nowrap">
                {getLastAnalyzedText()}
              </span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 animate-fade-in">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit lg:sticky lg:top-24">
          <div className="glass-refined rounded-2xl p-5 space-y-4 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">Repository</div>
              <div className="mt-1 text-sm font-semibold text-white">{project.name}</div>
              <div className="mt-1 text-xs text-gray-400 truncate">{project.github_url}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                <div className="text-gray-500">Stars</div>
                <div className="mt-1 text-white font-semibold">{typeof repoStars === 'number' ? repoStars.toLocaleString() : 'N/A'}</div>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/20 p-2 col-span-2">
                <div className="text-gray-500">Analysis Date</div>
                <div className="mt-1 text-white font-semibold">{analysisDateText}</div>
              </div>
              {typeof repoContributors === 'number' && (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2 col-span-2">
                  <div className="text-gray-500">Contributors</div>
                  <div className="mt-1 text-white font-semibold">{repoContributors}</div>
                </div>
              )}
            </div>

            <div className="border-t border-white/10 pt-4">
              <div className="mb-3 text-sm font-semibold text-white">
                📎 Documents ({documents.length})
              </div>
              <div className="mb-3">
                <label className="block">
                  <div className="relative group">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp"
                      onChange={handleFileUpload}
                      disabled={uploading}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed z-10"
                    />
                    <div className="rounded-xl border border-dashed border-white/10 p-3 text-center transition-all duration-300 group-hover:border-purple-500/40 group-hover:bg-purple-500/5">
                      <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/10">
                        <svg className="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>
                      <p className="text-xs font-medium text-gray-300">
                        {uploading ? 'Uploading...' : 'Upload docs'}
                      </p>
                    </div>
                  </div>
                </label>
              </div>

              {documents.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-black/20 p-2 text-xs text-gray-500">
                  No documents uploaded yet.
                </div>
              ) : (
                <ul className="mb-3 space-y-2">
                  {documents.map(doc => (
                    <li key={doc.id} className="group flex items-center justify-between rounded-lg bg-white/[0.02] p-2 transition-all duration-200 hover:bg-white/[0.05]">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-500/10 to-indigo-500/10 text-xs">
                          {getFileIcon(doc.file_type)}
                        </div>
                        <span className="max-w-[150px] truncate text-xs text-gray-300">{doc.filename}</span>
                      </div>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] text-red-400 opacity-0 transition-all duration-200 hover:text-red-300 group-hover:opacity-100"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <button
                onClick={runAnalysis}
                disabled={analyzing || documents.length === 0}
                className="btn-primary-refined flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-white"
              >
                {analyzing ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {analysisButtonText}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {analysisButtonText}
                  </>
                )}
              </button>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
      <div className="glass-refined rounded-2xl mb-6 overflow-hidden">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

	        <div key={activeTab} className="p-6 tab-fade-stage">
          {activeTab === 'architecture' && (
            <>
	              {versions.length > 0 && (
                  <div className="mb-6">
	                  <AnalysisVersionSelector
	                    versions={versions}
	                    selectedVersion={selectedVersion}
	                    onChange={handleVersionChange}
	                  />
                  </div>
	                )}

              {/* Architecture Diagram */}
	              {analysis?.architecture ? (
	                <ArchitectureDiagram
	                  architecture={analysis.architecture}
	                  highlightedNodeId={highlightedModuleId}
                    founderMode={founderMode}
                    founderDescriptions={analysis.founder_content?.node_descriptions}
                    architectureDomains={analysis.business_context?.architecture_domains}
	                />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-400">
                    {project.status === 'analyzing'
                      ? 'Analysis in progress...'
                      : 'No analysis yet'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {project.status !== 'analyzing' && 'Upload documents and run analysis to see architecture'}
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === 'modules' && (
            <>
              {analysis?.architecture ? (
                <ModulesView architecture={analysis.architecture} />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <p className="font-medium text-gray-400">No modules data yet</p>
                  <p className="text-sm text-gray-600 mt-1">Run analysis to see module breakdown.</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'user-flow' && (
            <>
              {analysis?.architecture ? (
                <UserFlowView architecture={analysis.architecture} />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <p className="font-medium text-gray-400">No user flow data yet</p>
                  <p className="text-sm text-gray-600 mt-1">Run analysis to see user flow diagram.</p>
                </div>
              )}
            </>
          )}

          {activeTab === 'version-diff' && (
            <VersionDiffView
              projectId={projectId}
              versions={versions}
              founderMode={founderMode}
              githubUrl={project?.github_url}
            />
          )}

          {activeTab === 'techstack' && (
            <>
              {analysis && selectedVersion ? (
                <TechStackDashboard
                  analysisId={selectedVersion}
                  founderMode={founderMode}
                  dataUsage={analysis.business_context?.data_usage}
                  externalDeps={analysis.business_context?.external_deps}
                  scaleAssessment={activeNarrative?.scale_assessment}
                  technologyChoices={activeNarrative?.technology_choices}
                />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <p className="font-medium text-gray-400">No tech stack analysis yet</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Run analysis to detect frameworks, infra, services, and complexity.
                  </p>
                </div>
              )}
            </>
          )}

          {activeTab === 'risks' && (
            <>
              {analysis && selectedVersion ? (
                <RiskPanel
                  analysisId={selectedVersion}
                  founderMode={founderMode}
                  founderRiskRewrites={analysis.founder_content?.risk_rewrites}
                />
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <p className="font-medium text-gray-400">No risk assessment yet</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Run analysis to generate risk and technical debt insights.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      </div>
      </div>

      {/* Floating chat button — above export button */}
      {selectedVersion && (
        <div className="fixed bottom-[11.5rem] right-6 z-[1000] group">
          {/* "Need any help?" chat bubble — top-left of button, tail points to button */}
          <div className="absolute bottom-full right-full mb-2 mr-[-0.5rem] whitespace-nowrap pointer-events-none">
            <div className="relative rounded-2xl rounded-br-sm bg-cyan-500 px-3 py-2 text-xs font-semibold text-white shadow-lg">
              Need any help? ✨
              {/* Tail pointing toward bottom-right (the button) */}
              <div className="absolute right-0 -bottom-2 h-0 w-0 border-b-[8px] border-b-transparent border-l-[10px] border-l-cyan-500" />
            </div>
          </div>
          <button
            onClick={() => setChatOpen(true)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-cyan-500 to-teal-600 shadow-lg transition-transform duration-200 hover:scale-110"
          >
            {/* Chat bubble icon */}
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </button>
          {/* Hover label to the left */}
          <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
            Your Code Whisperer
          </span>
        </div>
      )}

      {/* Export button — floats above the persistent FeedbackButton (z-[999]) */}
      {selectedVersion && (
        <div ref={exportMenuRef} className="fixed bottom-[6.5rem] right-6 z-[1000]">
          {exportMenuOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-44 rounded-xl border border-white/15 bg-[#0d1324]/95 p-2 shadow-2xl shadow-black/40">
              <button
                onClick={() => exportAnalysis('pdf')}
                disabled={exporting !== null}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/[0.08] disabled:opacity-40"
              >
                {exporting === 'pdf' ? 'Exporting PDF...' : 'Export PDF Report'}
              </button>
              <button
                onClick={() => exportAnalysis('slides')}
                disabled={exporting !== null}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/[0.08] disabled:opacity-40"
              >
                {exporting === 'slides' ? 'Exporting Slides...' : 'Export Slide Deck'}
              </button>
            </div>
          )}
          <button
            onClick={() => setExportMenuOpen(value => !value)}
            className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 shadow-lg transition-transform duration-200 hover:scale-110"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-6 w-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
              Export
            </span>
          </button>
        </div>
      )}

      {/* Feedback Prompt */}
      {showFeedbackPrompt && (
        <FeedbackPrompt onOpenFeedback={() => setIsFeedbackPanelOpen(true)} />
      )}

      {/* Feedback Panel */}
      <FeedbackPanel
        isOpen={isFeedbackPanelOpen}
        onClose={() => setIsFeedbackPanelOpen(false)}
        projectId={projectId}
      />

      {/* Chat Panel */}
      <ChatPanel
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        analysisId={selectedVersion || ''}
        onHighlightModule={(moduleId) => setHighlightedModuleId(moduleId)}
        onOpenArchitecture={() => setActiveTab('architecture')}
      />
    </div>
  );
}
