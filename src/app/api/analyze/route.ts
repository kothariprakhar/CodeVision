import { NextRequest, NextResponse } from 'next/server';
import { analyzeProject } from '@/lib/services/analyzer';
import { getProject } from '@/lib/repositories/projects';
import { z } from 'zod';

const AnalyzeSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AnalyzeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { project_id } = parsed.data;

    // Check project exists
    const project = getProject(project_id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check project is not already being analyzed
    if (project.status === 'analyzing') {
      return NextResponse.json(
        { error: 'Analysis already in progress' },
        { status: 409 }
      );
    }

    // Run analysis
    const result = await analyzeProject(project_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      analysis_id: result.analysisId,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed unexpectedly' },
      { status: 500 }
    );
  }
}
