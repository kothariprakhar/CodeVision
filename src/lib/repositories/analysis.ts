import db, { AnalysisResult, Finding, ArchitectureVisualization, ChatMessage } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
}

export interface AnalysisVersion {
  id: string;
  analyzed_at: string;
  is_latest: boolean;
}

export function createAnalysisResult(input: CreateAnalysisInput): AnalysisResult {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO analysis_results (id, project_id, summary, findings, architecture, raw_response)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.project_id,
    input.summary,
    JSON.stringify(input.findings),
    JSON.stringify(input.architecture),
    input.raw_response
  );

  return getAnalysisResult(id)!;
}

export function getAnalysisResult(id: string): AnalysisResult | null {
  const stmt = db.prepare('SELECT * FROM analysis_results WHERE id = ?');
  return stmt.get(id) as AnalysisResult | null;
}

export function getProjectAnalysis(projectId: string): AnalysisResult | null {
  const stmt = db.prepare(`
    SELECT * FROM analysis_results
    WHERE project_id = ?
    ORDER BY analyzed_at DESC
    LIMIT 1
  `);
  return stmt.get(projectId) as AnalysisResult | null;
}

export function getProjectAnalysisVersions(projectId: string): AnalysisVersion[] {
  const stmt = db.prepare(`
    SELECT id, analyzed_at FROM analysis_results
    WHERE project_id = ?
    ORDER BY analyzed_at DESC
  `);
  const results = stmt.all(projectId) as { id: string; analyzed_at: string }[];

  return results.map((r, index) => ({
    id: r.id,
    analyzed_at: r.analyzed_at,
    is_latest: index === 0,
  }));
}

export function getAnalysisById(analysisId: string): AnalysisResult | null {
  const stmt = db.prepare('SELECT * FROM analysis_results WHERE id = ?');
  return stmt.get(analysisId) as AnalysisResult | null;
}

export function getChatHistory(analysisId: string): ChatMessage[] {
  const stmt = db.prepare('SELECT chat_history FROM analysis_results WHERE id = ?');
  const result = stmt.get(analysisId) as { chat_history: string } | null;
  if (!result) return [];
  return JSON.parse(result.chat_history);
}

export function updateChatHistory(analysisId: string, messages: ChatMessage[]): void {
  const stmt = db.prepare('UPDATE analysis_results SET chat_history = ? WHERE id = ?');
  stmt.run(JSON.stringify(messages), analysisId);
}

export function deleteProjectAnalysis(projectId: string): void {
  const stmt = db.prepare('DELETE FROM analysis_results WHERE project_id = ?');
  stmt.run(projectId);
}
