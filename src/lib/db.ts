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
  files: string[];
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  type: 'imports' | 'calls' | 'stores' | 'renders';
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
