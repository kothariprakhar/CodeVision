import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis, getAnalysisById } from '@/lib/repositories/analysis';
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

    // Check for version query param
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('version');

    // Get analysis by specific version or latest
    let analysis;
    if (analysisId) {
      analysis = await getAnalysisById(analysisId);
    } else {
      analysis = await getProjectAnalysis(projectId);
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis results found' },
        { status: 404 }
      );
    }

    // JSONB fields are already objects, no parsing needed
    const findings = analysis.findings;

    // Architecture is already an object (with fallback for null/undefined)
    const architecture = analysis.architecture || { nodes: [], edges: [] };

    return NextResponse.json({
      id: analysis.id,
      project_id: analysis.project_id,
      summary: analysis.summary,
      findings,
      architecture,
      capability_graph: analysis.capability_graph || null,
      journey_graph: analysis.journey_graph || null,
      quality_report: analysis.quality_report || null,
      analyzed_at: analysis.analyzed_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
