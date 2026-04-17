import type {
  AnalysisResult,
  ArchitectureEdge,
  ArchitectureNode,
  CapabilityNode,
  Journey,
  JourneyStep,
} from '@/lib/db';

export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

export interface VersionSnapshot {
  analysis_id: string;
  analyzed_at: string;
  branch?: string;
  commit_hash?: string;
  commit_url?: string;
}

export interface ModuleDiff {
  id: string;
  name: string;
  status: DiffChangeType;
  reasons: string[];
  before?: ArchitectureNode;
  after?: ArchitectureNode;
  degree_before: number;
  degree_after: number;
}

export interface EdgeDiff {
  id: string;
  from: string;
  to: string;
  edge_type: ArchitectureEdge['type'];
  status: DiffChangeType;
  label_before?: string;
  label_after?: string;
}

export interface JourneyDiff {
  id: string;
  name: string;
  status: DiffChangeType;
  before_steps: number;
  after_steps: number;
  summary: string;
}

export interface RiskDiff {
  key: string;
  title: string;
  status: DiffChangeType;
  severity_before?: string;
  severity_after?: string;
}

export interface TechDiff {
  name: string;
  status: DiffChangeType;
}

export interface VersionDiffSummary {
  modules_added: number;
  modules_removed: number;
  modules_modified: number;
  edges_added: number;
  edges_removed: number;
  edges_modified: number;
  journeys_added: number;
  journeys_removed: number;
  journeys_modified: number;
  risks_increased: number;
  risks_decreased: number;
  tech_added: number;
  tech_removed: number;
}

export interface FileDiff {
  path: string;
  status: DiffChangeType;
  module_id?: string;
}

export interface BreakingChangeRisk {
  module_id: string;
  module_name: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  affected_dependents: string[];
}

export interface DependencyCascade {
  changed_module_id: string;
  changed_module_name: string;
  directly_affected: string[];
  transitively_affected: string[];
  total_blast_radius: number;
}

export interface CapabilitySnapshot {
  description: string;
  business_value: string;
  maturity: CapabilityNode['maturity'];
  owner_role?: string;
}

export interface CapabilityDiff {
  id: string;
  name: string;
  status: DiffChangeType;
  node_type: CapabilityNode['node_type'];
  domain_name?: string;
  reasons: string[];
  before?: CapabilitySnapshot;
  after?: CapabilitySnapshot;
}

export interface ValueFeatureDiff {
  name: string;
  status: DiffChangeType;
  description_before?: string;
  description_after?: string;
  business_impact_before?: string;
  business_impact_after?: string;
  modules_added: string[];
  modules_removed: string[];
}

export interface JourneyStepChange {
  step_id?: string;
  order: number;
  name: string;
  change: 'added' | 'removed' | 'modified' | 'reordered';
  before_description?: string;
  after_description?: string;
  friction_before?: JourneyStep['friction_risk'];
  friction_after?: JourneyStep['friction_risk'];
  systems_added?: string[];
  systems_removed?: string[];
}

export interface JourneyStoryboard {
  journey_id: string;
  journey_name: string;
  persona?: string;
  before_step_count: number;
  after_step_count: number;
  step_changes: JourneyStepChange[];
  headline: string;
  status: DiffChangeType;
}

export interface VersionDiffResult {
  from: VersionSnapshot;
  to: VersionSnapshot;
  summary: VersionDiffSummary;
  module_changes: ModuleDiff[];
  edge_changes: EdgeDiff[];
  journey_changes: JourneyDiff[];
  risk_changes: RiskDiff[];
  tech_changes: TechDiff[];
  file_changes: FileDiff[];
  breaking_change_risks: BreakingChangeRisk[];
  dependency_cascades: DependencyCascade[];
  business_impact_notes: string[];
  // Phase-1 additions — stakeholder-facing diffs. Optional for back-compat with older clients.
  capability_changes?: CapabilityDiff[];
  value_feature_changes?: ValueFeatureDiff[];
  journey_storyboards?: JourneyStoryboard[];
  generated_at: string;
}

interface CacheRecord {
  value: VersionDiffResult;
  expires_at: number;
}

const DIFF_CACHE_TTL_MS = 10 * 60 * 1000;
const diffCache = new Map<string, CacheRecord>();

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function hashSet(values: string[]): string {
  return [...new Set(values)].sort().join('|');
}

function edgeKey(edge: ArchitectureEdge): string {
  return `${edge.from}|${edge.to}|${edge.type}`;
}

function journeyKey(journey: Journey): string {
  return journey.id || normalize(journey.name);
}

function journeySignature(journey: Journey): string {
  const steps = journey.steps
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(step => `${step.order}:${normalize(step.name)}:${hashSet(step.systems_touched)}`);
  return steps.join('>');
}

function extractTechSet(analysis: AnalysisResult): Set<string> {
  const tech = new Set<string>();

  (analysis.business_context?.external_deps || []).forEach(dep => {
    if (dep.name) tech.add(dep.name);
  });

  try {
    const parsed = JSON.parse(analysis.raw_response) as Record<string, unknown>;

    const pass1 = parsed.pass1 as Record<string, unknown> | undefined;
    const summaries = pass1?.module_summaries as Record<string, unknown> | undefined;
    if (summaries && typeof summaries === 'object') {
      Object.values(summaries).forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const technologies = (entry as { key_technologies?: unknown }).key_technologies;
        if (Array.isArray(technologies)) {
          technologies.forEach((item) => {
            if (typeof item === 'string' && item.trim()) tech.add(item.trim());
          });
        }
      });
    }

    const deterministic = parsed.deterministic_signals as Record<string, unknown> | undefined;
    const repoMeta = deterministic?.repo_metadata as Record<string, unknown> | undefined;
    if (repoMeta && typeof repoMeta.primary_language === 'string' && repoMeta.primary_language.trim()) {
      tech.add(repoMeta.primary_language.trim());
    }
  } catch {
    // Best effort extraction from raw_response.
  }

  return tech;
}

function computeDegrees(edges: ArchitectureEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  edges.forEach((edge) => {
    degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
  });
  return degrees;
}

function moduleReasons(before: ArchitectureNode, after: ArchitectureNode): string[] {
  const reasons: string[] = [];
  if (before.type !== after.type) reasons.push('Module type changed');
  if (before.complexity !== after.complexity) reasons.push('Complexity changed');
  if ((before.description || '') !== (after.description || '')) reasons.push('Description changed');
  if ((before.business_role || '') !== (after.business_role || '')) reasons.push('Business role changed');

  const beforeFiles = new Set(before.files || []);
  const afterFiles = new Set(after.files || []);
  if (beforeFiles.size !== afterFiles.size || hashSet([...beforeFiles]) !== hashSet([...afterFiles])) {
    reasons.push('File footprint changed');
  }
  return reasons;
}

function calculateModuleDiff(before: AnalysisResult, after: AnalysisResult): ModuleDiff[] {
  const beforeNodes = before.architecture?.nodes || [];
  const afterNodes = after.architecture?.nodes || [];
  const beforeMap = new Map(beforeNodes.map(node => [node.id, node]));
  const afterMap = new Map(afterNodes.map(node => [node.id, node]));
  const ids = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const beforeDegrees = computeDegrees(before.architecture?.edges || []);
  const afterDegrees = computeDegrees(after.architecture?.edges || []);

  const changes: ModuleDiff[] = [];
  ids.forEach((id) => {
    const beforeNode = beforeMap.get(id);
    const afterNode = afterMap.get(id);
    if (!beforeNode && afterNode) {
      changes.push({
        id,
        name: afterNode.name,
        status: 'added',
        reasons: ['New module introduced'],
        after: afterNode,
        degree_before: 0,
        degree_after: afterDegrees.get(id) || 0,
      });
      return;
    }
    if (beforeNode && !afterNode) {
      changes.push({
        id,
        name: beforeNode.name,
        status: 'removed',
        reasons: ['Module removed'],
        before: beforeNode,
        degree_before: beforeDegrees.get(id) || 0,
        degree_after: 0,
      });
      return;
    }
    if (!beforeNode || !afterNode) return;
    const reasons = moduleReasons(beforeNode, afterNode);
    changes.push({
      id,
      name: afterNode.name,
      status: reasons.length ? 'modified' : 'unchanged',
      reasons,
      before: beforeNode,
      after: afterNode,
      degree_before: beforeDegrees.get(id) || 0,
      degree_after: afterDegrees.get(id) || 0,
    });
  });

  return changes.sort((a, b) => {
    const statusRank = { modified: 0, added: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function calculateEdgeDiff(before: AnalysisResult, after: AnalysisResult): EdgeDiff[] {
  const beforeEdges = before.architecture?.edges || [];
  const afterEdges = after.architecture?.edges || [];
  const beforeMap = new Map(beforeEdges.map(edge => [edgeKey(edge), edge]));
  const afterMap = new Map(afterEdges.map(edge => [edgeKey(edge), edge]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const changes: EdgeDiff[] = [];
  keys.forEach((key) => {
    const beforeEdge = beforeMap.get(key);
    const afterEdge = afterMap.get(key);
    if (!beforeEdge && afterEdge) {
      changes.push({
        id: key,
        from: afterEdge.from,
        to: afterEdge.to,
        edge_type: afterEdge.type,
        status: 'added',
        label_after: afterEdge.label,
      });
      return;
    }
    if (beforeEdge && !afterEdge) {
      changes.push({
        id: key,
        from: beforeEdge.from,
        to: beforeEdge.to,
        edge_type: beforeEdge.type,
        status: 'removed',
        label_before: beforeEdge.label,
      });
      return;
    }
    if (!beforeEdge || !afterEdge) return;
    const labelChanged = (beforeEdge.label || '') !== (afterEdge.label || '');
    changes.push({
      id: key,
      from: afterEdge.from,
      to: afterEdge.to,
      edge_type: afterEdge.type,
      status: labelChanged ? 'modified' : 'unchanged',
      label_before: beforeEdge.label,
      label_after: afterEdge.label,
    });
  });

  return changes.sort((a, b) => {
    const statusRank = { modified: 0, added: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.id.localeCompare(b.id);
  });
}

function calculateJourneyDiff(before: AnalysisResult, after: AnalysisResult): JourneyDiff[] {
  const beforeJourneys = before.journey_graph?.journeys || [];
  const afterJourneys = after.journey_graph?.journeys || [];
  const beforeMap = new Map(beforeJourneys.map(journey => [journeyKey(journey), journey]));
  const afterMap = new Map(afterJourneys.map(journey => [journeyKey(journey), journey]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const changes: JourneyDiff[] = [];
  keys.forEach((key) => {
    const beforeJourney = beforeMap.get(key);
    const afterJourney = afterMap.get(key);

    if (!beforeJourney && afterJourney) {
      changes.push({
        id: afterJourney.id,
        name: afterJourney.name,
        status: 'added',
        before_steps: 0,
        after_steps: afterJourney.steps.length,
        summary: 'New journey introduced',
      });
      return;
    }
    if (beforeJourney && !afterJourney) {
      changes.push({
        id: beforeJourney.id,
        name: beforeJourney.name,
        status: 'removed',
        before_steps: beforeJourney.steps.length,
        after_steps: 0,
        summary: 'Journey removed',
      });
      return;
    }
    if (!beforeJourney || !afterJourney) return;

    const signatureChanged = journeySignature(beforeJourney) !== journeySignature(afterJourney);
    const metaChanged = beforeJourney.goal !== afterJourney.goal || beforeJourney.persona !== afterJourney.persona;
    const isModified = signatureChanged || metaChanged;
    changes.push({
      id: afterJourney.id,
      name: afterJourney.name,
      status: isModified ? 'modified' : 'unchanged',
      before_steps: beforeJourney.steps.length,
      after_steps: afterJourney.steps.length,
      summary: isModified ? 'Journey flow changed' : 'No significant change',
    });
  });

  return changes.sort((a, b) => {
    const statusRank = { modified: 0, added: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function calculateRiskDiff(before: AnalysisResult, after: AnalysisResult): RiskDiff[] {
  const beforeFindings = before.findings || [];
  const afterFindings = after.findings || [];
  const beforeMap = new Map(beforeFindings.map(finding => [normalize(finding.title), finding]));
  const afterMap = new Map(afterFindings.map(finding => [normalize(finding.title), finding]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const changes: RiskDiff[] = [];
  keys.forEach((key) => {
    const beforeFinding = beforeMap.get(key);
    const afterFinding = afterMap.get(key);
    if (!beforeFinding && afterFinding) {
      changes.push({
        key,
        title: afterFinding.title,
        status: 'added',
        severity_after: afterFinding.severity,
      });
      return;
    }
    if (beforeFinding && !afterFinding) {
      changes.push({
        key,
        title: beforeFinding.title,
        status: 'removed',
        severity_before: beforeFinding.severity,
      });
      return;
    }
    if (!beforeFinding || !afterFinding) return;

    const status: DiffChangeType = beforeFinding.severity !== afterFinding.severity ? 'modified' : 'unchanged';
    changes.push({
      key,
      title: afterFinding.title,
      status,
      severity_before: beforeFinding.severity,
      severity_after: afterFinding.severity,
    });
  });

  return changes.sort((a, b) => {
    const statusRank = { modified: 0, added: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.title.localeCompare(b.title);
  });
}

function calculateTechDiff(before: AnalysisResult, after: AnalysisResult): TechDiff[] {
  const beforeTech = extractTechSet(before);
  const afterTech = extractTechSet(after);
  const all = new Set([...beforeTech, ...afterTech]);

  const changes: TechDiff[] = [];
  all.forEach((name) => {
    const inBefore = beforeTech.has(name);
    const inAfter = afterTech.has(name);
    if (!inBefore && inAfter) {
      changes.push({ name, status: 'added' });
      return;
    }
    if (inBefore && !inAfter) {
      changes.push({ name, status: 'removed' });
      return;
    }
    changes.push({ name, status: 'unchanged' });
  });

  return changes.sort((a, b) => {
    const statusRank = { added: 0, removed: 1, unchanged: 2, modified: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function severityWeight(severity: string): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}

function capabilityKey(node: CapabilityNode): string {
  return node.id || normalize(node.name);
}

function capabilitySnapshot(node: CapabilityNode): CapabilitySnapshot {
  return {
    description: node.description || '',
    business_value: node.business_value || '',
    maturity: node.maturity,
    owner_role: node.owner_role,
  };
}

function capabilityReasons(before: CapabilityNode, after: CapabilityNode): string[] {
  const reasons: string[] = [];
  if ((before.description || '') !== (after.description || '')) reasons.push('Description changed');
  if ((before.business_value || '') !== (after.business_value || '')) reasons.push('Business value changed');
  if (before.maturity !== after.maturity) reasons.push(`Maturity ${before.maturity} → ${after.maturity}`);
  if ((before.owner_role || '') !== (after.owner_role || '')) reasons.push('Owner role changed');
  if (hashSet(before.kpis || []) !== hashSet(after.kpis || [])) reasons.push('KPI set changed');
  return reasons;
}

function resolveCapabilityDomain(
  nodeId: string,
  nodes: CapabilityNode[],
  edges: Array<{ from: string; to: string; relation: string }>
): string | undefined {
  // A capability domain is depth 0; walk `contains` edges upward.
  const byId = new Map(nodes.map(n => [n.id, n]));
  const containerOf = new Map<string, string>();
  for (const edge of edges) {
    if (edge.relation === 'contains') {
      // edge.from contains edge.to → so edge.to's container is edge.from
      containerOf.set(edge.to, edge.from);
    }
  }
  let currentId: string | undefined = nodeId;
  const visited = new Set<string>();
  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const node = byId.get(currentId);
    if (!node) break;
    if (node.node_type === 'capability_domain' || node.depth === 0) return node.name;
    currentId = containerOf.get(currentId);
  }
  return undefined;
}

function calculateCapabilityDiff(before: AnalysisResult, after: AnalysisResult): CapabilityDiff[] {
  const beforeNodes = before.capability_graph?.nodes || [];
  const afterNodes = after.capability_graph?.nodes || [];
  if (beforeNodes.length === 0 && afterNodes.length === 0) return [];

  const beforeEdges = before.capability_graph?.edges || [];
  const afterEdges = after.capability_graph?.edges || [];

  const beforeMap = new Map(beforeNodes.map(n => [capabilityKey(n), n]));
  const afterMap = new Map(afterNodes.map(n => [capabilityKey(n), n]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const changes: CapabilityDiff[] = [];
  keys.forEach((key) => {
    const beforeNode = beforeMap.get(key);
    const afterNode = afterMap.get(key);

    if (!beforeNode && afterNode) {
      changes.push({
        id: afterNode.id,
        name: afterNode.name,
        status: 'added',
        node_type: afterNode.node_type,
        domain_name: resolveCapabilityDomain(afterNode.id, afterNodes, afterEdges),
        reasons: ['New capability introduced'],
        after: capabilitySnapshot(afterNode),
      });
      return;
    }
    if (beforeNode && !afterNode) {
      changes.push({
        id: beforeNode.id,
        name: beforeNode.name,
        status: 'removed',
        node_type: beforeNode.node_type,
        domain_name: resolveCapabilityDomain(beforeNode.id, beforeNodes, beforeEdges),
        reasons: ['Capability removed'],
        before: capabilitySnapshot(beforeNode),
      });
      return;
    }
    if (!beforeNode || !afterNode) return;

    const reasons = capabilityReasons(beforeNode, afterNode);
    changes.push({
      id: afterNode.id,
      name: afterNode.name,
      status: reasons.length ? 'modified' : 'unchanged',
      node_type: afterNode.node_type,
      domain_name: resolveCapabilityDomain(afterNode.id, afterNodes, afterEdges),
      reasons,
      before: capabilitySnapshot(beforeNode),
      after: capabilitySnapshot(afterNode),
    });
  });

  return changes.sort((a, b) => {
    const statusRank = { modified: 0, added: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function calculateValueFeatureDiff(before: AnalysisResult, after: AnalysisResult): ValueFeatureDiff[] {
  const beforeFeatures = before.business_context?.value_features || [];
  const afterFeatures = after.business_context?.value_features || [];
  if (beforeFeatures.length === 0 && afterFeatures.length === 0) return [];

  const beforeMap = new Map(beforeFeatures.map(f => [normalize(f.name), f]));
  const afterMap = new Map(afterFeatures.map(f => [normalize(f.name), f]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const changes: ValueFeatureDiff[] = [];
  keys.forEach((key) => {
    const beforeFeature = beforeMap.get(key);
    const afterFeature = afterMap.get(key);

    if (!beforeFeature && afterFeature) {
      changes.push({
        name: afterFeature.name,
        status: 'added',
        description_after: afterFeature.description,
        business_impact_after: afterFeature.business_impact,
        modules_added: [...(afterFeature.modules_involved || [])],
        modules_removed: [],
      });
      return;
    }
    if (beforeFeature && !afterFeature) {
      changes.push({
        name: beforeFeature.name,
        status: 'removed',
        description_before: beforeFeature.description,
        business_impact_before: beforeFeature.business_impact,
        modules_added: [],
        modules_removed: [...(beforeFeature.modules_involved || [])],
      });
      return;
    }
    if (!beforeFeature || !afterFeature) return;

    const beforeModules = new Set(beforeFeature.modules_involved || []);
    const afterModules = new Set(afterFeature.modules_involved || []);
    const added = [...afterModules].filter(m => !beforeModules.has(m));
    const removed = [...beforeModules].filter(m => !afterModules.has(m));
    const textChanged = (beforeFeature.description || '') !== (afterFeature.description || '')
      || (beforeFeature.business_impact || '') !== (afterFeature.business_impact || '');
    const status: DiffChangeType = (added.length || removed.length || textChanged) ? 'modified' : 'unchanged';

    changes.push({
      name: afterFeature.name,
      status,
      description_before: beforeFeature.description,
      description_after: afterFeature.description,
      business_impact_before: beforeFeature.business_impact,
      business_impact_after: afterFeature.business_impact,
      modules_added: added,
      modules_removed: removed,
    });
  });

  return changes.sort((a, b) => {
    const statusRank = { added: 0, modified: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

function stepKey(step: JourneyStep): string {
  return step.id || `${step.order}:${normalize(step.name)}`;
}

function buildJourneyStoryboard(
  beforeJourney: Journey | undefined,
  afterJourney: Journey | undefined
): JourneyStoryboard | null {
  if (!beforeJourney && !afterJourney) return null;

  if (!beforeJourney && afterJourney) {
    const stepChanges: JourneyStepChange[] = afterJourney.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(step => ({
        step_id: step.id,
        order: step.order,
        name: step.name,
        change: 'added',
        after_description: step.description,
        friction_after: step.friction_risk,
        systems_added: step.systems_touched || [],
      }));
    return {
      journey_id: afterJourney.id,
      journey_name: afterJourney.name,
      persona: afterJourney.persona,
      before_step_count: 0,
      after_step_count: afterJourney.steps.length,
      step_changes: stepChanges,
      headline: `New journey "${afterJourney.name}" with ${afterJourney.steps.length} step${afterJourney.steps.length === 1 ? '' : 's'}.`,
      status: 'added',
    };
  }

  if (beforeJourney && !afterJourney) {
    const stepChanges: JourneyStepChange[] = beforeJourney.steps
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(step => ({
        step_id: step.id,
        order: step.order,
        name: step.name,
        change: 'removed',
        before_description: step.description,
        friction_before: step.friction_risk,
        systems_removed: step.systems_touched || [],
      }));
    return {
      journey_id: beforeJourney.id,
      journey_name: beforeJourney.name,
      persona: beforeJourney.persona,
      before_step_count: beforeJourney.steps.length,
      after_step_count: 0,
      step_changes: stepChanges,
      headline: `Journey "${beforeJourney.name}" was removed.`,
      status: 'removed',
    };
  }

  if (!beforeJourney || !afterJourney) return null;

  const beforeMap = new Map(beforeJourney.steps.map(s => [stepKey(s), s]));
  const afterMap = new Map(afterJourney.steps.map(s => [stepKey(s), s]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const stepChanges: JourneyStepChange[] = [];
  keys.forEach((key) => {
    const beforeStep = beforeMap.get(key);
    const afterStep = afterMap.get(key);

    if (!beforeStep && afterStep) {
      stepChanges.push({
        step_id: afterStep.id,
        order: afterStep.order,
        name: afterStep.name,
        change: 'added',
        after_description: afterStep.description,
        friction_after: afterStep.friction_risk,
        systems_added: afterStep.systems_touched || [],
      });
      return;
    }
    if (beforeStep && !afterStep) {
      stepChanges.push({
        step_id: beforeStep.id,
        order: beforeStep.order,
        name: beforeStep.name,
        change: 'removed',
        before_description: beforeStep.description,
        friction_before: beforeStep.friction_risk,
        systems_removed: beforeStep.systems_touched || [],
      });
      return;
    }
    if (!beforeStep || !afterStep) return;

    const reorderedOnly =
      beforeStep.order !== afterStep.order
      && (beforeStep.description || '') === (afterStep.description || '')
      && beforeStep.friction_risk === afterStep.friction_risk
      && hashSet(beforeStep.systems_touched || []) === hashSet(afterStep.systems_touched || []);

    const descriptionChanged = (beforeStep.description || '') !== (afterStep.description || '');
    const frictionChanged = beforeStep.friction_risk !== afterStep.friction_risk;
    const beforeSystems = new Set(beforeStep.systems_touched || []);
    const afterSystems = new Set(afterStep.systems_touched || []);
    const systemsAdded = [...afterSystems].filter(s => !beforeSystems.has(s));
    const systemsRemoved = [...beforeSystems].filter(s => !afterSystems.has(s));
    const orderChanged = beforeStep.order !== afterStep.order;

    if (reorderedOnly) {
      stepChanges.push({
        step_id: afterStep.id,
        order: afterStep.order,
        name: afterStep.name,
        change: 'reordered',
      });
      return;
    }

    if (descriptionChanged || frictionChanged || systemsAdded.length || systemsRemoved.length || orderChanged) {
      stepChanges.push({
        step_id: afterStep.id,
        order: afterStep.order,
        name: afterStep.name,
        change: 'modified',
        before_description: beforeStep.description,
        after_description: afterStep.description,
        friction_before: beforeStep.friction_risk,
        friction_after: afterStep.friction_risk,
        systems_added: systemsAdded,
        systems_removed: systemsRemoved,
      });
    }
  });

  stepChanges.sort((a, b) => a.order - b.order);

  const addedCount = stepChanges.filter(c => c.change === 'added').length;
  const removedCount = stepChanges.filter(c => c.change === 'removed').length;
  const modifiedCount = stepChanges.filter(c => c.change === 'modified').length;
  const reorderedCount = stepChanges.filter(c => c.change === 'reordered').length;

  const parts: string[] = [];
  if (addedCount) parts.push(`${addedCount} step${addedCount === 1 ? '' : 's'} added`);
  if (removedCount) parts.push(`${removedCount} removed`);
  if (modifiedCount) parts.push(`${modifiedCount} modified`);
  if (reorderedCount) parts.push(`${reorderedCount} reordered`);

  const status: DiffChangeType = stepChanges.length ? 'modified' : 'unchanged';
  const headline = stepChanges.length
    ? `"${afterJourney.name}" — ${parts.join(', ')}.`
    : `"${afterJourney.name}" — no step-level changes.`;

  return {
    journey_id: afterJourney.id,
    journey_name: afterJourney.name,
    persona: afterJourney.persona,
    before_step_count: beforeJourney.steps.length,
    after_step_count: afterJourney.steps.length,
    step_changes: stepChanges,
    headline,
    status,
  };
}

function buildJourneyStoryboards(before: AnalysisResult, after: AnalysisResult): JourneyStoryboard[] {
  const beforeJourneys = before.journey_graph?.journeys || [];
  const afterJourneys = after.journey_graph?.journeys || [];
  if (beforeJourneys.length === 0 && afterJourneys.length === 0) return [];

  const beforeMap = new Map(beforeJourneys.map(j => [j.id || normalize(j.name), j]));
  const afterMap = new Map(afterJourneys.map(j => [j.id || normalize(j.name), j]));
  const keys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const storyboards: JourneyStoryboard[] = [];
  keys.forEach((key) => {
    const storyboard = buildJourneyStoryboard(beforeMap.get(key), afterMap.get(key));
    if (storyboard && storyboard.status !== 'unchanged') {
      storyboards.push(storyboard);
    }
  });

  return storyboards.sort((a, b) => {
    const statusRank = { modified: 0, added: 1, removed: 2, unchanged: 3 } as const;
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    return b.step_changes.length - a.step_changes.length;
  });
}

function buildBusinessImpactNotes(
  moduleChanges: ModuleDiff[],
  journeyChanges: JourneyDiff[],
  riskChanges: RiskDiff[],
  techChanges: TechDiff[]
): string[] {
  const notes: string[] = [];
  const modulesAdded = moduleChanges.filter(item => item.status === 'added').length;
  const modulesRemoved = moduleChanges.filter(item => item.status === 'removed').length;
  const modulesModified = moduleChanges.filter(item => item.status === 'modified').length;
  if (modulesAdded > 0) notes.push(`${modulesAdded} new modules were introduced, expanding system capability.`);
  if (modulesRemoved > 0) notes.push(`${modulesRemoved} modules were removed, which may simplify maintenance or reduce scope.`);
  if (modulesModified > 0) notes.push(`${modulesModified} core modules changed behavior or structure.`);

  const journeysChanged = journeyChanges.filter(item => item.status !== 'unchanged').length;
  if (journeysChanged > 0) notes.push(`${journeysChanged} user journeys changed, potentially affecting product experience.`);

  const riskDelta = riskChanges.reduce((acc, item) => {
    if (item.status !== 'modified') return acc;
    return acc + severityWeight(item.severity_after || 'low') - severityWeight(item.severity_before || 'low');
  }, 0);
  if (riskDelta > 0) notes.push('Overall risk profile increased; review high-severity findings before release.');
  if (riskDelta < 0) notes.push('Risk profile improved compared to the previous version.');

  const techAdded = techChanges.filter(item => item.status === 'added').length;
  const techRemoved = techChanges.filter(item => item.status === 'removed').length;
  if (techAdded > 0) notes.push(`${techAdded} technologies were added, increasing implementation breadth.`);
  if (techRemoved > 0) notes.push(`${techRemoved} technologies were removed, reducing stack complexity.`);

  if (notes.length === 0) {
    notes.push('No major architecture or business-impacting changes were detected between these versions.');
  }

  return notes;
}

function calculateFileDiff(before: AnalysisResult, after: AnalysisResult): FileDiff[] {
  const beforeFiles = new Map<string, string>();
  const afterFiles = new Map<string, string>();

  for (const node of before.architecture?.nodes || []) {
    for (const file of node.files || []) {
      beforeFiles.set(file, node.id);
    }
  }
  for (const node of after.architecture?.nodes || []) {
    for (const file of node.files || []) {
      afterFiles.set(file, node.id);
    }
  }

  const allFiles = new Set([...beforeFiles.keys(), ...afterFiles.keys()]);
  const changes: FileDiff[] = [];

  allFiles.forEach((filePath) => {
    const inBefore = beforeFiles.has(filePath);
    const inAfter = afterFiles.has(filePath);
    if (!inBefore && inAfter) {
      changes.push({ path: filePath, status: 'added', module_id: afterFiles.get(filePath) });
    } else if (inBefore && !inAfter) {
      changes.push({ path: filePath, status: 'removed', module_id: beforeFiles.get(filePath) });
    } else if (inBefore && inAfter && beforeFiles.get(filePath) !== afterFiles.get(filePath)) {
      changes.push({ path: filePath, status: 'modified', module_id: afterFiles.get(filePath) });
    }
  });

  return changes.sort((a, b) => {
    const statusRank = { added: 0, removed: 1, modified: 2, unchanged: 3 } as const;
    return (statusRank[a.status] - statusRank[b.status]) || a.path.localeCompare(b.path);
  });
}

function assessBreakingChangeRisks(
  moduleChanges: ModuleDiff[],
  edgeChanges: EdgeDiff[],
  allEdges: ArchitectureEdge[]
): BreakingChangeRisk[] {
  const risks: BreakingChangeRisk[] = [];
  const changedModules = moduleChanges.filter(m => m.status === 'modified' || m.status === 'removed');

  // Build reverse dependency map: who depends on each module
  const dependents = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (!dependents.has(edge.to)) dependents.set(edge.to, new Set());
    dependents.get(edge.to)!.add(edge.from);
  }

  // Build module name lookup
  const moduleNames = new Map<string, string>();
  for (const m of moduleChanges) {
    moduleNames.set(m.id, m.name);
  }

  for (const mod of changedModules) {
    const deps = dependents.get(mod.id);
    const depCount = deps?.size || 0;
    if (depCount === 0 && mod.status === 'modified') continue;

    const depNames = deps ? Array.from(deps).map(id => moduleNames.get(id) || id) : [];

    let riskLevel: BreakingChangeRisk['risk_level'] = 'low';
    let reason = '';

    if (mod.status === 'removed') {
      riskLevel = depCount > 0 ? 'critical' : 'high';
      reason = depCount > 0
        ? `Removed module had ${depCount} dependent(s) that may break`
        : 'Module was removed from the codebase';
    } else {
      // Modified
      const complexityChanged = mod.before?.complexity !== mod.after?.complexity;
      const typeChanged = mod.before?.type !== mod.after?.type;

      if (depCount >= 3 && (complexityChanged || typeChanged)) {
        riskLevel = 'high';
        reason = `High-connectivity module (${depCount} dependents) changed ${typeChanged ? 'type' : 'complexity'}`;
      } else if (depCount >= 2) {
        riskLevel = 'medium';
        reason = `Modified module has ${depCount} dependent(s)`;
      } else {
        riskLevel = 'low';
        reason = `Modified module with ${depCount} dependent(s)`;
      }
    }

    risks.push({
      module_id: mod.id,
      module_name: mod.name,
      risk_level: riskLevel,
      reason,
      affected_dependents: depNames,
    });
  }

  return risks.sort((a, b) => {
    const levelRank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return levelRank[a.risk_level] - levelRank[b.risk_level];
  });
}

function buildDependencyCascades(
  moduleChanges: ModuleDiff[],
  allEdges: ArchitectureEdge[]
): DependencyCascade[] {
  const changedIds = new Set(
    moduleChanges
      .filter(m => m.status === 'modified' || m.status === 'added' || m.status === 'removed')
      .map(m => m.id)
  );

  if (changedIds.size === 0) return [];

  // Build forward dependency graph: who depends on each module (reverse edges)
  const dependents = new Map<string, Set<string>>();
  for (const edge of allEdges) {
    if (!dependents.has(edge.to)) dependents.set(edge.to, new Set());
    dependents.get(edge.to)!.add(edge.from);
  }

  const moduleNames = new Map<string, string>();
  for (const m of moduleChanges) {
    moduleNames.set(m.id, m.name);
  }

  const cascades: DependencyCascade[] = [];

  for (const modId of changedIds) {
    const directDeps = dependents.get(modId) || new Set<string>();
    const directNames = Array.from(directDeps).map(id => moduleNames.get(id) || id);

    // BFS for transitive dependents
    const visited = new Set<string>([modId]);
    const queue = Array.from(directDeps);
    const transitiveDeps = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

      const nextDeps = dependents.get(current);
      if (nextDeps) {
        for (const dep of nextDeps) {
          if (!visited.has(dep)) {
            transitiveDeps.add(dep);
            queue.push(dep);
          }
        }
      }
    }

    // Remove direct deps from transitive
    for (const d of directDeps) {
      transitiveDeps.delete(d);
    }

    const transitiveNames = Array.from(transitiveDeps).map(id => moduleNames.get(id) || id);
    const totalBlast = directDeps.size + transitiveDeps.size;

    if (totalBlast > 0) {
      cascades.push({
        changed_module_id: modId,
        changed_module_name: moduleNames.get(modId) || modId,
        directly_affected: directNames,
        transitively_affected: transitiveNames,
        total_blast_radius: totalBlast,
      });
    }
  }

  return cascades.sort((a, b) => b.total_blast_radius - a.total_blast_radius);
}

function getCachedDiff(cacheKey: string): VersionDiffResult | null {
  const record = diffCache.get(cacheKey);
  if (!record) return null;
  if (Date.now() > record.expires_at) {
    diffCache.delete(cacheKey);
    return null;
  }
  return record.value;
}

function setCachedDiff(cacheKey: string, value: VersionDiffResult): void {
  diffCache.set(cacheKey, {
    value,
    expires_at: Date.now() + DIFF_CACHE_TTL_MS,
  });
}

export function buildVersionDiff(before: AnalysisResult, after: AnalysisResult): VersionDiffResult {
  const cacheKey = `${before.id}:${after.id}`;
  const cached = getCachedDiff(cacheKey);
  if (cached) return cached;

  const moduleChanges = calculateModuleDiff(before, after);
  const edgeChanges = calculateEdgeDiff(before, after);
  const journeyChanges = calculateJourneyDiff(before, after);
  const riskChanges = calculateRiskDiff(before, after);
  const techChanges = calculateTechDiff(before, after);
  const fileChanges = calculateFileDiff(before, after);

  const afterEdges = after.architecture?.edges || [];
  const breakingChangeRisks = assessBreakingChangeRisks(moduleChanges, edgeChanges, afterEdges);
  const dependencyCascades = buildDependencyCascades(moduleChanges, afterEdges);

  // Phase-1 additions — stakeholder-facing diffs. Safe when source graphs absent.
  const capabilityChanges = calculateCapabilityDiff(before, after);
  const valueFeatureChanges = calculateValueFeatureDiff(before, after);
  const journeyStoryboards = buildJourneyStoryboards(before, after);

  const risksIncreased = riskChanges.filter(change => {
    if (change.status !== 'modified') return false;
    return severityWeight(change.severity_after || 'low') > severityWeight(change.severity_before || 'low');
  }).length;
  const risksDecreased = riskChanges.filter(change => {
    if (change.status !== 'modified') return false;
    return severityWeight(change.severity_after || 'low') < severityWeight(change.severity_before || 'low');
  }).length;

  const result: VersionDiffResult = {
    from: {
      analysis_id: before.id,
      analyzed_at: before.analyzed_at,
      branch: before.branch,
      commit_hash: before.commit_hash,
      commit_url: before.commit_url,
    },
    to: {
      analysis_id: after.id,
      analyzed_at: after.analyzed_at,
      branch: after.branch,
      commit_hash: after.commit_hash,
      commit_url: after.commit_url,
    },
    summary: {
      modules_added: moduleChanges.filter(item => item.status === 'added').length,
      modules_removed: moduleChanges.filter(item => item.status === 'removed').length,
      modules_modified: moduleChanges.filter(item => item.status === 'modified').length,
      edges_added: edgeChanges.filter(item => item.status === 'added').length,
      edges_removed: edgeChanges.filter(item => item.status === 'removed').length,
      edges_modified: edgeChanges.filter(item => item.status === 'modified').length,
      journeys_added: journeyChanges.filter(item => item.status === 'added').length,
      journeys_removed: journeyChanges.filter(item => item.status === 'removed').length,
      journeys_modified: journeyChanges.filter(item => item.status === 'modified').length,
      risks_increased: risksIncreased,
      risks_decreased: risksDecreased,
      tech_added: techChanges.filter(item => item.status === 'added').length,
      tech_removed: techChanges.filter(item => item.status === 'removed').length,
    },
    module_changes: moduleChanges,
    edge_changes: edgeChanges,
    journey_changes: journeyChanges,
    risk_changes: riskChanges,
    tech_changes: techChanges,
    file_changes: fileChanges,
    breaking_change_risks: breakingChangeRisks,
    dependency_cascades: dependencyCascades,
    business_impact_notes: buildBusinessImpactNotes(moduleChanges, journeyChanges, riskChanges, techChanges),
    capability_changes: capabilityChanges.length ? capabilityChanges : undefined,
    value_feature_changes: valueFeatureChanges.length ? valueFeatureChanges : undefined,
    journey_storyboards: journeyStoryboards.length ? journeyStoryboards : undefined,
    generated_at: new Date().toISOString(),
  };

  setCachedDiff(cacheKey, result);
  return result;
}

