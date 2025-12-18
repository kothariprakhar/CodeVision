# Chrome Plugin Backend API Gap Analysis

**Date:** 2025-12-17
**Status:** Analysis Complete
**Purpose:** Identify all backend gaps that must be filled to enable Chrome plugin development

## Executive Summary

Our current Next.js backend provides component-level code analysis suitable for the website's requirements validation use case. However, the Chrome plugin requires **element-level granularity** (individual buttons, inputs, forms) with **precise data flow tracing** (UI element → API endpoint → database table).

**Critical Gaps:**
1. ✅ **Data Granularity** - Current analysis is file/component-level, needs element-level
2. ✅ **Database Schema** - Missing tables for workspaces, element data, API mappings
3. ✅ **API Endpoints** - Need 3 new plugin-specific endpoints
4. ✅ **AST Parsing** - No element-level code extraction capability
5. ✅ **Multi-Repo Support** - No workspace concept linking multiple analyses
6. ✅ **Git Metadata** - Analysis doesn't track branch/commit information
7. ✅ **Smart API Matching** - No algorithm to link frontend calls to backend endpoints

**Estimated Effort:** 8 tasks (5 backend implementation, 2 infrastructure, 1 documentation)

---

## Current State Analysis

### What We Have (Working Well)

**1. Authentication System**
- ✅ JWT-based auth with httpOnly cookies
- ✅ Email verification via OTP
- ✅ User session management
- ✅ `/api/auth/login`, `/api/auth/signup`, `/api/auth/me` endpoints
- **Status:** Can be reused by Chrome plugin as-is

**2. Project & Document Management**
- ✅ Projects table links users to GitHub repositories
- ✅ Documents table stores uploaded requirements (PDFs, markdown, images)
- ✅ GitHub integration (token-based access, supports both API and git clone)
- **Status:** Sufficient for plugin needs

**3. Component-Level Analysis**
- ✅ Claude AI analyzes code vs. requirements
- ✅ Generates findings (gaps, fidelity issues) with severity levels
- ✅ Creates architecture visualization (nodes + edges)
- ✅ Stores results in `analysis_results` table (JSONB fields)
- **Status:** Good foundation, needs enhancement for element-level detail

**4. Chat System**
- ✅ Codebase-wide context (summary, architecture, findings)
- ✅ Code search (walks repo, finds relevant files)
- ✅ Session history tracking
- ✅ Smart response type detection (quick vs. detailed)
- **Status:** Good base, needs element context support

**5. Database & Repository Layer**
- ✅ Supabase PostgreSQL with Row Level Security (RLS)
- ✅ Clean repository pattern (projects, documents, analysis, users)
- ✅ JSONB fields for flexible data structures
- **Status:** Well-structured, ready for extensions

---

## Data Structure Gaps

### Gap 1: Analysis Granularity (CRITICAL)

**Current State:**
```typescript
// architecture.nodes[] contains component-level data
{
  id: "auth-component",
  name: "Authentication Module",
  type: "component",
  complexity: "high",
  description: "Handles user login and signup",
  files: ["src/auth/login.ts", "src/auth/signup.ts"]
}
```

**What Plugin Needs:**
```typescript
// Element-level data with precise selectors and handlers
{
  selector: "button[data-testid='checkout-btn']",
  component: "CheckoutButton",
  file: "src/components/CheckoutButton.tsx",
  line: 45,
  handlers: [
    {
      name: "handleCheckout",
      file: "src/components/CheckoutButton.tsx",
      line: 12,
      code: "const handleCheckout = async () => { ... }"
    }
  ],
  apiCalls: [
    {
      method: "POST",
      path: "/api/orders",
      file: "src/components/CheckoutButton.tsx",
      line: 18
    }
  ],
  stateUpdates: [
    { variable: "isLoading", action: "set to true" }
  ]
}
```

**Impact:** Without element-level data, plugin cannot answer "What does this button do?"

**Solution Required:**
- Extend analysis to capture JSX element trees
- Extract onClick/onChange handlers at element level
- Track which elements trigger which API calls
- Store element data in new database tables

---

### Gap 2: Multi-Repo Workspace Support (CRITICAL)

**Current State:**
- One `Project` = one GitHub repository
- No concept of linking multiple analyses together
- No domain → analysis mappings

**What Plugin Needs:**
```typescript
// Workspace containing multiple analyses
{
  id: "workspace-123",
  user_id: "user-456",
  name: "E-commerce Platform",
  domains: [
    { domain: "localhost:3000", analysisId: "analysis-abc" },
    { domain: "admin.localhost:3000", analysisId: "analysis-def" }
  ],
  analyses: [
    {
      id: "analysis-abc",
      name: "storefront-web",
      repoUrl: "github.com/acme/storefront",
      branch: "main",
      commit: "abc123f",
      analyzedAt: "2025-12-15T10:00:00Z"
    },
    {
      id: "analysis-def",
      name: "api-backend",
      repoUrl: "github.com/acme/api",
      branch: "main",
      commit: "def456g",
      analyzedAt: "2025-12-14T15:00:00Z"
    }
  ],
  manualMappings: [
    {
      frontendCall: "POST /api/checkout",
      backendEndpoint: "POST /orders",
      backendAnalysisId: "analysis-def"
    }
  ]
}
```

**Impact:** Plugin cannot support microservices architectures or multi-repo projects

**Solution Required:**
- Create `workspaces` table
- Link workspace → multiple analyses
- Store domain mappings (which URL maps to which analysis)
- Store manual API mappings for failed auto-matches

---

### Gap 3: Git Metadata Tracking (HIGH)

**Current State:**
- `analysis_results` table has `analyzed_at` timestamp
- No branch or commit information stored

**What Plugin Needs:**
```typescript
{
  id: "analysis-abc",
  project_id: "project-123",
  branch: "main",
  commit: "7895dc8",
  commit_url: "https://github.com/acme/repo/commit/7895dc8",
  analyzed_at: "2025-12-15T10:00:00Z",
  // ... rest of analysis data
}
```

**Impact:** Plugin cannot show "Analysis: main@7895dc8" or link to GitHub commit

**Solution Required:**
- Add `branch`, `commit`, `commit_url` columns to `analysis_results`
- Extract git info during repository download
- Display in plugin UI for transparency

---

### Gap 4: Smart API Matching Algorithm (HIGH)

**Current State:**
- No way to link frontend API calls to backend implementations
- Frontend and backend analyses are separate
- No matching algorithm

**What Plugin Needs:**
- Automatic matching: Frontend `POST /api/orders` → Backend `POST /orders` handler
- Fuzzy matching: Strip prefixes, normalize paths
- Function name matching: `createOrder` → `/orders` route
- Confidence scores: exact match (100%), normalized (80%), fuzzy (50%)
- Manual override capability

**Impact:** Plugin cannot show full-stack data flow across repos

**Solution Required:**
- Implement matching algorithm in backend service
- Store matches in `api_mappings` table
- Provide manual mapping fallback via workspace config

---

## Database Schema Gaps

### Gap 5: Missing Tables (CRITICAL)

**Required New Tables:**

**1. `workspaces` Table**
```sql
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  domain_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  manual_mappings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- domain_mappings format: [{ domain: "localhost:3000", analysisId: "..." }]
-- manual_mappings format: [{ frontendCall: "POST /api/x", backendEndpoint: "POST /x", backendAnalysisId: "..." }]
```

**2. `elements` Table**
```sql
CREATE TABLE IF NOT EXISTS elements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE NOT NULL,
  selector VARCHAR(500),
  element_type VARCHAR(50), -- button, input, form, div, etc.
  component_name VARCHAR(255),
  file_path VARCHAR(500),
  line_number INTEGER,
  handlers JSONB NOT NULL DEFAULT '[]'::jsonb,
  api_calls JSONB NOT NULL DEFAULT '[]'::jsonb,
  state_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  parent_element_id UUID REFERENCES elements(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_elements_analysis_id ON elements(analysis_id);
CREATE INDEX idx_elements_selector ON elements(selector);
CREATE INDEX idx_elements_component_name ON elements(component_name);
```

**3. `api_mappings` Table**
```sql
CREATE TABLE IF NOT EXISTS api_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  frontend_analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE NOT NULL,
  backend_analysis_id UUID REFERENCES analysis_results(id) ON DELETE CASCADE,
  frontend_call VARCHAR(500) NOT NULL, -- "POST /api/orders"
  backend_endpoint VARCHAR(500), -- "POST /orders"
  match_type VARCHAR(20) NOT NULL, -- "exact", "normalized", "fuzzy", "manual"
  confidence_score INTEGER, -- 0-100
  frontend_file VARCHAR(500),
  backend_file VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_mappings_workspace_id ON api_mappings(workspace_id);
CREATE INDEX idx_api_mappings_frontend_analysis_id ON api_mappings(frontend_analysis_id);
```

**Impact:** Without these tables, plugin cannot store workspace config or element data

---

## API Endpoint Gaps

### Gap 6: Missing Plugin Endpoints (CRITICAL)

**Required New Endpoints:**

**1. GET /api/plugin/workspaces**

Purpose: Fetch user's workspace configurations

```typescript
// Request: GET /api/plugin/workspaces
// Headers: Authorization: Bearer {jwt_token}

// Response:
{
  workspaces: [
    {
      id: "workspace-123",
      name: "E-commerce Platform",
      domains: [
        { domain: "localhost:3000", analysisId: "analysis-abc" }
      ],
      analyses: [
        {
          id: "analysis-abc",
          name: "storefront-web",
          repoUrl: "github.com/acme/storefront",
          branch: "main",
          commit: "abc123f",
          analyzedAt: "2025-12-15T10:00:00Z"
        }
      ],
      manualMappings: [
        {
          frontendCall: "POST /api/checkout",
          backendEndpoint: "POST /orders"
        }
      ]
    }
  ]
}
```

**2. GET /api/plugin/analysis/:id/element**

Purpose: Get element-specific analysis data

```typescript
// Request: GET /api/plugin/analysis/abc123/element?selector=button.checkout&file=CheckoutButton.tsx
// Headers: Authorization: Bearer {jwt_token}

// Response:
{
  element: {
    selector: "button.checkout",
    component: "CheckoutButton",
    file: "src/components/CheckoutButton.tsx",
    line: 45
  },
  dataFlow: {
    ui: {
      component: "CheckoutButton",
      handlers: [
        {
          name: "handleCheckout",
          file: "src/components/CheckoutButton.tsx",
          line: 12
        }
      ]
    },
    api: {
      method: "POST",
      path: "/api/orders",
      matched: true,
      analysisId: "analysis-def",
      middleware: [
        { name: "authMiddleware", file: "middleware/auth.ts", line: 5 }
      ],
      controller: {
        name: "createOrder",
        file: "controllers/orders.ts",
        line: 23
      },
      validation: [
        { name: "validateOrderSchema", file: "validators/order.ts", line: 8 }
      ]
    },
    database: {
      table: "orders",
      columns: [
        { name: "id", type: "uuid" },
        { name: "user_id", type: "uuid" },
        { name: "total", type: "decimal" }
      ],
      relations: [
        { table: "users", type: "many-to-one" },
        { table: "order_items", type: "one-to-many" }
      ]
    }
  }
}
```

**3. POST /api/plugin/chat**

Purpose: Chat with element context

```typescript
// Request:
{
  analysisId: "analysis-abc",
  message: "Where is email validation for this form?",
  elementContext: {
    component: "SignupForm",
    file: "src/components/SignupForm.tsx",
    line: 34
  },
  sessionHistory: [
    { role: "user", content: "What does this button do?" },
    { role: "assistant", content: "It submits the signup form..." }
  ]
}

// Response:
{
  message: "Email validation happens in two places:\n1. Frontend: src/validators/email.ts:12 (basic format check)\n2. Backend: src/controllers/users.ts:45 (uniqueness check against database)",
  suggestions: [
    "Show me the email validator code",
    "What happens if validation fails?"
  ]
}
```

**Impact:** Chrome extension cannot function without these endpoints

---

## Infrastructure Gaps

### Gap 7: No AST Parsing for Element Extraction (CRITICAL)

**Current State:**
- Analyzer uses Claude AI for high-level component analysis
- No AST (Abstract Syntax Tree) parsing
- Cannot extract precise element-level data

**What Plugin Needs:**
- Parse JSX/TSX files to extract element trees
- Identify event handlers (onClick, onChange, onSubmit)
- Track which elements trigger which API calls
- Build parent-child element relationships

**Tools Required:**
- `@babel/parser` - Parse JavaScript/TypeScript/JSX
- `@babel/traverse` - Walk AST to find elements
- `@typescript/compiler` - Alternative for TypeScript projects

**Example AST Extraction:**
```typescript
// Input: CheckoutButton.tsx
<button onClick={handleCheckout} data-testid="checkout-btn">
  Checkout
</button>

// AST Parser Output:
{
  type: "JSXElement",
  openingElement: {
    name: "button",
    attributes: [
      { name: "onClick", value: "handleCheckout" },
      { name: "data-testid", value: "checkout-btn" }
    ]
  },
  // ... extract handler function body, API calls, etc.
}
```

**Impact:** Without AST parsing, cannot get element-level granularity

---

### Gap 8: Analysis Schema Extensions (HIGH)

**Current `analysis_results` JSONB Fields:**
```typescript
// findings: Finding[] - Array of gaps/fidelity issues
// architecture: ArchitectureVisualization - Component-level nodes + edges
// chat_history: ChatMessage[] - Chat session data
```

**Required Extensions:**

Option A: Add new JSONB field `elements_data`
```typescript
{
  // ... existing fields
  elements_data: {
    elements: Element[], // Element-level data
    api_calls: APICall[], // All API calls found
    event_handlers: Handler[] // All handlers
  }
}
```

Option B: Use separate `elements` table (RECOMMENDED)
- Better query performance (indexed)
- Cleaner schema (normalized)
- Easier to update individual elements

**Impact:** Need to decide on storage strategy before implementation

---

## Implementation Priority & Dependencies

### Phase 1: Foundation (Do First)
1. ✅ **Add git metadata to analysis** (branch, commit, commit_url)
   - Modify `analysis_results` table schema
   - Update analyzer service to extract git info
   - Dependencies: None

2. ✅ **Create AST parsing service**
   - Implement element extraction from JSX/TSX files
   - Build handler and API call detection
   - Dependencies: None

3. ✅ **Design element data storage strategy**
   - Decide: JSONB field vs. separate table
   - Create migration script
   - Dependencies: AST parsing design

### Phase 2: Data & Schema (Do Second)
4. ✅ **Update analysis results schema**
   - Add `elements` table (or extend JSONB)
   - Add `branch`, `commit`, `commit_url` columns
   - Run migration
   - Dependencies: Phase 1 complete

5. ✅ **Create workspaces table & API mappings table**
   - Write migration script
   - Create repository layer
   - Add RLS policies
   - Dependencies: None

### Phase 3: Backend Endpoints (Do Third)
6. ✅ **Implement GET /api/plugin/workspaces**
   - Create workspace repository
   - Build endpoint with auth
   - Test with multiple analyses
   - Dependencies: Workspaces table (Phase 2)

7. ✅ **Implement GET /api/plugin/analysis/:id/element**
   - Query element data
   - Build data flow response
   - Handle missing elements gracefully
   - Dependencies: Elements table (Phase 2), AST parsing (Phase 1)

8. ✅ **Implement POST /api/plugin/chat with element context**
   - Extend chat service to accept elementContext
   - Build element-focused prompts
   - Maintain session context
   - Dependencies: Element data available (Phase 2)

9. ✅ **Implement smart API matching algorithm**
   - Build matching service (exact, normalized, fuzzy)
   - Store matches in api_mappings table
   - Provide confidence scores
   - Dependencies: API mappings table (Phase 2)

### Phase 4: Documentation (Do Last)
10. ✅ **Generate comprehensive API documentation**
    - OpenAPI/Swagger spec
    - Authentication guide for Chrome extension
    - Request/response examples
    - Error handling patterns
    - Dependencies: All endpoints complete (Phase 3)

---

## Technical Risks & Mitigation

### Risk 1: AST Parsing Performance
**Risk:** Parsing large codebases (10K+ files) may timeout or consume too much memory

**Mitigation:**
- Parse only relevant files (components, pages, not node_modules)
- Implement streaming/batching for large repos
- Cache parsed results per analysis
- Set timeouts (30s max per file)

### Risk 2: Element Matching Accuracy
**Risk:** Auto-generated selectors may not match actual DOM elements in browser

**Mitigation:**
- Prefer data-testid and unique IDs over class names
- Provide fuzzy matching (component name + approximate location)
- Allow manual selector override in plugin
- Graceful fallback to component-level data

### Risk 3: Multi-Repo API Matching False Positives
**Risk:** Auto-matching may link wrong endpoints (e.g., both repos have POST /users)

**Mitigation:**
- Require 80%+ confidence for auto-match
- Show match confidence in plugin UI
- Easy manual override workflow
- Store user corrections to improve algorithm

### Risk 4: Database Schema Changes Breaking Website
**Risk:** Adding new columns/tables may affect existing website functionality

**Mitigation:**
- Use `IF NOT EXISTS` in migrations (idempotent)
- Make new columns nullable or with defaults
- Test migrations in development first
- Keep website and plugin endpoints separate (/api/plugin/*)

---

## Success Criteria

### Must Have (Blocking)
- ✅ GET /api/plugin/workspaces returns valid workspace data
- ✅ GET /api/plugin/analysis/:id/element returns element-level data flow
- ✅ POST /api/plugin/chat accepts and uses element context
- ✅ Analysis results include git branch/commit metadata
- ✅ Workspaces table supports multi-repo configurations
- ✅ API documentation is complete and accurate

### Should Have (High Priority)
- ✅ AST parsing extracts 90%+ of clickable elements
- ✅ Smart API matching achieves 70%+ auto-match rate
- ✅ Element queries respond in <500ms
- ✅ Manual API mapping workflow is functional

### Nice to Have (Future Enhancement)
- ⬜ Real-time analysis updates via WebSockets
- ⬜ Element-level code navigation (IDE deep links)
- ⬜ Automatic workspace creation from git remote
- ⬜ Team/organization workspace sharing

---

## Next Steps

1. ✅ **Review this analysis with Sabari** - Confirm priorities and approach
2. ✅ **Start Phase 1 tasks** - Git metadata + AST parsing foundation
3. ✅ **Create database migrations** - Workspaces, elements, api_mappings tables
4. ✅ **Implement plugin endpoints** - One at a time, with tests
5. ✅ **Generate API documentation** - For Chrome extension developer handoff
6. ✅ **Close feedback loop** - Test endpoints with mock Chrome extension requests

**Estimated Timeline:**
- Phase 1: 2-3 tasks (foundation)
- Phase 2: 2 tasks (schema)
- Phase 3: 4 tasks (endpoints + matching)
- Phase 4: 1 task (documentation)
- **Total: 9-10 tasks**

---

## Appendix: Current API Inventory

**Authentication:**
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/logout
- GET /api/auth/me
- POST /api/auth/verify-email
- POST /api/auth/resend-otp

**Projects:**
- GET /api/projects
- POST /api/projects
- GET /api/projects/:id
- PATCH /api/projects/:id
- DELETE /api/projects/:id

**Documents:**
- GET /api/documents?project_id=
- POST /api/documents
- GET /api/documents/:id
- DELETE /api/documents/:id

**Analysis:**
- POST /api/analyze
- GET /api/analysis/:projectId
- GET /api/analysis/versions/:projectId

**Chat:**
- POST /api/chat
- GET /api/chat?analysis_id=

**GitHub:**
- POST /api/github/validate
- GET /api/github/readme

**Feedback & Waitlist:**
- POST /api/feedback
- POST /api/waitlist

**Status:** All existing endpoints are sufficient and do not need modifications
