import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ModuleGraph, ModuleLayoutHints, ModuleQualityReport } from '../schemas/module-graph';
import { ModuleLayoutHintsSchema } from '../schemas/module-graph';

const client = new Anthropic();

const LLMNodeEnrichmentSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    module_type: z.enum([
      'module',
      'service',
      'api',
      'ui',
      'data',
      'infra',
      'library',
      'integration',
      'utility',
      'unknown',
    ]),
    layer: z.enum([
      'presentation',
      'application',
      'domain',
      'data',
      'infrastructure',
      'shared',
      'unknown',
    ]),
  })),
});

const LLMEdgeEnrichmentSchema = z.object({
  edges: z.array(z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    relation: z.enum(['imports', 'calls', 'reads', 'writes', 'publishes', 'depends_on']),
  })),
});

const LLMLayoutEnrichmentSchema = z.object({
  root_summary: z.string().min(1),
  layout_hints: ModuleLayoutHintsSchema,
});

function extractJsonCandidate(text: string): string {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}$/);
  return match ? match[0] : cleaned;
}

async function runAnthropicPassWithRepair<T>(
  schema: z.ZodSchema<T>,
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2200,
    temperature: 0,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const rawText = response.content.find(block => block.type === 'text');
  if (!rawText || rawText.type !== 'text') {
    throw new Error('No text block received from Anthropic pass.');
  }

  const firstTry = extractJsonCandidate(rawText.text);
  try {
    return schema.parse(JSON.parse(firstTry));
  } catch {
    const repairPrompt = `
You must return valid JSON only.
The following output failed schema validation:
${rawText.text}

Return corrected JSON that follows this schema:
${schema.toString()}
`;
    const repairResponse = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2200,
      temperature: 0,
      system: 'Return strict JSON only. No markdown, no prose.',
      messages: [{ role: 'user', content: repairPrompt }],
    });
    const repairText = repairResponse.content.find(block => block.type === 'text');
    if (!repairText || repairText.type !== 'text') {
      throw new Error('No repair text block received from Anthropic.');
    }
    const repairedJson = extractJsonCandidate(repairText.text);
    return schema.parse(JSON.parse(repairedJson));
  }
}

function summarizeGraphForPrompt(moduleGraph: ModuleGraph): string {
  const compactNodes = moduleGraph.nodes.slice(0, 14).map(node => ({
    id: node.id,
    label: node.label,
    module_type: node.module_type,
    layer: node.layer,
    paths: node.paths.slice(0, 3),
    importance_score: node.importance_score,
  }));
  const compactEdges = moduleGraph.edges.slice(0, 35).map(edge => ({
    from: edge.from,
    to: edge.to,
    relation: edge.relation,
  }));
  return JSON.stringify({
    repo_archetype: moduleGraph.repo_archetype,
    root_summary: moduleGraph.root_summary,
    nodes: compactNodes,
    edges: compactEdges,
  });
}

export async function enrichModuleGraphWithAnthropic(input: {
  moduleGraph: ModuleGraph;
  deterministicLayoutHints: ModuleLayoutHints;
  moduleQualityReport: ModuleQualityReport;
}): Promise<{
  moduleGraph: ModuleGraph;
  moduleLayoutHints: ModuleLayoutHints;
  llmNotes: string[];
}> {
  const apiKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
  if (!apiKeyPresent) {
    return {
      moduleGraph: input.moduleGraph,
      moduleLayoutHints: input.deterministicLayoutHints,
      llmNotes: ['Anthropic API key is missing; using deterministic architecture layout only.'],
    };
  }

  try {
    const graphSummary = summarizeGraphForPrompt(input.moduleGraph);

    const nodePass = await runAnthropicPassWithRepair(
      LLMNodeEnrichmentSchema,
      'You are a software architecture modeler. Keep IDs unchanged. Return strict JSON only.',
      `
Refine labels and classify node role/layer for readability for non-technical stakeholders.
Do not invent new node IDs.

Graph:
${graphSummary}

Return:
{
  "nodes": [{ "id": "...", "label": "...", "module_type": "...", "layer": "..." }]
}
`
    );

    const edgePass = await runAnthropicPassWithRepair(
      LLMEdgeEnrichmentSchema,
      'You are a software architecture modeler. Keep existing pairs only. Return strict JSON only.',
      `
Refine edge relationship semantics. Keep from/to IDs unchanged and only for existing edges.

Graph:
${graphSummary}

Return:
{
  "edges": [{ "from": "...", "to": "...", "relation": "..." }]
}
`
    );

    const layoutPass = await runAnthropicPassWithRepair(
      LLMLayoutEnrichmentSchema,
      'You are an architecture visualization planner inspired by high-quality architecture graph tools. Return strict JSON only.',
      `
Create structured layout hints for high-quality 2D and 3D architecture rendering.
Prioritize lane readability, clusters, hotspots, and focus paths.
Use existing IDs only.

Graph:
${graphSummary}

Current deterministic layout hints:
${JSON.stringify(input.deterministicLayoutHints)}

Return:
{
  "root_summary": "string",
  "layout_hints": {
    "lanes": [{ "id":"...", "label":"...", "node_ids":["..."] }],
    "clusters": [{ "id":"...", "label":"...", "node_ids":["..."] }],
    "hotspots": ["..."],
    "focus_paths": [{ "from":"...", "to":"...", "reason":"..." }],
    "render_profile": { "preferred_2d":"layered|radial|clustered", "preferred_3d_density":"compact|balanced|detailed" },
    "narrative": "string"
  }
}
`
    );

    const nodeById = new Map(nodePass.nodes.map(node => [node.id, node]));
    const existingEdgeKey = new Set(input.moduleGraph.edges.map(edge => `${edge.from}::${edge.to}`));
    const edgeByKey = new Map(edgePass.edges
      .filter(edge => existingEdgeKey.has(`${edge.from}::${edge.to}`))
      .map(edge => [`${edge.from}::${edge.to}`, edge]));

    const enrichedGraph: ModuleGraph = {
      ...input.moduleGraph,
      root_summary: layoutPass.root_summary,
      nodes: input.moduleGraph.nodes.map(node => {
        const enriched = nodeById.get(node.id);
        if (!enriched) return node;
        return {
          ...node,
          label: enriched.label,
          module_type: enriched.module_type,
          layer: enriched.layer,
        };
      }),
      edges: input.moduleGraph.edges.map(edge => {
        const enriched = edgeByKey.get(`${edge.from}::${edge.to}`);
        if (!enriched) return edge;
        return {
          ...edge,
          relation: enriched.relation,
        };
      }),
    };

    return {
      moduleGraph: enrichedGraph,
      moduleLayoutHints: layoutPass.layout_hints,
      llmNotes: ['Anthropic multi-pass enrichment applied (labels, relationships, layout hints).'],
    };
  } catch (error) {
    return {
      moduleGraph: input.moduleGraph,
      moduleLayoutHints: input.deterministicLayoutHints,
      llmNotes: [
        `Anthropic enrichment failed: ${error instanceof Error ? error.message : 'unknown error'}. Using deterministic diagram output.`,
      ],
    };
  }
}
