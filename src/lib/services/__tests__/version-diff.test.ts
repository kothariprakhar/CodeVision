import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '@/lib/db';
import { buildVersionDiff } from '@/lib/services/version-diff';

function makeAnalysis(partial: Partial<AnalysisResult>): AnalysisResult {
  return {
    id: partial.id || 'analysis-id',
    project_id: partial.project_id || 'project-id',
    summary: partial.summary || 'summary',
    findings: partial.findings || [],
    architecture: partial.architecture || { nodes: [], edges: [] },
    capability_graph: partial.capability_graph || null,
    journey_graph: partial.journey_graph || null,
    quality_report: partial.quality_report || null,
    founder_content: partial.founder_content || null,
    business_context: partial.business_context || null,
    chat_history: partial.chat_history || [],
    raw_response: partial.raw_response || '{}',
    analyzed_at: partial.analyzed_at || new Date().toISOString(),
    branch: partial.branch,
    commit_hash: partial.commit_hash,
    commit_url: partial.commit_url,
  };
}

describe('buildVersionDiff', () => {
  it('detects module and journey changes between versions', () => {
    const before = makeAnalysis({
      id: 'a1',
      architecture: {
        nodes: [
          {
            id: 'web',
            name: 'Web',
            type: 'ui',
            complexity: 'low',
            description: 'frontend',
            files: ['src/web.tsx'],
          },
          {
            id: 'api',
            name: 'API',
            type: 'api',
            complexity: 'medium',
            description: 'backend',
            files: ['src/api.ts'],
          },
        ],
        edges: [{ from: 'web', to: 'api', type: 'calls', label: 'request' }],
      },
      journey_graph: {
        summary: 'summary',
        journeys: [
          {
            id: 'j1',
            name: 'Signup',
            persona: 'User',
            goal: 'Register',
            kpi: 'activation',
            steps: [
              {
                id: 's1',
                journey_id: 'j1',
                order: 1,
                name: 'Open page',
                step_type: 'entry',
                description: '',
                business_outcome: '',
                friction_risk: 'low',
                systems_touched: ['web'],
                confidence: 0.8,
                evidence: [],
                risks: [],
              },
              {
                id: 's2',
                journey_id: 'j1',
                order: 2,
                name: 'Submit form',
                step_type: 'action',
                description: '',
                business_outcome: '',
                friction_risk: 'low',
                systems_touched: ['api'],
                confidence: 0.8,
                evidence: [],
                risks: [],
              },
            ],
          },
        ],
      },
      findings: [
        { type: 'gap', severity: 'medium', title: 'Missing retry', description: '', evidence: [] },
      ],
    });

    const after = makeAnalysis({
      id: 'a2',
      architecture: {
        nodes: [
          {
            id: 'web',
            name: 'Web',
            type: 'ui',
            complexity: 'medium',
            description: 'frontend changed',
            files: ['src/web.tsx', 'src/web-utils.ts'],
          },
          {
            id: 'api',
            name: 'API',
            type: 'api',
            complexity: 'medium',
            description: 'backend',
            files: ['src/api.ts'],
          },
          {
            id: 'worker',
            name: 'Worker',
            type: 'service',
            complexity: 'low',
            description: 'queue worker',
            files: ['src/worker.ts'],
          },
        ],
        edges: [
          { from: 'web', to: 'api', type: 'calls', label: 'request changed' },
          { from: 'api', to: 'worker', type: 'calls', label: 'enqueue' },
        ],
      },
      journey_graph: {
        summary: 'summary',
        journeys: [
          {
            id: 'j1',
            name: 'Signup',
            persona: 'User',
            goal: 'Register',
            kpi: 'activation',
            steps: [
              {
                id: 's1',
                journey_id: 'j1',
                order: 1,
                name: 'Open page',
                step_type: 'entry',
                description: '',
                business_outcome: '',
                friction_risk: 'low',
                systems_touched: ['web'],
                confidence: 0.8,
                evidence: [],
                risks: [],
              },
              {
                id: 's2',
                journey_id: 'j1',
                order: 2,
                name: 'Submit form',
                step_type: 'action',
                description: '',
                business_outcome: '',
                friction_risk: 'low',
                systems_touched: ['api'],
                confidence: 0.8,
                evidence: [],
                risks: [],
              },
              {
                id: 's3',
                journey_id: 'j1',
                order: 3,
                name: 'Async welcome',
                step_type: 'notification',
                description: '',
                business_outcome: '',
                friction_risk: 'low',
                systems_touched: ['worker'],
                confidence: 0.8,
                evidence: [],
                risks: [],
              },
            ],
          },
        ],
      },
      findings: [
        { type: 'gap', severity: 'high', title: 'Missing retry', description: '', evidence: [] },
      ],
    });

    const diff = buildVersionDiff(before, after);
    expect(diff.summary.modules_added).toBe(1);
    expect(diff.summary.modules_modified).toBeGreaterThan(0);
    expect(diff.summary.edges_added).toBe(1);
    expect(diff.summary.journeys_modified).toBeGreaterThan(0);
    expect(diff.summary.risks_increased).toBe(1);
    expect(diff.business_impact_notes.length).toBeGreaterThan(0);
  });
});

