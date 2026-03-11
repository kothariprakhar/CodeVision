import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/services/job-access', () => ({
  resolveJobAccess: vi.fn(async () => ({
    ok: true,
    value: { project_id: 'p1', analysis_id: 'a1', user_id: 'u1' },
  })),
}));

vi.mock('@/lib/services/chat', () => ({
  chat: vi.fn(async () => ({
    id: 'msg-1',
    content: 'Sample answer',
    responseType: 'quick',
    timestamp: new Date().toISOString(),
    followUps: ['Follow up?'],
    referencedModules: ['auth-module'],
  })),
}));

describe('POST /api/qa/:id/ask', () => {
  beforeEach(() => vi.resetModules());

  it('returns structured answer and module references', async () => {
    const { POST } = await import('@/app/api/qa/[jobId]/ask/route');
    const request = new NextRequest('http://localhost/api/qa/a1/ask', {
      method: 'POST',
      body: JSON.stringify({ question: 'How does auth work?' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(request, { params: Promise.resolve({ jobId: 'a1' }) });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.answer.content).toContain('Sample answer');
    expect(body.follow_ups).toEqual(['Follow up?']);
    expect(body.referenced_modules).toEqual(['auth-module']);
  });
});
