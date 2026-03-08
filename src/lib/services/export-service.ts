import type { AnalysisResult } from '@/lib/db';
import { buildBusinessFlows, buildRiskView, buildTechStackView } from './analysis-views';

function escPdfText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function chunkLines(value: string, maxLineLength = 92): string[] {
  const words = value.replace(/\s+/g, ' ').trim().split(' ');
  const lines: string[] = [];
  let current = '';
  words.forEach(word => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxLineLength) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function sectionHeader(title: string): string[] {
  return [title, ''.padEnd(Math.max(8, title.length), '-')];
}

function buildReportLines(analysis: AnalysisResult): string[] {
  const risks = buildRiskView(analysis);
  const tech = buildTechStackView(analysis);
  const flows = buildBusinessFlows(analysis);
  const nodes = analysis.architecture?.nodes || [];
  const edges = analysis.architecture?.edges || [];

  const lines: string[] = [];
  lines.push('CodeVision - Executive Technical Overview');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Analysis ID: ${analysis.id}`);
  lines.push('');

  lines.push(...sectionHeader('1) Executive Summary'));
  lines.push(...chunkLines(analysis.summary || 'No summary available.'));
  lines.push('');

  lines.push(...sectionHeader('2) Architecture Overview'));
  lines.push(`- Components detected: ${nodes.length}`);
  lines.push(`- Connections detected: ${edges.length}`);
  lines.push(`- Architecture pattern: ${tech.architecture_pattern.label}`);
  lines.push(`- Pattern rationale: ${tech.architecture_pattern.explanation}`);
  lines.push('');

  lines.push(...sectionHeader('3) Technology Stack'));
  lines.push(`- Languages: ${tech.languages.map(item => `${item.language} (${item.percentage}%)`).join(', ') || 'N/A'}`);
  lines.push(`- Frameworks/tooling: ${tech.frameworks.map(item => item.name).join(', ') || 'N/A'}`);
  lines.push(`- Infrastructure: ${tech.infrastructure.map(item => item.name).join(', ') || 'N/A'}`);
  lines.push(`- External services: ${tech.external_services.map(item => item.name).join(', ') || 'N/A'}`);
  lines.push(`- Complexity score: ${tech.complexity_score.toFixed(1)}/10`);
  lines.push('');

  lines.push(...sectionHeader('4) Key Business Flows'));
  if (flows.length === 0) {
    lines.push('- No high-confidence business flow data available.');
  } else {
    flows.slice(0, 3).forEach((flow, idx) => {
      lines.push(`${idx + 1}. ${flow.title}`);
      lines.push(`   Trigger: ${flow.trigger}`);
      lines.push(`   Outcome: ${flow.outcome}`);
    });
  }
  lines.push('');

  lines.push(...sectionHeader('5) Risk Assessment'));
  lines.push(`- Critical: ${risks.totals.critical}`);
  lines.push(`- High: ${risks.totals.high}`);
  lines.push(`- Medium: ${risks.totals.medium}`);
  lines.push(`- Low: ${risks.totals.low}`);
  lines.push(`- Estimated remediation effort: ${risks.estimated_remediation_days} days`);
  lines.push(`- Estimated remediation cost: $${risks.estimated_remediation_cost_usd.toLocaleString()}`);
  risks.risks.slice(0, 8).forEach((risk, idx) => {
    lines.push(`  [${idx + 1}] ${risk.severity.toUpperCase()} - ${risk.title}`);
    lines.push(`      ${risk.impact}`);
  });
  lines.push('');

  lines.push(...sectionHeader('6) Appendix - Module Inventory'));
  nodes.slice(0, 18).forEach(node => {
    lines.push(`- ${node.name} (${node.type})`);
  });

  return lines;
}

export function generatePdfBufferFromAnalysis(analysis: AnalysisResult): Buffer {
  const lines = buildReportLines(analysis).slice(0, 240);

  let y = 790;
  const lineHeight = 13;
  const chunks: string[] = ['BT /F1 10 Tf'];

  lines.forEach(line => {
    if (y < 40) return;
    const escaped = escPdfText(line);
    chunks.push(`1 0 0 1 40 ${y} Tm (${escaped}) Tj`);
    y -= lineHeight;
  });
  chunks.push('ET');

  const stream = chunks.join('\n');
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  objects.forEach(obj => {
    offsets.push(pdf.length);
    pdf += `${obj}\n`;
  });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach(offset => {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`;

  return Buffer.from(pdf, 'utf-8');
}

export function generateSlidesMarkdownFromAnalysis(analysis: AnalysisResult): string {
  const tech = buildTechStackView(analysis);
  const risks = buildRiskView(analysis);
  const flows = buildBusinessFlows(analysis);
  const nodes = analysis.architecture?.nodes || [];
  const edges = analysis.architecture?.edges || [];

  const slides: string[] = [];
  slides.push(`# ${analysis.project_id} - Technical Overview`);
  slides.push(`Generated: ${new Date().toISOString()}`);

  slides.push('\n---\n');
  slides.push('## 1. What This Product Does');
  slides.push(analysis.summary || 'No summary available.');

  slides.push('\n---\n');
  slides.push('## 2. Architecture Snapshot');
  slides.push(`- Components: ${nodes.length}`);
  slides.push(`- Connections: ${edges.length}`);
  slides.push(`- Pattern: ${tech.architecture_pattern.label}`);
  slides.push(`- Pattern rationale: ${tech.architecture_pattern.explanation}`);

  slides.push('\n---\n');
  slides.push('## 3. Tech Stack Grid');
  slides.push(`- Languages: ${tech.languages.map(item => item.language).join(', ') || 'N/A'}`);
  slides.push(`- Frameworks: ${tech.frameworks.map(item => item.name).join(', ') || 'N/A'}`);
  slides.push(`- Infrastructure: ${tech.infrastructure.map(item => item.name).join(', ') || 'N/A'}`);
  slides.push(`- External services: ${tech.external_services.map(item => item.name).join(', ') || 'N/A'}`);
  slides.push(`- Complexity score: ${tech.complexity_score.toFixed(1)}/10`);

  slides.push('\n---\n');
  slides.push('## 4. Key User Flows');
  if (flows.length === 0) {
    slides.push('- No high-confidence user flow data available.');
  } else {
    flows.slice(0, 3).forEach(flow => {
      slides.push(`- ${flow.title}`);
      slides.push(`  - Trigger: ${flow.trigger}`);
      slides.push(`  - Outcome: ${flow.outcome}`);
    });
  }

  slides.push('\n---\n');
  slides.push('## 5. Risk Summary');
  slides.push(`- Critical: ${risks.totals.critical}`);
  slides.push(`- High: ${risks.totals.high}`);
  slides.push(`- Medium: ${risks.totals.medium}`);
  slides.push(`- Low: ${risks.totals.low}`);
  risks.risks.slice(0, 5).forEach(risk => {
    slides.push(`- [${risk.severity.toUpperCase()}] ${risk.title}`);
  });

  slides.push('\n---\n');
  slides.push('## 6. Complexity & Team Estimate');
  slides.push(`- Complexity score: ${tech.complexity_score.toFixed(1)}/10`);
  slides.push(`- Estimated remediation effort: ${risks.estimated_remediation_days} days`);
  slides.push(`- Estimated remediation cost: $${risks.estimated_remediation_cost_usd.toLocaleString()}`);

  slides.push('\n---\n');
  slides.push('## 7. Appendix / Q&A Prompts');
  tech.what_this_means.slice(0, 5).forEach(item => {
    slides.push(`- ${item.technology}: ${item.explanation}`);
  });

  return slides.join('\n');
}
