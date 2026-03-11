import { describe, expect, it } from 'vitest';
import { simplifyForFounder } from '@/lib/utils/founder-language';

describe('simplifyForFounder', () => {
  it('avoids duplicate wording for external dependencies', () => {
    const output = simplifyForFounder('External dependency: lucide-react', true);

    expect(output).toContain('third-party integration');
    expect(output.toLowerCase()).not.toContain('external external');
  });

  it('returns input unchanged when founder mode is disabled', () => {
    const input = 'External dependency: lucide-react';
    expect(simplifyForFounder(input, false)).toBe(input);
  });
});
