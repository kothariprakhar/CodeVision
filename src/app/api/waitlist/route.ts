// ABOUTME: API endpoint for handling waitlist requests from non-Northwestern users
// ABOUTME: Validates email, saves to Supabase, sends admin notification via Resend

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWaitlistNotification } from '@/lib/services/email';

// Lazy initialization for Supabase client
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not set in environment variables');
  }
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseClient();
  try {
    const body = await request.json();
    const { email, name, organization, reason } = body;

    // Validation
    if (!email || !name || !reason) {
      return NextResponse.json(
        { error: 'Email, name, and reason are required' },
        { status: 400 }
      );
    }

    // Check if already on waitlist
    const { data: existing } = await supabase
      .from('waitlist_requests')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This email is already on the waitlist' },
        { status: 409 }
      );
    }

    // Insert waitlist request
    const { data, error } = await supabase
      .from('waitlist_requests')
      .insert({
        email,
        name,
        organization: organization || null,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create waitlist request:', error);
      return NextResponse.json(
        { error: 'Failed to join waitlist' },
        { status: 500 }
      );
    }

    // Send email notification to admins
    try {
      await sendWaitlistNotification({ email, name, organization, reason });
    } catch (emailError) {
      console.error('Failed to send waitlist notification:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully joined the waitlist!',
      data,
    });
  } catch (error) {
    console.error('Waitlist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
