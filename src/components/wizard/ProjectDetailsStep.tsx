// ABOUTME: ProjectDetailsStep collects basic project information in onboarding wizard
// ABOUTME: Validates required name field and allows optional description
'use client';

import React from 'react';
import { useWizard } from '@/contexts/WizardContext';

export default function ProjectDetailsStep() {
  const { data, updateData, nextStep } = useWizard();
  const [errors, setErrors] = React.useState({ name: '' });

  const validateAndNext = () => {
    // Validate
    if (!data.name.trim()) {
      setErrors({ name: 'Project name is required' });
      return;
    }
    if (data.name.length > 100) {
      setErrors({ name: 'Project name must be 100 characters or less' });
      return;
    }
    if (data.description.length > 500) {
      setErrors({ name: 'Description must be 500 characters or less' });
      return;
    }

    // Clear errors and proceed
    setErrors({ name: '' });
    nextStep();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-white mb-2">Project Details</h2>
      <p className="text-gray-400 mb-8">
        Let's start by giving your project a name and description.
      </p>

      <div className="glass rounded-xl p-8">
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
            maxLength={100}
            className="input-dark w-full px-4 py-3 rounded-lg"
            value={data.name}
            onChange={e => updateData({ name: e.target.value })}
            placeholder="My Awesome Project"
          />
          {errors.name && (
            <p className="mt-2 text-sm text-red-400">{errors.name}</p>
          )}
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
            value={data.description}
            onChange={e => updateData({ description: e.target.value })}
            placeholder="Brief description of your project (optional)"
          />
          <p className="mt-2 text-xs text-gray-500">
            {data.description.length}/500 characters
          </p>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => updateData({ is_public: !data.is_public })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                data.is_public ? 'bg-purple-600' : 'bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  data.is_public ? 'translate-x-6' : 'translate-x-1'
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

        <div className="flex justify-end">
          <button
            onClick={validateAndNext}
            className="btn-primary px-8 py-3 text-white font-medium rounded-lg"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
