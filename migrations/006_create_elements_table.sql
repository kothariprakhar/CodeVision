-- ABOUTME: Create elements table for element-level code analysis data
-- ABOUTME: Stores UI element details with handlers, API calls, and state updates

-- Create elements table
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE NOT NULL,
  selector VARCHAR(500),
  element_type VARCHAR(50),
  component_name VARCHAR(255),
  file_path VARCHAR(500),
  line_number INTEGER,
  handlers JSONB NOT NULL DEFAULT '[]'::jsonb,
  api_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  parent_element_id UUID REFERENCES elements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_elements_analysis_id ON elements(analysis_id);
CREATE INDEX IF NOT EXISTS idx_elements_selector ON elements(selector);
CREATE INDEX IF NOT EXISTS idx_elements_component_name ON elements(component_name);
CREATE INDEX IF NOT EXISTS idx_elements_file_path ON elements(file_path);

-- Enable Row Level Security
ALTER TABLE elements ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view elements for their own analyses
CREATE POLICY "Users can view own analysis elements" ON elements
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM analysis_results ar
      JOIN projects p ON p.id = ar.project_id
      WHERE ar.id = elements.analysis_id
      AND p.user_id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE elements IS 'Element-level UI analysis data for Chrome plugin inspection';
COMMENT ON COLUMN elements.selector IS 'CSS/DOM selector for this element (e.g., button[data-testid="checkout"])';
COMMENT ON COLUMN elements.element_type IS 'Type of HTML element (button, input, form, div, etc.)';
COMMENT ON COLUMN elements.handlers IS 'Array of event handler objects with name, file, line';
COMMENT ON COLUMN elements.api_calls IS 'Array of API calls triggered by this element';
COMMENT ON COLUMN elements.state_updates IS 'Array of state updates performed by handlers';
