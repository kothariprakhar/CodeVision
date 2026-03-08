import type { NextRequest } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getProject } from '@/lib/repositories/projects';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getJob } from './repo-jobs';

export interface ResolvedJobAccess {
  user_id: string;
  project_id: string;
  analysis_id: string | null;
}

export async function resolveJobAccess(
  request: NextRequest,
  jobOrAnalysisId: string
): Promise<{ ok: true; value: ResolvedJobAccess } | { ok: false; status: number; error: string }> {
  const user = await getUserFromRequest(request);
  if (!user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const job = getJob(jobOrAnalysisId);
  if (job) {
    if (job.user_id !== user.id) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    return {
      ok: true,
      value: {
        user_id: user.id,
        project_id: job.project_id,
        analysis_id: job.analysis_id || null,
      },
    };
  }

  const analysis = await getAnalysisById(jobOrAnalysisId);
  if (!analysis) {
    return { ok: false, status: 404, error: 'Job or analysis not found' };
  }
  const project = await getProject(analysis.project_id);
  if (!project || project.user_id !== user.id) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }

  return {
    ok: true,
    value: {
      user_id: user.id,
      project_id: analysis.project_id,
      analysis_id: analysis.id,
    },
  };
}

