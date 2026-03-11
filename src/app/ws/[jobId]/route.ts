import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  return NextResponse.json(
    {
      error: 'WebSocket upgrade is not available in this runtime route handler.',
      fallback: `/api/repo/${jobId}/events`,
      protocol: 'Server-Sent Events',
      message: 'Use EventSource for real-time progress streaming.',
    },
    { status: 426 }
  );
}

