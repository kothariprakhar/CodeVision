import path from 'path';
import fs from 'fs';
import simpleGit from 'simple-git';
import type { ArchitectureVisualization, EvidenceRef, Finding } from '../db';
import {
  ModuleGraph,
  ModuleGraph3D,
  ModuleGraphBundle,
  ModuleGraphBundleSchema,
  ModuleGraphEdge,
  ModuleLayoutHints,
  ModuleGraphNode,
  ModuleQualityReport,
  RepoArchetype,
  VisualQualityReport,
} from '../schemas/module-graph';
import { enrichModuleGraphWithAnthropic } from './module-graph-llm';

interface SourceCodeFile {
  path: string;
  content: string;
}

interface ModuleGraphGenerationInput {
  architecture?: ArchitectureVisualization | null;
  findings: Finding[];
  codeFiles: SourceCodeFile[];
  repoPath: string;
  projectName?: string;
  githubUrl?: string;
  githubToken?: string;
}

interface ModuleStats {
  id: string;
  label: string;
  paths: Set<string>;
  loc: number;
  fileCount: number;
  outDegree: number;
  inDegree: number;
  evidence: EvidenceRef[];
  architectureSignals: number;
  rawScore: number;
}

interface FileDependencyEdge {
  from: string;
  to: string;
}

interface RecencySignals {
  lastCommitAt?: string;
  hotnessScore: number;
  commits90d: number;
}

const MODULE_ROOT_HINTS = new Set([
  'src',
  'app',
  'apps',
  'packages',
  'libs',
  'lib',
  'services',
  'server',
  'client',
  'backend',
  'frontend',
  'cmd',
  'internal',
  'api',
]);

const MANIFEST_FILENAMES = [
  'package.json',
  'pnpm-workspace.yaml',
  'yarn.lock',
  'pyproject.toml',
  'requirements.txt',
  'go.mod',
  'Cargo.toml',
  'pom.xml',
  'build.gradle',
  'settings.gradle',
  'Dockerfile',
  'docker-compose.yml',
  'terraform.tf',
  'main.tf',
];

const JS_TS_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const MODULE_LAYER_ORDER: ModuleGraphNode['layer'][] = [
  'presentation',
  'application',
  'domain',
  'data',
  'infrastructure',
  'shared',
  'unknown',
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPosix(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function countLoc(content: string): number {
  if (!content) return 0;
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

function humanizeModuleName(moduleId: string): string {
  if (moduleId === '__root__') return 'Repository Root';
  return moduleId
    .split('/')
    .map(part => part.replace(/[-_]/g, ' '))
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function inferModuleBoundary(filePath: string): string {
  const normalized = toPosix(filePath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return '__root__';
  if (parts.length === 1) return '__root__';

  const first = parts[0];
  if (MODULE_ROOT_HINTS.has(first) && parts.length >= 3) {
    return `${first}/${parts[1]}`;
  }
  if (MODULE_ROOT_HINTS.has(first) && parts.length >= 2) {
    return `${first}/${parts[1]}`;
  }
  return first;
}

function detectRepoArchetype(filePaths: string[]): RepoArchetype {
  const joined = filePaths.join('\n').toLowerCase();
  if (joined.includes('android') || joined.includes('ios') || joined.includes('react-native')) return 'mobile';
  if (joined.includes('electron') || joined.includes('tauri')) return 'desktop';
  if (joined.includes('terraform') || joined.includes('kubernetes') || joined.includes('helm')) return 'infra';
  if (joined.includes('notebook') || joined.includes('.ipynb') || joined.includes('ml') || joined.includes('model')) return 'data_ml';
  if (joined.includes('/api/') || joined.includes('express') || joined.includes('fastapi') || joined.includes('controller')) return 'api_service';
  if (joined.includes('react') || joined.includes('next') || joined.includes('vue') || joined.includes('/components/')) return 'web_app';
  if (joined.includes('lib/') || joined.includes('src/lib') || joined.includes('package')) return 'library';
  return 'unknown';
}

function inferModuleType(moduleId: string): ModuleGraphNode['module_type'] {
  const lower = moduleId.toLowerCase();
  if (lower.includes('api') || lower.includes('route') || lower.includes('controller')) return 'api';
  if (lower.includes('ui') || lower.includes('component') || lower.includes('view') || lower.includes('page')) return 'ui';
  if (lower.includes('db') || lower.includes('model') || lower.includes('schema') || lower.includes('data')) return 'data';
  if (lower.includes('infra') || lower.includes('terraform') || lower.includes('k8s') || lower.includes('docker')) return 'infra';
  if (lower.includes('service') || lower.includes('worker') || lower.includes('job')) return 'service';
  if (lower.includes('lib') || lower.includes('package')) return 'library';
  if (lower.includes('integration') || lower.includes('plugin') || lower.includes('adapter')) return 'integration';
  if (lower.includes('utils') || lower.includes('shared') || lower.includes('common')) return 'utility';
  return 'module';
}

function inferModuleLayer(moduleId: string): ModuleGraphNode['layer'] {
  const lower = moduleId.toLowerCase();
  if (lower.includes('ui') || lower.includes('component') || lower.includes('page') || lower.includes('frontend')) return 'presentation';
  if (lower.includes('api') || lower.includes('controller') || lower.includes('service')) return 'application';
  if (lower.includes('domain') || lower.includes('core')) return 'domain';
  if (lower.includes('db') || lower.includes('model') || lower.includes('data')) return 'data';
  if (lower.includes('infra') || lower.includes('terraform') || lower.includes('docker')) return 'infrastructure';
  if (lower.includes('shared') || lower.includes('common') || lower.includes('lib')) return 'shared';
  return 'unknown';
}

function summarizeFocusReason(edge: ModuleGraphEdge): string {
  switch (edge.relation) {
    case 'calls':
      return 'Key orchestration path between major modules.';
    case 'reads':
    case 'writes':
      return 'Data-handling interaction between modules.';
    case 'publishes':
      return 'Event or notification path between modules.';
    case 'imports':
      return 'Direct code dependency with likely coupling.';
    case 'depends_on':
    default:
      return 'Primary dependency path in architecture.';
  }
}

function buildDeterministicLayoutHints(moduleGraph: ModuleGraph): ModuleLayoutHints {
  const nodesById = new Map(moduleGraph.nodes.map(node => [node.id, node]));
  const lanes = MODULE_LAYER_ORDER
    .map(layer => ({
      id: `lane:${layer}`,
      label: layer.replace('_', ' '),
      node_ids: moduleGraph.nodes
        .filter(node => node.layer === layer)
        .sort((a, b) => b.importance_score - a.importance_score)
        .map(node => node.id),
    }))
    .filter(lane => lane.node_ids.length > 0);

  const clustersByRoot = new Map<string, string[]>();
  for (const node of moduleGraph.nodes) {
    const root = node.paths[0]?.split('/')[0] || node.module_type || 'core';
    const current = clustersByRoot.get(root) || [];
    current.push(node.id);
    clustersByRoot.set(root, current);
  }
  const clusters = Array.from(clustersByRoot.entries())
    .slice(0, 10)
    .map(([root, nodeIds]) => ({
      id: `cluster:${root}`,
      label: root,
      node_ids: nodeIds,
    }));

  const hotspots = moduleGraph.nodes
    .slice()
    .sort((a, b) => b.importance_score - a.importance_score)
    .slice(0, 5)
    .map(node => node.id);

  const focus_paths = moduleGraph.edges
    .slice()
    .sort((a, b) => {
      const fromA = nodesById.get(a.from)?.importance_score || 0;
      const toA = nodesById.get(a.to)?.importance_score || 0;
      const fromB = nodesById.get(b.from)?.importance_score || 0;
      const toB = nodesById.get(b.to)?.importance_score || 0;
      return (fromB + toB) - (fromA + toA);
    })
    .slice(0, 8)
    .map(edge => ({
      from: edge.from,
      to: edge.to,
      reason: summarizeFocusReason(edge),
    }));

  const uniqueLayers = new Set(moduleGraph.nodes.map(node => node.layer)).size;
  const preferred2d = uniqueLayers >= 3 ? 'layered' : (clusters.length >= 3 ? 'clustered' : 'radial');
  const preferred3dDensity = moduleGraph.nodes.length > 10 ? 'balanced' : 'compact';

  return {
    lanes,
    clusters,
    hotspots,
    focus_paths,
    render_profile: {
      preferred_2d: preferred2d,
      preferred_3d_density: preferred3dDensity,
    },
    narrative: `Top architecture modules are organized into ${lanes.length || 1} lanes with ${focus_paths.length} key interaction paths.`,
  };
}

function collectManifestSignals(filePaths: string[]): string[] {
  const normalized = new Set(filePaths.map(filePath => toPosix(filePath).toLowerCase()));
  return MANIFEST_FILENAMES.filter(filename => normalized.has(filename.toLowerCase()));
}

function parseLocalDependencySpecifiers(filePath: string, content: string): string[] {
  const extension = path.posix.extname(filePath).toLowerCase();
  const matches = new Set<string>();

  if (JS_TS_EXTENSIONS.includes(extension)) {
    const importRegex = /import\s+[^'"]*['"]([^'"]+)['"]/g;
    const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
    const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const regex of [importRegex, requireRegex, dynamicImportRegex]) {
      let match = regex.exec(content);
      while (match) {
        matches.add(match[1]);
        match = regex.exec(content);
      }
    }
  }

  if (extension === '.py') {
    const fromImportRegex = /^\s*from\s+([.\w]+)\s+import\s+/gm;
    const importRegex = /^\s*import\s+([.\w]+)/gm;
    let match = fromImportRegex.exec(content);
    while (match) {
      matches.add(match[1]);
      match = fromImportRegex.exec(content);
    }
    match = importRegex.exec(content);
    while (match) {
      matches.add(match[1]);
      match = importRegex.exec(content);
    }
  }

  if (extension === '.go') {
    const importBlockRegex = /import\s*\(([\s\S]*?)\)/g;
    const singleImportRegex = /import\s+"([^"]+)"/g;
    let blockMatch = importBlockRegex.exec(content);
    while (blockMatch) {
      const lineMatches = blockMatch[1].match(/"([^"]+)"/g) || [];
      lineMatches.forEach(entry => matches.add(entry.replace(/"/g, '')));
      blockMatch = importBlockRegex.exec(content);
    }
    let match = singleImportRegex.exec(content);
    while (match) {
      matches.add(match[1]);
      match = singleImportRegex.exec(content);
    }
  }

  return Array.from(matches);
}

function resolveLocalDependency(
  sourceFilePath: string,
  specifier: string,
  allFilePaths: Set<string>
): string | null {
  const normalizedSpecifier = specifier.trim();
  if (!normalizedSpecifier) return null;

  const candidates = new Set<string>();
  const sourceDir = path.posix.dirname(toPosix(sourceFilePath));

  if (normalizedSpecifier.startsWith('.')) {
    const base = path.posix.normalize(path.posix.join(sourceDir, normalizedSpecifier));
    candidates.add(base);
    JS_TS_EXTENSIONS.forEach(ext => candidates.add(`${base}${ext}`));
    JS_TS_EXTENSIONS.forEach(ext => candidates.add(path.posix.join(base, `index${ext}`)));
    candidates.add(`${base}.py`);
    candidates.add(path.posix.join(base, '__init__.py'));
  } else if (/^[a-zA-Z0-9_]+(\.[a-zA-Z0-9_]+)+$/.test(normalizedSpecifier)) {
    const dottedPath = normalizedSpecifier.replace(/\./g, '/');
    candidates.add(`${dottedPath}.py`);
    candidates.add(path.posix.join(dottedPath, '__init__.py'));
  } else {
    return null;
  }

  for (const candidate of candidates) {
    if (allFilePaths.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

function addEvidence(stats: ModuleStats, filePath: string, snippet: string): void {
  if (stats.evidence.length >= 8) return;
  stats.evidence.push({
    source_type: 'file',
    ref: filePath,
    snippet,
  });
}

function relationFromArchitectureEdge(type: string): ModuleGraphEdge['relation'] {
  if (type === 'imports') return 'imports';
  if (type === 'calls') return 'calls';
  if (type === 'stores') return 'writes';
  if (type === 'renders') return 'depends_on';
  return 'depends_on';
}

async function getRecencySignalsFromGit(
  repoPath: string,
  filePaths: string[]
): Promise<{ historyAvailable: boolean; byFile: Map<string, RecencySignals> }> {
  const result = new Map<string, RecencySignals>();
  const gitDir = path.join(repoPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return { historyAvailable: false, byFile: result };
  }

  try {
    const git = simpleGit(repoPath);
    const nowSec = Math.floor(Date.now() / 1000);
    const limited = filePaths.slice(0, 80);
    for (const filePath of limited) {
      const rawLog = await git.raw(['log', '--pretty=format:%ct', '--', filePath]);
      const timestamps = rawLog
        .split('\n')
        .map(line => Number(line.trim()))
        .filter(value => Number.isFinite(value) && value > 0);
      if (timestamps.length === 0) continue;

      const lastCommit = timestamps[0];
      const commits90d = timestamps.filter(ts => nowSec - ts <= 90 * 24 * 60 * 60).length;
      const daysSince = Math.max(0, (nowSec - lastCommit) / (24 * 60 * 60));
      const hotness = clamp(Math.exp(-daysSince / 45) * Math.log(1 + commits90d), 0, 1);

      result.set(filePath, {
        lastCommitAt: new Date(lastCommit * 1000).toISOString(),
        hotnessScore: hotness,
        commits90d,
      });
    }

    return { historyAvailable: result.size > 0, byFile: result };
  } catch {
    return { historyAvailable: false, byFile: result };
  }
}

function parseGitHubRepo(githubUrl?: string): { owner: string; repo: string } | null {
  if (!githubUrl) return null;
  const match = githubUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function getRecencySignalsFromGitHub(
  githubUrl: string | undefined,
  githubToken: string | undefined,
  filePaths: string[]
): Promise<Map<string, RecencySignals>> {
  const parsed = parseGitHubRepo(githubUrl);
  const result = new Map<string, RecencySignals>();
  if (!parsed) return result;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'CodeVision-Analyzer',
  };
  if (githubToken && githubToken.trim()) {
    headers.Authorization = `token ${githubToken.trim()}`;
  }

  const limited = filePaths.slice(0, 20);
  const now = Date.now();
  for (const filePath of limited) {
    try {
      const url = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/commits?path=${encodeURIComponent(filePath)}&per_page=1`;
      const response = await fetch(url, { headers });
      if (!response.ok) continue;
      const payload = await response.json() as Array<{ commit?: { author?: { date?: string } } }>;
      const date = payload?.[0]?.commit?.author?.date;
      if (!date) continue;
      const daysSince = Math.max(0, (now - new Date(date).getTime()) / (24 * 60 * 60 * 1000));
      const hotness = clamp(Math.exp(-daysSince / 45) * Math.log(2), 0, 1);
      result.set(filePath, {
        lastCommitAt: date,
        hotnessScore: hotness,
        commits90d: 1,
      });
    } catch {
      // Ignore individual file failures.
    }
  }
  return result;
}

function buildFallbackModuleGraph(projectName?: string): ModuleGraph {
  return {
    root_summary: `Architecture signals were limited${projectName ? ` for ${projectName}` : ''}, so a fallback module map is shown.`,
    repo_archetype: 'unknown',
    nodes: [
      {
        id: 'fallback-module',
        label: 'Unclassified Core Module',
        module_type: 'module',
        layer: 'unknown',
        paths: [],
        importance_score: 0.35,
        evidence: [
          {
            source_type: 'inference',
            ref: 'fallback',
            snippet: 'Generated because deterministic module boundaries could not be confidently extracted.',
          },
        ],
      },
    ],
    edges: [],
  };
}

function buildFallbackModuleGraph3D(): ModuleGraph3D {
  return {
    nodes: [
      {
        id: 'fallback-directory',
        label: 'Repository',
        node_kind: 'directory',
        cluster_id: 'fallback',
        path: '/',
        loc: 0,
        hotness_score: 0.2,
        importance_score: 0.35,
        dependency_count: 0,
        position_seed: { x: 0, y: 0, z: 0 },
      },
    ],
    edges: [],
  };
}

function buildFallbackModuleLayoutHints(): ModuleLayoutHints {
  return {
    lanes: [
      {
        id: 'lane:unknown',
        label: 'unknown',
        node_ids: ['fallback-module'],
      },
    ],
    clusters: [
      {
        id: 'cluster:repository',
        label: 'repository',
        node_ids: ['fallback-module'],
      },
    ],
    hotspots: ['fallback-module'],
    focus_paths: [],
    render_profile: {
      preferred_2d: 'layered',
      preferred_3d_density: 'compact',
    },
    narrative: 'Architecture rendering is in fallback mode due to limited repository signals.',
  };
}

export async function generateModuleGraphArtifacts(
  input: ModuleGraphGenerationInput
): Promise<ModuleGraphBundle> {
  const normalizedFiles = input.codeFiles.map(file => ({
    path: toPosix(file.path),
    content: file.content || '',
  }));
  const allFilePaths = new Set(normalizedFiles.map(file => file.path));
  const moduleStats = new Map<string, ModuleStats>();
  const moduleEdgeWeights = new Map<string, {
    from: string;
    to: string;
    counts: Record<ModuleGraphEdge['relation'], number>;
    files: Set<string>;
    architectureSignals: number;
  }>();
  const fileDependencyEdges: FileDependencyEdge[] = [];

  if (normalizedFiles.length === 0) {
    const moduleGraph = buildFallbackModuleGraph(input.projectName);
    const moduleLayoutHints = buildFallbackModuleLayoutHints();
    const moduleQualityReport: ModuleQualityReport = {
      coverage_score: 0,
      missing_signals: ['source_files_missing'],
      assumptions: ['Fallback module output used because no source files were available.'],
      fallback_mode: 'minimal',
    };
    const moduleGraph3D = buildFallbackModuleGraph3D();
    const visualQualityReport: VisualQualityReport = {
      history_available: false,
      loc_coverage: 0,
      dependency_coverage: 0,
      fallback_mode: 'minimal',
      notes: ['3D graph fallback used because no source files were available.'],
    };
    return ModuleGraphBundleSchema.parse({
      module_graph: moduleGraph,
      module_quality_report: moduleQualityReport,
      module_graph_3d: moduleGraph3D,
      visual_quality_report: visualQualityReport,
      module_layout_hints: moduleLayoutHints,
    });
  }

  for (const file of normalizedFiles) {
    const moduleId = inferModuleBoundary(file.path);
    if (!moduleStats.has(moduleId)) {
      moduleStats.set(moduleId, {
        id: moduleId,
        label: humanizeModuleName(moduleId),
        paths: new Set<string>(),
        loc: 0,
        fileCount: 0,
        outDegree: 0,
        inDegree: 0,
        evidence: [],
        architectureSignals: 0,
        rawScore: 0,
      });
    }
    const stats = moduleStats.get(moduleId)!;
    stats.paths.add(file.path);
    stats.fileCount += 1;
    stats.loc += countLoc(file.content);
    addEvidence(stats, file.path, `Module boundary signal from ${file.path}`);
  }

  const addModuleEdge = (
    fromModule: string,
    toModule: string,
    relation: ModuleGraphEdge['relation'],
    evidencePath: string,
    isArchitectureSignal: boolean
  ): void => {
    if (!fromModule || !toModule || fromModule === toModule) return;
    const key = `${fromModule}::${toModule}`;
    if (!moduleEdgeWeights.has(key)) {
      moduleEdgeWeights.set(key, {
        from: fromModule,
        to: toModule,
        counts: {
          imports: 0,
          calls: 0,
          reads: 0,
          writes: 0,
          publishes: 0,
          depends_on: 0,
        },
        files: new Set<string>(),
        architectureSignals: 0,
      });
    }
    const edge = moduleEdgeWeights.get(key)!;
    edge.counts[relation] += 1;
    edge.files.add(evidencePath);
    if (isArchitectureSignal) edge.architectureSignals += 1;
  };

  for (const file of normalizedFiles) {
    const sourceModule = inferModuleBoundary(file.path);
    const specifiers = parseLocalDependencySpecifiers(file.path, file.content);
    for (const specifier of specifiers) {
      const resolved = resolveLocalDependency(file.path, specifier, allFilePaths);
      if (!resolved) continue;
      const targetModule = inferModuleBoundary(resolved);
      addModuleEdge(sourceModule, targetModule, 'imports', file.path, false);
      fileDependencyEdges.push({ from: file.path, to: resolved });
    }
  }

  const architectureNodeToModule = new Map<string, string>();
  for (const node of input.architecture?.nodes || []) {
    const primaryFile = node.files?.[0];
    if (primaryFile) {
      const moduleId = inferModuleBoundary(primaryFile);
      architectureNodeToModule.set(node.id, moduleId);
      const moduleEntry = moduleStats.get(moduleId);
      if (moduleEntry) {
        moduleEntry.architectureSignals += 1;
      }
    }
  }
  for (const edge of input.architecture?.edges || []) {
    const fromModule = architectureNodeToModule.get(edge.from);
    const toModule = architectureNodeToModule.get(edge.to);
    if (!fromModule || !toModule) continue;
    addModuleEdge(fromModule, toModule, relationFromArchitectureEdge(edge.type), `architecture:${edge.from}->${edge.to}`, true);
  }

  for (const edge of moduleEdgeWeights.values()) {
    const fromStats = moduleStats.get(edge.from);
    const toStats = moduleStats.get(edge.to);
    if (fromStats) fromStats.outDegree += 1;
    if (toStats) toStats.inDegree += 1;
  }

  let maxRawScore = 0;
  for (const stats of moduleStats.values()) {
    stats.rawScore = Math.log1p(stats.loc) + Math.log1p(stats.inDegree + stats.outDegree) * 1.6 + stats.fileCount * 0.25;
    maxRawScore = Math.max(maxRawScore, stats.rawScore);
  }
  if (maxRawScore <= 0) maxRawScore = 1;

  const rankedModules = Array.from(moduleStats.values())
    .sort((a, b) => b.rawScore - a.rawScore)
    .slice(0, 12);

  const selectedRankedModuleIds = new Set(rankedModules.map(module => module.id));
  const moduleNodes: ModuleGraphNode[] = rankedModules.map(stats => {
    const importanceScore = clamp(stats.rawScore / maxRawScore, 0.1, 1);

    return {
      id: stats.id,
      label: stats.label,
      module_type: inferModuleType(stats.id),
      layer: inferModuleLayer(stats.id),
      paths: Array.from(stats.paths).slice(0, 20),
      importance_score: importanceScore,
      evidence: stats.evidence.slice(0, 6),
    };
  });

  const moduleEdges: ModuleGraphEdge[] = Array.from(moduleEdgeWeights.values())
    .filter(edge => selectedRankedModuleIds.has(edge.from) && selectedRankedModuleIds.has(edge.to))
    .map(edge => {
      const relation = Object.entries(edge.counts).sort((a, b) => b[1] - a[1])[0]?.[0] as ModuleGraphEdge['relation'];
      return {
        from: edge.from,
        to: edge.to,
        relation: relation || 'depends_on',
        evidence: Array.from(edge.files).slice(0, 3).map(file => ({
          source_type: file.startsWith('architecture:') ? 'inference' as const : 'file' as const,
          ref: file,
          snippet: file.startsWith('architecture:')
            ? `Architecture edge signal ${file}`
            : `Dependency signal from ${file}`,
        })),
      };
    })
    .sort((a, b) => b.evidence.length - a.evidence.length)
    .slice(0, 40);

  const manifestSignals = collectManifestSignals(normalizedFiles.map(file => file.path));
  const repoArchetype = detectRepoArchetype(normalizedFiles.map(file => file.path));
  const fallbackMode: ModuleQualityReport['fallback_mode'] = (() => {
    if (moduleNodes.length === 0) return 'minimal';
    if (moduleEdges.length === 0 && manifestSignals.length > 0 && moduleNodes.length <= 2) return 'manifest_only';
    if (moduleEdges.length === 0) return 'tree_only';
    return 'none';
  })();

  const coveredPaths = new Set(moduleNodes.flatMap(node => node.paths));
  let moduleQualityReport: ModuleQualityReport = {
    coverage_score: clamp(coveredPaths.size / normalizedFiles.length, 0, 1),
    missing_signals: [
      ...(manifestSignals.length === 0 ? ['manifest_signals_missing'] : []),
      ...(moduleEdges.length === 0 ? ['dependency_edges_missing'] : []),
      ...((input.architecture?.nodes?.length || 0) === 0 ? ['llm_architecture_signals_missing'] : []),
    ],
    assumptions: [
      ...(moduleEdges.length === 0 ? ['Dependency relationships are inferred from folder boundaries due to sparse local import signals.'] : []),
      ...((input.architecture?.nodes?.length || 0) === 0 ? ['Module semantics were generated deterministically without architecture model augmentation.'] : []),
    ],
    fallback_mode: fallbackMode,
  };

  const moduleGraph: ModuleGraph = moduleNodes.length > 0
    ? {
      root_summary: `${input.projectName || 'Repository'} maps to ${moduleNodes.length} major modules with ${moduleEdges.length} dependency relationships.`,
      repo_archetype: repoArchetype,
      nodes: moduleNodes,
      edges: moduleEdges,
    }
    : buildFallbackModuleGraph(input.projectName);

  const deterministicLayoutHints = buildDeterministicLayoutHints(moduleGraph);
  const enrichedArtifacts = await enrichModuleGraphWithAnthropic({
    moduleGraph,
    deterministicLayoutHints,
    moduleQualityReport,
  });
  const moduleGraphFinal = enrichedArtifacts.moduleGraph;
  const moduleLayoutHints = enrichedArtifacts.moduleLayoutHints;
  if (enrichedArtifacts.llmNotes.length > 0) {
    moduleQualityReport = {
      ...moduleQualityReport,
      assumptions: [...moduleQualityReport.assumptions, ...enrichedArtifacts.llmNotes],
    };
  }

  const moduleGraphNodesFinal = moduleGraphFinal.nodes;
  const moduleGraphEdgesFinal = moduleGraphFinal.edges;
  const selectedModuleIds = new Set(moduleGraphNodesFinal.map(node => node.id));

  const directoryNodes = moduleGraphNodesFinal.map((node, index) => {
    const angle = (index / Math.max(1, moduleGraphNodesFinal.length)) * Math.PI * 2;
    const radius = 12;
    return {
      id: `directory:${node.id}`,
      label: node.label,
      node_kind: 'directory' as const,
      cluster_id: node.id,
      path: node.paths[0] ? path.posix.dirname(node.paths[0]) : node.id,
      loc: node.paths.length,
      hotness_score: 0.35,
      importance_score: node.importance_score,
      dependency_count: moduleGraphEdgesFinal.filter(edge => edge.from === node.id || edge.to === node.id).length,
      position_seed: {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius,
      },
    };
  });

  const topFileCandidates = normalizedFiles
    .map(file => ({
      ...file,
      loc: countLoc(file.content),
      moduleId: inferModuleBoundary(file.path),
    }))
    .filter(file => selectedModuleIds.has(file.moduleId))
    .sort((a, b) => b.loc - a.loc)
    .slice(0, 180);

  const { historyAvailable, byFile: gitSignals } = await getRecencySignalsFromGit(
    input.repoPath,
    topFileCandidates.map(file => file.path)
  );
  const githubSignals = historyAvailable
    ? new Map<string, RecencySignals>()
    : await getRecencySignalsFromGitHub(
      input.githubUrl,
      input.githubToken,
      topFileCandidates.map(file => file.path)
    );

  const fileDependencyCount = new Map<string, number>();
  for (const edge of fileDependencyEdges) {
    fileDependencyCount.set(edge.from, (fileDependencyCount.get(edge.from) || 0) + 1);
    fileDependencyCount.set(edge.to, (fileDependencyCount.get(edge.to) || 0) + 1);
  }

  const fileNodes = topFileCandidates.map(file => {
    const recency = gitSignals.get(file.path) || githubSignals.get(file.path);
    const hotnessScore = recency?.hotnessScore ?? 0.25;
    const clusterSeed = hashString(file.path);
    const clusterX = directoryNodes.find(node => node.cluster_id === file.moduleId)?.position_seed?.x || 0;
    const clusterZ = directoryNodes.find(node => node.cluster_id === file.moduleId)?.position_seed?.z || 0;
    const jitterRadius = 1.5 + (clusterSeed % 10) * 0.25;
    const jitterAngle = (clusterSeed % 360) * (Math.PI / 180);

    return {
      id: `file:${file.path}`,
      label: path.posix.basename(file.path),
      node_kind: 'file' as const,
      cluster_id: file.moduleId,
      path: file.path,
      loc: file.loc,
      last_commit_at: recency?.lastCommitAt,
      hotness_score: hotnessScore,
      importance_score: clamp(Math.log1p(file.loc) / Math.log(120), 0.08, 1),
      dependency_count: fileDependencyCount.get(file.path) || 0,
      position_seed: {
        x: clusterX + Math.cos(jitterAngle) * jitterRadius,
        y: ((clusterSeed % 7) - 3) * 0.25,
        z: clusterZ + Math.sin(jitterAngle) * jitterRadius,
      },
    };
  });

  const selectedFileIds = new Set(fileNodes.map(node => node.path));
  const fileEdges = fileDependencyEdges
    .filter(edge => selectedFileIds.has(edge.from) && selectedFileIds.has(edge.to))
    .slice(0, 420)
    .map(edge => ({
      from: `file:${edge.from}`,
      to: `file:${edge.to}`,
      edge_kind: 'imports' as const,
    }));

  const directoryEdges = moduleGraphEdgesFinal.map(edge => ({
    from: `directory:${edge.from}`,
    to: `directory:${edge.to}`,
    edge_kind: edge.relation === 'calls' ? 'calls' as const : 'depends_on' as const,
  }));

  const moduleGraph3D: ModuleGraph3D = (directoryNodes.length + fileNodes.length) > 0
    ? {
      nodes: [...directoryNodes, ...fileNodes],
      edges: [...directoryEdges, ...fileEdges],
    }
    : buildFallbackModuleGraph3D();

  const visualFallbackMode: VisualQualityReport['fallback_mode'] = (() => {
    if (moduleGraph3D.nodes.length === 0) return 'minimal';
    if (moduleGraph3D.edges.length === 0 && manifestSignals.length > 0) return 'manifest_only';
    if (moduleGraph3D.edges.length === 0) return 'tree_only';
    return 'none';
  })();

  const visualQualityReport: VisualQualityReport = {
    history_available: historyAvailable || githubSignals.size > 0,
    loc_coverage: clamp(
      fileNodes.length > 0 ? fileNodes.filter(node => node.loc > 0).length / fileNodes.length : 0,
      0,
      1
    ),
    dependency_coverage: clamp(
      fileNodes.length > 0 ? fileEdges.length / fileNodes.length : 0,
      0,
      1
    ),
    fallback_mode: visualFallbackMode,
    notes: [
      ...(historyAvailable || githubSignals.size > 0
        ? []
        : ['Commit history was unavailable; hotness values use neutral fallback defaults.']),
      ...(moduleGraph3D.edges.length === 0
        ? ['No reliable dependency edges were detected; showing cluster-oriented architecture view.']
        : []),
    ],
  };

  return ModuleGraphBundleSchema.parse({
    module_graph: moduleGraphFinal,
    module_quality_report: moduleQualityReport,
    module_graph_3d: moduleGraph3D,
    visual_quality_report: visualQualityReport,
    module_layout_hints: moduleLayoutHints,
  });
}
