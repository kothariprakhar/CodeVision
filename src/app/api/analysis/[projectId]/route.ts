import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis, getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Verify project exists
    const project = getProject(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check for version query param
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('version');

    // Get analysis by specific version or latest
    let analysis;
    if (analysisId) {
      analysis = getAnalysisById(analysisId);
    } else {
      analysis = getProjectAnalysis(projectId);
    }

    if (!analysis) {
      return NextResponse.json(
        { error: 'No analysis results found' },
        { status: 404 }
      );
    }

    // Parse findings JSON
    const findings = JSON.parse(analysis.findings);

    // Parse architecture JSON (with fallback for older analyses)
    let architecture = { nodes: [], edges: [] };
    try {
      if (analysis.architecture) {
        architecture = JSON.parse(analysis.architecture);
      }
    } catch {
      // Keep default empty architecture if parsing fails
    }

    return NextResponse.json({
      id: analysis.id,
      project_id: analysis.project_id,
      summary: analysis.summary,
      findings,
      architecture,
      analyzed_at: analysis.analyzed_at,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis' },
      { status: 500 }
    );
  }
}
