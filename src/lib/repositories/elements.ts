// ABOUTME: Repository layer for element-level analysis data
// ABOUTME: Handles CRUD operations for UI elements with handlers and API calls

import { supabase } from '../db';
import type { Element, ElementHandler, ElementAPICall, StateUpdate } from '../db';

export interface CreateElementInput {
  analysis_id: string;
  selector?: string;
  element_type?: string;
  component_name?: string;
  file_path?: string;
  line_number?: number;
  handlers?: ElementHandler[];
  api_calls?: ElementAPICall[];
  state_updates?: StateUpdate[];
  parent_element_id?: string;
}

export async function createElement(input: CreateElementInput): Promise<Element> {
  const { data, error } = await supabase
    .from('elements')
    .insert({
      analysis_id: input.analysis_id,
      selector: input.selector || null,
      element_type: input.element_type || null,
      component_name: input.component_name || null,
      file_path: input.file_path || null,
      line_number: input.line_number || null,
      handlers: input.handlers || [],
      api_calls: input.api_calls || [],
      state_updates: input.state_updates || [],
      parent_element_id: input.parent_element_id || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create element: ${error.message}`);
  return data as Element;
}

export async function createElements(inputs: CreateElementInput[]): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .insert(
      inputs.map(input => ({
        analysis_id: input.analysis_id,
        selector: input.selector || null,
        element_type: input.element_type || null,
        component_name: input.component_name || null,
        file_path: input.file_path || null,
        line_number: input.line_number || null,
        handlers: input.handlers || [],
        api_calls: input.api_calls || [],
        state_updates: input.state_updates || [],
        parent_element_id: input.parent_element_id || null,
      }))
    )
    .select();

  if (error) throw new Error(`Failed to create elements: ${error.message}`);
  return data as Element[];
}

export async function getAnalysisElements(analysisId: string): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('analysis_id', analysisId)
    .order('file_path', { ascending: true });

  if (error) throw new Error(`Failed to get elements: ${error.message}`);
  return data as Element[];
}

export async function getElementBySelector(
  analysisId: string,
  selector: string
): Promise<Element | null> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('selector', selector)
    .single();

  if (error) return null;
  return data as Element;
}

export async function getElementsByComponent(
  analysisId: string,
  componentName: string
): Promise<Element[]> {
  const { data, error } = await supabase
    .from('elements')
    .select('*')
    .eq('analysis_id', analysisId)
    .eq('component_name', componentName);

  if (error) throw new Error(`Failed to get elements by component: ${error.message}`);
  return data as Element[];
}

export async function deleteAnalysisElements(analysisId: string): Promise<void> {
  const { error } = await supabase.from('elements').delete().eq('analysis_id', analysisId);

  if (error) throw new Error(`Failed to delete elements: ${error.message}`);
}
