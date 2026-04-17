import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisById, getProjectAnalysisVersions } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { buildVersionDiff } from '@/lib/services/version-diff';
import { generateDiffNarrative } from '@/lib/services/diff-narrative';

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
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    let fromId = searchParams.get('from');
    let toId = searchParams.get('to');

    if (!fromId || !toId) {
      const versions = await getProjectAnalysisVersions(projectId);
      if (versions.length < 2) {
        return NextResponse.json(
          { error: 'Need at least two analysis versions to compare' },
          { status: 409 }
        );
      }
      toId = toId || versions[0].id;
      fromId = fromId || versions[1].id;
    }

    if (!fromId || !toId) {
      return NextResponse.json({ error: 'Invalid analysis ids for diff' }, { status: 400 });
    }
    if (fromId === toId) {
      return NextResponse.json({ error: 'from and to versions must be different' }, { status: 400 });
    }

    const [fromAnalysis, toAnalysis] = await Promise.all([
      getAnalysisById(fromId),
      getAnalysisById(toId),
    ]);

    if (!fromAnalysis || !toAnalysis) {
      return NextResponse.json({ error: 'Analysis version not found' }, { status: 404 });
    }
    if (fromAnalysis.project_id !== projectId || toAnalysis.project_id !== projectId) {
      return NextResponse.json({ error: 'Analysis does not belong to this project' }, { status: 400 });
    }

    const diff = buildVersionDiff(fromAnalysis, toAnalysis);

    // Opt-in narrative. Default OFF so existing clients remain byte-identical.
    const includeNarrative = searchParams.get('include_narrative') === 'true';
    const responseBody: {
      project_id: string;
      diff: typeof diff;
      narrative?: Awaited<ReturnType<typeof generateDiffNarrative>>;
    } = {
      project_id: projectId,
      diff,
    };

    if (includeNarrative) {
      // generateDiffNarrative never throws — it falls back deterministically on any failure.
      responseBody.narrative = await generateDiffNarrative(diff);
    }

    return NextResponse.json(responseBody);
  } catch (error) {
    console.error('analysis/diff error:', error);
    return NextResponse.json({ error: 'Failed to compute version diff' }, { status: 500 });
  }
}

