# Code Vision MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web app that analyzes GitHub repositories against uploaded requirements documents and generates plain-language reports about code-requirements alignment.

**Architecture:** Next.js full-stack application with SQLite database, local file storage for uploads and cloned repos, and Claude API for intelligent analysis. Synchronous processing, no auth for MVP.

**Tech Stack:** Next.js 14+ (App Router, TypeScript), SQLite (better-sqlite3), Claude API (@anthropic-ai/sdk), simple-git, pdf-parse, Tailwind CSS

---

## Phase 1: Project Foundation

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.js`, etc. (via create-next-app)
- Create: `.gitignore`
- Create: `.env.example`

**Step 1: Create Next.js application**

Run:
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-turbo --import-alias "@/*"
```

When prompted:
- Would you like to use Turbopack? No

Expected: Project scaffolded with src/app directory structure

**Step 2: Verify project created**

Run:
```bash
ls -la src/app/
```

Expected: See `layout.tsx`, `page.tsx`, `globals.css`

**Step 3: Create environment example file**

Create `.env.example`:
```
ANTHROPIC_API_KEY=your_api_key_here
ENCRYPTION_KEY=your_32_char_encryption_key_here
```

**Step 4: Update .gitignore**

Add to `.gitignore`:
```
# Local data
/data/
/uploads/
/temp/

# Environment
.env.local
.env
```

**Step 5: Create data directories**

Run:
```bash
mkdir -p data uploads temp
```

**Step 6: Test dev server runs**

Run:
```bash
npm run dev
```

Expected: Server starts on http://localhost:3000

**Step 7: Stop dev server and commit understanding**

Stop the server (Ctrl+C). Foundation complete.

---

### Task 2: Install Core Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install database dependencies**

Run:
```bash
npm install better-sqlite3 @types/better-sqlite3
```

Expected: Packages added to package.json

**Step 2: Install Claude SDK**

Run:
```bash
npm install @anthropic-ai/sdk
```

Expected: Package added to package.json

**Step 3: Install Git operations library**

Run:
```bash
npm install simple-git
```

Expected: Package added to package.json

**Step 4: Install file parsing libraries**

Run:
```bash
npm install pdf-parse @types/pdf-parse uuid @types/uuid
```

Expected: Packages added to package.json

**Step 5: Install form handling**

Run:
```bash
npm install zod
```

Expected: Package added to package.json

**Step 6: Verify all dependencies installed**

Run:
```bash
npm ls --depth=0
```

Expected: All packages listed without errors

---

### Task 3: Set Up Database Schema

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/schema.sql`

**Step 1: Create SQL schema file**

Create `src/lib/schema.sql`:
```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT NOT NULL,
  github_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_results (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  findings TEXT NOT NULL,
  raw_response TEXT NOT NULL,
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_results(project_id);
```

**Step 2: Create database connection module**

Create `src/lib/db.ts`:
```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'data', 'database.sqlite');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize schema
const schemaPath = path.join(process.cwd(), 'src', 'lib', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

export default db;

export type ProjectStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface Project {
  id: string;
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
  findings: string; // JSON string
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
```

**Step 3: Test database initialization**

Create a quick test by importing the module. The import itself will initialize the DB.

Run:
```bash
npx tsx -e "import './src/lib/db'; console.log('DB initialized')"
```

Expected: "DB initialized" printed, `data/database.sqlite` file created

**Step 4: Verify database file exists**

Run:
```bash
ls -la data/
```

Expected: See `database.sqlite` file

---

### Task 4: Create Project Repository Layer

**Files:**
- Create: `src/lib/repositories/projects.ts`

**Step 1: Create projects repository**

Create `src/lib/repositories/projects.ts`:
```typescript
import db, { Project, ProjectStatus } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectInput {
  name: string;
  description?: string;
  github_url: string;
  github_token: string;
}

export function createProject(input: CreateProjectInput): Project {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO projects (id, name, description, github_url, github_token, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);

  stmt.run(id, input.name, input.description || null, input.github_url, input.github_token);

  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  return stmt.get(id) as Project | null;
}

export function getAllProjects(): Project[] {
  const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  return stmt.all() as Project[];
}

export function updateProjectStatus(id: string, status: ProjectStatus): void {
  const stmt = db.prepare(`
    UPDATE projects
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(status, id);
}

export function deleteProject(id: string): void {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  stmt.run(id);
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 5: Create Document Repository Layer

**Files:**
- Create: `src/lib/repositories/documents.ts`

**Step 1: Create documents repository**

Create `src/lib/repositories/documents.ts`:
```typescript
import db, { Document } from '../db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface CreateDocumentInput {
  project_id: string;
  filename: string;
  file_type: 'pdf' | 'markdown' | 'text' | 'image';
  file_path: string;
}

export function createDocument(input: CreateDocumentInput): Document {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO documents (id, project_id, filename, file_type, file_path)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.project_id, input.filename, input.file_type, input.file_path);

  return getDocument(id)!;
}

export function getDocument(id: string): Document | null {
  const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
  return stmt.get(id) as Document | null;
}

export function getProjectDocuments(projectId: string): Document[] {
  const stmt = db.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY uploaded_at DESC');
  return stmt.all(projectId) as Document[];
}

export function deleteDocument(id: string): void {
  const doc = getDocument(id);
  if (doc) {
    // Delete file from filesystem
    const fullPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
  stmt.run(id);
}

export function deleteProjectDocuments(projectId: string): void {
  const docs = getProjectDocuments(projectId);
  for (const doc of docs) {
    const fullPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  const stmt = db.prepare('DELETE FROM documents WHERE project_id = ?');
  stmt.run(projectId);
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 6: Create Analysis Results Repository Layer

**Files:**
- Create: `src/lib/repositories/analysis.ts`

**Step 1: Create analysis repository**

Create `src/lib/repositories/analysis.ts`:
```typescript
import db, { AnalysisResult, Finding } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  raw_response: string;
}

export function createAnalysisResult(input: CreateAnalysisInput): AnalysisResult {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO analysis_results (id, project_id, summary, findings, raw_response)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.project_id,
    input.summary,
    JSON.stringify(input.findings),
    input.raw_response
  );

  return getAnalysisResult(id)!;
}

export function getAnalysisResult(id: string): AnalysisResult | null {
  const stmt = db.prepare('SELECT * FROM analysis_results WHERE id = ?');
  return stmt.get(id) as AnalysisResult | null;
}

export function getProjectAnalysis(projectId: string): AnalysisResult | null {
  const stmt = db.prepare(`
    SELECT * FROM analysis_results
    WHERE project_id = ?
    ORDER BY analyzed_at DESC
    LIMIT 1
  `);
  return stmt.get(projectId) as AnalysisResult | null;
}

export function deleteProjectAnalysis(projectId: string): void {
  const stmt = db.prepare('DELETE FROM analysis_results WHERE project_id = ?');
  stmt.run(projectId);
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

## Phase 2: Core Services

### Task 7: Create GitHub Service

**Files:**
- Create: `src/lib/services/github.ts`

**Step 1: Create GitHub service**

Create `src/lib/services/github.ts`:
```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const TEMP_DIR = path.join(process.cwd(), 'temp');

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function validateGitHubAccess(
  repoUrl: string,
  token: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Extract owner/repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) {
      return { valid: false, error: 'Invalid GitHub URL format' };
    }

    const [, owner, repo] = match;

    // Test API access
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 200) {
      return { valid: true };
    } else if (response.status === 401) {
      return { valid: false, error: 'Invalid token or token has expired' };
    } else if (response.status === 403) {
      return { valid: false, error: 'Token does not have access to this repository' };
    } else if (response.status === 404) {
      return { valid: false, error: 'Repository not found or is private' };
    } else {
      return { valid: false, error: `GitHub API error: ${response.status}` };
    }
  } catch (error) {
    return { valid: false, error: `Failed to validate: ${error}` };
  }
}

export async function cloneRepository(
  repoUrl: string,
  token: string
): Promise<CloneResult> {
  // Ensure temp directory exists
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  const cloneId = uuidv4();
  const clonePath = path.join(TEMP_DIR, cloneId);

  try {
    // Construct authenticated URL
    const urlObj = new URL(repoUrl);
    const authenticatedUrl = `https://${token}@${urlObj.host}${urlObj.pathname}`;

    const git: SimpleGit = simpleGit();

    // Clone with timeout (5 minutes)
    await git.clone(authenticatedUrl, clonePath, [
      '--depth=1', // Shallow clone for speed
      '--single-branch',
    ]);

    return { success: true, path: clonePath };
  } catch (error) {
    // Clean up on failure
    if (fs.existsSync(clonePath)) {
      fs.rmSync(clonePath, { recursive: true, force: true });
    }
    return {
      success: false,
      error: `Failed to clone repository: ${error}`,
    };
  }
}

export function cleanupClone(clonePath: string): void {
  if (fs.existsSync(clonePath)) {
    fs.rmSync(clonePath, { recursive: true, force: true });
  }
}

export function getRelevantFiles(repoPath: string): string[] {
  const relevantFiles: string[] = [];
  const ignoreDirs = new Set([
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    'coverage',
    '__pycache__',
    '.venv',
    'venv',
    'vendor',
  ]);

  const relevantExtensions = new Set([
    '.ts', '.tsx', '.js', '.jsx',
    '.py', '.rb', '.go', '.java',
    '.cs', '.php', '.swift', '.kt',
    '.rs', '.cpp', '.c', '.h',
  ]);

  function walkDir(dir: string, depth: number = 0): void {
    if (depth > 10) return; // Max depth to prevent infinite loops

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(repoPath, fullPath);

      if (entry.isDirectory()) {
        if (!ignoreDirs.has(entry.name) && !entry.name.startsWith('.')) {
          walkDir(fullPath, depth + 1);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (relevantExtensions.has(ext)) {
          relevantFiles.push(relativePath);
        }
      }
    }
  }

  walkDir(repoPath);
  return relevantFiles;
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 8: Create File Parser Service

**Files:**
- Create: `src/lib/services/file-parser.ts`

**Step 1: Create file parser service**

Create `src/lib/services/file-parser.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';

export interface ParsedDocument {
  filename: string;
  type: 'pdf' | 'markdown' | 'text' | 'image';
  content: string; // For text-based, this is the text. For images, base64.
}

export async function parseDocument(filePath: string): Promise<ParsedDocument> {
  const absolutePath = path.join(process.cwd(), filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (ext === '.pdf') {
    const buffer = fs.readFileSync(absolutePath);
    const data = await pdf(buffer);
    return {
      filename,
      type: 'pdf',
      content: data.text,
    };
  }

  if (ext === '.md' || ext === '.markdown') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return {
      filename,
      type: 'markdown',
      content,
    };
  }

  if (ext === '.txt') {
    const content = fs.readFileSync(absolutePath, 'utf-8');
    return {
      filename,
      type: 'text',
      content,
    };
  }

  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
    const buffer = fs.readFileSync(absolutePath);
    const base64 = buffer.toString('base64');
    const mimeType = getMimeType(ext);
    return {
      filename,
      type: 'image',
      content: `data:${mimeType};base64,${base64}`,
    };
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function parseAllDocuments(filePaths: string[]): Promise<ParsedDocument[]> {
  const results: ParsedDocument[] = [];

  for (const filePath of filePaths) {
    try {
      const parsed = await parseDocument(filePath);
      results.push(parsed);
    } catch (error) {
      console.error(`Failed to parse ${filePath}:`, error);
      // Continue with other documents
    }
  }

  return results;
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 9: Create Claude Analysis Service

**Files:**
- Create: `src/lib/services/claude.ts`

**Step 1: Create Claude service**

Create `src/lib/services/claude.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Finding } from '../db';
import { ParsedDocument } from './file-parser';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();

export interface AnalysisInput {
  documents: ParsedDocument[];
  codeFiles: { path: string; content: string }[];
}

export interface AnalysisOutput {
  summary: string;
  findings: Finding[];
  raw_response: string;
}

export async function analyzeCodeAlignment(input: AnalysisInput): Promise<AnalysisOutput> {
  // Build the requirements context
  const requirementsContext = input.documents
    .filter(doc => doc.type !== 'image')
    .map(doc => `### ${doc.filename}\n\n${doc.content}`)
    .join('\n\n---\n\n');

  // Build the code context (limit to first 50 files, ~100KB total)
  let codeContext = '';
  let totalSize = 0;
  const maxSize = 100000; // 100KB limit

  for (const file of input.codeFiles) {
    const fileContent = `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
    if (totalSize + fileContent.length > maxSize) break;
    codeContext += fileContent;
    totalSize += fileContent.length;
  }

  // Prepare image documents for Claude
  const imageContents: Anthropic.ImageBlockParam[] = input.documents
    .filter(doc => doc.type === 'image')
    .map(doc => {
      const [, base64Data] = doc.content.split(',');
      const mediaType = doc.content.split(';')[0].split(':')[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType,
          data: base64Data,
        },
      };
    });

  const systemPrompt = `You are a code quality analyst helping non-technical stakeholders understand if their software requirements have been properly implemented.

Your task is to analyze the provided requirements documents (PRDs, BRDs, wireframes, etc.) and compare them against the actual codebase to identify:
1. GAPS: Features or requirements mentioned in documents that are NOT implemented in code
2. FIDELITY ISSUES: Features that ARE implemented but don't match the specifications

Prioritize findings by business impact, not technical complexity. Use plain language that non-technical people can understand.

Respond with a JSON object in this exact format:
{
  "summary": "2-3 paragraph executive summary in plain language",
  "findings": [
    {
      "type": "gap" or "fidelity",
      "severity": "critical" or "high" or "medium" or "low",
      "title": "Short descriptive title",
      "description": "Plain language explanation of the issue and its business impact",
      "evidence": ["Array of specific references from requirements or code"]
    }
  ]
}

Severity guide:
- critical: Core functionality missing, project cannot launch
- high: Important feature missing or broken, significant user impact
- medium: Feature partially implemented or minor spec deviation
- low: Nice-to-have missing or cosmetic mismatch`;

  const userMessage = `## REQUIREMENTS DOCUMENTS

${requirementsContext}

## CODE FILES

${codeContext}

Please analyze how well this codebase implements the requirements specified in the documents above. Identify gaps and fidelity issues, prioritized by business impact.`;

  const messageContent: Anthropic.MessageParam['content'] = [
    ...imageContents,
    { type: 'text', text: userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
  });

  const rawResponse = JSON.stringify(response, null, 2);

  // Extract text content from response
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    summary: parsed.summary,
    findings: parsed.findings,
    raw_response: rawResponse,
  };
}

export function readCodeFile(repoPath: string, filePath: string): string {
  const fullPath = path.join(repoPath, filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    // Truncate very long files
    if (content.length > 10000) {
      return content.substring(0, 10000) + '\n... (truncated)';
    }
    return content;
  } catch {
    return '// Could not read file';
  }
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 10: Create Analysis Orchestrator

**Files:**
- Create: `src/lib/services/analyzer.ts`

**Step 1: Create analyzer orchestrator**

Create `src/lib/services/analyzer.ts`:
```typescript
import { getProject, updateProjectStatus } from '../repositories/projects';
import { getProjectDocuments } from '../repositories/documents';
import { createAnalysisResult, deleteProjectAnalysis } from '../repositories/analysis';
import { cloneRepository, cleanupClone, getRelevantFiles } from './github';
import { parseAllDocuments } from './file-parser';
import { analyzeCodeAlignment, readCodeFile } from './claude';

export interface AnalyzeProjectResult {
  success: boolean;
  error?: string;
  analysisId?: string;
}

export async function analyzeProject(projectId: string): Promise<AnalyzeProjectResult> {
  const project = getProject(projectId);
  if (!project) {
    return { success: false, error: 'Project not found' };
  }

  const documents = getProjectDocuments(projectId);
  if (documents.length === 0) {
    return { success: false, error: 'No documents uploaded. Please upload requirements documents first.' };
  }

  let clonePath: string | null = null;

  try {
    // Update status to analyzing
    updateProjectStatus(projectId, 'analyzing');

    // Delete previous analysis if exists
    deleteProjectAnalysis(projectId);

    // Clone the repository
    const cloneResult = await cloneRepository(project.github_url, project.github_token);
    if (!cloneResult.success || !cloneResult.path) {
      updateProjectStatus(projectId, 'failed');
      return { success: false, error: cloneResult.error || 'Failed to clone repository' };
    }
    clonePath = cloneResult.path;

    // Parse all uploaded documents
    const documentPaths = documents.map(doc => doc.file_path);
    const parsedDocs = await parseAllDocuments(documentPaths);

    if (parsedDocs.length === 0) {
      updateProjectStatus(projectId, 'failed');
      return { success: false, error: 'Failed to parse any documents' };
    }

    // Get relevant code files
    const relevantFiles = getRelevantFiles(clonePath);
    if (relevantFiles.length === 0) {
      updateProjectStatus(projectId, 'failed');
      return { success: false, error: 'No source code files found in repository' };
    }

    // Read code file contents
    const codeFiles = relevantFiles.map(filePath => ({
      path: filePath,
      content: readCodeFile(clonePath!, filePath),
    }));

    // Run Claude analysis
    const analysisOutput = await analyzeCodeAlignment({
      documents: parsedDocs,
      codeFiles,
    });

    // Save results
    const result = createAnalysisResult({
      project_id: projectId,
      summary: analysisOutput.summary,
      findings: analysisOutput.findings,
      raw_response: analysisOutput.raw_response,
    });

    // Update project status
    updateProjectStatus(projectId, 'completed');

    return { success: true, analysisId: result.id };
  } catch (error) {
    updateProjectStatus(projectId, 'failed');
    return {
      success: false,
      error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  } finally {
    // Always clean up cloned repo
    if (clonePath) {
      cleanupClone(clonePath);
    }
  }
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

## Phase 3: API Routes

### Task 11: Create Projects API Routes

**Files:**
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/route.ts`

**Step 1: Create list/create projects endpoint**

Create `src/app/api/projects/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createProject, getAllProjects } from '@/lib/repositories/projects';
import { validateGitHubAccess } from '@/lib/services/github';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  github_url: z.string().url('Invalid URL').refine(
    url => url.includes('github.com'),
    'Must be a GitHub URL'
  ),
  github_token: z.string().min(1, 'Token is required'),
});

export async function GET() {
  try {
    const projects = getAllProjects();
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, description, github_url, github_token } = parsed.data;

    // Validate GitHub access
    const validation = await validateGitHubAccess(github_url, github_token);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const project = createProject({
      name,
      description,
      github_url,
      github_token,
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create single project endpoint**

Create `src/app/api/projects/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getProject, deleteProject } from '@/lib/repositories/projects';
import { deleteProjectDocuments } from '@/lib/repositories/documents';
import { deleteProjectAnalysis } from '@/lib/repositories/analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProject(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const project = getProject(id);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Clean up related data
    deleteProjectDocuments(id);
    deleteProjectAnalysis(id);
    deleteProject(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 12: Create Documents Upload API

**Files:**
- Create: `src/app/api/documents/route.ts`
- Create: `src/app/api/documents/[id]/route.ts`

**Step 1: Create document upload endpoint**

Create `src/app/api/documents/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createDocument, getProjectDocuments } from '@/lib/repositories/documents';
import { getProject } from '@/lib/repositories/projects';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, 'pdf' | 'markdown' | 'text' | 'image'> = {
  'application/pdf': 'pdf',
  'text/markdown': 'markdown',
  'text/plain': 'text',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('project_id') as string;
    const file = formData.get('file') as File;

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      );
    }

    // Validate project exists
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type];
    if (!fileType) {
      // Check by extension as fallback
      const ext = path.extname(file.name).toLowerCase();
      if (ext === '.md') {
        // Handle .md files
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: PDF, Markdown, Text, PNG, JPG, GIF, WebP` },
          { status: 400 }
        );
      }
    }

    // Determine actual file type
    let actualFileType: 'pdf' | 'markdown' | 'text' | 'image' = fileType;
    if (!actualFileType) {
      const ext = path.extname(file.name).toLowerCase();
      if (ext === '.md' || ext === '.markdown') {
        actualFileType = 'markdown';
      } else if (ext === '.txt') {
        actualFileType = 'text';
      }
    }

    if (!actualFileType) {
      return NextResponse.json(
        { error: 'Could not determine file type' },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const projectUploadDir = path.join(UPLOAD_DIR, projectId);
    if (!fs.existsSync(projectUploadDir)) {
      fs.mkdirSync(projectUploadDir, { recursive: true });
    }

    // Save file with unique name
    const fileId = uuidv4();
    const ext = path.extname(file.name);
    const savedFilename = `${fileId}${ext}`;
    const filePath = path.join(projectUploadDir, savedFilename);
    const relativePath = path.join('uploads', projectId, savedFilename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create database record
    const document = createDocument({
      project_id: projectId,
      filename: file.name,
      file_type: actualFileType,
      file_path: relativePath,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    const documents = getProjectDocuments(projectId);
    return NextResponse.json(documents);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
```

**Step 2: Create document delete endpoint**

Create `src/app/api/documents/[id]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument, getDocument } from '@/lib/repositories/documents';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const document = getDocument(id);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 13: Create Analysis API Route

**Files:**
- Create: `src/app/api/analyze/route.ts`

**Step 1: Create analysis trigger endpoint**

Create `src/app/api/analyze/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { analyzeProject } from '@/lib/services/analyzer';
import { getProject } from '@/lib/repositories/projects';
import { z } from 'zod';

const AnalyzeSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AnalyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { project_id } = parsed.data;

    // Check project exists
    const project = getProject(project_id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check project is not already being analyzed
    if (project.status === 'analyzing') {
      return NextResponse.json(
        { error: 'Analysis already in progress' },
        { status: 409 }
      );
    }

    // Run analysis
    const result = await analyzeProject(project_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis_id: result.analysisId,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed unexpectedly' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

### Task 14: Create Analysis Results API Route

**Files:**
- Create: `src/app/api/analysis/[projectId]/route.ts`

**Step 1: Create analysis results endpoint**

Create `src/app/api/analysis/[projectId]/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Verify project exists
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const analysis = getProjectAnalysis(projectId);
    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis results found' },
        { status: 404 }
      );
    }

    // Parse findings JSON
    const findings = JSON.parse(analysis.findings);

    return NextResponse.json({
      id: analysis.id,
      project_id: analysis.project_id,
      summary: analysis.summary,
      findings,
      analyzed_at: analysis.analyzed_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

## Phase 4: Frontend Components

### Task 15: Create Layout and Home Page

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

**Step 1: Update global styles**

Replace `src/app/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
}
```

**Step 2: Update layout**

Replace `src/app/layout.tsx`:
```typescript
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Code Vision - Code Quality Analysis',
  description: 'Analyze code quality and requirements alignment',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <a href="/" className="text-xl font-bold text-gray-900">
                  Code Vision
                </a>
              </div>
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  );
}
```

**Step 3: Update home page**

Replace `src/app/page.tsx`:
```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description: string | null;
  github_url: string;
  status: string;
  created_at: string;
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      setProjects(data);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;

    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      setProjects(projects.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'analyzing':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading projects...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
        <Link
          href="/projects/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          New Project
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No projects yet</p>
          <Link
            href="/projects/new"
            className="text-blue-600 hover:text-blue-800"
          >
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {project.name}
                </h3>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    project.status
                  )}`}
                >
                  {project.status}
                </span>
              </div>
              {project.description && (
                <p className="text-gray-600 text-sm mb-3">
                  {project.description}
                </p>
              )}
              <p className="text-gray-500 text-xs mb-4 truncate">
                {project.github_url}
              </p>
              <div className="flex justify-between items-center">
                <Link
                  href={`/projects/${project.id}`}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  View Details
                </Link>
                <button
                  onClick={() => deleteProject(project.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Test the page renders**

Run:
```bash
npm run dev
```

Open http://localhost:3000 in browser.

Expected: See "Projects" heading with "New Project" button

---

### Task 16: Create New Project Page

**Files:**
- Create: `src/app/projects/new/page.tsx`

**Step 1: Create new project form**

Create `src/app/projects/new/page.tsx`:
```typescript
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
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Create New Project
      </h1>

      <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Project Name *
          </label>
          <input
            type="text"
            id="name"
            required
            maxLength={100}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="description"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Description
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.description}
            onChange={e =>
              setFormData({ ...formData, description: e.target.value })
            }
          />
        </div>

        <div className="mb-4">
          <label
            htmlFor="github_url"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            GitHub Repository URL *
          </label>
          <input
            type="url"
            id="github_url"
            required
            placeholder="https://github.com/owner/repo"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.github_url}
            onChange={e =>
              setFormData({ ...formData, github_url: e.target.value })
            }
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="github_token"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            GitHub Personal Access Token *
          </label>
          <input
            type="password"
            id="github_token"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={formData.github_token}
            onChange={e =>
              setFormData({ ...formData, github_token: e.target.value })
            }
          />
          <p className="mt-1 text-xs text-gray-500">
            Create a token at GitHub Settings → Developer Settings → Personal
            Access Tokens. Needs repo read access.
          </p>
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-700 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Verify page renders**

Navigate to http://localhost:3000/projects/new

Expected: See form with all fields

---

### Task 17: Create Project Detail Page

**Files:**
- Create: `src/app/projects/[id]/page.tsx`

**Step 1: Create project detail page with file upload**

Create `src/app/projects/[id]/page.tsx`:
```typescript
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

  if (loading) {
    return <div className="text-center py-12">Loading project...</div>;
  }

  if (!project) {
    return <div className="text-center py-12">Project not found</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Projects
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
            {project.description && (
              <p className="text-gray-600 mt-1">{project.description}</p>
            )}
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              project.status === 'completed'
                ? 'bg-green-100 text-green-800'
                : project.status === 'analyzing'
                ? 'bg-yellow-100 text-yellow-800'
                : project.status === 'failed'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {project.status}
          </span>
        </div>
        <p className="text-gray-500 text-sm">{project.github_url}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Requirements Documents
        </h2>

        <div className="mb-4">
          <label className="block">
            <span className="sr-only">Upload files</span>
            <input
              type="file"
              multiple
              accept=".pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileUpload}
              disabled={uploading}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
          </label>
          <p className="mt-1 text-xs text-gray-500">
            Upload PRD, BRD, wireframes, or other requirements documents (PDF,
            Markdown, Text, Images)
          </p>
        </div>

        {uploading && (
          <div className="text-sm text-gray-600 mb-4">Uploading...</div>
        )}

        {documents.length === 0 ? (
          <p className="text-gray-500 text-sm">No documents uploaded yet</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {documents.map(doc => (
              <li
                key={doc.id}
                className="py-3 flex justify-between items-center"
              >
                <div className="flex items-center">
                  <span className="mr-2">{getFileIcon(doc.file_type)}</span>
                  <span className="text-sm text-gray-900">{doc.filename}</span>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Analysis</h2>

        <div className="flex gap-4">
          <button
            onClick={runAnalysis}
            disabled={
              analyzing ||
              documents.length === 0 ||
              project.status === 'analyzing'
            }
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? 'Analyzing...' : 'Run Analysis'}
          </button>

          {project.status === 'completed' && (
            <Link
              href={`/projects/${projectId}/report`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              View Report
            </Link>
          )}
        </div>

        {documents.length === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Upload at least one document before running analysis
          </p>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify page renders**

Create a test project first, then navigate to its detail page.

Expected: See project info, document upload area, and analysis section

---

### Task 18: Create Report Page

**Files:**
- Create: `src/app/projects/[id]/report/page.tsx`

**Step 1: Create report display page**

Create `src/app/projects/[id]/report/page.tsx`:
```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[];
  analyzed_at: string;
}

export default function ReportPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchAnalysis = useCallback(async () => {
    try {
      const response = await fetch(`/api/analysis/${projectId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load analysis');
      }
      const data = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeLabel = (type: string) => {
    return type === 'gap' ? 'Missing Feature' : 'Implementation Issue';
  };

  if (loading) {
    return <div className="text-center py-12">Loading report...</div>;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/projects/${projectId}`}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            ← Back to Project
          </Link>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!analysis) {
    return <div className="text-center py-12">No analysis found</div>;
  }

  const criticalCount = analysis.findings.filter(
    f => f.severity === 'critical'
  ).length;
  const highCount = analysis.findings.filter(f => f.severity === 'high').length;
  const mediumCount = analysis.findings.filter(
    f => f.severity === 'medium'
  ).length;
  const lowCount = analysis.findings.filter(f => f.severity === 'low').length;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          href={`/projects/${projectId}`}
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          ← Back to Project
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Analysis Report
        </h1>
        <p className="text-sm text-gray-500">
          Generated on {new Date(analysis.analyzed_at).toLocaleString()}
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Executive Summary
        </h2>
        <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
          {analysis.summary}
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Issues Overview
        </h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-700">
              {criticalCount}
            </div>
            <div className="text-sm text-red-600">Critical</div>
          </div>
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-700">{highCount}</div>
            <div className="text-sm text-orange-600">High</div>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-700">
              {mediumCount}
            </div>
            <div className="text-sm text-yellow-600">Medium</div>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-700">{lowCount}</div>
            <div className="text-sm text-blue-600">Low</div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Detailed Findings
        </h2>

        {analysis.findings.length === 0 ? (
          <p className="text-gray-500">
            No issues found. The code appears to align well with the
            requirements.
          </p>
        ) : (
          <div className="space-y-4">
            {analysis.findings.map((finding, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getSeverityColor(
                  finding.severity
                )}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-900">
                    {finding.title}
                  </h3>
                  <div className="flex gap-2">
                    <span className="text-xs font-medium px-2 py-1 rounded bg-white bg-opacity-50">
                      {finding.severity.toUpperCase()}
                    </span>
                    <span className="text-xs font-medium px-2 py-1 rounded bg-white bg-opacity-50">
                      {getTypeLabel(finding.type)}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-700 mb-3">
                  {finding.description}
                </p>
                {finding.evidence.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-600 mb-1">
                      Evidence:
                    </p>
                    <ul className="text-xs text-gray-600 list-disc list-inside">
                      {finding.evidence.map((ev, i) => (
                        <li key={i}>{ev}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run:
```bash
npx tsc --noEmit
```

Expected: No errors

---

## Phase 5: Final Integration & Testing

### Task 19: Create Environment Configuration

**Files:**
- Create: `.env.local`

**Step 1: Create environment file**

Create `.env.local`:
```
ANTHROPIC_API_KEY=your_actual_api_key_here
```

**Step 2: Verify environment loaded**

The app will fail to call Claude without a valid API key. Ensure you have a valid key set.

---

### Task 20: End-to-End Testing

**Step 1: Start the development server**

Run:
```bash
npm run dev
```

**Step 2: Test project creation**

1. Open http://localhost:3000
2. Click "New Project"
3. Fill in form with a real GitHub repo and valid PAT
4. Submit

Expected: Redirects to project detail page

**Step 3: Test document upload**

1. On project detail page
2. Upload a test PDF or markdown file
3. Verify file appears in list

Expected: Document listed with correct icon

**Step 4: Test analysis (requires valid Claude API key)**

1. Click "Run Analysis"
2. Wait for completion (may take 1-2 minutes)

Expected: Redirects to report page with findings

**Step 5: Verify report display**

Expected: See executive summary, issue counts, and detailed findings

---

### Task 21: Production Build Verification

**Step 1: Build the application**

Run:
```bash
npm run build
```

Expected: Build completes without errors

**Step 2: Test production build**

Run:
```bash
npm run start
```

Open http://localhost:3000

Expected: App works same as dev mode

---

## Implementation Complete

The MVP is now functional with:
- Project management (create, view, delete)
- Document uploads (PDF, Markdown, text, images)
- GitHub repository integration via PAT
- Claude-powered code analysis
- Plain-language reports with prioritized findings

Ready for user testing and iteration.
