import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/repositories/users';
import { isAllowedEmail } from '@/lib/auth';
import { createEmailVerification } from '@/lib/repositories/email-verifications';
import { sendOTPEmail } from '@/lib/services/email';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Lazy initialization for Supabase client (using service role to bypass RLS)
function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not set in environment variables');
  }
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = SignupSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    // Check email domain - if not allowed, add to waitlist
    if (!isAllowedEmail(email)) {
      const supabase = getSupabaseClient();

      // Check if already on waitlist
      const { data: existing } = await supabase
        .from('waitlist_requests')
        .select('id')
        .eq('email', email)
        .single();

      if (!existing) {
        // Add to waitlist automatically
        await supabase
          .from('waitlist_requests')
          .insert({
            email,
            name: email.split('@')[0], // Use email prefix as name
            organization: email.split('@')[1], // Use domain as organization
            reason: 'Signed up via registration form',
            status: 'pending',
          });
      }

      return NextResponse.json(
        {
          error: 'Account pending approval',
          waitlist: true,
          message: 'You have been added to our waitlist. We will notify you when your account is ready.'
        },
        { status: 403 }
      );
    }

    // Check if email already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Create user (email_verified will default to false)
    const user = await createUser({ email, password });

    // Generate OTP
    const { code, expiresInMinutes } = await createEmailVerification(user.id);

    // Send OTP email
    await sendOTPEmail({
      email: user.email,
      code,
      expiresInMinutes,
    });

    return NextResponse.json(
      {
        message: 'Account created. Please check your email for verification code.',
        email: user.email,
        requiresVerification: true,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
