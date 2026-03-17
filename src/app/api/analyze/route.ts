import { NextRequest, NextResponse } from 'next/server';
import { analyzeProject } from '@/lib/services/analyzer';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

const AnalyzeSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
  ref_type: z.enum(['branch', 'commit', 'pr']).optional(),
  ref_value: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    const project = await getProject(project_id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check ownership
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check project is not already being analyzed
    if (project.status === 'analyzing') {
      return NextResponse.json(
        { error: 'Analysis already in progress' },
        { status: 409 }
      );
    }

    // Run analysis
    const result = await analyzeProject(project_id, {
      ref: parsed.data.ref_type && parsed.data.ref_value
        ? { refType: parsed.data.ref_type, refValue: parsed.data.ref_value }
        : undefined,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      id: result.analysisId,
      message: 'Analysis completed',
    });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Analysis failed unexpectedly' },
      { status: 500 }
    );
  }
}
