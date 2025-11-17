'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function ProjectDetail() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

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

  useEffect(() => {
    Promise.all([fetchProject(), fetchDocuments()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProject, fetchDocuments]);

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
      router.push(`/projects/${projectId}/report`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      await fetchProject();
    } finally {
      setAnalyzing(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return '📄';
      case 'markdown':
        return '📝';
      case 'text':
        return '📃';
      case 'image':
        return '🖼️';
      default:
        return '📁';
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

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading project...</div>;
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-400">Project not found</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
          ← Back to Projects
        </Link>
      </div>

      <div className="glass rounded-xl p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{project.name}</h1>
            {project.description && (
              <p className="text-gray-400 mt-2">{project.description}</p>
            )}
          </div>
          <span className={`status-badge ${getStatusClass(project.status)}`}>
            {project.status}
          </span>
        </div>
        <p className="text-gray-500 text-sm">{project.github_url}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Requirements Documents
        </h2>

        <div className="mb-6">
          <label className="block">
            <span className="sr-only">Upload files</span>
            <input
              type="file"
              multiple
              accept=".pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-400
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-500/20 file:text-purple-400
                hover:file:bg-purple-500/30
                file:transition-colors file:cursor-pointer
                disabled:opacity-50"
            />
          </label>
          <p className="mt-2 text-xs text-gray-500">
            Upload PRD, BRD, wireframes, or other requirements documents (PDF,
            Markdown, Text, Images)
          </p>
        </div>

        {uploading && (
          <div className="text-sm text-purple-400 mb-4">Uploading...</div>
        )}

        {documents.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents uploaded yet</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {documents.map(doc => (
              <li
                key={doc.id}
                className="py-3 flex justify-between items-center"
              >
                <div className="flex items-center">
                  <span className="mr-3 text-lg">{getFileIcon(doc.file_type)}</span>
                  <span className="text-sm text-gray-300">{doc.filename}</span>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="text-red-400 hover:text-red-300 text-sm transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Analysis</h2>

        <div className="flex gap-4">
          <button
            onClick={runAnalysis}
            disabled={
              analyzing ||
              documents.length === 0 ||
              project.status === 'analyzing'
            }
            className="btn-primary px-6 py-3 text-white font-medium rounded-lg"
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>

          {project.status === 'completed' && (
            <Link
              href={`/projects/${projectId}/report`}
              className="px-6 py-3 bg-indigo-500/20 text-indigo-400 font-medium rounded-lg hover:bg-indigo-500/30 transition-colors border border-indigo-500/30"
            >
              View Report
            </Link>
          )}
        </div>

        {documents.length === 0 && (
          <p className="mt-3 text-sm text-gray-500">
            Upload at least one document before running analysis
          </p>
        )}
      </div>
    </div>
  );
}
