'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewProject() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    github_url: '',
    github_token: '',
    is_public: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }

      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold gradient-text mb-8">
        Create New Project
      </h1>

      <form onSubmit={handleSubmit} className="glass rounded-xl p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="mb-6">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Project Name *
          </label>
          <input
            type="text"
            id="name"
            required
            maxLength={100}
            className="input-dark w-full px-4 py-3 rounded-lg"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={500}
            className="input-dark w-full px-4 py-3 rounded-lg resize-none"
            value={formData.description}
            onChange={e =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="github_url"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            GitHub Repository URL *
          </label>
          <input
            type="url"
            id="github_url"
            required
            placeholder="https://github.com/owner/repo"
            className="input-dark w-full px-4 py-3 rounded-lg"
            value={formData.github_url}
            onChange={e =>
              setFormData({ ...formData, github_url: e.target.value })
            }
          />
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFormData({ ...formData, is_public: !formData.is_public })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                formData.is_public ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.is_public ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <label className="text-sm font-medium text-gray-300">
              Public Repository
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Enable this if the repository is public. No token required for public repos.
          </p>
        </div>

        {!formData.is_public && (
          <div className="mb-8">
            <label
              htmlFor="github_token"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              GitHub Personal Access Token *
            </label>
            <input
              type="password"
              id="github_token"
              required={!formData.is_public}
              className="input-dark w-full px-4 py-3 rounded-lg"
              value={formData.github_token}
              onChange={e =>
                setFormData({ ...formData, github_token: e.target.value })
              }
            />
            <p className="mt-2 text-xs text-gray-500">
              Create a token at GitHub Settings → Developer Settings → Personal
              Access Tokens. Needs repo read access.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary px-8 py-3 text-white font-medium rounded-lg"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
