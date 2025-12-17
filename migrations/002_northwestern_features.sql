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
  ('admin_emails', '["sabari.sunil@kellogg.northwestern.edu"]'::jsonb)
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
