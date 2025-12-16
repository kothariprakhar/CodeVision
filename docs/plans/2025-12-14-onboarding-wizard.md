# Onboarding Wizard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a 3-step onboarding wizard that replaces the single-page project creation form with a guided flow for project setup, GitHub connection, and requirements gathering.

**Architecture:** Multi-step wizard using React Context for state management across steps. Each step is a separate component with validation. Stepper component shows progress. Final step triggers auto-analysis after document upload and/or README import.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, react-hook-form, zod, Supabase

---

### Task 1: Create WizardStepper Component

**Files:**
- Create: `src/components/WizardStepper.tsx`
- Test: Manual testing in browser (component library, no unit tests needed)

**Step 1: Write the WizardStepper component**

Create a simple stepper component that displays 3 steps with visual progress indication.

```tsx
// ABOUTME: WizardStepper component displays multi-step wizard progress
// ABOUTME: Shows current step, completed steps, and upcoming steps with visual indicators
'use client';

import React from 'react';

interface Step {
  number: number;
  title: string;
}

interface WizardStepperProps {
  currentStep: number;
  steps: Step[];
}

export default function WizardStepper({ currentStep, steps }: WizardStepperProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step.number === currentStep
                    ? 'bg-purple-600 text-white ring-4 ring-purple-600/30'
                    : step.number < currentStep
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step.number < currentStep ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <p
                className={`mt-3 text-sm font-medium ${
                  step.number === currentStep
                    ? 'text-purple-400'
                    : step.number < currentStep
                    ? 'text-gray-300'
                    : 'text-gray-500'
                }`}
              >
                {step.title}
              </p>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-4 rounded-full transition-all ${
                  step.number < currentStep ? 'bg-purple-500' : 'bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Verify component builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/components/WizardStepper.tsx
git commit -m "feat: add WizardStepper component for onboarding wizard"
```

---

### Task 2: Create Wizard Context for State Management

**Files:**
- Create: `src/contexts/WizardContext.tsx`
- Test: Manual testing in browser

**Step 1: Write the WizardContext**

Create a context to manage wizard state across all steps.

```tsx
// ABOUTME: WizardContext provides shared state management for multi-step wizard
// ABOUTME: Manages current step, form data, navigation between steps
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WizardData {
  // Step 1: Project Details
  name: string;
  description: string;
  is_public: boolean;

  // Step 2: GitHub Connection
  github_url: string;
  github_token: string;
  github_validated: boolean;

  // Step 3: Requirements
  documents: File[];
  readme_imported: boolean;
}

interface WizardContextType {
  currentStep: number;
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

const initialData: WizardData = {
  name: '',
  description: '',
  is_public: false,
  github_url: '',
  github_token: '',
  github_validated: false,
  documents: [],
  readme_imported: false,
};

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);

  const updateData = (partial: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const previousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setData(initialData);
  };

  return (
    <WizardContext.Provider
      value={{ currentStep, data, updateData, nextStep, previousStep, resetWizard }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
}
```

**Step 2: Verify context builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/contexts/WizardContext.tsx
git commit -m "feat: add WizardContext for wizard state management"
```

---

### Task 3: Implement Step 1 - Project Details

**Files:**
- Create: `src/components/wizard/ProjectDetailsStep.tsx`
- Test: Manual testing in browser with validation

**Step 1: Write ProjectDetailsStep component**

```tsx
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
```

**Step 2: Verify component builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/components/wizard/ProjectDetailsStep.tsx
git commit -m "feat: add ProjectDetailsStep for wizard step 1"
```

---

### Task 4: Implement Step 2 - GitHub Connection

**Files:**
- Create: `src/components/wizard/GitHubConnectionStep.tsx`
- Test: Manual testing with validation

**Step 1: Write GitHubConnectionStep component**

```tsx
// ABOUTME: GitHubConnectionStep handles GitHub repository connection and validation
// ABOUTME: Validates GitHub URL format and tests access with provided token
'use client';

import React, { useState } from 'react';
import { useWizard } from '@/contexts/WizardContext';

export default function GitHubConnectionStep() {
  const { data, updateData, nextStep, previousStep } = useWizard();
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');
  const [validationSuccess, setValidationSuccess] = useState(false);

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
    if (!data.github_validated && !data.is_public) {
      setError('Please validate GitHub access before proceeding');
      return;
    }
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
```

**Step 2: Verify component builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/components/wizard/GitHubConnectionStep.tsx
git commit -m "feat: add GitHubConnectionStep for wizard step 2"
```

---

### Task 5: Create GitHub Validation API Endpoint

**Files:**
- Create: `src/app/api/github/validate/route.ts`
- Test: Manual testing via wizard UI

**Step 1: Write GitHub validation endpoint**

```ts
// ABOUTME: API endpoint for validating GitHub repository access
// ABOUTME: Tests if provided token has access to the specified repository
import { NextRequest, NextResponse } from 'next/server';
import { validateGitHubAccess } from '@/lib/services/github';
import { z } from 'zod';

const ValidateSchema = z.object({
  github_url: z.string().url(),
  github_token: z.string().optional().default(''),
  is_public: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ValidateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { github_url, github_token, is_public } = parsed.data;

    // Skip validation for public repos without token
    if (is_public && !github_token) {
      return NextResponse.json({ valid: true });
    }

    // Validate access
    const result = await validateGitHubAccess(github_url, github_token);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: 'Failed to validate GitHub access' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify endpoint builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/app/api/github/validate/route.ts
git commit -m "feat: add GitHub validation API endpoint"
```

---

### Task 6: Create README Import API Endpoint

**Files:**
- Create: `src/app/api/github/readme/route.ts`
- Test: Manual testing via wizard UI

**Step 1: Write README import endpoint**

```ts
// ABOUTME: API endpoint for importing README.md from GitHub repository
// ABOUTME: Fetches README content via GitHub API and returns as downloadable content
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ReadmeSchema = z.object({
  github_url: z.string().url(),
  github_token: z.string().optional().default(''),
  is_public: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReadmeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { github_url, github_token, is_public } = parsed.data;

    // Extract owner/repo from URL
    const match = github_url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL format' },
        { status: 400 }
      );
    }

    const [, owner, repo] = match;

    // Fetch README from GitHub API
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeVision-Analyzer',
    };

    if (!is_public && github_token) {
      headers.Authorization = `token ${github_token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'README.md not found in repository' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch README from GitHub' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // README content is base64 encoded
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return NextResponse.json({
      content,
      name: data.name,
      size: data.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to import README' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify endpoint builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/app/api/github/readme/route.ts
git commit -m "feat: add README import API endpoint"
```

---

### Task 7: Implement Step 3 - Requirements

**Files:**
- Create: `src/components/wizard/RequirementsStep.tsx`
- Modify: `src/app/api/documents/route.ts` (check if it handles file uploads)
- Test: Manual testing with file upload and README import

**Step 1: Write RequirementsStep component**

```tsx
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
          github_token: data.is_public ? '' : data.github_token,
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
        for (const file of data.documents) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('project_id', projectId);

          const uploadResponse = await fetch('/api/documents', {
            method: 'POST',
            body: formData,
          });

          if (!uploadResponse.ok) {
            console.error('Failed to upload document:', file.name);
          }
        }
      }

      // Step 3: Trigger analysis (already auto-triggered by project creation)
      // The /api/projects POST endpoint auto-triggers analysis

      // Reset wizard and redirect
      resetWizard();
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete setup');
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
```

**Step 2: Verify component builds**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/components/wizard/RequirementsStep.tsx
git commit -m "feat: add RequirementsStep for wizard step 3 with README import"
```

---

### Task 8: Create Wizard Page and Replace /projects/new

**Files:**
- Modify: `src/app/projects/new/page.tsx`
- Test: Manual end-to-end testing

**Step 1: Replace page content with wizard**

```tsx
// ABOUTME: Multi-step onboarding wizard for creating new projects
// ABOUTME: Guides users through project setup, GitHub connection, and requirements upload
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { WizardProvider, useWizard } from '@/contexts/WizardContext';
import WizardStepper from '@/components/WizardStepper';
import ProjectDetailsStep from '@/components/wizard/ProjectDetailsStep';
import GitHubConnectionStep from '@/components/wizard/GitHubConnectionStep';
import RequirementsStep from '@/components/wizard/RequirementsStep';

const WIZARD_STEPS = [
  { number: 1, title: 'Project Details' },
  { number: 2, title: 'GitHub' },
  { number: 3, title: 'Requirements' },
];

function WizardContent() {
  const { currentStep } = useWizard();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold gradient-text mb-8 text-center">
        Create New Project
      </h1>

      <WizardStepper currentStep={currentStep} steps={WIZARD_STEPS} />

      {currentStep === 1 && <ProjectDetailsStep />}
      {currentStep === 2 && <GitHubConnectionStep />}
      {currentStep === 3 && <RequirementsStep />}
    </div>
  );
}

export default function NewProject() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}
```

**Step 2: Verify entire wizard works**

Run: `npm run dev`

Test manually:
1. Navigate to /projects/new
2. Complete Step 1 with valid project details
3. Complete Step 2 with GitHub URL and validation
4. Complete Step 3 with document upload and/or README import
5. Verify project is created and analysis starts
6. Verify redirect to project page

Expected: All steps work, project created, analysis auto-triggered, redirects correctly

**Step 3: Commit**

```bash
git add src/app/projects/new/page.tsx
git commit -m "feat: replace single-page form with multi-step wizard"
```

---

### Task 9: Final Testing and Cleanup

**Files:**
- Review all created files
- Test complete flow

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 2: Test complete onboarding flow**

1. Start dev server: `npm run dev`
2. Create new account or login
3. Navigate to /projects/new
4. Test public repository flow:
   - Enter project details
   - Enter public GitHub URL (e.g., https://github.com/facebook/react)
   - Enable "Public Repository" toggle
   - Skip token, validate access
   - Import README
   - Complete setup
5. Verify project created and analysis runs
6. Test private repository flow:
   - Create another project
   - Enter private repo URL
   - Provide valid GitHub token
   - Validate access
   - Upload documents
   - Complete setup

Expected: Both flows work end-to-end with auto-analysis

**Step 3: Commit any fixes**

If any issues found during testing, fix them and commit:
```bash
git add .
git commit -m "fix: resolve wizard testing issues"
```

---

## Implementation Notes

### TDD Approach
- This is primarily UI work with manual testing
- Component testing via browser interaction
- API endpoints tested through wizard usage
- No unit tests required for UI components (following project patterns)

### Auto-Analysis
- Already implemented in `/api/projects` POST endpoint (lines 86-88)
- Wizard leverages existing functionality
- No additional code needed for auto-trigger

### File Upload
- Assumes `/api/documents` POST endpoint handles FormData uploads
- Each document uploaded individually in loop
- Failures logged but don't block completion

### State Management
- React Context chosen for simplicity (no external state library needed)
- State scoped to wizard only (not global)
- Reset on completion to prepare for next use

### Validation
- Step 1: Client-side validation (name required, length limits)
- Step 2: Server-side GitHub access validation
- Step 3: Minimum 1 document required (README or upload)

### Dependencies
- Task 1 (Stepper): No dependencies
- Task 2 (Context): No dependencies
- Task 3 (Step 1): Depends on Task 2 (context)
- Task 4 (Step 2): Depends on Task 2 (context)
- Task 5 (Validation API): No dependencies (can run parallel with Task 4)
- Task 6 (README API): No dependencies (can run parallel with others)
- Task 7 (Step 3): Depends on Tasks 2, 6 (context + README API)
- Task 8 (Page): Depends on Tasks 1, 2, 3, 4, 7 (all components)
- Task 9 (Testing): Depends on Task 8 (complete wizard)

### Beads Mapping
- code-vision-96e → Task 1 (WizardStepper)
- code-vision-mrh → Task 2 (WizardContext)
- code-vision-58m → Task 3 (Step 1)
- code-vision-pv0 → Tasks 4 + 5 (Step 2 + validation API)
- code-vision-avi → Task 6 (README API)
- code-vision-6s7 → Task 7 (Step 3)
- code-vision-pum → Task 8 (Replace page)
- code-vision-ynv → Already done (auto-analysis exists)
- code-vision-6j8 → Task 4 (GitHub logo in Step 2)
