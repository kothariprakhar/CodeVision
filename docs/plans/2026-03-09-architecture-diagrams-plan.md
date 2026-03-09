# Architecture & Data Flow Diagrams Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the MVC flow diagram with an architecture module grid and an explicit data flow flowchart, backed by an improved Claude prompt that produces business-level modules and a narrated data flow.

**Architecture:** Two views toggled by a pill switcher inside `ArchitectureDiagram.tsx`. The Claude prompt is updated to produce 5–12 high-level business-named modules + an explicit `dataFlow` array. No DB migration needed (architecture is JSONB). Old analyses without `dataFlow` fall back to type-inferred stages.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Jest + React Testing Library (to be installed), Playwright (to be installed)

---

## Task 1: Install and configure Jest + React Testing Library

**Files:**
- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `package.json`

**Step 1: Install test dependencies**

```bash
npm install --save-dev jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/jest ts-jest
```

Expected: packages installed, no errors.

**Step 2: Create `jest.config.ts`**

```ts
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};

export default createJestConfig(config);
```

**Step 3: Create `jest.setup.ts`**

```ts
// jest.setup.ts
import '@testing-library/jest-dom';
```

**Step 4: Add test script to `package.json`**

In the `"scripts"` section, add:
```json
"test": "jest",
"test:watch": "jest --watch"
```

**Step 5: Verify setup works**

```bash
npx jest --version
```

Expected: prints Jest version, no errors.

---

## Task 2: Write failing tests for `ArchitectureDiagram`

**Files:**
- Create: `src/components/__tests__/ArchitectureDiagram.test.tsx`

**Step 1: Create the test file with fixture data**

```tsx
// src/components/__tests__/ArchitectureDiagram.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ArchitectureDiagram from '../ArchitectureDiagram';
import type { ArchitectureVisualization } from '@/lib/db';

const testArchitecture: ArchitectureVisualization = {
  nodes: [
    {
      id: 'auth',
      name: 'Authentication',
      type: 'service',
      complexity: 'medium',
      description: 'Handles user login and session management',
      files: ['src/lib/auth.ts'],
    },
    {
      id: 'ui',
      name: 'Project Dashboard',
      type: 'ui',
      complexity: 'low',
      description: 'Main interface for managing projects',
      files: ['src/app/projects/page.tsx'],
    },
    {
      id: 'api',
      name: 'Analysis API',
      type: 'api',
      complexity: 'high',
      description: 'REST endpoints that trigger and retrieve analysis',
      files: ['src/app/api/analyze/route.ts'],
    },
    {
      id: 'db',
      name: 'Database',
      type: 'database',
      complexity: 'low',
      description: 'Stores all project and analysis data',
      files: ['src/lib/db.ts'],
    },
  ],
  edges: [
    { from: 'ui', to: 'api', type: 'calls' },
    { from: 'api', to: 'auth', type: 'imports' },
    { from: 'api', to: 'db', type: 'stores' },
  ],
  dataFlow: [
    {
      step: 1,
      label: 'User logs in',
      description: 'User authenticates with email and password',
      nodeIds: ['auth', 'ui'],
    },
    {
      step: 2,
      label: 'Analysis triggered',
      description: 'User submits their GitHub repo for analysis',
      nodeIds: ['ui', 'api'],
    },
    {
      step: 3,
      label: 'Results stored',
      description: 'Analysis findings are saved and displayed',
      nodeIds: ['api', 'db'],
    },
  ],
};

const emptyArchitecture: ArchitectureVisualization = {
  nodes: [],
  edges: [],
};

describe('ArchitectureDiagram', () => {
  it('shows fallback message when there are no nodes', () => {
    render(<ArchitectureDiagram architecture={emptyArchitecture} />);
    expect(screen.getByText('No architecture data available')).toBeInTheDocument();
  });

  it('renders the Architecture view toggle button', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByRole('button', { name: 'Architecture' })).toBeInTheDocument();
  });

  it('renders the Data Flow view toggle button', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByRole('button', { name: 'Data Flow' })).toBeInTheDocument();
  });

  it('shows module cards in architecture view by default', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByText('Authentication')).toBeInTheDocument();
    expect(screen.getByText('Project Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Analysis API')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
  });

  it('switches to data flow view when Data Flow button is clicked', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Data Flow' }));
    expect(screen.getByText('User / Browser')).toBeInTheDocument();
    expect(screen.getByText('User logs in')).toBeInTheDocument();
    expect(screen.getByText('Analysis triggered')).toBeInTheDocument();
  });

  it('shows detail panel prompt when no node is selected', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    expect(screen.getByText('Select a module to explore')).toBeInTheDocument();
  });

  it('shows node details in detail panel when a module card is clicked', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.getByText('Handles user login and session management')).toBeInTheDocument();
    expect(screen.getByText('src/lib/auth.ts')).toBeInTheDocument();
  });

  it('shows outgoing connections in detail panel', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    // ui → api, so clicking "Project Dashboard" should show "Analysis API" as outgoing
    fireEvent.click(screen.getByText('Project Dashboard'));
    expect(screen.getByText('→ Calls / Uses')).toBeInTheDocument();
    // Analysis API should appear in connections list
    const connectionItems = screen.getAllByText('Analysis API');
    expect(connectionItems.length).toBeGreaterThanOrEqual(1);
  });

  it('shows incoming connections in detail panel', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    // api → auth, so clicking "Authentication" should show "Analysis API" as incoming
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.getByText('← Used by')).toBeInTheDocument();
  });

  it('deselects a node when clicked again', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.queryByText('Select a module to explore')).not.toBeInTheDocument();
    // Click the card text again (card is a button containing this text)
    fireEvent.click(screen.getByText('Authentication'));
    expect(screen.getByText('Select a module to explore')).toBeInTheDocument();
  });

  it('shows inferred flow stages in data flow view when dataFlow is absent', () => {
    const noDataFlow: ArchitectureVisualization = { ...testArchitecture, dataFlow: undefined };
    render(<ArchitectureDiagram architecture={noDataFlow} />);
    fireEvent.click(screen.getByRole('button', { name: 'Data Flow' }));
    expect(screen.getByText('User / Browser')).toBeInTheDocument();
    // Should show type-inferred stage label
    expect(screen.getByText('API Routes')).toBeInTheDocument();
  });

  it('shows explicit dataFlow steps when dataFlow is present', () => {
    render(<ArchitectureDiagram architecture={testArchitecture} />);
    fireEvent.click(screen.getByRole('button', { name: 'Data Flow' }));
    expect(screen.getByText('User authenticates with email and password')).toBeInTheDocument();
    expect(screen.getByText('User submits their GitHub repo for analysis')).toBeInTheDocument();
  });
});
```

**Step 2: Run the tests to confirm they all fail (component not yet rewritten)**

```bash
npx jest src/components/__tests__/ArchitectureDiagram.test.tsx --no-coverage
```

Expected: multiple test failures (component still has MVC layout). This confirms the tests are wired up correctly.

---

## Task 3: Update TypeScript types in `db.ts`

**Files:**
- Modify: `src/lib/db.ts`

**Step 1: Add `DataFlowStep` interface and update `ArchitectureVisualization`**

Find the `ArchitectureVisualization` interface in `src/lib/db.ts` (around line 104) and add `DataFlowStep` above it, then add `dataFlow` to the visualization type:

```ts
// Add this interface ABOVE ArchitectureVisualization:
export interface DataFlowStep {
  step: number;
  label: string;
  description: string;
  nodeIds: string[];
}

// Update ArchitectureVisualization to:
export interface ArchitectureVisualization {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  dataFlow?: DataFlowStep[];
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 4: Update Claude prompt in `claude.ts`

**Files:**
- Modify: `src/lib/services/claude.ts`

**Step 1: Update the system prompt**

Replace the architecture section in `systemPrompt` (the paragraph starting with `3. Map the ARCHITECTURE`). The current text is:

```
3. Map the ARCHITECTURE: Identify major components/modules, their complexity, and how they connect
```

Replace with:

```
3. Map the ARCHITECTURE: Identify 5-12 high-level business modules. Use names a product manager or investor would recognise (e.g. "Authentication", "Analysis Engine", "GitHub Integration") — NOT code artifact names like "analyzeCodeAlignment" or "route.ts". Write each description in plain language that a non-technical stakeholder can understand without any coding knowledge.

4. Describe the DATA FLOW: Narrate 3-6 steps showing how a typical user action flows through the system to produce a result. Write for a non-technical reader — describe WHAT happens, not HOW.
```

**Step 2: Update the JSON schema in the system prompt**

The current `architecture` JSON example in the system prompt ends at `edges`. Add `dataFlow` to the schema:

Find:
```
    "edges": [
      {
        "from": "source-node-id",
        "to": "target-node-id",
        "type": "imports" or "calls" or "stores" or "renders"
      }
    ]
  }
```

Replace with:
```
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
        "description": "One plain-English sentence describing what happens at this stage for a non-technical reader",
        "nodeIds": ["node-id-1", "node-id-2"]
      }
    ]
  }
```

**Step 3: Update the `Architecture analysis guide` section**

Find the current guide:
```
Architecture analysis guide:
- Node types: ui (frontend components), api (API routes/endpoints), service (business logic), database (data storage), external (third-party services), component (generic module)
- Complexity is based on: coupling (number of dependencies), code size, and internal complexity
  - low: Simple, few dependencies, straightforward logic
  - medium: Moderate dependencies, some business logic
  - high: Many dependencies, complex logic, critical to system
- Edges represent how components depend on each other
```

Replace with:
```
Architecture analysis guide:
- Aim for 5-12 nodes total. Merge closely related files into one meaningful module rather than listing every file separately.
- Node names must be business-friendly: "Authentication" not "auth.ts", "Analysis Engine" not "analyzeCodeAlignment"
- Node descriptions must be non-technical: a product manager should understand them without any coding background
- Node types: ui (anything the user sees), api (request handlers/routes), service (business logic), database (data storage), external (third-party APIs/services), component (shared utility modules)
- Complexity is based on coupling, code size, and internal logic: low = simple, medium = moderate, high = many dependencies and critical to the system
- Edges represent runtime dependencies between modules
- dataFlow steps should tell a story: "User submits form → API validates request → Service processes data → Results are stored"
- dataFlow nodeIds must reference valid node ids from the nodes array
```

**Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 5: Rewrite `ArchitectureDiagram.tsx`

**Files:**
- Modify: `src/components/ArchitectureDiagram.tsx`

**Step 1: Replace the entire file content**

```tsx
'use client';

// ABOUTME: Architecture and data flow visualization component for analyzed projects.
// ABOUTME: Renders a module grid and a data flow flowchart derived from Claude's analysis.

import { useState, useMemo } from 'react';
import type { ArchitectureVisualization, ArchitectureNode } from '@/lib/db';

interface ArchitectureDiagramProps {
  architecture: ArchitectureVisualization;
}

const TYPE_CONFIG: Record<ArchitectureNode['type'], {
  label: string;
  dotClass: string;
  textClass: string;
  selectedBorderClass: string;
  selectedBg: string;
}> = {
  ui:        { label: 'Frontend',   dotClass: 'bg-purple-400', textClass: 'text-purple-400', selectedBorderClass: 'border-purple-500 ring-1 ring-purple-500/50', selectedBg: 'rgba(168,85,247,0.12)' },
  api:       { label: 'API',        dotClass: 'bg-blue-400',   textClass: 'text-blue-400',   selectedBorderClass: 'border-blue-500 ring-1 ring-blue-500/50',     selectedBg: 'rgba(59,130,246,0.12)' },
  service:   { label: 'Service',    dotClass: 'bg-cyan-400',   textClass: 'text-cyan-400',   selectedBorderClass: 'border-cyan-500 ring-1 ring-cyan-500/50',     selectedBg: 'rgba(6,182,212,0.12)' },
  component: { label: 'Component',  dotClass: 'bg-indigo-400', textClass: 'text-indigo-400', selectedBorderClass: 'border-indigo-500 ring-1 ring-indigo-500/50', selectedBg: 'rgba(99,102,241,0.12)' },
  database:  { label: 'Database',   dotClass: 'bg-green-400',  textClass: 'text-green-400',  selectedBorderClass: 'border-green-500 ring-1 ring-green-500/50',   selectedBg: 'rgba(34,197,94,0.12)' },
  external:  { label: 'External',   dotClass: 'bg-orange-400', textClass: 'text-orange-400', selectedBorderClass: 'border-orange-500 ring-1 ring-orange-500/50', selectedBg: 'rgba(249,115,22,0.12)' },
};

const COMPLEXITY_BADGE = {
  low:    'bg-green-500/20 text-green-400 border-green-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  high:   'bg-red-500/20 text-red-400 border-red-500/40',
};

// Ordered stages used when architecture.dataFlow is absent (fallback)
const INFERRED_STAGES: { types: ArchitectureNode['type'][]; label: string; bg: string; border: string; textClass: string }[] = [
  { types: ['ui'],                  label: 'Frontend',          bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.3)', textClass: 'text-purple-400' },
  { types: ['api'],                 label: 'API Routes',        bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.3)', textClass: 'text-blue-400' },
  { types: ['service','component'], label: 'Business Logic',    bg: 'rgba(6,182,212,0.08)',  border: 'rgba(6,182,212,0.3)',  textClass: 'text-cyan-400' },
  { types: ['database'],            label: 'Data Storage',      bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.3)',  textClass: 'text-green-400' },
  { types: ['external'],            label: 'External Services', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', textClass: 'text-orange-400' },
];

function DownArrow() {
  return (
    <div className="flex flex-col items-center my-1" aria-hidden="true">
      <div className="w-px h-4 bg-gray-600" />
      <svg width="10" height="7" viewBox="0 0 10 7" className="text-gray-600 fill-current">
        <polygon points="5,7 0,0 10,0" />
      </svg>
    </div>
  );
}

export default function ArchitectureDiagram({ architecture }: ArchitectureDiagramProps) {
  const [view, setView] = useState<'architecture' | 'dataflow'>('architecture');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const connections = useMemo(() => {
    if (!selectedNodeId) return { outgoing: [], incoming: [] };
    const outgoing = architecture.edges
      .filter(e => e.from === selectedNodeId)
      .map(e => ({ node: architecture.nodes.find(n => n.id === e.to)!, edgeType: e.type }))
      .filter(c => c.node);
    const incoming = architecture.edges
      .filter(e => e.to === selectedNodeId)
      .map(e => ({ node: architecture.nodes.find(n => n.id === e.from)!, edgeType: e.type }))
      .filter(c => c.node);
    return { outgoing, incoming };
  }, [selectedNodeId, architecture]);

  const connectedNodeIds = useMemo(() => new Set([
    ...connections.outgoing.map(c => c.node.id),
    ...connections.incoming.map(c => c.node.id),
  ]), [connections]);

  const selectedNode = selectedNodeId
    ? architecture.nodes.find(n => n.id === selectedNodeId)
    : null;

  // Inferred flow stages for fallback when architecture.dataFlow is absent
  const inferredFlowStages = useMemo(() => {
    const byType = new Map<string, ArchitectureNode[]>();
    architecture.nodes.forEach(n => {
      byType.set(n.type, [...(byType.get(n.type) || []), n]);
    });
    return INFERRED_STAGES
      .map(s => ({
        ...s,
        nodes: s.types.flatMap(t => byType.get(t) || []),
      }))
      .filter(s => s.nodes.length > 0);
  }, [architecture.nodes]);

  if (!architecture || architecture.nodes.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No architecture data available
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex gap-1 mb-5 p-1 bg-white/5 rounded-xl w-fit">
        <button
          onClick={() => setView('architecture')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            view === 'architecture' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Architecture
        </button>
        <button
          onClick={() => setView('dataflow')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
            view === 'dataflow' ? 'bg-purple-500/30 text-purple-300' : 'text-gray-400 hover:text-gray-300'
          }`}
        >
          Data Flow
        </button>
      </div>

      {/* ── Architecture view ── */}
      {view === 'architecture' && (
        <div>
          <p className="text-xs text-gray-500 mb-4">
            {architecture.nodes.length} modules · {architecture.edges.length} connections · Click a module to explore connections
          </p>
          <div className="flex gap-5">
            {/* Module grid */}
            <div className="flex-1 grid grid-cols-3 gap-3">
              {architecture.nodes.map(node => {
                const config = TYPE_CONFIG[node.type];
                const isSelected   = selectedNodeId === node.id;
                const isOutgoing   = connections.outgoing.some(c => c.node.id === node.id);
                const isIncoming   = connections.incoming.some(c => c.node.id === node.id);
                const isDimmed     = !!selectedNodeId && !isSelected && !connectedNodeIds.has(node.id);

                let cardClass = 'w-full text-left p-3 rounded-xl border transition-all duration-150 ';
                let cardStyle: React.CSSProperties = {};

                if (isSelected) {
                  cardClass += config.selectedBorderClass;
                  cardStyle = { background: config.selectedBg };
                } else if (isOutgoing) {
                  cardClass += 'border-yellow-500/60 bg-yellow-500/5';
                } else if (isIncoming) {
                  cardClass += 'border-blue-500/60 bg-blue-500/5';
                } else if (isDimmed) {
                  cardClass += 'border-white/5 opacity-40';
                } else {
                  cardClass += 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]';
                }

                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                    className={cardClass}
                    style={cardStyle}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${config.dotClass}`} />
                      <span className="font-semibold text-sm text-white leading-tight">{node.name}</span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 ml-4 mb-2">
                      {node.description}
                    </p>
                    <div className="flex items-center gap-2 ml-4">
                      <span className="text-xs text-gray-500">
                        {node.files.length} {node.files.length === 1 ? 'file' : 'files'}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded border ${COMPLEXITY_BADGE[node.complexity]}`}>
                        {node.complexity}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            <div className="w-56 flex-shrink-0">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] min-h-[200px] p-3">
                {selectedNode ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-white text-sm">{selectedNode.name}</h3>
                      <span className={`text-xs ${TYPE_CONFIG[selectedNode.type].textClass}`}>
                        {TYPE_CONFIG[selectedNode.type].label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 leading-relaxed">{selectedNode.description}</p>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Files ({selectedNode.files.length})</div>
                      <div className="space-y-0.5 max-h-16 overflow-y-auto">
                        {selectedNode.files.map((f, i) => (
                          <div key={i} className="text-xs text-gray-400 truncate">{f}</div>
                        ))}
                      </div>
                    </div>
                    {connections.outgoing.length > 0 && (
                      <div>
                        <div className="text-xs text-yellow-500/80 mb-1">→ Calls / Uses</div>
                        <div className="space-y-0.5">
                          {connections.outgoing.map((c, i) => (
                            <div key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/60 flex-shrink-0" />
                              <span className="truncate">{c.node.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {connections.incoming.length > 0 && (
                      <div>
                        <div className="text-xs text-blue-400/80 mb-1">← Used by</div>
                        <div className="space-y-0.5">
                          {connections.incoming.map((c, i) => (
                            <div key={i} className="text-xs text-gray-400 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500/60 flex-shrink-0" />
                              <span className="truncate">{c.node.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-600 text-xs pt-16">
                    Select a module to explore
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Data Flow view ── */}
      {view === 'dataflow' && (
        <div>
          <p className="text-xs text-gray-500 mb-5">
            High-level view of how data moves through the system.
          </p>
          <div className="flex flex-col items-center">
            {/* Starting node — always shown */}
            <div className="px-6 py-3 rounded-xl border border-white/20 bg-white/5 text-center w-full max-w-sm">
              <div className="text-sm font-semibold text-white">User / Browser</div>
              <div className="text-xs text-gray-500 mt-0.5">Initiates requests</div>
            </div>

            {/* Explicit dataFlow steps from Claude */}
            {architecture.dataFlow && architecture.dataFlow.length > 0 ? (
              architecture.dataFlow.map(step => {
                const nodesInStep = step.nodeIds
                  .map(id => architecture.nodes.find(n => n.id === id))
                  .filter((n): n is ArchitectureNode => !!n);
                return (
                  <div key={step.step} className="flex flex-col items-center w-full max-w-sm">
                    <DownArrow />
                    <div
                      className="w-full rounded-xl border p-3"
                      style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.12)' }}
                    >
                      <h3 className="font-semibold text-sm text-white mb-1">{step.label}</h3>
                      <p className="text-xs text-gray-400 mb-2 leading-relaxed">{step.description}</p>
                      {nodesInStep.length > 0 && (
                        <div className="space-y-1">
                          {nodesInStep.slice(0, 4).map(node => (
                            <div key={node.id} className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_CONFIG[node.type].dotClass}`} />
                              <span className="text-xs text-gray-400">{node.name}</span>
                            </div>
                          ))}
                          {nodesInStep.length > 4 && (
                            <div className="text-xs text-gray-600">+{nodesInStep.length - 4} more</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* Fallback: inferred stages from node types */
              inferredFlowStages.map(stage => (
                <div key={stage.label} className="flex flex-col items-center w-full max-w-sm">
                  <DownArrow />
                  <div
                    className="w-full rounded-xl border p-3"
                    style={{ background: stage.bg, borderColor: stage.border }}
                  >
                    <h3 className={`font-semibold text-sm mb-2 ${stage.textClass}`}>{stage.label}</h3>
                    <div className="space-y-1">
                      {stage.nodes.slice(0, 4).map(node => (
                        <div key={node.id} className="text-xs text-gray-400">• {node.name}</div>
                      ))}
                      {stage.nodes.length > 4 && (
                        <div className="text-xs text-gray-600">+{stage.nodes.length - 4} more</div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 6: Run the tests to verify they pass

**Step 1: Run the ArchitectureDiagram tests**

```bash
npx jest src/components/__tests__/ArchitectureDiagram.test.tsx --no-coverage
```

Expected: all 12 tests pass. If any fail, fix the component until they do.

**Step 2: Verify the build passes**

```bash
npm run build
```

Expected: build completes without errors.

---

## Task 7: Update local `ArchitectureVisualization` interface in `page.tsx`

**Files:**
- Modify: `src/app/projects/[id]/page.tsx`

The project page has a local copy of `ArchitectureVisualization`. Replace it with an import from `@/lib/db` and add `DataFlowStep`.

**Step 1: Update the interface at the top of `page.tsx`**

Find the local `ArchitectureVisualization` interface (around line 38–52):
```ts
interface ArchitectureVisualization {
  nodes: Array<{
    id: string;
    name: string;
    type: 'component' | 'service' | 'api' | 'database' | 'external' | 'ui';
    complexity: 'low' | 'medium' | 'high';
    description: string;
    files: string[];
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'imports' | 'calls' | 'stores' | 'renders';
  }>;
}
```

Replace it with an import from `@/lib/db`:
```ts
import type { ArchitectureVisualization } from '@/lib/db';
```

Add this import at the top of the file alongside the existing imports.

**Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

## Task 8: Install Playwright and write E2E smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/architecture-diagram.spec.ts`

**Step 1: Install Playwright**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Expected: Playwright installed, Chromium browser downloaded.

**Step 2: Create `playwright.config.ts`**

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
```

**Step 3: Create E2E smoke test**

```ts
// e2e/architecture-diagram.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Architecture Diagram', () => {
  test('login page loads without errors', async ({ page }) => {
    await page.goto('/login');
    await expect(page).not.toHaveTitle(/error/i);
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('projects listing page loads for unauthenticated users', async ({ page }) => {
    // Unauthenticated visit to "/" should redirect to /login
    await page.goto('/');
    // Should either show projects or redirect to login — either is fine, just no crash
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });
});
```

**Step 4: Run E2E tests**

Start the dev server first in a separate terminal, then:
```bash
npx playwright test e2e/architecture-diagram.spec.ts
```

Expected: 2 tests pass. The app loads without errors.

---

## Task 9: Post-session social media update

Post a brief update on social media about what was built.

---

## Session Close Checklist

```
[ ] 1. git status              (verify all changed files)
[ ] 2. git add <files>         (stage changes)
[ ] 3. bd sync                 (commit beads)
[ ] 4. git commit -m "..."     (commit code)
[ ] 5. bd sync                 (sync any new beads changes)
[ ] 6. git push                (push to remote)
```
