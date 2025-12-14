# Northwestern Access & UX Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Code Vision into a Northwestern-exclusive platform with waitlist system, improved onboarding wizard, persistent feedback, and visual polish.

**Architecture:** React components with Next.js App Router, Supabase for data persistence, Resend for transactional emails, real-time form validation with smooth transitions.

**Tech Stack:** Next.js 16, React 19, TypeScript, Supabase, Resend, Tailwind CSS, Framer Motion (optional for animations)

---

## Phase 1: Foundation

### Task 1.1: Install Dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install Resend**

```bash
npm install resend
```

**Step 2: Install React Hook Form (for wizard)**

```bash
npm install react-hook-form
```

**Step 3: Verify installation**

Run: `npm ls resend react-hook-form`
Expected: Both packages listed without errors

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install resend and react-hook-form dependencies

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.2: Create Logo Component

**Files:**
- Create: `src/components/Logo.tsx`

**Step 1: Create Logo component file**

Create `/src/components/Logo.tsx`:

```typescript
// ABOUTME: Reusable logo component with SVG variants for navbar, favicon, and branding
// ABOUTME: Easily swappable by updating the SVG paths in one central location

interface LogoProps {
  className?: string;
}

interface LogoFullProps extends LogoProps {
  showText?: boolean;
}

// Icon-only version for favicon and compact spaces
export function LogoIcon({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <path
        d="M8 6L4 10L8 14M16 6L20 10L16 14M14 4L10 20"
        stroke="url(#logo-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Full logo with icon and text for navbar
export function LogoFull({ showText = true, className }: LogoFullProps) {
  return (
    <div className={`flex items-center gap-3 ${className || ''}`}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
        <LogoIcon className="w-6 h-6 text-white" />
      </div>
      {showText && (
        <span className="text-2xl font-bold gradient-text">Code Vision</span>
      )}
    </div>
  );
}

// Large mark for loading states and hero sections
export function LogoMark({ className = "w-20 h-20" }: LogoProps) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-blue-500 flex items-center justify-center shadow-2xl shadow-purple-500/30 ${className}`}>
      <LogoIcon className="w-1/2 h-1/2 text-white" />
    </div>
  );
}
```

**Step 2: Update NavBar to use Logo component**

Modify `/src/components/NavBar.tsx`:

Find lines 14-21 (the Link with inline SVG and text):

```typescript
<Link href="/" className="flex items-center gap-3 group">
  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:shadow-purple-500/30 transition-shadow">
    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  </div>
  <span className="text-2xl font-bold gradient-text">Code Vision</span>
</Link>
```

Replace with:

```typescript
import { LogoFull } from '@/components/Logo';

// ... in the component:
<Link href="/" className="group">
  <LogoFull className="group-hover:opacity-80 transition-opacity" />
</Link>
```

**Step 3: Test the Logo component**

Run: `npm run dev`
Navigate to: http://localhost:3000
Expected: Logo appears in navbar, maintains existing styling

**Step 4: Commit**

```bash
git add src/components/Logo.tsx src/components/NavBar.tsx
git commit -m "feat: add reusable Logo component with SVG variants

- LogoIcon for compact spaces
- LogoFull for navbar with text
- LogoMark for hero sections
- Update NavBar to use LogoFull component

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.3: Add Supabase Schema Migrations

**Files:**
- Create: `data/migrations/004_northwestern_features.sql`

**Step 1: Create migration file**

Create `/data/migrations/004_northwestern_features.sql`:

```sql
-- ABOUTME: Database schema for Northwestern access control, waitlist, and feedback features
-- ABOUTME: Includes admin configuration, waitlist requests, and feedback submissions tables

-- Admin configuration table for runtime config (email addresses, feature flags)
CREATE TABLE IF NOT EXISTS admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed admin config with default admin emails
INSERT INTO admin_config (key, value) VALUES
  ('admin_emails', '["admin@northwestern.edu"]'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Waitlist requests from non-Northwestern users
CREATE TABLE IF NOT EXISTS waitlist_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_waitlist_status ON waitlist_requests(status);
CREATE INDEX IF NOT EXISTS idx_waitlist_created ON waitlist_requests(created_at DESC);

-- Feedback submissions from users
CREATE TABLE IF NOT EXISTS feedback_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON feedback_submissions(user_id);
```

**Step 2: Check Supabase connection**

Check `.env.local` has Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Step 3: Run migration**

Note: Supabase migrations can be run via:
1. Supabase Dashboard SQL Editor (copy-paste the migration)
2. Or via Supabase CLI if installed

For now, copy the SQL from `data/migrations/004_northwestern_features.sql` and run it in Supabase Dashboard → SQL Editor.

**Step 4: Verify tables created**

In Supabase Dashboard → Table Editor:
Expected: See `admin_config`, `waitlist_requests`, `feedback_submissions` tables

**Step 5: Commit**

```bash
git add data/migrations/004_northwestern_features.sql
git commit -m "feat: add Supabase schema for Northwestern features

- admin_config table for runtime configuration
- waitlist_requests table for non-NW users
- feedback_submissions table for user feedback
- Seed admin_config with default admin email

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.4: Create Resend Email Service

**Files:**
- Create: `src/lib/services/email.ts`
- Create: `src/lib/email-templates/WaitlistNotification.tsx`
- Create: `src/lib/email-templates/FeedbackNotification.tsx`

**Step 1: Add Resend API key to environment**

Add to `.env.local`:
```
RESEND_API_KEY=re_your_api_key_here
```

Add to `.env.example`:
```
RESEND_API_KEY=re_xxxxx
```

**Step 2: Create email service helper**

Create `/src/lib/services/email.ts`:

```typescript
// ABOUTME: Email notification service using Resend for waitlist and feedback notifications
// ABOUTME: Fetches admin emails from Supabase admin_config table for dynamic recipient management

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface WaitlistData {
  email: string;
  name: string;
  organization?: string;
  reason: string;
}

interface FeedbackData {
  email: string;
  message: string;
  page_url?: string;
  user_id?: string;
}

async function getAdminEmails(): Promise<string[]> {
  const { data, error } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', 'admin_emails')
    .single();

  if (error || !data) {
    console.error('Failed to fetch admin emails:', error);
    return ['admin@northwestern.edu']; // Fallback
  }

  return data.value as string[];
}

export async function sendWaitlistNotification(data: WaitlistData) {
  const adminEmails = await getAdminEmails();

  const { error } = await resend.emails.send({
    from: 'Code Vision <noreply@yourdomain.com>', // Update with your verified domain
    to: adminEmails,
    subject: `[Code Vision] New Waitlist Request from ${data.name}`,
    html: `
      <h2>New Waitlist Request</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.organization ? `<p><strong>Organization:</strong> ${data.organization}</p>` : ''}
      <p><strong>Reason for Interest:</strong></p>
      <p>${data.reason}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Submitted at ${new Date().toLocaleString()}
      </p>
    `,
  });

  if (error) {
    console.error('Failed to send waitlist notification:', error);
    throw error;
  }

  return { success: true };
}

export async function sendFeedbackNotification(data: FeedbackData) {
  const adminEmails = await getAdminEmails();

  const { error } = await resend.emails.send({
    from: 'Code Vision <noreply@yourdomain.com>', // Update with your verified domain
    to: adminEmails,
    subject: `[Code Vision] New Feedback from ${data.email}`,
    html: `
      <h2>New Feedback Submission</h2>
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.user_id ? `<p><strong>User ID:</strong> ${data.user_id}</p>` : ''}
      ${data.page_url ? `<p><strong>Page:</strong> ${data.page_url}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${data.message}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Submitted at ${new Date().toLocaleString()}
      </p>
    `,
  });

  if (error) {
    console.error('Failed to send feedback notification:', error);
    throw error;
  }

  return { success: true };
}
```

**Step 3: Test email service (manual test)**

Note: You'll need a valid Resend API key and verified domain. For development, Resend allows sending to your own email without domain verification.

Create a test file `src/lib/services/__test-email.ts` (don't commit):
```typescript
import { sendWaitlistNotification } from './email';

sendWaitlistNotification({
  email: 'test@example.com',
  name: 'Test User',
  organization: 'Test Org',
  reason: 'Testing email service'
}).then(() => console.log('Email sent!'));
```

Run: `npx tsx src/lib/services/__test-email.ts`
Expected: Email received at admin email address

**Step 4: Commit**

```bash
git add src/lib/services/email.ts .env.example
git commit -m "feat: add Resend email service for notifications

- Email service helper with Resend integration
- sendWaitlistNotification for new waitlist requests
- sendFeedbackNotification for user feedback
- Fetches admin emails from Supabase admin_config

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.5: Add Northwestern Messaging to Landing Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Add Northwestern banner to logged-out landing page**

Modify `/src/app/page.tsx`, find the logged-out section (lines 76-143):

Add banner before the hero section (after `<div>` on line 78):

```typescript
{/* Northwestern Access Banner */}
<div className="mb-8 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-center">
  <p className="text-sm text-gray-300">
    🎓 Currently open to <span className="font-semibold text-purple-300">Northwestern University</span> community members.
    {' '}
    <span className="text-gray-400">Not affiliated?</span>
    {' '}
    <Link href="/signup" className="text-purple-400 hover:text-purple-300 underline transition-colors">
      Join the waitlist!
    </Link>
  </p>
</div>
```

**Step 2: Test the banner**

Run: `npm run dev`
Navigate to: http://localhost:3000 (logged out)
Expected: Purple banner appears above hero section with Northwestern messaging

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add Northwestern access banner to landing page

- Purple gradient banner with NW messaging
- Link to waitlist signup for non-NW users
- Positioned above hero section

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 1.6: Add Northwestern Messaging to Auth Pages

**Files:**
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/signup/page.tsx`

**Step 1: Add banner to login page**

Modify `/src/app/login/page.tsx`, add banner at the top of the form (after the opening form tag):

```typescript
{/* Northwestern Access Banner */}
<div className="mb-6 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-center">
  <p className="text-xs text-gray-400">
    Northwestern email required.{' '}
    <Link href="/signup" className="text-purple-400 hover:text-purple-300 underline transition-colors">
      Need access? Join waitlist
    </Link>
  </p>
</div>
```

Make sure to import Link at the top:
```typescript
import Link from 'next/link';
```

**Step 2: Add banner to signup page**

We'll add a more prominent banner to signup (since this is where waitlist logic will live).

Modify `/src/app/signup/page.tsx`, add banner before the form fields:

```typescript
{/* Northwestern Access Banner */}
<div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 text-center">
  <p className="text-sm text-gray-300">
    🎓 Open to <span className="font-semibold text-purple-300">Northwestern University</span> community members.
    <br />
    <span className="text-xs text-gray-400">
      Non-NW email? You'll be prompted to join our waitlist.
    </span>
  </p>
</div>
```

**Step 3: Test both pages**

Run: `npm run dev`
Navigate to: http://localhost:3000/login and /signup
Expected: Banners appear on both pages with appropriate messaging

**Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/signup/page.tsx
git commit -m "feat: add Northwestern messaging to auth pages

- Login page banner with waitlist link
- Signup page banner explaining NW requirement
- Prepare for inline waitlist form on signup

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 2: Waitlist System

### Task 2.1: Create Waitlist API Endpoint

**Files:**
- Create: `src/app/api/waitlist/route.ts`

**Step 1: Create waitlist API route**

Create `/src/app/api/waitlist/route.ts`:

```typescript
// ABOUTME: API endpoint for handling waitlist requests from non-Northwestern users
// ABOUTME: Validates email, saves to Supabase, sends admin notification via Resend

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWaitlistNotification } from '@/lib/services/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, organization, reason } = body;

    // Validation
    if (!email || !name || !reason) {
      return NextResponse.json(
        { error: 'Email, name, and reason are required' },
        { status: 400 }
      );
    }

    // Check if already on waitlist
    const { data: existing } = await supabase
      .from('waitlist_requests')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already on the waitlist' },
        { status: 409 }
      );
    }

    // Insert waitlist request
    const { data, error } = await supabase
      .from('waitlist_requests')
      .insert({
        email,
        name,
        organization: organization || null,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create waitlist request:', error);
      return NextResponse.json(
        { error: 'Failed to join waitlist' },
        { status: 500 }
      );
    }

    // Send email notification to admins
    try {
      await sendWaitlistNotification({ email, name, organization, reason });
    } catch (emailError) {
      console.error('Failed to send waitlist notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
      data,
    });
  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

**Step 2: Test the API endpoint**

Create a test file `__test-waitlist-api.http` (don't commit):
```
POST http://localhost:3000/api/waitlist
Content-Type: application/json

{
  "email": "test@example.com",
  "name": "Test User",
  "organization": "Test University",
  "reason": "I want to try Code Vision for my courses"
}
```

Run: `npm run dev`
Test with: REST client or `curl`
Expected: 200 response with success message

**Step 3: Verify in Supabase**

Check Supabase Dashboard → waitlist_requests table
Expected: New row with the test data

**Step 4: Commit**

```bash
git add src/app/api/waitlist/route.ts
git commit -m "feat: add waitlist API endpoint

- POST /api/waitlist for non-NW users
- Validates email, name, and reason
- Prevents duplicate waitlist entries
- Sends admin notification via Resend

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 2.2: Implement Inline Waitlist Form on Signup Page

**Files:**
- Modify: `src/app/signup/page.tsx`

**Step 1: Add email domain detection to signup form**

Modify `/src/app/signup/page.tsx`:

Add state for email domain detection:

```typescript
const [isNorthwestern, setIsNorthwestern] = useState<boolean | null>(null);
const [showWaitlistForm, setShowWaitlistForm] = useState(false);
const [waitlistData, setWaitlistData] = useState({
  name: '',
  organization: '',
  reason: '',
});
const [waitlistSuccess, setWaitlistSuccess] = useState(false);
```

Add email validation function:

```typescript
const checkEmailDomain = (email: string) => {
  if (!email) {
    setIsNorthwestern(null);
    setShowWaitlistForm(false);
    return;
  }

  const isNW = email.toLowerCase().endsWith('@northwestern.edu');
  setIsNorthwestern(isNW);
  setShowWaitlistForm(!isNW);
};
```

Update email input to trigger domain check:

```typescript
<input
  type="email"
  id="email"
  required
  className="input-dark w-full px-4 py-3 rounded-lg"
  value={formData.email}
  onChange={e => {
    const email = e.target.value;
    setFormData({ ...formData, email });
    checkEmailDomain(email);
  }}
  onBlur={e => checkEmailDomain(e.target.value)}
/>
```

**Step 2: Add waitlist form UI (conditionally rendered)**

After the email input field, add:

```typescript
{/* Northwestern Email Indicator */}
{isNorthwestern === true && (
  <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
    Northwestern email verified
  </div>
)}

{/* Waitlist Form Transition */}
{showWaitlistForm && (
  <div className="mt-6 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 animate-fade-in">
    <h3 className="text-lg font-semibold text-white mb-2">
      Not part of Northwestern? Join Our Waitlist!
    </h3>
    <p className="text-sm text-gray-400 mb-4">
      Help us keep Code Vision free for Northwestern students by joining our waitlist.
      We'll notify you when we expand access to other institutions.
    </p>

    {!waitlistSuccess ? (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Your Name *
          </label>
          <input
            type="text"
            required
            className="input-dark w-full px-4 py-3 rounded-lg"
            value={waitlistData.name}
            onChange={e => setWaitlistData({ ...waitlistData, name: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Organization / School
          </label>
          <input
            type="text"
            className="input-dark w-full px-4 py-3 rounded-lg"
            placeholder="Optional"
            value={waitlistData.organization}
            onChange={e => setWaitlistData({ ...waitlistData, organization: e.target.value })}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Why are you interested? *
          </label>
          <textarea
            required
            rows={3}
            className="input-dark w-full px-4 py-3 rounded-lg resize-none"
            placeholder="Tell us about your use case..."
            value={waitlistData.reason}
            onChange={e => setWaitlistData({ ...waitlistData, reason: e.target.value })}
          />
        </div>

        <button
          type="button"
          onClick={handleWaitlistSubmit}
          disabled={loading}
          className="btn-primary w-full px-6 py-3 text-white font-medium rounded-lg"
        >
          {loading ? 'Joining...' : 'Join Waitlist'}
        </button>
      </div>
    ) : (
      <div className="text-center py-6">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h4 className="text-lg font-semibold text-white mb-2">You're on the waitlist!</h4>
        <p className="text-sm text-gray-400">
          We'll email you at <span className="text-purple-300">{formData.email}</span> when we expand access.
        </p>
      </div>
    )}
  </div>
)}
```

**Step 3: Add waitlist submission handler**

Add handler function:

```typescript
const handleWaitlistSubmit = async () => {
  if (!waitlistData.name || !waitlistData.reason) {
    setError('Please fill in all required fields');
    return;
  }

  setLoading(true);
  setError('');

  try {
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.email,
        name: waitlistData.name,
        organization: waitlistData.organization,
        reason: waitlistData.reason,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to join waitlist');
    }

    setWaitlistSuccess(true);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to join waitlist');
  } finally {
    setLoading(false);
  }
};
```

**Step 4: Hide regular signup form when waitlist is shown**

Wrap the password and username fields in a conditional:

```typescript
{!showWaitlistForm && (
  <>
    {/* Username field */}
    {/* Password field */}
    {/* Submit button */}
  </>
)}
```

**Step 5: Test the inline waitlist form**

Run: `npm run dev`
Navigate to: http://localhost:3000/signup
Test cases:
1. Enter `test@northwestern.edu` → See green checkmark, regular signup
2. Enter `test@gmail.com` → See waitlist form transition
3. Fill waitlist form and submit → See success message

**Step 6: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: add inline waitlist form on signup page

- Real-time email domain detection
- Smooth transition to waitlist form for non-NW emails
- Green checkmark for Northwestern emails
- Success message after waitlist submission
- Emotional appeal for Northwestern community

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 3: Onboarding Wizard

### Task 3.1: Create Wizard Component Structure

**Files:**
- Create: `src/components/OnboardingWizard.tsx`
- Create: `src/components/wizard/WizardStep.tsx`
- Create: `src/components/wizard/ProgressBar.tsx`

**Step 1: Create WizardStep wrapper component**

Create `/src/components/wizard/WizardStep.tsx`:

```typescript
// ABOUTME: Reusable wizard step wrapper with fade-in animations
// ABOUTME: Provides consistent layout for each step in the onboarding flow

interface WizardStepProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export default function WizardStep({ title, description, children }: WizardStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold gradient-text mb-2">{title}</h2>
        {description && (
          <p className="text-gray-400">{description}</p>
        )}
      </div>
      <div className="max-w-2xl mx-auto">
        {children}
      </div>
    </div>
  );
}
```

**Step 2: Create ProgressBar component**

Create `/src/components/wizard/ProgressBar.tsx`:

```typescript
// ABOUTME: Visual progress indicator for multi-step wizard
// ABOUTME: Shows current step and allows navigation to previous steps

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export default function ProgressBar({ currentStep, totalSteps, stepLabels }: ProgressBarProps) {
  const progressPercentage = ((currentStep) / totalSteps) * 100;

  return (
    <div className="mb-12">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex justify-between mt-4">
        {stepLabels.map((label, index) => (
          <div
            key={index}
            className={`text-sm ${
              index < currentStep
                ? 'text-purple-400 font-semibold'
                : index === currentStep
                ? 'text-white font-semibold'
                : 'text-gray-500'
            }`}
          >
            <span className="block text-xs mb-1">Step {index + 1}</span>
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 3: Create main OnboardingWizard component**

Create `/src/components/OnboardingWizard.tsx`:

```typescript
'use client';

// ABOUTME: Multi-step onboarding wizard for creating projects with guided flow
// ABOUTME: Handles project setup, GitHub connection, and requirements upload with auto-analysis trigger

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardStep from './wizard/WizardStep';
import ProgressBar from './wizard/ProgressBar';

interface ProjectData {
  name: string;
  description: string;
  github_url: string;
  github_token: string;
  is_public: boolean;
  documents: File[];
}

const STEP_LABELS = ['Project Setup', 'Connect GitHub', 'Upload Requirements'];

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    description: '',
    github_url: '',
    github_token: '',
    is_public: false,
    documents: [],
  });

  const goToNextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 2));
    setError('');
  };

  const goToPreviousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
    setError('');
  };

  return (
    <div className="max-w-4xl mx-auto py-12">
      <ProgressBar
        currentStep={currentStep}
        totalSteps={3}
        stepLabels={STEP_LABELS}
      />

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm animate-fade-in">
          {error}
        </div>
      )}

      {/* Step content will be added in next tasks */}
      <div className="glass rounded-2xl p-8">
        {currentStep === 0 && <div>Step 1 content</div>}
        {currentStep === 1 && <div>Step 2 content</div>}
        {currentStep === 2 && <div>Step 3 content</div>}
      </div>

      {/* Navigation buttons */}
      <div className="flex justify-between mt-8">
        <button
          onClick={goToPreviousStep}
          disabled={currentStep === 0}
          className="px-6 py-3 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        {currentStep < 2 ? (
          <button
            onClick={goToNextStep}
            className="btn-primary px-8 py-3 text-white font-medium rounded-lg"
          >
            Continue →
          </button>
        ) : (
          <button
            onClick={() => {/* Will implement in next task */}}
            disabled={loading}
            className="btn-primary px-8 py-3 text-white font-medium rounded-lg"
          >
            {loading ? 'Creating...' : 'Create Project & Run Analysis'}
          </button>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Test wizard structure**

Create a temporary test page `src/app/wizard-test/page.tsx`:

```typescript
import OnboardingWizard from '@/components/OnboardingWizard';

export default function WizardTest() {
  return <OnboardingWizard />;
}
```

Run: `npm run dev`
Navigate to: http://localhost:3000/wizard-test
Expected: See progress bar and wizard structure, can navigate between placeholder steps

**Step 5: Commit**

```bash
git add src/components/OnboardingWizard.tsx src/components/wizard/
git commit -m "feat: create onboarding wizard component structure

- WizardStep wrapper for consistent step layout
- ProgressBar with visual step indicator
- OnboardingWizard main component with navigation
- Three-step flow scaffolding

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3.2: Implement Wizard Step 1 (Project Setup)

**Files:**
- Modify: `src/components/OnboardingWizard.tsx`

**Step 1: Replace Step 1 placeholder with project setup form**

In `/src/components/OnboardingWizard.tsx`, replace `{currentStep === 0 && <div>Step 1 content</div>}` with:

```typescript
{currentStep === 0 && (
  <WizardStep
    title="Let's set up your project"
    description="Give your code analysis project a name and description"
  >
    <div className="space-y-6">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
          Project Name *
        </label>
        <input
          type="text"
          id="name"
          required
          maxLength={100}
          placeholder="e.g., E-commerce Platform Analysis"
          className="input-dark w-full px-4 py-3 rounded-lg text-lg"
          value={projectData.name}
          onChange={e => setProjectData({ ...projectData, name: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
          Description
        </label>
        <textarea
          id="description"
          rows={4}
          maxLength={500}
          placeholder="What does this project do? (optional)"
          className="input-dark w-full px-4 py-3 rounded-lg resize-none"
          value={projectData.description}
          onChange={e => setProjectData({ ...projectData, description: e.target.value })}
        />
        <p className="mt-2 text-xs text-gray-500">
          {projectData.description.length}/500 characters
        </p>
      </div>
    </div>
  </WizardStep>
)}
```

**Step 2: Add validation for Step 1**

Update the `goToNextStep` function:

```typescript
const goToNextStep = () => {
  // Validate Step 1
  if (currentStep === 0) {
    if (!projectData.name.trim()) {
      setError('Project name is required');
      return;
    }
  }

  setCurrentStep(prev => Math.min(prev + 1, 2));
  setError('');
};
```

**Step 3: Test Step 1**

Run: `npm run dev`
Navigate to: http://localhost:3000/wizard-test
Test:
1. Try clicking Continue without name → See error
2. Enter project name → Can proceed to Step 2
3. Back button works

**Step 4: Commit**

```bash
git add src/components/OnboardingWizard.tsx
git commit -m "feat: implement wizard Step 1 (Project Setup)

- Project name and description inputs
- Character count for description
- Validation before proceeding to Step 2
- Large, spacious input fields for clarity

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3.3: Implement Wizard Step 2 (Connect GitHub)

**Files:**
- Modify: `src/components/OnboardingWizard.tsx`

**Step 1: Replace Step 2 placeholder with GitHub connection form**

In `/src/components/OnboardingWizard.tsx`, replace `{currentStep === 1 && <div>Step 2 content</div>}` with:

```typescript
{currentStep === 1 && (
  <WizardStep
    title="Connect your GitHub repository"
    description="Link the repository you want to analyze"
  >
    <div className="space-y-6">
      {/* GitHub Platform Indicator */}
      <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gray-800/50">
        <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        <div className="text-left">
          <p className="text-white font-medium">GitHub</p>
          <p className="text-xs text-gray-400">
            Currently supported. GitLab, Bitbucket coming soon!
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="github_url" className="block text-sm font-medium text-gray-300 mb-2">
          GitHub Repository URL *
        </label>
        <input
          type="url"
          id="github_url"
          required
          placeholder="https://github.com/owner/repo"
          className="input-dark w-full px-4 py-3 rounded-lg"
          value={projectData.github_url}
          onChange={e => setProjectData({ ...projectData, github_url: e.target.value })}
        />
      </div>

      <div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setProjectData({ ...projectData, is_public: !projectData.is_public })}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              projectData.is_public ? 'bg-purple-600' : 'bg-gray-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                projectData.is_public ? 'translate-x-6' : 'translate-x-1'
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

      {!projectData.is_public && (
        <div className="animate-fade-in">
          <label htmlFor="github_token" className="block text-sm font-medium text-gray-300 mb-2">
            GitHub Personal Access Token *
          </label>
          <input
            type="password"
            id="github_token"
            required={!projectData.is_public}
            placeholder="ghp_xxxxxxxxxxxxx"
            className="input-dark w-full px-4 py-3 rounded-lg"
            value={projectData.github_token}
            onChange={e => setProjectData({ ...projectData, github_token: e.target.value })}
          />
          <p className="mt-2 text-xs text-gray-500">
            Create a token at GitHub Settings → Developer Settings → Personal Access Tokens.
            Needs <span className="text-purple-400">repo read access</span>.
          </p>
        </div>
      )}
    </div>
  </WizardStep>
)}
```

**Step 2: Add validation for Step 2**

Update the `goToNextStep` function to include Step 2 validation:

```typescript
const goToNextStep = () => {
  // Validate Step 1
  if (currentStep === 0) {
    if (!projectData.name.trim()) {
      setError('Project name is required');
      return;
    }
  }

  // Validate Step 2
  if (currentStep === 1) {
    if (!projectData.github_url.trim()) {
      setError('GitHub repository URL is required');
      return;
    }
    if (!projectData.is_public && !projectData.github_token.trim()) {
      setError('GitHub token is required for private repositories');
      return;
    }
    // Basic GitHub URL validation
    if (!projectData.github_url.includes('github.com')) {
      setError('Please enter a valid GitHub repository URL');
      return;
    }
  }

  setCurrentStep(prev => Math.min(prev + 1, 2));
  setError('');
};
```

**Step 3: Test Step 2**

Run: `npm run dev`
Navigate through wizard:
1. Fill Step 1 → Continue
2. Try Continue without URL → See error
3. Toggle Public/Private → Token field appears/disappears
4. Enter GitHub URL → Can proceed to Step 3

**Step 4: Commit**

```bash
git add src/components/OnboardingWizard.tsx
git commit -m "feat: implement wizard Step 2 (Connect GitHub)

- GitHub logo and platform messaging
- Repository URL input with validation
- Public/Private toggle with smooth transition
- Token field for private repos with helper text
- GitHub URL validation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3.4: Implement Wizard Step 3 (Upload Requirements)

**Files:**
- Modify: `src/components/OnboardingWizard.tsx`

**Step 1: Replace Step 3 placeholder with file upload UI**

In `/src/components/OnboardingWizard.tsx`, replace `{currentStep === 2 && <div>Step 3 content</div>}` with:

```typescript
{currentStep === 2 && (
  <WizardStep
    title="Upload your requirements documents"
    description="Add PRDs, BRDs, wireframes, or any requirements documentation"
  >
    <div className="space-y-6">
      {/* File Upload Zone */}
      <label className="block">
        <input
          type="file"
          multiple
          accept=".pdf,.md,.markdown,.txt,.png,.jpg,.jpeg,.gif,.webp"
          onChange={handleFileUpload}
          className="hidden"
          id="file-upload"
        />
        <div
          className="border-2 border-dashed border-white/10 rounded-xl p-12 text-center transition-all duration-300 hover:border-purple-500/40 hover:bg-purple-500/5 cursor-pointer"
          onClick={() => document.getElementById('file-upload')?.click()}
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/10 flex items-center justify-center">
            <svg className="w-8 h-8 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <p className="text-lg text-gray-300 font-medium mb-2">
            Drop files here or click to upload
          </p>
          <p className="text-sm text-gray-500">
            PDF, Markdown, Text files, or Images
          </p>
        </div>
      </label>

      {/* Uploaded Files List */}
      {projectData.documents.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-sm font-medium text-gray-300">
            {projectData.documents.length} file{projectData.documents.length !== 1 ? 's' : ''} ready to upload
          </p>
          <ul className="space-y-2">
            {projectData.documents.map((file, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-3 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-indigo-500/10 flex items-center justify-center text-sm">
                    📄
                  </div>
                  <span className="text-sm text-gray-300">{file.name}</span>
                  <span className="text-xs text-gray-500">
                    ({(file.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="text-red-400 hover:text-red-300 text-xs font-medium px-2 py-1 rounded transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {projectData.documents.length === 0 && (
        <p className="text-center text-sm text-gray-500">
          No files uploaded yet. You can add them later if needed.
        </p>
      )}
    </div>
  </WizardStep>
)}
```

**Step 2: Add file upload handler functions**

Add these functions to the component:

```typescript
const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  const newFiles = Array.from(files);
  setProjectData({
    ...projectData,
    documents: [...projectData.documents, ...newFiles],
  });
};

const removeFile = (index: number) => {
  const newDocuments = projectData.documents.filter((_, i) => i !== index);
  setProjectData({ ...projectData, documents: newDocuments });
};
```

**Step 3: Test Step 3**

Run: `npm run dev`
Navigate through wizard to Step 3:
1. Click or drag files to upload
2. See files listed with size
3. Click Remove to delete files
4. Can proceed with or without files

**Step 4: Commit**

```bash
git add src/components/OnboardingWizard.tsx
git commit -m "feat: implement wizard Step 3 (Upload Requirements)

- Large centered drag-drop file upload zone
- Real-time file list with file sizes
- Remove file functionality
- Supports multiple file types (PDF, MD, images)
- Optional file upload (can skip)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3.5: Implement Wizard Submission & Auto-Analysis

**Files:**
- Modify: `src/components/OnboardingWizard.tsx`

**Step 1: Implement project creation and analysis trigger**

Add the submission handler function:

```typescript
const handleComplete = async () => {
  setLoading(true);
  setError('');

  try {
    // Step 1: Create project
    const projectResponse = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectData.name,
        description: projectData.description,
        github_url: projectData.github_url,
        github_token: projectData.github_token,
        is_public: projectData.is_public,
      }),
    });

    const projectResult = await projectResponse.json();

    if (!projectResponse.ok) {
      throw new Error(projectResult.error || 'Failed to create project');
    }

    const projectId = projectResult.id;

    // Step 2: Upload documents if any
    if (projectData.documents.length > 0) {
      for (const file of projectData.documents) {
        const formData = new FormData();
        formData.append('project_id', projectId);
        formData.append('file', file);

        const docResponse = await fetch('/api/documents', {
          method: 'POST',
          body: formData,
        });

        if (!docResponse.ok) {
          console.error('Failed to upload document:', file.name);
          // Continue with other files even if one fails
        }
      }
    }

    // Step 3: Trigger analysis automatically
    const analysisResponse = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    });

    if (!analysisResponse.ok) {
      console.error('Failed to trigger analysis');
      // Don't fail the whole flow if analysis fails - user can trigger it manually
    }

    // Step 4: Redirect to project page
    router.push(`/projects/${projectId}`);
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Failed to create project');
    setLoading(false);
  }
};
```

**Step 2: Update the final button to call handleComplete**

Find the final button in the navigation section and update its onClick:

```typescript
<button
  onClick={handleComplete}
  disabled={loading}
  className="btn-primary px-8 py-3 text-white font-medium rounded-lg flex items-center gap-2"
>
  {loading ? (
    <>
      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Creating & Analyzing...
    </>
  ) : (
    <>
      Create Project & Run Analysis
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </>
  )}
</button>
```

**Step 3: Test the complete wizard flow**

Run: `npm run dev`
Complete wizard flow:
1. Fill Step 1 (name, description)
2. Fill Step 2 (GitHub URL, public/private)
3. Upload files in Step 3 (optional)
4. Click "Create Project & Run Analysis"
5. Verify redirect to project page
6. Verify analysis starts automatically

**Step 4: Commit**

```bash
git add src/components/OnboardingWizard.tsx
git commit -m "feat: implement wizard submission with auto-analysis

- Create project via API
- Upload documents sequentially
- Auto-trigger analysis after creation
- Redirect to project page with analysis running
- Loading state with spinner
- Error handling for each step

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 3.6: Replace /projects/new with OnboardingWizard

**Files:**
- Modify: `src/app/projects/new/page.tsx`

**Step 1: Replace entire page with wizard**

Replace the content of `/src/app/projects/new/page.tsx`:

```typescript
'use client';

// ABOUTME: New project creation page using multi-step onboarding wizard
// ABOUTME: Replaces single-form approach with guided 3-step flow

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import OnboardingWizard from '@/components/OnboardingWizard';

export default function NewProject() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  return <OnboardingWizard />;
}
```

**Step 2: Delete wizard test page**

Delete `/src/app/wizard-test/page.tsx` if it exists (we created it for testing).

**Step 3: Test the new project flow**

Run: `npm run dev`
Login and navigate to: http://localhost:3000/projects/new
Expected: See onboarding wizard instead of old form

**Step 4: Test complete project creation flow**

1. Click "Start New Analysis" from home
2. Complete wizard steps
3. Verify project created
4. Verify redirect to project page
5. Verify analysis starts automatically

**Step 5: Commit**

```bash
git add src/app/projects/new/page.tsx
git commit -m "feat: replace /projects/new with OnboardingWizard

- Remove old single-form project creation
- Integrate multi-step wizard component
- Maintain auth protection
- Improve user onboarding experience

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 4: Feedback System

### Task 4.1: Create Feedback API Endpoint

**Files:**
- Create: `src/app/api/feedback/route.ts`

**Step 1: Create feedback API route**

Create `/src/app/api/feedback/route.ts`:

```typescript
// ABOUTME: API endpoint for handling user feedback submissions
// ABOUTME: Saves to Supabase and sends admin notification via Resend

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendFeedbackNotification } from '@/lib/services/email';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, message, page_url, user_id } = body;

    // Validation
    if (!email || !message) {
      return NextResponse.json(
        { error: 'Email and message are required' },
        { status: 400 }
      );
    }

    // Insert feedback submission
    const { data, error } = await supabase
      .from('feedback_submissions')
      .insert({
        email,
        message,
        page_url: page_url || null,
        user_id: user_id || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to save feedback:', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    // Send email notification to admins
    try {
      await sendFeedbackNotification({
        email,
        message,
        page_url,
        user_id,
      });
    } catch (emailError) {
      console.error('Failed to send feedback notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully!',
      data,
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

**Step 2: Test feedback API**

Create test file `__test-feedback-api.http`:
```
POST http://localhost:3000/api/feedback
Content-Type: application/json

{
  "email": "test@northwestern.edu",
  "message": "Great tool! Love the analysis features.",
  "page_url": "http://localhost:3000/projects/123"
}
```

Run: `npm run dev`
Test with REST client
Expected: 200 response, entry in Supabase feedback_submissions table

**Step 3: Commit**

```bash
git add src/app/api/feedback/route.ts
git commit -m "feat: add feedback API endpoint

- POST /api/feedback for user feedback
- Saves to Supabase feedback_submissions table
- Sends admin notification via Resend
- Optional user_id and page_url tracking

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4.2: Create Floating Feedback Widget

**Files:**
- Create: `src/components/FeedbackWidget.tsx`

**Step 1: Create feedback widget component**

Create `/src/components/FeedbackWidget.tsx`:

```typescript
'use client';

// ABOUTME: Floating feedback widget accessible from all pages
// ABOUTME: Slides out panel from right side with form submission to /api/feedback

import { useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';

export default function FeedbackWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(user?.email || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          message,
          page_url: window.location.href,
          user_id: user?.id || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit feedback');
      }

      setSuccess(true);
      setMessage('');
      setTimeout(() => {
        setSuccess(false);
        setIsOpen(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg hover:shadow-purple-500/30 transition-all hover:scale-110"
        aria-label="Send Feedback"
      >
        <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </button>

      {/* Slide-out Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 animate-fade-in"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-gray-900 border-l border-white/10 z-50 animate-slide-in-right p-6 flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold gradient-text">Send Feedback</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            {success ? (
              <div className="flex-1 flex items-center justify-center text-center">
                <div className="animate-fade-in">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">Thanks for your feedback!</h3>
                  <p className="text-sm text-gray-400">
                    Your input helps us keep Code Vision free for the Northwestern community.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
                <p className="text-sm text-gray-400 mb-6">
                  Help us keep Code Vision free for Northwestern students by sharing your thoughts!
                </p>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    className="input-dark w-full px-4 py-3 rounded-lg"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                  />
                </div>

                <div className="flex-1 mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    What's on your mind?
                  </label>
                  <textarea
                    required
                    rows={8}
                    className="input-dark w-full px-4 py-3 rounded-lg resize-none h-full"
                    placeholder="Share your feedback, suggestions, or bug reports..."
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full px-6 py-3 text-white font-medium rounded-lg"
                >
                  {loading ? 'Sending...' : 'Send Feedback'}
                </button>
              </form>
            )}
          </div>
        </>
      )}
    </>
  );
}
```

**Step 2: Add animations to global CSS**

Add to `/src/app/globals.css`:

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
```

**Step 3: Add FeedbackWidget to root layout**

Modify `/src/app/layout.tsx`, add before closing body tag:

```typescript
import FeedbackWidget from '@/components/FeedbackWidget';

// ... in the component:
<body>
  {/* ... existing content */}
  <FeedbackWidget />
</body>
```

**Step 4: Test feedback widget**

Run: `npm run dev`
Navigate to any page
Test:
1. Click floating button → Panel slides in
2. Fill form and submit → Success message
3. Check Supabase feedback_submissions table

**Step 5: Commit**

```bash
git add src/components/FeedbackWidget.tsx src/app/layout.tsx src/app/globals.css
git commit -m "feat: add floating feedback widget

- Persistent floating button on all pages
- Slide-out panel from right with smooth animation
- Pre-filled email for logged-in users
- Success state with Northwestern messaging
- Global integration in root layout

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 4.3: Implement Proactive Feedback Prompt

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`
- Create: `src/components/FeedbackPrompt.tsx`

**Step 1: Create FeedbackPrompt toast component**

Create `/src/components/FeedbackPrompt.tsx`:

```typescript
'use client';

// ABOUTME: Proactive feedback prompt shown after first analysis completion
// ABOUTME: Toast notification with Northwestern community appeal

import { useEffect, useState } from 'react';

interface FeedbackPromptProps {
  onOpenFeedback: () => void;
}

export default function FeedbackPrompt({ onOpenFeedback }: FeedbackPromptProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already dismissed this prompt
    const dismissed = localStorage.getItem('feedback-prompt-dismissed');
    if (dismissed) {
      setIsDismissed(true);
      return;
    }

    // Show prompt after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('feedback-prompt-dismissed', 'true');
    setIsDismissed(true);
  };

  const handleFeedback = () => {
    setIsVisible(false);
    onOpenFeedback();
  };

  if (isDismissed || !isVisible) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 max-w-sm animate-slide-in-right">
      <div className="glass-refined rounded-xl p-4 shadow-xl border border-purple-500/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0">
            🎓
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-white mb-1">
              Enjoying Code Vision?
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              Your feedback helps us keep this tool free for Northwestern students!
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleFeedback}
                className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Share Feedback
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-gray-400 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Integrate FeedbackPrompt into project page**

Modify `/src/app/projects/[id]/page.tsx`:

Add import:
```typescript
import FeedbackPrompt from '@/components/FeedbackPrompt';
```

Add state for showing prompt:
```typescript
const [showFeedbackPrompt, setShowFeedbackPrompt] = useState(false);
```

Add useEffect to detect first analysis completion:

```typescript
useEffect(() => {
  // Show feedback prompt after first analysis completion
  if (analysis?.analyzed_at) {
    const hasSeenPrompt = localStorage.getItem('feedback-prompt-shown');
    if (!hasSeenPrompt) {
      setShowFeedbackPrompt(true);
      localStorage.setItem('feedback-prompt-shown', 'true');
    }
  }
}, [analysis]);
```

Add component before closing div:

```typescript
{/* Feedback Prompt */}
{showFeedbackPrompt && (
  <FeedbackPrompt onOpenFeedback={() => {
    // Trigger feedback widget open
    // Note: We'll need to expose a method to open the feedback widget
    setShowFeedbackPrompt(false);
  }} />
)}
```

**Step 3: Update FeedbackWidget to accept external trigger**

Modify `/src/components/FeedbackWidget.tsx`:

Use `forwardRef` and `useImperativeHandle` to expose open method (or use a global event).

For simplicity, we can use a custom event:

In FeedbackPrompt's `handleFeedback`:
```typescript
const handleFeedback = () => {
  setIsVisible(false);
  window.dispatchEvent(new Event('open-feedback-widget'));
};
```

In FeedbackWidget, add listener:
```typescript
useEffect(() => {
  const handleOpen = () => setIsOpen(true);
  window.addEventListener('open-feedback-widget', handleOpen);
  return () => window.removeEventListener('open-feedback-widget', handleOpen);
}, []);
```

**Step 4: Test proactive feedback prompt**

Run: `npm run dev`
Complete an analysis:
1. Wait 5 seconds after analysis completes
2. See feedback prompt toast
3. Click "Share Feedback" → Opens feedback widget
4. Click "Maybe Later" → Dismisses (won't show again)

**Step 5: Commit**

```bash
git add src/components/FeedbackPrompt.tsx src/app/projects/[id]/page.tsx src/components/FeedbackWidget.tsx
git commit -m "feat: add proactive feedback prompt after analysis

- Toast notification 5 seconds after first analysis
- Northwestern community emotional appeal
- Opens feedback widget on click
- localStorage to prevent repeated prompts
- Custom event for widget communication

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Phase 5: GitHub Integration (Low Priority)

### Task 5.1: Add GitHub Issue Creation Button (Placeholder)

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`

**Note:** This is marked as LOW PRIORITY. Implementation details are minimal for now.

**Step 1: Add placeholder button in Issues tab**

Modify `/src/app/projects/[id]/page.tsx`, in the issues tab section (around line 473):

Add button next to each finding:

```typescript
<button
  className="text-xs text-purple-400 hover:text-purple-300 px-2 py-1 rounded border border-purple-500/30 hover:bg-purple-500/10 transition-colors"
  onClick={() => alert('GitHub integration coming soon!')}
>
  Create Issue
</button>
```

**Step 2: Test placeholder**

Run: `npm run dev`
Navigate to project → Issues tab
Expected: See "Create Issue" button next to findings, shows alert when clicked

**Step 3: Commit**

```bash
git add src/app/projects/[id]/page.tsx
git commit -m "feat: add GitHub issue creation button placeholder (LOW PRIORITY)

- Placeholder button in Issues tab
- Alert for future implementation
- Low priority feature for later completion

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Final Steps

### Task 6.1: Commit Design Document

**Step 1: Add and commit the design document**

```bash
git add docs/plans/2025-12-13-northwestern-access-enhancements.md
git commit -m "docs: add Northwestern access & UX enhancements design document

- Comprehensive design for Northwestern-exclusive access
- Waitlist system for non-NW users
- Multi-step onboarding wizard
- Persistent feedback mechanism
- Visual improvements and GitHub messaging

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

### Task 6.2: Update Beads Issues

**Step 1: Close completed beads issues**

As you complete each phase, close the corresponding beads:

```bash
bd close code-vision-pa3 code-vision-3n8 code-vision-cnf code-vision-2os
bd close code-vision-lzx code-vision-95z
bd close code-vision-4bx code-vision-pum code-vision-6j8
bd close code-vision-51u code-vision-765 code-vision-336
```

**Step 2: Sync beads to remote**

```bash
bd sync
```

---

## Testing Checklist

After completing all tasks, run through this checklist:

### Foundation Tests
- [ ] Logo appears in navbar and looks correct
- [ ] Supabase tables created (admin_config, waitlist_requests, feedback_submissions)
- [ ] Resend emails are received by admins
- [ ] Northwestern banner appears on landing and auth pages

### Waitlist Tests
- [ ] Non-NW email on signup → Shows waitlist form
- [ ] NW email on signup → Shows green checkmark, regular signup
- [ ] Waitlist submission → Saves to Supabase
- [ ] Waitlist submission → Admin receives email
- [ ] Duplicate waitlist email → Shows error

### Onboarding Wizard Tests
- [ ] Progress bar updates correctly
- [ ] Can navigate back and forth between steps
- [ ] Validation works on each step
- [ ] GitHub public/private toggle works
- [ ] File upload works with multiple files
- [ ] Final submission creates project
- [ ] Analysis auto-triggers after creation
- [ ] Redirects to project page

### Feedback Tests
- [ ] Floating button visible on all pages
- [ ] Panel slides in smoothly
- [ ] Email pre-filled for logged-in users
- [ ] Feedback submission works
- [ ] Admin receives feedback email
- [ ] Proactive prompt shows after first analysis
- [ ] Prompt can be dismissed
- [ ] "Share Feedback" opens widget

### GitHub Integration Tests
- [ ] Placeholder button appears in Issues tab (LOW PRIORITY)

---

## Documentation Updates Needed

After implementation:

1. **Admin Guide:**
   - How to check waitlist in Supabase
   - How to update admin emails in admin_config
   - How to approve waitlist users (manual process for now)

2. **User Guide:**
   - Onboarding wizard walkthrough
   - How to submit feedback
   - GitHub connection instructions

3. **README:**
   - Update features list
   - Add Northwestern access information
   - Document waitlist process

---

## Success Metrics

Track these metrics after deployment:

- Northwestern user signup rate
- Waitlist conversion rate (requests submitted)
- Feedback submission rate
- Onboarding completion rate (wizard finish vs. abandonment)
- Time to first analysis (should decrease with wizard)

---

## Future Enhancements

Ideas for future iterations:

1. Admin dashboard for managing waitlist
2. Batch approve/reject waitlist users
3. Waitlist approval email to users
4. Analytics dashboard for feedback themes
5. Full GitHub OAuth integration
6. GitLab/Bitbucket support
7. GitHub issue creation with auto-populate
8. Feedback categorization (bug/feature/praise)
9. In-app feedback history for users
10. Email templates using React Email for better styling
