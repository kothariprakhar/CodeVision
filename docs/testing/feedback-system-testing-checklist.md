# Feedback System Testing Checklist

**Date:** 2025-12-16
**Status:** Ready for Manual Testing

## Prerequisites

### 1. Database Setup
- [ ] Execute the SQL migration from `/home/sabari/dev/code-vision/migrations/003_feedback_table.sql` in Supabase SQL Editor
- [ ] Verify the `feedback` table was created successfully
- [ ] Verify indexes are in place
- [ ] Verify RLS policies are active

### 2. Environment Variables
- [ ] Verify `RESEND_API_KEY` is set in `.env.local`
- [ ] Verify Supabase credentials are set
- [ ] Verify email notification recipient is configured

## Testing Checklist

### Phase 1: Visual & UI Components

#### Floating Feedback Button (Global)
- [ ] Start the development server: `npm run dev`
- [ ] Navigate to the home page (`/`)
- [ ] **Verify**: Purple floating button appears in bottom-right corner
- [ ] **Verify**: Button has pulsing animation
- [ ] **Verify**: Hover shows tooltip "Send Feedback"
- [ ] **Verify**: Button scales up on hover
- [ ] Navigate to login page (`/login`)
- [ ] **Verify**: Feedback button appears on all pages
- [ ] Navigate to a project page (`/projects/[id]`)
- [ ] **Verify**: Feedback button appears on project pages

#### Feedback Panel
- [ ] Click the floating feedback button
- [ ] **Verify**: Panel slides in from the right
- [ ] **Verify**: Panel has glass-morphism design (blurred background)
- [ ] **Verify**: Panel header shows "Send Feedback"
- [ ] **Verify**: Close button (X) is visible in top-right
- [ ] Click the close button
- [ ] **Verify**: Panel slides out and disappears
- [ ] Open the panel again
- [ ] **Verify**: Form is reset (empty fields)

#### Feedback Panel - Form Fields
- [ ] With panel open, check the category dropdown
- [ ] **Verify**: Three options: "Bug Report", "Feature Request", "General Feedback"
- [ ] Select each category
- [ ] **Verify**: Category selection updates correctly
- [ ] Type in the message textarea
- [ ] **Verify**: Character counter appears below textarea
- [ ] **Verify**: Counter shows "0 / 1000"
- [ ] Type 500 characters
- [ ] **Verify**: Counter shows "500 / 1000"
- [ ] Type more than 1000 characters
- [ ] **Verify**: Counter shows "1001 / 1000" (or similar) in red/warning color
- [ ] Try to submit with >1000 characters
- [ ] **Verify**: Validation error appears

#### Feedback Panel - Form Validation
- [ ] Open the panel
- [ ] Click "Send Feedback" without filling anything
- [ ] **Verify**: Validation errors appear for required fields
- [ ] Select a category but leave message empty
- [ ] Click "Send Feedback"
- [ ] **Verify**: Validation error for message field
- [ ] Fill in a valid category and message (10-100 chars)
- [ ] Click "Send Feedback"
- [ ] **Verify**: "Sending..." state shows (button disabled, loading indicator)
- [ ] **Verify**: Success message appears after submission
- [ ] **Verify**: Panel auto-closes after 2 seconds
- [ ] **Verify**: Form is reset for next use

### Phase 2: Proactive Feedback Prompt (Project Page)

#### Initial Display
- [ ] Navigate to a project page with existing analysis (`/projects/[id]`)
- [ ] Start a timer
- [ ] **Verify**: After exactly 12 seconds, a toast notification slides in from top-right
- [ ] **Verify**: Prompt shows "We'd love your feedback" message
- [ ] **Verify**: Prompt has glass-morphism design
- [ ] **Verify**: Prompt has two buttons: "Give Feedback" and "Maybe Later"

#### Prompt Interactions
- [ ] Wait for the prompt to appear (12 seconds)
- [ ] Click "Maybe Later"
- [ ] **Verify**: Prompt slides out and disappears
- [ ] **Verify**: Prompt does NOT reappear after another 12 seconds
- [ ] Refresh the page (hard refresh: Cmd+Shift+R or Ctrl+Shift+R)
- [ ] **Verify**: Prompt does NOT appear again (localStorage tracks dismissal)
- [ ] Open browser DevTools > Application/Storage > Local Storage
- [ ] Find key `feedback-prompt-dismissed`
- [ ] Delete the key
- [ ] Refresh the page
- [ ] Wait 12 seconds
- [ ] **Verify**: Prompt appears again

#### Prompt to Panel Flow
- [ ] Clear localStorage key `feedback-prompt-dismissed` if needed
- [ ] Refresh the project page
- [ ] Wait 12 seconds for prompt to appear
- [ ] Click "Give Feedback" button in the prompt
- [ ] **Verify**: Prompt disappears
- [ ] **Verify**: Feedback panel opens from the right
- [ ] **Verify**: Panel is pre-filled with project context (check that project_id is set)
- [ ] Fill in category and message
- [ ] Submit feedback
- [ ] **Verify**: Feedback includes project_id in the payload

### Phase 3: Data Capture & API

#### Browser Info Capture
- [ ] Open browser DevTools > Console
- [ ] Open the feedback panel
- [ ] Fill in a minimal valid form (category + short message)
- [ ] Before submitting, add a console intercept:
```javascript
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  if (args[0].includes('/api/feedback')) {
    const body = JSON.parse(args[1].body);
    console.log('Feedback payload:', body);
  }
  return originalFetch(...args);
};
```
- [ ] Submit the feedback
- [ ] **Verify** in console: Payload includes `browser_info` object
- [ ] **Verify**: `browser_info` has: `user_agent`, `screen_width`, `screen_height`, `viewport_width`, `viewport_height`
- [ ] **Verify**: All values are populated (not null/undefined)

#### Console Logs Capture
- [ ] Refresh the page (console logger initializes on load)
- [ ] In browser console, run:
```javascript
console.error('Test error 1');
console.warn('Test warning 1');
console.error('Test error 2', { foo: 'bar' });
```
- [ ] Open the feedback panel
- [ ] Fill and submit feedback
- [ ] **Verify** in payload: `console_logs` array exists
- [ ] **Verify**: Array contains the 3 logged items
- [ ] **Verify**: Each log has `level`, `message`, and `timestamp` fields
- [ ] **Verify**: Object arguments are stringified (e.g., `{"foo":"bar"}`)

#### Console Logs - Circular Reference Handling
- [ ] Refresh the page
- [ ] In browser console, create a circular reference:
```javascript
const obj = { name: 'test' };
obj.self = obj;
console.error('Circular test', obj);
```
- [ ] Open feedback panel and submit
- [ ] **Verify**: Submission succeeds (no crash)
- [ ] **Verify**: Circular object is handled gracefully (shows as `[Object (circular or non-serializable)]`)

#### API Endpoint Testing
- [ ] Ensure you are logged in
- [ ] Submit feedback with valid data
- [ ] **Verify**: Response is 200 OK
- [ ] **Verify**: Response body includes success message
- [ ] Try to submit feedback while logged out
- [ ] **Verify**: Response is 401 Unauthorized
- [ ] While logged in, submit feedback with missing required fields (use DevTools Network tab to modify request)
- [ ] **Verify**: Response is 400 Bad Request
- [ ] **Verify**: Error message indicates validation failure

### Phase 4: Database & Email

#### Supabase Verification
- [ ] Submit feedback successfully (while logged in)
- [ ] Go to Supabase Dashboard > Table Editor > `feedback` table
- [ ] **Verify**: New row appears with your feedback
- [ ] **Verify**: `user_id` matches your authenticated user ID
- [ ] **Verify**: `user_email` is populated
- [ ] **Verify**: `category` matches your selection
- [ ] **Verify**: `message` matches your input
- [ ] **Verify**: `page_url` is the correct URL where feedback was submitted
- [ ] **Verify**: `project_id` is populated if submitted from project page, NULL otherwise
- [ ] **Verify**: `browser_info` is a valid JSON object
- [ ] **Verify**: `console_logs` is a valid JSON array (or NULL if no logs)
- [ ] **Verify**: `created_at` timestamp is recent
- [ ] **Verify**: `status` is 'new'

#### RLS Policy Testing
- [ ] In Supabase SQL Editor, run:
```sql
SELECT COUNT(*) FROM feedback;
```
- [ ] **Verify**: You can only see your own feedback (count matches your submissions)
- [ ] Try to query another user's feedback (if you have access to another user ID):
```sql
SELECT * FROM feedback WHERE user_id = '<another-user-id>';
```
- [ ] **Verify**: Query returns no rows (RLS blocks access)

#### Email Notifications
- [ ] Submit feedback with category "Bug Report"
- [ ] Check the configured email inbox (Resend recipient)
- [ ] **Verify**: Email arrives within 1-2 minutes
- [ ] **Verify**: Email subject includes "Bug Report"
- [ ] **Verify**: Email body shows category with red badge
- [ ] **Verify**: Email includes user email, message, page URL
- [ ] **Verify**: Email includes browser summary (e.g., "Chrome on 1920x1080")
- [ ] **Verify**: Email includes console logs section (if any)
- [ ] **Verify**: All user-controlled content is properly escaped (no raw HTML/script tags)
- [ ] Submit feedback with category "Feature Request"
- [ ] **Verify**: Email arrives with green badge
- [ ] Submit feedback with category "General Feedback"
- [ ] **Verify**: Email arrives with blue badge

### Phase 5: Production Build

#### Build Verification
- [ ] Stop the development server
- [ ] Run: `npm run build`
- [ ] **Verify**: Build completes successfully with no errors
- [ ] **Verify**: No TypeScript compilation errors
- [ ] **Verify**: `/api/feedback` route is listed in build output
- [ ] Run: `npm run start` (production server)
- [ ] Navigate to the application
- [ ] **Verify**: Feedback button appears
- [ ] **Verify**: Feedback panel works correctly
- [ ] **Verify**: Feedback submission works in production mode
- [ ] Stop the production server

## Security Checklist

### XSS Prevention
- [ ] Submit feedback with message: `<script>alert('XSS')</script>`
- [ ] Check email notification
- [ ] **Verify**: Script tag is escaped in email (shows as `&lt;script&gt;...`)
- [ ] Submit feedback with message: `<img src=x onerror=alert('XSS')>`
- [ ] **Verify**: HTML is escaped in email

### CSRF Protection
- [ ] Verify API endpoint is protected by Next.js built-in CSRF protection
- [ ] **Verify**: Requests require valid authentication token

### Rate Limiting (Future Enhancement)
- [ ] Note: Currently no rate limiting implemented
- [ ] Consider adding rate limiting in production

## Success Criteria

All items checked = Feedback system is fully functional and ready for production ✅

## Known Limitations

1. **Admin Dashboard**: No admin interface to view all feedback (RLS policies only allow users to see their own feedback)
2. **Rate Limiting**: No rate limiting on feedback submissions (could be abused)
3. **Analytics**: No analytics dashboard for feedback trends
4. **Attachments**: No support for screenshot attachments (browser info and console logs only)

## Next Steps (Future Enhancements)

- [ ] Add admin dashboard to view/manage all feedback
- [ ] Add rate limiting (e.g., max 5 submissions per hour per user)
- [ ] Add feedback analytics (charts, trends, common issues)
- [ ] Add screenshot capture capability
- [ ] Add feedback status update notifications (email user when feedback is resolved)
- [ ] Add feedback search and filtering in admin panel
