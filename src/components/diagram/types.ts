export interface ArchitectureNode {
  id: string;
  name: string;
  type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
  complexity: 'low' | 'medium' | 'high';
  description: string;
  business_role?: string;
  files: string[];
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
  label?: string;
  data_flow?: string;
  trigger?: string;
}

export interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}

export interface ArchitectureDomain {
  name: string;
  color_hint: string;
  modules: string[];
  purpose: string;
}

export interface NarrativeMode {
  executive_summary: string;
  how_it_works: string;
  components: Array<{
    name: string;
    explanation: string;
    business_analogy: string;
  }>;
  scale_assessment: string;
  technology_choices: string[];
}

export interface BusinessContext {
  problem_statement: string;
  architecture_domains: ArchitectureDomain[];
  value_features: Array<{
    name: string;
    description: string;
    business_impact: string;
    modules_involved: string[];
  }>;
  data_usage: Array<{
    data_type: string;
    collected_from: string;
    used_for: string;
    stored_in: string;
  }>;
  external_deps: Array<{
    name: string;
    why_needed: string;
    what_breaks_without_it: string;
  }>;
  founder_narrative: NarrativeMode;
  technical_narrative: NarrativeMode;
}
