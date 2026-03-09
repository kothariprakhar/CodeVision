// ABOUTME: Claude AI integration service for analyzing code against requirements.
// ABOUTME: Sends code files and requirement documents to Claude and parses the structured response.
import Anthropic from '@anthropic-ai/sdk';
import { Finding, ArchitectureVisualization } from '../db';
import { ParsedDocument } from './file-parser';
import fs from 'fs';
import path from 'path';

const client = new Anthropic();

export interface AnalysisInput {
  documents: ParsedDocument[];
  codeFiles: { path: string; content: string }[];
}

export interface AnalysisOutput {
  summary: string;
  findings: Finding[];
  architecture: ArchitectureVisualization;
  raw_response: string;
}

export async function analyzeCodeAlignment(input: AnalysisInput): Promise<AnalysisOutput> {
  // Build the requirements context
  const requirementsContext = input.documents
    .filter(doc => doc.type !== 'image')
    .map(doc => `### ${doc.filename}\n\n${doc.content}`)
    .join('\n\n---\n\n');

  // Build the code context (limit to first 50 files, ~30KB total to stay under token limits)
  let codeContext = '';
  let totalSize = 0;
  const maxSize = 30000; // 30KB limit (~7500 tokens)

  for (const file of input.codeFiles) {
    const fileContent = `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
    if (totalSize + fileContent.length > maxSize) break;
    codeContext += fileContent;
    totalSize += fileContent.length;
  }

  // Prepare image documents for Claude
  const imageContents: Anthropic.ImageBlockParam[] = input.documents
    .filter(doc => doc.type === 'image')
    .map(doc => {
      const [, base64Data] = doc.content.split(',');
      const mediaType = doc.content.split(';')[0].split(':')[1] as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      return {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: mediaType,
          data: base64Data,
        },
      };
    });

  const systemPrompt = `You are a code quality analyst helping non-technical stakeholders understand if their software requirements have been properly implemented.

Your task is to analyze the provided requirements documents (PRDs, BRDs, wireframes, etc.) and compare them against the actual codebase to:
1. Identify GAPS: Features or requirements mentioned in documents that are NOT implemented in code
2. Identify FIDELITY ISSUES: Features that ARE implemented but don't match the specifications
3. Map the ARCHITECTURE: Identify 5-12 high-level business modules. Use names a product manager or investor would recognise (e.g. "Authentication", "Analysis Engine", "GitHub Integration") — NOT code artifact names like "analyzeCodeAlignment" or "route.ts". Write each description in plain language that a non-technical stakeholder can understand without any coding knowledge.

4. Describe the DATA FLOW: Narrate 3-6 steps showing how a typical user action flows through the system to produce a result. Write for a non-technical reader — describe WHAT happens, not HOW.

Prioritize findings by business impact, not technical complexity. Use plain language that non-technical people can understand.

Respond with a JSON object in this exact format:
{
  "summary": "2-3 paragraph executive summary in plain language",
  "findings": [
    {
      "type": "gap" or "fidelity",
      "severity": "critical" or "high" or "medium" or "low",
      "title": "Short descriptive title",
      "description": "Plain language explanation of the issue and its business impact",
      "evidence": ["Array of specific references from requirements or code"]
    }
  ],
  "architecture": {
    "nodes": [
      {
        "id": "unique-id",
        "name": "Component Name",
        "type": "ui" or "api" or "service" or "database" or "external" or "component",
        "complexity": "low" or "medium" or "high",
        "description": "What this component does",
        "files": ["list of main files in this component"]
      }
    ],
    "edges": [
      {
        "from": "source-node-id",
        "to": "target-node-id",
        "type": "imports" or "calls" or "stores" or "renders"
      }
    ],
    "dataFlow": [
      {
        "step": 1,
        "label": "Short label, 3-6 words",
        "description": "One plain-English sentence for a non-technical reader",
        "nodeIds": ["node-id-1", "node-id-2"]
      }
    ]
  }
}

Architecture analysis guide:
- Aim for 5-12 nodes total. Merge closely related files into one meaningful module rather than listing every file separately.
- Node names must be business-friendly: "Authentication" not "auth.ts", "Analysis Engine" not "analyzeCodeAlignment"
- Node descriptions must be non-technical: a product manager should understand them without any coding background
- Node types: ui (anything the user sees), api (request handlers/routes), service (business logic), database (data storage), external (third-party APIs/services), component (shared utility modules)
- Complexity: low = simple/few dependencies, medium = moderate logic, high = many dependencies and critical to the system
- Edges represent runtime dependencies between modules
- dataFlow steps should narrate a story: "User submits form → API validates request → Service processes data → Results stored"
- dataFlow nodeIds must reference valid ids from the nodes array above

Severity guide for findings:
- critical: Core functionality missing, project cannot launch
- high: Important feature missing or broken, significant user impact
- medium: Feature partially implemented or minor spec deviation
- low: Nice-to-have missing or cosmetic mismatch`;

  const userMessage = `## REQUIREMENTS DOCUMENTS

${requirementsContext}

## CODE FILES

${codeContext}

Please analyze how well this codebase implements the requirements specified in the documents above. Identify gaps and fidelity issues, prioritized by business impact.`;

  const messageContent: Anthropic.MessageParam['content'] = [
    ...imageContents,
    { type: 'text', text: userMessage },
  ];

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: messageContent,
      },
    ],
  });

  const rawResponse = JSON.stringify(response, null, 2);

  // Extract text content from response
  const textContent = response.content.find(block => block.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  // Parse the JSON response
  let jsonText = textContent.text;

  // Remove markdown code fences if present
  jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Find the JSON object
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response');
  }

  let parsed;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    // Try to fix common JSON issues
    let fixedJson = jsonMatch[0];

    // Fix unescaped quotes in strings (common Claude issue)
    fixedJson = fixedJson.replace(/:\s*"([^"]*?)(?<!\\)"([^"]*?)"/g, (match, p1, p2) => {
      if (p2 && !p2.startsWith(',') && !p2.startsWith('}') && !p2.startsWith(']')) {
        return `: "${p1}\\"${p2}"`;
      }
      return match;
    });

    try {
      parsed = JSON.parse(fixedJson);
    } catch {
      // Log the problematic JSON for debugging
      console.error('Failed to parse JSON:', jsonMatch[0].substring(0, 500));
      throw new Error(`Failed to parse Claude response as JSON: ${parseError}`);
    }
  }

  // Ensure architecture has proper defaults if not provided
  const architecture: ArchitectureVisualization = parsed.architecture || { nodes: [], edges: [] };

  return {
    summary: parsed.summary,
    findings: parsed.findings,
    architecture,
    raw_response: rawResponse,
  };
}

export function readCodeFile(repoPath: string, filePath: string): string {
  const fullPath = path.join(repoPath, filePath);
  try {
    const content = fs.readFileSync(fullPath, 'utf-8');
    // Truncate very long files
    if (content.length > 10000) {
      return content.substring(0, 10000) + '\n... (truncated)';
    }
    return content;
  } catch {
    return '// Could not read file';
  }
}
