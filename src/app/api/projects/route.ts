import { NextRequest, NextResponse } from 'next/server';
import { createProject, getProjectsByUser } from '@/lib/repositories/projects';
import { validateGitHubAccess } from '@/lib/services/github';
import { analyzeProject } from '@/lib/services/analyzer';
import { getUserFromRequest } from '@/lib/auth';
import { z } from 'zod';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  github_url: z.string().url('Invalid URL').refine(
    url => url.includes('github.com'),
    'Must be a GitHub URL'
  ),
  github_token: z.string().optional().default(''),
  is_public: z.boolean().optional().default(false),
}).refine(
  data => data.is_public || data.github_token.length > 0,
  { message: 'Token is required for private repositories', path: ['github_token'] }
);

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projects = await getProjectsByUser(user.id);
    return NextResponse.json(projects);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = CreateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, description, github_url, github_token, is_public } = parsed.data;

    // Validate GitHub access (skip validation for public repos without token)
    if (!is_public && github_token) {
      const validation = await validateGitHubAccess(github_url, github_token);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error },
          { status: 400 }
        );
      }
    }

    const project = await createProject({
      user_id: user.id,
      name,
      description,
      github_url,
      github_token: is_public ? '' : github_token,
    });

    // Start auto-analysis in background (don't await)
    analyzeProject(project.id).catch(err => {
      console.error('Auto-analysis failed:', err);
    });

    return NextResponse.json({ ...project, status: 'analyzing' }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}
