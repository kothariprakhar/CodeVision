# Architecture & Data Flow Diagrams — Design

**Date:** 2026-03-09
**Status:** Approved

## Problem

The current analysis module shows an MVC flow diagram (View / Controller / Model columns) which is technically-framed and hard for non-developers to interpret. We want two diagrams that communicate clearly to a non-technical stakeholder what was built and how data moves through it.

## Goal

Replace the MVC diagram in `ArchitectureDiagram.tsx` with two views:
1. **Architecture Diagram** — a grid of business-named modules showing what the system is made of
2. **Data Flow Diagram** — a vertical flowchart showing how data moves through the system at a high level

---

## View 1: Architecture Diagram

### Layout

A responsive 3-column grid of module cards. Each card represents one high-level business module Claude identified (e.g. "Authentication", "Analysis Engine", "GitHub Integration").

### Card contents
- Module name (prominent)
- Description (plain language, 1–2 sentences, written for non-technical stakeholders)
- File count + complexity badge (low / medium / high)
- Small colour dot indicating technical type (ui=purple, api=blue, service=cyan, database=green, external=orange) — subtle, no label

### Interaction
- Click a card → highlights it with a border in its type colour
- Cards it **calls/uses** → yellow outline
- Cards that **use it** → blue outline
- Detail panel (right side) shows: name, full description, files list, "→ Calls" list, "← Used by" list with edge type
- No SVG connection lines (too noisy in a free-form grid; highlighting is cleaner)

---

## View 2: Data Flow Diagram

### Layout

Vertical flowchart, centred, ~400px wide. Derived from a new `dataFlow` field that Claude explicitly produces.

### Flow stages

Each stage is a rounded box containing:
- Stage label (e.g. "Code is fetched")
- One-sentence description of what happens at this stage
- Module names involved (up to 4, with "• " prefix; "+N more" if needed)

Stages are connected by downward arrows. If both `database` and `external` nodes appear as terminal stages, they are shown side-by-side at the bottom.

Stages with no matching nodes are skipped, so the diagram adapts to any codebase shape.

---

## Backend Changes

### Why backend changes are needed

The current Claude prompt:
- Produces many fine-grained technical nodes (individual routes, utility files) — we want 5–12 high-level business modules
- Writes technical-audience descriptions
- Names nodes after code artefacts (`analyzeCodeAlignment`) rather than business functions ("Analysis Engine")
- Has no explicit data flow narrative — we currently infer flow from node types, losing meaningful context

### Changes (no DB migration required — `architecture` is JSONB)

**1. Update the Claude prompt in `src/lib/services/claude.ts`:**
- Ask for 5–12 high-level, business-named modules
- Require plain-language descriptions ("what a non-technical stakeholder would call this")
- Add a `dataFlow` array to the requested JSON output

**2. Add `dataFlow` to the `architecture` JSON structure:**
```json
"dataFlow": [
  {
    "step": 1,
    "label": "User submits project",
    "description": "User provides a GitHub URL and uploads requirements documents",
    "nodeIds": ["auth", "project-mgmt"]
  },
  {
    "step": 2,
    "label": "Code is fetched",
    "description": "GitHub repo is downloaded and parsed into readable files",
    "nodeIds": ["github-integration"]
  },
  {
    "step": 3,
    "label": "AI analysis runs",
    "description": "Claude compares the code against the requirements documents",
    "nodeIds": ["analysis-engine"]
  },
  {
    "step": 4,
    "label": "Results stored and shown",
    "description": "Findings are saved and displayed as a report with architecture diagrams",
    "nodeIds": ["database", "reporting"]
  }
]
```

**3. Update `ArchitectureVisualization` type in `src/lib/db.ts`:**
```typescript
export interface DataFlowStep {
  step: number;
  label: string;
  description: string;
  nodeIds: string[];
}

export interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  dataFlow?: DataFlowStep[];
}
```

---

## Files to Change

| File | Change |
|------|--------|
| `src/lib/services/claude.ts` | Update prompt + output type |
| `src/lib/db.ts` | Add `DataFlowStep` interface, update `ArchitectureVisualization` |
| `src/components/ArchitectureDiagram.tsx` | Full rewrite: toggle between architecture grid + data flow chart |
| `src/app/projects/[id]/page.tsx` | Update `ArchitectureVisualization` local interface to match |

---

## Out of Scope (for now)

- SVG connection lines between module cards (add later once we have a stable layout)
- Detailed per-scenario data flow traces (e.g. "trace the login flow end to end")
- Filtering/searching modules by name
