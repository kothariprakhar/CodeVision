import db, { Document } from '../db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface CreateDocumentInput {
  project_id: string;
  filename: string;
  file_type: 'pdf' | 'markdown' | 'text' | 'image';
  file_path: string;
}

export function createDocument(input: CreateDocumentInput): Document {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO documents (id, project_id, filename, file_type, file_path)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.project_id, input.filename, input.file_type, input.file_path);

  return getDocument(id)!;
}

export function getDocument(id: string): Document | null {
  const stmt = db.prepare('SELECT * FROM documents WHERE id = ?');
  return stmt.get(id) as Document | null;
}

export function getProjectDocuments(projectId: string): Document[] {
  const stmt = db.prepare('SELECT * FROM documents WHERE project_id = ? ORDER BY uploaded_at DESC');
  return stmt.all(projectId) as Document[];
}

export function deleteDocument(id: string): void {
  const doc = getDocument(id);
  if (doc) {
    // Delete file from filesystem
    const fullPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  const stmt = db.prepare('DELETE FROM documents WHERE id = ?');
  stmt.run(id);
}

export function deleteProjectDocuments(projectId: string): void {
  const docs = getProjectDocuments(projectId);
  for (const doc of docs) {
    const fullPath = path.join(process.cwd(), doc.file_path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  const stmt = db.prepare('DELETE FROM documents WHERE project_id = ?');
  stmt.run(projectId);
}
