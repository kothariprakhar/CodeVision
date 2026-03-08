import { describe, expect, it } from 'vitest';
import type { ParsedFile } from '@/lib/services/parser-service';
import { detectPatterns, extractDependencyGraph } from '@/lib/services/parser-service';

const parsedFiles: ParsedFile[] = [
  {
    path: 'src/main.ts',
    language: 'typescript',
    classes: [],
    functions: [{ name: 'boot', parameters: [], decorators: [] }],
    imports: [{ target: './routes', imported_symbols: ['router'] }],
    exports: ['boot'],
    constants: [],
  },
  {
    path: 'src/routes.ts',
    language: 'typescript',
    classes: [],
    functions: [{ name: 'createRoute', parameters: [], decorators: [] }],
    imports: [{ target: './model', imported_symbols: ['User'] }],
    exports: ['createRoute'],
    constants: [],
  },
  {
    path: 'src/model.ts',
    language: 'typescript',
    classes: [{ name: 'User', methods: [], inheritance: [] }],
    functions: [],
    imports: [],
    exports: ['User'],
    constants: [],
  },
];

describe('parser-service', () => {
  it('builds dependency graph edges from parsed imports', () => {
    const graph = extractDependencyGraph(parsedFiles);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(graph.edges.some(edge => edge.source === 'src/main.ts' && edge.target.includes('routes'))).toBe(true);
    expect(graph.edges.some(edge => edge.source === 'src/routes.ts' && edge.target.includes('model'))).toBe(true);
  });

  it('detects architectural patterns from parsed files', () => {
    const patterns = detectPatterns(parsedFiles);
    expect(patterns.some(pattern => pattern.pattern === 'rest_api' || pattern.pattern === 'mvc')).toBe(true);
  });
});
