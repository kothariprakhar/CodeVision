import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services/job-access', () => ({
  resolveJobAccess: vi.fn(async () => ({
    ok: true,
    value: { project_id: 'p1', analysis_id: 'a1', user_id: 'u1' },
  })),
}));

vi.mock('@/lib/repositories/analysis', () => ({
  getAnalysisById: vi.fn(async () => ({ id: 'a1' })),
}));

vi.mock('@/lib/services/analysis-views', () => ({
  buildTechStackView: vi.fn(() => ({
    languages: [],
    frameworks: [],
    infrastructure: [],
    external_services: [],
    architecture_pattern: { label: 'monolith', explanation: 'single deployable' },
    complexity_score: 4,
    complexity_factors: [],
    what_this_means: [],
    primary_technologies: [],
    module_technologies: [],
    inferred_platforms: [],
  })),
}));

describe('GET /api/analysis/:id/techstack', () => {
  beforeEach(() => vi.resetModules());

  it('returns tech stack payload', async () => {
    const { GET } = await import('@/app/api/analysis/[projectId]/techstack/route');
    const request = new NextRequest('http://localhost/api/analysis/a1/techstack');

    const response = await GET(request, { params: Promise.resolve({ projectId: 'a1' }) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.analysis_id).toBe('a1');
    expect(body.architecture_pattern.label).toBe('monolith');
  });
});
