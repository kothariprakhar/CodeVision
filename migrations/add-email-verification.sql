-- Migration: Add email verification system
-- Description: Adds email_verified column to users table and creates email_verifications table for OTP codes
-- Date: 2025-12-17

-- Add email_verified column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;

-- Create email_verifications table for OTP codes
CREATE TABLE IF NOT EXISTS email_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  used_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

-- Create index on expires_at for cleanup queries
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires_at ON email_verifications(expires_at);

-- Create index on used_at for finding unused codes
CREATE INDEX IF NOT EXISTS idx_email_verifications_used_at ON email_verifications(used_at);

-- Comments
COMMENT ON COLUMN users.email_verified IS 'Whether the user has verified their email address via OTP';
COMMENT ON TABLE email_verifications IS 'Stores one-time password codes for email verification';
COMMENT ON COLUMN email_verifications.code IS '6-digit OTP code sent to user email';
COMMENT ON COLUMN email_verifications.expires_at IS 'When the OTP code expires (typically 15 minutes from creation)';
COMMENT ON COLUMN email_verifications.used_at IS 'When the code was used successfully (NULL if unused)';
