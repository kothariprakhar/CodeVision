import db, { AnalysisResult, Finding, ArchitectureVisualization } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateAnalysisInput {
  project_id: string;
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
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

export function deleteProjectAnalysis(projectId: string): void {
  const stmt = db.prepare('DELETE FROM analysis_results WHERE project_id = ?');
  stmt.run(projectId);
}
