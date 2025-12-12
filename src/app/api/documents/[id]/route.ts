import { NextRequest, NextResponse } from 'next/server';
import { deleteDocument, getDocument } from '@/lib/repositories/documents';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const document = await getDocument(id);

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Verify user owns the project this document belongs to
    const project = await getProject(document.project_id);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from('documents')
      .remove([document.file_path]);

    if (deleteError) {
      console.error('Failed to delete file from storage:', deleteError);
      // Continue anyway to delete database record
    }

    // Delete database record
    await deleteDocument(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
