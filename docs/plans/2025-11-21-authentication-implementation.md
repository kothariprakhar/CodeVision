# Authentication System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add email/password authentication with northwestern.edu domain restriction, JWT sessions, and user-scoped projects.

**Architecture:** Users table stores credentials, JWT tokens in HttpOnly cookies for sessions, auth middleware protects API routes, projects are filtered by user_id.

**Tech Stack:** bcryptjs for password hashing, jsonwebtoken for JWT, Next.js API routes, SQLite

---

## Phase 1: Core Auth Infrastructure

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install auth packages**

```bash
npm install bcryptjs jsonwebtoken
npm install -D @types/bcryptjs @types/jsonwebtoken
```

---

### Task 2: Update Database Schema

**Files:**
- Modify: `src/lib/schema.sql`
- Modify: `src/lib/db.ts`

**Step 1: Add users table and update projects table**

Update `src/lib/schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  github_url TEXT NOT NULL,
  github_token TEXT NOT NULL,
  repo_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

**Step 2: Add User type to db.ts**

Add to `src/lib/db.ts`:

```typescript
export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}
```

Update Project interface to include user_id:

```typescript
export interface Project {
  id: string;
  user_id: string;
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

**Step 3: Delete existing database**

```bash
rm -f data/database.sqlite
```

---

### Task 3: Create Users Repository

**Files:**
- Create: `src/lib/repositories/users.ts`

**Step 1: Create the repository**

```typescript
import db, { User } from '../db';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

export interface CreateUserInput {
  email: string;
  password: string;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const id = uuidv4();
  const password_hash = await bcrypt.hash(input.password, 10);

  const stmt = db.prepare(`
    INSERT INTO users (id, email, password_hash)
    VALUES (?, ?, ?)
  `);

  stmt.run(id, input.email.toLowerCase(), password_hash);

  return getUserById(id)!;
}

export function getUserById(id: string): User | null {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id) as User | null;
}

export function getUserByEmail(email: string): User | null {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email.toLowerCase()) as User | null;
}

export async function verifyPassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}
```

---

### Task 4: Create Auth Library

**Files:**
- Create: `src/lib/auth.ts`

**Step 1: Create JWT and cookie utilities**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { User } from './db';
import { getUserById } from './repositories/users';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE_NAME = 'auth_token';

export interface JWTPayload {
  userId: string;
  email: string;
}

export function createToken(user: User): string {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function setAuthCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function getUserFromRequest(request: NextRequest): User | null {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload) return null;

  return getUserById(payload.userId);
}

export function requireAuth(request: NextRequest): User {
  const user = getUserFromRequest(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export function isAllowedEmail(email: string): boolean {
  const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAINS || 'northwestern.edu')
    .split(',')
    .map(d => d.trim().toLowerCase());

  const emailLower = email.toLowerCase();

  return allowedDomains.some(domain => {
    return emailLower.endsWith(`@${domain}`) || emailLower.endsWith(`.${domain}`);
  });
}
```

---

## Phase 2: Auth API Routes

### Task 5: Create Signup Route

**Files:**
- Create: `src/app/api/auth/signup/route.ts`

**Step 1: Create the signup endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/repositories/users';
import { createToken, setAuthCookie, isAllowedEmail } from '@/lib/auth';
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Check email domain
    if (!isAllowedEmail(email)) {
      return NextResponse.json(
        { error: 'Email domain not allowed. Please use your northwestern.edu email.' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser = getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Create user
    const user = await createUser({ email, password });

    // Create token and set cookie
    const token = createToken(user);
    const response = NextResponse.json(
      { user: { id: user.id, email: user.email } },
      { status: 201 }
    );
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
```

---

### Task 6: Create Login Route

**Files:**
- Create: `src/app/api/auth/login/route.ts`

**Step 1: Create the login endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail, verifyPassword } from '@/lib/repositories/users';
import { createToken, setAuthCookie } from '@/lib/auth';
import { z } from 'zod';

const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Find user
    const user = getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await verifyPassword(user, password);
    if (!valid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Create token and set cookie
    const token = createToken(user);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email }
    });
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Failed to login' },
      { status: 500 }
    );
  }
}
```

---

### Task 7: Create Logout Route

**Files:**
- Create: `src/app/api/auth/logout/route.ts`

**Step 1: Create the logout endpoint**

```typescript
import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  clearAuthCookie(response);
  return response;
}
```

---

### Task 8: Create Me Route

**Files:**
- Create: `src/app/api/auth/me/route.ts`

**Step 1: Create the current user endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { user: null },
      { status: 200 }
    );
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email }
  });
}
```

---

## Phase 3: Protect Existing Routes

### Task 9: Update Projects Repository

**Files:**
- Modify: `src/lib/repositories/projects.ts`

**Step 1: Add user_id to CreateProjectInput and functions**

```typescript
import db, { Project, ProjectStatus } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectInput {
  user_id: string;
  name: string;
  description?: string;
  github_url: string;
  github_token: string;
  repo_path?: string;
}

export function createProject(input: CreateProjectInput): Project {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO projects (id, user_id, name, description, github_url, github_token, repo_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.user_id,
    input.name,
    input.description || null,
    input.github_url,
    input.github_token,
    input.repo_path || null
  );

  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  return stmt.get(id) as Project | null;
}

export function getProjectsByUser(userId: string): Project[] {
  const stmt = db.prepare('SELECT * FROM projects WHERE user_id = ? ORDER BY created_at DESC');
  return stmt.all(userId) as Project[];
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

export function updateProjectRepoPath(projectId: string, repoPath: string): void {
  const stmt = db.prepare(`
    UPDATE projects SET repo_path = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(repoPath, projectId);
}

export function deleteProject(id: string): void {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  stmt.run(id);
}
```

---

### Task 10: Protect Projects API

**Files:**
- Modify: `src/app/api/projects/route.ts`

**Step 1: Add auth to projects list and create**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjectsByUser } from '@/lib/repositories/projects';
import { validateGitHubAccess } from '@/lib/services/github';
import { analyzeProject } from '@/lib/services/analyzer';
import { getUserFromRequest } from '@/lib/auth';
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

export async function GET(request: NextRequest) {
  try {
    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projects = getProjectsByUser(user.id);
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
    const user = getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
      user_id: user.id,
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

### Task 11: Protect Project Detail API

**Files:**
- Modify: `src/app/api/projects/[id]/route.ts`

**Step 1: Add auth and ownership check**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getProject, deleteProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { cleanupProjectRepo } from '@/lib/services/github';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const project = getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(project);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const project = getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cleanup repo files
    cleanupProjectRepo(id);

    deleteProject(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}
```

---

### Task 12: Protect Analysis APIs

**Files:**
- Modify: `src/app/api/analyze/route.ts`
- Modify: `src/app/api/analysis/[projectId]/route.ts`
- Modify: `src/app/api/analysis/versions/[projectId]/route.ts`

**Step 1: Update analyze route**

Add to `src/app/api/analyze/route.ts` at the start of POST:

```typescript
import { getUserFromRequest } from '@/lib/auth';

// In POST function, add at start:
const user = getUserFromRequest(request);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// After getting project, add ownership check:
if (project.user_id !== user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Step 2: Update analysis/[projectId] route**

Add auth and ownership check to GET in `src/app/api/analysis/[projectId]/route.ts`:

```typescript
import { getUserFromRequest } from '@/lib/auth';
import { getProject } from '@/lib/repositories/projects';

// In GET function, add at start:
const user = getUserFromRequest(request);
if (!user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const { projectId } = await params;
const project = getProject(projectId);
if (!project || project.user_id !== user.id) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Step 3: Update analysis/versions/[projectId] route**

Same pattern for `src/app/api/analysis/versions/[projectId]/route.ts`.

---

### Task 13: Protect Documents API

**Files:**
- Modify: `src/app/api/documents/route.ts`
- Modify: `src/app/api/documents/[id]/route.ts`

**Step 1: Update documents route**

Add auth and ownership checks to both GET and POST in `src/app/api/documents/route.ts`.

**Step 2: Update documents/[id] route**

Add auth and ownership checks to DELETE in `src/app/api/documents/[id]/route.ts`.

---

### Task 14: Protect Chat API

**Files:**
- Modify: `src/app/api/chat/route.ts`

**Step 1: Add auth and ownership check**

Add to both POST and GET handlers.

---

## Phase 4: Frontend Auth

### Task 15: Create Auth Hook

**Files:**
- Create: `src/lib/hooks/useAuth.ts`

**Step 1: Create the hook**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
}

interface AuthState {
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });
  const router = useRouter();

  const fetchUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setState({ user: data.user, loading: false });
    } catch {
      setState({ user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState({ user: null, loading: false });
    router.push('/login');
  }, [router]);

  return { ...state, logout, refetch: fetchUser };
}
```

---

### Task 16: Create Login Page

**Files:**
- Create: `src/app/login/page.tsx`

**Step 1: Create the login page**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Welcome Back
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
              placeholder="you@northwestern.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-lg text-white font-medium"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          Don't have an account?{' '}
          <Link href="/signup" className="text-purple-400 hover:text-purple-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

### Task 17: Create Signup Page

**Files:**
- Create: `src/app/signup/page.tsx`

**Step 1: Create the signup page**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Signup failed');
      }

      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Create Account
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
              placeholder="you@northwestern.edu"
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be a northwestern.edu email address
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input-dark w-full rounded-lg px-4 py-2 text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3 rounded-lg text-white font-medium"
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link href="/login" className="text-purple-400 hover:text-purple-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
```

---

### Task 18: Update Layout with Auth Navigation

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Add auth-aware navigation**

Update the layout to include navigation with login/logout based on auth state. Create a separate NavBar component if needed.

---

### Task 19: Protect Frontend Pages

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`
- Modify: `src/app/projects/[id]/report/page.tsx`
- Modify: `src/app/projects/new/page.tsx`

**Step 1: Add auth checks**

Add useAuth hook to protected pages and redirect to /login if not authenticated:

```typescript
const { user, loading } = useAuth();
const router = useRouter();

useEffect(() => {
  if (!loading && !user) {
    router.push('/login');
  }
}, [user, loading, router]);

if (loading) {
  return <div>Loading...</div>;
}

if (!user) {
  return null;
}
```

---

### Task 20: Update Home Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Make home page auth-aware**

Update to show different content based on auth state:
- Logged out: Show landing/marketing content with login/signup CTAs
- Logged in: Show projects list (current behavior)

---

### Task 21: Update Environment Variables

**Files:**
- Modify: `.env.local` (create if doesn't exist)
- Modify: `.env.example` (create if doesn't exist)

**Step 1: Add auth environment variables**

```env
# .env.local
ALLOWED_EMAIL_DOMAINS=northwestern.edu
JWT_SECRET=your-random-32-character-secret-here

# .env.example
ALLOWED_EMAIL_DOMAINS=northwestern.edu
JWT_SECRET=change-this-to-a-random-secret
```

---

## Summary

This plan covers 21 tasks across 4 phases:
- **Phase 1 (Tasks 1-4):** Core auth infrastructure
- **Phase 2 (Tasks 5-8):** Auth API routes
- **Phase 3 (Tasks 9-14):** Protect existing routes
- **Phase 4 (Tasks 15-21):** Frontend auth

Each task is atomic and can be committed independently.
