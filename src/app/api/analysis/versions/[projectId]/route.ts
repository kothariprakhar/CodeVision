import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysisVersions } from '@/lib/repositories/analysis';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const versions = getProjectAnalysisVersions(projectId);
    return NextResponse.json({ versions });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch analysis versions' },
      { status: 500 }
    );
  }
}
