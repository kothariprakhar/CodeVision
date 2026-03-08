import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '@/lib/db';
import { buildRiskSnapshot, buildTechStackSnapshot } from '@/lib/services/tech-risk-engine';

function makeAnalysis(rawResponse: Record<string, unknown>): AnalysisResult {
  return {
    id: 'analysis-1',
    project_id: 'project-1',
    summary: 'API service using React frontend, FastAPI backend, PostgreSQL, Redis, and Stripe.',
    findings: [
      {
        type: 'gap',
        severity: 'high',
        title: 'Missing automated testing strategy',
        description: 'No evidence of regression tests for billing journey.',
        evidence: ['tests folder missing'],
      },
    ],
    architecture: {
      nodes: [
        { id: 'web', name: 'Web App', type: 'ui', complexity: 'medium', description: 'React app', files: ['src/app.tsx'] },
        { id: 'api', name: 'API Service', type: 'api', complexity: 'high', description: 'FastAPI service', files: ['backend/main.py'] },
        { id: 'db', name: 'Postgres', type: 'database', complexity: 'medium', description: 'Database', files: ['docker-compose.yml'] },
      ],
      edges: [
        { from: 'web', to: 'api', type: 'calls' },
        { from: 'api', to: 'db', type: 'stores' },
      ],
    },
    capability_graph: null,
    journey_graph: null,
    quality_report: null,
    chat_history: [],
    raw_response: JSON.stringify(rawResponse),
    analyzed_at: new Date().toISOString(),
  };
}

describe('tech-risk-engine', () => {
  it('detects technologies and computes complexity', () => {
    const analysis = makeAnalysis({
      deterministic_signals: {
        file_manifest_paths: ['src/app.tsx', 'backend/main.py', 'docker-compose.yml', 'package.json'],
        file_manifest_languages: { typescript: 10, python: 8 },
        repo_metadata: { stars: 124, primary_language: 'TypeScript', contributors_count: 3 },
        dependency_graph_stats: { max_depth: 4 },
      },
      pass1: {
        module_summaries: {
          web: { key_technologies: ['React', 'Next.js'] },
          api: { key_technologies: ['FastAPI', 'SQLAlchemy', 'Redis', 'Stripe'] },
        },
      },
      pass3: {
        external_deps: ['Stripe', 'Redis'],
      },
    });

    const tech = buildTechStackSnapshot(analysis);

    expect(tech.frameworks.some(item => item.name === 'React')).toBe(true);
    expect(tech.frameworks.some(item => item.name === 'FastAPI')).toBe(true);
    expect(tech.external_services.some(item => item.name === 'Stripe')).toBe(true);
    expect(tech.complexity_score).toBeGreaterThanOrEqual(1);
    expect(tech.complexity_score).toBeLessThanOrEqual(10);
  });

  it('returns deterministic and ai risks with totals', () => {
    const analysis = makeAnalysis({
      deterministic_signals: {
        file_manifest_paths: ['src/app.tsx', 'backend/main.py'],
        file_manifest_categories: { utility: 20 },
        repo_metadata: { contributors_count: 1 },
      },
    });

    const risks = buildRiskSnapshot(analysis);

    expect(risks.risks.length).toBeGreaterThan(0);
    expect(risks.totals.high + risks.totals.medium + risks.totals.low + risks.totals.critical).toBe(risks.risks.length);
    expect(risks.estimated_remediation_days).toBeGreaterThan(0);
    expect(risks.estimated_remediation_cost_usd).toBeGreaterThan(0);
  });
});
