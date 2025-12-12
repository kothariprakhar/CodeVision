import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysisVersions } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;

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

    const versions = await getProjectAnalysisVersions(projectId);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis versions' },
      { status: 500 }
    );
  }
}
