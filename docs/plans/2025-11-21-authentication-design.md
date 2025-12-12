# Authentication System Design

## Overview

Add email/password authentication with configurable domain restriction (northwestern.edu and subdomains). Projects are scoped to individual users.

## Core Decisions

| Decision | Choice |
|----------|--------|
| Post-signup behavior | Immediate access (no email verification) |
| Domain configuration | Environment variable |
| Session management | JWT tokens in HttpOnly cookies |
| Password hashing | bcryptjs |
| Page protection | Public home, protect project features |
| Project scoping | User-owned projects |

---

## Section 1: Database Schema

### Users Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### Projects Table Update

Add `user_id` foreign key to scope projects to users:

```sql
-- Add to projects table
user_id TEXT NOT NULL,
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
```

### Environment Variables

```env
ALLOWED_EMAIL_DOMAINS=northwestern.edu
JWT_SECRET=your-secret-key-here
```

The JWT_SECRET should be a random 32+ character string for signing tokens.

---

## Section 2: Authentication Flow

### Signup Flow
1. User submits email + password
2. Validate email ends with `.northwestern.edu` or `@northwestern.edu`
3. Check email not already registered
4. Hash password with bcryptjs
5. Create user record
6. Generate JWT token
7. Set HttpOnly cookie with token
8. Redirect to home/projects

### Login Flow
1. User submits email + password
2. Find user by email
3. Compare password with bcryptjs
4. Generate JWT token
5. Set HttpOnly cookie
6. Redirect to home/projects

### Logout Flow
1. Clear the cookie
2. Redirect to login

### JWT Token Contents
```typescript
{
  userId: string;
  email: string;
  exp: number; // 7 days expiry
}
```

### Cookie Settings
- HttpOnly: true (not accessible via JavaScript)
- Secure: true in production (HTTPS only)
- SameSite: 'lax'
- Max-Age: 7 days

---

## Section 3: API Routes & Middleware

### New API Routes

- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/me` - Get current user (for frontend)

### Auth Middleware

Create a reusable function to protect API routes:

```typescript
// src/lib/auth.ts
export function getUserFromRequest(request: NextRequest): User | null
export function requireAuth(request: NextRequest): User // throws if not authenticated
```

### Protected Routes Update

All existing API routes that touch projects need auth:
- `GET/POST /api/projects` - Filter by user_id
- `GET/DELETE /api/projects/[id]` - Verify ownership
- `POST /api/analyze` - Verify project ownership
- `GET /api/analysis/*` - Verify project ownership
- `POST /api/chat` - Verify project ownership
- `GET/POST/DELETE /api/documents/*` - Verify project ownership

---

## Section 4: Frontend Pages & Protection

### New Pages

- `/login` - Login form
- `/signup` - Signup form with email domain validation hint

### Page Protection

Create a client-side auth hook and wrapper:

```typescript
// src/lib/hooks/useAuth.ts
export function useAuth() {
  // Returns { user, loading, logout }
  // Fetches from /api/auth/me
}
```

### Protected Pages

These pages check auth and redirect to `/login` if not authenticated:
- `/projects/[id]` - Project detail
- `/projects/[id]/report` - Report page
- `/projects/new` - Create project

### Public Pages

- `/` - Home/landing page (visible to all)
- `/login` - Login page
- `/signup` - Signup page

### Navigation Updates

- Show "Login/Signup" buttons when logged out
- Show user email and "Logout" when logged in

---

## Section 5: File Structure

### New Files

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── signup/route.ts
│   │       ├── login/route.ts
│   │       ├── logout/route.ts
│   │       └── me/route.ts
│   ├── login/
│   │   └── page.tsx
│   └── signup/
│       └── page.tsx
├── lib/
│   ├── auth.ts              # JWT utils, cookie handling, requireAuth
│   ├── repositories/
│   │   └── users.ts         # User CRUD operations
│   └── hooks/
│       └── useAuth.ts       # Client-side auth hook
```

### Modified Files

- `src/lib/schema.sql` - Add users table, update projects
- `src/lib/db.ts` - Add User type
- `src/app/api/projects/route.ts` - Add auth, filter by user
- `src/app/api/projects/[id]/route.ts` - Verify ownership
- `src/app/api/analyze/route.ts` - Verify ownership
- `src/app/api/analysis/*` - Verify ownership
- `src/app/api/documents/*` - Verify ownership
- `src/app/api/chat/route.ts` - Verify ownership
- `src/app/layout.tsx` - Add auth context/navigation
- `src/app/page.tsx` - Update for public view

---

## Domain Validation Logic

```typescript
function isAllowedEmail(email: string, allowedDomains: string[]): boolean {
  const emailLower = email.toLowerCase();
  return allowedDomains.some(domain => {
    const domainLower = domain.toLowerCase();
    return emailLower.endsWith(`@${domainLower}`) ||
           emailLower.endsWith(`.${domainLower}`);
  });
}

// Examples with ALLOWED_EMAIL_DOMAINS=northwestern.edu:
// name@northwestern.edu ✓
// name@kellogg.northwestern.edu ✓
// name@u.northwestern.edu ✓
// name@gmail.com ✗
```
