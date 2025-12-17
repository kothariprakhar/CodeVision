# Chrome Plugin Design

**Date:** 2025-12-17
**Status:** Design Complete
**Author:** Brainstorming session with Sabari

## Overview

Code Vision will offer two complementary tools that work together:

1. **Website (Current)** - Comprehensive analysis platform for deep code quality audits
2. **Chrome Plugin (New)** - Live exploration tool for rapid codebase understanding

The Chrome plugin enables developers to understand code architecture by right-clicking any UI element in their running application and seeing the complete technical stack behind it (UI → API → Controller → Database).

## Product Positioning

### Two Complementary Products

**Website Analysis:**
- Upload requirements documents + GitHub repository
- AI analyzes code quality, identifies gaps, generates architecture visualizations
- Interactive chat to explore findings
- **Use cases:** "Does my code match requirements?", due diligence, quality audits, pre-release checks
- **Frequency:** Weekly, before releases, for comprehensive audits

**Chrome Plugin:**
- Install extension, browse running application
- Right-click any UI element to see its full technical stack
- Instant understanding of data flows and architecture
- Chat assistant for contextual questions
- **Use cases:** "What does this button do?", onboarding, understanding unfamiliar code, debugging
- **Frequency:** Daily during development

**Relationship:**
- Plugin requires website analysis first (uses pre-indexed data)
- Website generates the comprehensive analysis
- Plugin provides fast, contextual access to that analysis

### Key Use Cases

1. **Understanding AI-Generated Codebases**
   - Cursor, v0, Bolt, GitHub Copilot generate entire applications
   - Developers need to understand what was created
   - Plugin provides instant visibility into generated architecture

2. **Developer Onboarding**
   - New team members need to understand existing codebases quickly
   - Plugin enables learning by exploration (click UI, see implementation)
   - Reduces time from weeks to days

3. **Exploring Inherited/Outsourced Code**
   - Contractors, previous teams, acquisitions leave unfamiliar codebases
   - Plugin makes architecture immediately visible
   - No need to read thousands of lines of code

4. **Debugging Unfamiliar Features**
   - Developers work on parts of codebase they didn't write
   - Plugin shows complete data flow for any feature
   - Reduces debugging time

## User Experience

### Installation & Setup

1. Install Chrome extension from Chrome Web Store
2. Click plugin icon → opens side panel
3. Login with Code Vision credentials (same as website)
4. Create workspace profile:
   - Name workspace (e.g., "E-commerce Platform")
   - Map domain to analysis (e.g., `localhost:3000` → "storefront-web")
   - Add multiple analyses for multi-repo projects
5. Plugin remembers workspace per domain

### Daily Usage Flow

```
Developer browsing app at localhost:3000
              ↓
Right-clicks "Checkout" button
              ↓
Selects "Inspect with Code Vision"
              ↓
Side panel opens showing:
  🟣 Button Component (collapsible)
  🟣 API Endpoint (collapsible)
  🟣 Database Table (collapsible)
              ↓
Developer expands layers to see details
Asks chat: "Where is payment processing?"
Continues exploring codebase
```

### Entry Points

**Plugin Icon:**
- Opens side panel in general exploration mode
- Shows workspace configuration
- Chat assistant ready for questions

**Right-Click Element:**
- Context menu: "Inspect with Code Vision"
- Opens side panel focused on that specific element
- Shows data flow immediately

**Side Panel Persistence:**
- Stays open while navigating pages
- Updates as user inspects different elements
- Chat history maintained during session
- Workspace remains active

## Side Panel Interface

### Layout

```
┌─────────────────────────────────────┐
│ 🔧 Workspace: E-commerce Platform ▾ │
│    localhost:3000 → storefront-web  │
│    + Add analysis                   │
├─────────────────────────────────────┤
│ 📊 Analysis: main@7895dc8           │
│    Last analyzed: 2 days ago        │
│    🔗 View commit  ⟳ Re-analyze     │
├─────────────────────────────────────┤
│ Selected Element: CheckoutButton    │
│                                     │
│ 🟣 UI Component                     │
│   └─ CheckoutButton.tsx:45          │
│   └─ onClick handler ▸              │
│       └─ handleCheckout()           │
│       └─ validation logic           │
│                                     │
│ 🟣 API Endpoint                     │
│   └─ POST /api/orders ✓ (matched)  │
│   └─ Middleware ▸                   │
│       └─ auth.ts:23                 │
│       └─ rateLimit.ts:12            │
│   └─ Controller ▸                   │
│       └─ createOrder()              │
│   └─ Validation ▸                   │
│                                     │
│ 🟣 Database                         │
│   └─ orders table                   │
│   └─ Columns ▸                      │
│       └─ id, user_id, total...     │
│   └─ Relations ▸                    │
│       └─ → users                    │
│       └─ → order_items              │
├─────────────────────────────────────┤
│ 💬 Chat Assistant                   │
│                                     │
│ 🤖 I see you're looking at the      │
│    Checkout button. It creates      │
│    orders via POST /api/orders.     │
│    What would you like to know?     │
│                                     │
│ [ Ask a question...              ] │
└─────────────────────────────────────┘
```

### Collapsible Layers

**Default State:**
- Collapsed for clean, simple view
- Shows three main layers: UI → API → Database
- Prevents information overload

**Expanded State:**
- Click ▸ to expand any section
- See middleware, validators, helpers, utilities
- Full trace of code execution path
- Expansion state remembered during session

**Visual Indicators:**
- ✓ (matched) - Automatically found in backend analysis
- ⚠️ (not found) - Manual mapping available
- 🔗 (linked) - User manually mapped endpoint

### Analysis Metadata

**Branch & Commit Tracking:**
```
📊 Analysis: main@7895dc8
   Last analyzed: 2 days ago
   🔗 View commit (links to GitHub)
   ⟳ Re-analyze (opens website)
```

**Why This Matters:**
- Developers know which code version was analyzed
- Like Vercel's "Deployed from main@abc123f"
- Clear when analysis is stale
- One-click to view exact commit on GitHub
- Analysis is never auto-triggered (intentional, manual process)

## Chat Assistant

### Hybrid Context System

The chat assistant operates with three levels of context:

**1. Element Context (when something is selected)**
- Knows about currently inspected element
- Answers questions about that specific flow
- Example: "Where does email validation happen for this form?"

**2. Codebase Context (always available)**
- Has access to full analysis data
- Can answer broader architectural questions
- Example: "Show me all authentication endpoints"

**3. Session Context (remembers exploration)**
- Tracks elements user has clicked
- Builds understanding as user explores
- Example: "How does this relate to the login button I looked at earlier?"

### Example Conversation

```
[User right-clicks Submit button]

🤖 I see you're looking at the Submit button in
   UserForm.tsx. It triggers POST /api/users/create.
   What would you like to know?

👤 "What happens if the email already exists?"

🤖 The API checks for duplicate emails at
   api/users/create:34 and returns 400 error.
   The frontend shows this in UserForm.tsx:67.
   [Click to see error handling ▸]

👤 "Show me all user-related API endpoints"

🤖 Here are 8 user endpoints in this codebase:
   • POST /api/users/create (signup)
   • POST /api/auth/login
   • GET /api/users/[id]
   • PATCH /api/users/[id]
   ...

👤 "Where is password hashing done?"

🤖 Password hashing happens in two places:
   1. Signup: lib/repositories/users.ts:11 (bcrypt)
   2. Login: lib/auth.ts:48 (verification)
   Both use bcryptjs with 10 rounds.
```

### Smart Transitions

- Starts focused on selected element
- Naturally expands to broader questions
- Can zoom back in: "Tell me more about that Submit button"
- Maintains conversation context throughout session

## Multi-Repo Workspaces

### Workspace Structure

A workspace can contain multiple analyses for microservices and split architectures:

```
🔧 Workspace: E-commerce Platform

📦 Analyses (3):

  ✓ storefront-web (React SPA)
    Repo: github.com/acme/storefront
    Branch: main@abc123f
    Analyzed: 2 days ago

  ✓ api-backend (Node.js/Express)
    Repo: github.com/acme/api
    Branch: main@def456g
    Analyzed: 1 day ago

  ✓ admin-dashboard (Next.js)
    Repo: github.com/acme/admin
    Branch: develop@ghi789h
    Analyzed: 3 days ago
```

### Smart API Matching Across Repos

When user inspects a button in `storefront-web` that calls `POST /api/orders`, the plugin automatically searches for matching endpoints in `api-backend`:

**Matching Strategy (in order):**

1. **Exact match** - Look for `POST /api/orders` in backend analysis
2. **Normalized match** - Strip common prefixes (`/api`), try `/orders`
3. **Fuzzy match** - Match function names (`createOrder` handler → `/orders` route)
4. **Not found** - Show manual mapping option

**Example Success:**

```
🟣 API Endpoint: POST /api/orders
   📍 Found in: api-backend ✓
   └─ Route: /api/orders
   └─ Handler: createOrder()
   └─ File: routes/orders.ts:45
```

**Example Not Found:**

```
🟣 API Endpoint: POST /api/legacy/checkout
   ⚠️ Not found in api-backend
   📝 [Link to backend endpoint manually]
```

**Manual Mapping:**
- User selects correct endpoint from dropdown
- Plugin remembers mapping for future
- Manual maps stored in workspace config

### Benefits

- See full-stack flow across repo boundaries
- Frontend → Backend → Database in one view
- Works for microservices, monorepo packages, split architectures
- No code changes required to apps

## Edge Cases & Error Handling

### Scenario 1: Element Not Found in Analysis

When user right-clicks an element that doesn't exist in current analysis (new code since last analysis):

```
⚠️ Element Not Found

This element isn't in the current analysis.

📊 Your analysis: main@7895dc8 (2 days ago)
   This might be new code or recent changes.

💬 Chat Assistant Available
   I can still help with:
   • Related components in this codebase
   • Overall architecture and patterns
   • Similar features that are analyzed

   Try asking: "Show me similar form components"

🔄 Re-analyze to include latest changes
   [Open in Code Vision] →
```

**Design Principles:**
- Don't dead-end the user
- Explain why element is missing
- Offer alternative ways to get value (chat)
- Provide clear path forward (re-analyze)

### Scenario 2: No Analysis for Current Site

When user opens plugin on a site with no workspace configured:

```
🔧 No Workspace Configured

This site (localhost:3000) isn't mapped to
any Code Vision analysis.

Options:
1️⃣ Create new workspace
   Map this site to an existing analysis

2️⃣ Analyze a new codebase
   Go to Code Vision website to analyze
   a repository first

[ Set up workspace ]
```

### Scenario 3: API Endpoint Not Found in Backend

When frontend calls an API that doesn't exist in backend analysis:

```
🟣 API Endpoint: POST /api/legacy/checkout

⚠️ Not found in backend analysis
   Possible reasons:
   • Endpoint is in a different repo
   • Analysis is outdated
   • Endpoint path doesn't match

💡 You can:
   • Re-analyze backend to update
   • Manually link to correct endpoint
   • Add another analysis to workspace

[ Link manually ]  [ Re-analyze backend ]
```

### Graceful Degradation

- Plugin always stays functional
- Chat assistant works even without element data
- Clear explanations of what's missing and why
- Actionable next steps provided
- No error states that block usage

## Technical Architecture

### Component Overview

```
┌─────────────────────────────────────────┐
│         Chrome Extension                │
│  ┌────────────────────────────────┐    │
│  │  Content Script                │    │
│  │  - Detects right-clicks        │    │
│  │  - Reads DOM elements          │    │
│  │  - Sends to side panel         │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │  Side Panel (React)            │    │
│  │  - Workspace management        │    │
│  │  - Data flow visualization     │    │
│  │  - Chat assistant UI           │    │
│  └────────────────────────────────┘    │
│                                         │
│  ┌────────────────────────────────┐    │
│  │  Background Service Worker     │    │
│  │  - API communication           │    │
│  │  - Auth token management       │    │
│  │  - Data caching                │    │
│  └────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    ↓
        HTTPS API calls (authenticated)
                    ↓
┌─────────────────────────────────────────┐
│    Code Vision Backend (Existing)       │
│                                         │
│  GET /api/plugin/workspaces            │
│  GET /api/plugin/analyses              │
│  GET /api/plugin/element-data          │
│  POST /api/plugin/chat                 │
│                                         │
│  (Uses existing analysis data,         │
│   no new analysis endpoints needed)    │
└─────────────────────────────────────────┘
```

### Key Technical Decisions

**1. Authentication**
- Same JWT tokens as website
- Stored securely in extension storage (`chrome.storage.local`)
- Refresh token flow for long sessions
- Logout invalidates tokens on both website and plugin

**2. Data Storage**
- **Workspace configs:** Chrome local storage (persistent)
- **Analysis data:** Cached from API (session storage, cleared on panel close)
- **Chat history:** Temporary (cleared on panel close)
- **Manual API mappings:** Stored in workspace config (persistent)

**3. Performance**
- Initial data fetch when workspace loads (one-time per session)
- Incremental loading (only fetch element data on demand)
- Cache aggressively (analysis data doesn't change between re-runs)
- Debounce right-click requests (prevent rapid-fire API calls)

**4. Chrome APIs Used**
- `chrome.sidePanel` - Side panel UI
- `chrome.contextMenus` - Right-click integration
- `chrome.storage` - Workspace and auth persistence
- `chrome.scripting` - Content script injection

### New Backend Endpoints

**GET /api/plugin/workspaces**
```typescript
Response: {
  workspaces: Array<{
    id: string;
    name: string;
    domains: Array<{
      domain: string;
      analysisId: string;
    }>;
    analyses: Array<{
      id: string;
      name: string;
      repoUrl: string;
      branch: string;
      commit: string;
      analyzedAt: string;
    }>;
    manualMappings: Array<{
      frontendCall: string;
      backendEndpoint: string;
    }>;
  }>
}
```

**GET /api/plugin/analysis/:id/element**
```typescript
Query params: {
  component?: string;  // Component name
  file?: string;       // File path
  line?: number;       // Line number
}

Response: {
  element: {
    component: string;
    file: string;
    line: number;
  };
  dataFlow: {
    ui: {
      component: string;
      handlers: Array<{ name: string; file: string; line: number }>;
    };
    api?: {
      method: string;
      path: string;
      matched: boolean;
      analysisId?: string;  // Which analysis provided this data
      middleware: Array<{ name: string; file: string; line: number }>;
      controller: { name: string; file: string; line: number };
      validation: Array<{ name: string; file: string; line: number }>;
    };
    database?: {
      table: string;
      columns: Array<{ name: string; type: string }>;
      relations: Array<{ table: string; type: string }>;
    };
  };
}
```

**POST /api/plugin/chat**
```typescript
Body: {
  analysisId: string;
  message: string;
  elementContext?: {
    component: string;
    file: string;
    line: number;
  };
  sessionHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

Response: {
  message: string;
  suggestions?: Array<string>;  // Follow-up questions
}
```

## MVP Scope

### Included in MVP

✅ Individual user authentication
✅ Manual workspace profiles
✅ Multi-repo workspace support
✅ Side panel UI with collapsible layers
✅ Right-click element inspection
✅ Chat assistant with hybrid context
✅ Smart API matching across repos
✅ Manual endpoint mapping
✅ Analysis metadata display (branch, commit)
✅ Graceful error handling
✅ Chrome Web Store distribution

### Excluded from MVP (Future)

❌ Team/organization features (shared workspaces)
❌ Code navigation (IDE deep links)
❌ Auto-detection of git remote
❌ Optional SDK for automatic project detection
❌ Real-time collaboration
❌ Comments/annotations on code
❌ Custom keyboard shortcuts
❌ Firefox/Edge extension versions

### Why This Scope

**Focus on core value:**
- Understanding code architecture quickly
- Live context while browsing apps
- Multi-repo support for modern architectures

**Intentionally simple:**
- Manual workspace configuration (explicit, reliable)
- Pre-indexed data (fast, cost-effective)
- Individual users (no complex permissions)

**Room to grow:**
- Team features can be added later
- SDK can make setup more automatic
- Code navigation can enhance experience

## Success Metrics

**Adoption:**
- Chrome Web Store installations
- Daily active users
- Workspaces created per user

**Engagement:**
- Elements inspected per session
- Chat messages per session
- Session duration
- Return rate (daily/weekly)

**Business Impact:**
- Website analysis runs triggered from plugin
- Conversion from plugin to website analysis
- Multi-repo workspace creation (indicates serious usage)

**Quality:**
- API matching success rate (automatic vs manual)
- Error rate (element not found, analysis stale)
- Time to first value (install → first inspection)

## Next Steps

1. **Technical Validation**
   - Verify Chrome extension APIs support this design
   - Confirm backend can efficiently serve element data
   - Test performance with large codebases

2. **Prototype**
   - Build minimal side panel UI
   - Implement basic element inspection
   - Test with Code Vision's own codebase (dogfooding)

3. **Backend Implementation**
   - Create 3 new API endpoints
   - Implement element data extraction from existing analyses
   - Build smart API matching algorithm

4. **Chrome Extension Development**
   - Content script for right-click detection
   - Side panel React app
   - Background service worker for API calls

5. **Testing**
   - Test with single-repo projects
   - Test with multi-repo microservices
   - Test error scenarios (stale analysis, missing elements)

6. **Launch**
   - Chrome Web Store submission
   - Beta testing with select users
   - Gather feedback and iterate
