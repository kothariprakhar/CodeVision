-- ABOUTME: Add structured module layout hints artifact for deterministic and LLM-enriched diagram rendering
-- ABOUTME: Stores lane, cluster, hotspot, and focus-path hints for 2D and 3D architecture views

ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS module_layout_hints JSONB;

COMMENT ON COLUMN analysis_results.module_layout_hints IS 'Layout hints for architecture diagram rendering (lanes, clusters, hotspots, focus paths, and render profile)';
