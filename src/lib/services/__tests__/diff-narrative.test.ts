import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  __clearNarrativeCacheForTests,
  buildDeterministicNarrative,
  generateDiffNarrative,
  type DiffNarrative,
} from '@/lib/services/diff-narrative';
import type { VersionDiffResult } from '@/lib/services/version-diff';

// Build a VersionDiffResult skeleton with sensible defaults so individual tests
// only need to override the fields they care about.
function makeDiff(partial: Partial<VersionDiffResult> = {}): VersionDiffResult {
  return {
    from: { analysis_id: partial.from?.analysis_id || 'from-id', analyzed_at: new Date().toISOString() },
    to: { analysis_id: partial.to?.analysis_id || 'to-id', analyzed_at: new Date().toISOString() },
    summary: {
      modules_added: 0,
      modules_removed: 0,
      modules_modified: 0,
      edges_added: 0,
      edges_removed: 0,
      edges_modified: 0,
      journeys_added: 0,
      journeys_removed: 0,
      journeys_modified: 0,
      risks_increased: 0,
      risks_decreased: 0,
      tech_added: 0,
      tech_removed: 0,
      ...(partial.summary || {}),
    },
    module_changes: partial.module_changes || [],
    edge_changes: partial.edge_changes || [],
    journey_changes: partial.journey_changes || [],
    risk_changes: partial.risk_changes || [],
    tech_changes: partial.tech_changes || [],
    file_changes: partial.file_changes || [],
    breaking_change_risks: partial.breaking_change_risks || [],
    dependency_cascades: partial.dependency_cascades || [],
    business_impact_notes: partial.business_impact_notes || ['No major changes.'],
    capability_changes: partial.capability_changes,
    value_feature_changes: partial.value_feature_changes,
    journey_storyboards: partial.journey_storyboards,
    generated_at: new Date().toISOString(),
  };
}

function narrativeShapeIsValid(n: DiffNarrative): void {
  expect(n.verdict).toBeDefined();
  expect(['ship', 'caution', 'block']).toContain(n.verdict.level);
  expect(typeof n.verdict.one_liner).toBe('string');
  expect(typeof n.verdict.rationale).toBe('string');
  expect(Array.isArray(n.customer_visible_changes)).toBe(true);
  expect(Array.isArray(n.internal_changes)).toBe(true);
  expect(Array.isArray(n.risk_bearing_changes)).toBe(true);
  expect(typeof n.release_notes_markdown).toBe('string');
  expect(n.release_notes_markdown.length).toBeGreaterThan(0);
  expect(['ai', 'fallback']).toContain(n.generated_by);
}

describe('buildDeterministicNarrative — verdict rules', () => {
  it('returns "ship" for an empty diff with the expected copy', () => {
    const narrative = buildDeterministicNarrative(makeDiff());
    narrativeShapeIsValid(narrative);
    expect(narrative.verdict.level).toBe('ship');
    expect(narrative.verdict.one_liner).toMatch(/low-risk/i);
    expect(narrative.generated_by).toBe('fallback');
  });

  it('returns "block" when any critical breaking-change risk is present', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({
        breaking_change_risks: [
          {
            module_id: 'auth',
            module_name: 'Auth Service',
            risk_level: 'critical',
            reason: 'Removed module had 4 dependents',
            affected_dependents: ['billing', 'profile', 'web', 'mobile'],
          },
        ],
      })
    );
    expect(narrative.verdict.level).toBe('block');
    expect(narrative.verdict.one_liner).toMatch(/block/i);
    expect(narrative.risk_bearing_changes.length).toBeGreaterThan(0);
    expect(narrative.risk_bearing_changes[0]).toContain('Auth Service');
  });

  it('returns "caution" for high-level risks without critical ones', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({
        breaking_change_risks: [
          {
            module_id: 'payment',
            module_name: 'Payment',
            risk_level: 'high',
            reason: 'High-connectivity module changed complexity',
            affected_dependents: ['cart', 'orders', 'subscriptions'],
          },
        ],
      })
    );
    expect(narrative.verdict.level).toBe('caution');
    expect(narrative.verdict.one_liner).toMatch(/caution/i);
  });

  it('returns "caution" when modules were removed even without breaking-change risks', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({ summary: { modules_removed: 2 } as VersionDiffResult['summary'] })
    );
    expect(narrative.verdict.level).toBe('caution');
    expect(narrative.verdict.one_liner).toMatch(/removed/i);
  });

  it('returns "caution" when risk severities increased', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({ summary: { risks_increased: 2 } as VersionDiffResult['summary'] })
    );
    expect(narrative.verdict.level).toBe('caution');
  });
});

describe('buildDeterministicNarrative — content composition', () => {
  it('surfaces value-feature changes as customer-visible bullets', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({
        value_feature_changes: [
          {
            name: 'Social Login',
            status: 'added',
            description_after: 'OAuth sign-in',
            business_impact_after: 'Lower signup friction',
            modules_added: ['auth', 'oauth'],
            modules_removed: [],
          },
          {
            name: 'SMS OTP',
            status: 'removed',
            description_before: 'Code over SMS',
            business_impact_before: 'Verify phone',
            modules_added: [],
            modules_removed: ['auth', 'sms'],
          },
          {
            name: 'Checkout',
            status: 'modified',
            modules_added: ['saved_cards'],
            modules_removed: [],
          },
        ],
      })
    );

    const bullets = narrative.customer_visible_changes;
    expect(bullets.some(b => b.startsWith('New: Social Login'))).toBe(true);
    expect(bullets.some(b => b.includes('Lower signup friction'))).toBe(true);
    expect(bullets.some(b => b.startsWith('Removed: SMS OTP'))).toBe(true);
    expect(bullets.some(b => b.startsWith('Updated: Checkout') && b.includes('modules'))).toBe(true);
  });

  it('surfaces journey storyboard headlines as customer-visible bullets', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({
        journey_storyboards: [
          {
            journey_id: 'signup',
            journey_name: 'Signup',
            persona: 'User',
            before_step_count: 4,
            after_step_count: 4,
            step_changes: [],
            headline: '"Signup" — 1 step added, 1 removed.',
            status: 'modified',
          },
        ],
      })
    );
    expect(narrative.customer_visible_changes.some(b => b.includes('Signup'))).toBe(true);
  });

  it('places breaking-change risks in risk_bearing_changes with level prefix', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({
        breaking_change_risks: [
          {
            module_id: 'pay',
            module_name: 'Payments',
            risk_level: 'high',
            reason: 'type changed',
            affected_dependents: ['cart'],
          },
        ],
      })
    );
    expect(narrative.risk_bearing_changes.some(b => b.startsWith('[high]'))).toBe(true);
    expect(narrative.risk_bearing_changes.some(b => b.includes('Payments'))).toBe(true);
    expect(narrative.risk_bearing_changes.some(b => b.includes('1 dependent'))).toBe(true);
  });

  it('generates non-empty release notes even for an empty diff', () => {
    const narrative = buildDeterministicNarrative(makeDiff());
    expect(narrative.release_notes_markdown).toContain('## Release Notes');
    expect(narrative.release_notes_markdown).toMatch(/No notable changes/);
  });

  it('produces sectioned release notes when all three buckets have content', () => {
    const narrative = buildDeterministicNarrative(
      makeDiff({
        value_feature_changes: [
          {
            name: 'Feature A',
            status: 'added',
            modules_added: ['a'],
            modules_removed: [],
          },
        ],
        module_changes: [
          {
            id: 'svc',
            name: 'Svc',
            status: 'modified',
            reasons: ['File footprint changed'],
            before: { type: 'service', complexity: 'low', description: 'before', business_role: undefined as unknown as string, files: [] } as unknown as ReturnType<typeof makeDiff>['module_changes'][number]['before'],
            after: { type: 'service', complexity: 'low', description: 'after', business_role: undefined as unknown as string, files: [] } as unknown as ReturnType<typeof makeDiff>['module_changes'][number]['after'],
            degree_before: 1,
            degree_after: 1,
          },
        ],
        breaking_change_risks: [
          {
            module_id: 'svc',
            module_name: 'Svc',
            risk_level: 'medium',
            reason: 'modified',
            affected_dependents: ['x'],
          },
        ],
      })
    );
    expect(narrative.release_notes_markdown).toContain("### What's new");
    expect(narrative.release_notes_markdown).toContain('### Under the hood');
    expect(narrative.release_notes_markdown).toContain('### Things to watch');
  });
});

describe('generateDiffNarrative — env + cache behavior', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    __clearNarrativeCacheForTests();
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
    __clearNarrativeCacheForTests();
  });

  it('returns deterministic narrative when no API key is configured', async () => {
    const diff = makeDiff({ from: { analysis_id: 'nk-a', analyzed_at: '' }, to: { analysis_id: 'nk-b', analyzed_at: '' } });
    const narrative = await generateDiffNarrative(diff);
    narrativeShapeIsValid(narrative);
    expect(narrative.generated_by).toBe('fallback');
  });

  it('serves the same object from cache on a repeat call for the same pair', async () => {
    const diff = makeDiff({ from: { analysis_id: 'cache-a', analyzed_at: '' }, to: { analysis_id: 'cache-b', analyzed_at: '' } });
    const first = await generateDiffNarrative(diff);
    const second = await generateDiffNarrative(diff);
    expect(second).toBe(first); // reference equality — served from cache
  });

  it('produces a distinct narrative for a different pair', async () => {
    const diffA = makeDiff({ from: { analysis_id: 'x1', analyzed_at: '' }, to: { analysis_id: 'x2', analyzed_at: '' } });
    const diffB = makeDiff({
      from: { analysis_id: 'y1', analyzed_at: '' },
      to: { analysis_id: 'y2', analyzed_at: '' },
      breaking_change_risks: [
        {
          module_id: 'auth',
          module_name: 'Auth',
          risk_level: 'critical',
          reason: 'Removed with 2 dependents',
          affected_dependents: ['billing', 'profile'],
        },
      ],
    });
    const nA = await generateDiffNarrative(diffA);
    const nB = await generateDiffNarrative(diffB);
    expect(nA.verdict.level).toBe('ship');
    expect(nB.verdict.level).toBe('block');
  });
});
