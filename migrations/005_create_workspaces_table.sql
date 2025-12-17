-- ABOUTME: Create workspaces table for Chrome plugin multi-repo support
-- ABOUTME: Stores user workspace configurations with domain mappings and manual API overrides

-- Create workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  manual_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_at ON workspaces(created_at DESC);

-- Enable Row Level Security
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own workspaces
CREATE POLICY "Users can view own workspaces" ON workspaces
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create their own workspaces
CREATE POLICY "Users can insert own workspaces" ON workspaces
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own workspaces
CREATE POLICY "Users can update own workspaces" ON workspaces
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policy: Users can delete their own workspaces
CREATE POLICY "Users can delete own workspaces" ON workspaces
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comments explaining the schema
COMMENT ON TABLE workspaces IS 'Chrome plugin workspace configurations linking domains to analyses';
COMMENT ON COLUMN workspaces.domain_mappings IS 'Array of {domain: string, analysisId: string} objects';
COMMENT ON COLUMN workspaces.analysis_ids IS 'Array of analysis UUIDs included in this workspace';
COMMENT ON COLUMN workspaces.manual_mappings IS 'Array of manual API endpoint mappings for failed auto-matches';
