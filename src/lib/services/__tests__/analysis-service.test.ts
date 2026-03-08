import { describe, expect, it } from 'vitest';
import { buildPromptContextForPass } from '@/lib/services/analysis-service';

describe('analysis-service prompt context', () => {
  it('reduces oversized context to fit budget boundaries', () => {
    const largeModules = Array.from({ length: 600 }).map((_, index) => ({
      module_name: `module-${index}`,
      summary: 'x'.repeat(400),
    }));

    const context = {
      modules: largeModules,
      dependencies: largeModules.map((_, index) => ({
        source: `m-${index}`,
        target: `m-${(index + 1) % largeModules.length}`,
      })),
      readme: 'y'.repeat(120000),
      requirements: 'z'.repeat(140000),
    };

    const prompt = 'Summarize architecture for business stakeholders.';
    const budgeted = buildPromptContextForPass(context, prompt);

    expect(budgeted).toBeDefined();
    expect(Object.keys(budgeted).length).toBeGreaterThan(0);
  });
});
