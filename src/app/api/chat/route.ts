import { NextRequest, NextResponse } from 'next/server';
import { chat, getAnalysisChatHistory } from '@/lib/services/chat';
import { z } from 'zod';

const ChatSchema = z.object({
  project_id: z.string().min(1),
  analysis_id: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { project_id, analysis_id, message } = parsed.data;

    const response = await chat(project_id, analysis_id, message);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysis_id');

    if (!analysisId) {
      return NextResponse.json(
        { error: 'analysis_id is required' },
        { status: 400 }
      );
    }

    const history = getAnalysisChatHistory(analysisId);

    return NextResponse.json({ messages: history });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}
