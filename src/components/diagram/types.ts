// ABOUTME: Re-exports architecture types from the canonical source in lib/db.
// ABOUTME: Exists for backward compatibility with imports using this path.
export type {
  ArchitectureNode,
  ArchitectureEdge,
  ArchitectureVisualization,
  ArchitectureDomain,
  BusinessContext,
  NarrativeMode,
  DataFlowStep,
} from '@/lib/db';
