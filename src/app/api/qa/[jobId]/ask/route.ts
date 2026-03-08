import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveJobAccess } from '@/lib/services/job-access';
import { chat } from '@/lib/services/chat';

const AskSchema = z.object({
  question: z.string().min(1, 'Question is required'),
  elementContext: z.object({
    component: z.string().optional(),
    file: z.string().optional(),
    line: z.number().optional(),
    selector: z.string().optional(),
  }).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const access = await resolveJobAccess(request, jobId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.value.analysis_id) {
      return NextResponse.json({ error: 'Analysis not ready' }, { status: 409 });
    }

    const body = await request.json();
    const parsed = AskSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }

    const result = await chat(
      access.value.project_id,
      access.value.analysis_id,
      parsed.data.question,
      parsed.data.elementContext
    );

    return NextResponse.json({
      job_id: jobId,
      analysis_id: access.value.analysis_id,
      answer: result,
      follow_ups: result.followUps,
      referenced_modules: result.referencedModules,
    });
  } catch (error) {
    console.error('qa/ask error:', error);
    return NextResponse.json({ error: 'Failed to process Q&A request' }, { status: 500 });
  }
}
