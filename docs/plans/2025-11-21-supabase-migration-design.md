# Supabase Migration Design

## Overview

Migrate Code Vision from SQLite to Supabase PostgreSQL to enable deployment on Vercel. Use Supabase Storage for file uploads while keeping custom JWT authentication.

## Core Decisions

| Decision | Choice |
|----------|--------|
| Authentication | Keep custom JWT/bcrypt (northwestern.edu validation) |
| Database | Migrate SQLite → Supabase PostgreSQL |
| File uploads | Local filesystem → Supabase Storage |
| Cloned repositories | Persistent storage → /tmp (on-demand cloning) |

---

## Section 1: Migration Overview

**Goal:** Replace SQLite with Supabase PostgreSQL while keeping custom JWT authentication and supporting Vercel deployment.

**What Changes:**
- Database layer: `better-sqlite3` → `@supabase/supabase-js`
- File uploads: Local filesystem → Supabase Storage API
- Repo cloning: `data/repos/{projectId}` → `/tmp/repos/{projectId}` (temporary)

**What Stays:**
- All TypeScript interfaces
- Auth logic (JWT, bcrypt, domain validation)
- Business logic in repositories
- Frontend components
- API routes (minor changes only)

---

## Section 2: Database Migration

### PostgreSQL Schema

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

-- Documents table (file_path points to Supabase Storage)
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

**Key Changes from SQLite:**
- `TEXT` IDs → `UUID` with `gen_random_uuid()`
- `datetime('now')` → `NOW()`
- `TEXT NOT NULL DEFAULT (datetime('now'))` → `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- JSON strings → `JSONB` type (findings, architecture, chat_history)
- Removed `repo_path` column from projects (no longer needed)

---

## Section 3: Supabase Client Setup

**New Database Client (`src/lib/db.ts`):**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
  findings: string; // Will change to Finding[] when using JSONB
  architecture: string; // Will change to ArchitectureVisualization when using JSONB
  chat_history: string; // Will change to ChatMessage[] when using JSONB
  raw_response: string;
  analyzed_at: string;
}

// ... other interfaces unchanged
```

**Environment Variables:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ANON_KEY=eyJxxx...
```

**Why Service Role Key:**
- Bypasses Row Level Security (RLS)
- We handle auth ourselves with JWT
- Simpler for server-side operations

---

## Section 4: Repository Layer Changes

**Pattern for Repository Functions:**

### Before (SQLite):
```typescript
export function getUserByEmail(email: string): User | null {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email.toLowerCase()) as User | null;
}

export function createProject(input: CreateProjectInput): Project {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO projects (id, user_id, name, description, github_url, github_token)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, input.user_id, input.name, input.description || null,
           input.github_url, input.github_token);
  return getProject(id)!;
}
```

### After (Supabase):
```typescript
export async function getUserByEmail(email: string): Promise<User | null> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .single();

  if (error) return null;
  return data as User;
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

  if (error) throw new Error(error.message);
  return data as Project;
}
```

**Key Changes:**
- All functions become `async` (return `Promise<T>`)
- `.prepare().run()` → `.from().insert()`
- `.prepare().get()` → `.from().select().single()`
- `.prepare().all()` → `.from().select()`
- Handle `{ data, error }` response pattern
- JSONB fields stored as objects, not JSON strings
- Let PostgreSQL generate UUIDs (or keep `uuidv4()` for client-side generation)

**Files to Update:**
- `src/lib/repositories/users.ts`
- `src/lib/repositories/projects.ts`
- `src/lib/repositories/documents.ts`
- `src/lib/repositories/analysis.ts`

---

## Section 5: File Upload Changes (Supabase Storage)

**Storage Bucket Setup:**
1. Create a `documents` bucket in Supabase Dashboard
2. Set bucket to private (files only accessible with service role key)

**Upload Flow:**

### Before (Local Filesystem):
```typescript
const filePath = path.join(UPLOAD_DIR, `${projectId}-${filename}`);
fs.writeFileSync(filePath, buffer);
// Store filePath in database
```

### After (Supabase Storage):
```typescript
import { v4 as uuidv4 } from 'uuid';

const filePath = `${projectId}/${uuidv4()}-${filename}`;

const { error } = await supabase.storage
  .from('documents')
  .upload(filePath, buffer, {
    contentType: file.type,
    upsert: false
  });

if (error) throw new Error(error.message);
// Store filePath in database (points to Supabase Storage path)
```

**Download/Retrieval:**
```typescript
const { data, error } = await supabase.storage
  .from('documents')
  .download(filePath);

if (error) throw new Error(error.message);
// data is a Blob, convert to buffer for processing
const buffer = Buffer.from(await data.arrayBuffer());
```

**Delete:**
```typescript
const { error } = await supabase.storage
  .from('documents')
  .remove([filePath]);
```

**Files to Update:**
- `src/app/api/documents/route.ts` - Upload endpoint
- `src/app/api/documents/[id]/route.ts` - Delete endpoint
- `src/lib/services/file-parser.ts` - Read from Supabase Storage instead of filesystem
- `src/lib/services/analyzer.ts` - Download documents from storage

---

## Section 6: Repository Cloning for Chatbot

**Temporary Cloning Strategy:**

### Update `src/lib/services/github.ts`:

```typescript
// Change to /tmp (works on Vercel serverless)
const REPOS_DIR = '/tmp/repos';

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

// Remove cleanupProjectRepo - /tmp is auto-cleaned by Vercel
```

**Chat Service Update (`src/lib/services/chat.ts`):**
```typescript
// Before searching code, check if repo exists
const repoPath = getProjectRepoPath(projectId);

if (!fs.existsSync(repoPath)) {
  // Clone if not present
  const project = getProject(projectId);
  const cloneResult = await cloneRepository(
    project.github_url,
    project.github_token,
    projectId
  );

  if (!cloneResult.success) {
    // Proceed without code context if clone fails
    codeContext = '';
  }
}

// Search code as before
const codeResults = await searchCodeFiles(repoPath, message);
```

**Key Changes:**
- `data/repos` → `/tmp/repos`
- Repos are ephemeral (auto-cleaned by Vercel)
- Clone on-demand if not present
- Remove `repo_path` from database schema
- Remove `updateProjectRepoPath` calls from analyzer

**Files to Update:**
- `src/lib/services/github.ts`
- `src/lib/services/chat.ts`
- `src/lib/services/analyzer.ts`

---

## Section 7: Migration Checklist

### Installation
```bash
npm install @supabase/supabase-js
npm uninstall better-sqlite3
```

### Supabase Setup
1. Create new Supabase project at supabase.com
2. Go to SQL Editor and run the PostgreSQL schema
3. Go to Storage and create `documents` bucket (private)
4. Copy Project URL and Service Role Key from Settings → API

### Files to Modify

**Database Layer:**
- [ ] `src/lib/db.ts` - Replace with Supabase client
- [ ] `src/lib/schema.sql` - PostgreSQL syntax (run in Supabase SQL editor, then delete file)

**Repositories (all become async):**
- [ ] `src/lib/repositories/users.ts`
- [ ] `src/lib/repositories/projects.ts`
- [ ] `src/lib/repositories/documents.ts`
- [ ] `src/lib/repositories/analysis.ts`

**Services:**
- [ ] `src/lib/services/file-parser.ts` - Download from Supabase Storage
- [ ] `src/lib/services/github.ts` - Clone to /tmp, remove cleanup
- [ ] `src/lib/services/chat.ts` - Check/clone before searching
- [ ] `src/lib/services/analyzer.ts` - Remove repo_path updates, download docs from storage

**API Routes (add await to async calls):**
- [ ] All routes in `src/app/api/` - Add `await` to repository function calls
- [ ] `src/app/api/documents/route.ts` - Upload to Supabase Storage
- [ ] `src/app/api/documents/[id]/route.ts` - Delete from Supabase Storage

### Environment Variables

**Add to `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
SUPABASE_ANON_KEY=eyJxxx...
ALLOWED_EMAIL_DOMAINS=northwestern.edu
JWT_SECRET=your-secret
ANTHROPIC_API_KEY=sk-xxx
```

**Add to `.env.example`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
ALLOWED_EMAIL_DOMAINS=northwestern.edu
JWT_SECRET=change-this-to-a-random-secret
ANTHROPIC_API_KEY=your-anthropic-key
```

### Deployment (Vercel)
1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables in Vercel dashboard
4. Deploy

---

## JSONB Handling

Since PostgreSQL supports JSONB natively, we can store complex objects directly instead of JSON strings:

**Before (SQLite with JSON strings):**
```typescript
const findings = JSON.parse(analysis.findings); // Parse string to object
```

**After (PostgreSQL with JSONB):**
```typescript
const findings = analysis.findings; // Already an object!
```

Update TypeScript interfaces to reflect this:
```typescript
export interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[]; // Not a string anymore!
  architecture: ArchitectureVisualization; // Not a string anymore!
  chat_history: ChatMessage[]; // Not a string anymore!
  raw_response: string;
  analyzed_at: string;
}
```

This eliminates all `JSON.parse()` and `JSON.stringify()` calls for these fields in the repository layer.
