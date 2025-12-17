'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Tabs from '@/components/Tabs';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import AnalysisVersionSelector from '@/components/AnalysisVersionSelector';
import ChatBot from '@/components/ChatBot';
import FeedbackPrompt from '@/components/FeedbackPrompt';
import FeedbackPanel from '@/components/FeedbackPanel';
import { useAuth } from '@/lib/hooks/useAuth';

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

interface ArchitectureVisualization {
  nodes: Array<{
    id: string;
    name: string;
    type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
    complexity: 'low' | 'medium' | 'high';
    description: string;
    files: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'imports' | 'calls' | 'stores' | 'renders';
  }>;
}

interface Analysis {
  id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  analyzed_at: string;
}

interface AnalysisVersion {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
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
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('architecture');
  const [isFeedbackPanelOpen, setIsFeedbackPanelOpen] = useState(false);
  const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
  const [hasShownPrompt, setHasShownPrompt] = useState(false);

  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Project not found');
      const data = await response.json();
      setProject(data);
    } catch (err) {
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
        if (data.versions?.length > 0 && !selectedVersion) {
          setSelectedVersion(data.versions[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, [projectId, selectedVersion]);

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
  }, [project, fetchProject, fetchVersions]);

  // Show feedback prompt 12 seconds after first analysis completes
  useEffect(() => {
    if (!analysis || hasShownPrompt) return;

    const timer = setTimeout(() => {
      setShowFeedbackPrompt(true);
      setHasShownPrompt(true);
    }, 12000);

    return () => clearTimeout(timer);
  }, [analysis, hasShownPrompt]);

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

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Analysis failed');
      }

      await fetchProject();
      await fetchVersions();
      // Select the new version
      if (data.id) {
        setSelectedVersion(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      await fetchProject();
    } finally {
      setAnalyzing(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'markdown': return '📝';
      case 'text': return '📃';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'low': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default: return '';
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

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading project...</div>;
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-400">Project not found</div>;
  }

  const tabs = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'issues', label: `Issues${analysis ? ` (${analysis.findings.length})` : ''}` },
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
          </div>
          {getLastAnalyzedText() && (
            <span className="text-xs text-gray-500 bg-white/5 px-3 py-1.5 rounded-full whitespace-nowrap">
              {getLastAnalyzedText()}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 animate-fade-in">
          {error}
        </div>
      )}

      {/* Documents Section - Moved Above Tabs */}
      <div className="glass-refined rounded-2xl p-6 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Requirements Documents
              </h2>
              <p className="text-xs text-gray-500">
                {documents.length} {documents.length === 1 ? 'file' : 'files'} uploaded
              </p>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <label className="block">
            <div className="relative group">
              <input
                type="file"
                multiple
                accept=".pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp"
                onChange={handleFileUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
              />
              <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center transition-all duration-300 group-hover:border-purple-500/40 group-hover:bg-purple-500/5">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <p className="text-sm text-gray-300 font-medium">
                  {uploading ? 'Uploading...' : 'Drop files here or click to upload'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  PRD, BRD, wireframes, or other requirements (PDF, MD, TXT, images)
                </p>
              </div>
            </div>
          </label>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">No documents uploaded yet</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {documents.map(doc => (
              <li key={doc.id} className="group flex justify-between items-center p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-200">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center text-sm">
                    {getFileIcon(doc.file_type)}
                  </div>
                  <span className="text-sm text-gray-300">{doc.filename}</span>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 rounded transition-all duration-200"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tabs - Now Below Documents */}
      <div className="glass-refined rounded-2xl mb-6 overflow-hidden">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-6">
          {activeTab === 'architecture' && (
            <>
              {/* Version selector and Run Analysis */}
              <div className="flex items-center justify-between mb-6">
                {versions.length > 0 && (
                  <AnalysisVersionSelector
                    versions={versions}
                    selectedVersion={selectedVersion}
                    onChange={handleVersionChange}
                  />
                )}
                <button
                  onClick={runAnalysis}
                  disabled={analyzing || documents.length === 0}
                  className="btn-primary-refined px-5 py-2.5 text-white text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Run Analysis
                    </>
                  )}
                </button>
              </div>

              {/* Architecture Diagram */}
              {analysis?.architecture ? (
                <ArchitectureDiagram architecture={analysis.architecture} />
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

              {/* Chatbot */}
              {analysis && selectedVersion && (
                <div className="mt-6">
                  <ChatBot projectId={projectId} analysisId={selectedVersion} />
                </div>
              )}
            </>
          )}

          {activeTab === 'issues' && (
            <>
              {analysis?.findings && analysis.findings.length > 0 ? (
                <div className="space-y-3">
                  {analysis.findings.map((finding, index) => (
                    <div
                      key={index}
                      className={`rounded-xl p-4 border transition-all duration-200 hover:scale-[1.01] ${getSeverityClass(finding.severity)}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-white text-sm">{finding.title}</h3>
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-white/10">
                          {finding.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 leading-relaxed">{finding.description}</p>
                    </div>
                  ))}
                  <Link
                    href={`/projects/${projectId}/report`}
                    className="group flex items-center justify-center gap-2 text-purple-400 hover:text-purple-300 text-sm font-medium mt-6 py-3 rounded-xl bg-purple-500/5 hover:bg-purple-500/10 transition-all duration-200"
                  >
                    View full report
                    <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                  </Link>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="font-medium text-gray-400">No issues found</p>
                  <p className="text-sm text-gray-600 mt-1">Everything looks good!</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
    </div>
  );
}
