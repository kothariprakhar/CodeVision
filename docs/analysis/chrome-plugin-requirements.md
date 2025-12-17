# Chrome Plugin Requirements & API Analysis

**Date:** 2025-12-17
**Status:** Analysis & Planning
**Purpose:** Document current APIs and define requirements for Chrome plugin integration

---

## Executive Summary

**Current State:** Code Vision analyzes codebases at a **high architectural level** - identifying components, their relationships, and requirement gaps. Analysis is **file-level** with component-level granularity.

**Chrome Plugin Vision:** An inspect-element-like tool that shows **data flow from UI to backend** - which database, API endpoints, controllers, and services power each UI element.

**Gap:** We need **element-level** granularity, not just component-level. This requires significant architectural changes to our analysis system.

---

## Current API Structure

### 1. Authentication APIs

#### `POST /api/auth/signup`
- **Purpose:** Create new user account
- **Auth:** None (public)
- **Request:**
  ```json
  {
    "email": "string",
    "password": "string (min 8 chars)"
  }
  ```
- **Response (Success):**
  ```json
  {
    "user": { "id": "uuid", "email": "string" }
  }
  ```
- **Response (Waitlist):**
  ```json
  {
    "error": "Account pending approval",
    "waitlist": true,
    "message": "You have been added to our waitlist..."
  }
  ```
- **Status:** 201 (success), 403 (waitlist), 400 (validation error)

#### `POST /api/auth/login`
- **Purpose:** Authenticate user
- **Auth:** None (public)
- **Request:**
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Response:**
  ```json
  {
    "user": { "id": "uuid", "email": "string" }
  }
  ```
- **Sets:** Authentication cookie (httpOnly)
- **Status:** 200 (success), 401 (invalid credentials)

#### `POST /api/auth/logout`
- **Purpose:** End user session
- **Auth:** Required
- **Response:**
  ```json
  { "success": true }
  ```

#### `GET /api/auth/me`
- **Purpose:** Get current user info
- **Auth:** Required (cookie)
- **Response:**
  ```json
  {
    "user": { "id": "uuid", "email": "string" } | null
  }
  ```

---

### 2. Project APIs

#### `GET /api/projects`
- **Purpose:** List user's projects
- **Auth:** Required
- **Response:**
  ```json
  [
    {
      "id": "uuid",
      "user_id": "uuid",
      "name": "string",
      "description": "string | null",
      "github_url": "string",
      "status": "pending | analyzing | completed | failed",
      "created_at": "ISO timestamp",
      "updated_at": "ISO timestamp"
    }
  ]
  ```

#### `POST /api/projects`
- **Purpose:** Create new project
- **Auth:** Required
- **Request:**
  ```json
  {
    "name": "string (1-100 chars)",
    "description": "string (max 500 chars, optional)",
    "github_url": "string (valid GitHub URL)",
    "github_token": "string (required for private repos)",
    "is_public": "boolean (default: false)"
  }
  ```
- **Response:**
  ```json
  {
    "id": "uuid",
    "user_id": "uuid",
    "name": "string",
    "description": "string | null",
    "github_url": "string",
    "status": "analyzing",
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp"
  }
  ```
- **Side Effect:** Automatically triggers background analysis
- **Status:** 201 (created), 400 (validation error)

#### `GET /api/projects/[id]`
- **Purpose:** Get single project details
- **Auth:** Required (must own project)
- **Response:** Same as single project object above
- **Status:** 200 (success), 404 (not found), 403 (forbidden)

#### `DELETE /api/projects/[id]`
- **Purpose:** Delete project
- **Auth:** Required (must own project)
- **Response:**
  ```json
  { "success": true }
  ```

---

### 3. Analysis APIs

#### `GET /api/analysis/[projectId]`
- **Purpose:** Get latest analysis for a project
- **Auth:** Required (must own project)
- **Query Params:**
  - `version` (optional): Specific analysis version ID
- **Response:**
  ```json
  {
    "id": "uuid",
    "project_id": "uuid",
    "summary": "string (executive summary)",
    "findings": [
      {
        "type": "gap | fidelity",
        "severity": "critical | high | medium | low",
        "title": "string",
        "description": "string",
        "evidence": ["string array"]
      }
    ],
    "architecture": {
      "nodes": [
        {
          "id": "string",
          "name": "string",
          "type": "ui | api | service | database | external | component",
          "complexity": "low | medium | high",
          "description": "string",
          "files": ["string array of file paths"]
        }
      ],
      "edges": [
        {
          "from": "string (node id)",
          "to": "string (node id)",
          "type": "imports | calls | stores | renders"
        }
      ]
    },
    "chat_history": [...],
    "analyzed_at": "ISO timestamp"
  }
  ```
- **Status:** 200 (success), 404 (no analysis yet)

#### `GET /api/analysis/versions/[projectId]`
- **Purpose:** Get all analysis versions for a project
- **Auth:** Required (must own project)
- **Response:**
  ```json
  {
    "versions": [
      {
        "id": "uuid",
        "analyzed_at": "ISO timestamp"
      }
    ]
  }
  ```

#### `POST /api/analyze`
- **Purpose:** Trigger new analysis for a project
- **Auth:** Required (must own project)
- **Request:**
  ```json
  {
    "project_id": "uuid"
  }
  ```
- **Response:**
  ```json
  {
    "id": "uuid (analysis id)",
    "project_id": "uuid",
    "analyzed_at": "ISO timestamp"
  }
  ```
- **Status:** 200 (success), 400 (no documents), 404 (project not found)

---

### 4. Document APIs

#### `GET /api/documents?project_id=[uuid]`
- **Purpose:** List documents for a project
- **Auth:** Required (must own project)
- **Response:**
  ```json
  [
    {
      "id": "uuid",
      "project_id": "uuid",
      "filename": "string",
      "file_type": "pdf | markdown | text | image",
      "file_path": "string",
      "uploaded_at": "ISO timestamp"
    }
  ]
  ```

#### `POST /api/documents`
- **Purpose:** Upload new document
- **Auth:** Required (must own project)
- **Content-Type:** multipart/form-data
- **Form Fields:**
  - `file`: File (PDF, MD, TXT, DOC, DOCX, images)
  - `project_id`: UUID
- **Response:**
  ```json
  {
    "id": "uuid",
    "project_id": "uuid",
    "filename": "string",
    "file_type": "string",
    "file_path": "string",
    "uploaded_at": "ISO timestamp"
  }
  ```

#### `DELETE /api/documents/[id]`
- **Purpose:** Delete document
- **Auth:** Required (must own associated project)
- **Response:**
  ```json
  { "success": true }
  ```

---

### 5. Chat API

#### `POST /api/chat`
- **Purpose:** Chat with AI about analysis
- **Auth:** Required (must own project)
- **Request:**
  ```json
  {
    "project_id": "uuid",
    "analysis_id": "uuid",
    "message": "string",
    "response_type": "quick | detailed"
  }
  ```
- **Response:**
  ```json
  {
    "response": "string (AI response)"
  }
  ```

---

### 6. GitHub APIs

#### `POST /api/github/validate`
- **Purpose:** Validate GitHub access
- **Auth:** Required
- **Request:**
  ```json
  {
    "github_url": "string",
    "github_token": "string (optional for public repos)"
  }
  ```
- **Response:**
  ```json
  {
    "valid": true,
    "is_public": boolean
  }
  ```

#### `POST /api/github/readme`
- **Purpose:** Import README from repository
- **Auth:** Required
- **Request:**
  ```json
  {
    "github_url": "string",
    "github_token": "string",
    "is_public": boolean
  }
  ```
- **Response:**
  ```json
  {
    "content": "string (README content)",
    "name": "string (filename)"
  }
  ```

---

### 7. Feedback API

#### `POST /api/feedback`
- **Purpose:** Submit user feedback
- **Auth:** Required
- **Request:**
  ```json
  {
    "category": "bug_report | feature_request | general_feedback",
    "message": "string (1-1000 chars)",
    "page_url": "string (URL)",
    "project_id": "uuid (optional)",
    "browser_info": {
      "user_agent": "string",
      "screen_width": number,
      "screen_height": number,
      "viewport_width": number,
      "viewport_height": number
    },
    "console_logs": [
      {
        "level": "error | warn",
        "message": "string",
        "timestamp": number
      }
    ]
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Feedback submitted successfully"
  }
  ```

---

### 8. Waitlist API

#### `POST /api/waitlist`
- **Purpose:** Join waitlist (non-Northwestern users)
- **Auth:** None (public)
- **Request:**
  ```json
  {
    "email": "string",
    "name": "string",
    "organization": "string (optional)",
    "reason": "string"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "message": "Successfully joined the waitlist!",
    "data": { ... }
  }
  ```

---

## Chrome Plugin Vision

### User Experience

The Chrome plugin will function like an enhanced "Inspect Element" tool:

1. **User activates plugin** on their web application
2. **Hovers over UI elements** (buttons, forms, tables, etc.)
3. **Plugin highlights element** and shows overlay with:
   - **Component Name** (React component, Vue component, etc.)
   - **Data Source** (API endpoint being called)
   - **Backend Controller/Function** (which server code handles this)
   - **Database Tables** (which tables are queried)
   - **Dependencies** (what else this element depends on)

### Example Use Case

User hovers over a "Submit Order" button:

```
┌─────────────────────────────────┐
│ Submit Order                    │ ← UI Element
├─────────────────────────────────┤
│ Component: OrderForm.tsx        │
│ API: POST /api/orders           │
│ Controller: createOrder()       │
│ Database: orders, order_items   │
│ Services: PaymentService        │
│           InventoryService      │
└─────────────────────────────────┘
```

---

## Gap Analysis: What's Missing

### Current Analysis Limitations

**1. Granularity Problem**
- **Current:** File-level and component-level analysis
- **Need:** Element-level, function-level analysis
- **Example:** We know `components/UserForm.tsx` exists, but we don't know which specific form fields map to which API calls

**2. Data Flow Tracking**
- **Current:** Static code relationships (imports, calls)
- **Need:** Complete data flow chains from UI → API → Service → Database
- **Example:** We see `UserForm` imports `api/users`, but we don't track that "firstName field" → "POST /api/users" → "users.create()" → "users table"

**3. Runtime Information**
- **Current:** Static code analysis only
- **Need:** Runtime behavior and actual data flows
- **Example:** We can't detect dynamically loaded components or runtime API calls

**4. Frontend-Backend Mapping**
- **Current:** Separate frontend and backend node analysis
- **Need:** Explicit UI element → Backend resource mapping
- **Example:** We know there's a `/api/orders` endpoint, but we don't know which UI buttons call it

**5. Database Schema**
- **Current:** Generic "database" nodes
- **Need:** Specific table names, columns, relationships
- **Example:** We might identify a database node, but we don't extract "users table with id, email, created_at columns"

---

## Required Architectural Changes

### Phase 1: Enhanced Static Analysis

**Goal:** Extract element-level information from static code

#### Changes Needed:

1. **AST Parsing for Frontend**
   - Parse React/Vue/Angular components to extract individual elements
   - Map JSX elements to component functions
   - Identify event handlers and their API calls
   - Extract form fields and their data bindings

2. **API Endpoint Extraction**
   - Scan backend code for route definitions
   - Extract controller functions and their database queries
   - Build complete API → Controller → Database mapping

3. **Database Schema Extraction**
   - Parse ORM models (Prisma, TypeORM, Sequelize, etc.)
   - Extract table names, columns, relationships
   - Identify which queries access which tables

4. **Enhanced Architecture Schema**
   - Add new node types: `ui_element`, `form_field`, `api_endpoint`, `database_table`
   - Add element-level metadata to nodes
   - Create detailed edge types: `submits_to`, `queries`, `updates`, `reads_from`

#### New Data Structure:

```typescript
interface EnhancedArchitectureNode extends ArchitectureNode {
  // Existing fields: id, name, type, complexity, description, files

  // New fields for Chrome plugin
  metadata?: {
    // For UI elements
    element_type?: 'button' | 'form' | 'input' | 'table' | 'component';
    dom_selector?: string; // CSS selector to find this element
    event_handlers?: string[]; // onClick, onSubmit, etc.

    // For API endpoints
    http_method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    route_path?: string; // e.g., "/api/orders"
    controller_function?: string; // e.g., "createOrder"

    // For database tables
    table_name?: string;
    columns?: {
      name: string;
      type: string;
      nullable: boolean;
    }[];

    // For all nodes
    line_numbers?: {
      start: number;
      end: number;
    };
  };
}

interface EnhancedArchitectureEdge extends ArchitectureEdge {
  // Existing fields: from, to, type

  // New fields
  data_flow?: {
    data_shape?: string; // TypeScript interface or JSON schema
    parameters?: string[];
    returns?: string;
  };
}
```

### Phase 2: Chrome Plugin Backend API

**Goal:** Provide APIs for Chrome plugin to query analysis data

#### New API Endpoints:

##### `GET /api/plugin/element-map/[projectId]`
**Purpose:** Get complete UI element → Backend mapping

**Response:**
```json
{
  "elements": [
    {
      "id": "submit-order-button",
      "selector": "button#submit-order",
      "component": "OrderForm.tsx",
      "component_path": "src/components/OrderForm.tsx",
      "api_calls": [
        {
          "endpoint": "/api/orders",
          "method": "POST",
          "controller": "createOrder()",
          "controller_file": "src/api/orders/route.ts",
          "services": ["PaymentService", "InventoryService"],
          "database_operations": [
            {
              "table": "orders",
              "operation": "INSERT",
              "columns": ["user_id", "total", "status"]
            },
            {
              "table": "order_items",
              "operation": "INSERT",
              "columns": ["order_id", "product_id", "quantity"]
            }
          ]
        }
      ],
      "data_flow": {
        "input": "{ items: Product[], userId: string }",
        "output": "{ orderId: string, status: string }"
      }
    }
  ]
}
```

##### `GET /api/plugin/code-path/[projectId]?element=[selector]`
**Purpose:** Trace complete code path for a specific UI element

**Response:**
```json
{
  "element": "button#submit-order",
  "path": [
    {
      "layer": "ui",
      "file": "src/components/OrderForm.tsx",
      "function": "handleSubmit",
      "lines": "45-67"
    },
    {
      "layer": "api",
      "file": "src/api/orders/route.ts",
      "function": "POST handler",
      "lines": "12-89"
    },
    {
      "layer": "service",
      "file": "src/lib/services/orders.ts",
      "function": "createOrder",
      "lines": "23-145"
    },
    {
      "layer": "database",
      "operation": "INSERT INTO orders (...)",
      "table": "orders"
    }
  ]
}
```

##### `GET /api/plugin/database-schema/[projectId]`
**Purpose:** Get complete database schema

**Response:**
```json
{
  "tables": [
    {
      "name": "orders",
      "columns": [
        { "name": "id", "type": "UUID", "primary_key": true },
        { "name": "user_id", "type": "UUID", "foreign_key": "users.id" },
        { "name": "total", "type": "DECIMAL" },
        { "name": "status", "type": "VARCHAR(20)" }
      ],
      "relationships": [
        { "type": "belongs_to", "table": "users" },
        { "type": "has_many", "table": "order_items" }
      ]
    }
  ]
}
```

### Phase 3: Chrome Plugin Implementation

**Goal:** Build the actual Chrome extension

#### Components:

1. **Content Script** (runs on user's webpage)
   - Injects hover listeners
   - Highlights elements on hover
   - Shows overlay with data flow info

2. **Background Service Worker**
   - Communicates with Code Vision APIs
   - Caches analysis data
   - Handles authentication

3. **Popup UI**
   - Project selection
   - Settings
   - Quick search

4. **DevTools Panel**
   - Full element tree
   - Data flow visualization
   - Search and filter

---

## Implementation Complexity

### Effort Estimates

**Phase 1: Enhanced Static Analysis**
- **Complexity:** Very High
- **Time:** 4-6 weeks
- **Challenges:**
  - Supporting multiple frontend frameworks (React, Vue, Angular, Svelte)
  - Supporting multiple backend frameworks (Next.js, Express, FastAPI, Rails)
  - Extracting database schema from different ORMs
  - Token limits for large codebases

**Phase 2: Chrome Plugin APIs**
- **Complexity:** Medium
- **Time:** 1-2 weeks
- **Challenges:**
  - Efficient data structure for fast lookups
  - Caching strategy
  - Authentication flow

**Phase 3: Chrome Plugin**
- **Complexity:** Medium-High
- **Time:** 3-4 weeks
- **Challenges:**
  - DOM manipulation without breaking user's app
  - Performance (analyzing large pages)
  - Cross-origin requests
  - UI/UX design

**Total:** 8-12 weeks for full implementation

---

## Alternative Approaches

### Option A: Hybrid Static + Runtime Analysis

Instead of pure static analysis, instrument the user's application:

1. User adds a small SDK to their application
2. SDK tracks runtime data flows (API calls, database queries)
3. Chrome plugin connects to SDK for real-time data
4. Code Vision provides static analysis as enhancement

**Pros:**
- More accurate (captures runtime behavior)
- Easier to implement than perfect static analysis
- Works with dynamically loaded code

**Cons:**
- Requires user to modify their application
- Potential performance impact
- Security/privacy concerns

### Option B: Framework-Specific Plugins

Build separate plugins for each major framework:

1. Next.js plugin (analyzes App Router, API routes)
2. React + Express plugin
3. Vue + FastAPI plugin
4. etc.

**Pros:**
- Deeper integration with framework patterns
- More accurate analysis
- Can leverage framework-specific tools

**Cons:**
- High maintenance burden
- Doesn't work for custom stacks
- Fragmentary user experience

### Option C: MVP with Manual Mapping

Start with minimal automation:

1. User manually tags UI elements
2. User manually maps to API endpoints
3. Static analysis fills in the gaps
4. Chrome plugin uses this mapping

**Pros:**
- Faster to market
- More accurate (human verification)
- Immediate value

**Cons:**
- Tedious for users
- Doesn't scale to large applications
- Manual work defeats the purpose

---

## Recommended Path Forward

### Immediate Next Steps (Week 1)

1. **Prototype Enhanced Analysis**
   - Pick ONE framework stack (e.g., Next.js)
   - Build proof-of-concept AST parser for React components
   - Extract API routes from Next.js App Router
   - Create sample enhanced architecture output

2. **Design Plugin APIs**
   - Design REST API spec for `/api/plugin/*` endpoints
   - Create mock data structure
   - Build simple Chrome extension that displays mock data

3. **Validate Approach**
   - Test on Code Vision codebase itself (dogfooding)
   - Identify edge cases
   - Refine data model

### Medium Term (Weeks 2-4)

1. **Expand Framework Support**
   - Add Vue/Angular support
   - Add Express/FastAPI backend support
   - Handle multiple ORM patterns

2. **Build Plugin APIs**
   - Implement `/api/plugin/*` endpoints
   - Add caching layer
   - Optimize for performance

3. **Chrome Extension Beta**
   - Build functional content script
   - Create overlay UI
   - Implement data fetching

### Long Term (Weeks 5-12)

1. **Production Hardening**
   - Handle errors gracefully
   - Support edge cases
   - Performance optimization

2. **Additional Features**
   - Search functionality
   - Data flow visualization
   - Code snippets in overlay

3. **Documentation & Launch**
   - User guides
   - API documentation
   - Marketing materials

---

## Questions for Discussion

1. **Scope:** Should we target all frameworks or focus on Next.js + React first?

2. **Approach:** Pure static analysis, hybrid runtime, or framework-specific?

3. **MVP Definition:** What's the minimum feature set for a useful plugin?

4. **Authentication:** How should Chrome plugin authenticate with Code Vision?

5. **Pricing:** Is this a separate paid tier? Included in base product?

6. **Data Privacy:** How do we handle sensitive code information in the plugin?

---

## Conclusion

Building this Chrome plugin is **architecturally significant**. It requires:

1. ✅ Documented current APIs (done in this doc)
2. ⚠️ Major enhancement to analysis engine (element-level granularity)
3. ⚠️ New backend APIs for plugin communication
4. ⚠️ Chrome extension development

The current analysis system provides a **strong foundation** but needs **deep enhancements** to support the Chrome plugin vision. The effort is substantial (8-12 weeks) but achievable.

**Recommendation:** Start with **Phase 1 prototype** on Next.js to validate the approach before committing to full implementation.
