import { NextRequest, NextResponse } from 'next/server';
import { createDocument, getProjectDocuments } from '@/lib/repositories/documents';
import { getProject } from '@/lib/repositories/projects';
import { writeFile } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, 'pdf' | 'markdown' | 'text' | 'image'> = {
  'application/pdf': 'pdf',
  'text/markdown': 'markdown',
  'text/plain': 'text',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const projectId = formData.get('project_id') as string;
    const file = formData.get('file') as File;

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json(
        { error: 'file is required' },
        { status: 400 }
      );
    }

    // Validate project exists
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type];
    if (!fileType) {
      // Check by extension as fallback
      const ext = path.extname(file.name).toLowerCase();
      if (ext === '.md') {
        // Handle .md files
      } else {
        return NextResponse.json(
          { error: `Unsupported file type: ${file.type}. Allowed: PDF, Markdown, Text, PNG, JPG, GIF, WebP` },
          { status: 400 }
        );
      }
    }

    // Determine actual file type
    let actualFileType: 'pdf' | 'markdown' | 'text' | 'image' = fileType;
    if (!actualFileType) {
      const ext = path.extname(file.name).toLowerCase();
      if (ext === '.md' || ext === '.markdown') {
        actualFileType = 'markdown';
      } else if (ext === '.txt') {
        actualFileType = 'text';
      }
    }

    if (!actualFileType) {
      return NextResponse.json(
        { error: 'Could not determine file type' },
        { status: 400 }
      );
    }

    // Ensure upload directory exists
    const projectUploadDir = path.join(UPLOAD_DIR, projectId);
    if (!fs.existsSync(projectUploadDir)) {
      fs.mkdirSync(projectUploadDir, { recursive: true });
    }

    // Save file with unique name
    const fileId = uuidv4();
    const ext = path.extname(file.name);
    const savedFilename = `${fileId}${ext}`;
    const filePath = path.join(projectUploadDir, savedFilename);
    const relativePath = path.join('uploads', projectId, savedFilename);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Create database record
    const document = createDocument({
      project_id: projectId,
      filename: file.name,
      file_type: actualFileType,
      file_path: relativePath,
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    const documents = getProjectDocuments(projectId);
    return NextResponse.json(documents);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
