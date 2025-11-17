# Code Vision MVP Design

A web app for non-technical users to assess code quality and requirements alignment of contracted development work.

## Architecture Overview

**System Components:**
- **Next.js Application** - Single full-stack app handling UI, API routes, and business logic
- **SQLite Database** - Stores projects, uploaded documents metadata, analysis results
- **Local Filesystem** - Temporary storage for cloned repos and uploaded files
- **Claude API** - Powers the intelligent analysis of code vs requirements

**High-Level Flow:**
1. User creates a project and uploads documentation (PRD, wireframes, etc.)
2. User provides GitHub repo URL + Personal Access Token
3. System clones repo to temp directory
4. System sends code + documentation to Claude for alignment analysis
5. Claude returns structured findings (gaps + fidelity issues, prioritized)
6. System generates a plain-language report
7. Temp files are cleaned up

**Key Architectural Decisions:**
- No auth for MVP (single-user assumed per instance)
- All processing happens synchronously (small repos, simple for MVP)
- Reports are generated once and stored (no real-time updates)
- SaaS deployment model (hosted service)

## Data Model

**Projects Table:**
- `id` - Unique identifier
- `name` - Project name
- `description` - Optional project description
- `github_url` - Repository URL
- `github_token` - Encrypted PAT (stored securely)
- `created_at` - Timestamp
- `status` - 'pending' | 'analyzing' | 'completed' | 'failed'

**Documents Table:**
- `id` - Unique identifier
- `project_id` - Foreign key to project
- `filename` - Original filename
- `file_type` - 'pdf' | 'markdown' | 'text' | 'image'
- `file_path` - Local storage path
- `uploaded_at` - Timestamp

**Analysis Results Table:**
- `id` - Unique identifier
- `project_id` - Foreign key to project
- `summary` - Executive summary text
- `findings` - JSON blob containing prioritized issues (gaps + fidelity)
- `raw_response` - Full Claude response for debugging
- `analyzed_at` - Timestamp

## Core User Flows

**1. Create Project:**
- User clicks "New Project"
- Enters project name, optional description
- Enters GitHub repo URL
- Pastes their Personal Access Token
- System validates token can access the repo (quick API check)
- Project created with 'pending' status

**2. Upload Documentation:**
- User views project detail page
- Drags/drops or selects files (PDF, Markdown, text, images)
- System stores files locally, creates document records
- Files displayed in a simple list with type icons
- User can delete individual documents

**3. Run Analysis:**
- User clicks "Analyze" button
- System clones repo to temp directory
- System reads all uploaded documents
- System constructs prompt with: requirements context + code samples
- Claude analyzes alignment and returns structured findings
- System parses response into report format
- Results saved to database, temp files cleaned up
- User sees report page

**4. View Report:**
- Executive summary (2-3 paragraphs, non-technical language)
- Priority-ranked list of findings
- Each finding has: title, severity (Critical/High/Medium/Low), plain-language explanation, specific file references

## Claude API Integration Strategy

**The Challenge:**
Repos can be large (thousands of files), but Claude has context limits. We need to be smart about what we send.

**Approach: Intelligent Code Sampling**

1. **Parse requirements first** - Extract key features, entities, flows from uploaded docs
2. **Smart file selection** - Based on requirements, identify relevant code:
   - Entry points (main files, index files, routes)
   - Files matching feature keywords from requirements
   - Core business logic directories (src/, lib/, app/)
   - Skip: node_modules, build artifacts, test files (for MVP)
3. **Prioritized context building** - Fill context window with most relevant files first
4. **Structured prompt** - Ask Claude to:
   - Identify features mentioned in requirements
   - Check which are implemented vs missing
   - Assess implementation quality for what exists
   - Prioritize findings by business impact

**Response Structure:**
```json
{
  "summary": "Executive overview...",
  "findings": [
    {
      "type": "gap" | "fidelity",
      "severity": "critical" | "high" | "medium" | "low",
      "title": "Missing payment flow",
      "description": "Plain language explanation...",
      "evidence": ["Referenced in PRD section 3.2", "No payment-related code found"]
    }
  ]
}
```

## File & Directory Structure

```
code-vision/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── page.tsx            # Home/project list
│   │   ├── projects/
│   │   │   ├── new/page.tsx    # Create project form
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # Project detail (upload docs)
│   │   │       └── report/page.tsx  # Analysis report
│   │   └── api/
│   │       ├── projects/       # CRUD for projects
│   │       ├── documents/      # File upload handling
│   │       └── analyze/        # Trigger analysis
│   ├── lib/
│   │   ├── db.ts               # SQLite connection & queries
│   │   ├── github.ts           # Repo cloning & validation
│   │   ├── claude.ts           # Claude API integration
│   │   ├── analyzer.ts         # Core analysis orchestration
│   │   └── file-parser.ts      # PDF/markdown/image parsing
│   └── components/
│       ├── ProjectCard.tsx
│       ├── FileUploader.tsx
│       └── ReportView.tsx
├── uploads/                    # Uploaded documents (gitignored)
├── temp/                       # Cloned repos (gitignored)
├── data/
│   └── database.sqlite         # SQLite database file
└── .env.local                  # API keys, encryption key
```

## Error Handling & Edge Cases

**GitHub Access Errors:**
- Invalid token: Clear message "Token doesn't have access to this repo"
- Repo not found: "Repository URL not found or is private"
- Rate limiting: "GitHub rate limit reached, try again in X minutes"
- Clone timeout: Set 5-minute timeout for cloning, fail gracefully

**File Upload Errors:**
- Unsupported format: Reject with list of accepted types
- File too large: 10MB limit per file for MVP
- Corrupted PDF: "Unable to parse this PDF, try a different export"
- Image too large: Resize/compress before sending to Claude

**Analysis Errors:**
- Claude API timeout: "Analysis taking too long, please try with a smaller repo"
- Claude rate limit: Queue and retry with backoff
- Malformed response: Log raw response, show "Analysis failed, please retry"
- Empty repo: "No source code found in repository"
- No requirements uploaded: Block analysis button until docs uploaded

**User Feedback:**
- All errors shown in plain language (no technical jargon)
- Actionable suggestions where possible
- Failed analyses can be retried without re-uploading docs

## MVP Scope

**What's IN the MVP:**
- Create/view/delete projects
- Upload PDF, Markdown, text, and image files
- GitHub repo connection via PAT
- Single analysis run per project (can re-run)
- Plain-language report with prioritized findings
- Requirements alignment analysis (gaps + fidelity)

**What's explicitly OUT (but designed for):**
- User authentication (schema supports it, NextAuth.js ready)
- Code health metrics (analyzer architecture supports adding metrics)
- Team collaboration (single-user for now)
- Rich format imports (Figma, Notion, Google Docs)
- Interactive dashboard (report-only for MVP)
- Historical analysis comparison
- Webhooks/notifications

**Technical Debt Accepted for MVP:**
- Basic token encryption (env-based key)
- Synchronous analysis (no job queue)
- No caching of analysis results
- Simple file cleanup (on analysis complete only)
- No retry logic for transient failures

## Immediate Post-MVP: Code Health Metrics

- Add complexity scoring (cyclomatic complexity)
- Test coverage detection
- Dependency vulnerability scanning
- Code duplication analysis
- These integrate into the same report structure

## Tech Stack

- **Framework:** Next.js 14+ with App Router (TypeScript)
- **Database:** SQLite (via better-sqlite3 or Drizzle ORM)
- **File Storage:** Local filesystem
- **AI:** Claude API (Anthropic)
- **Deployment:** Vercel (SaaS model)
- **PDF Parsing:** pdf-parse or similar
- **Git Operations:** simple-git or isomorphic-git
