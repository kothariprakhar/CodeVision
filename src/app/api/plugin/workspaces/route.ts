// ABOUTME: Chrome plugin endpoint to fetch user's workspace configurations
// ABOUTME: Returns workspace list with domain mappings and associated analyses

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserWorkspaces } from '@/lib/repositories/workspaces';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's workspaces
    const workspaces = await getUserWorkspaces(user.id);

    // Enrich workspaces with analysis details
    const enrichedWorkspaces = await Promise.all(
      workspaces.map(async workspace => {
        const analyses = await Promise.all(
          workspace.analysis_ids.map(async analysisId => {
            const analysis = await getAnalysisById(analysisId);
            if (!analysis) return null;

            const project = await getProject(analysis.project_id);
            if (!project) return null;

            return {
              id: analysis.id,
              name: project.name,
              repoUrl: project.github_url,
              branch: analysis.branch || 'unknown',
              commit: analysis.commit_hash || 'unknown',
              analyzedAt: analysis.analyzed_at,
            };
          })
        );

        return {
          id: workspace.id,
          name: workspace.name,
          domains: workspace.domain_mappings,
          analyses: analyses.filter(a => a !== null),
          manualMappings: workspace.manual_mappings,
        };
      })
    );

    return NextResponse.json({ workspaces: enrichedWorkspaces });
  } catch (error) {
    console.error('Plugin workspaces error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch workspaces' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, domainMappings, analysisIds, manualMappings } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    const { createWorkspace } = await import('@/lib/repositories/workspaces');

    const workspace = await createWorkspace({
      user_id: user.id,
      name,
      domain_mappings: domainMappings || [],
      analysis_ids: analysisIds || [],
      manual_mappings: manualMappings || [],
    });

    return NextResponse.json({ workspace }, { status: 201 });
  } catch (error) {
    console.error('Create workspace error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create workspace' },
      { status: 500 }
    );
  }
}
