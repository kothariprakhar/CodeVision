// ABOUTME: Chrome plugin endpoint to fetch user's workspace configurations
// ABOUTME: Returns workspace list with domain mappings and associated analyses

import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { getUserWorkspaces, createWorkspace } from '@/lib/repositories/workspaces';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { z } from 'zod';

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

const DomainMappingSchema = z.object({
  domain: z.string().min(1),
  analysisId: z.string().uuid(),
});

const ManualAPIMappingSchema = z.object({
  frontendCall: z.string().min(1),
  backendEndpoint: z.string().min(1),
  backendAnalysisId: z.string().uuid(),
});

const CreateWorkspaceBodySchema = z.object({
  name: z.string().min(1).max(255),
  domainMappings: z.array(DomainMappingSchema).optional(),
  analysisIds: z.array(z.string().uuid()).optional(),
  manualMappings: z.array(ManualAPIMappingSchema).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const parsed = CreateWorkspaceBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { name, domainMappings, analysisIds, manualMappings } = parsed.data;

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
