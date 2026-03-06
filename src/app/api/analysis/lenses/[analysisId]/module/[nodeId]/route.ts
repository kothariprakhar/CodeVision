import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';

function getModuleChildren(
  nodeId: string,
  edges: Array<{ from: string; to: string }>,
  maxDepth: number
): string[] {
  if (maxDepth <= 0) return [];
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
  const children: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= maxDepth) continue;
    const directChildren = edges
      .filter(edge => edge.from === current.id)
      .map(edge => edge.to);
    for (const childId of directChildren) {
      if (visited.has(childId)) continue;
      visited.add(childId);
      children.push(childId);
      queue.push({ id: childId, depth: current.depth + 1 });
    }
  }

  return children;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ analysisId: string; nodeId: string }> }
) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { analysisId, nodeId } = await params;
    const analysis = await getAnalysisById(analysisId);
    if (!analysis) {
      return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
    }

    const project = await getProject(analysis.project_id);
    if (!project || project.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const moduleGraph = analysis.module_graph;
    if (!moduleGraph) {
      return NextResponse.json(
        { error: 'Module graph is unavailable for this analysis version' },
        { status: 404 }
      );
    }

    const node = moduleGraph.nodes.find(item => item.id === nodeId);
    if (!node) {
      return NextResponse.json(
        { error: 'Module node not found' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedDepth = Number(searchParams.get('depth') || '1');
    const depth = Number.isFinite(requestedDepth)
      ? Math.min(Math.max(requestedDepth, 1), 2)
      : 1;

    const childIds = getModuleChildren(nodeId, moduleGraph.edges, depth);
    const children = childIds
      .map(childId => moduleGraph.nodes.find(item => item.id === childId))
      .filter(item => item !== undefined);

    const fileNodes = (analysis.module_graph_3d?.nodes || [])
      .filter(item => item.node_kind === 'file' && item.cluster_id === nodeId)
      .slice(0, 25)
      .map(item => ({
        id: item.id,
        label: item.label,
        path: item.path,
        loc: item.loc,
        hotness_score: item.hotness_score,
      }));

    const connectedEdges = moduleGraph.edges
      .filter(edge => edge.from === nodeId || edge.to === nodeId)
      .slice(0, 30);

    return NextResponse.json({
      node,
      children,
      connected_edges: connectedEdges,
      linked_files: fileNodes,
      quality: {
        evidence_count: node.evidence.length,
      },
    });
  } catch (error) {
    console.error('Module drill-down API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch module drill-down details' },
      { status: 500 }
    );
  }
}
