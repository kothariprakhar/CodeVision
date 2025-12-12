import { NextRequest, NextResponse } from 'next/server';
import { createUser, getUserByEmail } from '@/lib/repositories/users';
import { createToken, setAuthCookie, isAllowedEmail } from '@/lib/auth';
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

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

    // Check email domain
    if (!isAllowedEmail(email)) {
      return NextResponse.json(
        { error: 'Email domain not allowed. Please use your northwestern.edu email.' },
        { status: 400 }
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
