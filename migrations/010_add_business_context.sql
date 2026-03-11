ALTER TABLE analysis_results
ADD COLUMN IF NOT EXISTS business_context JSONB;

COMMENT ON COLUMN analysis_results.business_context
  IS 'Structured Pass 3+4 content: problem_statement, value_features, data_usage, external_deps, how_it_works, components, scale_assessment, technology_choices';
