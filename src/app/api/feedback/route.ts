// ABOUTME: API endpoint for handling user feedback submissions
// ABOUTME: Validates input, stores in Supabase, sends email notifications to admins

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendFeedbackNotification } from '@/lib/services/email';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

// Lazy initialization for Supabase client (using service role to bypass RLS)
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not set in environment variables');
  }
  return createClient(url, key);
}

const BrowserInfoSchema = z.object({
  user_agent: z.string(),
  screen_width: z.number(),
  screen_height: z.number(),
  viewport_width: z.number(),
  viewport_height: z.number(),
});

const ConsoleLogSchema = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string(),
  timestamp: z.number(),
});

const FeedbackSchema = z.object({
  category: z.enum(['bug_report', 'feature_request', 'general_feedback']),
  message: z.string().min(1, 'Message is required').max(1000, 'Message too long'),
  page_url: z.string().url(),
  project_id: z.string().uuid().optional(),
  browser_info: BrowserInfoSchema,
  console_logs: z.array(ConsoleLogSchema).optional(),
});

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();

  try {
    // Get authenticated user
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const parsed = FeedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { category, message, page_url, project_id, browser_info, console_logs } = parsed.data;

    // Get project name if project_id provided
    let project_name: string | undefined;
    if (project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('name')
        .eq('id', project_id)
        .single();

      if (project) {
        project_name = project.name;
      }
    }

    // Insert feedback into database
    const { data: feedback, error: insertError } = await supabase
      .from('feedback')
      .insert({
        user_id: user.id,
        user_email: user.email,
        category,
        message,
        page_url,
        project_id: project_id || null,
        browser_info,
        console_logs: console_logs || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to insert feedback:', insertError);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    // Send email notification to admins
    try {
      await sendFeedbackNotification({
        user_email: user.email,
        user_id: user.id,
        category,
        message,
        page_url,
        project_id,
        project_name,
        browser_info,
        console_logs,
      });
    } catch (emailError) {
      console.error('Failed to send feedback email:', emailError);
      // Don't fail the request if email fails - feedback is still saved
    }

    return NextResponse.json({
      success: true,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
