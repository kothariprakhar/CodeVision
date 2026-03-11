import type { AnalysisResult } from '@/lib/db';
import {
  buildRiskSnapshot,
  buildTechStackSnapshot,
} from './tech-risk-engine';
import { normalizeDiagramText, sanitizeDiagramText } from '@/lib/utils/text-quality';

export interface DiagramNodeView {
  id: string;
  label: string;
  type: 'service' | 'database' | 'external' | 'queue';
  domain: string;
  description: string;
  files: string[];
}

export interface DiagramEdgeView {
  source: string;
  target: string;
  type: 'data_flow' | 'reads_from' | 'triggers';
  label: string;
  data_flow?: string;
  trigger?: string;
}

export interface BusinessFlow {
  id: string;
  title: string;
  trigger: string;
  steps: Array<{
    order: number;
    icon: string;
    actor: string;
    action: string;
    detail: string;
    data_passed?: string;
    moduleId: string;
    domain: string;
  }>;
  outcome: string;
  involvedModules: string[];
}

function normalize(value: string): string {
  return value.toLowerCase();
}

function inferDomain(text: string): DiagramNodeView['domain'] {
  const lower = normalize(text);
  if (/(auth|login|signup|session|permission|identity)/.test(lower)) return 'auth';
  if (/(db|data|model|schema|storage|warehouse|cache)/.test(lower)) return 'data';
  if (/(payment|billing|invoice|checkout|subscription|pricing)/.test(lower)) return 'payments';
  if (/(message|email|sms|notification|chat|webhook|comms)/.test(lower)) return 'comms';
  if (/(infra|deployment|ops|k8s|docker|queue|worker|scheduler)/.test(lower)) return 'infra';
  return 'core';
}

function normalizeModuleKey(value: string): string {
  return value.toLowerCase().trim();
}

function getArchitectureDomainLookup(analysis: AnalysisResult): {
  byModule: Map<string, string>;
} {
  const domains = analysis.business_context?.architecture_domains || [];
  const byModule = new Map<string, string>();

  domains.forEach((domain) => {
    domain.modules.forEach((moduleName) => {
      const key = normalizeModuleKey(moduleName);
      if (key) byModule.set(key, domain.name);
    });
  });

  return { byModule };
}

function mapNodeType(type: string, name: string): DiagramNodeView['type'] {
  const joined = `${type} ${name}`.toLowerCase();
  if (/(database|db|storage|redis|postgres|mysql|mongo)/.test(joined)) return 'database';
  if (/(external|third|stripe|twilio|slack|s3|sns|sqs)/.test(joined)) return 'external';
  if (/(queue|worker|job|celery|bull|sidekiq)/.test(joined)) return 'queue';
  return 'service';
}

function mapEdgeType(type: string, label: string): DiagramEdgeView['type'] {
  const joined = `${type} ${label}`.toLowerCase();
  if (/(store|read|database|query)/.test(joined)) return 'reads_from';
  if (/(trigger|event|schedule|queue|async)/.test(joined)) return 'triggers';
  return 'data_flow';
}

export function buildDiagramView(analysis: AnalysisResult): { nodes: DiagramNodeView[]; edges: DiagramEdgeView[] } {
  const domainLookup = getArchitectureDomainLookup(analysis);

  const nodes: DiagramNodeView[] = (analysis.architecture?.nodes || []).map(node => {
    const domain = domainLookup.byModule.get(normalizeModuleKey(node.id))
      || domainLookup.byModule.get(normalizeModuleKey(node.name))
      || inferDomain(`${node.name} ${node.description} ${(node.files || []).join(' ')}`);
    return {
      id: node.id,
      label: sanitizeDiagramText(node.name, 'node_label', { target: node.name }),
      type: mapNodeType(node.type, node.name),
      domain,
      description: sanitizeDiagramText(
        node.description || '',
        'node_description',
        { target: node.name }
      ),
      files: node.files || [],
    };
  });

  const nodeMap = new Set(nodes.map(node => node.id));
  const edges: DiagramEdgeView[] = (analysis.architecture?.edges || [])
    .filter(edge => nodeMap.has(edge.from) && nodeMap.has(edge.to))
    .map(edge => ({
      source: edge.from,
      target: edge.to,
      type: mapEdgeType(edge.type, edge.label || edge.type),
      label: sanitizeDiagramText(
        edge.label || (edge.type === 'stores'
          ? 'reads/writes data'
          : edge.type === 'calls'
            ? 'triggers action'
            : edge.type === 'renders'
              ? 'renders view'
              : 'sends data to'),
        'edge_label',
        {
          relation: edge.type,
          source: edge.from,
          target: edge.to.replace(/^external:/, ''),
        }
      ),
      data_flow: edge.data_flow ? normalizeDiagramText(edge.data_flow) : edge.data_flow,
      trigger: edge.trigger ? normalizeDiagramText(edge.trigger) : edge.trigger,
    }));

  return { nodes, edges };
}

export function buildBusinessFlows(analysis: AnalysisResult): BusinessFlow[] {
  const journeyGraph = analysis.journey_graph;
  if (!journeyGraph || !journeyGraph.journeys?.length) {
    return [];
  }

  let pass3Journeys: Array<{ title?: string; steps?: Array<{ data_passed?: string }> }> = [];
  try {
    const parsed = JSON.parse(analysis.raw_response) as Record<string, unknown>;
    const pass3 = parsed.pass3 as Record<string, unknown> | undefined;
    const rawJourneys = pass3?.user_journeys;
    if (Array.isArray(rawJourneys)) {
      pass3Journeys = rawJourneys as Array<{ title?: string; steps?: Array<{ data_passed?: string }> }>;
    }
  } catch {
    pass3Journeys = [];
  }

  const domainLookup = getArchitectureDomainLookup(analysis);
  const nodeDomains = new Map(
    (analysis.architecture?.nodes || []).map(node => [
      node.id,
      domainLookup.byModule.get(normalizeModuleKey(node.id))
      || domainLookup.byModule.get(normalizeModuleKey(node.name))
      || inferDomain(`${node.name} ${node.description} ${(node.files || []).join(' ')}`),
    ])
  );

  return journeyGraph.journeys.slice(0, 5).map((journey, journeyIndex) => {
    const matchingPass3Journey = pass3Journeys[journeyIndex];
    const steps = journey.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((step, stepIndex) => {
        const moduleId = step.systems_touched[0] || step.id;
        const domain = nodeDomains.get(moduleId)
          || domainLookup.byModule.get(normalizeModuleKey(moduleId))
          || inferDomain(`${moduleId} ${step.name} ${step.description}`);
        const dataPassed = typeof (step as { data_passed?: unknown }).data_passed === 'string'
          ? (step as { data_passed?: string }).data_passed
          : matchingPass3Journey?.steps?.[stepIndex]?.data_passed || '';
        return {
          order: step.order,
          icon: step.step_type === 'payment'
            ? 'credit-card'
            : step.step_type === 'validation'
              ? 'shield-check'
              : step.step_type === 'notification'
                ? 'bell'
                : step.step_type === 'system'
                  ? 'cog-6-tooth'
                  : step.step_type === 'exit'
                    ? 'check-circle'
                    : 'sparkles',
          actor: step.step_type === 'entry' ? 'The user' : 'The system',
          action: step.name,
          detail: step.description || step.business_outcome || '',
          data_passed: dataPassed,
          moduleId,
          domain,
        };
      });

    return {
      id: journey.id,
      title: journey.name,
      trigger: `When ${journey.persona} tries to ${journey.goal.toLowerCase()}`,
      steps,
      outcome: journey.steps[journey.steps.length - 1]?.business_outcome || journey.kpi,
      involvedModules: Array.from(new Set(journey.steps.flatMap(step => step.systems_touched))).slice(0, 10),
    };
  });
}

export function buildTechStackView(analysis: AnalysisResult): {
  languages: Array<{ language: string; file_count: number; percentage: number }>;
  frameworks: Array<{ name: string; category: string; evidence: string[]; founder_note: string }>;
  infrastructure: Array<{ name: string; category: string; evidence: string[]; founder_note: string }>;
  external_services: Array<{ name: string; category: string; evidence: string[]; founder_note: string }>;
  architecture_pattern: { label: string; explanation: string };
  complexity_score: number;
  complexity_factors: Array<{ label: string; value: number; weight: number; weighted_score: number }>;
  what_this_means: Array<{ technology: string; explanation: string }>;
  primary_technologies: string[];
  module_technologies: Array<{ module: string; technologies: string[] }>;
  inferred_platforms: string[];
  technology_choices: string[];
  data_usage: Array<{
    data_type: string;
    collected_from: string;
    used_for: string;
    stored_in: string;
  }>;
  external_deps: Array<{
    name: string;
    why_needed: string;
    what_breaks_without_it: string;
  }>;
  scale_assessment: string | null;
} {
  const snapshot = buildTechStackSnapshot(analysis);

  let moduleSummaries: Record<string, { key_technologies?: string[] }> = {};
  try {
    const parsed = JSON.parse(analysis.raw_response) as Record<string, unknown>;
    const pass1 = parsed.pass1 as Record<string, unknown> | undefined;
    const summaries = pass1?.module_summaries;
    if (summaries && typeof summaries === 'object' && !Array.isArray(summaries)) {
      moduleSummaries = summaries as Record<string, { key_technologies?: string[] }>;
    }
  } catch {
    moduleSummaries = {};
  }
  const moduleEntries = Object.entries(moduleSummaries);

  const moduleTech = moduleEntries.map(([moduleName, summary]) => ({
    module: moduleName,
    technologies: (summary.key_technologies || []).slice(0, 8),
  }));

  const primary = Array.from(
    new Set([
      ...snapshot.frameworks.map(item => item.name),
      ...snapshot.infrastructure.map(item => item.name),
      ...snapshot.external_services.map(item => item.name),
      ...moduleTech.flatMap(entry => entry.technologies),
    ])
  ).slice(0, 24);
  const joined = `${analysis.summary} ${primary.join(' ')} ${(analysis.architecture?.nodes || []).map(n => n.name).join(' ')}`.toLowerCase();
  const inferredPlatforms = [
    /(next|react|frontend|ui)/.test(joined) ? 'Web Frontend' : null,
    /(fastapi|express|api|service|backend)/.test(joined) ? 'Backend API' : null,
    /(postgres|mysql|database|redis|mongo)/.test(joined) ? 'Data Layer' : null,
    /(queue|worker|celery|bull|job)/.test(joined) ? 'Asynchronous Processing' : null,
    /(stripe|twilio|aws|gcp|azure|external)/.test(joined) ? 'External Integrations' : null,
  ].filter((item): item is string => Boolean(item));

  return {
    languages: snapshot.languages,
    frameworks: snapshot.frameworks,
    infrastructure: snapshot.infrastructure,
    external_services: snapshot.external_services,
    architecture_pattern: snapshot.architecture_pattern,
    complexity_score: snapshot.complexity_score,
    complexity_factors: snapshot.complexity_factors,
    what_this_means: snapshot.what_this_means,
    primary_technologies: primary,
    module_technologies: moduleTech.slice(0, 40),
    inferred_platforms: inferredPlatforms,
    technology_choices: analysis.business_context?.founder_narrative?.technology_choices
      || analysis.business_context?.technical_narrative?.technology_choices
      || [],
    data_usage: analysis.business_context?.data_usage || [],
    external_deps: analysis.business_context?.external_deps || [],
    scale_assessment: analysis.business_context?.founder_narrative?.scale_assessment
      || analysis.business_context?.technical_narrative?.scale_assessment
      || null,
  };
}

export function buildRiskView(analysis: AnalysisResult): {
  summary: string;
  totals: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  estimated_remediation_days: number;
  estimated_remediation_cost_usd: number;
  checks_run: string[];
  risks: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    category: 'security' | 'reliability' | 'delivery' | 'maintainability' | 'operations';
    impact: string;
    why_it_matters: string;
    estimated_effort_days: number;
    remediation_cost_usd: number;
    evidence: string[];
    source: 'static' | 'ai';
  }>;
} {
  const snapshot = buildRiskSnapshot(analysis);

  return {
    summary: snapshot.summary,
    totals: snapshot.totals,
    estimated_remediation_days: snapshot.estimated_remediation_days,
    estimated_remediation_cost_usd: snapshot.estimated_remediation_cost_usd,
    checks_run: snapshot.checks_run,
    risks: snapshot.risks.map(risk => ({
      severity: risk.severity,
      title: risk.title,
      category: risk.category,
      impact: risk.business_impact,
      why_it_matters: risk.why_it_matters,
      estimated_effort_days: risk.estimated_effort_days,
      remediation_cost_usd: risk.remediation_cost_usd,
      evidence: risk.evidence,
      source: risk.source,
    })),
  };
}
