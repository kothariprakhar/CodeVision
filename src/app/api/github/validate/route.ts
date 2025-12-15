// ABOUTME: API endpoint for validating GitHub repository access
// ABOUTME: Tests if provided token has access to the specified repository
import { NextRequest, NextResponse } from 'next/server';
import { validateGitHubAccess } from '@/lib/services/github';
import { z } from 'zod';

const ValidateSchema = z.object({
  github_url: z.string().url(),
  github_token: z.string().optional().default(''),
  is_public: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ValidateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { valid: false, error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { github_url, github_token, is_public } = parsed.data;

    // Skip validation for public repos without token
    if (is_public && !github_token) {
      return NextResponse.json({ valid: true });
    }

    // Validate access
    const result = await validateGitHubAccess(github_url, github_token);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { valid: false, error: 'Failed to validate GitHub access' },
      { status: 500 }
    );
  }
}
