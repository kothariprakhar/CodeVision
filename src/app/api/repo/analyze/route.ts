import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserFromRequest } from '@/lib/auth';
import { getProject } from '@/lib/repositories/projects';
import { createAndStartJob } from '@/lib/services/repo-jobs';

const AnalyzeRepoSchema = z.object({
  project_id: z.string().uuid('Invalid project ID'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = AnalyzeRepoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const project = await getProject(parsed.data.project_id);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const job = await createAndStartJob({
      user_id: user.id,
      project_id: parsed.data.project_id,
    });

    return NextResponse.json({
      success: true,
      job_id: job.job_id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      stream_url: `/api/repo/${job.job_id}/events`,
    });
  } catch (error) {
    console.error('repo/analyze error:', error);
    return NextResponse.json({ error: 'Failed to create analysis job' }, { status: 500 });
  }
}

