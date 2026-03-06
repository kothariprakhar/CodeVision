import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis, getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import type { ModuleGraph3D, VisualQualityReport } from '@/lib/db';

function buildFallback3D(projectName: string): { moduleGraph3D: ModuleGraph3D; visualQualityReport: VisualQualityReport } {
  return {
    moduleGraph3D: {
      nodes: [
        {
          id: 'fallback-root',
          label: projectName || 'Repository',
          node_kind: 'directory',
          cluster_id: 'fallback',
          path: '/',
          loc: 0,
          hotness_score: 0.2,
          importance_score: 0.35,
          dependency_count: 0,
          confidence: 0.35,
          position_seed: { x: 0, y: 0, z: 0 },
        },
      ],
      edges: [],
    },
    visualQualityReport: {
      history_available: false,
      loc_coverage: 0,
      dependency_coverage: 0,
      fallback_mode: 'minimal',
      notes: ['3D architecture graph is unavailable for this analysis version.'],
    },
  };
}

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

    if (!analysis || analysis.project_id !== projectId) {
      return NextResponse.json({ error: 'No analysis results found' }, { status: 404 });
    }

    if (analysis.module_graph_3d && analysis.visual_quality_report) {
      return NextResponse.json({
        analysis_id: analysis.id,
        project_id: projectId,
        module_graph_3d: analysis.module_graph_3d,
        visual_quality_report: analysis.visual_quality_report,
        analyzed_at: analysis.analyzed_at,
      });
    }

    const fallback = buildFallback3D(project.name);
    return NextResponse.json({
      analysis_id: analysis.id,
      project_id: projectId,
      module_graph_3d: fallback.moduleGraph3D,
      visual_quality_report: fallback.visualQualityReport,
      analyzed_at: analysis.analyzed_at,
    });
  } catch (error) {
    console.error('Module graph 3D API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch 3D architecture diagram data' },
      { status: 500 }
    );
  }
}
