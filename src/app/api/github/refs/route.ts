import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getProject } from '@/lib/repositories/projects';
import { listGitRefs } from '@/lib/services/github-refs';
import { getAllAnalyses } from '@/lib/repositories/analysis';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 });
    }

    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const refs = await listGitRefs(project.github_url, project.github_token);

    // Fetch existing analyses to mark which refs have been analyzed
    const analyses = await getAllAnalyses(projectId);
    const analyzedRefs = new Set<string>();
    for (const analysis of analyses) {
      if (analysis.ref_label) analyzedRefs.add(analysis.ref_label);
      if (analysis.branch) analyzedRefs.add(analysis.branch);
      if (analysis.commit_hash) analyzedRefs.add(analysis.commit_hash);
    }

    // Annotate refs with analysis status
    const annotate = (ref: typeof refs.branches[number]) => ({
      ...ref,
      hasAnalysis: analyzedRefs.has(ref.name) || analyzedRefs.has(ref.sha),
    });

    return NextResponse.json({
      branches: refs.branches.map(annotate),
      pullRequests: refs.pullRequests.map(r => ({
        ...annotate(r),
        hasAnalysis: analyzedRefs.has(`PR #${r.prNumber}`) || analyzedRefs.has(r.headBranch || '') || analyzedRefs.has(r.sha),
      })),
      recentCommits: refs.recentCommits.map(annotate),
      defaultBranch: refs.defaultBranch,
    });
  } catch (error) {
    console.error('github/refs error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch repository refs' },
      { status: 500 }
    );
  }
}
