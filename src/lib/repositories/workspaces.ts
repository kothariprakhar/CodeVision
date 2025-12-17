// ABOUTME: Repository layer for Chrome plugin workspaces (multi-repo configurations)
// ABOUTME: Handles CRUD operations for workspace entities with domain and API mappings

import { z } from 'zod';
import { supabase } from '../db';
import type { Workspace, DomainMapping, ManualAPIMapping } from '../db';

const DomainMappingSchema = z.object({
  domain: z.string().min(1, 'Domain must not be empty'),
  analysisId: z.string().uuid('analysisId must be a valid UUID'),
});

const ManualAPIMappingSchema = z.object({
  frontendCall: z.string().min(1, 'Frontend call must not be empty'),
  backendEndpoint: z.string().min(1, 'Backend endpoint must not be empty'),
  backendAnalysisId: z.string().uuid('backendAnalysisId must be a valid UUID'),
});

const CreateWorkspaceSchema = z.object({
  user_id: z.string().uuid('user_id must be a valid UUID'),
  name: z.string().min(1, 'Name must not be empty').max(255, 'Name must not exceed 255 characters'),
  domain_mappings: z.array(DomainMappingSchema).optional(),
  analysis_ids: z.array(z.string().uuid('Each analysis_id must be a valid UUID')).optional(),
  manual_mappings: z.array(ManualAPIMappingSchema).optional(),
});

export interface CreateWorkspaceInput {
  user_id: string;
  name: string;
  domain_mappings?: DomainMapping[];
  analysis_ids?: string[];
  manual_mappings?: ManualAPIMapping[];
}

export interface UpdateWorkspaceInput {
  name?: string;
  domain_mappings?: DomainMapping[];
  analysis_ids?: string[];
  manual_mappings?: ManualAPIMapping[];
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<Workspace> {
  const validated = CreateWorkspaceSchema.parse(input);

  const { data, error } = await supabase
    .from('workspaces')
    .insert({
      user_id: validated.user_id,
      name: validated.name,
      domain_mappings: validated.domain_mappings || [],
      analysis_ids: validated.analysis_ids || [],
      manual_mappings: validated.manual_mappings || [],
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create workspace: ${error.message}`);
  return data as Workspace;
}

export async function getUserWorkspaces(userId: string): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get workspaces: ${error.message}`);
  return data as Workspace[];
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (error) return null;
  return data as Workspace;
}

export async function updateWorkspace(
  workspaceId: string,
  input: UpdateWorkspaceInput
): Promise<Workspace> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) updateData.name = input.name;
  if (input.domain_mappings !== undefined) updateData.domain_mappings = input.domain_mappings;
  if (input.analysis_ids !== undefined) updateData.analysis_ids = input.analysis_ids;
  if (input.manual_mappings !== undefined) updateData.manual_mappings = input.manual_mappings;

  const { data, error } = await supabase
    .from('workspaces')
    .update(updateData)
    .eq('id', workspaceId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update workspace: ${error.message}`);
  return data as Workspace;
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);

  if (error) throw new Error(`Failed to delete workspace: ${error.message}`);
}
