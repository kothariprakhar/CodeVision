import fs from 'fs';
import path from 'path';

export type FileCategory =
  | 'entry_point'
  | 'config'
  | 'route'
  | 'model'
  | 'service'
  | 'utility'
  | 'test';

export interface FileEntry {
  path: string;
  language: string;
  size_bytes: number;
  priority_score: number;
  category: FileCategory;
  imports: string[];
  exports: string[];
}

const INCLUDED_EXTENSIONS = new Set([
  '.py',
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.cjs',
  '.go',
  '.java',
  '.rb',
  '.rs',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.vue',
  '.svelte',
  '.php',
  '.swift',
  '.kt',
  '.kts',
  '.c',
  '.cpp',
  '.cc',
  '.h',
  '.hpp',
  '.cs',
  '.dart',
  '.lua',
  '.sh',
  '.bash',
  '.sql',
  '.graphql',
  '.gql',
  '.proto',
]);

export const INCLUDED_EXTENSIONS_LIST = Array.from(INCLUDED_EXTENSIONS.values()).sort();

const INCLUDED_SPECIAL_FILES = new Set([
  'dockerfile',
  'docker-compose.yml',
  '.env.example',
  'package.json',
  'readme.md',
  'architecture.md',
]);

const EXCLUDED_DIRS = new Set([
  // Version control & dependencies
  '.git',
  'node_modules',
  'vendor',
  // Build output
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  // Python caches
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  // Test infrastructure
  'e2e',
  'playwright',
  // Non-source directories (not business logic)
  'migrations',
  'scripts',
  'public',
  'static',
  'assets',
  'docs',
]);

const EXCLUDED_LOCK_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'poetry.lock',
  'pdm.lock',
  'cargo.lock',
  'go.sum',
]);

const EXCLUDED_BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp', '.tiff',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
  '.mp3', '.mp4', '.mov', '.wav',
  '.exe', '.dll', '.so', '.dylib', '.bin',
]);

function normalizeToPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function detectLanguage(filePath: string): string {
  const base = path.posix.basename(filePath).toLowerCase();
  const ext = path.posix.extname(filePath).toLowerCase();
  if (base === 'dockerfile') return 'docker';
  if (base === 'docker-compose.yml') return 'yaml';
  if (ext === '.py') return 'python';
  if (ext === '.ts' || ext === '.tsx') return 'typescript';
  if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') return 'javascript';
  if (ext === '.go') return 'go';
  if (ext === '.java') return 'java';
  if (ext === '.rb') return 'ruby';
  if (ext === '.rs') return 'rust';
  if (ext === '.html' || ext === '.htm') return 'html';
  if (ext === '.css') return 'css';
  if (ext === '.scss' || ext === '.sass') return 'scss';
  if (ext === '.less') return 'less';
  if (ext === '.vue') return 'vue';
  if (ext === '.svelte') return 'svelte';
  if (ext === '.php') return 'php';
  if (ext === '.swift') return 'swift';
  if (ext === '.kt' || ext === '.kts') return 'kotlin';
  if (ext === '.c' || ext === '.h') return 'c';
  if (ext === '.cpp' || ext === '.hpp' || ext === '.cc') return 'cpp';
  if (ext === '.cs') return 'csharp';
  if (ext === '.dart') return 'dart';
  if (ext === '.lua') return 'lua';
  if (ext === '.sh' || ext === '.bash') return 'shell';
  if (ext === '.sql') return 'sql';
  if (ext === '.graphql' || ext === '.gql') return 'graphql';
  if (ext === '.proto') return 'protobuf';
  if (ext === '.json') return 'json';
  if (ext === '.yml' || ext === '.yaml') return 'yaml';
  if (ext === '.md') return 'markdown';
  return 'unknown';
}

function extractImports(content: string, language: string): string[] {
  const found = new Set<string>();
  if (!content.trim()) return [];

  if (language === 'typescript' || language === 'javascript') {
    const regexes = [
      /import\s+[^'"]*['"]([^'"]+)['"]/g,
      /import\(\s*['"]([^'"]+)['"]\s*\)/g,
      /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    regexes.forEach(regex => {
      let match = regex.exec(content);
      while (match) {
        found.add(match[1]);
        match = regex.exec(content);
      }
    });
  } else if (language === 'python') {
    const fromRegex = /^\s*from\s+([.\w]+)\s+import\s+/gm;
    const importRegex = /^\s*import\s+([.\w]+)/gm;
    let match = fromRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = fromRegex.exec(content);
    }
    match = importRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = importRegex.exec(content);
    }
  } else if (language === 'go') {
    const blockRegex = /import\s*\(([\s\S]*?)\)/g;
    const singleRegex = /import\s+"([^"]+)"/g;
    let block = blockRegex.exec(content);
    while (block) {
      const paths = block[1].match(/"([^"]+)"/g) || [];
      paths.forEach(value => found.add(value.replace(/"/g, '')));
      block = blockRegex.exec(content);
    }
    let single = singleRegex.exec(content);
    while (single) {
      found.add(single[1]);
      single = singleRegex.exec(content);
    }
  } else if (language === 'java') {
    const importRegex = /^\s*import\s+([^;]+);/gm;
    let match = importRegex.exec(content);
    while (match) {
      found.add(match[1].trim());
      match = importRegex.exec(content);
    }
  } else if (language === 'ruby') {
    const requireRegex = /^\s*require(?:_relative)?\s+['"]([^'"]+)['"]/gm;
    let match = requireRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = requireRegex.exec(content);
    }
  } else if (language === 'rust') {
    const useRegex = /^\s*use\s+([^;]+);/gm;
    let match = useRegex.exec(content);
    while (match) {
      found.add(match[1].trim());
      match = useRegex.exec(content);
    }
  }

  return Array.from(found);
}

function extractExports(content: string, language: string): string[] {
  const found = new Set<string>();
  if (!content.trim()) return [];

  if (language === 'typescript' || language === 'javascript') {
    const namedExportRegex = /export\s+(?:const|let|var|function|class|interface|type)\s+([A-Za-z0-9_]+)/g;
    const defaultExportRegex = /export\s+default\s+([A-Za-z0-9_]+)/g;
    let match = namedExportRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = namedExportRegex.exec(content);
    }
    match = defaultExportRegex.exec(content);
    while (match) {
      found.add(`default:${match[1]}`);
      match = defaultExportRegex.exec(content);
    }
  } else if (language === 'python') {
    const classRegex = /^\s*class\s+([A-Za-z0-9_]+)/gm;
    const funcRegex = /^\s*def\s+([A-Za-z0-9_]+)/gm;
    let match = classRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = classRegex.exec(content);
    }
    match = funcRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = funcRegex.exec(content);
    }
  } else if (language === 'go') {
    const funcRegex = /^\s*func\s+([A-Z][A-Za-z0-9_]*)\s*\(/gm;
    let match = funcRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = funcRegex.exec(content);
    }
  } else if (language === 'java') {
    const classRegex = /^\s*(?:public\s+)?class\s+([A-Za-z0-9_]+)/gm;
    let match = classRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = classRegex.exec(content);
    }
  } else if (language === 'ruby') {
    const classRegex = /^\s*class\s+([A-Za-z0-9_:]+)/gm;
    let match = classRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = classRegex.exec(content);
    }
  } else if (language === 'rust') {
    const itemRegex = /^\s*pub\s+(?:fn|struct|enum|trait|mod)\s+([A-Za-z0-9_]+)/gm;
    let match = itemRegex.exec(content);
    while (match) {
      found.add(match[1]);
      match = itemRegex.exec(content);
    }
  }

  return Array.from(found);
}

function isEntryPoint(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.posix.basename(lower);
  if (['main.py', 'main.ts', 'main.js', 'index.ts', 'index.js', 'app.py', 'server.ts', 'server.js'].includes(base)) {
    return true;
  }
  return lower.startsWith('cmd/') || lower.endsWith('/main.go');
}

function isConfigFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  const base = path.posix.basename(lower);
  if (INCLUDED_SPECIAL_FILES.has(base)) return true;
  if (base.endsWith('.config.js') || base.endsWith('.config.ts')) return true;
  return /(^|\/)(config|settings|env|docker|kubernetes|helm|terraform)/.test(lower);
}

function isRouteDefinition(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return /(route|router|routes|urls|controller|api)/.test(lower);
}

function isSchemaDefinition(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return /(model|models|schema|migration|entity|prisma)/.test(lower);
}

function inferCategory(filePath: string): FileCategory {
  const lower = filePath.toLowerCase();
  if (/(__tests__|\/tests?\/|\.test\.|\.spec\.|fixtures|mock)/.test(lower)) return 'test';
  if (isEntryPoint(filePath)) return 'entry_point';
  if (isConfigFile(filePath)) return 'config';
  if (isRouteDefinition(filePath)) return 'route';
  if (isSchemaDefinition(filePath)) return 'model';
  if (/(service|usecase|handler|processor|worker|job)/.test(lower)) return 'service';
  return 'utility';
}

function shouldIncludeFile(relativePath: string): boolean {
  const lower = relativePath.toLowerCase();
  const base = path.posix.basename(lower);
  const ext = path.posix.extname(lower);

  if (EXCLUDED_LOCK_FILES.has(base)) return false;
  if (EXCLUDED_BINARY_EXTENSIONS.has(ext)) return false;
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.svg|\.woff2?|\.ttf|\.otf)$/.test(lower)) return false;
  if (/fixtures|mock-data|mock_data|testdata/.test(lower)) return false;
  if (EXCLUDED_DIRS.has(base)) return false;

  if (INCLUDED_SPECIAL_FILES.has(base)) return true;
  if (INCLUDED_EXTENSIONS.has(ext)) return true;

  return false;
}

function shouldSkipDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  // Skip all hidden/dotfile directories (e.g. .beads, .github, .claude, .venv)
  if (name.startsWith('.')) return true;
  return EXCLUDED_DIRS.has(lower);
}

function walkRepository(rootPath: string, currentRelativePath = ''): string[] {
  const absoluteCurrent = path.join(rootPath, currentRelativePath);
  const entries = fs.readdirSync(absoluteCurrent, { withFileTypes: true });
  const output: string[] = [];

  for (const entry of entries) {
    const relative = normalizeToPosix(path.posix.join(currentRelativePath, entry.name));
    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) continue;
      output.push(...walkRepository(rootPath, relative));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!shouldIncludeFile(relative)) continue;
    output.push(relative);
  }

  return output;
}

export function buildFileManifest(repoPath: string): FileEntry[] {
  const files = walkRepository(repoPath);
  const manifest: FileEntry[] = [];

  for (const relativePath of files) {
    const fullPath = path.join(repoPath, relativePath);
    const stat = fs.statSync(fullPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const language = detectLanguage(relativePath);

    manifest.push({
      path: relativePath,
      language,
      size_bytes: stat.size,
      priority_score: 0,
      category: inferCategory(relativePath),
      imports: extractImports(content, language),
      exports: extractExports(content, language),
    });
  }

  return manifest;
}

export function prioritizeFiles(manifest: FileEntry[]): FileEntry[] {
  if (manifest.length === 0) return [];

  const maxImports = Math.max(1, ...manifest.map(entry => entry.imports.length));
  const maxSize = Math.max(1, ...manifest.map(entry => entry.size_bytes));
  const maxRawScore = 18; // 5 + 4 + 3 + 3 + 2 + 1

  const scored = manifest.map(entry => {
    const isEntry = entry.category === 'entry_point' ? 1 : 0;
    const isConfig = entry.category === 'config' ? 1 : 0;
    const isRoute = entry.category === 'route' ? 1 : 0;
    const isSchema = entry.category === 'model' ? 1 : 0;
    const importCountNormalized = entry.imports.length / maxImports;
    const fileSizeNormalized = entry.size_bytes / maxSize;

    const rawScore =
      5 * isEntry +
      4 * isConfig +
      3 * isRoute +
      3 * isSchema +
      2 * importCountNormalized +
      1 * fileSizeNormalized;

    return {
      ...entry,
      priority_score: clamp(rawScore / maxRawScore, 0, 1),
    };
  });

  return scored.sort((a, b) => b.priority_score - a.priority_score);
}

export function groupByModule(manifest: FileEntry[]): Record<string, FileEntry[]> {
  const grouped: Record<string, FileEntry[]> = {};
  for (const entry of manifest) {
    const normalized = normalizeToPosix(entry.path);
    const segments = normalized.split('/').filter(Boolean);
    const moduleName = segments.length > 1
      ? (['src', 'app', 'packages', 'libs', 'services', 'cmd'].includes(segments[0])
        ? `${segments[0]}/${segments[1] || 'root'}`
        : segments[0])
      : '__root__';

    if (!grouped[moduleName]) grouped[moduleName] = [];
    grouped[moduleName].push(entry);
  }
  return grouped;
}

// Python-style aliases for direct spec mapping.
export const build_file_manifest = buildFileManifest;
export const prioritize_files = prioritizeFiles;
export const group_by_module = groupByModule;
