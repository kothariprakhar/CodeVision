import { NextRequest, NextResponse } from 'next/server';
import { resolveJobAccess } from '@/lib/services/job-access';
import { getAnalysisChatHistory, getStarterQuestionsForAnalysis } from '@/lib/services/chat';

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
    if (!access.value.analysis_id) {
      return NextResponse.json({ error: 'Analysis not ready' }, { status: 409 });
    }

    const [history, starterQuestions] = await Promise.all([
      getAnalysisChatHistory(access.value.analysis_id),
      getStarterQuestionsForAnalysis(access.value.analysis_id),
    ]);
    return NextResponse.json({
      job_id: jobId,
      analysis_id: access.value.analysis_id,
      history,
      starter_questions: starterQuestions,
    });
  } catch (error) {
    console.error('qa/history error:', error);
    return NextResponse.json({ error: 'Failed to fetch Q&A history' }, { status: 500 });
  }
}
