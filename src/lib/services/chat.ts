import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { getAnalysisById, getChatHistory, updateChatHistory } from '../repositories/analysis';
import { getProject } from '../repositories/projects';
import { ChatMessage, ArchitectureVisualization, Finding } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { getProjectRepoPath, downloadRepository, cloneRepository } from './github';

const anthropic = new Anthropic();

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
}

async function searchCodeFiles(repoPath: string, query: string): Promise<string[]> {
  const results: string[] = [];
  const searchTerms = query.toLowerCase().split(' ').filter(t => t.length > 2);

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
        const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];

        if (codeExtensions.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lowerContent = content.toLowerCase();

            if (searchTerms.some(term => lowerContent.includes(term))) {
              const relativePath = path.relative(repoPath, fullPath);
              // Limit content to first 500 lines
              const lines = content.split('\n').slice(0, 500).join('\n');
              results.push(`File: ${relativePath}\n\`\`\`\n${lines}\n\`\`\``);
            }
          } catch (e) {
            // Skip unreadable files
          }
        }
      }
    }
  }

  walkDir(repoPath);
  return results.slice(0, 5); // Limit to 5 most relevant files
}

function determineResponseType(question: string): 'quick' | 'detailed' {
  const quickPatterns = [
    /where is/i,
    /which file/i,
    /what does .* do/i,
    /how many/i,
    /list the/i,
    /show me/i,
  ];

  const detailedPatterns = [
    /how should i/i,
    /how would i/i,
    /how can i/i,
    /implement/i,
    /best practice/i,
    /architecture/i,
    /design/i,
  ];

  if (detailedPatterns.some(p => p.test(question))) {
    return 'detailed';
  }
  if (quickPatterns.some(p => p.test(question))) {
    return 'quick';
  }
  return 'quick';
}

export async function chat(
  projectId: string,
  analysisId: string,
  message: string
): Promise<ChatResponse> {
  // Get analysis context
  const analysis = await getAnalysisById(analysisId);
  if (!analysis) {
    throw new Error('Analysis not found');
  }

  const project = await getProject(projectId);
  if (!project) {
    throw new Error('Project not found');
  }

  // Get repo path and ensure it exists (on-demand cloning)
  const repoPath = getProjectRepoPath(projectId);

  if (!fs.existsSync(repoPath)) {
    // Download repository if not present (try GitHub API first, then git clone)
    let downloadResult = await downloadRepository(
      project.github_url,
      project.github_token,
      projectId
    );

    // Fallback to git clone if download fails
    if (!downloadResult.success) {
      console.log('GitHub API download failed, trying git clone:', downloadResult.error);
      downloadResult = await cloneRepository(
        project.github_url,
        project.github_token,
        projectId
      );
    }

    if (!downloadResult.success) {
      // Proceed without code context if download fails
      console.warn('Failed to download repository for chat context:', downloadResult.error);
    }
  }

  const context: ChatContext = {
    summary: analysis.summary,
    architecture: analysis.architecture,
    findings: analysis.findings,
    repoPath: fs.existsSync(repoPath) ? repoPath : null,
  };

  // Get chat history
  const history = await getChatHistory(analysisId);

  // Determine response type
  const responseType = determineResponseType(message);

  // Search code if repo is available
  let codeContext = '';
  if (context.repoPath && fs.existsSync(context.repoPath)) {
    const codeResults = await searchCodeFiles(context.repoPath, message);
    if (codeResults.length > 0) {
      codeContext = '\n\nRelevant code files:\n' + codeResults.join('\n\n');
    }
  }

  // Build system prompt
  const systemPrompt = `You are a helpful assistant for developers onboarding to a codebase.

Analysis Summary:
${context.summary}

Architecture Components:
${context.architecture.nodes.map(n => `- ${n.name} (${n.type}): ${n.description}`).join('\n')}

${responseType === 'quick'
  ? 'Provide a concise, direct answer. Be specific about file names and locations.'
  : 'Provide a thorough explanation. If the question involves implementation, suggest they explore specific areas but note this is for understanding, not direct coding assistance.'}

${codeContext}`;

  // Build messages
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: responseType === 'quick' ? 500 : 1500,
    system: systemPrompt,
    messages,
  });

  const assistantMessage = response.content[0].type === 'text'
    ? response.content[0].text
    : '';

  // Create response
  const chatResponse: ChatResponse = {
    id: uuidv4(),
    content: assistantMessage,
    responseType,
    timestamp: new Date().toISOString(),
  };

  // Save to history
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
    content: assistantMessage,
    timestamp: chatResponse.timestamp,
    responseType,
  };

  await updateChatHistory(analysisId, [...history, userMessage, assistantChatMessage]);

  return chatResponse;
}

export async function getAnalysisChatHistory(analysisId: string): Promise<ChatMessage[]> {
  return await getChatHistory(analysisId);
}
