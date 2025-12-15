// ABOUTME: RequirementsStep handles document upload and README import for requirements
// ABOUTME: Supports both local file upload and importing README from connected repository
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizard } from '@/contexts/WizardContext';
import { useAuth } from '@/lib/hooks/useAuth';

export default function RequirementsStep() {
  const router = useRouter();
  const { user } = useAuth();
  const { data, updateData, previousStep, resetWizard } = useWizard();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importingReadme, setImportingReadme] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    updateData({ documents: [...data.documents, ...files] });
  };

  const removeDocument = (index: number) => {
    const newDocs = data.documents.filter((_, i) => i !== index);
    updateData({ documents: newDocs });
  };

  const handleImportReadme = async () => {
    setImportingReadme(true);
    setError('');

    try {
      const response = await fetch('/api/github/readme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_url: data.github_url,
          github_token: data.github_token,
          is_public: data.is_public,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to import README');
      }

      // Convert README content to File object
      const blob = new Blob([result.content], { type: 'text/markdown' });
      const file = new File([blob], result.name || 'README.md', {
        type: 'text/markdown',
      });

      updateData({
        documents: [...data.documents, file],
        readme_imported: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import README');
    } finally {
      setImportingReadme(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');

    try {
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Step 1: Create project
      const projectResponse = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          github_url: data.github_url,
          github_token: data.github_token || '',
          is_public: data.is_public,
        }),
      });

      const projectData = await projectResponse.json();

      if (!projectResponse.ok) {
        throw new Error(projectData.error || 'Failed to create project');
      }

      const projectId = projectData.id;

      // Step 2: Upload documents if any
      if (data.documents.length > 0) {
        const uploadResults: Array<{ file: string; success: boolean; error?: string }> = [];

        for (const file of data.documents) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('project_id', projectId);

          const uploadResponse = await fetch('/api/documents', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({ error: 'Unknown error' }));
            uploadResults.push({
              file: file.name,
              success: false,
              error: errorData.error || `Upload failed with status ${uploadResponse.status}`
            });
          } else {
            uploadResults.push({ file: file.name, success: true });
          }
        }

        // Check if any uploads failed
        const failedUploads = uploadResults.filter(r => !r.success);
        if (failedUploads.length > 0) {
          const failedFilesList = failedUploads
            .map(f => `${f.file}: ${f.error}`)
            .join('\n');
          throw new Error(
            `Project created but ${failedUploads.length} document(s) failed to upload:\n${failedFilesList}\n\nProject ID: ${projectId}`
          );
        }
      }

      // Step 3: Trigger analysis (already auto-triggered by project creation)
      // The /api/projects POST endpoint auto-triggers analysis

      // Only reset wizard and redirect on complete success
      resetWizard();
      router.push(`/projects/${projectId}`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to complete setup';
      setError(errorMessage);

      // If error mentions "Project created but", don't reset wizard
      // User needs to see the error and know their project was created
      if (errorMessage.includes('Project created but')) {
        // Don't reset wizard - let user see what went wrong
        // They can navigate to the project manually if needed
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Add Requirements</h2>
      <p className="text-gray-400 mb-8">
        Upload requirement documents or import your README to begin analysis.
      </p>

      <div className="glass rounded-xl p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Import README */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">
            Import from Repository
          </h3>
          <button
            onClick={handleImportReadme}
            disabled={importingReadme || data.readme_imported}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importingReadme
              ? 'Importing...'
              : data.readme_imported
              ? '✓ README Imported'
              : 'Import README.md'}
          </button>
          <p className="mt-2 text-xs text-gray-500">
            Import the README.md from your connected repository.
          </p>
        </div>

        {/* Upload Documents */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-3">
            Upload Documents
          </h3>
          <label className="block w-full p-8 border-2 border-dashed border-gray-600 hover:border-purple-500 rounded-lg cursor-pointer transition-colors">
            <input
              type="file"
              accept=".pdf,.md,.txt,.doc,.docx"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-gray-400">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-gray-500 mt-1">
                PDF, Markdown, TXT, DOC, DOCX
              </p>
            </div>
          </label>

          {/* Document List */}
          {data.documents.length > 0 && (
            <div className="mt-4 space-y-2">
              {data.documents.map((doc, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-purple-400"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
                    </svg>
                    <span className="text-sm text-gray-300">{doc.name}</span>
                  </div>
                  <button
                    onClick={() => removeDocument(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between">
          <button
            onClick={previousStep}
            disabled={loading}
            className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleComplete}
            disabled={loading || data.documents.length === 0}
            className="btn-primary px-8 py-3 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting up...' : 'Complete Setup'}
          </button>
        </div>

        {data.documents.length === 0 && (
          <p className="mt-4 text-sm text-gray-500 text-center">
            Please add at least one document to continue.
          </p>
        )}
      </div>
    </div>
  );
}
