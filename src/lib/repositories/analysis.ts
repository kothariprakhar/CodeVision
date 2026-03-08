import { supabase } from '../db';
import type {
  AnalysisResult,
  Finding,
  ArchitectureVisualization,
  ChatMessage,
  CapabilityGraph,
  JourneyGraph,
  QualityReport,
  FounderContent,
} from '../db';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  capability_graph?: CapabilityGraph;
  journey_graph?: JourneyGraph;
  quality_report?: QualityReport;
  founder_content?: FounderContent;
  raw_response: string;
  branch?: string;
  commit_hash?: string;
  commit_url?: string;
}

export async function createAnalysis(input: CreateAnalysisInput): Promise<AnalysisResult> {
  const fullPayload = {
    project_id: input.project_id,
    summary: input.summary,
    findings: input.findings,
    architecture: input.architecture,
    capability_graph: input.capability_graph || null,
    journey_graph: input.journey_graph || null,
    quality_report: input.quality_report || null,
    founder_content: input.founder_content || null,
    chat_history: [],
    raw_response: input.raw_response,
    branch: input.branch,
    commit_hash: input.commit_hash,
    commit_url: input.commit_url,
  };

  const { data, error } = await supabase
    .from('analysis_results')
    .insert(fullPayload)
    .select()
    .single();

  if (error) {
    const message = error.message || '';
    if (message.includes('schema cache') || message.includes('column')) {
      console.warn(`DB schema mismatch: ${message}. Retrying with core columns only.`);
      const corePayload = {
        project_id: input.project_id,
        summary: input.summary,
        findings: input.findings,
        architecture: input.architecture,
        chat_history: [],
        raw_response: input.raw_response,
      };

      const retry = await supabase
        .from('analysis_results')
        .insert(corePayload)
        .select()
        .single();

      if (retry.error) throw new Error(`Failed to create analysis: ${retry.error.message}`);
      return retry.data as AnalysisResult;
    }
    throw new Error(`Failed to create analysis: ${message}`);
  }

  return data as AnalysisResult;
}

export async function getLatestAnalysis(projectId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('project_id', projectId)
    .order('analyzed_at', { ascending: false })
    .limit(1)
    .single();

  if (error) return null;
  return data as AnalysisResult;
}

export async function getAllAnalyses(projectId: string): Promise<AnalysisResult[]> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('project_id', projectId)
    .order('analyzed_at', { ascending: false });

  if (error) throw new Error(`Failed to get analyses: ${error.message}`);
  return data as AnalysisResult[];
}

export async function updateChatHistory(
  analysisId: string,
  chatHistory: ChatMessage[]
): Promise<void> {
  const { error } = await supabase
    .from('analysis_results')
    .update({ chat_history: chatHistory }) // JSONB - no stringify needed
    .eq('id', analysisId);

  if (error) throw new Error(`Failed to update chat history: ${error.message}`);
}

// Helper function to get analysis by ID (used by chat and other routes)
export async function getAnalysisById(analysisId: string): Promise<AnalysisResult | null> {
  const { data, error } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('id', analysisId)
    .single();

  if (error) return null;
  return data as AnalysisResult;
}

// Helper function to get chat history from an analysis
export async function getChatHistory(analysisId: string): Promise<ChatMessage[]> {
  const analysis = await getAnalysisById(analysisId);
  if (!analysis) return [];
  return analysis.chat_history;
}

// Delete all analyses for a project
export async function deleteProjectAnalysis(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('analysis_results')
    .delete()
    .eq('project_id', projectId);

  if (error) throw new Error(`Failed to delete project analyses: ${error.message}`);
}

// Legacy function names for backward compatibility
export const createAnalysisResult = createAnalysis;
export const getProjectAnalysis = getLatestAnalysis;
export const getProjectAnalysisVersions = getAllAnalyses;
