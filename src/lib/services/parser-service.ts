import fs from 'fs';
import path from 'path';

type Language =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'go'
  | 'java'
  | 'ruby'
  | 'rust'
  | 'unknown';

interface ImportRef {
  target: string;
  imported_symbols: string[];
}

export interface ParsedClass {
  name: string;
  methods: string[];
  inheritance: string[];
}

export interface ParsedFunction {
  name: string;
  parameters: string[];
  return_type?: string;
  decorators: string[];
}

export interface ParsedConstant {
  name: string;
  value_preview: string;
}

export interface ParsedFile {
  path: string;
  language: Language;
  classes: ParsedClass[];
  functions: ParsedFunction[];
  imports: ImportRef[];
  exports: string[];
  constants: ParsedConstant[];
}

export interface ModuleNode {
  id: string;
  name: string;
  category: string;
  symbols: string[];
}

export interface DependencyEdge {
  source: string;
  target: string;
  imported_symbols: string[];
}

export interface DependencyGraph {
  nodes: ModuleNode[];
  edges: DependencyEdge[];
}

export interface ArchPattern {
  id: string;
  pattern: 'mvc' | 'mvvm' | 'clean_architecture' | 'rest_api' | 'orm' | 'event_driven' | 'background_worker';
  description: string;
  evidence: string[];
}

interface TreeSitterNode {
  type: string;
  startIndex: number;
  endIndex: number;
  namedChildren?: TreeSitterNode[];
}

interface TreeSitterTree {
  rootNode: TreeSitterNode;
}

interface TreeSitterParser {
  setLanguage(language: unknown): void;
  parse(source: string): TreeSitterTree;
}

type TreeSitterParserConstructor = new () => TreeSitterParser;

let treeSitterInitialized = false;
let treeSitterAvailable = false;
let parserCtor: TreeSitterParserConstructor | null = null;
const languageRegistry = new Map<string, unknown>();

function runtimeRequire(moduleName: string): unknown {
  const req = Function('return require')() as (name: string) => unknown;
  return req(moduleName);
}

function normalizeToPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function readFileIfNeeded(filePath: string, content?: string): string {
  if (typeof content === 'string') return content;
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function inferCategoryFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (/(__tests__|\/tests?\/|\.test\.|\.spec\.)/.test(lower)) return 'test';
  if (/(route|router|controller|api)/.test(lower)) return 'route';
  if (/(model|schema|entity|migration|prisma)/.test(lower)) return 'model';
  if (/(service|usecase|handler|worker|job)/.test(lower)) return 'service';
  if (/(config|settings|docker|env)/.test(lower)) return 'config';
  if (/(view|component|page|ui|template)/.test(lower)) return 'view';
  return 'utility';
}

function moduleDisplayName(filePath: string): string {
  const withoutExt = filePath.replace(/\.[^.]+$/, '');
  return withoutExt
    .split('/')
    .filter(Boolean)
    .map(part => part.replace(/[-_]/g, ' '))
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function parseImportText(line: string): ImportRef | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let match = trimmed.match(/^import\s+(.+)\s+from\s+['"]([^'"]+)['"]/);
  if (match) {
    const symbolsRaw = match[1]
      .replace(/[{}]/g, '')
      .split(',')
      .map(s => s.trim());
    return { target: match[2], imported_symbols: unique(symbolsRaw) };
  }

  match = trimmed.match(/^import\s+['"]([^'"]+)['"]/);
  if (match) {
    return { target: match[1], imported_symbols: [] };
  }

  match = trimmed.match(/^from\s+([.\w]+)\s+import\s+(.+)$/);
  if (match) {
    const symbols = match[2].split(',').map(s => s.trim());
    return { target: match[1], imported_symbols: unique(symbols) };
  }

  match = trimmed.match(/^import\s+([.\w]+)$/);
  if (match) {
    return { target: match[1], imported_symbols: [] };
  }

  match = trimmed.match(/^require(?:_relative)?\s+['"]([^'"]+)['"]/);
  if (match) {
    return { target: match[1], imported_symbols: [] };
  }

  match = trimmed.match(/^use\s+([^;]+);$/);
  if (match) {
    return { target: match[1], imported_symbols: [] };
  }

  return null;
}

async function initializeTreeSitter(): Promise<void> {
  if (treeSitterInitialized) return;
  treeSitterInitialized = true;

  try {
    parserCtor = runtimeRequire('tree-sitter') as TreeSitterParserConstructor;
    const python = runtimeRequire('tree-sitter-python');
    const javascript = runtimeRequire('tree-sitter-javascript');
    const typescript = runtimeRequire('tree-sitter-typescript') as {
      typescript?: unknown;
      tsx?: unknown;
    };
    const go = runtimeRequire('tree-sitter-go');
    const java = runtimeRequire('tree-sitter-java');

    languageRegistry.set('python', python);
    languageRegistry.set('javascript', javascript);
    languageRegistry.set('typescript', typescript.typescript || typescript);
    languageRegistry.set('tsx', typescript.tsx || typescript.typescript || typescript);
    languageRegistry.set('go', go);
    languageRegistry.set('java', java);
    treeSitterAvailable = true;
  } catch {
    treeSitterAvailable = false;
  }
}

function walkAst(node: TreeSitterNode, visit: (node: TreeSitterNode) => void): void {
  visit(node);
  const namedChildren = node?.namedChildren || [];
  for (const child of namedChildren) {
    walkAst(child, visit);
  }
}

function parseWithAst(
  filePath: string,
  language: Language,
  source: string
): ParsedFile {
  const ext = path.posix.extname(filePath).toLowerCase();
  const langKey = language === 'typescript' && ext === '.tsx' ? 'tsx' : language;
  const parserLanguage = languageRegistry.get(langKey);
  if (!parserCtor || !parserLanguage) {
    throw new Error('Language grammar unavailable');
  }

  const parser = new parserCtor();
  parser.setLanguage(parserLanguage);
  const tree = parser.parse(source);

  const classes: ParsedClass[] = [];
  const functions: ParsedFunction[] = [];
  const imports: ImportRef[] = [];
  const exports: string[] = [];
  const constants: ParsedConstant[] = [];

  walkAst(tree.rootNode, (node) => {
    const type = node.type;
    const text = source.slice(node.startIndex, node.endIndex);

    if (type === 'import_statement' || type === 'import_from_statement' || type === 'import_declaration') {
      const parsedImport = parseImportText(text.replace(/\n/g, ' ').trim());
      if (parsedImport) imports.push(parsedImport);
    }

    if (type === 'class_definition' || type === 'class_declaration') {
      const classNameMatch = text.match(/class\s+([A-Za-z_][A-Za-z0-9_]*)/);
      const className = classNameMatch?.[1];
      if (!className) return;

      const inheritance = unique((text.match(/extends\s+([A-Za-z0-9_$.]+)/g) || [])
        .map(match => match.replace('extends', '').trim())
        .concat((text.match(/\(([A-Za-z0-9_,\s.]+)\)\s*:/) || [])
          .flatMap(match => match.replace(/[():]/g, '').split(',').map(v => v.trim()))));

      const methods = unique((text.match(/\b(?:def|function)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g) || [])
        .map(match => match.replace(/\b(?:def|function)\s+/, '').replace(/\s*\($/, '').trim())
        .concat((text.match(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\([^)]*\)\s*\{/g) || [])
          .map(match => match.split('(')[0].trim())));

      classes.push({
        name: className,
        methods,
        inheritance,
      });
    }

    if (type === 'function_definition' || type === 'function_declaration' || type === 'method_declaration') {
      const nameMatch = text.match(/(?:def|function|func)\s+([A-Za-z_][A-Za-z0-9_]*)/);
      const paramsMatch = text.match(/\(([^)]*)\)/);
      const returnTypeMatch = text.match(/->\s*([A-Za-z0-9_.[\]]+)/);
      const decorators = unique((text.match(/@[A-Za-z_][A-Za-z0-9_.]*/g) || []).map(d => d.replace('@', '')));
      if (!nameMatch) return;
      functions.push({
        name: nameMatch[1],
        parameters: paramsMatch?.[1]
          ? paramsMatch[1].split(',').map(p => p.trim()).filter(Boolean)
          : [],
        return_type: returnTypeMatch?.[1],
        decorators,
      });
    }

    if (type === 'export_statement' || type === 'export_clause') {
      const named = text.match(/export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface)?\s*([A-Za-z_][A-Za-z0-9_]*)/);
      if (named?.[1]) exports.push(named[1]);
    }

    if (type === 'assignment' || type === 'lexical_declaration' || type === 'variable_declaration' || type === 'field_declaration') {
      const constantMatch = text.match(/^([A-Z_][A-Z0-9_]*)\s*[:=]/m);
      if (!constantMatch) return;
      constants.push({
        name: constantMatch[1],
        value_preview: text.slice(0, 120).replace(/\s+/g, ' '),
      });
    }
  });

  return {
    path: normalizeToPosix(filePath),
    language,
    classes,
    functions,
    imports: unique(imports.map(item => JSON.stringify(item))).map(item => JSON.parse(item) as ImportRef),
    exports: unique(exports),
    constants,
  };
}

function parseWithFallback(filePath: string, language: Language, source: string): ParsedFile {
  const lines = source.split('\n');
  const imports: ImportRef[] = [];
  const exports: string[] = [];
  const classes: ParsedClass[] = [];
  const functions: ParsedFunction[] = [];
  const constants: ParsedConstant[] = [];

  for (const line of lines) {
    const parsedImport = parseImportText(line);
    if (parsedImport) imports.push(parsedImport);

    const classMatch = line.match(/^\s*class\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (classMatch) {
      classes.push({
        name: classMatch[1],
        methods: [],
        inheritance: [],
      });
    }

    const fnMatch = line.match(/^\s*(?:def|function|func)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)/);
    if (fnMatch) {
      functions.push({
        name: fnMatch[1],
        parameters: fnMatch[2]
          ? fnMatch[2].split(',').map(value => value.trim()).filter(Boolean)
          : [],
        decorators: [],
      });
    }

    const exportMatch = line.match(/^\s*export\s+(?:default\s+)?(?:class|function|const|let|var|type|interface)?\s*([A-Za-z_][A-Za-z0-9_]*)/);
    if (exportMatch?.[1]) {
      exports.push(exportMatch[1]);
    }

    const constantMatch = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*[:=]/);
    if (constantMatch) {
      constants.push({
        name: constantMatch[1],
        value_preview: line.trim().slice(0, 120),
      });
    }
  }

  return {
    path: normalizeToPosix(filePath),
    language,
    classes,
    functions,
    imports,
    exports: unique(exports),
    constants,
  };
}

function resolveImportTarget(sourcePath: string, target: string, knownPaths: Set<string>): string {
  const normalizedSource = normalizeToPosix(sourcePath);
  const normalizedTarget = target.trim();
  if (!normalizedTarget) return `external:unknown`;

  if (normalizedTarget.startsWith('.')) {
    const sourceDir = path.posix.dirname(normalizedSource);
    const base = path.posix.normalize(path.posix.join(sourceDir, normalizedTarget));
    const candidates = [
      base,
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.py`,
      `${base}.go`,
      `${base}.java`,
      `${base}.rb`,
      `${base}.rs`,
      path.posix.join(base, 'index.ts'),
      path.posix.join(base, 'index.js'),
      path.posix.join(base, '__init__.py'),
    ];
    for (const candidate of candidates) {
      if (knownPaths.has(candidate)) return candidate;
    }
    return base;
  }

  const dottedAsPath = normalizedTarget.replace(/\./g, '/');
  const candidates = [
    `${dottedAsPath}.py`,
    `${dottedAsPath}.ts`,
    `${dottedAsPath}.js`,
    path.posix.join(dottedAsPath, '__init__.py'),
    path.posix.join(dottedAsPath, 'index.ts'),
    path.posix.join(dottedAsPath, 'index.js'),
  ];
  for (const candidate of candidates) {
    if (knownPaths.has(candidate)) return candidate;
  }

  return `external:${normalizedTarget}`;
}

export async function parseFile(
  filePath: string,
  language: string,
  sourceText?: string
): Promise<ParsedFile> {
  const normalizedPath = normalizeToPosix(filePath);
  const source = readFileIfNeeded(normalizedPath, sourceText);
  const normalizedLanguage = (language || 'unknown') as Language;

  await initializeTreeSitter();
  if (treeSitterAvailable && ['python', 'javascript', 'typescript', 'go', 'java'].includes(normalizedLanguage)) {
    try {
      return parseWithAst(normalizedPath, normalizedLanguage, source);
    } catch {
      return parseWithFallback(normalizedPath, normalizedLanguage, source);
    }
  }

  return parseWithFallback(normalizedPath, normalizedLanguage, source);
}

export function extractDependencyGraph(parsedFiles: ParsedFile[]): DependencyGraph {
  const knownPaths = new Set(parsedFiles.map(file => normalizeToPosix(file.path)));
  const nodeMap = new Map<string, ModuleNode>();
  const edgeMap = new Map<string, DependencyEdge>();

  for (const file of parsedFiles) {
    const fileId = normalizeToPosix(file.path);
    if (!nodeMap.has(fileId)) {
      const symbols = unique([
        ...file.exports,
        ...file.classes.map(c => c.name),
        ...file.functions.map(f => f.name),
      ]);
      nodeMap.set(fileId, {
        id: fileId,
        name: moduleDisplayName(fileId),
        category: inferCategoryFromPath(fileId),
        symbols,
      });
    }

    for (const ref of file.imports) {
      const resolvedTarget = resolveImportTarget(fileId, ref.target, knownPaths);
      if (!nodeMap.has(resolvedTarget)) {
        nodeMap.set(resolvedTarget, {
          id: resolvedTarget,
          name: moduleDisplayName(resolvedTarget.replace(/^external:/, 'external/')),
          category: resolvedTarget.startsWith('external:') ? 'external' : inferCategoryFromPath(resolvedTarget),
          symbols: [],
        });
      }

      const edgeKey = `${fileId}->${resolvedTarget}`;
      const existing = edgeMap.get(edgeKey);
      if (!existing) {
        edgeMap.set(edgeKey, {
          source: fileId,
          target: resolvedTarget,
          imported_symbols: unique(ref.imported_symbols),
        });
      } else {
        existing.imported_symbols = unique(existing.imported_symbols.concat(ref.imported_symbols));
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };
}

export function detectPatterns(parsedFiles: ParsedFile[]): ArchPattern[] {
  const patterns: ArchPattern[] = [];
  const filePaths = parsedFiles.map(file => file.path.toLowerCase());
  const joinedImports = parsedFiles.flatMap(file => file.imports.map(item => item.target.toLowerCase()));

  const has = (matcher: RegExp): boolean => filePaths.some(filePath => matcher.test(filePath));
  const importHas = (matcher: RegExp): boolean => joinedImports.some(target => matcher.test(target));

  const mvcSignals = [
    has(/controller|controllers|routes?|api/),
    has(/model|models|schema|entity/),
    has(/view|views|template|component|ui|page/),
  ].filter(Boolean);
  if (mvcSignals.length >= 3) {
    patterns.push({
      id: 'pattern-mvc',
      pattern: 'mvc',
      description: 'Repository structure suggests an MVC-style separation of routes/controllers, models, and views.',
      evidence: filePaths.filter(p => /(controller|model|view|route|template|component)/.test(p)).slice(0, 8),
    });
  }

  const mvvmSignals = [
    has(/viewmodel|view-model|vm/),
    has(/view|component|page|screen/),
    has(/model|state|store/),
  ].filter(Boolean);
  if (mvvmSignals.length >= 3) {
    patterns.push({
      id: 'pattern-mvvm',
      pattern: 'mvvm',
      description: 'View, ViewModel, and Model/state conventions suggest MVVM architecture.',
      evidence: filePaths.filter(p => /(viewmodel|view-model|model|store|screen|component)/.test(p)).slice(0, 8),
    });
  }

  const cleanSignals = [
    has(/domain/),
    has(/application|usecase|use-case/),
    has(/infrastructure|infra/),
    has(/presentation|interface|adapter/),
  ].filter(Boolean);
  if (cleanSignals.length >= 3) {
    patterns.push({
      id: 'pattern-clean-architecture',
      pattern: 'clean_architecture',
      description: 'Layered folder conventions indicate Clean Architecture style boundaries.',
      evidence: filePaths.filter(p => /(domain|application|usecase|infrastructure|presentation|adapter)/.test(p)).slice(0, 8),
    });
  }

  const restApiDetected =
    has(/routes?|controller|api/) ||
    importHas(/express|fastapi|flask|django|nestjs|hono|koa/);
  if (restApiDetected) {
    patterns.push({
      id: 'pattern-rest-api',
      pattern: 'rest_api',
      description: 'Detected web-framework and route/controller signals consistent with REST API patterns.',
      evidence: filePaths.filter(p => /(routes?|controller|api)/.test(p)).slice(0, 8),
    });
  }

  const ormDetected =
    importHas(/sqlalchemy|prisma|django\.db\.models|typeorm|sequelize|mongoose|peewee|activerecord/) ||
    has(/schema|model|entity|migration|prisma/);
  if (ormDetected) {
    patterns.push({
      id: 'pattern-orm',
      pattern: 'orm',
      description: 'Model/schema and ORM dependency signals indicate ORM-based persistence.',
      evidence: unique(
        joinedImports.filter(v => /sqlalchemy|prisma|django\.db\.models|typeorm|sequelize|mongoose|activerecord/.test(v))
      ).slice(0, 6),
    });
  }

  const eventDrivenDetected =
    importHas(/kafka|rabbitmq|pubsub|sns|sqs|nats|eventemitter|webhook/) ||
    has(/webhook|events?|pubsub|queue|kafka/);
  if (eventDrivenDetected) {
    patterns.push({
      id: 'pattern-event-driven',
      pattern: 'event_driven',
      description: 'Messaging/webhook/pub-sub signals suggest event-driven architecture components.',
      evidence: unique(
        joinedImports.filter(v => /kafka|rabbitmq|pubsub|sns|sqs|nats|eventemitter|webhook/.test(v))
      ).slice(0, 6),
    });
  }

  const workerDetected =
    importHas(/celery|bull|bullmq|sidekiq|rq|agenda|resque|hangfire/) ||
    has(/worker|job|queue|cron|scheduler|celery|sidekiq/);
  if (workerDetected) {
    patterns.push({
      id: 'pattern-background-worker',
      pattern: 'background_worker',
      description: 'Queue/worker/cron signals indicate asynchronous background processing.',
      evidence: filePaths.filter(p => /(worker|job|queue|cron|scheduler|celery|sidekiq)/.test(p)).slice(0, 8),
    });
  }

  return patterns;
}

export function buildStructuralAnalysisContext(
  parsedFiles: ParsedFile[],
  dependencyGraph: DependencyGraph,
  patterns: ArchPattern[]
): string {
  const nodeDegree = new Map<string, number>();
  dependencyGraph.edges.forEach(edge => {
    nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1);
    nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1);
  });

  const topModules = dependencyGraph.nodes
    .slice()
    .sort((a, b) => (nodeDegree.get(b.id) || 0) - (nodeDegree.get(a.id) || 0))
    .slice(0, 15)
    .map(node => ({
      id: node.id,
      category: node.category,
      degree: nodeDegree.get(node.id) || 0,
      symbols: node.symbols.slice(0, 8),
    }));

  return JSON.stringify({
    parsed_files: parsedFiles.length,
    dependency_graph: {
      nodes: dependencyGraph.nodes.length,
      edges: dependencyGraph.edges.length,
      top_modules: topModules,
      sample_edges: dependencyGraph.edges.slice(0, 30),
    },
    architecture_patterns: patterns,
  });
}

// Python-style aliases for direct spec mapping.
export const parse_file = parseFile;
export const extract_dependency_graph = extractDependencyGraph;
export const detect_patterns = detectPatterns;
