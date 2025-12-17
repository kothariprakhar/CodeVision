import { supabase } from '../db';
import type { AnalysisResult, Finding, ArchitectureVisualization, ChatMessage } from '../db';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
  branch?: string;           // NEW
  commit_hash?: string;      // NEW
  commit_url?: string;       // NEW
}

export async function createAnalysis(input: CreateAnalysisInput): Promise<AnalysisResult> {
  const { data, error } = await supabase
    .from('analysis_results')
    .insert({
      project_id: input.project_id,
      summary: input.summary,
      findings: input.findings, // JSONB - no stringify needed
      architecture: input.architecture, // JSONB - no stringify needed
      chat_history: [], // JSONB - no stringify needed
      raw_response: input.raw_response,
      branch: input.branch,                 // NEW
      commit_hash: input.commit_hash,       // NEW
      commit_url: input.commit_url,         // NEW
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create analysis: ${error.message}`);
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
