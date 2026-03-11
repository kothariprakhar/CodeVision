import { NextRequest, NextResponse } from 'next/server';
import { resolveJobAccess } from '@/lib/services/job-access';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { buildRiskView } from '@/lib/services/analysis-views';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const access = await resolveJobAccess(request, projectId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    if (!access.value.analysis_id) {
      return NextResponse.json({ error: 'Analysis not ready' }, { status: 409 });
    }

    const analysis = await getAnalysisById(access.value.analysis_id);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const risks = buildRiskView(analysis);
    return NextResponse.json({
      id: projectId,
      analysis_id: analysis.id,
      ...risks,
    });
  } catch (error) {
    console.error('analysis/risks error:', error);
    return NextResponse.json({ error: 'Failed to fetch risk data' }, { status: 500 });
  }
}

