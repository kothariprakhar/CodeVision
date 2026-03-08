import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { analyzeProject } from './analyzer';
import { getAnalysisById, getProjectAnalysis } from '../repositories/analysis';
import { getProject } from '../repositories/projects';

export type RepoJobStage =
  | 'queued'
  | 'cloning'
  | 'parsing'
  | 'pass_1'
  | 'pass_2'
  | 'pass_3'
  | 'pass_4'
  | 'done'
  | 'failed'
  | 'cancelled';

export type RepoJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface RepoJobRecord {
  job_id: string;
  user_id: string;
  project_id: string;
  status: RepoJobStatus;
  stage: RepoJobStage;
  progress: number;
  message: string;
  analysis_id?: string;
  error?: string;
  created_at: string;
  updated_at: string;
  cancelled: boolean;
}

const jobs = new Map<string, RepoJobRecord>();
const jobEvents = new EventEmitter();
jobEvents.setMaxListeners(1000);

function nowIso(): string {
  return new Date().toISOString();
}

function emitJobEvent(job: RepoJobRecord): void {
  jobEvents.emit(job.job_id, {
    stage: job.stage,
    progress: job.progress,
    message: job.message,
    status: job.status,
    analysis_id: job.analysis_id,
    error: job.error,
    updated_at: job.updated_at,
  });
}

function updateJob(jobId: string, patch: Partial<RepoJobRecord>): RepoJobRecord | null {
  const existing = jobs.get(jobId);
  if (!existing) return null;
  const updated: RepoJobRecord = {
    ...existing,
    ...patch,
    updated_at: nowIso(),
  };
  jobs.set(jobId, updated);
  emitJobEvent(updated);
  return updated;
}

export function getJob(jobId: string): RepoJobRecord | null {
  return jobs.get(jobId) || null;
}

export function getJobStatus(jobId: string): RepoJobRecord | null {
  return getJob(jobId);
}

export function subscribeToJob(
  jobId: string,
  callback: (event: Record<string, unknown>) => void
): () => void {
  const handler = (event: Record<string, unknown>) => callback(event);
  jobEvents.on(jobId, handler);
  const current = jobs.get(jobId);
  if (current) {
    callback({
      stage: current.stage,
      progress: current.progress,
      message: current.message,
      status: current.status,
      analysis_id: current.analysis_id,
      error: current.error,
      updated_at: current.updated_at,
    });
  }
  return () => {
    jobEvents.off(jobId, handler);
  };
}

export async function createAndStartJob(input: {
  user_id: string;
  project_id: string;
}): Promise<RepoJobRecord> {
  const project = await getProject(input.project_id);
  if (!project) {
    throw new Error('Project not found');
  }
  if (project.user_id !== input.user_id) {
    throw new Error('Forbidden');
  }

  const jobId = uuidv4();
  const record: RepoJobRecord = {
    job_id: jobId,
    user_id: input.user_id,
    project_id: input.project_id,
    status: 'queued',
    stage: 'queued',
    progress: 0,
    message: 'Queued for analysis',
    created_at: nowIso(),
    updated_at: nowIso(),
    cancelled: false,
  };
  jobs.set(jobId, record);
  emitJobEvent(record);

  void runJob(jobId);
  return record;
}

async function runJob(jobId: string): Promise<void> {
  const current = jobs.get(jobId);
  if (!current) return;

  updateJob(jobId, {
    status: 'running',
    stage: 'cloning',
    progress: 5,
    message: 'Cloning repository...',
  });

  const result = await analyzeProject(current.project_id, {
    onProgress: (event) => {
      const stage = (event.stage || 'parsing') as RepoJobStage;
      if (jobs.get(jobId)?.cancelled) return;
      updateJob(jobId, {
        status: 'running',
        stage,
        progress: Math.max(0, Math.min(100, Math.floor(event.progress))),
        message: event.message || '',
      });
    },
    shouldCancel: () => Boolean(jobs.get(jobId)?.cancelled),
  });

  const latest = jobs.get(jobId);
  if (!latest) return;
  if (latest.cancelled) {
    updateJob(jobId, {
      status: 'cancelled',
      stage: 'cancelled',
      progress: latest.progress,
      message: 'Analysis cancelled',
      error: undefined,
    });
    return;
  }

  if (!result.success) {
    updateJob(jobId, {
      status: result.error === 'Analysis cancelled' ? 'cancelled' : 'failed',
      stage: result.error === 'Analysis cancelled' ? 'cancelled' : 'failed',
      progress: result.error === 'Analysis cancelled' ? latest.progress : latest.progress || 0,
      message: result.error || 'Analysis failed',
      error: result.error,
    });
    return;
  }

  let analysisId = result.analysisId;
  if (!analysisId) {
    const latestAnalysis = await getProjectAnalysis(current.project_id);
    analysisId = latestAnalysis?.id;
  }

  updateJob(jobId, {
    status: 'completed',
    stage: 'done',
    progress: 100,
    message: 'Analysis complete!',
    analysis_id: analysisId,
  });
}

export function cancelJob(jobId: string): RepoJobRecord | null {
  const current = jobs.get(jobId);
  if (!current) return null;
  if (current.status === 'completed' || current.status === 'failed' || current.status === 'cancelled') {
    return current;
  }

  return updateJob(jobId, {
    cancelled: true,
    status: 'cancelled',
    stage: 'cancelled',
    message: 'Cancelling analysis...',
  });
}

export function deleteJob(jobId: string): boolean {
  const exists = jobs.has(jobId);
  jobs.delete(jobId);
  return exists;
}

export async function resolveAnalysisFromJob(jobId: string): Promise<{
  job: RepoJobRecord | null;
  analysis_id: string | null;
  project_id: string | null;
}> {
  const job = jobs.get(jobId) || null;
  if (job?.analysis_id) {
    return {
      job,
      analysis_id: job.analysis_id,
      project_id: job.project_id,
    };
  }

  const analysis = await getAnalysisById(jobId);
  if (analysis) {
    return {
      job,
      analysis_id: analysis.id,
      project_id: analysis.project_id,
    };
  }

  return {
    job,
    analysis_id: null,
    project_id: job?.project_id || null,
  };
}
