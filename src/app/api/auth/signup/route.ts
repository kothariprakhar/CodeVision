import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/repositories/users';
import { createToken, setAuthCookie, isAllowedEmail } from '@/lib/auth';
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

    // Create user
    const user = await createUser({ email, password });

    // Create token and set cookie
    const token = createToken(user);
    const response = NextResponse.json(
      { user: { id: user.id, email: user.email } },
      { status: 201 }
    );
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
