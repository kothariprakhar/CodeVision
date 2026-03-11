import { NextRequest, NextResponse } from 'next/server';
import { resolveJobAccess } from '@/lib/services/job-access';
import { getJobStatus } from '@/lib/services/repo-jobs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const access = await resolveJobAccess(request, jobId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const job = getJobStatus(jobId);
    if (!job) {
      return NextResponse.json(
        {
          job_id: jobId,
          status: access.value.analysis_id ? 'completed' : 'unknown',
          stage: access.value.analysis_id ? 'done' : 'unknown',
          progress: access.value.analysis_id ? 100 : 0,
          message: access.value.analysis_id ? 'Analysis available' : 'Job not found in active queue',
          analysis_id: access.value.analysis_id,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      job_id: job.job_id,
      status: job.status,
      stage: job.stage,
      progress: job.progress,
      message: job.message,
      analysis_id: job.analysis_id || null,
      error: job.error || null,
      updated_at: job.updated_at,
    });
  } catch (error) {
    console.error('repo/status error:', error);
    return NextResponse.json({ error: 'Failed to fetch job status' }, { status: 500 });
  }
}

