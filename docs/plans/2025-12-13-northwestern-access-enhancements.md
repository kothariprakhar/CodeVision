# Northwestern University Access & UX Enhancements

**Date:** 2025-12-13
**Status:** Approved
**Priority:** High

## Overview

Enhance Code Vision with Northwestern University exclusive access, waitlist system for non-NW users, improved onboarding wizard, persistent feedback mechanism, and visual improvements.

## Goals

1. Establish Code Vision as Northwestern-exclusive with clear messaging
2. Capture interest from non-NW users via waitlist system
3. Simplify onboarding with step-by-step wizard
4. Collect user feedback to improve the tool
5. Improve visual identity and platform messaging

## System Architecture

### Access Tiers

1. **Northwestern users** (`@northwestern.edu` emails) → auto-approved, full access
2. **Waitlist users** (non-NW emails) → request access, stored in Supabase, admins notified
3. **Anonymous visitors** → see landing page with NW messaging, encouraged to join waitlist

### Tech Stack Additions

- **Resend** - Transactional emails (waitlist requests, feedback notifications)
- **Supabase tables** - `waitlist_requests`, `feedback_submissions`, `admin_config`
- **React Hook Form** - Multi-step wizard state management
- **Framer Motion** - Smooth transitions in wizard and feedback widget

## Feature Specifications

### 1. Northwestern Users & Waitlist System

#### Landing Page Changes

Add prominent banner at top of landing page (`src/app/page.tsx`):
```
"🎓 Currently open to Northwestern University community members. Not affiliated? Join the waitlist!"
```

- Purple gradient background
- "Join Waitlist" CTA button
- Visible to all non-authenticated users

#### Signup Page Flow

**Real-time email validation:**
1. User enters email on `/signup`
2. **If `@northwestern.edu`** → Green checkmark, continue normal signup
3. **If other domain** → Form transitions to waitlist form:
   - Message: "Not part of Northwestern? Request early access!"
   - Fields: Name, Email (pre-filled), Organization/School (optional), Why interested (textarea)
   - Emotional appeal: "Help us keep this tool free for Northwestern students by joining our waitlist."
   - Submit → Saves to `waitlist_requests`, sends email to admins

#### Login Page

- Banner at top with same NW messaging
- Note under email field: "Northwestern email required. Need access? [Join Waitlist]"

### 2. Multi-Step Onboarding Wizard

Replace current single-form project creation with 3-step wizard:

#### Step 1: Project Setup
- Title: "Let's set up your project"
- Fields: Project name, Description (optional)
- Progress: 1/3 indicator
- CTA: "Continue"

#### Step 2: Connect Repository
- Title: "Connect your GitHub repository"
- GitHub logo prominently displayed
- Fields: GitHub URL, Public/Private toggle, Token (if private)
- Help text: "Currently supports GitHub. GitLab, Bitbucket & other Git platforms coming soon!"
- Progress: 2/3 indicator
- CTAs: "Back", "Continue"

#### Step 3: Upload Requirements
- Title: "Upload your requirements documents"
- Large centered drag-drop zone
- Real-time file upload display
- Multiple file support
- Progress: 3/3 indicator
- CTAs: "Back", "Create Project & Run Analysis"

#### Post-Wizard Flow
- Redirect to project page
- Analysis automatically triggered
- User sees analysis running immediately
- No need to hunt for "Run Analysis" button

### 3. Feedback System

#### Floating Feedback Widget

**Button:**
- Position: `fixed bottom-6 right-6 z-50`
- Design: Circular, purple gradient, speech bubble icon
- Persistent on all pages

**Panel (slides from right):**
- Header: "Send us feedback"
- Textarea: "What's on your mind?"
- Email field (pre-filled if logged in)
- Submit button
- Text: "Help us keep Code Vision free for Northwestern students!"

#### Proactive Feedback Prompt

**Trigger:** After user's first analysis completion

**Toast notification:**
- Timing: 5 seconds after `analysis.status === 'completed'`
- Message: "🎓 Enjoying Code Vision? Your feedback helps us keep this tool free for Northwestern students!"
- CTA: "Share Feedback" (opens panel)
- Dismissible: Yes

#### Data Flow
- Saves to `feedback_submissions` table
- Sends email to admins via Resend
- Success message references Northwestern community

### 4. Visual Improvements

#### Logo Component

Create `/src/components/Logo.tsx`:

**Variants:**
- `LogoFull` - Icon + "Code Vision" text (navbar)
- `LogoIcon` - Just icon (favicon, mobile)
- `LogoMark` - Large version (loading states)

**Design:**
- Abstract code brackets `< />`
- Purple-to-indigo gradient
- Clean, modern SVG
- Easily swappable (one file to update)

**Usage:**
- Navbar (replace inline SVG)
- Favicon
- Loading states
- Email templates

#### GitHub Platform Messaging

**New Project Wizard - Step 2:**
- GitHub logo at top of card
- Info box with text:
  ```
  "Currently supports GitHub repositories (public & private)
   GitLab, Bitbucket & other Git platforms coming soon!"
  ```
- Purple/5 background, subtle styling

### 5. GitHub Issue Creation (Low Priority)

**Location:** Issues tab on project page

**Functionality:**
- Button next to each finding: "Create GitHub Issue"
- On first click, prompt for GitHub credentials (save to user settings)
- Creates issue in connected repo with:
  - Title: Finding title
  - Body: Description, severity, evidence
  - Labels: Auto-tagged based on severity

**Credentials Storage:**
- Encrypted in Supabase user settings
- GitHub Personal Access Token
- Reusable across projects

## Data Models

### Supabase Schema

#### `admin_config` table
```sql
CREATE TABLE admin_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Seed data
INSERT INTO admin_config (key, value) VALUES
  ('admin_emails', '["admin@northwestern.edu"]');
```

#### `waitlist_requests` table
```sql
CREATE TABLE waitlist_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  organization TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW(),
  approved_at TIMESTAMP,
  approved_by UUID REFERENCES users(id)
);
```

#### `feedback_submissions` table
```sql
CREATE TABLE feedback_submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Email Integration

### Resend Setup

**Installation:**
```bash
npm install resend
```

**Environment:**
```env
RESEND_API_KEY=re_xxxxx
```

**Domain:** Verify in Resend dashboard (or use test domain for dev)

### Email Templates

Create `/src/lib/email-templates/`:

#### 1. Waitlist Request Email (to admins)
- **Subject:** `[Code Vision] New Waitlist Request from {name}`
- **Body:**
  - Name, email, organization, reason
  - Timestamp
  - Northwestern-branded template

#### 2. Feedback Email (to admins)
- **Subject:** `[Code Vision] New Feedback from {email}`
- **Body:**
  - User email, message
  - Page URL, timestamp
  - Northwestern-branded template

### Email Service Helper

Create `/src/lib/services/email.ts`:

```typescript
export async function sendWaitlistNotification(data: WaitlistRequest)
export async function sendFeedbackNotification(data: FeedbackSubmission)
```

**Behavior:**
- Fetches admin emails from `admin_config` table
- Sends via Resend API
- Error handling with logging

## Implementation Priority

### Phase 1 - Foundation (High Priority)
1. Logo component + favicon
2. Supabase schema migrations (3 tables + seed admin_config)
3. Resend integration + email service helper
4. Northwestern messaging on landing + auth pages

### Phase 2 - Waitlist System (High Priority)
5. Inline waitlist form on signup page
6. Waitlist API endpoints (`POST /api/waitlist`)
7. Email notifications for waitlist requests

### Phase 3 - Onboarding Wizard (High Priority)
8. Multi-step wizard component
9. Replace `/projects/new` with wizard
10. Auto-trigger analysis after wizard completion
11. GitHub messaging in Step 2

### Phase 4 - Feedback System (Medium Priority)
12. Floating feedback widget component
13. Feedback API endpoints (`POST /api/feedback`)
14. Proactive feedback prompt after first analysis
15. Email notifications for feedback

### Phase 5 - GitHub Integration (Low Priority)
16. GitHub issue creation button in Issues tab
17. GitHub credentials storage/management
18. Issue creation API integration

## Testing Requirements

### Functional Testing
- [ ] Northwestern email signup → auto-approved flow
- [ ] Non-NW email → waitlist form transition
- [ ] Wizard completion → auto-analysis trigger
- [ ] Feedback widget accessible on all pages
- [ ] Email delivery (waitlist + feedback to admins)
- [ ] Logo rendering across all pages
- [ ] GitHub platform messaging visible in wizard

### Integration Testing
- [ ] Resend API integration
- [ ] Supabase table operations
- [ ] Email template rendering
- [ ] File uploads in wizard Step 3
- [ ] Analysis auto-trigger after wizard

### UX Testing
- [ ] Wizard step transitions smooth
- [ ] Feedback widget doesn't interfere with content
- [ ] Northwestern messaging feels inclusive, not restrictive
- [ ] Waitlist form fields validate properly

## Documentation Needs

### Admin Documentation
- How to check waitlist requests in Supabase
- How to update admin emails in `admin_config` table
- How to manually approve waitlist users (if needed)

### User Documentation
- Onboarding flow walkthrough
- How to submit feedback
- GitHub connection instructions (public vs private repos)

## Success Metrics

- Northwestern user signup rate
- Waitlist conversion rate (requests submitted)
- Feedback submission rate
- Onboarding completion rate (wizard finish)
- Time to first analysis (should decrease with wizard)

## Future Considerations

- Admin dashboard for managing waitlist
- Batch approve/reject waitlist users
- Waitlist approval email to users
- Analytics on feedback themes
- OAuth GitHub integration (instead of tokens)
- GitLab/Bitbucket support
