import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { resolveJobAccess } from '@/lib/services/job-access';

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
      return NextResponse.json(
        { error: 'Analysis result is not ready yet' },
        { status: 409 }
      );
    }

    const analysis = await getAnalysisById(access.value.analysis_id);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis result not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: analysis.id,
      project_id: analysis.project_id,
      summary: analysis.summary,
      findings: analysis.findings,
      architecture: analysis.architecture,
      capability_graph: analysis.capability_graph || null,
      journey_graph: analysis.journey_graph || null,
      quality_report: analysis.quality_report || null,
      analyzed_at: analysis.analyzed_at,
      raw_response: analysis.raw_response,
    });
  } catch (error) {
    console.error('repo/result error:', error);
    return NextResponse.json({ error: 'Failed to fetch job result' }, { status: 500 });
  }
}

