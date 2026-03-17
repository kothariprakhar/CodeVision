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

    const { searchParams } = new URL(request.url);
    const limitParam = Number(searchParams.get('limit'));
    const limit = Number.isFinite(limitParam) && limitParam > 0
      ? Math.min(20, Math.floor(limitParam))
      : null;

    const versions = await getProjectAnalysisVersions(projectId);
    const sliced = limit ? versions.slice(0, limit) : versions;
    const payload = sliced.map((version, index) => ({
      id: version.id,
      analyzed_at: version.analyzed_at,
      is_latest: index === 0,
      branch: version.branch || null,
      commit_hash: version.commit_hash || null,
      commit_url: version.commit_url || null,
      summary: version.summary || null,
      ref_type: version.ref_type || null,
      ref_label: version.ref_label || null,
    }));

    return NextResponse.json({ versions: payload });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis versions' },
      { status: 500 }
    );
  }
}
