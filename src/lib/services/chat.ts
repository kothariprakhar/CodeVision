import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { getAnalysisById, getChatHistory, updateChatHistory } from '../repositories/analysis';
import { getProject } from '../repositories/projects';
import { ChatMessage, ArchitectureVisualization, Finding } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getProjectRepoPath, downloadRepository, cloneRepository } from './github';
import { buildStarterQuestions } from './tech-risk-engine';
import { buildFileManifest, prioritizeFiles, groupByModule, type FileEntry } from './chunker-service';
import { parseFile } from './parser-service';

const anthropic = new Anthropic();
const LIVE_CONTEXT_MANIFEST_LIMIT = 180;
const LIVE_CONTEXT_RELEVANT_FILE_LIMIT = 4;
const LIVE_CONTEXT_EXCERPT_RADIUS = 8;

export interface ElementContext {
  component?: string;
  file?: string;
  line?: number;
  selector?: string;
}

interface ChatContext {
  summary: string;
  architecture: ArchitectureVisualization;
  findings: Finding[];
  repoPath: string | null;
}

export interface ChatResponse {
  id: string;
  content: string;
  responseType: 'quick' | 'detailed';
  timestamp: string;
  followUps: string[];
  referencedModules: string[];
  starterQuestions?: string[];
}

const AssistantPayloadSchema = z.object({
  answer: z.string().min(1),
  follow_up_questions: z.array(z.string()).default([]),
  referenced_modules: z.array(z.string()).default([]),
  certainty: z.enum(['high', 'medium', 'low']).optional(),
});

const DEFAULT_STARTER_QUESTIONS = [
  'How does authentication work in this product?',
  'What are the most business-critical modules?',
  'Where are the biggest reliability risks today?',
  'How would this system handle 10x user growth?',
];

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function sanitizeModuleName(name: string): string {
  return name.trim();
}

function normalize(value: string): string {
  return value.toLowerCase();
}

function extractKeywords(text: string): string[] {
  return unique(
    normalize(text)
      .split(/[^a-z0-9_./-]+/)
      .filter(token => token.length >= 3)
  );
}

function selectRelevantModules(question: string, architecture: ArchitectureVisualization): string[] {
  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];

  const scored = (architecture.nodes || [])
    .map(node => {
      const searchable = normalize(`${node.name} ${node.description} ${(node.files || []).join(' ')}`);
      const score = keywords.reduce((sum, keyword) => sum + (searchable.includes(keyword) ? 1 : 0), 0);
      return { id: node.id, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(item => item.id);

  return scored;
}

function formatTopCounts(counts: Record<string, number>, limit: number): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => `${label} (${count})`)
    .join(', ');
}

function countBy<T extends string>(values: T[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function scoreFileEntry(
  entry: FileEntry,
  questionTokens: string[],
  emphasizedFiles: Set<string>
): number {
  const searchable = normalize([
    entry.path,
    entry.category,
    entry.language,
    ...entry.imports,
    ...entry.exports,
  ].join(' '));

  let score = entry.priority_score * 6;
  if (emphasizedFiles.has(entry.path)) score += 4;
  for (const token of questionTokens) {
    if (searchable.includes(token)) score += 2;
  }
  if (questionTokens.length === 0 && (entry.category === 'entry_point' || entry.category === 'route')) {
    score += 1.5;
  }
  return score;
}

function extractFocusedSnippet(content: string, searchTerms: string[]): string {
  const lines = content.split('\n');
  if (lines.length === 0) return '';

  let matchIndex = -1;
  if (searchTerms.length > 0) {
    matchIndex = lines.findIndex(line =>
      searchTerms.some(term => line.toLowerCase().includes(term))
    );
  }

  const center = matchIndex >= 0 ? matchIndex : 0;
  const start = Math.max(0, center - LIVE_CONTEXT_EXCERPT_RADIUS);
  const end = Math.min(lines.length, center + LIVE_CONTEXT_EXCERPT_RADIUS + 1);

  return lines
    .slice(start, end)
    .map((line, index) => `${start + index + 1}: ${line}`)
    .join('\n');
}

function summarizeParsedFile(parsed: Awaited<ReturnType<typeof parseFile>>): string {
  const functions = parsed.functions.map(item => item.name).slice(0, 5);
  const classes = parsed.classes.map(item => item.name).slice(0, 4);
  const exports = parsed.exports.slice(0, 5);
  const imports = parsed.imports.map(item => item.target).slice(0, 5);

  const parts = [
    classes.length > 0 ? `classes=${classes.join(', ')}` : '',
    functions.length > 0 ? `functions=${functions.join(', ')}` : '',
    exports.length > 0 ? `exports=${exports.join(', ')}` : '',
    imports.length > 0 ? `imports=${imports.join(', ')}` : '',
  ].filter(Boolean);

  return parts.join(' | ') || 'no strong symbols detected';
}

async function buildLatestRepoContext(
  repoPath: string,
  question: string,
  architecture: ArchitectureVisualization
): Promise<string> {
  const manifest = prioritizeFiles(buildFileManifest(repoPath)).slice(0, LIVE_CONTEXT_MANIFEST_LIMIT);
  if (manifest.length === 0) {
    return 'Live repository context was requested, but no analyzable source files were found in the current repo snapshot.';
  }

  const grouped = groupByModule(manifest);
  const languageCounts = countBy(manifest.map(entry => entry.language));
  const categoryCounts = countBy(manifest.map(entry => entry.category));
  const questionTokens = extractKeywords(question);
  const emphasizedFiles = new Set(
    (architecture.nodes || [])
      .filter(node =>
        questionTokens.some(token =>
          normalize(`${node.name} ${node.description} ${(node.files || []).join(' ')}`).includes(token)
        )
      )
      .flatMap(node => node.files || [])
  );

  const topModules = Object.entries(grouped)
    .map(([moduleName, files]) => ({
      moduleName,
      files,
      score: files.reduce((sum, file) => sum + file.priority_score, 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map(group => {
      const leadFiles = group.files
        .slice()
        .sort((a, b) => b.priority_score - a.priority_score)
        .slice(0, 3)
        .map(file => file.path)
        .join(', ');
      return `- ${group.moduleName}: ${group.files.length} files; lead files: ${leadFiles}`;
    });

  const relevantEntries = manifest
    .map(entry => ({
      entry,
      score: scoreFileEntry(entry, questionTokens, emphasizedFiles),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, LIVE_CONTEXT_RELEVANT_FILE_LIMIT)
    .map(item => item.entry);

  const focusedFiles = await Promise.all(
    relevantEntries.map(async entry => {
      const fullPath = path.join(repoPath, entry.path);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const parsed = await parseFile(entry.path, entry.language, content);
      return {
        entry,
        parsed,
        snippet: extractFocusedSnippet(content, questionTokens),
      };
    })
  );

  const focusedFileText = focusedFiles.map(({ entry, parsed, snippet }) => {
    return [
      `- File: ${entry.path}`,
      `  category=${entry.category}; language=${entry.language}; priority=${entry.priority_score.toFixed(2)}`,
      `  structural_signals: ${summarizeParsedFile(parsed)}`,
      '  excerpt:',
      `\`\`\`\n${snippet}\n\`\`\``,
    ].join('\n');
  }).join('\n\n');

  return [
    'Live repository context (built at answer time from the current repo snapshot):',
    `- files_scanned=${manifest.length}`,
    `- languages=${formatTopCounts(languageCounts, 6)}`,
    `- categories=${formatTopCounts(categoryCounts, 6)}`,
    '- top_modules:',
    ...(topModules.length > 0 ? topModules : ['- none']),
    '',
    'Question-focused current code context:',
    focusedFileText || '- No strongly relevant files found in the current repo snapshot.',
  ].join('\n');
}

function determineResponseType(question: string): 'quick' | 'detailed' {
  const quickPatterns = [/where is/i, /which file/i, /what does .* do/i, /how many/i, /list/i];
  const detailedPatterns = [/how should/i, /how can/i, /implement/i, /best practice/i, /architecture/i, /scale/i];
  if (detailedPatterns.some(pattern => pattern.test(question))) return 'detailed';
  if (quickPatterns.some(pattern => pattern.test(question))) return 'quick';
  return 'quick';
}

function parseAssistantPayload(text: string, fallbackModules: string[]): z.infer<typeof AssistantPayloadSchema> {
  const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}$/);
  const candidate = match ? match[0] : cleaned;

  try {
    const parsed = JSON.parse(candidate) as unknown;
    const result = AssistantPayloadSchema.safeParse(parsed);
    if (result.success) {
      return {
        ...result.data,
        follow_up_questions: result.data.follow_up_questions.slice(0, 3),
        referenced_modules: unique(result.data.referenced_modules.map(sanitizeModuleName)).slice(0, 4),
      };
    }
  } catch {
    // fallback below
  }

  const lines = cleaned.split('\n').map(line => line.trim()).filter(Boolean);
  const followUps = lines
    .filter(line => /^[-*]/.test(line) && /\?$/.test(line))
    .map(line => line.replace(/^[-*]\s*/, ''))
    .slice(0, 2);

  return {
    answer: cleaned || 'I could not generate a reliable answer for that question.',
    follow_up_questions: followUps.length > 0
      ? followUps
      : [
        'Which module should we inspect first for this?',
        'What is the biggest business risk in this area?',
      ],
    referenced_modules: fallbackModules,
    certainty: 'medium',
  };
}

export async function chat(
  projectId: string,
  analysisId: string,
  message: string,
  elementContext?: ElementContext,
  founderMode: boolean = false
): Promise<ChatResponse> {
  const analysis = await getAnalysisById(analysisId);
  if (!analysis) {
    throw new Error('Analysis not found');
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  const repoPath = getProjectRepoPath(projectId);
  if (!fs.existsSync(repoPath)) {
    let downloadResult = await downloadRepository(project.github_url, project.github_token, projectId);
    if (!downloadResult.success) {
      downloadResult = await cloneRepository(project.github_url, project.github_token, projectId);
    }
    if (!downloadResult.success) {
      console.warn('Repository unavailable for Q&A code search:', downloadResult.error);
    }
  }

  const context: ChatContext = {
    summary: analysis.summary,
    architecture: analysis.architecture,
    findings: analysis.findings,
    repoPath: fs.existsSync(repoPath) ? repoPath : null,
  };

  const responseType = determineResponseType(message);
  const history = await getChatHistory(analysisId);
  const starterQuestions = buildStarterQuestions(analysis);
  const fallbackModules = selectRelevantModules(message, context.architecture);

  let liveRepoContext = '';
  if (context.repoPath) {
    try {
      const latestContext = await buildLatestRepoContext(context.repoPath, message, context.architecture);
      liveRepoContext = latestContext ? `\n\n${latestContext}` : '';
    } catch (error) {
      console.warn(
        'Failed to build live repository context for chat:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  const contextHint = elementContext
    ? `\nCurrent focus element:\n- Component: ${elementContext.component || 'unknown'}\n- File: ${elementContext.file || 'unknown'}\n- Line: ${elementContext.line || 'unknown'}\n- Selector: ${elementContext.selector || 'unknown'}`
    : '';

  const systemPrompt = founderMode
    ? `You are explaining a software product to a non-technical Product Manager or founder.

Rules:
- NEVER use technical terms: no file names, no function names, no framework names, no code paths.
- Explain everything using business analogies and plain English. Pretend you are explaining to someone who has never coded.
- Focus on WHAT the system does for the user and WHY it matters, not HOW it works technically.
- Use analogies (e.g. "like a filing cabinet", "like a conveyor belt") to make concepts tangible.
- Keep answer to 2-3 short paragraphs max.
- Suggest 2-3 plain-English follow-up questions a PM would ask.
- If uncertain, say so simply.
- Return JSON only in this format:
{
  "answer": "...",
  "follow_up_questions": ["..."],
  "referenced_modules": ["module-id"],
  "certainty": "high|medium|low"
}

Project summary:\n${context.summary}

Modules (use names only, do not mention technical details):\n${(context.architecture.nodes || []).slice(0, 40).map(node => `- ${node.name}: ${node.description || ''}`).join('\n')}
${contextHint}${liveRepoContext}
${responseType === 'quick' ? '\nBe concise and punchy.' : '\nBe thorough but always jargon-free.'}`
    : `You are a senior software engineer doing a deep technical review of a codebase with a colleague.

Rules:
- Be precise and technical. Use real file names, module names, function names, and patterns where relevant.
- Discuss architecture decisions, data flow, dependencies, trade-offs, and implementation details.
- Point out code quality issues, potential bugs, or scalability concerns when relevant.
- Be direct and opinionated — this is a peer engineering discussion, not a presentation.
- Keep answer focused: 2-4 paragraphs or use bullet points for clarity.
- Suggest 2-3 follow-up engineering questions to dig deeper.
- If uncertain about specifics, say so.
- Return JSON only in this format:
{
  "answer": "...",
  "follow_up_questions": ["..."],
  "referenced_modules": ["module-id"],
  "certainty": "high|medium|low"
}

Project summary:\n${context.summary}

Architecture modules:\n${(context.architecture.nodes || []).slice(0, 40).map(node => `- ${node.id}: ${node.name} (${node.type}) — ${node.description || ''}`).join('\n')}

Risk highlights:\n${(context.findings || []).slice(0, 8).map(finding => `- ${finding.severity.toUpperCase()}: ${finding.title}`).join('\n')}
${contextHint}${liveRepoContext}
${responseType === 'quick' ? '\nPrioritize concise directness.' : '\nPrioritize depth, trade-offs, and implementation specifics.'}`;


  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.slice(-8).map(item => ({ role: item.role, content: item.content })),
    { role: 'user', content: message },
  ];

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: responseType === 'quick' ? 700 : 1200,
    system: systemPrompt,
    messages,
  });

  const textBlocks = response.content.filter(block => block.type === 'text');
  const joinedText = textBlocks.map(block => block.text).join('\n').trim();
  const payload = parseAssistantPayload(joinedText, fallbackModules);

  const chatResponse: ChatResponse = {
    id: uuidv4(),
    content: payload.answer,
    responseType,
    timestamp: new Date().toISOString(),
    followUps: payload.follow_up_questions.slice(0, 3),
    referencedModules: unique(payload.referenced_modules).slice(0, 4),
    starterQuestions,
  };

  const userMessage: ChatMessage = {
    id: uuidv4(),
    role: 'user',
    content: message,
    timestamp: new Date().toISOString(),
    responseType: 'quick',
  };

  const assistantChatMessage: ChatMessage = {
    id: chatResponse.id,
    role: 'assistant',
    content: chatResponse.content,
    timestamp: chatResponse.timestamp,
    responseType,
    followUps: chatResponse.followUps,
    referencedModules: chatResponse.referencedModules,
  };

  await updateChatHistory(analysisId, [...history, userMessage, assistantChatMessage]);
  return chatResponse;
}

export async function getAnalysisChatHistory(analysisId: string): Promise<ChatMessage[]> {
  return getChatHistory(analysisId);
}

export async function getStarterQuestionsForAnalysis(analysisId: string): Promise<string[]> {
  const analysis = await getAnalysisById(analysisId);
  if (!analysis) return DEFAULT_STARTER_QUESTIONS;
  const generated = buildStarterQuestions(analysis);
  return generated.length > 0 ? generated : DEFAULT_STARTER_QUESTIONS;
}
