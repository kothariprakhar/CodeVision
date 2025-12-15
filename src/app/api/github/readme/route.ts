// ABOUTME: API endpoint for importing README.md from GitHub repository
// ABOUTME: Fetches README content via GitHub API and returns as downloadable content
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ReadmeSchema = z.object({
  github_url: z.string().url(),
  github_token: z.string().optional().default(''),
  is_public: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ReadmeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }

    const { github_url, github_token, is_public } = parsed.data;

    // Extract owner/repo from URL
    const match = github_url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    if (!match) {
      return NextResponse.json(
        { error: 'Invalid GitHub URL format' },
        { status: 400 }
      );
    }

    const [, owner, repo] = match;

    // Fetch README from GitHub API
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'CodeVision-Analyzer',
    };

    if (github_token && github_token.trim()) {
      headers.Authorization = `token ${github_token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/readme`,
      { headers }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'README.md not found in repository' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch README from GitHub' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // README content is base64 encoded
    const content = Buffer.from(data.content, 'base64').toString('utf-8');

    return NextResponse.json({
      content,
      name: data.name,
      size: data.size,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to import README' },
      { status: 500 }
    );
  }
}
