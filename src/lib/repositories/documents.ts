import { supabase } from '../db';
import type { Document } from '../db';

export interface CreateDocumentInput {
  project_id: string;
  filename: string;
  file_type: 'pdf' | 'markdown' | 'text' | 'image';
  file_path: string;
}

export async function createDocument(input: CreateDocumentInput): Promise<Document> {
  const { data, error } = await supabase
    .from('documents')
    .insert({
      project_id: input.project_id,
      filename: input.filename,
      file_type: input.file_type,
      file_path: input.file_path,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create document: ${error.message}`);
  return data as Document;
}

export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single();

  if (error) return null;
  return data as Document;
}

export async function getDocumentsByProject(projectId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('project_id', projectId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(`Failed to get documents: ${error.message}`);
  return data as Document[];
}

export async function deleteDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);
}
