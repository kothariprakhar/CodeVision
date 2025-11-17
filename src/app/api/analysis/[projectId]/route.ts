import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis } from '@/lib/repositories/analysis';
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

    const analysis = getProjectAnalysis(projectId);
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
      if ((analysis as Record<string, unknown>).architecture) {
        architecture = JSON.parse((analysis as Record<string, unknown>).architecture as string);
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
