# Chrome Plugin Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build backend APIs and infrastructure to support Chrome plugin element-level code inspection with multi-repo workspace support.

**Architecture:** Extend current Next.js/Supabase backend with three new database tables (workspaces, elements, api_mappings), add AST parsing service for element extraction, implement three new plugin-specific API endpoints, and create smart API matching algorithm for cross-repo data flow tracing.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Supabase PostgreSQL, @babel/parser for AST, Zod for validation

---

## Task 1: Add Git Metadata to Analysis Results

**Goal:** Track branch and commit information in analysis results for transparency in Chrome plugin UI.

**Files:**
- Modify: `src/lib/services/github.ts` (add git info extraction)
- Modify: `src/lib/services/analyzer.ts` (pass git info to analysis)
- Modify: `src/lib/db.ts` (add types)
- Modify: `src/lib/repositories/analysis.ts` (accept new fields)
- Create: `migrations/004_add_git_metadata_to_analysis.sql`
- Test: Manual verification (no dedicated tests for migration)

### Step 1.1: Create database migration for git metadata

Create: `migrations/004_add_git_metadata_to_analysis.sql`

```sql
-- ABOUTME: Add git metadata (branch, commit, commit_url) to analysis_results table
-- ABOUTME: Enables Chrome plugin to display "Analysis: main@abc123" with GitHub links

-- Add git metadata columns to analysis_results
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS branch VARCHAR(255),
ADD COLUMN IF NOT EXISTS commit_hash VARCHAR(40),
ADD COLUMN IF NOT EXISTS commit_url VARCHAR(500);

-- Create index for commit lookups
CREATE INDEX IF NOT EXISTS idx_analysis_results_commit ON analysis_results(commit_hash);

-- Add comment explaining the columns
COMMENT ON COLUMN analysis_results.branch IS 'Git branch name at time of analysis (e.g., "main", "develop")';
COMMENT ON COLUMN analysis_results.commit_hash IS 'Git commit SHA at time of analysis (short or full hash)';
COMMENT ON COLUMN analysis_results.commit_url IS 'Full GitHub URL to commit (e.g., https://github.com/user/repo/commit/abc123)';
```

**Expected:** Migration file created

### Step 1.2: Update TypeScript interfaces for git metadata

Modify: `src/lib/db.ts:67-76` (AnalysisResult interface)

```typescript
export interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  chat_history: ChatMessage[];
  raw_response: string;
  analyzed_at: string;
  branch?: string;          // NEW: Git branch name
  commit_hash?: string;     // NEW: Commit SHA
  commit_url?: string;      // NEW: GitHub commit URL
}
```

**Expected:** Types updated, no TypeScript errors

### Step 1.3: Add git info extraction function to github service

Modify: `src/lib/services/github.ts` (add new function at end)

```typescript
interface GitMetadata {
  branch: string;
  commitHash: string;
  commitUrl: string;
}

export async function extractGitMetadata(
  repoPath: string,
  githubUrl: string
): Promise<GitMetadata | null> {
  try {
    // Try to read git info from repository directory
    const gitHeadPath = path.join(repoPath, '.git', 'HEAD');

    if (!fs.existsSync(gitHeadPath)) {
      console.warn('No .git directory found, cannot extract git metadata');
      return null;
    }

    // Read branch name from HEAD
    const headContent = fs.readFileSync(gitHeadPath, 'utf-8').trim();
    let branch = 'main'; // default

    if (headContent.startsWith('ref: refs/heads/')) {
      branch = headContent.replace('ref: refs/heads/', '');
    }

    // Read commit hash
    let commitHash = '';
    if (headContent.startsWith('ref:')) {
      const refPath = path.join(repoPath, '.git', headContent.replace('ref: ', ''));
      if (fs.existsSync(refPath)) {
        commitHash = fs.readFileSync(refPath, 'utf-8').trim().substring(0, 7);
      }
    } else {
      commitHash = headContent.substring(0, 7);
    }

    // Build commit URL from GitHub URL
    const cleanUrl = githubUrl.replace(/\.git$/, '');
    const commitUrl = `${cleanUrl}/commit/${commitHash}`;

    return {
      branch,
      commitHash,
      commitUrl,
    };
  } catch (error) {
    console.error('Failed to extract git metadata:', error);
    return null;
  }
}
```

**Expected:** Function compiles, no errors

### Step 1.4: Update analyzer to extract and pass git metadata

Modify: `src/lib/services/analyzer.ts:65-103` (after repo download, before Claude analysis)

```typescript
    if (downloadResult.success && downloadResult.path) {
      const repoPath = downloadResult.path;

      // Get relevant code files
      const relevantFiles = getRelevantFiles(repoPath);

      if (relevantFiles.length === 0) {
        await updateProject(projectId, { status: 'failed' });
        return { success: false, error: 'No source code files found in repository' };
      }

      // Read code file contents
      codeFiles = relevantFiles.map(filePath => ({
        path: filePath,
        content: readCodeFile(repoPath, filePath),
      }));

      // NEW: Extract git metadata
      const gitMetadata = await extractGitMetadata(repoPath, project.github_url);

      console.log(`Successfully downloaded repository and loaded ${codeFiles.length} code files`);
      console.log('Git metadata:', gitMetadata);

      // Run Claude analysis
      const analysisOutput = await analyzeCodeAlignment({
        documents: parsedDocs,
        codeFiles,
      });

      // Save results with git metadata
      const result = await createAnalysisResult({
        project_id: projectId,
        summary: analysisOutput.summary,
        findings: analysisOutput.findings,
        architecture: analysisOutput.architecture,
        raw_response: analysisOutput.raw_response,
        branch: gitMetadata?.branch,           // NEW
        commit_hash: gitMetadata?.commitHash,   // NEW
        commit_url: gitMetadata?.commitUrl,     // NEW
      });
```

**Expected:** Analyzer updated, no TypeScript errors

### Step 1.5: Update repository layer to accept git metadata

Modify: `src/lib/repositories/analysis.ts:4-10` (CreateAnalysisInput interface)

```typescript
export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
  branch?: string;           // NEW
  commit_hash?: string;      // NEW
  commit_url?: string;       // NEW
}
```

Modify: `src/lib/repositories/analysis.ts:12-27` (createAnalysis function)

```typescript
export async function createAnalysis(input: CreateAnalysisInput): Promise<AnalysisResult> {
  const { data, error } = await supabase
    .from('analysis_results')
    .insert({
      project_id: input.project_id,
      summary: input.summary,
      findings: input.findings,
      architecture: input.architecture,
      chat_history: [],
      raw_response: input.raw_response,
      branch: input.branch,                 // NEW
      commit_hash: input.commit_hash,       // NEW
      commit_url: input.commit_url,         // NEW
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create analysis: ${error.message}`);
  return data as AnalysisResult;
}
```

**Expected:** Repository layer compiles, no errors

### Step 1.6: Test git metadata extraction manually

Run: `npm run build`

**Expected:** Build succeeds with no TypeScript errors

### Step 1.7: Apply database migration

**Manual Step:** Open Supabase SQL Editor and run the migration SQL from `migrations/004_add_git_metadata_to_analysis.sql`

**Expected:** Migration succeeds, columns added to `analysis_results` table

### Step 1.8: Commit git metadata implementation

```bash
git add migrations/004_add_git_metadata_to_analysis.sql
git add src/lib/db.ts src/lib/services/github.ts src/lib/services/analyzer.ts src/lib/repositories/analysis.ts
git commit -m "feat: add git metadata tracking to analysis results

- Add branch, commit_hash, commit_url columns to analysis_results
- Extract git info from downloaded repositories
- Display commit info in plugin UI as 'main@abc123'
- Links to GitHub commit for transparency

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 2: Create Workspaces Database Table

**Goal:** Create database table for multi-repo workspace configurations with domain mappings.

**Files:**
- Create: `migrations/005_create_workspaces_table.sql`
- Create: `src/lib/repositories/workspaces.ts`
- Modify: `src/lib/db.ts` (add Workspace type)

### Step 2.1: Create workspaces table migration

Create: `migrations/005_create_workspaces_table.sql`

```sql
-- ABOUTME: Create workspaces table for Chrome plugin multi-repo support
-- ABOUTME: Stores user workspace configurations with domain mappings and manual API overrides

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  manual_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at DESC);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own workspaces
CREATE POLICY "Users can view own workspaces" ON workspaces
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own workspaces
CREATE POLICY "Users can insert own workspaces" ON workspaces
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own workspaces
CREATE POLICY "Users can update own workspaces" ON workspaces
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own workspaces
CREATE POLICY "Users can delete own workspaces" ON workspaces
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments explaining the schema
COMMENT ON TABLE workspaces IS 'Chrome plugin workspace configurations linking domains to analyses';
COMMENT ON COLUMN workspaces.domain_mappings IS 'Array of {domain: string, analysisId: string} objects';
COMMENT ON COLUMN workspaces.analysis_ids IS 'Array of analysis UUIDs included in this workspace';
COMMENT ON COLUMN workspaces.manual_mappings IS 'Array of manual API endpoint mappings for failed auto-matches';
```

**Expected:** Migration file created

### Step 2.2: Add Workspace type to db.ts

Modify: `src/lib/db.ts` (add after ArchitectureVisualization interface)

```typescript
export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  domain_mappings: DomainMapping[];
  analysis_ids: string[];
  manual_mappings: ManualAPIMapping[];
  created_at: string;
  updated_at: string;
}

export interface DomainMapping {
  domain: string;
  analysisId: string;
}

export interface ManualAPIMapping {
  frontendCall: string;
  backendEndpoint: string;
  backendAnalysisId: string;
}
```

**Expected:** Types added, no errors

### Step 2.3: Create workspace repository layer

Create: `src/lib/repositories/workspaces.ts`

```typescript
// ABOUTME: Repository layer for Chrome plugin workspaces (multi-repo configurations)
// ABOUTME: Handles CRUD operations for workspace entities with domain and API mappings

import { supabase } from '../db';
import type { Workspace, DomainMapping, ManualAPIMapping } from '../db';

export interface CreateWorkspaceInput {
  user_id: string;
  name: string;
  domain_mappings?: DomainMapping[];
  analysis_ids?: string[];
  manual_mappings?: ManualAPIMapping[];
}

export interface UpdateWorkspaceInput {
  name?: string;
  domain_mappings?: DomainMapping[];
  analysis_ids?: string[];
  manual_mappings?: ManualAPIMapping[];
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: input.user_id,
      name: input.name,
      domain_mappings: input.domain_mappings || [],
      analysis_ids: input.analysis_ids || [],
      manual_mappings: input.manual_mappings || [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create workspace: ${error.message}`);
  return data as Workspace;
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get workspaces: ${error.message}`);
  return data as Workspace[];
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (error) return null;
  return data as Workspace;
}

export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput
): Promise<Workspace> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.domain_mappings !== undefined) updateData.domain_mappings = input.domain_mappings;
  if (input.analysis_ids !== undefined) updateData.analysis_ids = input.analysis_ids;
  if (input.manual_mappings !== undefined) updateData.manual_mappings = input.manual_mappings;

  const { data, error } = await supabase
    .from('workspaces')
    .update(updateData)
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update workspace: ${error.message}`);
  return data as Workspace;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);

  if (error) throw new Error(`Failed to delete workspace: ${error.message}`);
}
```

**Expected:** Repository compiles, no errors

### Step 2.4: Test workspace types compile

Run: `npm run build`

**Expected:** Build succeeds with no TypeScript errors

### Step 2.5: Apply workspaces table migration

**Manual Step:** Open Supabase SQL Editor and run the migration SQL from `migrations/005_create_workspaces_table.sql`

**Expected:** Migration succeeds, workspaces table created with RLS policies

### Step 2.6: Commit workspaces table implementation

```bash
git add migrations/005_create_workspaces_table.sql
git add src/lib/db.ts src/lib/repositories/workspaces.ts
git commit -m "feat: add workspaces table for multi-repo support

- Create workspaces table with RLS policies
- Add Workspace, DomainMapping, ManualAPIMapping types
- Implement workspace repository CRUD operations
- Support domain → analysis mappings for Chrome plugin

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 3: Create Elements Database Table

**Goal:** Create database table for element-level analysis data (buttons, inputs, handlers).

**Files:**
- Create: `migrations/006_create_elements_table.sql`
- Create: `src/lib/repositories/elements.ts`
- Modify: `src/lib/db.ts` (add Element type)

### Step 3.1: Create elements table migration

Create: `migrations/006_create_elements_table.sql`

```sql
-- ABOUTME: Create elements table for element-level code analysis data
-- ABOUTME: Stores UI element details with handlers, API calls, and state updates

-- Create elements table
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE NOT NULL,
  selector VARCHAR(500),
  element_type VARCHAR(50),
  component_name VARCHAR(255),
  file_path VARCHAR(500),
  line_number INTEGER,
  handlers JSONB NOT NULL DEFAULT '[]'::jsonb,
  api_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  parent_element_id UUID REFERENCES elements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_elements_analysis_id ON elements(analysis_id);
CREATE INDEX IF NOT EXISTS idx_elements_selector ON elements(selector);
CREATE INDEX IF NOT EXISTS idx_elements_component_name ON elements(component_name);
CREATE INDEX IF NOT EXISTS idx_elements_file_path ON elements(file_path);

-- Enable Row Level Security
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view elements for their own analyses
CREATE POLICY "Users can view own analysis elements" ON elements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM analysis_results ar
      JOIN projects p ON p.id = ar.project_id
      WHERE ar.id = elements.analysis_id
      AND p.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE elements IS 'Element-level UI analysis data for Chrome plugin inspection';
COMMENT ON COLUMN elements.selector IS 'CSS/DOM selector for this element (e.g., button[data-testid="checkout"])';
COMMENT ON COLUMN elements.element_type IS 'Type of HTML element (button, input, form, div, etc.)';
COMMENT ON COLUMN elements.handlers IS 'Array of event handler objects with name, file, line';
COMMENT ON COLUMN elements.api_calls IS 'Array of API calls triggered by this element';
COMMENT ON COLUMN elements.state_updates IS 'Array of state updates performed by handlers';
```

**Expected:** Migration file created

### Step 3.2: Add Element type to db.ts

Modify: `src/lib/db.ts` (add after Workspace interfaces)

```typescript
export interface Element {
  id: string;
  analysis_id: string;
  selector: string | null;
  element_type: string | null;
  component_name: string | null;
  file_path: string | null;
  line_number: number | null;
  handlers: ElementHandler[];
  api_calls: ElementAPICall[];
  state_updates: StateUpdate[];
  parent_element_id: string | null;
  created_at: string;
}

export interface ElementHandler {
  name: string;
  file: string;
  line: number;
  code?: string;
}

export interface ElementAPICall {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface StateUpdate {
  variable: string;
  action: string;
}
```

**Expected:** Types added, no errors

### Step 3.3: Create elements repository layer

Create: `src/lib/repositories/elements.ts`

```typescript
// ABOUTME: Repository layer for element-level analysis data
// ABOUTME: Handles CRUD operations for UI elements with handlers and API calls

import { supabase } from '../db';
import type { Element, ElementHandler, ElementAPICall, StateUpdate } from '../db';

export interface CreateElementInput {
  analysis_id: string;
  selector?: string;
  element_type?: string;
  component_name?: string;
  file_path?: string;
  line_number?: number;
  handlers?: ElementHandler[];
  api_calls?: ElementAPICall[];
  state_updates?: StateUpdate[];
  parent_element_id?: string;
}

export async function createElement(input: CreateElementInput): Promise<Element> {
  const { data, error } = await supabase
    .from('elements')
    .insert({
      analysis_id: input.analysis_id,
      selector: input.selector || null,
      element_type: input.element_type || null,
      component_name: input.component_name || null,
      file_path: input.file_path || null,
      line_number: input.line_number || null,
      handlers: input.handlers || [],
      api_calls: input.api_calls || [],
      state_updates: input.state_updates || [],
      parent_element_id: input.parent_element_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create element: ${error.message}`);
  return data as Element;
}

export async function createElements(inputs: CreateElementInput[]): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .insert(
      inputs.map(input => ({
        analysis_id: input.analysis_id,
        selector: input.selector || null,
        element_type: input.element_type || null,
        component_name: input.component_name || null,
        file_path: input.file_path || null,
        line_number: input.line_number || null,
        handlers: input.handlers || [],
        api_calls: input.api_calls || [],
        state_updates: input.state_updates || [],
        parent_element_id: input.parent_element_id || null,
      }))
    )
    .select();

  if (error) throw new Error(`Failed to create elements: ${error.message}`);
  return data as Element[];
}

export async function getAnalysisElements(analysisId: string): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('file_path', { ascending: true });

  if (error) throw new Error(`Failed to get elements: ${error.message}`);
  return data as Element[];
}

export async function getElementBySelector(
  analysisId: string,
  selector: string
): Promise<Element | null> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('selector', selector)
    .single();

  if (error) return null;
  return data as Element;
}

export async function getElementsByComponent(
  analysisId: string,
  componentName: string
): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('component_name', componentName);

  if (error) throw new Error(`Failed to get elements by component: ${error.message}`);
  return data as Element[];
}

export async function deleteAnalysisElements(analysisId: string): Promise<void> {
  const { error } = await supabase.from('elements').delete().eq('analysis_id', analysisId);

  if (error) throw new Error(`Failed to delete elements: ${error.message}`);
}
```

**Expected:** Repository compiles, no errors

### Step 3.4: Test elements types compile

Run: `npm run build`

**Expected:** Build succeeds with no TypeScript errors

### Step 3.5: Apply elements table migration

**Manual Step:** Open Supabase SQL Editor and run the migration SQL from `migrations/006_create_elements_table.sql`

**Expected:** Migration succeeds, elements table created with RLS policies

### Step 3.6: Commit elements table implementation

```bash
git add migrations/006_create_elements_table.sql
git add src/lib/db.ts src/lib/repositories/elements.ts
git commit -m "feat: add elements table for element-level analysis

- Create elements table with handlers, API calls, state updates
- Add Element, ElementHandler, ElementAPICall types
- Implement elements repository with CRUD operations
- Enable element-level data for Chrome plugin inspection

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 4: Implement GET /api/plugin/workspaces Endpoint

**Goal:** Create API endpoint for Chrome plugin to fetch user's workspace configurations.

**Files:**
- Create: `src/app/api/plugin/workspaces/route.ts`
- Test: Manual testing with curl/Postman

### Step 4.1: Create plugin workspaces endpoint

Create: `src/app/api/plugin/workspaces/route.ts`

```typescript
// ABOUTME: Chrome plugin endpoint to fetch user's workspace configurations
// ABOUTME: Returns workspace list with domain mappings and associated analyses

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserWorkspaces } from '@/lib/repositories/workspaces';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspaces
    const workspaces = await getUserWorkspaces(user.id);

    // Enrich workspaces with analysis details
    const enrichedWorkspaces = await Promise.all(
      workspaces.map(async workspace => {
        const analyses = await Promise.all(
          workspace.analysis_ids.map(async analysisId => {
            const analysis = await getAnalysisById(analysisId);
            if (!analysis) return null;

            const project = await getProject(analysis.project_id);
            if (!project) return null;

            return {
              id: analysis.id,
              name: project.name,
              repoUrl: project.github_url,
              branch: analysis.branch || 'unknown',
              commit: analysis.commit_hash || 'unknown',
              analyzedAt: analysis.analyzed_at,
            };
          })
        );

        return {
          id: workspace.id,
          name: workspace.name,
          domains: workspace.domain_mappings,
          analyses: analyses.filter(a => a !== null),
          manualMappings: workspace.manual_mappings,
        };
      })
    );

    return NextResponse.json({ workspaces: enrichedWorkspaces });
  } catch (error) {
    console.error('Plugin workspaces error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, domainMappings, analysisIds, manualMappings } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { createWorkspace } = await import('@/lib/repositories/workspaces');

    const workspace = await createWorkspace({
      user_id: user.id,
      name,
      domain_mappings: domainMappings || [],
      analysis_ids: analysisIds || [],
      manual_mappings: manualMappings || [],
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
```

**Expected:** File created, no TypeScript errors

### Step 4.2: Test workspaces endpoint compiles

Run: `npm run build`

**Expected:** Build succeeds with no errors

### Step 4.3: Test GET /api/plugin/workspaces manually

Run: Start dev server if not running

```bash
npm run dev
```

**Expected:** Server starts on port 3000

### Step 4.4: Test workspaces endpoint with curl

```bash
# First login to get auth cookie
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Then call workspaces endpoint
curl -X GET http://localhost:3000/api/plugin/workspaces \
  -b cookies.txt
```

**Expected:** Returns `{"workspaces": []}` (empty array if no workspaces created yet)

### Step 4.5: Commit workspaces endpoint

```bash
git add src/app/api/plugin/workspaces/route.ts
git commit -m "feat: add GET /api/plugin/workspaces endpoint

- Fetch user's workspace configurations
- Enrich with analysis details (branch, commit, repo URL)
- Support POST to create new workspaces
- Chrome plugin uses this to load workspace configs

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 5: Implement GET /api/plugin/analysis/:id/element Endpoint

**Goal:** Create API endpoint to return element-specific analysis data with data flow tracing.

**Files:**
- Create: `src/app/api/plugin/analysis/[id]/element/route.ts`
- Test: Manual testing with curl

### Step 5.1: Create element data endpoint

Create: `src/app/api/plugin/analysis/[id]/element/route.ts`

```typescript
// ABOUTME: Chrome plugin endpoint to fetch element-specific analysis data
// ABOUTME: Returns UI element details with data flow (UI → API → Database)

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getElementBySelector, getElementsByComponent } from '@/lib/repositories/elements';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: analysisId } = await params;
    const { searchParams } = new URL(request.url);
    const selector = searchParams.get('selector');
    const component = searchParams.get('component');
    const file = searchParams.get('file');

    // Verify analysis exists and user owns it
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const project = await getProject(analysis.project_id);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find element by selector or component name
    let element = null;

    if (selector) {
      element = await getElementBySelector(analysisId, selector);
    } else if (component) {
      const elements = await getElementsByComponent(analysisId, component);
      // If multiple elements, prefer the one matching file path
      if (file) {
        element = elements.find(e => e.file_path === file) || elements[0];
      } else {
        element = elements[0];
      }
    }

    if (!element) {
      return NextResponse.json(
        {
          error: 'Element not found',
          message: 'This element is not in the current analysis. It may be new code added after analysis.',
        },
        { status: 404 }
      );
    }

    // Build data flow response
    const dataFlow = {
      ui: {
        component: element.component_name,
        file: element.file_path,
        line: element.line_number,
        handlers: element.handlers,
      },
      api:
        element.api_calls.length > 0
          ? {
              method: element.api_calls[0].method,
              path: element.api_calls[0].path,
              file: element.api_calls[0].file,
              line: element.api_calls[0].line,
              matched: false, // TODO: Implement API matching in future task
            }
          : null,
      database: null, // TODO: Extract database info from architecture in future
    };

    return NextResponse.json({
      element: {
        selector: element.selector,
        component: element.component_name,
        file: element.file_path,
        line: element.line_number,
        type: element.element_type,
      },
      dataFlow,
    });
  } catch (error) {
    console.error('Element data error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch element data' },
      { status: 500 }
    );
  }
}
```

**Expected:** File created, no TypeScript errors

### Step 5.2: Test element endpoint compiles

Run: `npm run build`

**Expected:** Build succeeds with no errors

### Step 5.3: Test element endpoint manually

```bash
# Call element endpoint (will return 404 until we have element data)
curl -X GET "http://localhost:3000/api/plugin/analysis/ANALYSIS_ID/element?component=CheckoutButton" \
  -b cookies.txt
```

**Expected:** Returns 404 with message about element not found (expected, no element data yet)

### Step 5.4: Commit element endpoint

```bash
git add src/app/api/plugin/analysis/[id]/element/route.ts
git commit -m "feat: add GET /api/plugin/analysis/:id/element endpoint

- Fetch element-specific analysis data by selector or component
- Return data flow structure (UI → API → Database)
- Handle missing elements gracefully with helpful error
- Chrome plugin uses this for element inspection

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 6: Implement POST /api/plugin/chat Endpoint

**Goal:** Create chat endpoint with element context support for Chrome plugin.

**Files:**
- Create: `src/app/api/plugin/chat/route.ts`
- Modify: `src/lib/services/chat.ts` (add element context support)

### Step 6.1: Extend chat service to accept element context

Modify: `src/lib/services/chat.ts` (update function signature and system prompt)

Add new interface at top of file:

```typescript
export interface ElementContext {
  component?: string;
  file?: string;
  line?: number;
  selector?: string;
}
```

Modify chat function signature (line ~97):

```typescript
export async function chat(
  projectId: string,
  analysisId: string,
  message: string,
  elementContext?: ElementContext  // NEW parameter
): Promise<ChatResponse> {
```

Modify system prompt to include element context (around line ~170):

```typescript
  // Build system prompt
  const elementContextText = elementContext
    ? `\n\nCurrent Element Context:\nComponent: ${elementContext.component || 'unknown'}\nFile: ${elementContext.file || 'unknown'}\nLine: ${elementContext.line || 'unknown'}\nSelector: ${elementContext.selector || 'unknown'}\n\nThe user is inspecting this specific element. Prioritize information about this element in your response.`
    : '';

  const systemPrompt = `You are a helpful assistant for developers onboarding to a codebase.

Analysis Summary:
${context.summary}

Architecture Components:
${context.architecture.nodes.map(n => `- ${n.name} (${n.type}): ${n.description}`).join('\n')}

${elementContextText}

${responseType === 'quick'
  ? 'Provide a concise, direct answer. Be specific about file names and locations.'
  : 'Provide a thorough explanation. If the question involves implementation, suggest they explore specific areas but note this is for understanding, not direct coding assistance.'}

${codeContext}`;
```

**Expected:** Chat service updated, no TypeScript errors

### Step 6.2: Create plugin chat endpoint

Create: `src/app/api/plugin/chat/route.ts`

```typescript
// ABOUTME: Chrome plugin chat endpoint with element context support
// ABOUTME: Enables contextual questions about specific UI elements

import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/services/chat';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

const PluginChatSchema = z.object({
  analysisId: z.string().min(1),
  message: z.string().min(1).max(2000),
  elementContext: z
    .object({
      component: z.string().optional(),
      file: z.string().optional(),
      line: z.number().optional(),
      selector: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = PluginChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { analysisId, message, elementContext } = parsed.data;

    // Verify analysis exists and user owns it
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const project = await getProject(analysis.project_id);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Call chat service with element context
    const response = await chat(project.id, analysisId, message, elementContext);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Plugin chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}
```

**Expected:** File created, no TypeScript errors

### Step 6.3: Test plugin chat endpoint compiles

Run: `npm run build`

**Expected:** Build succeeds with no errors

### Step 6.4: Test plugin chat endpoint manually

```bash
# Test chat with element context
curl -X POST http://localhost:3000/api/plugin/chat \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "analysisId": "ANALYSIS_ID",
    "message": "What does this button do?",
    "elementContext": {
      "component": "CheckoutButton",
      "file": "src/components/CheckoutButton.tsx",
      "line": 45
    }
  }'
```

**Expected:** Returns chat response with element context considered

### Step 6.5: Commit plugin chat endpoint

```bash
git add src/app/api/plugin/chat/route.ts src/lib/services/chat.ts
git commit -m "feat: add POST /api/plugin/chat with element context

- Extend chat service to accept element context
- Create plugin-specific chat endpoint
- Prioritize element-focused responses in system prompt
- Chrome plugin uses this for contextual questions

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 7: Update Migration README

**Goal:** Document new migrations in migrations/README.md for tracking.

**Files:**
- Modify: `migrations/README.md`

### Step 7.1: Add new migrations to README

Modify: `migrations/README.md` (add after add-email-verification entry)

```markdown
### 004_add_git_metadata_to_analysis.sql
**Status:** Pending manual execution
**Description:** Git metadata tracking for analysis results:
- Adds `branch`, `commit_hash`, `commit_url` columns to analysis_results
- Enables Chrome plugin to display "Analysis: main@abc123"
- Links to GitHub commit for transparency

**Note:** Existing analyses will have NULL values for new columns.

### 005_create_workspaces_table.sql
**Status:** Pending manual execution
**Description:** Workspaces table for Chrome plugin multi-repo support:
- Creates workspaces table with RLS policies
- Stores domain mappings (localhost:3000 → analysis-id)
- Supports manual API endpoint mappings
- Links multiple analyses into one workspace

**Note:** Workspaces are Chrome-plugin specific, website doesn't use them.

### 006_create_elements_table.sql
**Status:** Pending manual execution
**Description:** Elements table for element-level code analysis:
- Creates elements table with handlers, API calls, state updates
- Enables element-level inspection (button, input, form level)
- Stores selectors, component names, line numbers
- Foreign key to analysis_results with cascade delete

**Note:** Element data populated by future AST parsing enhancement.
```

Update migration history table:

```markdown
| Number | Name | Applied Date | Applied By | Status |
|--------|------|-------------|------------|--------|
| 001 | initial_setup | 2024-11-XX | System | Applied |
| 002 | northwestern_features | 2024-12-13 | System | Applied |
| 003 | feedback_table | 2025-12-16 | Pending | Pending |
| - | add-email-verification | 2025-12-17 | Pending | Pending |
| 004 | add_git_metadata_to_analysis | 2025-12-17 | Pending | Pending |
| 005 | create_workspaces_table | 2025-12-17 | Pending | Pending |
| 006 | create_elements_table | 2025-12-17 | Pending | Pending |
```

**Expected:** README updated with new migrations

### Step 7.2: Commit README update

```bash
git add migrations/README.md
git commit -m "docs: document new Chrome plugin migrations

- Add git metadata migration (004)
- Add workspaces table migration (005)
- Add elements table migration (006)
- Update migration history table

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Task 8: Create API Documentation for Chrome Extension Developer

**Goal:** Generate comprehensive API documentation for colleague building Chrome extension.

**Files:**
- Create: `docs/api/chrome-plugin-api.md`

### Step 8.1: Create API documentation

Create: `docs/api/chrome-plugin-api.md`

```markdown
# Chrome Plugin Backend API Documentation

**Version:** 1.0.0
**Base URL:** `https://yourdomain.com` (or `http://localhost:3000` for development)
**Authentication:** JWT tokens via httpOnly cookies

---

## Overview

This document describes the backend APIs available to the Chrome extension for Code Vision. All endpoints require authentication via JWT tokens obtained through the login flow.

## Authentication

### How Chrome Extension Gets Authenticated

The Chrome extension shares authentication with the main website. Users must log in via the website first, then the extension can access their session.

**Authentication Flow:**

1. User logs in on website: `POST /api/auth/login`
2. Server sets httpOnly cookie with JWT token
3. Extension makes API calls with credentials included
4. Server validates JWT from cookie

**Important:** All Chrome extension API calls must include credentials:

```javascript
fetch('https://yourdomain.com/api/plugin/workspaces', {
  method: 'GET',
  credentials: 'include', // CRITICAL: Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**
- `401 Unauthorized` - No valid JWT token, user needs to log in
- `403 Forbidden` - User doesn't own the requested resource
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Server error, check logs

---

## Endpoints

### GET /api/plugin/workspaces

**Purpose:** Fetch user's workspace configurations with domain mappings and associated analyses.

**Authentication:** Required (JWT via cookie)

**Request:**
```http
GET /api/plugin/workspaces HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
```

**Response (200 OK):**
```json
{
  "workspaces": [
    {
      "id": "workspace-uuid",
      "name": "E-commerce Platform",
      "domains": [
        { "domain": "localhost:3000", "analysisId": "analysis-abc" },
        { "domain": "admin.localhost:3000", "analysisId": "analysis-def" }
      ],
      "analyses": [
        {
          "id": "analysis-abc",
          "name": "storefront-web",
          "repoUrl": "https://github.com/acme/storefront",
          "branch": "main",
          "commit": "abc123f",
          "analyzedAt": "2025-12-15T10:00:00Z"
        },
        {
          "id": "analysis-def",
          "name": "api-backend",
          "repoUrl": "https://github.com/acme/api",
          "branch": "main",
          "commit": "def456g",
          "analyzedAt": "2025-12-14T15:00:00Z"
        }
      ],
      "manualMappings": [
        {
          "frontendCall": "POST /api/checkout",
          "backendEndpoint": "POST /orders",
          "backendAnalysisId": "analysis-def"
        }
      ]
    }
  ]
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Usage Example (Chrome Extension):**
```javascript
async function loadWorkspaces() {
  const response = await fetch('https://yourdomain.com/api/plugin/workspaces', {
    credentials: 'include',
  });

  if (response.status === 401) {
    // User needs to log in on website first
    showLoginPrompt();
    return;
  }

  const data = await response.json();
  return data.workspaces;
}
```

---

### POST /api/plugin/workspaces

**Purpose:** Create a new workspace configuration.

**Authentication:** Required (JWT via cookie)

**Request:**
```http
POST /api/plugin/workspaces HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "name": "My New Workspace",
  "domainMappings": [
    { "domain": "localhost:3000", "analysisId": "analysis-xyz" }
  ],
  "analysisIds": ["analysis-xyz"],
  "manualMappings": []
}
```

**Response (201 Created):**
```json
{
  "workspace": {
    "id": "new-workspace-uuid",
    "name": "My New Workspace",
    "domain_mappings": [
      { "domain": "localhost:3000", "analysisId": "analysis-xyz" }
    ],
    "analysis_ids": ["analysis-xyz"],
    "manual_mappings": [],
    "created_at": "2025-12-17T10:00:00Z",
    "updated_at": "2025-12-17T10:00:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "name is required"
}
```

---

### GET /api/plugin/analysis/:id/element

**Purpose:** Fetch element-specific analysis data with data flow tracing.

**Authentication:** Required (JWT via cookie)

**Query Parameters:**
- `selector` (optional) - CSS selector for the element (e.g., `button[data-testid="checkout"]`)
- `component` (optional) - Component name (e.g., `CheckoutButton`)
- `file` (optional) - File path to disambiguate when multiple components match

**Request:**
```http
GET /api/plugin/analysis/abc123/element?component=CheckoutButton&file=src/components/CheckoutButton.tsx HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
```

**Response (200 OK):**
```json
{
  "element": {
    "selector": "button[data-testid='checkout-btn']",
    "component": "CheckoutButton",
    "file": "src/components/CheckoutButton.tsx",
    "line": 45,
    "type": "button"
  },
  "dataFlow": {
    "ui": {
      "component": "CheckoutButton",
      "file": "src/components/CheckoutButton.tsx",
      "line": 45,
      "handlers": [
        {
          "name": "handleCheckout",
          "file": "src/components/CheckoutButton.tsx",
          "line": 12
        }
      ]
    },
    "api": {
      "method": "POST",
      "path": "/api/orders",
      "file": "src/components/CheckoutButton.tsx",
      "line": 18,
      "matched": false
    },
    "database": null
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Element not found",
  "message": "This element is not in the current analysis. It may be new code added after analysis."
}
```

**Usage Example (Chrome Extension):**
```javascript
async function inspectElement(analysisId, componentName, filePath) {
  const url = new URL(`https://yourdomain.com/api/plugin/analysis/${analysisId}/element`);
  url.searchParams.set('component', componentName);
  url.searchParams.set('file', filePath);

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (response.status === 404) {
    const data = await response.json();
    // Show user-friendly "element not found" message
    showElementNotFound(data.message);
    return null;
  }

  return await response.json();
}
```

---

### POST /api/plugin/chat

**Purpose:** Chat with AI assistant about codebase with optional element context.

**Authentication:** Required (JWT via cookie)

**Request:**
```http
POST /api/plugin/chat HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "analysisId": "analysis-abc",
  "message": "Where is email validation for this form?",
  "elementContext": {
    "component": "SignupForm",
    "file": "src/components/SignupForm.tsx",
    "line": 34,
    "selector": "form#signup"
  }
}
```

**Request Fields:**
- `analysisId` (required) - Analysis UUID to chat about
- `message` (required) - User's question (max 2000 characters)
- `elementContext` (optional) - Element being inspected
  - `component` (optional) - Component name
  - `file` (optional) - File path
  - `line` (optional) - Line number
  - `selector` (optional) - CSS selector

**Response (200 OK):**
```json
{
  "id": "response-uuid",
  "content": "Email validation happens in two places:\n1. Frontend: src/validators/email.ts:12 (basic format check)\n2. Backend: src/controllers/users.ts:45 (uniqueness check against database)",
  "responseType": "quick",
  "timestamp": "2025-12-17T10:05:00Z"
}
```

**Response Fields:**
- `id` - Unique response ID
- `content` - AI assistant's response message
- `responseType` - `"quick"` or `"detailed"` based on question type
- `timestamp` - ISO 8601 timestamp

**Usage Example (Chrome Extension):**
```javascript
async function askQuestion(analysisId, question, elementContext = null) {
  const response = await fetch('https://yourdomain.com/api/plugin/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      analysisId,
      message: question,
      elementContext,
    }),
  });

  if (!response.ok) {
    throw new Error('Chat request failed');
  }

  return await response.json();
}

// Usage with element context
const result = await askQuestion(
  'analysis-abc',
  'What does this button do?',
  {
    component: 'CheckoutButton',
    file: 'src/components/CheckoutButton.tsx',
    line: 45
  }
);

console.log(result.content); // AI's answer
```

---

## Rate Limiting

Currently no rate limiting is implemented. Future versions may add:
- Max 60 requests per minute per user
- Max 10 chat messages per minute per user

## CORS Configuration

API endpoints are configured for same-origin requests only. Chrome extension must:
1. Use `credentials: 'include'` in all fetch calls
2. Make requests from extension background script (not content script)
3. Request host permissions for the API domain in manifest.json

**Extension Manifest (manifest.json):**
```json
{
  "host_permissions": [
    "https://yourdomain.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Testing Endpoints

**Development Server:**
```bash
# Start development server
npm run dev

# Server runs on http://localhost:3000
```

**Test Authentication:**
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Test workspaces endpoint
curl -X GET http://localhost:3000/api/plugin/workspaces \
  -b cookies.txt
```

## Error Handling Best Practices

**1. Handle 401 (Unauthorized):**
```javascript
if (response.status === 401) {
  // User session expired or not logged in
  chrome.tabs.create({ url: 'https://yourdomain.com/login' });
  return;
}
```

**2. Handle 404 (Not Found):**
```javascript
if (response.status === 404) {
  const data = await response.json();
  // Show helpful message to user
  showNotification(data.message || 'Resource not found');
  return;
}
```

**3. Handle 500 (Server Error):**
```javascript
if (response.status === 500) {
  // Server error, retry with exponential backoff
  await retryWithBackoff(() => fetch(url, options));
}
```

## Support

For issues or questions:
- Check server logs for error details
- Verify authentication tokens are valid
- Ensure database migrations have been applied
- Contact backend team with reproduction steps

---

**Last Updated:** 2025-12-17
**API Version:** 1.0.0
```

**Expected:** Comprehensive API documentation created

### Step 8.2: Commit API documentation

```bash
git add docs/api/chrome-plugin-api.md
git commit -m "docs: add Chrome plugin API documentation

- Document all plugin endpoints with examples
- Include authentication flow for Chrome extension
- Provide error handling best practices
- Add testing instructions and CORS configuration
- Ready for handoff to Chrome extension developer

🤖 Generated with Claude Code
Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

**Expected:** Commit succeeds

---

## Future Enhancements (Not in This Plan)

These tasks are identified but deferred for future work:

1. **AST Parsing Service** - Element extraction from JSX/TSX files
   - Requires @babel/parser integration
   - Complex implementation (~2-3 days)
   - Blocks element data population

2. **Smart API Matching Algorithm** - Cross-repo endpoint matching
   - Exact, normalized, fuzzy matching strategies
   - Confidence scoring
   - Requires both frontend and backend analyses

3. **API Mappings Table** - Store endpoint matches
   - Links frontend API calls to backend implementations
   - Supports manual overrides

4. **Database Schema Extraction** - Parse DB queries to table mappings
   - Extract from ORMs, raw SQL, query builders
   - Complex analysis, lower priority for MVP

These enhancements will be planned separately after Chrome plugin MVP is validated.

---

## Summary

**What We Built:**
- ✅ Git metadata tracking (branch, commit, commit_url)
- ✅ Workspaces table (multi-repo support)
- ✅ Elements table (element-level data structure)
- ✅ GET /api/plugin/workspaces endpoint
- ✅ GET /api/plugin/analysis/:id/element endpoint
- ✅ POST /api/plugin/chat endpoint (with element context)
- ✅ Comprehensive API documentation

**What's Not Yet Implemented:**
- ⏳ AST parsing to populate elements table
- ⏳ Smart API matching algorithm
- ⏳ API mappings table
- ⏳ Database schema extraction

**Database Migrations to Apply Manually:**
1. `migrations/004_add_git_metadata_to_analysis.sql`
2. `migrations/005_create_workspaces_table.sql`
3. `migrations/006_create_elements_table.sql`

**Ready for Chrome Extension Developer:**
- All required API endpoints are live
- Authentication flow documented
- Error handling patterns provided
- Testing instructions included

**Next Steps:**
1. Apply database migrations in Supabase
2. Test endpoints with curl/Postman
3. Hand off API documentation to Chrome extension developer
4. Plan AST parsing enhancement for element data population
