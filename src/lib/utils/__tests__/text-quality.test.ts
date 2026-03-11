import { describe, expect, it } from 'vitest';
import {
  dedupeAdjacentWords,
  normalizeDiagramText,
  sanitizeDiagramText,
  validateDiagramText,
} from '@/lib/utils/text-quality';

describe('text-quality', () => {
  it('dedupes repeated adjacent words', () => {
    expect(dedupeAdjacentWords('External external reliance: lucide-react')).toBe('External reliance: lucide-react');
  });

  it('normalizes spacing and punctuation', () => {
    expect(normalizeDiagramText(' Uses   lucide-react  ,  for icons ')).toBe('Uses lucide-react, for icons');
  });

  it('validates edge labels for action words', () => {
    expect(validateDiagramText('Uses Stripe', 'edge_label').valid).toBe(true);
    expect(validateDiagramText('Stripe integration', 'edge_label').valid).toBe(false);
  });

  it('falls back to safe labels for invalid content', () => {
    expect(sanitizeDiagramText('n/a', 'node_description', { target: 'Auth' }))
      .toBe('Core product capability related to Auth.');
  });
});
