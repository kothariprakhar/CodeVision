import { NextRequest, NextResponse } from 'next/server';
import { getProjectAnalysis, getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import type { ModuleGraph, ModuleQualityReport } from '@/lib/db';

function buildFallbackModuleGraphFromArchitecture(
  architecture: { nodes: Array<{ id: string; name: string; type: string; files?: string[] }>; edges: Array<{ from: string; to: string; type: string }> } | null | undefined,
  projectName: string
): { moduleGraph: ModuleGraph; qualityReport: ModuleQualityReport } {
  const architectureNodes = architecture?.nodes || [];
  if (architectureNodes.length === 0) {
    return {
      moduleGraph: {
        root_summary: `Architecture diagram fallback for ${projectName}; no module graph artifact is available yet.`,
        repo_archetype: 'unknown',
        nodes: [
          {
            id: 'fallback',
            label: 'Unclassified Module',
            module_type: 'unknown',
            layer: 'unknown',
            paths: [],
            importance_score: 0.35,
            confidence: 0.35,
            evidence: [
              {
                source_type: 'inference',
                ref: 'fallback',
                snippet: 'Module graph was not generated for this analysis version.',
              },
            ],
          },
        ],
        edges: [],
      },
      qualityReport: {
        coverage_score: 0.2,
        low_confidence_ratio: 1,
        missing_signals: ['module_graph_not_generated'],
        assumptions: ['This fallback is derived from sparse architecture metadata only.'],
        fallback_mode: 'minimal',
      },
    };
  }

  const nodes: ModuleGraph['nodes'] = architectureNodes.slice(0, 12).map(node => ({
    id: `legacy-${node.id}`,
    label: node.name,
    module_type: 'module',
    layer: 'unknown',
    paths: (node.files || []).slice(0, 12),
    importance_score: 0.55,
    confidence: 0.5,
    evidence: [
      {
        source_type: 'inference',
        ref: node.id,
        snippet: `Derived from architecture node "${node.name}"`,
      },
    ],
  }));

  const idMap = new Map<string, string>(architectureNodes.slice(0, 12).map(node => [node.id, `legacy-${node.id}`]));
  const edges: ModuleGraph['edges'] = [];
  for (const edge of architecture?.edges || []) {
    const from = idMap.get(edge.from);
    const to = idMap.get(edge.to);
    if (!from || !to) continue;
    edges.push({
      from,
      to,
      relation: edge.type === 'calls' ? 'calls' : 'depends_on',
      confidence: 0.45,
      evidence: [
        {
          source_type: 'inference',
          ref: `${edge.from}->${edge.to}`,
          snippet: 'Derived from architecture edge',
        },
      ],
    });
  }

  return {
    moduleGraph: {
      root_summary: `${projectName} architecture diagram is in fallback mode using existing architecture metadata.`,
      repo_archetype: 'unknown',
      nodes,
      edges,
    },
    qualityReport: {
      coverage_score: 0.45,
      low_confidence_ratio: 0.8,
      missing_signals: ['module_graph_not_generated'],
      assumptions: ['This fallback is derived from architecture metadata and may omit true module boundaries.'],
      fallback_mode: 'tree_only',
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { projectId } = await params;
    const project = await getProject(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const analysisId = searchParams.get('version');
    const analysis = analysisId
      ? await getAnalysisById(analysisId)
      : await getProjectAnalysis(projectId);

    if (!analysis || analysis.project_id !== projectId) {
      return NextResponse.json({ error: 'No analysis results found' }, { status: 404 });
    }

    if (analysis.module_graph && analysis.module_quality_report) {
      return NextResponse.json({
        analysis_id: analysis.id,
        project_id: projectId,
        module_graph: analysis.module_graph,
        module_quality_report: analysis.module_quality_report,
        analyzed_at: analysis.analyzed_at,
      });
    }

    const fallback = buildFallbackModuleGraphFromArchitecture(
      analysis.architecture,
      project.name
    );

    return NextResponse.json({
      analysis_id: analysis.id,
      project_id: projectId,
      module_graph: fallback.moduleGraph,
      module_quality_report: fallback.qualityReport,
      analyzed_at: analysis.analyzed_at,
    });
  } catch (error) {
    console.error('Module graph API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch architecture diagram data' },
      { status: 500 }
    );
  }
}
