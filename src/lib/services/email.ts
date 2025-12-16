// ABOUTME: Email notification service using Resend for waitlist and feedback notifications
// ABOUTME: Fetches admin emails from Supabase admin_config table for dynamic recipient management

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

// Lazy initialization to avoid build-time errors when RESEND_API_KEY is not set
let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Lazy initialization for Supabase client
let supabaseClient: ReturnType<typeof createClient> | null = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error('Supabase credentials not set in environment variables');
    }
    supabaseClient = createClient(url, key);
  }
  return supabaseClient;
}

interface WaitlistData {
  email: string;
  name: string;
  organization?: string;
  reason: string;
}

interface FeedbackData {
  user_email: string;
  user_id: string;
  category: 'bug_report' | 'feature_request' | 'general_feedback';
  message: string;
  page_url: string;
  project_id?: string;
  project_name?: string;
  browser_info: {
    user_agent: string;
    screen_width: number;
    screen_height: number;
    viewport_width: number;
    viewport_height: number;
  };
  console_logs?: Array<{
    level: 'error' | 'warn';
    message: string;
    timestamp: number;
  }>;
}

async function getAdminEmails(): Promise<string[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', 'admin_emails')
    .single();

  if (error || !data) {
    console.error('Failed to fetch admin emails:', error);
    return ['admin@northwestern.edu']; // Fallback
  }

  return (data as { value: string[] }).value;
}

export async function sendWaitlistNotification(data: WaitlistData) {
  const adminEmails = await getAdminEmails();
  const resend = getResendClient();

  const { error } = await resend.emails.send({
    from: 'Code Vision <noreply@yourdomain.com>', // Update with your verified domain
    to: adminEmails,
    subject: `[Code Vision] New Waitlist Request from ${data.name}`,
    html: `
      <h2>New Waitlist Request</h2>
      <p><strong>Name:</strong> ${data.name}</p>
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.organization ? `<p><strong>Organization:</strong> ${data.organization}</p>` : ''}
      <p><strong>Reason for Interest:</strong></p>
      <p>${data.reason}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Submitted at ${new Date().toLocaleString()}
      </p>
    `,
  });

  if (error) {
    console.error('Failed to send waitlist notification:', error);
    throw error;
  }

  return { success: true };
}

export async function sendFeedbackNotification(data: FeedbackData) {
  const adminEmails = await getAdminEmails();
  const resend = getResendClient();

  // Category badge colors
  const categoryColors = {
    bug_report: '#EF4444',
    feature_request: '#3B82F6',
    general_feedback: '#6B7280',
  };

  const categoryLabels = {
    bug_report: '🐛 Bug Report',
    feature_request: '✨ Feature Request',
    general_feedback: '💬 General Feedback',
  };

  const categoryColor = categoryColors[data.category];
  const categoryLabel = categoryLabels[data.category];

  // Browser info summary
  const browserSummary = `${data.browser_info.user_agent.split(' ')[0]} | ${data.browser_info.screen_width}x${data.browser_info.screen_height}`;

  // Recent errors section
  const errorsHtml = data.console_logs && data.console_logs.length > 0
    ? `
      <h3 style="margin-top: 20px; color: #EF4444;">Recent Console Errors</h3>
      <ul style="background: #FEF2F2; padding: 15px; border-radius: 8px;">
        ${data.console_logs.map(log => `
          <li style="margin: 5px 0; font-family: monospace; font-size: 12px;">
            <strong>[${log.level}]</strong> ${log.message}
            <span style="color: #666; font-size: 11px;">(${new Date(log.timestamp).toLocaleTimeString()})</span>
          </li>
        `).join('')}
      </ul>
    `
    : '';

  // Project link section
  const projectHtml = data.project_id && data.project_name
    ? `<p><strong>Project:</strong> ${data.project_name} (<code>${data.project_id}</code>)</p>`
    : '';

  const { error } = await resend.emails.send({
    from: 'Code Vision <noreply@yourdomain.com>',
    to: adminEmails,
    subject: `[Code Vision] ${categoryLabel} from ${data.user_email}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px;">
        <div style="background: ${categoryColor}; color: white; padding: 15px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${categoryLabel}</h2>
        </div>

        <div style="border: 1px solid #E5E7EB; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
          <p><strong>From:</strong> ${data.user_email}</p>
          <p><strong>User ID:</strong> <code>${data.user_id}</code></p>
          ${projectHtml}
          <p><strong>Page:</strong> <a href="${data.page_url}">${data.page_url}</a></p>
          <p><strong>Browser:</strong> ${browserSummary}</p>

          <h3 style="margin-top: 20px;">Message</h3>
          <div style="background: #F9FAFB; padding: 15px; border-radius: 8px; white-space: pre-wrap;">
${data.message}
          </div>

          ${errorsHtml}

          <hr style="margin: 20px 0; border: none; border-top: 1px solid #E5E7EB;" />
          <p style="color: #666; font-size: 12px;">
            Submitted at ${new Date().toLocaleString()}
          </p>
        </div>
      </div>
    `,
  });

  if (error) {
    console.error('Failed to send feedback notification:', error);
    throw error;
  }

  return { success: true };
}
