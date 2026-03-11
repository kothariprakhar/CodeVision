export type DiagramTextType = 'node_label' | 'node_description' | 'edge_label' | 'tooltip';

const PLACEHOLDER_PATTERN = /^(unknown|n\/?a|none|tbd|todo|\.{3}|-)$/i;
const EDGE_ACTION_VERB_PATTERN = /\b(uses?|depends on|reads?|writes?|triggers?|renders?|sends?|stores?|calls?|contains?|connects?)\b/i;

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

export function dedupeAdjacentWords(text: string): string {
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return text.trim();

  const deduped: string[] = [];
  let previousNormalized = '';

  for (const token of tokens) {
    const normalized = normalizeToken(token);
    if (normalized && normalized === previousNormalized) continue;
    deduped.push(token);
    previousNormalized = normalized || previousNormalized;
  }

  return deduped.join(' ');
}

export function normalizeDiagramText(text: string): string {
  if (!text) return '';
  const compact = text.replace(/\s+/g, ' ').trim();
  const deduped = dedupeAdjacentWords(compact);
  return deduped.replace(/\s+([,.:;!?])/g, '$1').trim();
}

export function validateDiagramText(text: string, type: DiagramTextType): { valid: boolean; reason?: string } {
  const normalized = normalizeDiagramText(text);

  if (!normalized) return { valid: false, reason: 'empty' };
  if (PLACEHOLDER_PATTERN.test(normalized)) return { valid: false, reason: 'placeholder' };
  if (!/[a-z]/i.test(normalized)) return { valid: false, reason: 'non_alpha' };

  if (type === 'edge_label' && !EDGE_ACTION_VERB_PATTERN.test(normalized)) {
    return { valid: false, reason: 'missing_action_verb' };
  }

  if (type === 'node_description' && normalized.length < 12) {
    return { valid: false, reason: 'too_short' };
  }

  return { valid: true };
}

export function rewriteFallbackLabel(
  type: DiagramTextType,
  context?: { relation?: string; source?: string; target?: string }
): string {
  if (type === 'edge_label') {
    if (context?.target) return `Uses ${context.target}`;
    if (context?.relation) return `Connects through ${context.relation}`;
    return 'Connects related components';
  }

  if (type === 'node_description') {
    if (context?.target) return `Core product capability related to ${context.target}.`;
    return 'Core product capability that supports user-facing outcomes.';
  }

  if (type === 'node_label') {
    if (context?.target) return context.target;
    return 'System component';
  }

  return 'Additional context is available for this component.';
}

export function sanitizeDiagramText(
  text: string,
  type: DiagramTextType,
  context?: { relation?: string; source?: string; target?: string }
): string {
  const normalized = normalizeDiagramText(text);
  if (validateDiagramText(normalized, type).valid) {
    return normalized;
  }

  const fallback = normalizeDiagramText(rewriteFallbackLabel(type, context));
  if (validateDiagramText(fallback, type).valid) {
    return fallback;
  }

  return fallback || rewriteFallbackLabel(type, context);
}
