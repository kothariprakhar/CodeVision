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

const anthropic = new Anthropic();

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

async function searchCodeFiles(repoPath: string, query: string): Promise<string[]> {
  const results: string[] = [];
  const searchTerms = extractKeywords(query);

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const ignoreDirs = ['node_modules', '.git', 'dist', 'build', '.next'];
        if (!ignoreDirs.includes(entry.name)) {
          walkDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.rb', '.rs'];

        if (codeExtensions.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lowerContent = content.toLowerCase();
            if (searchTerms.some(term => lowerContent.includes(term))) {
              const relativePath = path.relative(repoPath, fullPath);
              const lines = content.split('\n').slice(0, 220).join('\n');
              results.push(`File: ${relativePath}\n\`\`\`\n${lines}\n\`\`\``);
            }
          } catch {
            // skip unreadable files
          }
        }
      }
    }
  }

  walkDir(repoPath);
  return results.slice(0, 4);
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
  elementContext?: ElementContext
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

  let codeContext = '';
  if (context.repoPath) {
    const codeResults = await searchCodeFiles(context.repoPath, message);
    if (codeResults.length > 0) {
      codeContext = `\n\nRelevant code snippets:\n${codeResults.join('\n\n')}`;
    }
  }

  const contextHint = elementContext
    ? `\nCurrent focus element:\n- Component: ${elementContext.component || 'unknown'}\n- File: ${elementContext.file || 'unknown'}\n- Line: ${elementContext.line || 'unknown'}\n- Selector: ${elementContext.selector || 'unknown'}`
    : '';

  const systemPrompt = `You are a senior engineer explaining a codebase to a non-technical founder.

Rules:
- Keep answer to 2-3 short paragraphs max.
- Use business-friendly language and practical analogies.
- Mention module names when relevant.
- If uncertain, say so explicitly.
- Suggest 2-3 follow-up questions.
- Return JSON only in this format:
{
  "answer": "...",
  "follow_up_questions": ["..."],
  "referenced_modules": ["module-id"],
  "certainty": "high|medium|low"
}

Project summary:\n${context.summary}

Architecture modules:\n${(context.architecture.nodes || []).slice(0, 40).map(node => `- ${node.id}: ${node.name} (${node.type})`).join('\n')}

Risk highlights:\n${(context.findings || []).slice(0, 8).map(finding => `- ${finding.severity.toUpperCase()}: ${finding.title}`).join('\n')}

Starter questions:\n${starterQuestions.map(question => `- ${question}`).join('\n')}
${contextHint}${codeContext}
${responseType === 'quick' ? '\nPrioritize concise directness.' : '\nPrioritize strategic depth and trade-offs.'}`;

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
