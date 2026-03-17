-- ABOUTME: Add ref tracking columns to analysis_results for branch/commit/PR-aware analysis
-- ABOUTME: Enables comparing analyses across different git refs (branches, commits, PRs)

ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS ref_type TEXT,
ADD COLUMN IF NOT EXISTS ref_label TEXT;

COMMENT ON COLUMN analysis_results.ref_type IS 'Type of git ref analyzed: branch, commit, pr, or NULL for default-branch analyses';
COMMENT ON COLUMN analysis_results.ref_label IS 'Human-readable label for the ref: branch name, PR #N, or short SHA';
