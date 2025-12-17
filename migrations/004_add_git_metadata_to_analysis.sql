-- ABOUTME: Add git metadata (branch, commit, commit_url) to analysis_results table
-- ABOUTME: Enables Chrome plugin to display "Analysis: main@abc123" with GitHub links

-- Add git metadata columns to analysis_results
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS branch VARCHAR(255),
ADD COLUMN IF NOT EXISTS commit_hash VARCHAR(40),
ADD COLUMN IF NOT EXISTS commit_url VARCHAR(500);

-- Create index for commit lookups
CREATE INDEX IF NOT EXISTS idx_analysis_results_commit ON analysis_results(commit_hash);

-- Add comment explaining the columns
COMMENT ON COLUMN analysis_results.branch IS 'Git branch name at time of analysis (e.g., "main", "develop")';
COMMENT ON COLUMN analysis_results.commit_hash IS 'Git commit SHA at time of analysis (short or full hash)';
COMMENT ON COLUMN analysis_results.commit_url IS 'Full GitHub URL to commit (e.g., https://github.com/user/repo/commit/abc123)';
