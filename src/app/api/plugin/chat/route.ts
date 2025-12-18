// ABOUTME: Chrome plugin endpoint for chat with optional element context
// ABOUTME: Enables contextual Q&A about specific UI elements during code inspection

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { chat, ElementContext } from '@/lib/services/chat';
import { z } from 'zod';

const PluginChatSchema = z.object({
  analysisId: z.string().min(1),
  message: z.string().min(1).max(2000),
  elementContext: z.object({
    component: z.string().optional(),
    file: z.string().optional(),
    line: z.number().optional(),
    selector: z.string().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = PluginChatSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { analysisId, message, elementContext } = validationResult.data;

    // Verify analysis exists and user owns it
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const project = await getProject(analysis.project_id);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Call chat service with optional element context
    const chatResponse = await chat(
      project.id,
      analysisId,
      message,
      elementContext as ElementContext | undefined
    );

    return NextResponse.json(chatResponse);
  } catch (error) {
    console.error('Plugin chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process chat request' },
      { status: 500 }
    );
  }
}
