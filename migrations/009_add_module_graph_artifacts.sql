-- ABOUTME: Add module architecture graph artifacts for 2D and 3D architecture diagram views
-- ABOUTME: Stores deterministic module graph outputs, visual graph payloads, and quality diagnostics

ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS module_graph JSONB,
ADD COLUMN IF NOT EXISTS module_quality_report JSONB,
ADD COLUMN IF NOT EXISTS module_graph_3d JSONB,
ADD COLUMN IF NOT EXISTS visual_quality_report JSONB;

COMMENT ON COLUMN analysis_results.module_graph IS 'Deterministic major-module architecture graph with evidence and confidence';
COMMENT ON COLUMN analysis_results.module_quality_report IS 'Coverage and fallback diagnostics for module graph generation';
COMMENT ON COLUMN analysis_results.module_graph_3d IS '3D-ready directory/file dependency graph payload with recency and LOC metadata';
COMMENT ON COLUMN analysis_results.visual_quality_report IS 'Quality diagnostics for 3D visual graph including history and dependency coverage';
