# Feedback System Design

**Date**: 2025-12-16
**Author**: Claude + Sabari
**Status**: Approved for Implementation

## Overview

A comprehensive feedback system for CodeVision that allows users to submit bug reports, feature requests, and general feedback through a branded floating widget with proactive prompts after analysis completion.

---

## 1. Architecture Overview

The feedback system consists of three main components working together:

### 1.1 Floating Feedback Button (Global)
- Fixed position button (bottom-right corner) visible on all authenticated pages
- Purple gradient circular button with a speech bubble or message icon
- Subtle pulse animation to draw attention without being annoying
- Always available as fallback for user-initiated feedback

### 1.2 Slide-out Feedback Panel
- Triggered by clicking the floating button OR by proactive prompts
- Slides in from the right side (400px width on desktop, full-width on mobile)
- Glass-morphism styling matching the wizard components
- Contains the feedback form with category dropdown and text area
- Smooth animations (slide + fade) for professional feel

### 1.3 Proactive Feedback Prompts
- Toast-style notification that appears after analysis completion
- Delayed trigger: Waits 10-15 seconds after analysis finishes
- Smart behavior: Shows on first analysis, becomes less frequent on subsequent uses
- Non-intrusive: User can dismiss or click to open the full panel
- Tracks which users have already given feedback to avoid over-prompting

### Integration Points
- Leverages existing `sendFeedbackNotification` in `email.ts` (enhanced with rich context)
- Uses existing `admin_config` table for recipient management
- Stores feedback submissions in new Supabase `feedback` table for history/analytics

---

## 2. Data Model & Context Capture

### 2.1 Supabase `feedback` Table Schema

```sql
CREATE TABLE feedback (
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
```

### 2.2 Automatic Context Capture

When a user submits feedback, we automatically collect:

- **User context**: Email, user ID (from auth session)
- **Page context**: Current URL, project ID if applicable
- **Browser context**: User agent string, screen resolution, viewport size
- **Error context**: Last 10 console errors/warnings (captured via client-side logging)
- **Timestamp**: When feedback was submitted

### 2.3 Privacy Note

All context is captured client-side and sent with user's explicit consent (they clicked submit). No passive tracking or analytics beyond what's needed for actionable feedback.

### 2.4 Enhanced Email Template

Update `sendFeedbackNotification` in `/src/lib/services/email.ts` to include:
- Category badge (color-coded: red for bugs, blue for features, gray for general)
- Project link if `project_id` is present
- Browser info summary (OS, browser, screen size)
- Recent errors (if any console logs captured)
- Direct link to feedback in admin panel (future enhancement)

---

## 3. UI Components & Behavior

### 3.1 Floating Feedback Button

```tsx
Component: FeedbackButton
Location: src/components/FeedbackButton.tsx

Specifications:
- Position: fixed bottom-6 right-6
- Design: Circular (56px diameter), purple gradient background
- Icon: Speech bubble or message icon (white)
- Hover: Slight scale up (1.1x) + tooltip "Send Feedback"
- Animation: Subtle pulse every 5 seconds to maintain visibility
- Z-index: High (999) to float above content
- Hidden on: Login/signup pages (no auth context)
```

### 3.2 Slide-out Feedback Panel

```tsx
Component: FeedbackPanel
Location: src/components/FeedbackPanel.tsx

Specifications:
- Width: 400px (desktop), 100vw (mobile)
- Height: Full viewport height
- Animation: Slide in from right + fade in (300ms)
- Background: Glass-morphism (backdrop-blur + semi-transparent)

Layout:
- Header: "Send Feedback" + close button (X)
- Category dropdown: Bug Report | Feature Request | General Feedback
- Message textarea: Placeholder "Tell us what's on your mind..."
- Character counter: 0/1000 (optional limit)
- Submit button: Purple gradient, disabled until message entered
- Footer: Privacy note "We'll receive your email and page context"
```

### 3.3 Proactive Toast Prompt

```tsx
Component: FeedbackPrompt
Location: src/components/FeedbackPrompt.tsx

Specifications:
- Position: bottom-right, above feedback button
- Design: Glass card with soft shadow
- Content: "How was your analysis experience?" + CTA button
- Actions: "Give Feedback" (opens panel) | Dismiss (X)
- Auto-dismiss: After 15 seconds if not interacted with
- Trigger: 10-15 seconds after analysis status = 'completed'
- Tracking: Set flag in localStorage to avoid showing again
```

---

## 4. API Endpoint & Data Flow

### 4.1 New API Endpoint

**Endpoint**: `POST /api/feedback`
**File**: `src/app/api/feedback/route.ts`

### 4.2 Request Body

```typescript
{
  category: 'bug_report' | 'feature_request' | 'general_feedback',
  message: string,
  page_url: string,
  project_id?: string,
  browser_info: {
    user_agent: string,
    screen_width: number,
    screen_height: number,
    viewport_width: number,
    viewport_height: number
  },
  console_logs?: Array<{
    level: 'error' | 'warn',
    message: string,
    timestamp: number
  }>
}
```

### 4.3 Response

**Success (200)**:
```typescript
{
  success: true,
  message: "Feedback submitted successfully"
}
```

**Error (400/401/500)**:
```typescript
{
  error: string
}
```

### 4.4 Flow

1. Client submits feedback form
2. API endpoint validates request with Zod schema
3. Get user from auth session (user_id, email)
4. Insert feedback into Supabase `feedback` table
5. Call enhanced `sendFeedbackNotification` with rich context
6. Return success response to client
7. Client shows success toast and closes panel

### 4.5 Error Handling

- **Unauthenticated**: Return 401, prompt to login
- **Invalid data**: Return 400 with validation errors
- **Database error**: Return 500, log error, show user-friendly message
- **Email send failure**: Log warning but don't fail request (feedback still saved)

### 4.6 Rate Limiting (Future Enhancement)

- Limit to 5 feedback submissions per user per day to prevent spam

---

## 5. Proactive Prompt Implementation

### 5.1 Trigger Logic

Location: `/src/app/projects/[id]/page.tsx` (or relevant project page component)

```typescript
// After analysis completes, check if we should show prompt
useEffect(() => {
  if (analysisStatus === 'completed') {
    const hasSeenPrompt = localStorage.getItem('feedback_prompt_shown');

    if (!hasSeenPrompt) {
      // First-time user - show prompt after delay
      const timer = setTimeout(() => {
        setShowFeedbackPrompt(true);
        localStorage.setItem('feedback_prompt_shown', 'true');
      }, 12000); // 12 second delay

      return () => clearTimeout(timer);
    }
  }
}, [analysisStatus]);
```

### 5.2 State Management

- Use React Context or local state for panel open/closed
- LocalStorage for tracking: `feedback_prompt_shown` (boolean)
- Panel state: `isOpen`, `isDismissed`, `category`, `message`

### 5.3 User Actions & Responses

- **Click floating button** → Open panel immediately
- **Proactive prompt appears** → User can click "Give Feedback" or dismiss
- **Submit feedback** → Show success toast ("Thanks for your feedback!"), close panel, clear form
- **Dismiss prompt** → Remove from screen, don't show again this session

### 5.4 Console Log Capture (for error context)

Location: Create utility in `src/lib/utils/console-logger.ts`

```typescript
// Capture last 10 errors/warnings
const consoleBuffer: Array<{level: string, message: string, timestamp: number}> = [];

const originalError = console.error;
const originalWarn = console.warn;

console.error = (...args: any[]) => {
  consoleBuffer.push({
    level: 'error',
    message: args.map(String).join(' '),
    timestamp: Date.now()
  });
  if (consoleBuffer.length > 10) consoleBuffer.shift();
  originalError(...args);
};

console.warn = (...args: any[]) => {
  consoleBuffer.push({
    level: 'warn',
    message: args.map(String).join(' '),
    timestamp: Date.now()
  });
  if (consoleBuffer.length > 10) consoleBuffer.shift();
  originalWarn(...args);
};

export function getRecentConsoleLogs() {
  return consoleBuffer.slice();
}
```

---

## 6. Implementation Checklist

### Phase 1: Backend & Infrastructure
- [ ] Create Supabase `feedback` table with schema
- [ ] Update `FeedbackData` interface in `src/lib/services/email.ts`
- [ ] Enhance `sendFeedbackNotification` with rich context template
- [ ] Create `POST /api/feedback` endpoint with Zod validation
- [ ] Test email notifications with all context fields

### Phase 2: UI Components
- [ ] Create `FeedbackButton.tsx` (floating button)
- [ ] Create `FeedbackPanel.tsx` (slide-out form)
- [ ] Create `FeedbackPrompt.tsx` (proactive toast)
- [ ] Add console logger utility (`console-logger.ts`)
- [ ] Style components with glass-morphism and purple theme

### Phase 3: Integration
- [ ] Add `FeedbackButton` to main layout (visible globally)
- [ ] Integrate proactive prompt in project analysis page
- [ ] Wire up form submission to `/api/feedback`
- [ ] Add success/error toast notifications
- [ ] Test complete user flow

### Phase 4: Testing & Polish
- [ ] Manual testing: Submit each category type
- [ ] Verify email notifications arrive with correct context
- [ ] Test on mobile (responsive design)
- [ ] Verify localStorage tracking works
- [ ] Edge cases: unauthenticated users, network errors

---

## 7. Future Enhancements

- Admin dashboard to view/manage feedback submissions
- Feedback status updates (new → reviewed → resolved)
- Rate limiting per user
- Sentiment analysis on feedback text
- Integration with issue tracking (GitHub Issues, Linear, etc.)
- Feedback search and filtering
- Metrics: feedback volume by category, response times

---

## 8. Technical Dependencies

**Existing**:
- Resend API (already configured)
- Supabase (database + auth)
- Tailwind CSS (styling)
- React 19 + Next.js 16 (framework)

**New**:
- None (everything uses existing infrastructure)

---

## 9. Design Decisions & Rationale

### Why Glass-Morphism?
Maintains visual consistency with the onboarding wizard and modern design trends. Users perceive it as part of the core app, not a third-party plugin.

### Why Delayed Proactive Prompts?
Immediate prompts are jarring. Giving users 10-15 seconds to process analysis results respects their attention and increases likelihood of thoughtful feedback.

### Why Rich Context Capture?
Bug reports without context are nearly useless. Browser info, console logs, and project context make feedback actionable and reduce back-and-forth with users.

### Why LocalStorage Tracking?
Simple, client-side, privacy-friendly way to avoid annoying users with repeated prompts. No server-side tracking needed.

### Why Category Dropdown?
Categorization helps triage feedback and set expectations. Users know their bug report will be treated differently than a feature request.

---

## 10. Success Metrics

- **Adoption**: % of users who submit at least one feedback
- **Response rate**: % of users who respond to proactive prompt
- **Quality**: Average context completeness (project ID, console logs present)
- **Volume**: Feedback submissions per week
- **Distribution**: Bug reports vs. feature requests vs. general feedback ratio

---

**End of Design Document**
