import { NextRequest, NextResponse } from 'next/server';
import { verifyOTP } from '@/lib/repositories/email-verifications';
import { getUserByEmail } from '@/lib/repositories/users';
import { createToken, setAuthCookie } from '@/lib/auth';
import { z } from 'zod';

const VerifySchema = z.object({
  email: z.string().email('Invalid email'),
  code: z.string().length(6, 'Code must be 6 digits'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email, code } = parsed.data;

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or code' },
        { status: 400 }
      );
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Verify OTP
    const isValid = await verifyOTP(user.id, code);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid or expired code' },
        { status: 400 }
      );
    }

    // Create token and set cookie
    const token = createToken({ ...user, email_verified: true });
    const response = NextResponse.json(
      {
        user: { id: user.id, email: user.email },
        message: 'Email verified successfully'
      },
      { status: 200 }
    );
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
