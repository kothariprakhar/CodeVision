// ABOUTME: GitHubConnectionStep handles GitHub repository connection and validation
// ABOUTME: Validates GitHub URL format and tests access with provided token
'use client';

import React, { useState, useEffect } from 'react';
import { useWizard } from '@/contexts/WizardContext';

export default function GitHubConnectionStep() {
  const { data, updateData, nextStep, previousStep } = useWizard();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [validationSuccess, setValidationSuccess] = useState(false);

  // Reset validation when public/private toggle changes or URL changes
  useEffect(() => {
    setValidationSuccess(false);
    setError('');
  }, [data.is_public, data.github_url]);

  const validateGitHub = async () => {
    setValidating(true);
    setError('');
    setValidationSuccess(false);

    try {
      // Validate URL format first
      if (!data.github_url.includes('github.com')) {
        setError('Must be a valid GitHub URL');
        setValidating(false);
        return;
      }

      // If private repo, token is required
      if (!data.is_public && !data.github_token.trim()) {
        setError('GitHub token is required for private repositories');
        setValidating(false);
        return;
      }

      // Call validation API
      const response = await fetch('/api/github/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          github_url: data.github_url,
          github_token: data.github_token,
          is_public: data.is_public,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.valid) {
        setError(result.error || 'Failed to validate GitHub access');
        updateData({ github_validated: false });
      } else {
        setValidationSuccess(true);
        updateData({ github_validated: true });
      }
    } catch (err) {
      setError('Failed to validate GitHub access');
      updateData({ github_validated: false });
    } finally {
      setValidating(false);
    }
  };

  const handleNext = () => {
    // For public repos, validation is optional (user can skip it)
    // For private repos, validation is required
    if (!data.is_public && !data.github_validated) {
      setError('Please validate GitHub access before proceeding');
      return;
    }

    // Clear any errors and proceed
    setError('');
    nextStep();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Connect GitHub Repository</h2>
      <p className="text-gray-400 mb-8">
        CodeVision currently supports GitHub repositories.
      </p>

      <div className="glass rounded-xl p-8">
        {/* GitHub Logo */}
        <div className="flex items-center gap-3 mb-6 p-4 bg-gray-800/50 rounded-lg">
          <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-white">GitHub</p>
            <p className="text-xs text-gray-400">Connect your repository</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {validationSuccess && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            ✓ GitHub access validated successfully
          </div>
        )}

        <div className="mb-6">
          <label
            htmlFor="github_url"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Repository URL *
          </label>
          <input
            type="url"
            id="github_url"
            placeholder="https://github.com/owner/repo"
            className="input-dark w-full px-4 py-3 rounded-lg"
            value={data.github_url}
            onChange={e => {
              updateData({ github_url: e.target.value, github_validated: false });
              setValidationSuccess(false);
            }}
          />
        </div>

        {!data.is_public && (
          <div className="mb-6">
            <label
              htmlFor="github_token"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              GitHub Personal Access Token *
            </label>
            <input
              type="password"
              id="github_token"
              className="input-dark w-full px-4 py-3 rounded-lg"
              value={data.github_token}
              onChange={e => {
                updateData({ github_token: e.target.value, github_validated: false });
                setValidationSuccess(false);
              }}
            />
            <p className="mt-2 text-xs text-gray-500">
              Create a token at GitHub Settings → Developer Settings → Personal Access Tokens.
              Needs repo read access.
            </p>
          </div>
        )}

        <button
          onClick={validateGitHub}
          disabled={validating || !data.github_url}
          className="mb-8 px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {validating ? 'Validating...' : 'Validate Access'}
        </button>

        <div className="flex justify-between">
          <button
            onClick={previousStep}
            className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Back
          </button>
          <button
            onClick={handleNext}
            className="btn-primary px-8 py-3 text-white font-medium rounded-lg"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
