import { NextRequest, NextResponse } from 'next/server';
import { resolveJobAccess } from '@/lib/services/job-access';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { generatePdfBufferFromAnalysis } from '@/lib/services/export-service';

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

    const analysis = await getAnalysisById(access.value.analysis_id);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const pdf = generatePdfBufferFromAnalysis(analysis);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="codevision-${access.value.analysis_id}.pdf"`,
      },
    });
  } catch (error) {
    console.error('export/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
