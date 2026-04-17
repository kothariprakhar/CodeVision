// ABOUTME: Generates a stakeholder-facing narrative and ship-readiness verdict from a VersionDiffResult.
// ABOUTME: Uses one Claude call per unique diff pair with 10-minute caching; falls back to a deterministic
// ABOUTME: rule-based narrative when the LLM key is absent or the call fails. Never throws to the caller.

import Anthropic from '@anthropic-ai/sdk';
import type { VersionDiffResult } from './version-diff';

export type ShipVerdictLevel = 'ship' | 'caution' | 'block';

export interface ShipVerdict {
  level: ShipVerdictLevel;
  one_liner: string;
  rationale: string;
}

export interface DiffNarrative {
  verdict: ShipVerdict;
  customer_visible_changes: string[];
  internal_changes: string[];
  risk_bearing_changes: string[];
  release_notes_markdown: string;
  generated_by: 'ai' | 'fallback';
  generated_at: string;
}

interface CacheRecord {
  value: DiffNarrative;
  expires_at: number;
}

const NARRATIVE_CACHE_TTL_MS = 10 * 60 * 1000;
const narrativeCache = new Map<string, CacheRecord>();

function cacheKey(diff: VersionDiffResult): string {
  return `${diff.from.analysis_id}:${diff.to.analysis_id}`;
}

function getCached(key: string): DiffNarrative | null {
  const record = narrativeCache.get(key);
  if (!record) return null;
  if (Date.now() > record.expires_at) {
    narrativeCache.delete(key);
    return null;
  }
  return record.value;
}

function setCached(key: string, value: DiffNarrative): void {
  narrativeCache.set(key, {
    value,
    expires_at: Date.now() + NARRATIVE_CACHE_TTL_MS,
  });
}

/**
 * Deterministic narrative built purely from the structured diff.
 * Serves two purposes:
 *   1. Fallback when ANTHROPIC_API_KEY is missing or the LLM call fails.
 *   2. Seed values for any fields the LLM omits or malforms.
 * Must never throw — callers depend on this to guarantee a response.
 */
export function buildDeterministicNarrative(diff: VersionDiffResult): DiffNarrative {
  const criticalBreaks = diff.breaking_change_risks.filter(r => r.risk_level === 'critical');
  const highBreaks = diff.breaking_change_risks.filter(r => r.risk_level === 'high');
  const mediumBreaks = diff.breaking_change_risks.filter(r => r.risk_level === 'medium');
  const riskDelta = diff.summary.risks_increased - diff.summary.risks_decreased;
  const journeysChanged =
    diff.summary.journeys_added + diff.summary.journeys_modified + diff.summary.journeys_removed;

  // Verdict — rule-based, explicit thresholds so tests can pin behavior.
  let level: ShipVerdictLevel = 'ship';
  if (criticalBreaks.length > 0) {
    level = 'block';
  } else if (
    highBreaks.length > 0 ||
    diff.summary.modules_removed > 0 ||
    riskDelta > 0
  ) {
    level = 'caution';
  } else if (mediumBreaks.length > 0 || journeysChanged > 0) {
    // Not automatically a caution, but the verdict copy should acknowledge movement.
    level = 'ship';
  }

  const oneLinerByLevel: Record<ShipVerdictLevel, string> = {
    block: `Blocking: ${criticalBreaks.length} critical breaking change(s) detected.`,
    caution:
      highBreaks.length > 0
        ? `Caution: ${highBreaks.length} high-risk change(s) — review dependents before merge.`
        : diff.summary.modules_removed > 0
          ? `Caution: ${diff.summary.modules_removed} module(s) removed — verify no callers remain.`
          : 'Caution: risk profile increased against the base version.',
    ship:
      journeysChanged > 0 || diff.summary.modules_added > 0
        ? 'Low-risk release with user-visible movement.'
        : 'Low-risk release; no breaking changes detected.',
  };

  const rationaleParts: string[] = [];
  if (diff.summary.modules_added) rationaleParts.push(`${diff.summary.modules_added} new module(s)`);
  if (diff.summary.modules_modified)
    rationaleParts.push(`${diff.summary.modules_modified} module(s) modified`);
  if (diff.summary.modules_removed)
    rationaleParts.push(`${diff.summary.modules_removed} module(s) removed`);
  if (journeysChanged) rationaleParts.push(`${journeysChanged} journey change(s)`);
  if (riskDelta > 0) rationaleParts.push(`${riskDelta} risk severity increase(s)`);
  else if (riskDelta < 0) rationaleParts.push(`${Math.abs(riskDelta)} risk severity improvement(s)`);
  const rationale = rationaleParts.length
    ? rationaleParts.join(', ') + '.'
    : 'No significant architecture or journey changes detected between the two versions.';

  // Customer-visible — value features + journey storyboards are the user-facing axes.
  const customerVisible: string[] = [];
  for (const vf of diff.value_feature_changes || []) {
    if (vf.status === 'added') {
      const impact = vf.business_impact_after ? ` — ${vf.business_impact_after}` : '';
      customerVisible.push(`New: ${vf.name}${impact}`);
    } else if (vf.status === 'removed') {
      customerVisible.push(`Removed: ${vf.name}`);
    } else if (vf.status === 'modified') {
      const moduleShift =
        vf.modules_added.length || vf.modules_removed.length
          ? ` (${vf.modules_added.length ? `+${vf.modules_added.length}` : ''}${
              vf.modules_removed.length ? ` -${vf.modules_removed.length}` : ''
            } modules)`
          : '';
      customerVisible.push(`Updated: ${vf.name}${moduleShift}`);
    }
  }
  for (const sb of diff.journey_storyboards || []) {
    customerVisible.push(sb.headline);
  }

  // Internal — modified non-UI modules and file-level shifts, capped to keep the list readable.
  const internalChanges: string[] = [];
  for (const m of diff.module_changes) {
    if (m.status === 'modified' && m.after?.type !== 'ui' && m.reasons.length > 0) {
      internalChanges.push(`${m.name}: ${m.reasons.join(', ')}`);
    }
  }

  // Risk-bearing — breaking-change risks plus risk-finding escalations.
  const riskBearing: string[] = [];
  for (const r of diff.breaking_change_risks) {
    const depLabel = r.affected_dependents.length
      ? ` (${r.affected_dependents.length} dependent${r.affected_dependents.length === 1 ? '' : 's'})`
      : '';
    riskBearing.push(`[${r.risk_level}] ${r.module_name}${depLabel} — ${r.reason}`);
  }
  for (const rc of diff.risk_changes) {
    if (rc.status === 'modified' && rc.severity_before && rc.severity_after) {
      riskBearing.push(`${rc.title}: severity ${rc.severity_before} → ${rc.severity_after}`);
    } else if (rc.status === 'added') {
      riskBearing.push(`[new] ${rc.title}${rc.severity_after ? ` (${rc.severity_after})` : ''}`);
    }
  }

  // Release notes — assemble a simple markdown block.
  const notesParts: string[] = ['## Release Notes'];
  if (customerVisible.length) {
    notesParts.push('', '### What\'s new');
    for (const line of customerVisible.slice(0, 12)) notesParts.push(`- ${line}`);
  }
  if (internalChanges.length) {
    notesParts.push('', '### Under the hood');
    for (const line of internalChanges.slice(0, 10)) notesParts.push(`- ${line}`);
  }
  if (riskBearing.length) {
    notesParts.push('', '### Things to watch');
    for (const line of riskBearing.slice(0, 10)) notesParts.push(`- ${line}`);
  }
  if (customerVisible.length === 0 && internalChanges.length === 0 && riskBearing.length === 0) {
    notesParts.push('', 'No notable changes between these versions.');
  }

  return {
    verdict: {
      level,
      one_liner: oneLinerByLevel[level],
      rationale,
    },
    customer_visible_changes: customerVisible,
    internal_changes: internalChanges,
    risk_bearing_changes: riskBearing,
    release_notes_markdown: notesParts.join('\n'),
    generated_by: 'fallback',
    generated_at: new Date().toISOString(),
  };
}

/**
 * Compacts the diff into a prompt-friendly JSON payload so we don't blow the
 * context budget on large analyses. Keeps only the fields the narrative needs.
 */
function buildPromptPayload(diff: VersionDiffResult): string {
  const compact = {
    summary: diff.summary,
    breaking_change_risks: diff.breaking_change_risks.slice(0, 15),
    capability_changes: (diff.capability_changes || [])
      .filter(c => c.status !== 'unchanged')
      .slice(0, 20)
      .map(c => ({
        name: c.name,
        status: c.status,
        domain: c.domain_name,
        reasons: c.reasons,
        business_value_before: c.before?.business_value,
        business_value_after: c.after?.business_value,
        maturity_before: c.before?.maturity,
        maturity_after: c.after?.maturity,
      })),
    value_feature_changes: (diff.value_feature_changes || []).slice(0, 20),
    journey_storyboards: (diff.journey_storyboards || []).slice(0, 10).map(sb => ({
      name: sb.journey_name,
      persona: sb.persona,
      status: sb.status,
      headline: sb.headline,
      step_changes: sb.step_changes.slice(0, 12),
    })),
    risk_changes: diff.risk_changes
      .filter(r => r.status !== 'unchanged')
      .slice(0, 20),
    module_changes: diff.module_changes
      .filter(m => m.status !== 'unchanged')
      .slice(0, 25)
      .map(m => ({
        name: m.name,
        status: m.status,
        type: m.after?.type || m.before?.type,
        reasons: m.reasons,
        degree_before: m.degree_before,
        degree_after: m.degree_after,
      })),
    tech_changes: diff.tech_changes.filter(t => t.status !== 'unchanged').slice(0, 20),
    business_impact_notes: diff.business_impact_notes,
  };
  return JSON.stringify(compact);
}

const SYSTEM_PROMPT = `You are a release-readiness analyst synthesizing a structured software diff for three audiences: founders, product managers, and engineers.

You will receive a JSON summary of what changed between two versions of a codebase (architecture, capabilities, journeys, risks, breaking-change signals).

Produce a single JSON object with this exact shape:

{
  "verdict": {
    "level": "ship" | "caution" | "block",
    "one_liner": "one short sentence for a top-of-page banner",
    "rationale": "2-3 sentences explaining the verdict in stakeholder language"
  },
  "customer_visible_changes": ["bullet describing a change a user would notice"],
  "internal_changes": ["bullet describing a change a user would NOT notice"],
  "risk_bearing_changes": ["bullet describing something that might break or degrade experience"],
  "release_notes_markdown": "markdown-formatted release notes ready to copy into a changelog"
}

Verdict rules:
- "block" if any critical-level breaking change risks, or if removed modules have active dependents.
- "caution" if any high-level risks, meaningful journey regressions, or risk severity increases.
- "ship" otherwise, including when changes are purely additive or cosmetic.

Writing rules:
- Speak in plain business language. No code identifiers, no filenames.
- customer_visible_changes: what the user would notice in the product.
- internal_changes: refactors, infra, tests, cleanup — user-invisible.
- risk_bearing_changes: specifically what could break or degrade.
- release_notes_markdown: customer-facing voice, no engineer jargon. Use "### What's new" / "### Improvements" / "### Fixes" / "### Things to watch" sections as appropriate. Empty sections can be omitted.
- Return ONLY the JSON object, no surrounding prose or code fences.`;

function extractJson(text: string): unknown {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in narrative response');
  return JSON.parse(match[0]);
}

function pickString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function pickStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const filtered = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return filtered.length ? filtered : fallback;
}

function pickVerdictLevel(value: unknown, fallback: ShipVerdictLevel): ShipVerdictLevel {
  if (value === 'ship' || value === 'caution' || value === 'block') return value;
  return fallback;
}

function mergeWithFallback(raw: unknown, fallback: DiffNarrative): DiffNarrative {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const verdictRaw = (obj.verdict && typeof obj.verdict === 'object' ? obj.verdict : {}) as Record<string, unknown>;
  return {
    verdict: {
      level: pickVerdictLevel(verdictRaw.level, fallback.verdict.level),
      one_liner: pickString(verdictRaw.one_liner, fallback.verdict.one_liner),
      rationale: pickString(verdictRaw.rationale, fallback.verdict.rationale),
    },
    customer_visible_changes: pickStringArray(
      obj.customer_visible_changes,
      fallback.customer_visible_changes
    ),
    internal_changes: pickStringArray(obj.internal_changes, fallback.internal_changes),
    risk_bearing_changes: pickStringArray(obj.risk_bearing_changes, fallback.risk_bearing_changes),
    release_notes_markdown: pickString(obj.release_notes_markdown, fallback.release_notes_markdown),
    generated_by: 'ai',
    generated_at: new Date().toISOString(),
  };
}

/**
 * Public entry point. Always resolves — never throws. Callers get either an
 * AI-generated narrative or a deterministic one depending on env and runtime
 * health.
 */
export async function generateDiffNarrative(diff: VersionDiffResult): Promise<DiffNarrative> {
  const key = cacheKey(diff);
  const cached = getCached(key);
  if (cached) return cached;

  const fallback = buildDeterministicNarrative(diff);

  if (!process.env.ANTHROPIC_API_KEY) {
    setCached(key, fallback);
    return fallback;
  }

  try {
    const client = new Anthropic();
    const payload = buildPromptPayload(diff);
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1800,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: payload }],
    });

    const textBlock = response.content.find(block => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Claude response contained no text block');
    }

    const parsed = extractJson(textBlock.text);
    const narrative = mergeWithFallback(parsed, fallback);
    setCached(key, narrative);
    return narrative;
  } catch (err) {
    console.error('diff-narrative: LLM call failed, using deterministic fallback:', err);
    setCached(key, fallback);
    return fallback;
  }
}

/**
 * Exposed for tests and tooling that need to clear the module-level cache.
 * Not part of the documented runtime surface.
 */
export function __clearNarrativeCacheForTests(): void {
  narrativeCache.clear();
}
