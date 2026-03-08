import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import type { ArchitectureVisualization, Finding, FounderContent } from '../db';
import type { FileEntry } from './chunker-service';
import type { ParsedDocument } from './file-parser';
import type { ArchPattern, DependencyGraph, ParsedFile } from './parser-service';

let anthropicClient: Anthropic | null = null;
const MAX_INPUT_TOKENS_PER_PASS = 80000;
const RESERVED_OUTPUT_TOKENS = 8000;
const CACHE_TTL_SECONDS = 60 * 60 * 24;
const RATE_LIMIT_MAX_RETRIES = 3;
const BASE_RETRY_DELAY_MS = 800;

interface CacheRecord {
  value: string;
  expires_at: number;
}

const memoryCache = new Map<string, CacheRecord>();

function getAnthropicClient(): Anthropic {
  if (typeof window !== 'undefined') {
    throw new Error('Anthropic analysis client is only available on the server.');
  }
  if (anthropicClient) {
    return anthropicClient;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is required to run repository analysis.');
  }

  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

const PASS1ModuleSummarySchema = z.object({
  plain_summary: z.string().min(1),
  business_function: z.string().min(1),
  key_technologies: z.array(z.string()).default([]),
  file_count: z.number().int().nonnegative(),
  estimated_loc: z.number().int().nonnegative(),
});

const PASS1OutputSchema = z.object({
  module_summaries: z.record(z.string(), PASS1ModuleSummarySchema),
});

const PASS2RelationshipSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  plain_label: z.string().min(1),
  data_flow: z.string().min(1),
  direction: z.string().min(1),
  trigger: z.string().min(1),
});

const PASS2OutputSchema = z.object({
  relationships: z.array(PASS2RelationshipSchema).default([]),
});

const PASS3JourneyStepSchema = z.object({
  action: z.string().min(1),
  description: z.string().min(1),
  module_name: z.string().min(1),
  data_passed: z.string().default(''),
});

const PASS3JourneySchema = z.object({
  title: z.string().min(1),
  persona: z.string().min(1),
  goal: z.string().min(1),
  steps: z.array(PASS3JourneyStepSchema).min(2).max(6),
});

const PASS3ValueFeatureSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  business_impact: z.string().min(1),
  modules_involved: z.array(z.string()).default([]),
});

const PASS3DataUsageSchema = z.object({
  data_type: z.string().min(1),
  collected_from: z.string().min(1),
  used_for: z.string().min(1),
  stored_in: z.string().default(''),
});

const PASS3ExternalDepSchema = z.object({
  name: z.string().min(1),
  why_needed: z.string().min(1),
  what_breaks_without_it: z.string().min(1),
});

const PASS3ArchitectureDomainSchema = z.object({
  name: z.string().min(1),
  color_hint: z.string().min(1),
  modules: z.array(z.string()).default([]),
  purpose: z.string().min(1),
});

const PASS3BusinessAnalysisSchema = z.object({
  problem_statement: z.string().min(1),
  architecture_domains: z.array(PASS3ArchitectureDomainSchema).max(6).default([]),
  user_journeys: z.array(PASS3JourneySchema).default([]),
  value_features: z.array(PASS3ValueFeatureSchema).default([]),
  data_usage: z.array(PASS3DataUsageSchema).default([]),
  external_deps: z.array(PASS3ExternalDepSchema).default([]),
});

const ArchitectureNarrativeModeSchema = z.object({
  executive_summary: z.string().min(1),
  how_it_works: z.string().min(1),
  components: z.array(z.object({
    name: z.string().min(1),
    explanation: z.string().min(1),
    business_analogy: z.string().min(1),
  })).default([]),
  scale_assessment: z.string().min(1),
  technology_choices: z.array(z.string()).default([]),
});

const PASS4ArchitectureNarrativeSchema = z.object({
  founder_mode: ArchitectureNarrativeModeSchema,
  technical_lite: ArchitectureNarrativeModeSchema,
});

const PASS5FindingSchema = z.object({
  type: z.enum(['gap', 'fidelity']),
  severity: z.enum(['critical', 'high', 'medium', 'low']),
  title: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(z.string()).default([]),
});

const PASS5OutputSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(PASS5FindingSchema).default([]),
});

const PASS6FounderContentSchema = z.object({
  node_descriptions: z.record(z.string(), z.string()).default({}),
  finding_rewrites: z.array(z.object({
    original_title: z.string(),
    title: z.string(),
    description: z.string(),
  })).default([]),
  journey_rewrites: z.record(z.string(), z.object({
    name: z.string(),
    goal: z.string(),
    step_descriptions: z.record(z.string(), z.string()).default({}),
  })).default({}),
  risk_rewrites: z.array(z.object({
    original_title: z.string(),
    title: z.string(),
    impact: z.string(),
    why_it_matters: z.string(),
  })).default([]),
});

type PASS1Output = z.infer<typeof PASS1OutputSchema>;
type PASS2Output = z.infer<typeof PASS2OutputSchema>;
type PASS3BusinessAnalysis = z.infer<typeof PASS3BusinessAnalysisSchema>;
type PASS4ArchitectureNarrative = z.infer<typeof PASS4ArchitectureNarrativeSchema>;
type PASS5Output = z.infer<typeof PASS5OutputSchema>;
type PASS6Output = z.infer<typeof PASS6FounderContentSchema>;

export interface RepoData {
  repo_url: string;
  commit_sha?: string;
  project_name?: string;
  documents: ParsedDocument[];
  manifest: FileEntry[];
  module_groups: Record<string, FileEntry[]>;
  parsed_files: ParsedFile[];
  dependency_graph: DependencyGraph;
  patterns: ArchPattern[];
  code_files: Array<{ path: string; content: string }>;
}

export interface PassResult<T> {
  pass_num: number;
  prompt: string;
  parsed: T;
  raw_response: string;
}

export interface FullAnalysis {
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  module_summaries: PASS1Output['module_summaries'];
  relationships: PASS2Output['relationships'];
  business_analysis: PASS3BusinessAnalysis;
  architecture_narrative: PASS4ArchitectureNarrative;
  founder_content: FounderContent;
  raw_response: string;
  pass_results: {
    pass1: PassResult<PASS1Output>;
    pass2: PassResult<PASS2Output>;
    pass3: PassResult<PASS3BusinessAnalysis>;
    pass4: PassResult<PASS4ArchitectureNarrative>;
    pass5: PassResult<PASS5Output>;
    pass6: PassResult<PASS6Output>;
  };
}

export interface MultiPassProgressEvent {
  stage: 'pass_1' | 'pass_2' | 'pass_3' | 'pass_4' | 'pass_6' | 'done';
  progress: number;
  message: string;
}

export interface RunFullAnalysisOptions {
  onProgress?: (event: MultiPassProgressEvent) => void;
}

function normalizeToPosix(value: string): string {
  return value.replace(/\\/g, '/');
}

function extractJsonCandidate(text: string): string {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}$/);
  return match ? match[0] : cleaned;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function estimateTokensFromText(text: string): number {
  return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  const message = (error as { message?: string })?.message || '';
  return status === 429 || /rate limit|too many requests|429/i.test(message);
}

async function withRateLimitRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  let delay = BASE_RETRY_DELAY_MS;
  while (true) {
    try {
      return await fn();
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= RATE_LIMIT_MAX_RETRIES) {
        throw error;
      }
      await sleep(delay);
      delay *= 2;
      attempt += 1;
    }
  }
}

function trimLongString(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  return `${value.slice(0, Math.max(0, maxChars - 32))}\n...[truncated]`;
}

function applyBudgetStage(
  payload: Record<string, unknown>,
  stage: number
): Record<string, unknown> {
  const next = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;

  const limitArray = (key: string, max: number): void => {
    if (Array.isArray(next[key]) && (next[key] as unknown[]).length > max) {
      next[key] = (next[key] as unknown[]).slice(0, max);
    }
  };

  const limitString = (key: string, max: number): void => {
    if (typeof next[key] === 'string') {
      next[key] = trimLongString(next[key] as string, max);
    }
  };

  const limitModuleSummaries = (max: number): void => {
    const summaries = next.module_summaries;
    if (!summaries || typeof summaries !== 'object' || Array.isArray(summaries)) return;
    const entries = Object.entries(summaries as Record<string, unknown>);
    if (entries.length <= max) return;
    next.module_summaries = Object.fromEntries(entries.slice(0, max));
  };

  if (stage >= 1) {
    limitString('requirements', 120000);
    limitString('readme', 45000);
  }
  if (stage >= 2) {
    limitArray('modules', 220);
    limitArray('dependencies', 220);
    limitArray('relationships', 220);
  }
  if (stage >= 3) {
    limitModuleSummaries(120);
    limitArray('patterns', 40);
  }
  if (stage >= 4) {
    limitArray('modules', 120);
    limitArray('dependencies', 120);
    limitArray('relationships', 120);
    limitModuleSummaries(80);
  }
  if (stage >= 5) {
    if (Array.isArray(next.modules)) {
      next.modules = (next.modules as Array<Record<string, unknown>>).map(module => ({
        module_name: module.module_name,
        file_count: module.file_count,
        estimated_loc: module.estimated_loc,
        categories: module.categories,
        technologies: Array.isArray(module.technologies)
          ? (module.technologies as unknown[]).slice(0, 6)
          : [],
      }));
    }
    limitArray('dependencies', 80);
    limitArray('relationships', 80);
    limitModuleSummaries(50);
    limitString('requirements', 80000);
    limitString('readme', 20000);
  }

  return next;
}

function buildBudgetedContext(
  context: Record<string, unknown>,
  passPrompt: string
): Record<string, unknown> {
  const promptTokenCost = estimateTokensFromText(passPrompt);
  const maxContextTokens = Math.max(12000, MAX_INPUT_TOKENS_PER_PASS - promptTokenCost - 1500);
  let candidate = JSON.parse(JSON.stringify(context)) as Record<string, unknown>;
  let tokenCost = estimateTokensFromText(JSON.stringify(candidate));

  for (let stage = 1; stage <= 5 && tokenCost > maxContextTokens; stage += 1) {
    candidate = applyBudgetStage(candidate, stage);
    tokenCost = estimateTokensFromText(JSON.stringify(candidate));
  }

  if (tokenCost > maxContextTokens) {
    return {
      context_budget_exceeded: true,
      reduced_summary: {
        keys: Object.keys(candidate),
        approx_tokens: tokenCost,
      },
      truncated_context_preview: trimLongString(JSON.stringify(candidate), maxContextTokens * 4),
    };
  }

  return candidate;
}

export function buildPromptContextForPass(
  context: Record<string, unknown>,
  prompt: string
): Record<string, unknown> {
  return buildBudgetedContext(context, prompt);
}

function buildCacheKey(repoData: RepoData): string {
  const repo = encodeURIComponent(repoData.repo_url);
  const commit = encodeURIComponent(repoData.commit_sha || 'unknown');
  return `analysis:multi-pass:${repo}:${commit}`;
}

async function getCachedAnalysis(cacheKey: string): Promise<FullAnalysis | null> {
  const local = memoryCache.get(cacheKey);
  if (!local) return null;
  if (local.expires_at < Date.now()) {
    memoryCache.delete(cacheKey);
    return null;
  }
  try {
    return JSON.parse(local.value) as FullAnalysis;
  } catch {
    memoryCache.delete(cacheKey);
    return null;
  }
}

async function setCachedAnalysis(cacheKey: string, analysis: FullAnalysis): Promise<void> {
  const serialized = JSON.stringify(analysis);
  memoryCache.set(cacheKey, {
    value: serialized,
    expires_at: Date.now() + CACHE_TTL_SECONDS * 1000,
  });
}

function nonEmptyLoc(content: string): number {
  if (!content) return 0;
  return content.split('\n').filter(line => line.trim().length > 0).length;
}

function buildRequirementsContext(documents: ParsedDocument[]): string {
  return documents
    .filter(doc => doc.type !== 'image')
    .map(doc => `### ${doc.filename}\n${doc.content.slice(0, 7000)}`)
    .join('\n\n---\n\n')
    .slice(0, 22000);
}

function findReadmeContent(codeFiles: Array<{ path: string; content: string }>): string {
  const readme = codeFiles.find(file => /(^|\/)readme(\.[a-z0-9]+)?$/i.test(file.path));
  return readme?.content?.slice(0, 12000) || '';
}

function buildFileToModuleMap(moduleGroups: Record<string, FileEntry[]>): Map<string, string> {
  const mapping = new Map<string, string>();
  for (const [moduleId, files] of Object.entries(moduleGroups)) {
    for (const file of files) {
      mapping.set(normalizeToPosix(file.path), moduleId);
    }
  }
  return mapping;
}

function buildModuleEdgeContext(repoData: RepoData): Array<{
  source: string;
  target: string;
  import_count: number;
  imported_symbols: string[];
}> {
  const fileToModule = buildFileToModuleMap(repoData.module_groups);
  const accumulator = new Map<string, {
    source: string;
    target: string;
    import_count: number;
    imported_symbols: Set<string>;
  }>();

  for (const edge of repoData.dependency_graph.edges) {
    const sourceFile = normalizeToPosix(edge.source);
    const targetFile = normalizeToPosix(edge.target);
    const sourceModule = fileToModule.get(sourceFile) || '__unknown__';
    const targetModule = targetFile.startsWith('external:')
      ? targetFile
      : (fileToModule.get(targetFile) || '__unknown__');
    if (!sourceModule || !targetModule || sourceModule === targetModule) continue;

    const key = `${sourceModule}::${targetModule}`;
    if (!accumulator.has(key)) {
      accumulator.set(key, {
        source: sourceModule,
        target: targetModule,
        import_count: 0,
        imported_symbols: new Set<string>(),
      });
    }
    const entry = accumulator.get(key)!;
    entry.import_count += 1;
    edge.imported_symbols.forEach(symbol => entry.imported_symbols.add(symbol));
  }

  return Array.from(accumulator.values())
    .map(item => ({
      source: item.source,
      target: item.target,
      import_count: item.import_count,
      imported_symbols: Array.from(item.imported_symbols).slice(0, 10),
    }))
    .sort((a, b) => b.import_count - a.import_count)
    .slice(0, 150);
}

function buildModuleInput(repoData: RepoData): Array<{
  module_name: string;
  file_count: number;
  estimated_loc: number;
  categories: Record<string, number>;
  technologies: string[];
  files: Array<{
    path: string;
    language: string;
    category: string;
    priority_score: number;
    classes: string[];
    functions: string[];
    imports: string[];
    exports: string[];
  }>;
}> {
  const parsedByPath = new Map(
    repoData.parsed_files.map(file => [normalizeToPosix(file.path), file])
  );
  const contentByPath = new Map(
    repoData.code_files.map(file => [normalizeToPosix(file.path), file.content])
  );

  const rankedModules = Object.entries(repoData.module_groups)
    .map(([moduleName, files]) => {
      const priority = files.reduce((sum, file) => sum + file.priority_score, 0) / Math.max(1, files.length);
      return { moduleName, files, priority };
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 30);

  return rankedModules.map(({ moduleName, files }) => {
    const categories: Record<string, number> = {};
    const technologies = new Set<string>();
    let estimatedLoc = 0;
    const fileRows = files
      .slice()
      .sort((a, b) => b.priority_score - a.priority_score)
      .slice(0, 12)
      .map(file => {
        categories[file.category] = (categories[file.category] || 0) + 1;
        technologies.add(file.language);
        const parsed = parsedByPath.get(normalizeToPosix(file.path));
        const content = contentByPath.get(normalizeToPosix(file.path)) || '';
        estimatedLoc += nonEmptyLoc(content);

        (parsed?.imports || []).slice(0, 12).forEach(item => {
          if (!item.target.startsWith('.')) {
            technologies.add(item.target.split('/')[0]);
          }
        });

        return {
          path: file.path,
          language: file.language,
          category: file.category,
          priority_score: Number(file.priority_score.toFixed(3)),
          classes: (parsed?.classes || []).map(c => c.name).slice(0, 8),
          functions: (parsed?.functions || []).map(f => f.name).slice(0, 10),
          imports: (parsed?.imports || []).map(i => i.target).slice(0, 12),
          exports: (parsed?.exports || []).slice(0, 12),
        };
      });

    return {
      module_name: moduleName,
      file_count: files.length,
      estimated_loc: estimatedLoc,
      categories,
      technologies: Array.from(technologies).slice(0, 12),
      files: fileRows,
    };
  });
}

function inferNodeType(category: string): ArchitectureVisualization['nodes'][number]['type'] {
  if (category === 'route') return 'api';
  if (category === 'service') return 'service';
  if (category === 'model') return 'database';
  if (category === 'view') return 'ui';
  if (category === 'external') return 'external';
  return 'component';
}

function inferEdgeTypeFromRelationship(relationship: PASS2Output['relationships'][number]): ArchitectureVisualization['edges'][number]['type'] {
  const joined = `${relationship.plain_label} ${relationship.data_flow} ${relationship.trigger}`.toLowerCase();
  if (/(render|display|screen|ui)/.test(joined)) return 'renders';
  if (/(persist|store|database|save|write)/.test(joined)) return 'stores';
  if (/(click|submit|request|trigger|action|event)/.test(joined)) return 'calls';
  return 'imports';
}

function buildDeterministicArchitecture(repoData: RepoData, pass1: PASS1Output, pass2: PASS2Output): ArchitectureVisualization {
  const fileToModule = buildFileToModuleMap(repoData.module_groups);
  const moduleDegree = new Map<string, number>();

  for (const edge of buildModuleEdgeContext(repoData)) {
    moduleDegree.set(edge.source, (moduleDegree.get(edge.source) || 0) + edge.import_count);
    moduleDegree.set(edge.target, (moduleDegree.get(edge.target) || 0) + edge.import_count);
  }

  const nodes: ArchitectureVisualization['nodes'] = Object.entries(pass1.module_summaries).map(([moduleName, summary]) => {
    const files = repoData.module_groups[moduleName] || [];
    const dominantCategory = files.reduce<Record<string, number>>((acc, file) => {
      acc[file.category] = (acc[file.category] || 0) + 1;
      return acc;
    }, {});
    const topCategory = Object.entries(dominantCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || 'utility';

    const complexityScore = (moduleDegree.get(moduleName) || 0) + summary.estimated_loc / 200;
    const complexity: 'low' | 'medium' | 'high' =
      complexityScore >= 12 ? 'high' : complexityScore >= 6 ? 'medium' : 'low';

    return {
      id: moduleName,
      name: moduleName,
      type: inferNodeType(topCategory),
      complexity,
      description: summary.plain_summary,
      business_role: summary.business_function,
      files: files.map(file => file.path).slice(0, 20),
    };
  });

  const nodeIds = new Set(nodes.map(node => node.id));
  const pass2Edges = pass2.relationships
    .filter(rel => nodeIds.has(rel.source) && nodeIds.has(rel.target))
    .map(rel => ({
      from: rel.source,
      to: rel.target,
      type: inferEdgeTypeFromRelationship(rel),
      label: rel.plain_label,
      data_flow: rel.data_flow,
      trigger: rel.trigger,
    }));

  const deterministicFallbackEdges = buildModuleEdgeContext(repoData)
    .filter(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map(edge => ({
      from: edge.source,
      to: edge.target,
      type: 'imports' as const,
      label: 'Shares module dependencies',
      data_flow: 'Implementation dependency between modules.',
      trigger: 'Module load and runtime interaction.',
    }));

  const finalEdges = pass2Edges.length > 0 ? pass2Edges : deterministicFallbackEdges;
  const uniqueEdges = new Map<string, ArchitectureVisualization['edges'][number]>();
  finalEdges.forEach(edge => uniqueEdges.set(`${edge.from}->${edge.to}->${edge.type}`, edge));

  // Ensure external dependency visibility for major integrations.
  const externalTargets = repoData.dependency_graph.edges
    .filter(edge => edge.target.startsWith('external:'))
    .map(edge => edge.target.replace(/^external:/, ''))
    .slice(0, 6);

  externalTargets.forEach(target => {
    const id = `external:${target}`;
    if (!nodeIds.has(id)) {
      nodes.push({
        id,
        name: target,
        type: 'external',
        complexity: 'low',
        description: `External dependency: ${target}`,
        files: [],
      });
      nodeIds.add(id);
    }
  });

  for (const edge of repoData.dependency_graph.edges) {
    if (!edge.target.startsWith('external:')) continue;
    const sourceModule = fileToModule.get(normalizeToPosix(edge.source));
    if (!sourceModule || !nodeIds.has(sourceModule)) continue;
    const targetId = edge.target;
    if (!nodeIds.has(targetId)) continue;
    uniqueEdges.set(`${sourceModule}->${targetId}->imports`, {
      from: sourceModule,
      to: targetId,
      type: 'imports',
      label: `Depends on ${targetId.replace(/^external:/, '')}`,
      data_flow: 'Calls or imports external dependency capabilities.',
      trigger: 'Runtime integration path.',
    });
  }

  return {
    nodes,
    edges: Array.from(uniqueEdges.values()).slice(0, 180),
  };
}

function backfillModuleSummaries(
  moduleInput: ReturnType<typeof buildModuleInput>,
  pass1: PASS1Output
): PASS1Output['module_summaries'] {
  const merged = { ...pass1.module_summaries };
  moduleInput.forEach(moduleItem => {
    if (merged[moduleItem.module_name]) return;
    merged[moduleItem.module_name] = {
      plain_summary: `${moduleItem.module_name} handles ${Object.keys(moduleItem.categories)[0] || 'core'} responsibilities in the system.`,
      business_function: `Supports the ${moduleItem.module_name} portion of the product workflow.`,
      key_technologies: moduleItem.technologies.slice(0, 5),
      file_count: moduleItem.file_count,
      estimated_loc: moduleItem.estimated_loc,
    };
  });
  return merged;
}

function batchModulesForPass1(
  modules: ReturnType<typeof buildModuleInput>,
  tokenBudget: number
): Array<ReturnType<typeof buildModuleInput>> {
  if (modules.length === 0) return [];
  const batches: Array<ReturnType<typeof buildModuleInput>> = [];
  let currentBatch: ReturnType<typeof buildModuleInput> = [];
  let currentTokens = 0;

  for (const moduleItem of modules) {
    const moduleTokens = estimateTokensFromText(JSON.stringify(moduleItem));
    if (currentBatch.length > 0 && currentTokens + moduleTokens > tokenBudget) {
      batches.push(currentBatch);
      currentBatch = [];
      currentTokens = 0;
    }
    currentBatch.push(moduleItem);
    currentTokens += moduleTokens;
  }
  if (currentBatch.length > 0) batches.push(currentBatch);
  return batches;
}

async function runPass1ModuleSummaries(
  repoData: RepoData,
  jobId: string,
  moduleInput: ReturnType<typeof buildModuleInput>
): Promise<PassResult<PASS1Output>> {
  const pass1Prompt = `You are analyzing a software repository for a non-technical audience.
For EACH module, provide:
1) one-sentence plain-English summary of what it does
2) what business function it serves
3) key technologies/frameworks used
4) how many files and approximate lines of code
Use module_name keys exactly as provided.

Output format:
{
  "module_summaries": {
    "module_name": {
      "plain_summary": "...",
      "business_function": "...",
      "key_technologies": ["..."],
      "file_count": 0,
      "estimated_loc": 0
    }
  }
}`;

  const batchTokenBudget = Math.max(18000, MAX_INPUT_TOKENS_PER_PASS - 12000);
  const batches = batchModulesForPass1(moduleInput, batchTokenBudget);
  const merged: PASS1Output['module_summaries'] = {};
  const rawParts: string[] = [];

  for (let i = 0; i < batches.length; i += 1) {
    const batchContext = {
      job_id: jobId,
      repo_url: repoData.repo_url,
      batch_index: i + 1,
      total_batches: batches.length,
      modules: batches[i],
      patterns: repoData.patterns,
    };
    const batchPrompt = `${pass1Prompt}\n\nThis is batch ${i + 1}/${batches.length}.`;
    const result = await runAnthropicPassWithSchema(PASS1OutputSchema, 1, batchPrompt, batchContext);
    Object.assign(merged, result.parsed.module_summaries);
    rawParts.push(`Batch ${i + 1}\n${result.raw_response}`);
  }

  return {
    pass_num: 1,
    prompt: pass1Prompt,
    parsed: { module_summaries: merged },
    raw_response: rawParts.join('\n\n'),
  };
}

function batchModuleSummariesForPass2(
  moduleSummaries: PASS1Output['module_summaries'],
  tokenBudget: number
): Array<PASS1Output['module_summaries']> {
  const entries = Object.entries(moduleSummaries);
  if (entries.length === 0) return [];
  const batches: Array<PASS1Output['module_summaries']> = [];
  let current: Array<[string, PASS1Output['module_summaries'][string]]> = [];
  let currentTokens = 0;

  for (const entry of entries) {
    const entryTokens = estimateTokensFromText(JSON.stringify(entry));
    if (current.length > 0 && currentTokens + entryTokens > tokenBudget) {
      batches.push(Object.fromEntries(current));
      current = [];
      currentTokens = 0;
    }
    current.push(entry);
    currentTokens += entryTokens;
  }

  if (current.length > 0) {
    batches.push(Object.fromEntries(current));
  }
  return batches;
}

async function runPass2Relationships(
  moduleSummaries: PASS1Output['module_summaries'],
  moduleEdgeContext: ReturnType<typeof buildModuleEdgeContext>
): Promise<PassResult<PASS2Output>> {
  const pass2Prompt = `Given these module summaries and dependency relationships,
describe how modules work together as a system. For each connection include:
1) what data or responsibility flows between modules
2) direction
3) trigger (user action, schedule, or event)
Use business language and avoid technical jargon.

Output format:
{
  "relationships": [
    {
      "source": "module_a",
      "target": "module_b",
      "plain_label": "...",
      "data_flow": "...",
      "direction": "...",
      "trigger": "..."
    }
  ]
}`;

  const summaryBatches = batchModuleSummariesForPass2(
    moduleSummaries,
    Math.max(12000, MAX_INPUT_TOKENS_PER_PASS - 25000)
  );
  const allRelationships: PASS2Output['relationships'] = [];
  const rawParts: string[] = [];

  for (let i = 0; i < summaryBatches.length; i += 1) {
    const batchSummaries = summaryBatches[i];
    const batchIds = new Set(Object.keys(batchSummaries));
    const batchDependencies = moduleEdgeContext.filter(dep =>
      batchIds.has(dep.source) || batchIds.has(dep.target)
    );
    const batchResult = await runAnthropicPassWithSchema(PASS2OutputSchema, 2, `${pass2Prompt}\n\nThis is batch ${i + 1}/${summaryBatches.length}.`, {
      module_summaries: batchSummaries,
      dependencies: batchDependencies,
      batch_index: i + 1,
      total_batches: summaryBatches.length,
    });
    allRelationships.push(...batchResult.parsed.relationships);
    rawParts.push(`Batch ${i + 1}\n${batchResult.raw_response}`);
  }

  const uniqueRelationships = new Map<string, PASS2Output['relationships'][number]>();
  allRelationships.forEach(rel => {
    uniqueRelationships.set(`${rel.source}->${rel.target}->${rel.plain_label}`, rel);
  });

  return {
    pass_num: 2,
    prompt: pass2Prompt,
    parsed: { relationships: Array.from(uniqueRelationships.values()) },
    raw_response: rawParts.join('\n\n'),
  };
}

async function runAnthropicPassWithSchema<T>(
  schema: z.ZodSchema<T>,
  passNum: number,
  prompt: string,
  context: Record<string, unknown>
): Promise<PassResult<T>> {
  const client = getAnthropicClient();
  const budgetedContext = buildBudgetedContext(context, prompt);
  const userPrompt = `${prompt}

Return strict JSON only.

Context:
${JSON.stringify(budgetedContext)}`;

  const response = await withRateLimitRetry(() => client.messages.create({
    model: 'claude-sonnet-4-20250514',
    temperature: 0,
    max_tokens: RESERVED_OUTPUT_TOKENS,
    system: 'You are a precise software analysis engine. Return valid JSON only. No markdown.',
    messages: [{ role: 'user', content: userPrompt }],
  }));

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error(`Pass ${passNum}: no text response`);
  }

  const rawText = textBlock.text;
  const candidate = extractJsonCandidate(rawText);

  try {
    const parsed = schema.parse(JSON.parse(candidate));
    return {
      pass_num: passNum,
      prompt,
      parsed,
      raw_response: rawText,
    };
  } catch {
    const repairPrompt = `Your previous output was invalid JSON for the required schema.
Return corrected JSON only.

Original response:
${rawText}
`;
    const repairResponse = await withRateLimitRetry(() => client.messages.create({
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      max_tokens: RESERVED_OUTPUT_TOKENS,
      system: 'Return valid JSON only. No markdown.',
      messages: [{ role: 'user', content: repairPrompt }],
    }));
    const repairTextBlock = repairResponse.content.find(block => block.type === 'text');
    if (!repairTextBlock || repairTextBlock.type !== 'text') {
      throw new Error(`Pass ${passNum}: repair returned no text`);
    }
    const repairedCandidate = extractJsonCandidate(repairTextBlock.text);
    const parsed = schema.parse(JSON.parse(repairedCandidate));
    return {
      pass_num: passNum,
      prompt,
      parsed,
      raw_response: `${rawText}\n\n[REPAIR]\n${repairTextBlock.text}`,
    };
  }
}

export async function runPass(
  passNum: number,
  context: Record<string, unknown>,
  prompt: string
): Promise<PassResult<unknown>> {
  return runAnthropicPassWithSchema(z.unknown(), passNum, prompt, context);
}

export async function runFullAnalysis(
  repoData: RepoData,
  jobId: string,
  options?: RunFullAnalysisOptions
): Promise<FullAnalysis> {
  const emit = (event: MultiPassProgressEvent): void => {
    options?.onProgress?.(event);
  };

  const cacheKey = buildCacheKey(repoData);
  const cached = await getCachedAnalysis(cacheKey);
  if (cached) {
    emit({ stage: 'done', progress: 100, message: 'Analysis loaded from cache.' });
    return cached;
  }

  const moduleInput = buildModuleInput(repoData);
  const moduleEdgeContext = buildModuleEdgeContext(repoData);
  const requirementsContext = buildRequirementsContext(repoData.documents);
  const readmeContent = findReadmeContent(repoData.code_files);

  emit({ stage: 'pass_1', progress: 50, message: 'Summarizing modules...' });
  const pass1 = await runPass1ModuleSummaries(repoData, jobId, moduleInput);
  const moduleSummaries = backfillModuleSummaries(moduleInput, pass1.parsed);

  emit({ stage: 'pass_2', progress: 65, message: 'Mapping relationships...' });
  const pass2 = await runPass2Relationships(moduleSummaries, moduleEdgeContext);

  const pass3Prompt = `Based on the system's modules and relationships, provide:

1) problem_statement: the core business problem this product solves (1-2 sentences for a CEO)

2) user_journeys: up to 4 real user flows through this system.
   CRITICAL: each step's "module_name" MUST be one of these exact names:
   ${Object.keys(moduleSummaries).join(', ')}
   Each journey needs 2-6 steps showing how data/control flows between modules.
   For every step, include "data_passed" describing what moves to the next step
   (example: "JWT token", "parsed document", "order payload").

3) value_features: what makes this product valuable — include which modules deliver each feature

4) data_usage: what data the system collects, where it comes from, and how it's used.
   Each entry needs: data_type, collected_from, used_for, stored_in

5) external_deps: external services with:
   - why_needed: business reason
   - what_breaks_without_it: consequence of removing it

6) architecture_domains: group modules into 2-6 business domains.
   For each domain include:
   - name
   - color_hint (like blue, green, purple, orange)
   - modules (must only use these module names: ${Object.keys(moduleSummaries).join(', ')})
   - purpose (1 sentence business purpose)

Write for a CEO who has never seen code. Use plain English.

Output format:
{
  "problem_statement": "...",
  "architecture_domains": [
    {
      "name": "Content Processing",
      "color_hint": "purple",
      "modules": ["parser", "analyzer"],
      "purpose": "Transforms uploads into structured business data"
    }
  ],
  "user_journeys": [
    {
      "title": "...",
      "persona": "...",
      "goal": "...",
      "steps": [
        {
          "action": "...",
          "description": "...",
          "module_name": "...",
          "data_passed": "..."
        }
      ]
    }
  ],
  "value_features": [
    {
      "name": "...",
      "description": "...",
      "business_impact": "...",
      "modules_involved": ["..."]
    }
  ],
  "data_usage": [
    {
      "data_type": "...",
      "collected_from": "...",
      "used_for": "...",
      "stored_in": "..."
    }
  ],
  "external_deps": [
    {
      "name": "...",
      "why_needed": "...",
      "what_breaks_without_it": "..."
    }
  ]
}`;
  emit({ stage: 'pass_3', progress: 80, message: 'Extracting business logic...' });
  const pass3 = await runAnthropicPassWithSchema(PASS3BusinessAnalysisSchema, 3, pass3Prompt, {
    module_summaries: moduleSummaries,
    relationships: pass2.parsed.relationships,
    readme: readmeContent,
  });

  const pass4Prompt = `Create a comprehensive but accessible architecture overview.
Include:
1) A 2-paragraph executive summary
2) A "How It Works" section using a real user scenario
3) Component breakdown with business analogies
4) Scale & reliability assessment
5) Technology choices explained in business terms

Output format:
{
  "founder_mode": {
    "executive_summary": "...",
    "how_it_works": "...",
    "components": [
      {
        "name": "...",
        "explanation": "...",
        "business_analogy": "..."
      }
    ],
    "scale_assessment": "...",
    "technology_choices": ["..."]
  },
  "technical_lite": {
    "executive_summary": "...",
    "how_it_works": "...",
    "components": [
      {
        "name": "...",
        "explanation": "...",
        "business_analogy": "..."
      }
    ],
    "scale_assessment": "...",
    "technology_choices": ["..."]
  }
}`;
  emit({ stage: 'pass_4', progress: 95, message: 'Building architecture view...' });
  const pass4 = await runAnthropicPassWithSchema(PASS4ArchitectureNarrativeSchema, 4, pass4Prompt, {
    previous_analysis: {
      module_summaries: moduleSummaries,
      relationships: pass2.parsed.relationships,
      business_analysis: pass3.parsed,
      patterns: repoData.patterns,
    },
    requirements: requirementsContext,
  });

  const pass5Prompt = `Create an executive analysis output for non-technical stakeholders.
Use requirements, system analysis, and architecture narrative.
Produce:
1) concise summary
2) prioritized findings as "gap" or "fidelity" with severity and business impact.

Output format:
{
  "summary": "...",
  "findings": [
    {
      "type": "gap" | "fidelity",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "...",
      "description": "...",
      "evidence": ["..."]
    }
  ]
}`;
  const pass5 = await runAnthropicPassWithSchema(PASS5OutputSchema, 5, pass5Prompt, {
    requirements: requirementsContext,
    module_summaries: moduleSummaries,
    relationships: pass2.parsed.relationships,
    business_analysis: pass3.parsed,
    architecture_narrative: pass4.parsed,
    patterns: repoData.patterns,
  });

  const architecture = buildDeterministicArchitecture(
    repoData,
    { module_summaries: moduleSummaries },
    pass2.parsed
  );
  const findings: Finding[] = pass5.parsed.findings.map(item => ({
    type: item.type,
    severity: item.severity,
    title: item.title,
    description: item.description,
    evidence: unique(item.evidence).slice(0, 8),
  }));

  const pass6Prompt = `You are rewriting technical descriptions for a non-technical founder audience.

For each item below, rewrite the text using zero technical jargon.
Use everyday business analogies and concrete examples.
Keep rewrites concise (1-2 sentences max per item).

IMPORTANT RULES:
- "Database" -> explain as "where information is stored, like a digital filing cabinet"
- "API" -> "the way different parts of the system talk to each other"
- "Authentication" -> "the login/security system"
- Never mention specific technologies unless they are household names (e.g., "Stripe" is fine)
- Write as if explaining to someone who has never written code
- Use active voice and short sentences

I need rewrites for:

1. ARCHITECTURE NODE DESCRIPTIONS
2. FINDING TITLES AND DESCRIPTIONS
3. JOURNEY STEPS (if any)
4. RISK ITEMS (if any)

Return JSON matching the exact schema specified.`;

  emit({ stage: 'pass_6', progress: 97, message: 'Generating founder-friendly content...' });
  const pass6Context = {
    architecture_nodes: architecture.nodes.map(node => ({
      id: node.id,
      name: node.name,
      description: node.description,
    })),
    findings: findings.map(finding => ({
      title: finding.title,
      severity: finding.severity,
      description: finding.description,
    })),
    journeys: pass3.parsed.user_journeys.map((journey, index) => ({
      id: `journey_${index + 1}`,
      name: journey.title,
      goal: journey.goal,
      steps: journey.steps.map((step, stepIndex) => ({
        id: `${index + 1}_${stepIndex + 1}`,
        name: step.action,
        description: step.description,
        module_name: step.module_name,
      })),
    })),
    risks: findings.map(finding => ({
      title: finding.title,
      impact: finding.description,
      why_it_matters: finding.description,
    })),
    business_analysis: pass3.parsed,
  };
  const emptyPass6: PASS6Output = {
    node_descriptions: {},
    finding_rewrites: [],
    journey_rewrites: {},
    risk_rewrites: [],
  };
  let pass6: PassResult<PASS6Output> = {
    pass_num: 6,
    prompt: pass6Prompt,
    parsed: emptyPass6,
    raw_response: JSON.stringify(emptyPass6),
  };
  try {
    pass6 = await runAnthropicPassWithSchema(PASS6FounderContentSchema, 6, pass6Prompt, pass6Context);
  } catch (pass6Error) {
    console.warn(
      'Pass 6 (founder content) failed:',
      pass6Error instanceof Error ? pass6Error.message : pass6Error
    );
  }

  const founderContent: FounderContent = {
    narrative: pass4.parsed.founder_mode,
    node_descriptions: pass6.parsed.node_descriptions,
    finding_rewrites: pass6.parsed.finding_rewrites,
    journey_rewrites: pass6.parsed.journey_rewrites,
    risk_rewrites: pass6.parsed.risk_rewrites,
  };

  const rawResponse = JSON.stringify({
    engine: 'anthropic_multi_pass',
    pass1: pass1.parsed,
    pass2: pass2.parsed,
    pass3: pass3.parsed,
    pass4: pass4.parsed,
    pass5: pass5.parsed,
    pass6: pass6.parsed,
  });

  const fullAnalysis: FullAnalysis = {
    summary: pass5.parsed.summary || pass4.parsed.founder_mode.executive_summary,
    findings,
    architecture,
    module_summaries: moduleSummaries,
    relationships: pass2.parsed.relationships,
    business_analysis: pass3.parsed,
    architecture_narrative: pass4.parsed,
    founder_content: founderContent,
    raw_response: rawResponse,
    pass_results: {
      pass1,
      pass2,
      pass3,
      pass4,
      pass5,
      pass6,
    },
  };

  await setCachedAnalysis(cacheKey, fullAnalysis);
  return fullAnalysis;
}

// Python-style aliases for direct spec mapping.
export const run_full_analysis = runFullAnalysis;
export const run_pass = runPass;
