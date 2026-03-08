-- Add founder_content JSONB column to store AI-generated plain-language rewrites.
ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS founder_content JSONB;

COMMENT ON COLUMN analysis_results.founder_content
  IS 'AI-generated founder-friendly rewrites of narrative, nodes, journeys, findings, and risks';
