import db, { Project, ProjectStatus } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface CreateProjectInput {
  name: string;
  description?: string;
  github_url: string;
  github_token: string;
  repo_path?: string;
}

export function createProject(input: CreateProjectInput): Project {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO projects (id, name, description, github_url, github_token, repo_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.name,
    input.description || null,
    input.github_url,
    input.github_token,
    input.repo_path || null
  );

  return getProject(id)!;
}

export function getProject(id: string): Project | null {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  return stmt.get(id) as Project | null;
}

export function getAllProjects(): Project[] {
  const stmt = db.prepare('SELECT * FROM projects ORDER BY created_at DESC');
  return stmt.all() as Project[];
}

export function updateProjectStatus(id: string, status: ProjectStatus): void {
  const stmt = db.prepare(`
    UPDATE projects
    SET status = ?, updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run(status, id);
}

export function updateProjectRepoPath(projectId: string, repoPath: string): void {
  const stmt = db.prepare(`
    UPDATE projects SET repo_path = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(repoPath, projectId);
}

export function deleteProject(id: string): void {
  const stmt = db.prepare('DELETE FROM projects WHERE id = ?');
  stmt.run(id);
}
