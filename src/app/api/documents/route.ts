import { NextRequest, NextResponse } from 'next/server';
import { createDocument, getDocumentsByProject } from '@/lib/repositories/documents';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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

    // Validate project exists and user owns it
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
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
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
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

    // Upload to Supabase Storage
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const filePath = `${projectId}/${uuidv4()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Create database record
    const document = await createDocument({
      project_id: projectId,
      filename: file.name,
      file_type: actualFileType,
      file_path: filePath,
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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');

    if (!projectId) {
      return NextResponse.json(
        { error: 'project_id is required' },
        { status: 400 }
      );
    }

    // Verify project exists and user owns it
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const documents = await getDocumentsByProject(projectId);
    return NextResponse.json(documents);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}
