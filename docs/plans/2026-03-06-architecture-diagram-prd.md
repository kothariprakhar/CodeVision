# Architecture Diagram Feature PRD

## 1) Product Summary

Add a new **Architecture Diagram** capability that helps non-technical stakeholders understand:

- the major modules in a repository,
- how those modules connect,
- what is changing recently,
- where analysis confidence is weak.

The feature must support many repository types (web, backend, library, data/ML, infra) and degrade gracefully when signals are sparse.

## 2) Goals and Non-Goals

### Goals

- Provide a new tab in project analysis for architecture visualization.
- Provide both:
  - **2D Overview** (fast, reliable fallback),
  - **3D Cyber-Minimalist Graph** (premium exploration mode).
- Use deterministic extraction first, LLM enrichment second.
- Persist artifacts for reproducibility per analysis version.
- Include confidence, evidence, and quality diagnostics.

### Non-Goals (for this phase)

- Perfect language-level AST accuracy for every ecosystem.
- Full enterprise-scale architecture modeling of every file in very large monorepos in first payload.
- Real-time collaboration features.

## 3) Target Users

- Product managers
- Non-technical founders
- Engineering leaders who need fast orientation on unknown repositories

## 4) User Stories

- As a PM, I can open Architecture Diagram and see top modules and dependencies in under a few seconds.
- As a founder, I can click a module and understand what it does and why confidence is high/low.
- As a stakeholder, I can switch to 3D mode for exploratory navigation and recency hotspots.
- As any user, I get clear fallback explanations instead of broken visuals when data is incomplete.

## 5) Functional Requirements

### 5.1 Data Artifacts

Persist new artifacts in `analysis_results`:

- `module_graph` (2D/domain-level)
- `module_quality_report`
- `module_graph_3d` (directory/file-level visual graph)
- `visual_quality_report`

### 5.2 API Endpoints

- `GET /api/analysis/:projectId/module-graph?version=:analysisId`
  - returns top modules + depth-1 edges + quality.
- `GET /api/analysis/lenses/:analysisId/module/:nodeId?depth=2`
  - returns lazy drill-down node neighborhood + evidence.
- `GET /api/analysis/:projectId/module-graph-3d?version=:analysisId`
  - returns 3D-ready graph + visual quality report.
- Optional next phase:
  - `POST /api/analysis/:projectId/module-graph/regenerate`
  - `POST /api/analysis/:projectId/module-graph-3d/regenerate`

### 5.3 Frontend UX

- Add new tab: `Architecture Diagram`.
- Add mode toggle:
  - `2D Overview`
  - `3D Graph`
- 2D view:
  - top modules list
  - dependency links
  - detail drawer
  - quality banner/fallback banner
- 3D view:
  - dark void + subtle grid floor
  - directory clusters and file nodes
  - recency color temperature
  - node size by LOC
  - hover metadata
  - click focus (fly-to behavior or equivalent smooth camera transition)

## 6) Data Contracts

### 6.1 `module_graph`

- `root_summary: string`
- `repo_archetype: web_app|api_service|library|data_ml|infra|mobile|desktop|unknown`
- `nodes[]`:
  - `id`, `label`, `module_type`, `layer`,
  - `paths[]`,
  - `importance_score`,
  - `confidence`,
  - `evidence[]`
- `edges[]`:
  - `from`, `to`,
  - `relation: imports|calls|reads|writes|publishes|depends_on`,
  - `confidence`,
  - `evidence[]`

### 6.2 `module_quality_report`

- `coverage_score`
- `low_confidence_ratio`
- `missing_signals[]`
- `assumptions[]`
- `fallback_mode: none|tree_only|manifest_only|llm_only|minimal`

### 6.3 `module_graph_3d`

- `nodes[]`:
  - `id`, `label`, `node_kind: directory|file`,
  - `cluster_id`, `path`,
  - `loc`,
  - `last_commit_at?`,
  - `hotness_score`,
  - `importance_score`,
  - `dependency_count`,
  - `confidence`,
  - `position_seed?`
- `edges[]`:
  - `from`, `to`,
  - `edge_kind: imports|depends_on|calls`,
  - `confidence`

### 6.4 `visual_quality_report`

- `history_available: boolean`
- `loc_coverage: number`
- `dependency_coverage: number`
- `fallback_mode: none|tree_only|manifest_only|minimal`
- `notes[]`

## 7) Architecture and Pipeline

1. Repo profiling (manifest + ecosystem detection)
2. Deterministic module boundary detection
3. Dependency extraction:
   - import parsing + heuristics
4. LOC and file metadata extraction
5. Commit recency extraction:
   - git history when available
   - GitHub API sampling fallback
6. Ranking + pruning for readability
7. Optional LLM enrichment (labels/descriptions only, strict schema validation)
8. Quality diagnostics and fallback assignment
9. Persist in DB for versioned reuse

Recency formula:

`hotness_score = exp(-days_since_last_commit / 45) * log(1 + commits_90d)`

## 8) Visual Design Direction

- Theme: **Cyber-Minimalist**
- 3D scene:
  - dark void background
  - subtle grid floor
  - semitransparent light-trail edges
  - glow/bloom on hot nodes
- Overlay UI:
  - glassmorphism cards
  - concise metrics and legend

## 9) Performance Requirements

- 2D first payload target:
  - `< 1.5s` for small/medium repos
- Drill-down:
  - `< 500ms` cached
  - `< 1.2s` uncached
- 3D rendering:
  - target near 60fps medium repos
  - minimum acceptable 45fps large repos

Optimization strategy:

- instanced meshes for nodes
- batched line geometry for edges
- throttled hover/raycast
- node cap + progressive reveal
- worker-based force simulation (phase 2+)

## 10) Failure Handling (Required)

- No parsable source -> folder-only map (`tree_only`) + banner.
- Unsupported language -> manifest/directory clustering fallback.
- Huge monorepo/timeouts -> sampled partial graph + explicit partial-analysis message.
- Missing commit history -> disable recency glow, keep architecture graph.
- No dependency edges -> isolated module cards + “interaction signals unavailable.”
- WebGL unsupported or runtime error -> auto fallback to 2D.
- Empty graph -> non-breaking “What we could not determine.”

## 11) Security and Reliability

- Preserve current project ownership/auth checks for all endpoints.
- Do not expose secrets in artifacts.
- Treat README/docs prompts as untrusted in LLM enrichment.
- Persist deterministic artifacts to reduce rerun drift.

## 12) Rollout Plan

1. Phase 1: Schema + deterministic extraction + APIs.
2. Phase 2: 2D tab + lazy drill-down + quality UI.
3. Phase 3: 3D graph renderer + interactions.
4. Phase 4: perf hardening + failure hardening + telemetry.
5. Phase 5: feature flag default-on.

## 13) Acceptance Criteria

- User can identify top 5–10 modules and relationships.
- Major nodes include evidence and confidence.
- Sparse/unsupported repos still render usable fallback.
- Re-runs on same commit are structurally stable.
- No hard UI failures.

## 14) Test Plan

### Unit

- module boundary detection
- dependency extraction
- ranking/pruning
- LOC + recency scoring
- schema validation and repair

### Integration

- ingest -> `module_graph`
- ingest -> `module_graph_3d`
- lazy node drill-down APIs

### Golden Repos

- frontend-heavy
- backend-only
- library
- data/ML
- infra
- monorepo

### Failure Modes

- empty repo
- malformed code
- token denied
- timeout
- LLM failure
- WebGL fallback path

