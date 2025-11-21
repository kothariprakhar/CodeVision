# Onboarding Pivot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Code Vision from quality verification to developer onboarding by adding a chatbot, analysis versioning, and restructured UI with tabs.

**Architecture:** Project detail page becomes the main hub with Architecture/Issues tabs. Chatbot uses hybrid approach (analysis context + real-time code search). All analysis versions are kept with per-version chat history. Repos persist on disk for chatbot access.

**Tech Stack:** Next.js 14, TypeScript, SQLite, Claude API, Tailwind CSS

---

## Phase 1: Core Restructure

### Task 1: Update Database Schema

**Files:**
- Modify: `src/lib/schema.sql`
- Modify: `src/lib/db.ts`

**Step 1: Add new columns to schema**

Update `src/lib/schema.sql` to add `chat_history` and `repo_path`:

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT NOT NULL,
  github_token TEXT NOT NULL,
  repo_path TEXT,
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
  architecture TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  chat_history TEXT NOT NULL DEFAULT '[]',
  raw_response TEXT NOT NULL,
  analyzed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_project ON documents(project_id);
CREATE INDEX IF NOT EXISTS idx_analysis_project ON analysis_results(project_id);
```

**Step 2: Update TypeScript types**

Add to `src/lib/db.ts`:

```typescript
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType: 'quick' | 'detailed';
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  github_url: string;
  github_token: string;
  repo_path: string | null;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}
```

**Step 3: Delete existing database to apply new schema**

```bash
rm -f data/database.sqlite
```

Note: This is acceptable for MVP. In production, use migrations.

---

### Task 2: Update GitHub Service for Persistent Repos

**Files:**
- Modify: `src/lib/services/github.ts`

**Step 1: Change clone destination to persistent location**

Replace the `TEMP_DIR` constant and update `cloneRepository`:

```typescript
import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import fs from 'fs';

const REPOS_DIR = path.join(process.cwd(), 'data', 'repos');

export interface CloneResult {
  success: boolean;
  path?: string;
  error?: string;
}

export async function cloneRepository(
  repoUrl: string,
  token: string,
  projectId: string
): Promise<CloneResult> {
  // Ensure repos directory exists
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

    await git.clone(cloneUrl, clonePath, [
      '--depth=1',
      '--single-branch',
    ]);

    return { success: true, path: clonePath };
  } catch (error) {
    if (fs.existsSync(clonePath)) {
      fs.rmSync(clonePath, { recursive: true, force: true });
    }
    return {
      success: false,
      error: `Failed to clone repository: ${error}`,
    };
  }
}

export function cleanupProjectRepo(projectId: string): void {
  const repoPath = path.join(REPOS_DIR, projectId);
  if (fs.existsSync(repoPath)) {
    fs.rmSync(repoPath, { recursive: true, force: true });
  }
}

export function getProjectRepoPath(projectId: string): string {
  return path.join(REPOS_DIR, projectId);
}
```

**Step 2: Remove the old cleanupClone function**

Delete the `cleanupClone` function as we're keeping repos persistent.

---

### Task 3: Update Projects Repository

**Files:**
- Modify: `src/lib/repositories/projects.ts`

**Step 1: Update CreateProjectInput and functions**

Add `repo_path` to the interface and update functions:

```typescript
export interface CreateProjectInput {
  name: string;
  description?: string;
  github_url: string;
  github_token: string;
  repo_path?: string;
}

export function createProject(input: CreateProjectInput): Project {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO projects (id, name, description, github_url, github_token, repo_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.name,
    input.description || null,
    input.github_url,
    input.github_token,
    input.repo_path || null
  );

  return getProject(id)!;
}

export function updateProjectRepoPath(projectId: string, repoPath: string): void {
  const stmt = db.prepare(`
    UPDATE projects SET repo_path = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(repoPath, projectId);
}
```

---

### Task 4: Update Analysis Repository for Versioning

**Files:**
- Modify: `src/lib/repositories/analysis.ts`

**Step 1: Add functions for multiple versions and chat history**

```typescript
import db, { AnalysisResult, Finding, ArchitectureVisualization, ChatMessage } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
}

export interface AnalysisVersion {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
}

export function createAnalysisResult(input: CreateAnalysisInput): AnalysisResult {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO analysis_results (id, project_id, summary, findings, architecture, raw_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.project_id,
    input.summary,
    JSON.stringify(input.findings),
    JSON.stringify(input.architecture),
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

export function getProjectAnalysisVersions(projectId: string): AnalysisVersion[] {
  const stmt = db.prepare(`
    SELECT id, analyzed_at FROM analysis_results
    WHERE project_id = ?
    ORDER BY analyzed_at DESC
  `);
  const results = stmt.all(projectId) as { id: string; analyzed_at: string }[];

  return results.map((r, index) => ({
    id: r.id,
    analyzed_at: r.analyzed_at,
    is_latest: index === 0,
  }));
}

export function getAnalysisById(analysisId: string): AnalysisResult | null {
  const stmt = db.prepare('SELECT * FROM analysis_results WHERE id = ?');
  return stmt.get(analysisId) as AnalysisResult | null;
}

export function getChatHistory(analysisId: string): ChatMessage[] {
  const stmt = db.prepare('SELECT chat_history FROM analysis_results WHERE id = ?');
  const result = stmt.get(analysisId) as { chat_history: string } | null;
  if (!result) return [];
  return JSON.parse(result.chat_history);
}

export function updateChatHistory(analysisId: string, messages: ChatMessage[]): void {
  const stmt = db.prepare('UPDATE analysis_results SET chat_history = ? WHERE id = ?');
  stmt.run(JSON.stringify(messages), analysisId);
}

export function deleteProjectAnalysis(projectId: string): void {
  const stmt = db.prepare('DELETE FROM analysis_results WHERE project_id = ?');
  stmt.run(projectId);
}
```

---

### Task 5: Update Analyzer Service to Use Persistent Repos

**Files:**
- Modify: `src/lib/services/analyzer.ts`

**Step 1: Update to pass projectId and save repo_path**

Find where `cloneRepository` is called and update:

```typescript
// Change from:
const cloneResult = await cloneRepository(project.github_url, project.github_token);

// Change to:
const cloneResult = await cloneRepository(project.github_url, project.github_token, project.id);

// After successful clone, update project with repo_path
if (cloneResult.success && cloneResult.path) {
  updateProjectRepoPath(project.id, cloneResult.path);
}
```

Import the new function:

```typescript
import { updateProjectRepoPath } from '../repositories/projects';
```

Remove any calls to `cleanupClone` at the end of analysis.

---

### Task 6: Auto-Analyze on Project Creation

**Files:**
- Modify: `src/app/api/projects/route.ts`

**Step 1: Import analyze function and trigger after creation**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createProject, getAllProjects, updateProjectStatus } from '@/lib/repositories/projects';
import { validateGitHubAccess, cloneRepository } from '@/lib/services/github';
import { analyzeProject } from '@/lib/services/analyzer';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  github_url: z.string().url('Invalid URL').refine(
    url => url.includes('github.com'),
    'Must be a GitHub URL'
  ),
  github_token: z.string().optional().default(''),
  is_public: z.boolean().optional().default(false),
}).refine(
  data => data.is_public || data.github_token.length > 0,
  { message: 'Token is required for private repositories', path: ['github_token'] }
);

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
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, description, github_url, github_token, is_public } = parsed.data;

    // Validate GitHub access (skip validation for public repos without token)
    if (!is_public && github_token) {
      const validation = await validateGitHubAccess(github_url, github_token);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    const project = createProject({
      name,
      description,
      github_url,
      github_token: is_public ? '' : github_token,
    });

    // Start auto-analysis in background (don't await)
    analyzeProject(project.id).catch(err => {
      console.error('Auto-analysis failed:', err);
    });

    return NextResponse.json({ ...project, status: 'analyzing' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
```

---

### Task 7: Create Analysis Versions API Endpoint

**Files:**
- Create: `src/app/api/analysis/versions/[projectId]/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysisVersions } from '@/lib/repositories/analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const versions = getProjectAnalysisVersions(params.projectId);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis versions' },
      { status: 500 }
    );
  }
}
```

---

### Task 8: Update Analysis API to Support Version Selection

**Files:**
- Modify: `src/app/api/analysis/[projectId]/route.ts`

**Step 1: Add query param for specific version**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis, getAnalysisById } from '@/lib/repositories/analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('version');

    let analysis;
    if (analysisId) {
      analysis = getAnalysisById(analysisId);
    } else {
      analysis = getProjectAnalysis(params.projectId);
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    const result = {
      ...analysis,
      findings: JSON.parse(analysis.findings as string),
      architecture: JSON.parse(analysis.architecture as unknown as string),
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
```

---

## Phase 2: Chatbot

### Task 9: Create Chat Service

**Files:**
- Create: `src/lib/services/chat.ts`

**Step 1: Create the chat service with hybrid logic**

```typescript
import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getAnalysisById, getChatHistory, updateChatHistory } from '../repositories/analysis';
import { getProject } from '../repositories/projects';
import { ChatMessage, ArchitectureVisualization, Finding } from '../db';
import { v4 as uuidv4 } from 'uuid';

const anthropic = new Anthropic();

interface ChatContext {
  summary: string;
  architecture: ArchitectureVisualization;
  findings: Finding[];
  repoPath: string | null;
}

export interface ChatResponse {
  id: string;
  content: string;
  responseType: 'quick' | 'detailed';
  timestamp: string;
}

async function searchCodeFiles(repoPath: string, query: string): Promise<string[]> {
  const results: string[] = [];
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next'];
        if (!ignoreDirs.includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];

        if (codeExtensions.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lowerContent = content.toLowerCase();

            if (searchTerms.some(term => lowerContent.includes(term))) {
              const relativePath = path.relative(repoPath, fullPath);
              // Limit content to first 500 lines
              const lines = content.split('\n').slice(0, 500).join('\n');
              results.push(`File: ${relativePath}\n\`\`\`\n${lines}\n\`\`\``);
            }
          } catch (e) {
            // Skip unreadable files
          }
        }
      }
    }
  }

  walkDir(repoPath);
  return results.slice(0, 5); // Limit to 5 most relevant files
}

function determineResponseType(question: string): 'quick' | 'detailed' {
  const quickPatterns = [
    /where is/i,
    /which file/i,
    /what does .* do/i,
    /how many/i,
    /list the/i,
    /show me/i,
  ];

  const detailedPatterns = [
    /how should i/i,
    /how would i/i,
    /how can i/i,
    /implement/i,
    /best practice/i,
    /architecture/i,
    /design/i,
  ];

  if (detailedPatterns.some(p => p.test(question))) {
    return 'detailed';
  }
  if (quickPatterns.some(p => p.test(question))) {
    return 'quick';
  }
  return 'quick';
}

export async function chat(
  projectId: string,
  analysisId: string,
  message: string
): Promise<ChatResponse> {
  // Get analysis context
  const analysis = getAnalysisById(analysisId);
  if (!analysis) {
    throw new Error('Analysis not found');
  }

  const project = getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const context: ChatContext = {
    summary: analysis.summary,
    architecture: JSON.parse(analysis.architecture as unknown as string),
    findings: JSON.parse(analysis.findings as string),
    repoPath: project.repo_path,
  };

  // Get chat history
  const history = getChatHistory(analysisId);

  // Determine response type
  const responseType = determineResponseType(message);

  // Search code if repo is available
  let codeContext = '';
  if (context.repoPath && fs.existsSync(context.repoPath)) {
    const codeResults = await searchCodeFiles(context.repoPath, message);
    if (codeResults.length > 0) {
      codeContext = '\n\nRelevant code files:\n' + codeResults.join('\n\n');
    }
  }

  // Build system prompt
  const systemPrompt = `You are a helpful assistant for developers onboarding to a codebase.

Analysis Summary:
${context.summary}

Architecture Components:
${context.architecture.nodes.map(n => `- ${n.name} (${n.type}): ${n.description}`).join('\n')}

${responseType === 'quick'
  ? 'Provide a concise, direct answer. Be specific about file names and locations.'
  : 'Provide a thorough explanation. If the question involves implementation, suggest they explore specific areas but note this is for understanding, not direct coding assistance.'}

${codeContext}`;

  // Build messages
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: responseType === 'quick' ? 500 : 1500,
    system: systemPrompt,
    messages,
  });

  const assistantMessage = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // Create response
  const chatResponse: ChatResponse = {
    id: uuidv4(),
    content: assistantMessage,
    responseType,
    timestamp: new Date().toISOString(),
  };

  // Save to history
  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
    responseType: 'quick',
  };

  const assistantChatMessage: ChatMessage = {
    id: chatResponse.id,
    role: 'assistant',
    content: assistantMessage,
    timestamp: chatResponse.timestamp,
    responseType,
  };

  updateChatHistory(analysisId, [...history, userMessage, assistantChatMessage]);

  return chatResponse;
}

export function getAnalysisChatHistory(analysisId: string): ChatMessage[] {
  return getChatHistory(analysisId);
}
```

---

### Task 10: Create Chat API Endpoint

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Create the endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { chat, getAnalysisChatHistory } from '@/lib/services/chat';
import { z } from 'zod';

const ChatSchema = z.object({
  project_id: z.string().min(1),
  analysis_id: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { project_id, analysis_id, message } = parsed.data;

    const response = await chat(project_id, analysis_id, message);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysis_id');

    if (!analysisId) {
      return NextResponse.json(
        { error: 'analysis_id is required' },
        { status: 400 }
      );
    }

    const history = getAnalysisChatHistory(analysisId);

    return NextResponse.json({ messages: history });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}
```

---

### Task 11: Create ChatBot Component

**Files:**
- Create: `src/components/ChatBot.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType: 'quick' | 'detailed';
}

interface ChatBotProps {
  projectId: string;
  analysisId: string;
}

export default function ChatBot({ projectId, analysisId }: ChatBotProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch chat history on mount or when analysisId changes
  useEffect(() => {
    async function fetchHistory() {
      setInitialLoading(true);
      try {
        const response = await fetch(`/api/chat?analysis_id=${analysisId}`);
        if (response.ok) {
          const data = await response.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Failed to fetch chat history:', error);
      } finally {
        setInitialLoading(false);
      }
    }

    if (analysisId) {
      fetchHistory();
    }
  }, [analysisId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Optimistically add user message
    const tempUserMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString(),
      responseType: 'quick',
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          analysis_id: analysisId,
          message: userMessage,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: data.id,
        role: 'assistant',
        content: data.content,
        timestamp: data.timestamp,
        responseType: data.responseType,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (initialLoading) {
    return (
      <div className="glass rounded-xl p-6">
        <div className="text-center text-gray-400">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        Ask about this codebase
      </h3>

      {/* Messages */}
      <div className="h-64 overflow-y-auto mb-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            Ask questions like "Which APIs are used in the products page?" or "How complex would it be to add authentication?"
          </div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-500/20 text-purple-100'
                    : 'bg-white/5 text-gray-300'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
                {msg.role === 'assistant' && (
                  <div className="mt-1 text-xs text-gray-500">
                    {msg.responseType === 'detailed' ? 'Detailed response' : 'Quick answer'}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/5 rounded-lg p-3 text-gray-400 text-sm">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about this codebase..."
          disabled={loading}
          className="flex-1 input-dark rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="btn-primary px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
```

---

### Task 12: Create Tabs Component

**Files:**
- Create: `src/components/Tabs.tsx`

**Step 1: Create reusable tabs component**

```typescript
'use client';

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export default function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex border-b border-white/10">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === tab.id
              ? 'text-purple-400'
              : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          {tab.label}
          {activeTab === tab.id && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500" />
          )}
        </button>
      ))}
    </div>
  );
}
```

---

### Task 13: Create Analysis Version Selector Component

**Files:**
- Create: `src/components/AnalysisVersionSelector.tsx`

**Step 1: Create the dropdown component**

```typescript
'use client';

interface Version {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
}

interface AnalysisVersionSelectorProps {
  versions: Version[];
  selectedVersion: string;
  onChange: (versionId: string) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return date.toLocaleDateString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function AnalysisVersionSelector({
  versions,
  selectedVersion,
  onChange,
}: AnalysisVersionSelectorProps) {
  if (versions.length === 0) {
    return null;
  }

  const selectedVersionData = versions.find(v => v.id === selectedVersion);

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-400">Version:</label>
      <select
        value={selectedVersion}
        onChange={e => onChange(e.target.value)}
        className="input-dark rounded-lg px-3 py-1.5 text-sm text-white bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
      >
        {versions.map(version => (
          <option key={version.id} value={version.id}>
            {version.is_latest ? 'Latest - ' : ''}
            {formatDate(version.analyzed_at)}
          </option>
        ))}
      </select>
      {selectedVersionData && (
        <span className="text-xs text-gray-500">
          ({formatRelativeTime(selectedVersionData.analyzed_at)})
        </span>
      )}
    </div>
  );
}
```

---

## Phase 3: Project Detail Page Restructure

### Task 14: Extract Architecture Diagram Component

**Files:**
- Create: `src/components/ArchitectureDiagram.tsx`

**Step 1: Extract the MVC visualization from report page**

```typescript
'use client';

import { useState, useMemo, useCallback } from 'react';

interface ArchitectureNode {
  id: string;
  name: string;
  type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
  complexity: 'low' | 'medium' | 'high';
  description: string;
  files: string[];
}

interface ArchitectureEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
}

interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

type MVCLayer = 'view' | 'controller' | 'model';

interface MVCComponent {
  id: string;
  name: string;
  layer: MVCLayer;
  originalType: string;
  complexity: 'low' | 'medium' | 'high';
  files: string[];
  description: string;
}

interface ArchitectureDiagramProps {
  architecture: ArchitectureVisualization;
}

export default function ArchitectureDiagram({ architecture }: ArchitectureDiagramProps) {
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null);

  // Map architecture nodes to MVC layers
  const mvcComponents = useMemo(() => {
    if (!architecture?.nodes) return [];

    return architecture.nodes.map((node): MVCComponent => {
      let layer: MVCLayer = 'controller';

      if (node.type === 'ui' || node.type === 'component') {
        layer = 'view';
      } else if (node.type === 'api') {
        layer = 'controller';
      } else if (node.type === 'service' || node.type === 'database') {
        layer = 'model';
      } else if (node.type === 'external') {
        layer = 'model';
      }

      return {
        id: node.id,
        name: node.name,
        layer,
        originalType: node.type,
        complexity: node.complexity,
        files: node.files,
        description: node.description,
      };
    });
  }, [architecture]);

  // Group components by layer
  const componentsByLayer = useMemo(() => {
    const grouped = {
      view: [] as MVCComponent[],
      controller: [] as MVCComponent[],
      model: [] as MVCComponent[],
    };

    mvcComponents.forEach(comp => {
      grouped[comp.layer].push(comp);
    });

    return grouped;
  }, [mvcComponents]);

  // Get layers affected by selected component
  const getAffectedLayers = useCallback((componentId: string | null) => {
    if (!componentId || !architecture) return [];

    const component = mvcComponents.find(c => c.id === componentId);
    if (!component) return [];

    const affectedLayers = new Set<MVCLayer>([component.layer]);

    const findConnected = (nodeId: string, visited: Set<string>) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      architecture.edges.forEach(edge => {
        if (edge.from === nodeId) {
          const targetComp = mvcComponents.find(c => c.id === edge.to);
          if (targetComp) {
            affectedLayers.add(targetComp.layer);
            findConnected(edge.to, visited);
          }
        }
        if (edge.to === nodeId) {
          const sourceComp = mvcComponents.find(c => c.id === edge.from);
          if (sourceComp) {
            affectedLayers.add(sourceComp.layer);
            findConnected(edge.from, visited);
          }
        }
      });
    };

    findConnected(componentId, new Set());

    return Array.from(affectedLayers);
  }, [architecture, mvcComponents]);

  const getComplexityBadge = (complexity: 'low' | 'medium' | 'high') => {
    switch (complexity) {
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/40';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/40';
    }
  };

  const selectedComponentData = selectedComponent
    ? mvcComponents.find(c => c.id === selectedComponent)
    : null;

  const affectedLayers = selectedComponent ? getAffectedLayers(selectedComponent) : [];
  const layerCount = affectedLayers.length;

  if (!architecture || architecture.nodes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No architecture data available
      </div>
    );
  }

  return (
    <div>
      {/* Simple Summary Stats */}
      <div className="mb-4 text-sm text-gray-400">
        View: {componentsByLayer.view.length} | Controller: {componentsByLayer.controller.length} | Model: {componentsByLayer.model.length}
      </div>

      {/* Main Layout */}
      <div className="flex gap-6">
        {/* Left: MVC Flow Diagram */}
        <div className="flex-1">
          {/* Horizontal Flow */}
          <div className="flex items-center justify-between mb-6">
            {/* View Layer */}
            <div className="flex-1 p-3 rounded-xl border backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)',
                borderColor: 'rgba(168, 85, 247, 0.3)',
              }}>
              <div className="text-center">
                <h3 className="font-semibold text-purple-400 text-sm">View</h3>
                <p className="text-xs text-gray-500">UI</p>
              </div>
            </div>

            <div className="px-2 text-gray-500">
              <svg width="30" height="16" viewBox="0 0 30 16">
                <line x1="0" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" />
                <polygon points="22,4 30,8 22,12" fill="currentColor" />
              </svg>
            </div>

            {/* Controller Layer */}
            <div className="flex-1 p-3 rounded-xl border backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
                borderColor: 'rgba(59, 130, 246, 0.3)',
              }}>
              <div className="text-center">
                <h3 className="font-semibold text-blue-400 text-sm">Controller</h3>
                <p className="text-xs text-gray-500">API</p>
              </div>
            </div>

            <div className="px-2 text-gray-500">
              <svg width="30" height="16" viewBox="0 0 30 16">
                <line x1="0" y1="8" x2="22" y2="8" stroke="currentColor" strokeWidth="2" />
                <polygon points="22,4 30,8 22,12" fill="currentColor" />
              </svg>
            </div>

            {/* Model Layer */}
            <div className="flex-1 p-3 rounded-xl border backdrop-blur-sm"
              style={{
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(22, 163, 74, 0.05) 100%)',
                borderColor: 'rgba(34, 197, 94, 0.3)',
              }}>
              <div className="text-center">
                <h3 className="font-semibold text-green-400 text-sm">Model</h3>
                <p className="text-xs text-gray-500">Data</p>
              </div>
            </div>
          </div>

          {/* Component Cards */}
          <div className="grid grid-cols-3 gap-3">
            {/* View Components */}
            <div className="space-y-2">
              {componentsByLayer.view.length === 0 ? (
                <div className="text-xs text-gray-500 italic">None</div>
              ) : (
                componentsByLayer.view.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedComponent === comp.id
                        ? 'bg-purple-500/20 border-purple-500 ring-1 ring-purple-500/50'
                        : 'bg-white/5 border-white/10 hover:border-purple-500/50'
                    }`}
                  >
                    <div className="font-medium text-xs text-white truncate">{comp.name}</div>
                    <span className={`text-xs px-1 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                      {comp.complexity}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Controller Components */}
            <div className="space-y-2">
              {componentsByLayer.controller.length === 0 ? (
                <div className="text-xs text-gray-500 italic">None</div>
              ) : (
                componentsByLayer.controller.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedComponent === comp.id
                        ? 'bg-blue-500/20 border-blue-500 ring-1 ring-blue-500/50'
                        : 'bg-white/5 border-white/10 hover:border-blue-500/50'
                    }`}
                  >
                    <div className="font-medium text-xs text-white truncate">{comp.name}</div>
                    <span className={`text-xs px-1 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                      {comp.complexity}
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Model Components */}
            <div className="space-y-2">
              {componentsByLayer.model.length === 0 ? (
                <div className="text-xs text-gray-500 italic">None</div>
              ) : (
                componentsByLayer.model.map(comp => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedComponent(selectedComponent === comp.id ? null : comp.id)}
                    className={`w-full text-left p-2 rounded-lg border transition-colors ${
                      selectedComponent === comp.id
                        ? 'bg-green-500/20 border-green-500 ring-1 ring-green-500/50'
                        : 'bg-white/5 border-white/10 hover:border-green-500/50'
                    }`}
                  >
                    <div className="font-medium text-xs text-white truncate">{comp.name}</div>
                    <span className={`text-xs px-1 py-0.5 rounded border ${getComplexityBadge(comp.complexity)}`}>
                      {comp.complexity}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Detail Panel */}
        <div className="w-64 flex-shrink-0">
          <div className="p-3 rounded-xl border bg-white/5 border-white/10 min-h-[200px]">
            {selectedComponentData ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-white text-sm">{selectedComponentData.name}</h3>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Description</div>
                  <div className="text-xs text-gray-300">
                    {selectedComponentData.description || 'No description'}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Files ({selectedComponentData.files.length})</div>
                  <div className="space-y-0.5 max-h-20 overflow-y-auto">
                    {selectedComponentData.files.map((file, i) => (
                      <div key={i} className="text-xs text-gray-400 truncate">{file}</div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Impact</div>
                  <div className={`text-xs font-medium ${
                    layerCount === 1 ? 'text-green-400' :
                    layerCount === 2 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {layerCount} layer{layerCount !== 1 ? 's' : ''} affected
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-xs">
                Click a component
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 15: Restructure Project Detail Page with Tabs

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`

**Step 1: Complete rewrite with tabs, architecture, and chatbot**

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Tabs from '@/components/Tabs';
import ArchitectureDiagram from '@/components/ArchitectureDiagram';
import AnalysisVersionSelector from '@/components/AnalysisVersionSelector';
import ChatBot from '@/components/ChatBot';

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

interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

interface ArchitectureVisualization {
  nodes: Array<{
    id: string;
    name: string;
    type: string;
    complexity: 'low' | 'medium' | 'high';
    description: string;
    files: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: string;
  }>;
}

interface Analysis {
  id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  analyzed_at: string;
}

interface AnalysisVersion {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
}

export default function ProjectDetail() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [versions, setVersions] = useState<AnalysisVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('architecture');

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

  const fetchVersions = useCallback(async () => {
    try {
      const response = await fetch(`/api/analysis/versions/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setVersions(data.versions || []);
        if (data.versions?.length > 0 && !selectedVersion) {
          setSelectedVersion(data.versions[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, [projectId, selectedVersion]);

  const fetchAnalysis = useCallback(async (versionId?: string) => {
    try {
      const url = versionId
        ? `/api/analysis/${projectId}?version=${versionId}`
        : `/api/analysis/${projectId}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data);
      }
    } catch (err) {
      console.error('Failed to fetch analysis:', err);
    }
  }, [projectId]);

  useEffect(() => {
    Promise.all([fetchProject(), fetchDocuments(), fetchVersions()]).finally(() =>
      setLoading(false)
    );
  }, [fetchProject, fetchDocuments, fetchVersions]);

  useEffect(() => {
    if (selectedVersion) {
      fetchAnalysis(selectedVersion);
    }
  }, [selectedVersion, fetchAnalysis]);

  const handleVersionChange = (versionId: string) => {
    setSelectedVersion(versionId);
  };

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
      await fetchVersions();
      // Select the new version
      if (data.id) {
        setSelectedVersion(data.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
      await fetchProject();
    } finally {
      setAnalyzing(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf': return '📄';
      case 'markdown': return '📝';
      case 'text': return '📃';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high': return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'low': return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      default: return '';
    }
  };

  const getLastAnalyzedText = () => {
    if (versions.length === 0) return null;
    const latest = versions[0];
    const date = new Date(latest.analyzed_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Last analysed today';
    if (diffDays === 1) return 'Last analysed yesterday';
    return `Last analysed ${diffDays} days ago`;
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading project...</div>;
  }

  if (!project) {
    return <div className="text-center py-12 text-gray-400">Project not found</div>;
  }

  const tabs = [
    { id: 'architecture', label: 'Architecture' },
    { id: 'issues', label: `Issues${analysis ? ` (${analysis.findings.length})` : ''}` },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/" className="text-purple-400 hover:text-purple-300 text-sm transition-colors">
          ← Back to Projects
        </Link>
      </div>

      {/* Project Header */}
      <div className="glass rounded-xl p-6 mb-6">
        <h1 className="text-2xl font-bold text-white">{project.name}</h1>
        {project.description && (
          <p className="text-gray-400 mt-2">{project.description}</p>
        )}
        <p className="text-gray-500 text-sm mt-2">{project.github_url}</p>
        {getLastAnalyzedText() && (
          <p className="text-gray-500 text-xs mt-1">{getLastAnalyzedText()}</p>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="glass rounded-xl mb-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        <div className="p-6">
          {activeTab === 'architecture' && (
            <>
              {/* Version selector and Run Analysis */}
              <div className="flex items-center justify-between mb-6">
                {versions.length > 0 && (
                  <AnalysisVersionSelector
                    versions={versions}
                    selectedVersion={selectedVersion}
                    onChange={handleVersionChange}
                  />
                )}
                <button
                  onClick={runAnalysis}
                  disabled={analyzing || documents.length === 0}
                  className="btn-primary px-4 py-2 text-white text-sm font-medium rounded-lg"
                >
                  {analyzing ? 'Analyzing...' : 'Run Analysis'}
                </button>
              </div>

              {/* Architecture Diagram */}
              {analysis?.architecture ? (
                <ArchitectureDiagram architecture={analysis.architecture} />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  {project.status === 'analyzing'
                    ? 'Analysis in progress...'
                    : 'No analysis yet. Upload documents and run analysis.'}
                </div>
              )}

              {/* Chatbot */}
              {analysis && selectedVersion && (
                <div className="mt-6">
                  <ChatBot projectId={projectId} analysisId={selectedVersion} />
                </div>
              )}
            </>
          )}

          {activeTab === 'issues' && (
            <>
              {analysis?.findings && analysis.findings.length > 0 ? (
                <div className="space-y-3">
                  {analysis.findings.map((finding, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 border ${getSeverityClass(finding.severity)}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-white text-sm">{finding.title}</h3>
                        <span className="text-xs font-medium px-2 py-1 rounded-full bg-white/10">
                          {finding.severity.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300">{finding.description}</p>
                    </div>
                  ))}
                  <Link
                    href={`/projects/${projectId}/report`}
                    className="block text-center text-purple-400 hover:text-purple-300 text-sm mt-4"
                  >
                    View full report →
                  </Link>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  No issues found
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Documents Section */}
      <div className="glass rounded-xl p-6">
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
            Upload PRD, BRD, wireframes, or other requirements documents
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
              <li key={doc.id} className="py-3 flex justify-between items-center">
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
    </div>
  );
}
```

---

### Task 16: Simplify Report Page

**Files:**
- Modify: `src/app/projects/[id]/report/page.tsx`

**Step 1: Remove architecture diagram, keep detailed findings**

The report page should be simplified to focus on detailed findings. Remove the entire MVC visualization section and keep only:
- Back link
- Report header with date
- Executive summary
- Issues overview (counts)
- Detailed findings

Keep the existing findings display code but remove lines 310-573 (the entire architecture visualization section).

---

### Task 17: Update Analyze API to Return Analysis ID

**Files:**
- Modify: `src/app/api/analyze/route.ts`

**Step 1: Return the analysis ID in the response**

After creating the analysis result, include the ID in the response:

```typescript
// After analysis is created, return the analysis ID
return NextResponse.json({
  success: true,
  id: analysisResult.id,
  message: 'Analysis completed'
});
```

---

## Testing

### Task 18: Manual Testing Checklist

**Test the following flows:**

1. **Project Creation with Auto-Analysis**
   - Create new project with public repo
   - Verify analysis starts automatically
   - Verify repo is cloned to `data/repos/{projectId}`

2. **Architecture Tab**
   - View architecture diagram on project detail page
   - Click components to see details
   - Verify layer impact indicators work

3. **Chatbot**
   - Ask "What files are in this project?"
   - Ask "How would I add a new API endpoint?"
   - Verify quick vs detailed responses
   - Verify chat history persists per analysis version

4. **Version Management**
   - Run analysis again
   - Verify dropdown shows both versions
   - Switch versions, verify chat history switches
   - Verify "Last analysed X days ago" text

5. **Issues Tab**
   - View issues on project detail page
   - Click "View full report" link
   - Verify report page shows detailed findings

---

## Summary

This plan covers 18 tasks across 3 phases:
- **Phase 1 (Tasks 1-8):** Database, services, and API foundation
- **Phase 2 (Tasks 9-13):** Chatbot service, API, and components
- **Phase 3 (Tasks 14-18):** UI restructure and testing

Each task is atomic and can be committed independently.
