// ABOUTME: Repository for managing email verification codes and OTP validation
// ABOUTME: Handles creation, retrieval, and verification of one-time passwords for email confirmation

import { supabase } from '../db';
import { EmailVerification } from '../db';
import crypto from 'crypto';

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 15;

// Generate a 6-digit OTP
function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// Create a new email verification record
export async function createEmailVerification(userId: string): Promise<{ code: string; expiresInMinutes: number }> {
  const code = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  const { error } = await supabase
    .from('email_verifications')
    .insert({
      user_id: userId,
      code,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Error creating email verification:', error);
    throw new Error('Failed to create email verification');
  }

  return {
    code,
    expiresInMinutes: OTP_EXPIRY_MINUTES,
  };
}

// Verify an OTP code for a user
export async function verifyOTP(userId: string, code: string): Promise<boolean> {
  // Get the most recent unused verification code for this user
  const { data, error } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('user_id', userId)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return false;
  }

  const verification = data as EmailVerification;

  // Check if code matches
  if (verification.code !== code) {
    return false;
  }

  // Check if expired
  if (new Date(verification.expires_at) < new Date()) {
    return false;
  }

  // Mark as used
  await supabase
    .from('email_verifications')
    .update({ used_at: new Date().toISOString() })
    .eq('id', verification.id);

  // Mark user as verified
  await supabase
    .from('users')
    .update({ email_verified: true })
    .eq('id', userId);

  return true;
}

// Get unused verification for a user (for resend functionality)
export async function getUnusedVerification(userId: string): Promise<EmailVerification | null> {
  const { data, error } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('user_id', userId)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data as EmailVerification;
}

// Clean up expired verifications (can be called periodically)
export async function cleanupExpiredVerifications(): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from('email_verifications')
    .delete()
    .lt('expires_at', now);
}
