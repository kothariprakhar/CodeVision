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

  it('leaves stakeholder-facing fields undefined when source graphs are absent', () => {
    // Use distinct ids so we bypass the 10-minute diff cache from the previous test.
    const before = makeAnalysis({ id: 'empty-a' });
    const after = makeAnalysis({ id: 'empty-b' });
    const diff = buildVersionDiff(before, after);
    expect(diff.capability_changes).toBeUndefined();
    expect(diff.value_feature_changes).toBeUndefined();
    expect(diff.journey_storyboards).toBeUndefined();
    // Existing contract intact.
    expect(diff.module_changes).toEqual([]);
    expect(diff.business_impact_notes.length).toBeGreaterThan(0);
  });
});

describe('buildVersionDiff — capability diffs', () => {
  it('detects added, removed, and modified capabilities and resolves parent domain', () => {
    const before = makeAnalysis({
      id: 'cap-a1',
      capability_graph: {
        top_level_summary: 'before',
        nodes: [
          {
            id: 'dom-auth',
            name: 'Authentication',
            node_type: 'capability_domain',
            depth: 0,
            description: 'Auth domain',
            business_value: 'Identify users',
            maturity: 'stable',
            confidence: 1,
            evidence: [],
            risks: [],
            kpis: [],
          },
          {
            id: 'cap-login',
            name: 'Login',
            node_type: 'capability',
            depth: 1,
            description: 'User sign-in',
            business_value: 'Enable return users',
            maturity: 'developing',
            owner_role: 'Platform',
            confidence: 1,
            evidence: [],
            risks: [],
            kpis: ['login_success_rate'],
          },
          {
            id: 'cap-sms',
            name: 'SMS OTP',
            node_type: 'capability',
            depth: 1,
            description: 'Code over SMS',
            business_value: 'Verify phone',
            maturity: 'developing',
            confidence: 1,
            evidence: [],
            risks: [],
            kpis: [],
          },
        ],
        edges: [
          { from: 'dom-auth', to: 'cap-login', relation: 'contains', confidence: 1, evidence: [] },
          { from: 'dom-auth', to: 'cap-sms', relation: 'contains', confidence: 1, evidence: [] },
        ],
      },
    });

    const after = makeAnalysis({
      id: 'cap-a2',
      capability_graph: {
        top_level_summary: 'after',
        nodes: [
          {
            id: 'dom-auth',
            name: 'Authentication',
            node_type: 'capability_domain',
            depth: 0,
            description: 'Auth domain',
            business_value: 'Identify users',
            maturity: 'stable',
            confidence: 1,
            evidence: [],
            risks: [],
            kpis: [],
          },
          {
            // Modified: maturity advanced, owner changed, KPI set grew.
            id: 'cap-login',
            name: 'Login',
            node_type: 'capability',
            depth: 1,
            description: 'User sign-in',
            business_value: 'Enable return users',
            maturity: 'stable',
            owner_role: 'Identity',
            confidence: 1,
            evidence: [],
            risks: [],
            kpis: ['login_success_rate', 'time_to_login'],
          },
          {
            // Added.
            id: 'cap-social',
            name: 'Social Login',
            node_type: 'capability',
            depth: 1,
            description: 'OAuth via Google',
            business_value: 'Reduce signup friction',
            maturity: 'nascent',
            confidence: 1,
            evidence: [],
            risks: [],
            kpis: [],
          },
        ],
        edges: [
          { from: 'dom-auth', to: 'cap-login', relation: 'contains', confidence: 1, evidence: [] },
          { from: 'dom-auth', to: 'cap-social', relation: 'contains', confidence: 1, evidence: [] },
        ],
      },
    });

    const diff = buildVersionDiff(before, after);
    expect(diff.capability_changes).toBeDefined();
    const changes = diff.capability_changes!;

    const login = changes.find(c => c.id === 'cap-login')!;
    expect(login.status).toBe('modified');
    expect(login.reasons).toEqual(expect.arrayContaining([
      expect.stringMatching(/Maturity developing → stable/),
      'Owner role changed',
      'KPI set changed',
    ]));
    expect(login.domain_name).toBe('Authentication');
    expect(login.before?.maturity).toBe('developing');
    expect(login.after?.maturity).toBe('stable');

    const social = changes.find(c => c.id === 'cap-social')!;
    expect(social.status).toBe('added');
    expect(social.domain_name).toBe('Authentication');
    expect(social.after?.maturity).toBe('nascent');

    const sms = changes.find(c => c.id === 'cap-sms')!;
    expect(sms.status).toBe('removed');
    expect(sms.domain_name).toBe('Authentication');
    expect(sms.before?.description).toBe('Code over SMS');

    // Auth domain itself unchanged → not sorted first, but should be present as unchanged.
    const dom = changes.find(c => c.id === 'dom-auth')!;
    expect(dom.status).toBe('unchanged');
  });
});

describe('buildVersionDiff — value-feature diffs', () => {
  it('detects added/removed/modified value features with module-level deltas', () => {
    const before = makeAnalysis({
      id: 'vf-a1',
      business_context: {
        problem_statement: 'p',
        architecture_domains: [],
        value_features: [
          {
            name: 'Checkout',
            description: 'Pay for cart',
            business_impact: 'Direct revenue',
            modules_involved: ['cart', 'payment'],
          },
          {
            name: 'Email OTP',
            description: 'Verify via email',
            business_impact: 'Account security',
            modules_involved: ['auth', 'mailer'],
          },
        ],
        data_usage: [],
        external_deps: [],
        founder_narrative: {
          executive_summary: '',
          how_it_works: '',
          components: [],
          scale_assessment: '',
          technology_choices: [],
        },
        technical_narrative: {
          executive_summary: '',
          how_it_works: '',
          components: [],
          scale_assessment: '',
          technology_choices: [],
        },
      },
    });

    const after = makeAnalysis({
      id: 'vf-a2',
      business_context: {
        problem_statement: 'p',
        architecture_domains: [],
        value_features: [
          {
            name: 'Checkout',
            description: 'Pay for cart with saved card',
            business_impact: 'Direct revenue',
            modules_involved: ['cart', 'payment', 'saved_cards'],
          },
          {
            name: 'Social Login',
            description: 'OAuth sign-in',
            business_impact: 'Lower signup friction',
            modules_involved: ['auth', 'oauth'],
          },
        ],
        data_usage: [],
        external_deps: [],
        founder_narrative: {
          executive_summary: '',
          how_it_works: '',
          components: [],
          scale_assessment: '',
          technology_choices: [],
        },
        technical_narrative: {
          executive_summary: '',
          how_it_works: '',
          components: [],
          scale_assessment: '',
          technology_choices: [],
        },
      },
    });

    const diff = buildVersionDiff(before, after);
    expect(diff.value_feature_changes).toBeDefined();
    const changes = diff.value_feature_changes!;

    const checkout = changes.find(c => c.name === 'Checkout')!;
    expect(checkout.status).toBe('modified');
    expect(checkout.modules_added).toEqual(['saved_cards']);
    expect(checkout.modules_removed).toEqual([]);
    expect(checkout.description_before).toBe('Pay for cart');
    expect(checkout.description_after).toBe('Pay for cart with saved card');

    const social = changes.find(c => c.name === 'Social Login')!;
    expect(social.status).toBe('added');
    expect(social.modules_added).toEqual(['auth', 'oauth']);

    const email = changes.find(c => c.name === 'Email OTP')!;
    expect(email.status).toBe('removed');
    expect(email.modules_removed).toEqual(['auth', 'mailer']);
  });
});

describe('buildVersionDiff — journey storyboards', () => {
  function step(
    id: string,
    order: number,
    name: string,
    opts: {
      description?: string;
      friction_risk?: 'low' | 'medium' | 'high' | 'critical';
      systems_touched?: string[];
    } = {}
  ) {
    return {
      id,
      journey_id: 'j1',
      order,
      name,
      step_type: 'action' as const,
      description: opts.description ?? '',
      business_outcome: '',
      friction_risk: opts.friction_risk ?? ('low' as const),
      systems_touched: opts.systems_touched ?? [],
      confidence: 1,
      evidence: [],
      risks: [],
    };
  }

  it('classifies step-level added, removed, modified, and reordered changes', () => {
    const before = makeAnalysis({
      id: 'story-a1',
      journey_graph: {
        summary: '',
        journeys: [
          {
            id: 'j1',
            name: 'Signup',
            persona: 'User',
            goal: 'Register',
            kpi: 'activation',
            steps: [
              step('s1', 1, 'Open page'),
              step('s2', 2, 'Enter email', { friction_risk: 'low' }),
              step('s3', 3, 'Verify SMS', { systems_touched: ['sms'] }),
              step('s4', 4, 'Done'),
            ],
          },
        ],
      },
    });

    const after = makeAnalysis({
      id: 'story-a2',
      journey_graph: {
        summary: '',
        journeys: [
          {
            id: 'j1',
            name: 'Signup',
            persona: 'User',
            goal: 'Register',
            kpi: 'activation',
            steps: [
              // s1 unchanged but reordered to position 2
              step('s1', 2, 'Open page'),
              // New OAuth step inserted at position 1
              step('s5', 1, 'Google sign-in', { systems_touched: ['oauth'] }),
              // s2 modified: friction raised, description changed
              step('s2', 3, 'Enter email', {
                description: 'Enter work email',
                friction_risk: 'medium',
              }),
              // s3 removed entirely (no more SMS)
              // s4 unchanged at bottom
              step('s4', 4, 'Done'),
            ],
          },
        ],
      },
    });

    const diff = buildVersionDiff(before, after);
    expect(diff.journey_storyboards).toBeDefined();
    const [board] = diff.journey_storyboards!;
    expect(board.journey_name).toBe('Signup');
    expect(board.status).toBe('modified');
    expect(board.before_step_count).toBe(4);
    expect(board.after_step_count).toBe(4);

    const byName: Record<string, (typeof board.step_changes)[number]> = {};
    for (const change of board.step_changes) byName[change.name] = change;

    expect(byName['Google sign-in'].change).toBe('added');
    expect(byName['Google sign-in'].systems_added).toEqual(['oauth']);

    expect(byName['Verify SMS'].change).toBe('removed');
    expect(byName['Verify SMS'].systems_removed).toEqual(['sms']);

    expect(byName['Open page'].change).toBe('reordered');

    expect(byName['Enter email'].change).toBe('modified');
    expect(byName['Enter email'].friction_before).toBe('low');
    expect(byName['Enter email'].friction_after).toBe('medium');
    expect(byName['Enter email'].after_description).toBe('Enter work email');

    // "Done" is truly unchanged and should be omitted from step_changes.
    expect(byName['Done']).toBeUndefined();

    expect(board.headline).toContain('Signup');
    expect(board.headline).toMatch(/added/);
    expect(board.headline).toMatch(/removed/);
    expect(board.headline).toMatch(/modified/);
    expect(board.headline).toMatch(/reordered/);
  });

  it('emits whole-journey added/removed storyboards', () => {
    const before = makeAnalysis({
      id: 'story-b1',
      journey_graph: {
        summary: '',
        journeys: [
          {
            id: 'old',
            name: 'Legacy flow',
            persona: 'User',
            goal: 'x',
            kpi: 'y',
            steps: [step('o1', 1, 'Start'), step('o2', 2, 'End')],
          },
        ],
      },
    });
    const after = makeAnalysis({
      id: 'story-b2',
      journey_graph: {
        summary: '',
        journeys: [
          {
            id: 'new',
            name: 'New flow',
            persona: 'User',
            goal: 'x',
            kpi: 'y',
            steps: [step('n1', 1, 'Start'), step('n2', 2, 'Middle'), step('n3', 3, 'End')],
          },
        ],
      },
    });

    const diff = buildVersionDiff(before, after);
    const boards = diff.journey_storyboards!;
    const newBoard = boards.find(b => b.journey_name === 'New flow')!;
    expect(newBoard.status).toBe('added');
    expect(newBoard.step_changes.every(c => c.change === 'added')).toBe(true);
    expect(newBoard.headline).toMatch(/New journey/);

    const oldBoard = boards.find(b => b.journey_name === 'Legacy flow')!;
    expect(oldBoard.status).toBe('removed');
    expect(oldBoard.step_changes.every(c => c.change === 'removed')).toBe(true);
    expect(oldBoard.headline).toMatch(/removed/);
  });
});

