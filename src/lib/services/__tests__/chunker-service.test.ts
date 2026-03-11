import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildFileManifest, prioritizeFiles } from '@/lib/services/chunker-service';

const tempDirs: string[] = [];

function createTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'codevision-chunker-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const target = tempDirs.pop();
    if (target) fs.rmSync(target, { recursive: true, force: true });
  }
});

describe('chunker-service', () => {
  it('filters ignored files and scores important files higher', () => {
    const repo = createTempRepo();
    fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
    fs.mkdirSync(path.join(repo, 'node_modules/pkg'), { recursive: true });

    fs.writeFileSync(path.join(repo, 'src/main.ts'), 'import config from "./config"\nconsole.log(config)');
    fs.writeFileSync(path.join(repo, 'src/routes.ts'), 'export const router = {}');
    fs.writeFileSync(path.join(repo, 'src/model.ts'), 'export interface User { id: string }');
    fs.writeFileSync(path.join(repo, 'package-lock.json'), '{}');
    fs.writeFileSync(path.join(repo, 'node_modules/pkg/index.js'), 'module.exports = {}');

    const manifest = buildFileManifest(repo);
    const paths = manifest.map(item => item.path);

    expect(paths).toContain('src/main.ts');
    expect(paths).toContain('src/routes.ts');
    expect(paths).not.toContain('package-lock.json');
    expect(paths.some(filePath => filePath.includes('node_modules'))).toBe(false);

    const prioritized = prioritizeFiles(manifest);
    const main = prioritized.find(item => item.path === 'src/main.ts');
    const model = prioritized.find(item => item.path === 'src/model.ts');

    expect(main).toBeDefined();
    expect(model).toBeDefined();
    expect((main?.priority_score || 0)).toBeGreaterThanOrEqual(model?.priority_score || 0);
  });
});
