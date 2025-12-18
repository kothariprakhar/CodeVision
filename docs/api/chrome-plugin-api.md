# Chrome Plugin Backend API Documentation

**Version:** 1.0.0
**Base URL:** `https://yourdomain.com` (or `http://localhost:3000` for development)
**Authentication:** JWT tokens via httpOnly cookies

---

## Overview

This document describes the backend APIs available to the Chrome extension for Code Vision. All endpoints require authentication via JWT tokens obtained through the login flow.

## Authentication

### How Chrome Extension Gets Authenticated

The Chrome extension shares authentication with the main website. Users must log in via the website first, then the extension can access their session.

**Authentication Flow:**

1. User logs in on website: `POST /api/auth/login`
2. Server sets httpOnly cookie with JWT token
3. Extension makes API calls with credentials included
4. Server validates JWT from cookie

**Important:** All Chrome extension API calls must include credentials:

```javascript
fetch('https://yourdomain.com/api/plugin/workspaces', {
  method: 'GET',
  credentials: 'include', // CRITICAL: Include cookies
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Error Responses

All endpoints return consistent error format:

```json
{
  "error": "Error message here"
}
```

**Common Status Codes:**
- `401 Unauthorized` - No valid JWT token, user needs to log in
- `403 Forbidden` - User doesn't own the requested resource
- `404 Not Found` - Resource doesn't exist
- `500 Internal Server Error` - Server error, check logs

---

## Endpoints

### GET /api/plugin/workspaces

**Purpose:** Fetch user's workspace configurations with domain mappings and associated analyses.

**Authentication:** Required (JWT via cookie)

**Request:**
```http
GET /api/plugin/workspaces HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
```

**Response (200 OK):**
```json
{
  "workspaces": [
    {
      "id": "workspace-uuid",
      "name": "E-commerce Platform",
      "domains": [
        { "domain": "localhost:3000", "analysisId": "analysis-abc" },
        { "domain": "admin.localhost:3000", "analysisId": "analysis-def" }
      ],
      "analyses": [
        {
          "id": "analysis-abc",
          "name": "storefront-web",
          "repoUrl": "https://github.com/acme/storefront",
          "branch": "main",
          "commit": "abc123f",
          "analyzedAt": "2025-12-15T10:00:00Z"
        },
        {
          "id": "analysis-def",
          "name": "api-backend",
          "repoUrl": "https://github.com/acme/api",
          "branch": "main",
          "commit": "def456g",
          "analyzedAt": "2025-12-14T15:00:00Z"
        }
      ],
      "manualMappings": [
        {
          "frontendCall": "POST /api/checkout",
          "backendEndpoint": "POST /orders",
          "backendAnalysisId": "analysis-def"
        }
      ]
    }
  ]
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Unauthorized"
}
```

**Usage Example (Chrome Extension):**
```javascript
async function loadWorkspaces() {
  const response = await fetch('https://yourdomain.com/api/plugin/workspaces', {
    credentials: 'include',
  });

  if (response.status === 401) {
    // User needs to log in on website first
    showLoginPrompt();
    return;
  }

  const data = await response.json();
  return data.workspaces;
}
```

---

### POST /api/plugin/workspaces

**Purpose:** Create a new workspace configuration.

**Authentication:** Required (JWT via cookie)

**Request:**
```http
POST /api/plugin/workspaces HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "name": "My New Workspace",
  "domainMappings": [
    { "domain": "localhost:3000", "analysisId": "analysis-xyz" }
  ],
  "analysisIds": ["analysis-xyz"],
  "manualMappings": []
}
```

**Response (201 Created):**
```json
{
  "workspace": {
    "id": "new-workspace-uuid",
    "name": "My New Workspace",
    "domain_mappings": [
      { "domain": "localhost:3000", "analysisId": "analysis-xyz" }
    ],
    "analysis_ids": ["analysis-xyz"],
    "manual_mappings": [],
    "created_at": "2025-12-17T10:00:00Z",
    "updated_at": "2025-12-17T10:00:00Z"
  }
}
```

**Response (400 Bad Request):**
```json
{
  "error": "name is required"
}
```

---

### GET /api/plugin/analysis/:id/element

**Purpose:** Fetch element-specific analysis data with data flow tracing.

**Authentication:** Required (JWT via cookie)

**Query Parameters:**
- `selector` (optional) - CSS selector for the element (e.g., `button[data-testid="checkout"]`)
- `component` (optional) - Component name (e.g., `CheckoutButton`)
- `file` (optional) - File path to disambiguate when multiple components match

**Request:**
```http
GET /api/plugin/analysis/abc123/element?component=CheckoutButton&file=src/components/CheckoutButton.tsx HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
```

**Response (200 OK):**
```json
{
  "element": {
    "selector": "button[data-testid='checkout-btn']",
    "component": "CheckoutButton",
    "file": "src/components/CheckoutButton.tsx",
    "line": 45,
    "type": "button"
  },
  "dataFlow": {
    "ui": {
      "component": "CheckoutButton",
      "file": "src/components/CheckoutButton.tsx",
      "line": 45,
      "handlers": [
        {
          "name": "handleCheckout",
          "file": "src/components/CheckoutButton.tsx",
          "line": 12
        }
      ]
    },
    "api": {
      "method": "POST",
      "path": "/api/orders",
      "file": "src/components/CheckoutButton.tsx",
      "line": 18,
      "matched": false
    },
    "database": null
  }
}
```

**Response (404 Not Found):**
```json
{
  "error": "Element not found",
  "message": "This element is not in the current analysis. It may be new code added after analysis."
}
```

**Usage Example (Chrome Extension):**
```javascript
async function inspectElement(analysisId, componentName, filePath) {
  const url = new URL(`https://yourdomain.com/api/plugin/analysis/${analysisId}/element`);
  url.searchParams.set('component', componentName);
  url.searchParams.set('file', filePath);

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (response.status === 404) {
    const data = await response.json();
    // Show user-friendly "element not found" message
    showElementNotFound(data.message);
    return null;
  }

  return await response.json();
}
```

---

### POST /api/plugin/chat

**Purpose:** Chat with AI assistant about codebase with optional element context.

**Authentication:** Required (JWT via cookie)

**Request:**
```http
POST /api/plugin/chat HTTP/1.1
Host: yourdomain.com
Cookie: auth-token=<jwt>
Content-Type: application/json

{
  "analysisId": "analysis-abc",
  "message": "Where is email validation for this form?",
  "elementContext": {
    "component": "SignupForm",
    "file": "src/components/SignupForm.tsx",
    "line": 34,
    "selector": "form#signup"
  }
}
```

**Request Fields:**
- `analysisId` (required) - Analysis UUID to chat about
- `message` (required) - User's question (max 2000 characters)
- `elementContext` (optional) - Element being inspected
  - `component` (optional) - Component name
  - `file` (optional) - File path
  - `line` (optional) - Line number
  - `selector` (optional) - CSS selector

**Response (200 OK):**
```json
{
  "id": "response-uuid",
  "content": "Email validation happens in two places:\n1. Frontend: src/validators/email.ts:12 (basic format check)\n2. Backend: src/controllers/users.ts:45 (uniqueness check against database)",
  "responseType": "quick",
  "timestamp": "2025-12-17T10:05:00Z"
}
```

**Response Fields:**
- `id` - Unique response ID
- `content` - AI assistant's response message
- `responseType` - `"quick"` or `"detailed"` based on question type
- `timestamp` - ISO 8601 timestamp

**Usage Example (Chrome Extension):**
```javascript
async function askQuestion(analysisId, question, elementContext = null) {
  const response = await fetch('https://yourdomain.com/api/plugin/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      analysisId,
      message: question,
      elementContext,
    }),
  });

  if (!response.ok) {
    throw new Error('Chat request failed');
  }

  return await response.json();
}

// Usage with element context
const result = await askQuestion(
  'analysis-abc',
  'What does this button do?',
  {
    component: 'CheckoutButton',
    file: 'src/components/CheckoutButton.tsx',
    line: 45
  }
);

console.log(result.content); // AI's answer
```

---

## Rate Limiting

Currently no rate limiting is implemented. Future versions may add:
- Max 60 requests per minute per user
- Max 10 chat messages per minute per user

## CORS Configuration

API endpoints are configured for same-origin requests only. Chrome extension must:
1. Use `credentials: 'include'` in all fetch calls
2. Make requests from extension background script (not content script)
3. Request host permissions for the API domain in manifest.json

**Extension Manifest (manifest.json):**
```json
{
  "host_permissions": [
    "https://yourdomain.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  }
}
```

## Testing Endpoints

**Development Server:**
```bash
# Start development server
npm run dev

# Server runs on http://localhost:3000
```

**Test Authentication:**
```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  -c cookies.txt

# Test workspaces endpoint
curl -X GET http://localhost:3000/api/plugin/workspaces \
  -b cookies.txt
```

## Error Handling Best Practices

**1. Handle 401 (Unauthorized):**
```javascript
if (response.status === 401) {
  // User session expired or not logged in
  chrome.tabs.create({ url: 'https://yourdomain.com/login' });
  return;
}
```

**2. Handle 404 (Not Found):**
```javascript
if (response.status === 404) {
  const data = await response.json();
  // Show helpful message to user
  showNotification(data.message || 'Resource not found');
  return;
}
```

**3. Handle 500 (Server Error):**
```javascript
if (response.status === 500) {
  // Server error, retry with exponential backoff
  await retryWithBackoff(() => fetch(url, options));
}
```

## Support

For issues or questions:
- Check server logs for error details
- Verify authentication tokens are valid
- Ensure database migrations have been applied
- Contact backend team with reproduction steps

---

**Last Updated:** 2025-12-17
**API Version:** 1.0.0
