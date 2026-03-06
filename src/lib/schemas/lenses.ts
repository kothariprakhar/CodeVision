import { z } from 'zod';

export const EvidenceRefSchema = z.object({
  source_type: z.enum([
    'file',
    'api_route',
    'db_table',
    'doc',
    'config',
    'inference',
  ]),
  ref: z.string().min(1),
  snippet: z.string().min(1).max(500),
  line_start: z.number().int().positive().optional(),
  line_end: z.number().int().positive().optional(),
});

export const LensRiskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  impact: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema).default([]),
});

export const CapabilityNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  node_type: z.enum([
    'capability_domain',
    'capability',
    'sub_capability',
    'system_component',
    'api',
    'datastore',
    'external_service',
  ]),
  depth: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  description: z.string().min(1),
  business_value: z.string().min(1),
  maturity: z.enum(['nascent', 'developing', 'stable', 'advanced', 'unknown']),
  owner_role: z.string().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema).default([]),
  risks: z.array(LensRiskSchema).default([]),
  kpis: z.array(z.string()).default([]),
});

export const CapabilityEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relation: z.enum([
    'contains',
    'depends_on',
    'enables',
    'integrates_with',
    'stores_in',
    'exposes',
  ]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema).default([]),
});

export const CapabilityGraphSchema = z.object({
  top_level_summary: z.string().min(1),
  nodes: z.array(CapabilityNodeSchema),
  edges: z.array(CapabilityEdgeSchema),
});

export const JourneyStepSchema = z.object({
  id: z.string().min(1),
  journey_id: z.string().min(1),
  order: z.number().int().positive(),
  name: z.string().min(1),
  step_type: z.enum([
    'entry',
    'action',
    'validation',
    'payment',
    'system',
    'notification',
    'exit',
    'unknown',
  ]),
  description: z.string().min(1),
  business_outcome: z.string().min(1),
  friction_risk: z.enum(['low', 'medium', 'high', 'critical']),
  dropoff_likelihood: z.number().min(0).max(1).optional(),
  systems_touched: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema).default([]),
  risks: z.array(LensRiskSchema).default([]),
});

export const JourneySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  persona: z.string().min(1),
  goal: z.string().min(1),
  kpi: z.string().min(1),
  steps: z.array(JourneyStepSchema).min(1),
});

export const JourneyGraphSchema = z.object({
  summary: z.string().min(1),
  journeys: z.array(JourneySchema),
});

export const QualityReportSchema = z.object({
  coverage_score: z.number().min(0).max(1),
  evidence_density: z.number().min(0).max(1),
  low_confidence_ratio: z.number().min(0).max(1),
  missing_signals: z.array(z.string()),
  assumptions: z.array(z.string()),
  needs_manual_input: z.array(z.string()),
});

export const LensBundleSchema = z.object({
  capability_graph: CapabilityGraphSchema,
  journey_graph: JourneyGraphSchema,
  quality_report: QualityReportSchema,
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;
export type LensRisk = z.infer<typeof LensRiskSchema>;
export type CapabilityNode = z.infer<typeof CapabilityNodeSchema>;
export type CapabilityEdge = z.infer<typeof CapabilityEdgeSchema>;
export type CapabilityGraph = z.infer<typeof CapabilityGraphSchema>;
export type JourneyStep = z.infer<typeof JourneyStepSchema>;
export type Journey = z.infer<typeof JourneySchema>;
export type JourneyGraph = z.infer<typeof JourneyGraphSchema>;
export type QualityReport = z.infer<typeof QualityReportSchema>;
export type LensBundle = z.infer<typeof LensBundleSchema>;
