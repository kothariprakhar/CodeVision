# Code Vision: Onboarding Pivot Design

## Overview

Pivot from "quality verification for design studios" to "codebase onboarding for developers joining unfamiliar projects."

### Target Persona
Developer being onboarded onto an unfamiliar codebase who needs to:
- Understand project architecture and module relationships
- Ask questions about specific code areas
- Estimate complexity for new features

## Core Decisions

| Decision | Choice |
|----------|--------|
| Chatbot knowledge scope | Hybrid (analysis context + real-time code search) |
| Chatbot location | Project detail page, below architecture diagram |
| Analysis versioning | Keep full history of all analyses |
| Chat history per version | Each version has its own chat history |
| Code access method | Keep cloned repo on disk per project |
| Chatbot guardrails | Tiered responses (quick facts vs. deeper exploration) |
| Issues location | Separate tab on project detail page |
| Analysis trigger | Auto on project creation, manual thereafter |
| Version selector | Dropdown with "Latest" label + dates |

---

## Section 1: Database & Data Model Changes

### Analysis Versioning

The `analysis_results` table already stores multiple analyses per project. Add:

```sql
-- Add to analysis_results table
chat_history TEXT NOT NULL DEFAULT '[]'
```

### Chat History Structure

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  responseType: 'quick' | 'detailed';
}
```

### Repository Storage

- Store cloned repos in `data/repos/{project_id}/`
- Add `repo_path` column to `projects` table
- Clean up on project deletion

---

## Section 2: Project Detail Page Restructure

### Tab Layout

```
┌─────────────────────────────────────────┐
│ Project Name                            │
│ GitHub URL • Last analysed 2 days ago   │
├──────────────┬──────────────────────────┤
│ Architecture │ Issues                   │  ← Tabs
├──────────────┴──────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ Version: [Latest - Nov 20 ▼]       │ │
│ │         [Run Analysis]              │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │      Architecture Diagram           │ │
│ │      (MVC visualization)            │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │      Chatbot Interface              │ │
│ │ ┌─────────────────────────────────┐ │ │
│ │ │ Chat messages...                │ │ │
│ │ └─────────────────────────────────┘ │ │
│ │ [Ask about this codebase...    ] 📤 │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Issues Tab

- Shows findings from the selected analysis version
- Severity badges, descriptions, affected files
- Link to full report page

---

## Section 3: Chatbot Architecture

### Frontend Component

- Scrollable message history
- Input field with send button
- Loading state during responses
- Visual distinction between quick facts and detailed responses

### API Endpoint

`POST /api/chat`

```typescript
// Request
{
  project_id: string;
  analysis_id: string;
  message: string;
}

// Response
{
  id: string;
  content: string;
  responseType: 'quick' | 'detailed';
  timestamp: string;
}
```

### Hybrid Query Flow

1. Receive user question
2. Load analysis context (summary, architecture, findings)
3. Determine if code search is needed
4. If yes: search/read files from `data/repos/{project_id}/`
5. Send to Claude with tiered response instruction:
   - Quick factual answers for specific questions
   - Suggest deeper exploration for complex questions
6. Save message pair to chat history
7. Return response

---

## Section 4: Analysis Flow Changes

### Auto-Analysis on Project Creation

Update `POST /api/projects` to:
1. Create project record
2. Clone repository to `data/repos/{project_id}/`
3. Automatically trigger analysis
4. Return project with `status: 'analyzing'`

### Repository Persistence

- Clone to `data/repos/{project_id}/` instead of temp directory
- Remove cleanup after analysis
- Add cleanup function for project deletion

### Version Dropdown Data

`GET /api/analysis/versions/{projectId}`

```typescript
// Response
{
  versions: [
    { id: string; analyzed_at: string; is_latest: boolean },
    ...
  ]
}
```

### Run Analysis Button

- Shows "Last analysed X days ago" using relative time
- On click, creates new analysis version
- Dropdown updates to show new version as "Latest"

---

## Section 5: Report Page Simplification

### New Role

Detailed issues view (architecture diagram removed):

```
┌─────────────────────────────────────────┐
│ ← Back to Project                       │
│                                         │
│ Analysis Report - Nov 20, 2025          │
│ ─────────────────────────────────────── │
│                                         │
│ Summary                                 │
│ [Plain language overview]               │
│                                         │
│ Findings (12)                           │
│ ┌─────────────────────────────────────┐ │
│ │ 🔴 Critical (2)                     │ │
│ │ • Missing auth on /api/users        │ │
│ │ • SQL injection in search           │ │
│ ├─────────────────────────────────────┤ │
│ │ 🟡 Warning (5)                      │ │
│ │ • No error handling in...           │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### Access

- Link from Issues tab: "View full report →"
- Direct URL still works for sharing

---

## Section 6: File & Folder Structure

### New Files

```
src/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts              # Chatbot endpoint
│   │   └── analysis/
│   │       └── versions/
│   │           └── [projectId]/
│   │               └── route.ts      # List analysis versions
│   └── projects/
│       └── [id]/
│           └── page.tsx              # Tabs, diagram, chatbot
├── components/
│   ├── ChatBot.tsx                   # Chatbot component
│   ├── ArchitectureDiagram.tsx       # Extracted from report
│   ├── AnalysisVersionSelector.tsx   # Dropdown component
│   └── Tabs.tsx                      # Reusable tab component
└── lib/
    ├── services/
    │   └── chat.ts                   # Chat service with hybrid logic
    └── repositories/
        └── analysis.ts               # Chat history methods
```

### Data Directory

```
data/
├── repos/
│   └── {project_id}/                 # Persistent cloned repos
└── database.sqlite
```

---

## Section 7: Implementation Phases

### Phase 1: Core Restructure
- Update database schema (chat_history, repo_path)
- Modify GitHub service for persistent repo storage
- Restructure project detail page with tabs
- Move architecture diagram to project detail page
- Auto-analyze on project creation

### Phase 2: Chatbot
- Create chat service with hybrid query logic
- Build chatbot UI component
- Implement chat API endpoint
- Add chat history persistence per analysis version

### Phase 3: Version Management
- Analysis version dropdown
- Version-specific chat history switching
- "Last analysed X days ago" display
- Simplify report page

---

## Future Extensions

- Chrome extension for frontend exploration with hover/click interactions
