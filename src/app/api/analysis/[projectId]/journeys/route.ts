import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis, getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { generateBusinessLensArtifacts } from '@/lib/services/lenses';

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
    const analysisId = searchParams.get('version');

    const analysis = analysisId
      ? await getAnalysisById(analysisId)
      : await getProjectAnalysis(projectId);

    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis results found' },
        { status: 404 }
      );
    }

    const generated = generateBusinessLensArtifacts({
      architecture: analysis.architecture,
      findings: analysis.findings,
      projectName: project.name,
    });

    return NextResponse.json({
      analysis_id: analysis.id,
      project_id: projectId,
      journey_graph: analysis.journey_graph || generated.journey_graph,
      quality_report: analysis.quality_report || generated.quality_report,
      analyzed_at: analysis.analyzed_at,
    });
  } catch (error) {
    console.error('Journeys API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user journey architecture' },
      { status: 500 }
    );
  }
}
