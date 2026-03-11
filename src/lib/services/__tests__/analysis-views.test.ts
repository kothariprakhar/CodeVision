import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '@/lib/db';
import { buildDiagramView } from '@/lib/services/analysis-views';

describe('analysis-views diagram copy quality', () => {
  it('normalizes duplicated node text and enforces meaningful edge labels', () => {
    const analysis = {
      id: 'analysis-1',
      project_id: 'project-1',
      summary: 'Test',
      findings: [],
      architecture: {
        nodes: [
          {
            id: 'web',
            name: 'Web UI',
            type: 'ui',
            complexity: 'medium',
            description: 'User interface',
            files: ['src/app/page.tsx'],
          },
          {
            id: 'external:lucide-react',
            name: 'lucide-react',
            type: 'external',
            complexity: 'low',
            description: 'External external reliance: lucide-react',
            files: [],
          },
        ],
        edges: [
          {
            from: 'web',
            to: 'external:lucide-react',
            type: 'imports',
            label: 'lucide-react integration',
          },
        ],
      },
      chat_history: [],
      raw_response: '{}',
      analyzed_at: new Date().toISOString(),
    } as unknown as AnalysisResult;

    const diagram = buildDiagramView(analysis);
    const externalNode = diagram.nodes.find(node => node.id === 'external:lucide-react');
    const edge = diagram.edges[0];

    expect(externalNode?.description.toLowerCase()).not.toContain('external external');
    expect(edge.label).toBe('Uses lucide-react');
  });
});
