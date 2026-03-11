// ABOUTME: Supabase client initialization and shared TypeScript types for the application.
// ABOUTME: Defines interfaces for User, Project, Analysis, Architecture, and other core entities.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

// Use service role key for server-side operations (bypasses RLS)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Export types (unchanged)
export type ProjectStatus = 'pending' | 'analyzing' | 'completed' | 'failed';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  email_verified: boolean;
  created_at: string;
}

export interface EmailVerification {
  id: string;
  user_id: string;
  code: string;
  expires_at: string;
  created_at: string;
  used_at: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType: 'quick' | 'detailed';
  followUps?: string[];
  referencedModules?: string[];
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  github_url: string;
  github_token: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  project_id: string;
  filename: string;
  file_type: 'pdf' | 'markdown' | 'text' | 'image';
  file_path: string;
  uploaded_at: string;
}

export interface AnalysisResult {
  id: string;
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  capability_graph?: CapabilityGraph | null;
  journey_graph?: JourneyGraph | null;
  quality_report?: QualityReport | null;
  founder_content?: FounderContent | null;
  business_context?: BusinessContext | null;
  chat_history: ChatMessage[];
  raw_response: string;
  analyzed_at: string;
  branch?: string;
  commit_hash?: string;
  commit_url?: string;
}

export interface Finding {
  type: 'gap' | 'fidelity';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence: string[];
}

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

export interface DataFlowStep {
  step: number;
  label: string;
  description: string;
  nodeIds: string[];
}

export interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  dataFlow?: DataFlowStep[];
}

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  domain_mappings: DomainMapping[];
  analysis_ids: string[];
  manual_mappings: ManualAPIMapping[];
  created_at: string;
  updated_at: string;
}

export interface DomainMapping {
  domain: string;
  analysisId: string;
}

export interface ManualAPIMapping {
  frontendCall: string;
  backendEndpoint: string;
  backendAnalysisId: string;
}

export interface Element {
  id: string;
  analysis_id: string;
  selector: string | null;
  element_type: string | null;
  component_name: string | null;
  file_path: string | null;
  line_number: number | null;
  handlers: ElementHandler[];
  api_calls: ElementAPICall[];
  state_updates: StateUpdate[];
  parent_element_id: string | null;
  created_at: string;
}

export interface ElementHandler {
  name: string;
  file: string;
  line: number;
  code?: string;
}

export interface ElementAPICall {
  method: string;
  path: string;
  file: string;
  line: number;
}

export interface StateUpdate {
  variable: string;
  action: string;
}

export interface EvidenceRef {
  source_type: 'file' | 'api_route' | 'db_table' | 'doc' | 'config' | 'inference';
  ref: string;
  snippet: string;
  line_start?: number;
  line_end?: number;
}

export interface LensRisk {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  confidence: number;
  evidence: EvidenceRef[];
}

export interface CapabilityNode {
  id: string;
  name: string;
  node_type:
    | 'capability_domain'
    | 'capability'
    | 'sub_capability'
    | 'system_component'
    | 'api'
    | 'datastore'
    | 'external_service';
  depth: 0 | 1 | 2;
  description: string;
  business_value: string;
  maturity: 'nascent' | 'developing' | 'stable' | 'advanced' | 'unknown';
  owner_role?: string;
  confidence: number;
  evidence: EvidenceRef[];
  risks: LensRisk[];
  kpis: string[];
}

export interface CapabilityEdge {
  from: string;
  to: string;
  relation:
    | 'contains'
    | 'depends_on'
    | 'enables'
    | 'integrates_with'
    | 'stores_in'
    | 'exposes';
  confidence: number;
  evidence: EvidenceRef[];
}

export interface CapabilityGraph {
  top_level_summary: string;
  nodes: CapabilityNode[];
  edges: CapabilityEdge[];
}

export interface JourneyStep {
  id: string;
  journey_id: string;
  order: number;
  name: string;
  step_type:
    | 'entry'
    | 'action'
    | 'validation'
    | 'payment'
    | 'system'
    | 'notification'
    | 'exit'
    | 'unknown';
  description: string;
  data_passed?: string;
  business_outcome: string;
  friction_risk: 'low' | 'medium' | 'high' | 'critical';
  dropoff_likelihood?: number;
  systems_touched: string[];
  confidence: number;
  evidence: EvidenceRef[];
  risks: LensRisk[];
}

export interface Journey {
  id: string;
  name: string;
  persona: string;
  goal: string;
  kpi: string;
  steps: JourneyStep[];
}

export interface JourneyGraph {
  summary: string;
  journeys: Journey[];
}

export interface ArchitectureDomain {
  name: string;
  color_hint: string;
  modules: string[];
  purpose: string;
}

export interface QualityReport {
  coverage_score: number;
  evidence_density: number;
  low_confidence_ratio: number;
  missing_signals: string[];
  assumptions: string[];
  needs_manual_input: string[];
}

export interface FounderNarrative {
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
  founder_narrative: FounderNarrative;
  technical_narrative: FounderNarrative;
}

export interface FounderContent {
  narrative: FounderNarrative;
  node_descriptions: Record<string, string>;
  finding_rewrites: Array<{
    original_title: string;
    title: string;
    description: string;
  }>;
  journey_rewrites: Record<string, {
    name: string;
    goal: string;
    step_descriptions: Record<string, string>;
  }>;
  risk_rewrites: Array<{
    original_title: string;
    title: string;
    impact: string;
    why_it_matters: string;
  }>;
}
