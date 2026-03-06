import { z } from 'zod';
import { EvidenceRefSchema } from './lenses';

export const RepoArchetypeSchema = z.enum([
  'web_app',
  'api_service',
  'library',
  'data_ml',
  'infra',
  'mobile',
  'desktop',
  'unknown',
]);

export const ModuleTypeSchema = z.enum([
  'module',
  'service',
  'api',
  'ui',
  'data',
  'infra',
  'library',
  'integration',
  'utility',
  'unknown',
]);

export const ModuleLayerSchema = z.enum([
  'presentation',
  'application',
  'domain',
  'data',
  'infrastructure',
  'shared',
  'unknown',
]);

export const ModuleRelationSchema = z.enum([
  'imports',
  'calls',
  'reads',
  'writes',
  'publishes',
  'depends_on',
]);

export const ModuleGraphNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  module_type: ModuleTypeSchema,
  layer: ModuleLayerSchema,
  paths: z.array(z.string().min(1)).default([]),
  importance_score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema).default([]),
});

export const ModuleGraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  relation: ModuleRelationSchema,
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceRefSchema).default([]),
});

export const ModuleGraphSchema = z.object({
  root_summary: z.string().min(1),
  repo_archetype: RepoArchetypeSchema,
  nodes: z.array(ModuleGraphNodeSchema),
  edges: z.array(ModuleGraphEdgeSchema),
});

export const ModuleFallbackModeSchema = z.enum([
  'none',
  'tree_only',
  'manifest_only',
  'llm_only',
  'minimal',
]);

export const ModuleQualityReportSchema = z.object({
  coverage_score: z.number().min(0).max(1),
  low_confidence_ratio: z.number().min(0).max(1),
  missing_signals: z.array(z.string()),
  assumptions: z.array(z.string()),
  fallback_mode: ModuleFallbackModeSchema,
});

export const Module3DNodeKindSchema = z.enum(['directory', 'file']);
export const Module3DEdgeKindSchema = z.enum(['imports', 'depends_on', 'calls']);

export const Module3DNodeSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  node_kind: Module3DNodeKindSchema,
  cluster_id: z.string().min(1),
  path: z.string().min(1),
  loc: z.number().int().min(0),
  last_commit_at: z.string().optional(),
  hotness_score: z.number().min(0).max(1),
  importance_score: z.number().min(0).max(1),
  dependency_count: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
  position_seed: z.object({
    x: z.number(),
    y: z.number(),
    z: z.number(),
  }).optional(),
});

export const Module3DEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  edge_kind: Module3DEdgeKindSchema,
  confidence: z.number().min(0).max(1),
});

export const ModuleGraph3DSchema = z.object({
  nodes: z.array(Module3DNodeSchema),
  edges: z.array(Module3DEdgeSchema),
});

export const VisualQualityReportSchema = z.object({
  history_available: z.boolean(),
  loc_coverage: z.number().min(0).max(1),
  dependency_coverage: z.number().min(0).max(1),
  fallback_mode: z.enum(['none', 'tree_only', 'manifest_only', 'minimal']),
  notes: z.array(z.string()).default([]),
});

export const ModuleGraphBundleSchema = z.object({
  module_graph: ModuleGraphSchema,
  module_quality_report: ModuleQualityReportSchema,
  module_graph_3d: ModuleGraph3DSchema,
  visual_quality_report: VisualQualityReportSchema,
});

export type RepoArchetype = z.infer<typeof RepoArchetypeSchema>;
export type ModuleType = z.infer<typeof ModuleTypeSchema>;
export type ModuleLayer = z.infer<typeof ModuleLayerSchema>;
export type ModuleRelation = z.infer<typeof ModuleRelationSchema>;
export type ModuleGraphNode = z.infer<typeof ModuleGraphNodeSchema>;
export type ModuleGraphEdge = z.infer<typeof ModuleGraphEdgeSchema>;
export type ModuleGraph = z.infer<typeof ModuleGraphSchema>;
export type ModuleQualityReport = z.infer<typeof ModuleQualityReportSchema>;
export type Module3DNode = z.infer<typeof Module3DNodeSchema>;
export type Module3DEdge = z.infer<typeof Module3DEdgeSchema>;
export type ModuleGraph3D = z.infer<typeof ModuleGraph3DSchema>;
export type VisualQualityReport = z.infer<typeof VisualQualityReportSchema>;
export type ModuleGraphBundle = z.infer<typeof ModuleGraphBundleSchema>;
