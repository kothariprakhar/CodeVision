import { NextRequest, NextResponse } from 'next/server';
import { getAnalysisById } from '@/lib/repositories/analysis';
import { getProject } from '@/lib/repositories/projects';
import { getUserFromRequest } from '@/lib/auth';
import { generateBusinessLensArtifacts } from '@/lib/services/lenses';

function getNodeChildren(
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

    const generated = generateBusinessLensArtifacts({
      architecture: analysis.architecture,
      findings: analysis.findings,
      projectName: project.name,
    });

    const capabilityGraph = analysis.capability_graph || generated.capability_graph;
    const journeyGraph = analysis.journey_graph || generated.journey_graph;

    const node = capabilityGraph.nodes.find(item => item.id === nodeId);
    if (!node) {
      return NextResponse.json(
        { error: 'Node not found in capability graph' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const requestedDepth = Number(searchParams.get('depth') || '1');
    const depth = Number.isFinite(requestedDepth)
      ? Math.min(Math.max(requestedDepth, 1), 2)
      : 1;

    const childIds = getNodeChildren(nodeId, capabilityGraph.edges, depth);
    const children = childIds
      .map(childId => capabilityGraph.nodes.find(item => item.id === childId))
      .filter(item => item !== undefined);

    const linkedJourneys = journeyGraph.journeys
      .map(journey => {
        const stepIds = journey.steps
          .filter(step =>
            step.systems_touched.includes(node.name) ||
            step.evidence.some(ev => ev.ref === node.id || ev.ref.includes(node.name))
          )
          .map(step => step.id);

        if (stepIds.length === 0) return null;
        return {
          journey_id: journey.id,
          journey_name: journey.name,
          step_ids: stepIds,
        };
      })
      .filter(item => item !== null);

    const missingFields: string[] = [];
    if (!node.description) missingFields.push('description');
    if ((node.evidence || []).length === 0) missingFields.push('evidence');
    if ((node.business_value || '').length === 0) missingFields.push('business_value');

    return NextResponse.json({
      node,
      children,
      linked_journeys: linkedJourneys,
      quality: {
        confidence: node.confidence,
        evidence_count: (node.evidence || []).length,
        missing_fields: missingFields,
      },
    });
  } catch (error) {
    console.error('Node drill-down API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch node details' },
      { status: 500 }
    );
  }
}
