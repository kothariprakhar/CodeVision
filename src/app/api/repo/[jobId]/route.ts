import { NextRequest, NextResponse } from 'next/server';
import { cancelJob, deleteJob, getJob } from '@/lib/services/repo-jobs';
import { resolveJobAccess } from '@/lib/services/job-access';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const access = await resolveJobAccess(request, jobId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const job = getJob(jobId);
    if (job && (job.status === 'queued' || job.status === 'running')) {
      const cancelled = cancelJob(jobId);
      return NextResponse.json({
        success: true,
        action: 'cancelled',
        job_id: jobId,
        status: cancelled?.status || 'cancelled',
        stage: cancelled?.stage || 'cancelled',
        progress: cancelled?.progress || 0,
        message: cancelled?.message || 'Cancelling analysis...',
      });
    }

    const removed = deleteJob(jobId);
    return NextResponse.json({
      success: true,
      action: removed ? 'deleted' : 'no-op',
      job_id: jobId,
    });
  } catch (error) {
    console.error('repo/delete error:', error);
    return NextResponse.json({ error: 'Failed to cancel/delete job' }, { status: 500 });
  }
}

