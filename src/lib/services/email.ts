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
  email: string;
  message: string;
  page_url?: string;
  user_id?: string;
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

  const { error } = await resend.emails.send({
    from: 'Code Vision <noreply@yourdomain.com>', // Update with your verified domain
    to: adminEmails,
    subject: `[Code Vision] New Feedback from ${data.email}`,
    html: `
      <h2>New Feedback Submission</h2>
      <p><strong>Email:</strong> ${data.email}</p>
      ${data.user_id ? `<p><strong>User ID:</strong> ${data.user_id}</p>` : ''}
      ${data.page_url ? `<p><strong>Page:</strong> ${data.page_url}</p>` : ''}
      <p><strong>Message:</strong></p>
      <p>${data.message}</p>
      <hr />
      <p style="color: #666; font-size: 12px;">
        Submitted at ${new Date().toLocaleString()}
      </p>
    `,
  });

  if (error) {
    console.error('Failed to send feedback notification:', error);
    throw error;
  }

  return { success: true };
}
