# Supabase Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate Code Vision from SQLite to Supabase PostgreSQL to enable deployment on Vercel.

**Architecture:** Replace better-sqlite3 with @supabase/supabase-js, migrate all repository functions to async, move file uploads to Supabase Storage, and change repo cloning to /tmp for serverless compatibility.

**Tech Stack:** Supabase (PostgreSQL + Storage), @supabase/supabase-js, Next.js 14, TypeScript

---

## Prerequisites

Before starting, ensure you have:
1. Created a Supabase project at https://supabase.com
2. Obtained the Project URL and Service Role Key from Settings → API
3. Created a `documents` storage bucket in Supabase Dashboard (set to private)

---

### Task 1: Install Dependencies and Configure Environment

**Files:**
- Modify: `package.json`
- Create: `.env.local` (if not exists)
- Modify: `.env.example`

**Step 1: Install Supabase client**

Run:
```bash
npm install @supabase/supabase-js
```

Expected: Package installed successfully

**Step 2: Uninstall SQLite**

Run:
```bash
npm uninstall better-sqlite3
```

Expected: Package removed successfully

**Step 3: Add environment variables to .env.local**

Add these lines (replace with your actual values):
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ANON_KEY=eyJxxx...
```

**Step 4: Update .env.example**

Add to `.env.example`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
ALLOWED_EMAIL_DOMAINS=northwestern.edu
JWT_SECRET=change-this-to-a-random-secret
ANTHROPIC_API_KEY=your-anthropic-key
```

**Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: install Supabase client and configure environment"
```

---

### Task 2: Set Up PostgreSQL Schema in Supabase

**Files:**
- Reference: `docs/plans/2025-11-21-supabase-migration-design.md` (Section 2)

**Step 1: Run schema in Supabase SQL Editor**

1. Go to Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Paste the following schema:

```sql
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT NOT NULL,
  github_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analysis results table
CREATE TABLE IF NOT EXISTS analysis_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  findings JSONB NOT NULL,
  architecture JSONB NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  chat_history JSONB NOT NULL DEFAULT '[]',
  raw_response TEXT NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_results(project_id);
```

4. Click "Run"

Expected: Success message "Success. No rows returned"

**Step 2: Verify tables created**

In SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

Expected: Should see users, projects, documents, analysis_results

**Step 3: No commit needed** (database setup only)

---

### Task 3: Replace Database Client (src/lib/db.ts)

**Files:**
- Modify: `src/lib/db.ts`

**Step 1: Read current db.ts**

Review the file to understand current exports.

**Step 2: Replace entire file with Supabase client**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use service role key for server-side operations (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Export types (unchanged)
export type ProjectStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType: 'quick' | 'detailed';
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  github_url: string;
  github_token: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  file_type: 'pdf' | 'markdown' | 'text' | 'image';
  file_path: string;
  uploaded_at: string;
}

export interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  chat_history: ChatMessage[];
  raw_response: string;
  analyzed_at: string;
}

export interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

export interface ArchitectureNode {
  id: string;
  name: string;
  type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
  complexity: 'low' | 'medium' | 'high';
  description: string;
  files: string[];
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
}

export interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}
```

**Step 3: Verify file compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors (may have errors from other files not yet migrated)

**Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "refactor: replace SQLite with Supabase client"
```

---

### Task 4: Migrate Users Repository

**Files:**
- Modify: `src/lib/repositories/users.ts`

**Step 1: Read current users.ts**

Review current implementation to understand all functions.

**Step 2: Replace with async Supabase implementation**

```typescript
import { supabase } from '../db';
import type { User } from '../db';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  email: string;
  password: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const password_hash = await bcrypt.hash(input.password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert({
      email: input.email.toLowerCase(),
      password_hash,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create user: ${error.message}`);
  return data as User;
}

export async function getUserById(id: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as User;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) return null;
  return data as User;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
```

**Step 3: Verify file compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: May have errors from API routes not yet updated (ignore for now)

**Step 4: Commit**

```bash
git add src/lib/repositories/users.ts
git commit -m "refactor: migrate users repository to async Supabase"
```

---

### Task 5: Migrate Projects Repository

**Files:**
- Modify: `src/lib/repositories/projects.ts`

**Step 1: Read current projects.ts**

Review all functions that need migration.

**Step 2: Replace with async Supabase implementation**

```typescript
import { supabase } from '../db';
import type { Project, ProjectStatus } from '../db';

export interface CreateProjectInput {
  user_id: string;
  name: string;
  description?: string;
  github_url: string;
  github_token: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: input.user_id,
      name: input.name,
      description: input.description || null,
      github_url: input.github_url,
      github_token: input.github_token,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return data as Project;
}

export async function getProject(id: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Project;
}

export async function getProjectsByUser(userId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get projects: ${error.message}`);
  return data as Project[];
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const updates: any = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.status !== undefined) updates.status = input.status;

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update project: ${error.message}`);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete project: ${error.message}`);
}
```

**Step 3: Commit**

```bash
git add src/lib/repositories/projects.ts
git commit -m "refactor: migrate projects repository to async Supabase"
```

---

### Task 6: Migrate Documents Repository

**Files:**
- Modify: `src/lib/repositories/documents.ts`

**Step 1: Read current documents.ts**

Review all functions.

**Step 2: Replace with async Supabase implementation**

```typescript
import { supabase } from '../db';
import type { Document } from '../db';

export interface CreateDocumentInput {
  project_id: string;
  filename: string;
  file_type: 'pdf' | 'markdown' | 'text' | 'image';
  file_path: string;
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: input.project_id,
      filename: input.filename,
      file_type: input.file_type,
      file_path: input.file_path,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create document: ${error.message}`);
  return data as Document;
}

export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Document;
}

export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(`Failed to get documents: ${error.message}`);
  return data as Document[];
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}
```

**Step 3: Commit**

```bash
git add src/lib/repositories/documents.ts
git commit -m "refactor: migrate documents repository to async Supabase"
```

---

### Task 7: Migrate Analysis Repository

**Files:**
- Modify: `src/lib/repositories/analysis.ts`

**Step 1: Read current analysis.ts**

Review all functions, especially JSONB field handling.

**Step 2: Replace with async Supabase implementation**

```typescript
import { supabase } from '../db';
import type { AnalysisResult, Finding, ArchitectureVisualization, ChatMessage } from '../db';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
}

export async function createAnalysis(input: CreateAnalysisInput): Promise<AnalysisResult> {
  const { data, error } = await supabase
    .from('analysis_results')
    .insert({
      project_id: input.project_id,
      summary: input.summary,
      findings: input.findings, // JSONB - no stringify needed
      architecture: input.architecture, // JSONB - no stringify needed
      chat_history: [], // JSONB - no stringify needed
      raw_response: input.raw_response,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create analysis: ${error.message}`);
  return data as AnalysisResult;
}

export async function getLatestAnalysis(projectId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('project_id', projectId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as AnalysisResult;
}

export async function getAllAnalyses(projectId: string): Promise<AnalysisResult[]> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('project_id', projectId)
    .order('analyzed_at', { ascending: false });

  if (error) throw new Error(`Failed to get analyses: ${error.message}`);
  return data as AnalysisResult[];
}

export async function updateChatHistory(
  analysisId: string,
  chatHistory: ChatMessage[]
): Promise<void> {
  const { error } = await supabase
    .from('analysis_results')
    .update({ chat_history: chatHistory }) // JSONB - no stringify needed
    .eq('id', analysisId);

  if (error) throw new Error(`Failed to update chat history: ${error.message}`);
}
```

**Step 3: Commit**

```bash
git add src/lib/repositories/analysis.ts
git commit -m "refactor: migrate analysis repository to async Supabase with JSONB"
```

---

### Task 8: Update Auth API Routes

**Files:**
- Modify: `src/app/api/auth/signup/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/me/route.ts`
- Modify: `src/app/api/auth/logout/route.ts`

**Step 1: Update signup route**

In `src/app/api/auth/signup/route.ts`, add `await` to async calls:

```typescript
// Find this line:
const existingUser = getUserByEmail(email);

// Replace with:
const existingUser = await getUserByEmail(email);

// Find this line:
const user = createUser({ email, password });

// Replace with:
const user = await createUser({ email, password });
```

**Step 2: Update login route**

In `src/app/api/auth/login/route.ts`, add `await`:

```typescript
// Find:
const user = getUserByEmail(email);

// Replace:
const user = await getUserByEmail(email);

// Find:
const isValid = verifyPassword(password, user.password_hash);

// Replace:
const isValid = await verifyPassword(password, user.password_hash);
```

**Step 3: Update me route**

In `src/app/api/auth/me/route.ts`, add `await`:

```typescript
// Find:
const user = getUserById(payload.userId);

// Replace:
const user = await getUserById(payload.userId);
```

**Step 4: Verify routes compile**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors in auth routes

**Step 5: Commit**

```bash
git add src/app/api/auth/
git commit -m "refactor: update auth routes to await async repository calls"
```

---

### Task 9: Update Projects API Routes

**Files:**
- Modify: `src/app/api/projects/route.ts`
- Modify: `src/app/api/projects/[id]/route.ts`

**Step 1: Update projects list route (GET)**

In `src/app/api/projects/route.ts` GET handler:

```typescript
// Find:
const projects = getProjectsByUser(user.id);

// Replace:
const projects = await getProjectsByUser(user.id);
```

**Step 2: Update projects create route (POST)**

In `src/app/api/projects/route.ts` POST handler:

```typescript
// Find:
const project = createProject({

// Replace:
const project = await createProject({
```

**Step 3: Update single project route (GET)**

In `src/app/api/projects/[id]/route.ts` GET handler:

```typescript
// Find:
const project = getProject(params.id);

// Replace:
const project = await getProject(params.id);
```

**Step 4: Update project update route (PATCH)**

In `src/app/api/projects/[id]/route.ts` PATCH handler:

```typescript
// Find all instances of getProject and updateProject:
const project = getProject(params.id);
// Replace:
const project = await getProject(params.id);

// Find:
const updated = updateProject(params.id, updates);
// Replace:
const updated = await updateProject(params.id, updates);
```

**Step 5: Update project delete route (DELETE)**

In `src/app/api/projects/[id]/route.ts` DELETE handler:

```typescript
// Find:
const project = getProject(params.id);
// Replace:
const project = await getProject(params.id);

// Find:
deleteProject(params.id);
// Replace:
await deleteProject(params.id);
```

**Step 6: Commit**

```bash
git add src/app/api/projects/
git commit -m "refactor: update projects routes to await async calls"
```

---

### Task 10: Update Documents API Routes with Supabase Storage

**Files:**
- Modify: `src/app/api/documents/route.ts`
- Modify: `src/app/api/documents/[id]/route.ts`

**Step 1: Update documents list route (GET)**

In `src/app/api/documents/route.ts` GET handler:

```typescript
// Find:
const project = getProject(projectId);
const documents = getDocumentsByProject(projectId);

// Replace:
const project = await getProject(projectId);
const documents = await getDocumentsByProject(projectId);
```

**Step 2: Update document upload route (POST)**

In `src/app/api/documents/route.ts` POST handler, replace file upload logic:

```typescript
import { supabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Inside POST handler, find the file upload section
// Replace filesystem write with Supabase Storage:

// After: const buffer = Buffer.from(await file.arrayBuffer());

// Remove old filesystem logic:
// const uploadDir = path.join(process.cwd(), 'data', 'uploads');
// fs.mkdirSync(uploadDir, { recursive: true });
// const filePath = path.join(uploadDir, `${projectId}-${file.name}`);
// fs.writeFileSync(filePath, buffer);

// Add new Supabase Storage logic:
const filePath = `${projectId}/${uuidv4()}-${file.name}`;

const { error: uploadError } = await supabase.storage
  .from('documents')
  .upload(filePath, buffer, {
    contentType: file.type,
    upsert: false
  });

if (uploadError) {
  return NextResponse.json(
    { error: `Failed to upload file: ${uploadError.message}` },
    { status: 500 }
  );
}

// Update createDocument call to use new filePath
const document = await createDocument({
  project_id: projectId,
  filename: file.name,
  file_type: fileType,
  file_path: filePath, // This now points to Supabase Storage
});
```

**Step 3: Update document delete route (DELETE)**

In `src/app/api/documents/[id]/route.ts` DELETE handler:

```typescript
import { supabase } from '@/lib/db';

// Find:
const document = getDocument(params.id);
const project = getProject(document.project_id);

// Replace:
const document = await getDocument(params.id);
if (!document) {
  return NextResponse.json({ error: 'Document not found' }, { status: 404 });
}

const project = await getProject(document.project_id);

// After ownership check, replace filesystem delete with Supabase Storage:

// Remove old logic:
// if (fs.existsSync(document.file_path)) {
//   fs.unlinkSync(document.file_path);
// }

// Add new logic:
const { error: deleteError } = await supabase.storage
  .from('documents')
  .remove([document.file_path]);

if (deleteError) {
  console.error('Failed to delete file from storage:', deleteError);
  // Continue anyway to delete database record
}

// Keep database deletion:
await deleteDocument(params.id);
```

**Step 4: Commit**

```bash
git add src/app/api/documents/
git commit -m "refactor: migrate document routes to Supabase Storage"
```

---

### Task 11: Update Analysis API Routes

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/analysis/[projectId]/route.ts`
- Modify: `src/app/api/analysis/versions/[projectId]/route.ts`

**Step 1: Update analyze route**

In `src/app/api/analyze/route.ts`:

```typescript
// Find all repository calls and add await:
const project = getProject(projectId);
// Replace:
const project = await getProject(projectId);

// Similar pattern for other calls
```

**Step 2: Update analysis GET route**

In `src/app/api/analysis/[projectId]/route.ts`:

```typescript
// Find:
const project = getProject(params.projectId);
const analysis = getLatestAnalysis(params.projectId);

// Replace:
const project = await getProject(params.projectId);
const analysis = await getLatestAnalysis(params.projectId);
```

**Step 3: Update analysis versions route**

In `src/app/api/analysis/versions/[projectId]/route.ts`:

```typescript
// Find:
const project = getProject(params.projectId);
const analyses = getAllAnalyses(params.projectId);

// Replace:
const project = await getProject(params.projectId);
const analyses = await getAllAnalyses(params.projectId);
```

**Step 4: Commit**

```bash
git add src/app/api/analyze/ src/app/api/analysis/
git commit -m "refactor: update analysis routes to await async calls"
```

---

### Task 12: Update Chat API Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Step 1: Add await to all repository calls**

In `src/app/api/chat/route.ts`:

```typescript
// Find all instances of:
const project = getProject(projectId);
const analysis = getLatestAnalysis(projectId);
updateChatHistory(analysis.id, updatedHistory);

// Replace with:
const project = await getProject(projectId);
const analysis = await getLatestAnalysis(projectId);
await updateChatHistory(analysis.id, updatedHistory);
```

**Step 2: Commit**

```bash
git add src/app/api/chat/
git commit -m "refactor: update chat route to await async calls"
```

---

### Task 13: Update File Parser Service

**Files:**
- Modify: `src/lib/services/file-parser.ts`

**Step 1: Read current file-parser.ts**

Review how it reads files from filesystem.

**Step 2: Add Supabase Storage download**

Replace filesystem reads with Supabase Storage downloads:

```typescript
import { supabase } from '../db';

// Find the function that reads files (likely parseDocument or similar)
// Replace filesystem read logic with:

export async function parseDocument(filePath: string): Promise<string> {
  // Download from Supabase Storage
  const { data, error } = await supabase.storage
    .from('documents')
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download document: ${error.message}`);
  }

  // Convert blob to buffer
  const buffer = Buffer.from(await data.arrayBuffer());

  // Rest of parsing logic remains the same
  // (PDF parsing, text extraction, etc.)

  // ... existing parsing code ...
}
```

**Step 3: Commit**

```bash
git add src/lib/services/file-parser.ts
git commit -m "refactor: update file parser to download from Supabase Storage"
```

---

### Task 14: Update Analyzer Service

**Files:**
- Modify: `src/lib/services/analyzer.ts`

**Step 1: Remove repo_path updates**

Find and remove any calls to `updateProjectRepoPath` (this function no longer exists).

**Step 2: Add await to repository calls**

```typescript
// Find:
const documents = getDocumentsByProject(projectId);
const analysis = createAnalysis({

// Replace:
const documents = await getDocumentsByProject(projectId);
const analysis = await createAnalysis({
```

**Step 3: Update document retrieval**

If analyzer reads document files, ensure it uses the file-parser service (which now downloads from Supabase Storage).

**Step 4: Commit**

```bash
git add src/lib/services/analyzer.ts
git commit -m "refactor: update analyzer to remove repo_path and await async calls"
```

---

### Task 15: Update GitHub Service for /tmp Cloning

**Files:**
- Modify: `src/lib/services/github.ts`

**Step 1: Change REPOS_DIR to /tmp**

```typescript
// Find:
const REPOS_DIR = path.join(process.cwd(), 'data', 'repos');

// Replace:
const REPOS_DIR = '/tmp/repos';
```

**Step 2: Update cloneRepository function**

Ensure it creates /tmp/repos if not exists and cleans up before cloning:

```typescript
export async function cloneRepository(
  repoUrl: string,
  token: string,
  projectId: string
): Promise<CloneResult> {
  // Ensure /tmp/repos exists
  if (!fs.existsSync(REPOS_DIR)) {
    fs.mkdirSync(REPOS_DIR, { recursive: true });
  }

  const clonePath = path.join(REPOS_DIR, projectId);

  // Clean up existing clone if present
  if (fs.existsSync(clonePath)) {
    fs.rmSync(clonePath, { recursive: true, force: true });
  }

  try {
    let cloneUrl: string;
    if (token) {
      const urlObj = new URL(repoUrl);
      cloneUrl = `https://${token}@${urlObj.host}${urlObj.pathname}`;
    } else {
      cloneUrl = repoUrl;
    }

    const git: SimpleGit = simpleGit();
    await git.clone(cloneUrl, clonePath, ['--depth=1', '--single-branch']);

    return { success: true, path: clonePath };
  } catch (error) {
    if (fs.existsSync(clonePath)) {
      fs.rmSync(clonePath, { recursive: true, force: true });
    }
    return { success: false, error: `Failed to clone repository: ${error}` };
  }
}

export function getProjectRepoPath(projectId: string): string {
  return path.join(REPOS_DIR, projectId);
}
```

**Step 3: Remove cleanup function if it exists**

Remove `cleanupProjectRepo` or similar functions - /tmp is auto-cleaned by Vercel.

**Step 4: Commit**

```bash
git add src/lib/services/github.ts
git commit -m "refactor: change repo cloning to /tmp for serverless compatibility"
```

---

### Task 16: Update Chat Service for On-Demand Cloning

**Files:**
- Modify: `src/lib/services/chat.ts`

**Step 1: Add repo existence check**

Before searching code, check if repo exists and clone if needed:

```typescript
import { getProjectRepoPath } from './github';
import { cloneRepository } from './github';
import { getProject } from '../repositories/projects';
import fs from 'fs';

// Inside the chat processing function, before code search:
const repoPath = getProjectRepoPath(projectId);

if (!fs.existsSync(repoPath)) {
  // Clone if not present
  const project = await getProject(projectId);
  if (project) {
    const cloneResult = await cloneRepository(
      project.github_url,
      project.github_token,
      projectId
    );

    if (!cloneResult.success) {
      // Proceed without code context if clone fails
      console.warn('Failed to clone repository for chat context:', cloneResult.error);
      // Set codeContext to empty or skip code search
    }
  }
}

// Continue with existing code search logic
```

**Step 2: Ensure getProject is awaited**

Make sure all repository calls are awaited.

**Step 3: Commit**

```bash
git add src/lib/services/chat.ts
git commit -m "refactor: add on-demand repo cloning for chat service"
```

---

### Task 17: Remove JSON Parsing for JSONB Fields

**Files:**
- Modify: `src/app/api/analysis/[projectId]/route.ts`
- Modify: `src/app/api/analysis/versions/[projectId]/route.ts`
- Modify: Any other files that use `JSON.parse()` on findings, architecture, or chat_history

**Step 1: Find JSON.parse calls**

Search for:
```bash
grep -r "JSON.parse.*findings" src/
grep -r "JSON.parse.*architecture" src/
grep -r "JSON.parse.*chat_history" src/
```

**Step 2: Remove JSON.parse**

Since JSONB fields are already objects, remove parsing:

```typescript
// Before:
const findings = JSON.parse(analysis.findings);
const architecture = JSON.parse(analysis.architecture);
const chatHistory = JSON.parse(analysis.chat_history);

// After (JSONB fields are already objects):
const findings = analysis.findings;
const architecture = analysis.architecture;
const chatHistory = analysis.chat_history;
```

**Step 3: Remove JSON.stringify if present**

Search for any `JSON.stringify` calls on these fields and remove them.

**Step 4: Commit**

```bash
git add src/
git commit -m "refactor: remove JSON parsing for JSONB fields"
```

---

### Task 18: Clean Up Old SQLite Files

**Files:**
- Delete: `src/lib/schema.sql`
- Delete: `data/database.sqlite` (if exists)
- Delete: `data/database.sqlite-shm` (if exists)
- Delete: `data/database.sqlite-wal` (if exists)

**Step 1: Remove schema.sql**

```bash
rm src/lib/schema.sql
```

**Step 2: Remove SQLite database files**

```bash
rm -f data/database.sqlite*
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove SQLite schema and database files"
```

---

### Task 19: Test Build

**Files:**
- None

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No type errors

**Step 2: Run Next.js build**

```bash
npm run build
```

Expected: Build succeeds with no errors

**Step 3: If errors occur**

Review error messages and fix any missing `await` keywords or type issues.

**Step 4: Commit fixes if needed**

```bash
git add .
git commit -m "fix: resolve build errors"
```

---

### Task 20: Test Locally

**Files:**
- None

**Step 1: Start development server**

```bash
npm run dev
```

**Step 2: Test signup flow**

1. Navigate to http://localhost:3000
2. Click "Sign Up"
3. Create an account with northwestern.edu email
4. Verify redirect to home page

Expected: Successful signup and login

**Step 3: Test project creation**

1. Create a new project
2. Verify project appears in list

Expected: Project created successfully

**Step 4: Test document upload**

1. Open a project
2. Upload a document
3. Verify document appears in list

Expected: Document uploaded to Supabase Storage

**Step 5: Test analysis**

1. Run analysis on a project
2. Verify analysis completes
3. Check that findings/architecture are properly displayed (no JSON.parse errors)

Expected: Analysis works with JSONB fields

**Step 6: Test chat**

1. Open chat interface
2. Send a message
3. Verify repository clones to /tmp if needed
4. Verify chat response

Expected: Chat works with on-demand cloning

**Step 7: No commit needed** (testing only)

---

### Task 21: Deploy to Vercel

**Files:**
- None

**Step 1: Push to GitHub**

```bash
git push origin main
```

**Step 2: Import project in Vercel**

1. Go to https://vercel.com
2. Click "Add New" → "Project"
3. Import your GitHub repository
4. Configure project settings

**Step 3: Add environment variables**

In Vercel project settings, add:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `ALLOWED_EMAIL_DOMAINS`
- `JWT_SECRET`
- `ANTHROPIC_API_KEY`

**Step 4: Deploy**

Click "Deploy"

Expected: Deployment succeeds

**Step 5: Test production deployment**

1. Visit deployed URL
2. Test signup, project creation, document upload, analysis, chat
3. Verify everything works in production

Expected: All features work on Vercel

**Step 6: No commit needed** (deployment only)

---

## Completion Checklist

After all tasks:
- [ ] All repository functions are async
- [ ] All API routes await repository calls
- [ ] File uploads use Supabase Storage
- [ ] Repos clone to /tmp
- [ ] JSONB fields used as objects (no JSON.parse)
- [ ] SQLite files removed
- [ ] Build succeeds locally
- [ ] All features tested locally
- [ ] Deployed to Vercel successfully
- [ ] All features tested in production

---

## Rollback Plan

If migration fails:
1. Revert to previous commit: `git reset --hard <commit-before-migration>`
2. Reinstall better-sqlite3: `npm install better-sqlite3`
3. Rebuild: `npm run build`
