import { NextRequest, NextResponse } from 'next/server';
import { getUserByEmail } from '@/lib/repositories/users';
import { createEmailVerification, getUnusedVerification } from '@/lib/repositories/email-verifications';
import { sendOTPEmail } from '@/lib/services/email';
import { z } from 'zod';

const ResendSchema = z.object({
  email: z.string().email('Invalid email'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // Get user by email
    const user = await getUserByEmail(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Email not found' },
        { status: 404 }
      );
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { error: 'Email already verified' },
        { status: 400 }
      );
    }

    // Check for existing unused verification
    const existingVerification = await getUnusedVerification(user.id);
    if (existingVerification) {
      const expiresAt = new Date(existingVerification.expires_at);
      const now = new Date();

      // If still valid and created less than 1 minute ago, don't send a new one (rate limiting)
      const createdAt = new Date(existingVerification.created_at);
      const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

      if (expiresAt > now && createdAt > oneMinuteAgo) {
        return NextResponse.json(
          { error: 'Please wait before requesting a new code' },
          { status: 429 }
        );
      }
    }

    // Create new verification
    const { code, expiresInMinutes } = await createEmailVerification(user.id);

    // Send OTP email
    await sendOTPEmail({
      email: user.email,
      code,
      expiresInMinutes,
    });

    return NextResponse.json(
      { message: 'Verification code sent' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Resend OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification code' },
      { status: 500 }
    );
  }
}
