-- ABOUTME: Add business capability and user journey lens artifacts to analysis_results
-- ABOUTME: Stores deterministic graph outputs and quality diagnostics for non-technical architecture views

ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS capability_graph JSONB,
ADD COLUMN IF NOT EXISTS journey_graph JSONB,
ADD COLUMN IF NOT EXISTS quality_report JSONB;

COMMENT ON COLUMN analysis_results.capability_graph IS 'Business capability architecture graph for non-technical stakeholders';
COMMENT ON COLUMN analysis_results.journey_graph IS 'User journey/value-stream graph with step-level risk context';
COMMENT ON COLUMN analysis_results.quality_report IS 'Coverage, confidence, and missing-signal diagnostics for generated lens artifacts';

