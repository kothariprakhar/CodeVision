-- ABOUTME: Rich feedback system with browser context and console log capture
-- ABOUTME: Replaces the simple feedback_submissions table with comprehensive feedback tracking

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
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

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

-- Notes:
-- - Admin users will need separate policies to view all feedback (to be added later if needed)
-- - The browser_info JSONB field stores: user_agent, screen dimensions, viewport dimensions
-- - The console_logs JSONB field stores recent console errors/warnings with timestamps
-- - Foreign key to projects is nullable to support general feedback not tied to a specific project
-- - This is separate from the simpler feedback_submissions table created in 002_northwestern_features.sql
