import { NextRequest, NextResponse } from 'next/server';
import { chat, getAnalysisChatHistory } from '@/lib/services/chat';
import { getProject } from '@/lib/repositories/projects';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

const ChatSchema = z.object({
  project_id: z.string().min(1),
  analysis_id: z.string().min(1),
  message: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = ChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { project_id, analysis_id, message } = parsed.data;

    // Verify project exists and user owns it
    const project = await getProject(project_id);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

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
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('analysis_id');

    if (!analysisId) {
      return NextResponse.json(
        { error: 'analysis_id is required' },
        { status: 400 }
      );
    }

    // Verify the analysis exists and user owns the associated project
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return NextResponse.json(
        { error: 'Analysis not found' },
        { status: 404 }
      );
    }

    const project = await getProject(analysis.project_id);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const history = await getAnalysisChatHistory(analysisId);

    return NextResponse.json({ messages: history });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chat history' },
      { status: 500 }
    );
  }
}
