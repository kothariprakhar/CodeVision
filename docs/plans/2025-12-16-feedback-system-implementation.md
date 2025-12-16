# Feedback System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a comprehensive feedback system with floating widget, slide-out panel, and proactive prompts after analysis completion.

**Architecture:** Global floating button triggers glass-morphism slide-out panel. Feedback submissions stored in Supabase, sent to admins via Resend. Proactive toast prompts appear 12 seconds after first analysis completion using localStorage tracking.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase, Resend, Zod

---

## Task 1: Create Supabase Feedback Table

**Files:**
- Create: SQL migration (run manually in Supabase SQL Editor)
- Reference: Design doc at `docs/plans/2025-12-16-feedback-system-design.md`

**Step 1: Create the feedback table schema**

Open Supabase SQL Editor and run:

```sql
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('bug_report', 'feature_request', 'general_feedback')),
  message TEXT NOT NULL,
  page_url VARCHAR(500) NOT NULL,
  project_id UUID REFERENCES projects(id),
  browser_info JSONB NOT NULL,
  console_logs JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved'))
);

CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Add RLS policies
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT
  USING (auth.uid() = user_id);
```

**Step 2: Verify table creation**

Run in Supabase SQL Editor:
```sql
SELECT * FROM feedback LIMIT 1;
```

Expected: Empty result set (table exists)

**Step 3: Document completion**

Create file documenting the migration:

```bash
echo "Feedback table created on $(date)" > docs/migrations/feedback-table.txt
```

**Step 4: Commit**

```bash
git add docs/migrations/feedback-table.txt
git commit -m "docs: record feedback table migration"
```

---

## Task 2: Update Email Service for Rich Feedback

**Files:**
- Modify: `src/lib/services/email.ts`

**Step 1: Update FeedbackData interface**

Replace the existing `FeedbackData` interface (lines 41-46) with enhanced version:

```typescript
interface FeedbackData {
  user_email: string;
  user_id: string;
  category: 'bug_report' | 'feature_request' | 'general_feedback';
  message: string;
  page_url: string;
  project_id?: string;
  project_name?: string;
  browser_info: {
    user_agent: string;
    screen_width: number;
    screen_height: number;
    viewport_width: number;
    viewport_height: number;
  };
  console_logs?: Array<{
    level: 'error' | 'warn';
    message: string;
    timestamp: number;
  }>;
}
```

**Step 2: Enhance sendFeedbackNotification function**

Replace the existing `sendFeedbackNotification` function (lines 94-122) with enhanced version:

```typescript
export async function sendFeedbackNotification(data: FeedbackData) {
  const adminEmails = await getAdminEmails();
  const resend = getResendClient();

  // Category badge colors
  const categoryColors = {
    bug_report: '#EF4444',
    feature_request: '#3B82F6',
    general_feedback: '#6B7280',
  };

  const categoryLabels = {
    bug_report: '🐛 Bug Report',
    feature_request: '✨ Feature Request',
    general_feedback: '💬 General Feedback',
  };

  const categoryColor = categoryColors[data.category];
  const categoryLabel = categoryLabels[data.category];

  // Browser info summary
  const browserSummary = `${data.browser_info.user_agent.split(' ')[0]} | ${data.browser_info.screen_width}x${data.browser_info.screen_height}`;

  // Recent errors section
  const errorsHtml = data.console_logs && data.console_logs.length > 0
    ? `
      <h3 style="margin-top: 20px; color: #EF4444;">Recent Console Errors</h3>
      <ul style="background: #FEF2F2; padding: 15px; border-radius: 8px;">
        ${data.console_logs.map(log => `
          <li style="margin: 5px 0; font-family: monospace; font-size: 12px;">
            <strong>[${log.level}]</strong> ${log.message}
            <span style="color: #666; font-size: 11px;">(${new Date(log.timestamp).toLocaleTimeString()})</span>
          </li>
        `).join('')}
      </ul>
    `
    : '';

  // Project link section
  const projectHtml = data.project_id && data.project_name
    ? `<p><strong>Project:</strong> ${data.project_name} (<code>${data.project_id}</code>)</p>`
    : '';

  const { error } = await resend.emails.send({
    from: 'Code Vision <noreply@yourdomain.com>',
    to: adminEmails,
    subject: `[Code Vision] ${categoryLabel} from ${data.user_email}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <div style="background: ${categoryColor}; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${categoryLabel}</h2>
        </div>

        <div style="border: 1px solid #E5E7EB; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p><strong>From:</strong> ${data.user_email}</p>
          <p><strong>User ID:</strong> <code>${data.user_id}</code></p>
          ${projectHtml}
          <p><strong>Page:</strong> <a href="${data.page_url}">${data.page_url}</a></p>
          <p><strong>Browser:</strong> ${browserSummary}</p>

          <h3 style="margin-top: 20px;">Message</h3>
          <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; white-space: pre-wrap;">
${data.message}
          </div>

          ${errorsHtml}

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #E5E7EB;" />
          <p style="color: #666; font-size: 12px;">
            Submitted at ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send feedback notification:', error);
    throw error;
  }

  return { success: true };
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 4: Commit**

```bash
git add src/lib/services/email.ts
git commit -m "feat: enhance feedback email with rich context"
```

---

## Task 3: Create Console Logger Utility

**Files:**
- Create: `src/lib/utils/console-logger.ts`

**Step 1: Create console logger utility**

```typescript
// ABOUTME: Console logger utility that captures recent errors and warnings
// ABOUTME: Maintains a rolling buffer of last 10 console messages for feedback context

interface ConsoleLog {
  level: 'error' | 'warn';
  message: string;
  timestamp: number;
}

const MAX_LOGS = 10;
const consoleBuffer: ConsoleLog[] = [];

// Store original console methods
const originalError = console.error;
const originalWarn = console.warn;

// Flag to prevent double initialization
let initialized = false;

export function initializeConsoleLogger() {
  if (initialized) return;
  initialized = true;

  // Override console.error
  console.error = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    consoleBuffer.push({
      level: 'error',
      message,
      timestamp: Date.now(),
    });

    // Keep only last 10 entries
    if (consoleBuffer.length > MAX_LOGS) {
      consoleBuffer.shift();
    }

    // Call original console.error
    originalError(...args);
  };

  // Override console.warn
  console.warn = (...args: any[]) => {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');

    consoleBuffer.push({
      level: 'warn',
      message,
      timestamp: Date.now(),
    });

    // Keep only last 10 entries
    if (consoleBuffer.length > MAX_LOGS) {
      consoleBuffer.shift();
    }

    // Call original console.warn
    originalWarn(...args);
  };
}

export function getRecentConsoleLogs(): ConsoleLog[] {
  return consoleBuffer.slice();
}

export function clearConsoleLogs() {
  consoleBuffer.length = 0;
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/lib/utils/console-logger.ts
git commit -m "feat: add console logger utility for feedback context"
```

---

## Task 4: Create Feedback API Endpoint

**Files:**
- Create: `src/app/api/feedback/route.ts`

**Step 1: Create the API endpoint**

```typescript
// ABOUTME: API endpoint for handling user feedback submissions
// ABOUTME: Validates input, stores in Supabase, sends email notifications to admins

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendFeedbackNotification } from '@/lib/services/email';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// Lazy initialization for Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not set in environment variables');
  }
  return createClient(url, key);
}

const BrowserInfoSchema = z.object({
  user_agent: z.string(),
  screen_width: z.number(),
  screen_height: z.number(),
  viewport_width: z.number(),
  viewport_height: z.number(),
});

const ConsoleLogSchema = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string(),
  timestamp: z.number(),
});

const FeedbackSchema = z.object({
  category: z.enum(['bug_report', 'feature_request', 'general_feedback']),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  page_url: z.string().url(),
  project_id: z.string().uuid().optional(),
  browser_info: BrowserInfoSchema,
  console_logs: z.array(ConsoleLogSchema).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    // Get authenticated user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = FeedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { category, message, page_url, project_id, browser_info, console_logs } = parsed.data;

    // Get project name if project_id provided
    let project_name: string | undefined;
    if (project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', project_id)
        .single();

      if (project) {
        project_name = project.name;
      }
    }

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        user_email: user.email,
        category,
        message,
        page_url,
        project_id: project_id || null,
        browser_info,
        console_logs: console_logs || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert feedback:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    // Send email notification to admins
    try {
      await sendFeedbackNotification({
        user_email: user.email,
        user_id: user.id,
        category,
        message,
        page_url,
        project_id,
        project_name,
        browser_info,
        console_logs,
      });
    } catch (emailError) {
      console.error('Failed to send feedback email:', emailError);
      // Don't fail the request if email fails - feedback is still saved
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds, route registered at `/api/feedback`

**Step 3: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: add feedback API endpoint"
```

---

## Task 5: Create Floating Feedback Button Component

**Files:**
- Create: `src/components/FeedbackButton.tsx`

**Step 1: Create the feedback button component**

```typescript
// ABOUTME: Floating feedback button component visible globally
// ABOUTME: Triggers feedback panel when clicked, styled with purple gradient

'use client';

import React from 'react';

interface FeedbackButtonProps {
  onClick: () => void;
}

export default function FeedbackButton({ onClick }: FeedbackButtonProps) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-r from-purple-600 to-purple-700 rounded-full shadow-lg hover:scale-110 transition-transform duration-200 flex items-center justify-center z-[999] group animate-pulse-slow"
      aria-label="Send Feedback"
      title="Send Feedback"
    >
      {/* Speech bubble icon */}
      <svg
        className="w-6 h-6 text-white"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
        />
      </svg>

      {/* Tooltip on hover */}
      <span className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        Send Feedback
      </span>
    </button>
  );
}
```

**Step 2: Add custom animation to globals.css**

Add to `src/app/globals.css`:

```css
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.9;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 3s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/components/FeedbackButton.tsx src/app/globals.css
git commit -m "feat: add floating feedback button component"
```

---

## Task 6: Create Feedback Panel Component

**Files:**
- Create: `src/components/FeedbackPanel.tsx`

**Step 1: Create the feedback panel component**

```typescript
// ABOUTME: Slide-out feedback panel with glass-morphism design
// ABOUTME: Captures feedback category, message, and automatic context (browser, console logs, page)

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { getRecentConsoleLogs } from '@/lib/utils/console-logger';

interface FeedbackPanelProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
}

export default function FeedbackPanel({ isOpen, onClose, projectId }: FeedbackPanelProps) {
  const { user } = useAuth();
  const [category, setCategory] = useState<'bug_report' | 'feature_request' | 'general_feedback'>('general_feedback');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Reset form when panel opens
  useEffect(() => {
    if (isOpen) {
      setCategory('general_feedback');
      setMessage('');
      setError('');
      setSuccess(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      // Gather browser context
      const browserInfo = {
        user_agent: navigator.userAgent,
        screen_width: window.screen.width,
        screen_height: window.screen.height,
        viewport_width: window.innerWidth,
        viewport_height: window.innerHeight,
      };

      // Get console logs
      const consoleLogs = getRecentConsoleLogs();

      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message,
          page_url: window.location.href,
          project_id: projectId,
          browser_info: browserInfo,
          console_logs: consoleLogs.length > 0 ? consoleLogs : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-[998] animate-fade-in"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-gradient-to-br from-gray-900/95 to-purple-900/95 backdrop-blur-xl shadow-2xl z-[999] animate-slide-in-right">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold gradient-text">Send Feedback</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 h-[calc(100%-80px)] flex flex-col">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
              ✓ Thanks for your feedback!
            </div>
          )}

          {/* Category Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="input-dark w-full px-4 py-3 rounded-lg"
              disabled={submitting}
            >
              <option value="general_feedback">💬 General Feedback</option>
              <option value="bug_report">🐛 Bug Report</option>
              <option value="feature_request">✨ Feature Request</option>
            </select>
          </div>

          {/* Message */}
          <div className="mb-6 flex-1 flex flex-col">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              className="input-dark w-full px-4 py-3 rounded-lg resize-none flex-1"
              maxLength={1000}
              required
              disabled={submitting}
            />
            <p className="mt-2 text-xs text-gray-500 text-right">
              {message.length}/1000 characters
            </p>
          </div>

          {/* Footer */}
          <div className="border-t border-white/10 pt-4">
            <p className="text-xs text-gray-500 mb-4">
              We'll receive your email and page context to help us respond
            </p>
            <button
              type="submit"
              disabled={submitting || !message.trim() || success}
              className="btn-primary w-full px-6 py-3 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Submitting...' : success ? '✓ Submitted' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
```

**Step 2: Add animations to globals.css**

Add to `src/app/globals.css`:

```css
@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
```

**Step 3: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Commit**

```bash
git add src/components/FeedbackPanel.tsx src/app/globals.css
git commit -m "feat: add feedback panel component with glass design"
```

---

## Task 7: Create Feedback Prompt Component

**Files:**
- Create: `src/components/FeedbackPrompt.tsx`

**Step 1: Create the proactive feedback prompt**

```typescript
// ABOUTME: Proactive feedback prompt that appears after analysis completion
// ABOUTME: Toast-style notification with auto-dismiss and localStorage tracking

'use client';

import React, { useEffect, useState } from 'react';

interface FeedbackPromptProps {
  onOpenFeedback: () => void;
  onDismiss: () => void;
}

export default function FeedbackPrompt({ onOpenFeedback, onDismiss }: FeedbackPromptProps) {
  const [visible, setVisible] = useState(true);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // Wait for fade-out animation
    }, 15000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  const handleGiveFeedback = () => {
    setVisible(false);
    onOpenFeedback();
  };

  return (
    <div
      className={`fixed bottom-24 right-6 w-80 glass rounded-xl p-4 shadow-xl z-[998] transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-white">How was your analysis experience?</h3>
        <button
          onClick={handleDismiss}
          className="text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p className="text-sm text-gray-300 mb-4">
        We'd love to hear your thoughts to improve CodeVision.
      </p>

      <div className="flex gap-2">
        <button
          onClick={handleGiveFeedback}
          className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Give Feedback
        </button>
        <button
          onClick={handleDismiss}
          className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/components/FeedbackPrompt.tsx
git commit -m "feat: add proactive feedback prompt component"
```

---

## Task 8: Integrate Feedback System in Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

**Step 1: Convert layout to client component with feedback state**

Replace the entire contents of `src/app/layout.tsx`:

```typescript
// ABOUTME: Root layout with global navigation and feedback system
// ABOUTME: Initializes console logger and provides feedback button on all pages

'use client';

import { useEffect, useState } from 'react';
import './globals.css';
import NavBar from '@/components/NavBar';
import FeedbackButton from '@/components/FeedbackButton';
import FeedbackPanel from '@/components/FeedbackPanel';
import { initializeConsoleLogger } from '@/lib/utils/console-logger';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  // Initialize console logger on mount
  useEffect(() => {
    initializeConsoleLogger();
  }, []);

  return (
    <html lang="en">
      <head>
        <title>Code Vision - AI-Powered Code Quality Analysis</title>
        <meta name="description" content="Analyze code quality and requirements alignment with AI" />
      </head>
      <body className="min-h-screen text-white">
        <NavBar />
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Global Feedback System */}
        <FeedbackButton onClick={() => setFeedbackOpen(true)} />
        <FeedbackPanel
          isOpen={feedbackOpen}
          onClose={() => setFeedbackOpen(false)}
        />
      </body>
    </html>
  );
}
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds, feedback button visible on all pages

**Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: integrate feedback system in root layout"
```

---

## Task 9: Add Proactive Prompt to Project Page

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`

**Step 1: Add feedback prompt state and logic**

Add imports at the top of the file (after line 10):

```typescript
import FeedbackPrompt from '@/components/FeedbackPrompt';
import FeedbackPanel from '@/components/FeedbackPanel';
```

Add state variables inside the component (after existing useState declarations):

```typescript
const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
const [feedbackPanelOpen, setFeedbackPanelOpen] = useState(false);
```

Add useEffect for proactive prompt (after other useEffects):

```typescript
// Proactive feedback prompt after first analysis
useEffect(() => {
  if (analysis?.status === 'completed') {
    const hasSeenPrompt = localStorage.getItem('feedback_prompt_shown');

    if (!hasSeenPrompt) {
      // First-time user - show prompt after 12 second delay
      const timer = setTimeout(() => {
        setShowFeedbackPrompt(true);
        localStorage.setItem('feedback_prompt_shown', 'true');
      }, 12000);

      return () => clearTimeout(timer);
    }
  }
}, [analysis?.status]);
```

Add prompt and panel components before the closing component tag:

```typescript
{/* Proactive Feedback Prompt */}
{showFeedbackPrompt && (
  <FeedbackPrompt
    onOpenFeedback={() => {
      setShowFeedbackPrompt(false);
      setFeedbackPanelOpen(true);
    }}
    onDismiss={() => setShowFeedbackPrompt(false)}
  />
)}

{/* Feedback Panel (project-specific) */}
<FeedbackPanel
  isOpen={feedbackPanelOpen}
  onClose={() => setFeedbackPanelOpen(false)}
  projectId={project?.id}
/>
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 3: Commit**

```bash
git add src/app/projects/[id]/page.tsx
git commit -m "feat: add proactive feedback prompt to project page"
```

---

## Task 10: Final Testing and Verification

**Files:**
- Review all created files
- Test complete flow

**Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors

**Step 2: Manual testing checklist**

Start dev server: `npm run dev`

Test the following flows:

**Global Feedback Widget:**
1. Navigate to any page (home, projects list, project detail)
2. Verify floating purple button appears in bottom-right
3. Click button → verify panel slides in from right
4. Test category selection (Bug Report, Feature Request, General)
5. Type message → verify character counter updates
6. Submit feedback → verify success message appears
7. Verify panel closes automatically after success
8. Check admin email for notification with rich context

**Proactive Prompt:**
1. Create a new project or trigger analysis on existing project
2. Wait for analysis to complete
3. After 12 seconds, verify feedback prompt appears above button
4. Test "Give Feedback" → opens panel with project context
5. Test "Not now" → dismisses prompt
6. Verify prompt doesn't appear again (localStorage tracking)
7. Clear localStorage and repeat to test first-time behavior

**Error Scenarios:**
1. Try submitting empty message → verify validation error
2. Trigger console.error in browser console → verify logs captured
3. Submit feedback → verify console logs appear in email
4. Test on mobile/responsive → verify full-width panel

**Step 3: Verify Supabase data**

Check Supabase:
```sql
SELECT * FROM feedback ORDER BY created_at DESC LIMIT 5;
```

Expected: Feedback entries with all context fields populated

**Step 4: Commit any fixes**

If any issues found during testing, fix them and commit:
```bash
git add .
git commit -m "fix: resolve feedback system testing issues"
```

---

## Implementation Notes

### Manual Testing Only

This project has no automated testing infrastructure (no Jest/Vitest). All testing is manual via browser with build verification. This follows the established pattern from the onboarding wizard implementation.

### Email Configuration

The email notifications require:
- `RESEND_API_KEY` environment variable
- Verified domain in Resend dashboard
- Update `from` address in `email.ts` (line 69, 99)
- Admin emails configured in Supabase `admin_config` table

### Console Logger Initialization

The console logger is initialized in the root layout `useEffect`. This captures all console errors/warnings across the entire app for feedback context.

### LocalStorage Tracking

Proactive prompts use localStorage to track first-time users. The key is `feedback_prompt_shown` (boolean). Users can clear localStorage to see the prompt again.

### Glass-Morphism Styling

The feedback components use the `glass` utility class from Tailwind. Ensure your `tailwind.config.ts` has backdrop-blur enabled.

### Rate Limiting

Currently no rate limiting implemented. This is listed as a future enhancement in the design doc. If spam becomes an issue, add rate limiting to the API endpoint.

### Dependencies

All dependencies are already installed:
- Resend (for emails)
- Supabase (for database)
- Zod (for validation)
- React Hook Form (available but not used - simple controlled inputs instead)

---

## Task Summary

1. ✓ Create Supabase feedback table
2. ✓ Update email service for rich feedback
3. ✓ Create console logger utility
4. ✓ Create feedback API endpoint
5. ✓ Create floating feedback button
6. ✓ Create feedback panel component
7. ✓ Create feedback prompt component
8. ✓ Integrate in root layout
9. ✓ Add proactive prompt to project page
10. ✓ Final testing and verification

**Total Files Created**: 5
**Total Files Modified**: 4
**Total Commits**: 10
