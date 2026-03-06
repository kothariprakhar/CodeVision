import { ArchitectureNode, ArchitectureVisualization, Finding } from '../db';
import { ParsedDocument } from './file-parser';
import {
  CapabilityGraph,
  CapabilityNode,
  EvidenceRef,
  Journey,
  JourneyGraph,
  JourneyStep,
  LensBundle,
  LensBundleSchema,
  LensRisk,
  QualityReport,
} from '../schemas/lenses';

interface CapabilityDefinition {
  id: string;
  name: string;
  domainId: string;
  description: string;
  businessValue: string;
  ownerRole: string;
  kpis: string[];
  keywords: string[];
}

interface CapabilityDomain {
  id: string;
  name: string;
  description: string;
}

interface LensGenerationInput {
  architecture: ArchitectureVisualization | null | undefined;
  findings: Finding[];
  documents?: ParsedDocument[];
  projectName?: string;
}

interface NodeCapabilityMatch {
  capabilityId: string;
  confidence: number;
  matchedKeywords: string[];
}

const CAPABILITY_DOMAINS: CapabilityDomain[] = [
  {
    id: 'customer-experience',
    name: 'Customer Experience',
    description: 'User-facing capabilities that drive activation and product adoption.',
  },
  {
    id: 'revenue-growth',
    name: 'Revenue & Growth',
    description: 'Capabilities tied to conversion, monetization, and retention.',
  },
  {
    id: 'platform-operations',
    name: 'Platform & Operations',
    description: 'Technical and operational capabilities enabling reliability and scale.',
  },
];

const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  {
    id: 'user-access-identity',
    name: 'User Access & Identity',
    domainId: 'customer-experience',
    description: 'Account lifecycle, login, permissions, and session management.',
    businessValue: 'Reduces onboarding friction and protects account access.',
    ownerRole: 'Product + Engineering',
    kpis: ['Signup conversion', 'Login success rate', 'Account recovery success'],
    keywords: ['auth', 'login', 'signup', 'session', 'jwt', 'oauth', 'password', 'verify'],
  },
  {
    id: 'core-product-experience',
    name: 'Core Product Experience',
    domainId: 'customer-experience',
    description: 'Primary workflows where users receive product value.',
    businessValue: 'Directly affects activation, retention, and customer satisfaction.',
    ownerRole: 'Product',
    kpis: ['Activation rate', 'Core action completion', 'Time to value'],
    keywords: ['dashboard', 'project', 'workflow', 'analysis', 'feature', 'ui', 'component'],
  },
  {
    id: 'billing-payments',
    name: 'Billing & Payments',
    domainId: 'revenue-growth',
    description: 'Subscription, pricing, invoicing, and payment operations.',
    businessValue: 'Enables monetization and recurring revenue operations.',
    ownerRole: 'Product + Finance',
    kpis: ['Trial to paid conversion', 'Payment success rate', 'MRR growth'],
    keywords: ['billing', 'payment', 'invoice', 'subscription', 'plan', 'checkout', 'stripe'],
  },
  {
    id: 'insights-reporting',
    name: 'Insights & Reporting',
    domainId: 'revenue-growth',
    description: 'Generated reports, analytics views, and decision-support outputs.',
    businessValue: 'Supports stakeholder decisions and demonstrates product value.',
    ownerRole: 'Product + Data',
    kpis: ['Report generation success', 'Insight engagement', 'Time to insight'],
    keywords: ['report', 'insight', 'analytics', 'summary', 'finding', 'metric'],
  },
  {
    id: 'communication-notifications',
    name: 'Communication & Notifications',
    domainId: 'revenue-growth',
    description: 'Transactional email and user communication channels.',
    businessValue: 'Improves activation, trust, and user follow-through.',
    ownerRole: 'Product + Lifecycle',
    kpis: ['Email delivery rate', 'Verification completion', 'Notification engagement'],
    keywords: ['email', 'resend', 'notify', 'notification', 'message', 'otp'],
  },
  {
    id: 'integrations-ecosystem',
    name: 'Integrations & Ecosystem',
    domainId: 'platform-operations',
    description: 'Third-party platform integrations and developer ecosystem touchpoints.',
    businessValue: 'Expands product reach and supports enterprise workflows.',
    ownerRole: 'Platform',
    kpis: ['Integration uptime', 'Sync success rate', 'Ecosystem adoption'],
    keywords: ['github', 'webhook', 'api', 'plugin', 'extension', 'external', 'integration'],
  },
  {
    id: 'data-reliability',
    name: 'Data & Reliability',
    domainId: 'platform-operations',
    description: 'Storage, processing, recoverability, and operational robustness.',
    businessValue: 'Protects customer trust and reduces operational incidents.',
    ownerRole: 'Engineering',
    kpis: ['Error rate', 'Data integrity', 'Recovery time'],
    keywords: ['database', 'supabase', 'storage', 'table', 'migration', 'queue', 'retry'],
  },
];

const FALLBACK_CAPABILITY_ID = 'core-product-experience';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mapSeverityToRank(severity: Finding['severity']): number {
  switch (severity) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 1;
  }
}

function riskLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 7) return 'critical';
  if (score >= 5) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}

function buildNodeEvidence(node: ArchitectureNode): EvidenceRef[] {
  const fileEvidence = (node.files || []).slice(0, 3).map(file => ({
    source_type: 'file' as const,
    ref: file,
    snippet: `Component evidence from ${file}`,
  }));

  if (fileEvidence.length > 0) {
    return fileEvidence;
  }

  return [
    {
      source_type: 'inference',
      ref: node.id,
      snippet: `Inferred from architecture node "${node.name}"`,
    },
  ];
}

function createRiskFromFinding(finding: Finding, index: number): LensRisk {
  return {
    id: `risk-${index + 1}`,
    title: finding.title,
    severity: finding.severity,
    impact: finding.description,
    confidence: 0.75,
    evidence: (finding.evidence || []).slice(0, 3).map(ev => ({
      source_type: 'inference',
      ref: finding.title,
      snippet: ev,
    })),
  };
}

function inferNodeCapabilityMatch(node: ArchitectureNode): NodeCapabilityMatch {
  const text = [
    node.name,
    node.description,
    ...(node.files || []),
  ]
    .join(' ')
    .toLowerCase();

  let bestMatch: NodeCapabilityMatch | null = null;

  for (const def of CAPABILITY_DEFINITIONS) {
    const matchedKeywords = def.keywords.filter(keyword => text.includes(keyword));
    let score = matchedKeywords.length;

    if (node.type === 'api' && def.id === 'integrations-ecosystem') score += 1;
    if (node.type === 'database' && def.id === 'data-reliability') score += 2;
    if ((node.type === 'ui' || node.type === 'component') && def.id === 'core-product-experience') score += 1;

    if (score === 0) continue;

    const confidence = clamp(0.45 + score * 0.12, 0.45, 0.95);
    if (!bestMatch || confidence > bestMatch.confidence) {
      bestMatch = {
        capabilityId: def.id,
        confidence,
        matchedKeywords,
      };
    }
  }

  if (bestMatch) return bestMatch;

  if (node.type === 'database') {
    return {
      capabilityId: 'data-reliability',
      confidence: 0.55,
      matchedKeywords: [],
    };
  }

  return {
    capabilityId: FALLBACK_CAPABILITY_ID,
    confidence: 0.5,
    matchedKeywords: [],
  };
}

function determineMaturity(componentCount: number, risks: LensRisk[]): CapabilityNode['maturity'] {
  const highRiskCount = risks.filter(r => r.severity === 'critical' || r.severity === 'high').length;
  if (componentCount === 0) return 'unknown';
  if (highRiskCount >= 3) return 'nascent';
  if (highRiskCount >= 1) return 'developing';
  if (componentCount >= 3) return 'stable';
  return 'developing';
}

function getSystemNodeType(nodeType: ArchitectureNode['type']): CapabilityNode['node_type'] {
  if (nodeType === 'api') return 'api';
  if (nodeType === 'database') return 'datastore';
  if (nodeType === 'external') return 'external_service';
  return 'system_component';
}

function createFallbackCapabilityGraph(projectName?: string): CapabilityGraph {
  const domainId = 'customer-experience';
  const capabilityId = 'fallback-core-capability';
  const componentId = 'fallback-component';

  return {
    top_level_summary: `Capability view is using fallback mode${projectName ? ` for ${projectName}` : ''} because architecture signals were limited.`,
    nodes: [
      {
        id: domainId,
        name: 'Customer Experience',
        node_type: 'capability_domain',
        depth: 0,
        description: 'High-level user-facing capability domain.',
        business_value: 'Represents the primary way users interact with the product.',
        maturity: 'unknown',
        confidence: 0.35,
        owner_role: 'Product',
        evidence: [
          {
            source_type: 'inference',
            ref: 'fallback',
            snippet: 'Generated due to limited architecture metadata.',
          },
        ],
        risks: [],
        kpis: ['Activation rate'],
      },
      {
        id: capabilityId,
        name: 'Core Product Capability',
        node_type: 'capability',
        depth: 1,
        description: 'Fallback capability representing the likely core product surface.',
        business_value: 'Provides a baseline business view until richer signals are available.',
        maturity: 'unknown',
        confidence: 0.35,
        owner_role: 'Product + Engineering',
        evidence: [
          {
            source_type: 'inference',
            ref: 'fallback',
            snippet: 'No architecture nodes were available for deterministic mapping.',
          },
        ],
        risks: [],
        kpis: ['Core action completion'],
      },
      {
        id: componentId,
        name: 'System Surface (Unclassified)',
        node_type: 'system_component',
        depth: 2,
        description: 'Unclassified system area requiring deeper analysis.',
        business_value: 'Keeps the lens operational even when source signals are sparse.',
        maturity: 'unknown',
        confidence: 0.3,
        owner_role: 'Engineering',
        evidence: [
          {
            source_type: 'inference',
            ref: 'fallback',
            snippet: 'Classified as unclassified due to missing structural signals.',
          },
        ],
        risks: [],
        kpis: [],
      },
    ],
    edges: [
      { from: domainId, to: capabilityId, relation: 'contains', confidence: 0.35, evidence: [] },
      { from: capabilityId, to: componentId, relation: 'contains', confidence: 0.3, evidence: [] },
    ],
  };
}

function buildCapabilityGraph(
  architecture: ArchitectureVisualization | null | undefined,
  findings: Finding[],
  projectName?: string
): CapabilityGraph {
  const nodes = architecture?.nodes || [];
  if (nodes.length === 0) {
    return createFallbackCapabilityGraph(projectName);
  }

  const domainNodes: CapabilityNode[] = CAPABILITY_DOMAINS.map(domain => ({
    id: domain.id,
    name: domain.name,
    node_type: 'capability_domain',
    depth: 0,
    description: domain.description,
    business_value: 'Groups related product and platform capabilities for stakeholder clarity.',
    maturity: 'unknown',
    confidence: 0.7,
    owner_role: 'Leadership',
    evidence: [],
    risks: [],
    kpis: [],
  }));

  const capabilityById = new Map<string, CapabilityNode>();
  const capabilityEdges: CapabilityGraph['edges'] = [];

  for (const def of CAPABILITY_DEFINITIONS) {
    capabilityById.set(def.id, {
      id: def.id,
      name: def.name,
      node_type: 'capability',
      depth: 1,
      description: def.description,
      business_value: def.businessValue,
      maturity: 'unknown',
      owner_role: def.ownerRole,
      confidence: 0.55,
      evidence: [],
      risks: [],
      kpis: def.kpis,
    });

    capabilityEdges.push({
      from: def.domainId,
      to: def.id,
      relation: 'contains',
      confidence: 0.75,
      evidence: [],
    });
  }

  const systemNodes: CapabilityNode[] = [];
  const confidenceAccumulator = new Map<string, number[]>();
  const componentCountByCapability = new Map<string, number>();

  nodes.forEach(node => {
    const match = inferNodeCapabilityMatch(node);
    const capability = capabilityById.get(match.capabilityId);
    if (!capability) return;

    const componentId = `component-${node.id}`;
    const evidence = buildNodeEvidence(node);
    systemNodes.push({
      id: componentId,
      name: node.name,
      node_type: getSystemNodeType(node.type),
      depth: 2,
      description: node.description || `System component mapped from ${node.type}`,
      business_value: 'Supports capability execution and user outcomes.',
      maturity: 'unknown',
      owner_role: 'Engineering',
      confidence: match.confidence,
      evidence,
      risks: [],
      kpis: [],
    });

    capability.evidence = [...capability.evidence, ...evidence].slice(0, 8);
    capabilityEdges.push({
      from: capability.id,
      to: componentId,
      relation: 'contains',
      confidence: match.confidence,
      evidence,
    });

    confidenceAccumulator.set(capability.id, [
      ...(confidenceAccumulator.get(capability.id) || []),
      match.confidence,
    ]);
    componentCountByCapability.set(
      capability.id,
      (componentCountByCapability.get(capability.id) || 0) + 1
    );
  });

  const risks = findings.map(createRiskFromFinding);
  for (const capability of capabilityById.values()) {
    const def = CAPABILITY_DEFINITIONS.find(item => item.id === capability.id);
    const matchedRisks = risks.filter(risk => {
      const text = `${risk.title} ${risk.impact}`.toLowerCase();
      return (def?.keywords || []).some(keyword => text.includes(keyword));
    });

    capability.risks = matchedRisks.slice(0, 4);
    const confidenceValues = confidenceAccumulator.get(capability.id) || [];
    if (confidenceValues.length > 0) {
      const avgConfidence =
        confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length;
      capability.confidence = clamp(avgConfidence, 0.45, 0.95);
    }
    capability.maturity = determineMaturity(
      componentCountByCapability.get(capability.id) || 0,
      capability.risks
    );
  }

  const capabilityNodes = Array.from(capabilityById.values()).filter(node => {
    const componentCount = componentCountByCapability.get(node.id) || 0;
    const hasSignals = componentCount > 0 || node.risks.length > 0;
    if (!hasSignals && node.id !== FALLBACK_CAPABILITY_ID) return false;
    return true;
  });

  const selectedDomainIds = new Set(capabilityNodes.map(node => {
    const def = CAPABILITY_DEFINITIONS.find(item => item.id === node.id);
    return def?.domainId || 'customer-experience';
  }));

  const selectedDomains = domainNodes.filter(domain => selectedDomainIds.has(domain.id));
  const selectedNodeIds = new Set([
    ...selectedDomains.map(node => node.id),
    ...capabilityNodes.map(node => node.id),
    ...systemNodes.map(node => node.id),
  ]);

  const selectedEdges = capabilityEdges.filter(edge =>
    selectedNodeIds.has(edge.from) && selectedNodeIds.has(edge.to)
  );

  const topLevelSummary = `${projectName || 'Repository'} maps to ${capabilityNodes.length} business capabilities across ${selectedDomains.length} strategic domains.`;

  return {
    top_level_summary: topLevelSummary,
    nodes: [...selectedDomains, ...capabilityNodes, ...systemNodes],
    edges: selectedEdges,
  };
}

function stepEvidenceFromCapability(capabilityGraph: CapabilityGraph, capabilityId: string): EvidenceRef[] {
  const stepEdges = capabilityGraph.edges.filter(edge => edge.from === capabilityId);
  const evidence = stepEdges.flatMap(edge => edge.evidence || []).slice(0, 4);
  if (evidence.length > 0) return evidence;
  return [
    {
      source_type: 'inference',
      ref: capabilityId,
      snippet: 'No direct code evidence was available for this journey step.',
    },
  ];
}

function pickSystemsForCapability(capabilityGraph: CapabilityGraph, capabilityId: string): string[] {
  const stepEdges = capabilityGraph.edges.filter(edge => edge.from === capabilityId);
  const systemIds = stepEdges.map(edge => edge.to);
  const systemNames = systemIds
    .map(id => capabilityGraph.nodes.find(node => node.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 5);
  return systemNames;
}

function buildStepRisk(findings: Finding[], keywords: string[]): JourneyStep['friction_risk'] {
  const score = findings.reduce((total, finding) => {
    const text = `${finding.title} ${finding.description}`.toLowerCase();
    const hasKeyword = keywords.some(keyword => text.includes(keyword));
    if (!hasKeyword) return total;
    return total + mapSeverityToRank(finding.severity);
  }, 0);
  return riskLevelFromScore(score);
}

function createJourneyStep(
  journeyId: string,
  order: number,
  name: string,
  stepType: JourneyStep['step_type'],
  description: string,
  businessOutcome: string,
  capabilityIds: string[],
  capabilityGraph: CapabilityGraph,
  findings: Finding[]
): JourneyStep {
  const systemsTouched = capabilityIds.flatMap(capabilityId =>
    pickSystemsForCapability(capabilityGraph, capabilityId)
  );
  const evidence = capabilityIds.flatMap(capabilityId =>
    stepEvidenceFromCapability(capabilityGraph, capabilityId)
  );
  const riskKeywords = [...capabilityIds, name.toLowerCase()];
  const frictionRisk = buildStepRisk(findings, riskKeywords);
  const confidence = clamp(
    systemsTouched.length > 0 ? 0.72 : 0.52,
    0.4,
    0.9
  );

  return {
    id: `${journeyId}-step-${order}`,
    journey_id: journeyId,
    order,
    name,
    step_type: stepType,
    description,
    business_outcome: businessOutcome,
    friction_risk: frictionRisk,
    dropoff_likelihood: frictionRisk === 'critical'
      ? 0.7
      : frictionRisk === 'high'
        ? 0.5
        : frictionRisk === 'medium'
          ? 0.3
          : 0.15,
    systems_touched: Array.from(new Set(systemsTouched)),
    confidence,
    evidence: evidence.slice(0, 5),
    risks: [],
  };
}

function buildJourneyGraph(
  capabilityGraph: CapabilityGraph,
  findings: Finding[]
): JourneyGraph {
  const capabilityIds = new Set(
    capabilityGraph.nodes
      .filter(node => node.node_type === 'capability')
      .map(node => node.id)
  );

  const journeys: Journey[] = [];

  const coreJourneyId = 'journey-core-value-delivery';
  journeys.push({
    id: coreJourneyId,
    name: 'User Entry to Core Value',
    persona: 'Primary end user',
    goal: 'Reach the main product value in the shortest possible path.',
    kpi: 'Core action completion rate',
    steps: [
      createJourneyStep(
        coreJourneyId,
        1,
        'Access Product Surface',
        'entry',
        'User reaches a key product entry point such as landing, dashboard, or project view.',
        'Start engagement with minimal friction.',
        ['core-product-experience', 'user-access-identity'],
        capabilityGraph,
        findings
      ),
      createJourneyStep(
        coreJourneyId,
        2,
        'Configure or Provide Inputs',
        'action',
        'User provides required inputs (e.g., repository connection, documents, settings).',
        'Set up context needed to unlock product value.',
        ['core-product-experience', 'integrations-ecosystem'],
        capabilityGraph,
        findings
      ),
      createJourneyStep(
        coreJourneyId,
        3,
        'System Processing & Validation',
        'system',
        'Backend services process requests and validate requirements or state.',
        'Ensure reliable output and trustworthy results.',
        ['data-reliability', 'integrations-ecosystem'],
        capabilityGraph,
        findings
      ),
      createJourneyStep(
        coreJourneyId,
        4,
        'Deliver Insight / Outcome',
        'exit',
        'System returns outputs such as architecture views, findings, or actionable next steps.',
        'Demonstrate visible product value to the user and stakeholders.',
        ['insights-reporting', 'core-product-experience'],
        capabilityGraph,
        findings
      ),
    ],
  });

  if (capabilityIds.has('user-access-identity')) {
    const journeyId = 'journey-signup-activation';
    journeys.push({
      id: journeyId,
      name: 'Signup to Activation',
      persona: 'New user',
      goal: 'Create an account and reach first successful product output.',
      kpi: 'Time to first value',
      steps: [
        createJourneyStep(
          journeyId,
          1,
          'Create Account',
          'entry',
          'User submits signup details and initiates account creation.',
          'Convert visitor into an active account.',
          ['user-access-identity'],
          capabilityGraph,
          findings
        ),
        createJourneyStep(
          journeyId,
          2,
          'Verify Access',
          'validation',
          'User verifies email or identity to unlock authenticated access.',
          'Ensure trusted access and reduce fraudulent signups.',
          ['user-access-identity', 'communication-notifications'],
          capabilityGraph,
          findings
        ),
        createJourneyStep(
          journeyId,
          3,
          'Complete Initial Setup',
          'action',
          'User connects required resources and submits setup inputs.',
          'Prepare product context for initial execution.',
          ['core-product-experience', 'integrations-ecosystem'],
          capabilityGraph,
          findings
        ),
        createJourneyStep(
          journeyId,
          4,
          'Receive First Outcome',
          'exit',
          'User receives first successful report or insight.',
          'Establish product credibility and habit loop.',
          ['insights-reporting'],
          capabilityGraph,
          findings
        ),
      ],
    });
  }

  if (capabilityIds.has('billing-payments')) {
    const journeyId = 'journey-trial-to-paid';
    journeys.push({
      id: journeyId,
      name: 'Trial to Paid Conversion',
      persona: 'Decision maker',
      goal: 'Evaluate value and complete a successful paid conversion.',
      kpi: 'Trial-to-paid conversion rate',
      steps: [
        createJourneyStep(
          journeyId,
          1,
          'Evaluate Value Signals',
          'entry',
          'Stakeholder reviews product outputs and confidence indicators.',
          'Build confidence for purchase decision.',
          ['insights-reporting'],
          capabilityGraph,
          findings
        ),
        createJourneyStep(
          journeyId,
          2,
          'Select Plan',
          'action',
          'User chooses pricing tier based on expected value and usage.',
          'Align monetization with customer segment.',
          ['billing-payments'],
          capabilityGraph,
          findings
        ),
        createJourneyStep(
          journeyId,
          3,
          'Execute Payment',
          'payment',
          'Payment is authorized and subscription entitlements are updated.',
          'Secure recurring revenue.',
          ['billing-payments', 'data-reliability'],
          capabilityGraph,
          findings
        ),
        createJourneyStep(
          journeyId,
          4,
          'Confirm Entitlements',
          'notification',
          'System confirms paid status and communicates entitlements to the user.',
          'Reduce churn risk immediately after purchase.',
          ['communication-notifications', 'billing-payments'],
          capabilityGraph,
          findings
        ),
      ],
    });
  }

  const summary = `Generated ${journeys.length} journey views from capability signals, with confidence and risk overlays for business prioritization.`;
  return { summary, journeys };
}

function buildQualityReport(
  architecture: ArchitectureVisualization | null | undefined,
  capabilityGraph: CapabilityGraph,
  journeyGraph: JourneyGraph,
  documents?: ParsedDocument[]
): QualityReport {
  const architectureNodes = architecture?.nodes || [];
  const mappedSystemNodes = capabilityGraph.nodes.filter(node => node.depth === 2).length;
  const coverageScore = architectureNodes.length > 0
    ? clamp(mappedSystemNodes / architectureNodes.length, 0, 1)
    : 0.35;

  const allQualityNodes = [
    ...capabilityGraph.nodes,
    ...journeyGraph.journeys.flatMap(journey => journey.steps),
  ];
  const withEvidence = allQualityNodes.filter(node => (node.evidence || []).length > 0).length;
  const evidenceDensity = allQualityNodes.length > 0
    ? clamp(withEvidence / allQualityNodes.length, 0, 1)
    : 0;
  const lowConfidenceCount = allQualityNodes.filter(node => (node.confidence || 0) < 0.6).length;
  const lowConfidenceRatio = allQualityNodes.length > 0
    ? clamp(lowConfidenceCount / allQualityNodes.length, 0, 1)
    : 0;

  const missingSignals: string[] = [];
  const assumptions: string[] = [];
  const needsManualInput: string[] = [];

  const hasUi = architectureNodes.some(node => node.type === 'ui' || node.type === 'component');
  const hasApi = architectureNodes.some(node => node.type === 'api');
  const hasDatabase = architectureNodes.some(node => node.type === 'database');
  const hasDocuments = (documents?.length || 0) > 0;

  if (!hasUi) {
    missingSignals.push('frontend_flow_signals_missing');
    assumptions.push('User journey entry points were inferred from backend and route-level patterns.');
    needsManualInput.push('Provide primary user-facing flows to improve journey fidelity.');
  }

  if (!hasApi) {
    missingSignals.push('api_surface_signals_missing');
    assumptions.push('Capability dependencies on backend contracts were partially inferred.');
    needsManualInput.push('Add API contract documentation or route annotations.');
  }

  if (!hasDatabase) {
    missingSignals.push('datastore_signals_missing');
    assumptions.push('Data persistence steps were modeled as inferred system transitions.');
  }

  if (!hasDocuments) {
    missingSignals.push('requirements_documents_missing');
    assumptions.push('Business capabilities were inferred from code structure without explicit PRD/BRD context.');
    needsManualInput.push('Upload product requirements to improve business-language mapping quality.');
  }

  if (architectureNodes.length === 0) {
    missingSignals.push('architecture_nodes_missing');
    assumptions.push('Fallback capability and journey templates were used due to absent architecture graph.');
    needsManualInput.push('Run full architecture analysis before relying on business lenses.');
  }

  return {
    coverage_score: coverageScore,
    evidence_density: evidenceDensity,
    low_confidence_ratio: lowConfidenceRatio,
    missing_signals: missingSignals,
    assumptions,
    needs_manual_input: needsManualInput,
  };
}

export function generateBusinessLensArtifacts(input: LensGenerationInput): LensBundle {
  const capabilityGraph = buildCapabilityGraph(
    input.architecture,
    input.findings,
    input.projectName
  );
  const journeyGraph = buildJourneyGraph(capabilityGraph, input.findings);
  const qualityReport = buildQualityReport(
    input.architecture,
    capabilityGraph,
    journeyGraph,
    input.documents
  );

  return LensBundleSchema.parse({
    capability_graph: capabilityGraph,
    journey_graph: journeyGraph,
    quality_report: qualityReport,
  });
}
