# Feedback Table Migration

**Created:** 2025-12-16
**Status:** Pending manual execution in Supabase SQL Editor

## Purpose

Create the `feedback` table to store user feedback submissions with rich context including browser information, console logs, and project associations.

## SQL to Execute

Run the following SQL in the Supabase SQL Editor:

```sql
-- Create feedback table
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

-- Create indexes for common queries
CREATE INDEX idx_feedback_user_id ON feedback(user_id);
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can insert their own feedback
CREATE POLICY "Users can insert own feedback" ON feedback
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can view their own feedback
CREATE POLICY "Users can view own feedback" ON feedback
  FOR SELECT
  USING (auth.uid() = user_id);
```

## Verification

After running the migration, verify the table was created successfully:

```sql
-- Check table exists and structure
SELECT * FROM feedback LIMIT 1;

-- Verify indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'feedback';

-- Verify RLS policies
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'feedback';
```

## Schema Details

### Table: `feedback`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Auto-generated unique identifier |
| `user_id` | UUID | NOT NULL, FK to users(id) | User who submitted feedback |
| `user_email` | VARCHAR(255) | NOT NULL | User's email for context |
| `category` | VARCHAR(50) | NOT NULL, CHECK constraint | One of: bug_report, feature_request, general_feedback |
| `message` | TEXT | NOT NULL | Feedback message content |
| `page_url` | VARCHAR(500) | NOT NULL | URL where feedback was submitted |
| `project_id` | UUID | NULLABLE, FK to projects(id) | Associated project (if any) |
| `browser_info` | JSONB | NOT NULL | Browser and device context |
| `console_logs` | JSONB | NULLABLE | Recent console errors/warnings |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Submission timestamp |
| `status` | VARCHAR(20) | DEFAULT 'new', CHECK constraint | One of: new, reviewed, resolved |

### Indexes

- `idx_feedback_user_id`: Fast lookups by user
- `idx_feedback_status`: Filter by status
- `idx_feedback_created_at`: Sort by submission date (descending)

### Row Level Security

- **INSERT**: Users can only insert feedback with their own user_id
- **SELECT**: Users can only view their own feedback submissions

## Notes

- Admin users will need separate policies to view all feedback (to be added later if needed)
- The `browser_info` JSONB field stores: user_agent, screen dimensions, viewport dimensions
- The `console_logs` JSONB field stores recent console errors/warnings with timestamps
- Foreign key to `projects` is nullable to support general feedback not tied to a specific project
