# API Contracts: Critical Security & Stability Fixes

**Feature**: Critical Security & Stability Audit Remediation  
**Date**: April 25, 2026  
**Branch**: `001-critical-security-fixes`

---

## Overview

This document defines the contracts for API endpoints affected by security fixes. All endpoints now require proper authentication and respect rate limits.

---

## Protected Endpoints

### 1. AI Chat Endpoint

**Route**: `POST /api/ai/chat`

**Status**: PROTECTED (New authentication + rate limiting)

#### Request

```typescript
interface AIChatRequest {
  prompt: string;           // Required, max 10000 chars
  model?: string;           // Optional
  mode?: 'group_rag' | 'cs_assistant' | 'student_agent';  // Optional, defaults to 'group_rag'
}
```

**Headers**:
```
Content-Type: application/json
Cookie: supabase-auth-token=...  // Required: Valid Supabase session cookie
```

#### Response

**Success (200)**:
```typescript
interface AIChatResponse {
  message: string;          // AI response or fallback message
  source: 'fallback' | 'puter' | 'ai';  // Response source
  timestamp: string;        // ISO 8601 timestamp
}
```

**Error - Unauthorized (401)**:
```typescript
{
  error: 'Unauthorized',
  message: 'Valid authentication required'
}
```

**Error - Rate Limited (429)**:
```typescript
{
  error: 'Too Many Requests',
  message: 'Rate limit exceeded. Try again in {seconds} seconds.',
  retryAfter: number  // Seconds until next request allowed
}
```

**Error - Bad Request (400)**:
```typescript
{
  error: 'Missing or invalid prompt' | 'Prompt too long (max 10000 characters)'
}
```

#### Rate Limits

- **Limit**: 10 requests per minute per user
- **Window**: 60 seconds (sliding)
- **Storage**: Vercel KV (required — in-memory fallback non-functional on Vercel's stateless runtime). Alternative: Supabase `rate_limits` table.

---

### 2. Admin API - Drizzle Profiles

**Route**: `GET /api/admin/drizzle-profiles`

**Status**: PROTECTED (Fixed authentication)

#### Authentication

**Before (Broken)**:
```typescript
const { data: { session } } = await supabase.auth.getSession();
// Session from unverified cookie
```

**After (Fixed)**:
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
// User verified server-side with Supabase Auth
```

#### Request

**Headers**:
```
Cookie: supabase-auth-token=...  // Required: Valid Supabase session
```

#### Response

**Success (200)**:
```typescript
interface DrizzleProfilesResponse {
  profiles: Array<{
    id: string;
    fullName: string | null;
    username: string | null;
    email: string | null;
    avatarUrl: string | null;
    role: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

**Error - Unauthorized (401)**:
```typescript
{
  error: 'Unauthorized',
  message: 'Authentication required'
}
```

**Error - Forbidden (403)**:
```typescript
{
  error: 'Forbidden',
  message: 'Admin access required'
}
```

---

### 3. Profile Update Action

**Route**: `POST` (Server Action) `updateProfile`

**Status**: VALIDATED (New Zod validation)

#### Request

```typescript
// FormData fields:
interface ProfileUpdateRequest {
  fullName: string;     // 2-100 chars, letters/spaces/hyphens/apostrophes only
  username: string;     // 3-30 chars, alphanumeric + underscore
  website: string;      // Valid HTTP/HTTPS URL, no javascript: scheme
  avatarUrl: string;    // Valid HTTP/HTTPS URL, no javascript: scheme
}
```

#### Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| fullName | Min 2 chars | "Name must be at least 2 characters" |
| fullName | Max 100 chars | "Name must be less than 100 characters" |
| fullName | Valid chars | "Name contains invalid characters" |
| username | Min 3 chars | "Username must be at least 3 characters" |
| username | Max 30 chars | "Username must be less than 30 characters" |
| username | Alphanumeric+_ | "Username can only contain letters, numbers, and underscores" |
| website | Valid URL | "Website must be a valid HTTP/HTTPS URL" |
| website | No JS scheme | "Website URL scheme not allowed" |
| avatarUrl | Valid URL | "Avatar URL must be a valid HTTP/HTTPS URL" |
| avatarUrl | No JS scheme | "Avatar URL cannot use javascript: scheme" |

#### Response

**Success**:
```typescript
{
  success: true,
  message: 'Profile updated successfully'
}
```

**Error - Validation**:
```typescript
{
  success: false,
  error: 'Validation failed',
  fieldErrors: {
    fullName?: string[];
    username?: string[];
    website?: string[];
    avatarUrl?: string[];
  }
}
```

**Error - Unauthorized**:
```typescript
{
  success: false,
  error: 'Not authenticated'
}
```

**Error - Server**:
```typescript
{
  success: false,
  error: 'Internal server error'
}
```

---

## Middleware Contracts

### Route Protection

**File**: `src/middleware.ts`

**Matcher**: `/((?!api|_next|_vercel|.*\..*).*)`

**Protected Route Patterns**:

| Pattern | Protection | Redirect On Denial |
|---------|------------|-------------------|
| `/admin/*` | Admin role required | `/[locale]/login` |
| `/admin-dashboard/*` | Admin role required | `/[locale]/login` |
| `/non-academic/*` | `show_extra_assets` in metadata | `/[locale]/` |
| `/profile/*` | Authenticated user required | `/[locale]/login` |
| `/quiz-attempts/*` | Authenticated user required | `/[locale]/login` |
| `/add-summary/*` | Authenticated user required | `/[locale]/login` |
| `/add-video/*` | Authenticated user required | `/[locale]/login` |
| `/add-file/*` | Authenticated user required | `/[locale]/login` |

### CSP Header Contract

**Added Headers**:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-{NONCE}' https://cdn.jsdelivr.net https://www.googletagmanager.com; style-src 'self' 'nonce-{NONCE}' https://fonts.googleapis.com; img-src 'self' https://res.cloudinary.com https://*.googleusercontent.com data: blob:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://api.puter.com https://*.vercel.app; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';
x-nonce: {GENERATED_NONCE}
```

**Nonce Usage in Components**:

```typescript
// Pages/components using inline scripts must use nonce
interface CSPNonceProps {
  nonce: string;
}

// In layout/page:
const nonce = headers().get('x-nonce');
```

---

## Client Storage Contracts

### localStorage → sessionStorage Migration

**Data Classification**:

| Data | Old Storage | New Storage | Persistence |
|------|-------------|-------------|-------------|
| Quiz attempt progress | localStorage | sessionStorage | Tab session only |
| Quiz history | localStorage | sessionStorage | Tab session only |
| Academic cache | localStorage | sessionStorage + remove PII fields | Tab session only |
| Login attempt counter | localStorage | sessionStorage | Tab session only |
| Signup attempt counter | localStorage | sessionStorage | Tab session only |
| Subject cache | localStorage | localStorage | Permanent (public data) |
| Lecture cache | localStorage | localStorage | Permanent (public data) |
| UI preferences | localStorage | localStorage | Permanent (theme, locale) |

**SessionStorage Contract**:

```typescript
// Key patterns remain the same, storage changes
const QUIZ_ATTEMPT_KEY = `quiz_attempt_${quizId}_${userId}`;
const QUIZ_HISTORY_KEY = 'quiz_history';

// Usage (changed from localStorage to sessionStorage):
sessionStorage.setItem(QUIZ_ATTEMPT_KEY, JSON.stringify(data));
sessionStorage.getItem(QUIZ_ATTEMPT_KEY);
sessionStorage.removeItem(QUIZ_ATTEMPT_KEY);
```

---

## Error Logging Contracts

### Logger Methods

| Method | Development | Production | Use Case |
|--------|-------------|------------|----------|
| `logger.error()` | ✅ Console + Stack | ✅ Console + Sentry | All errors |
| `logger.warn()` | ✅ Console | ✅ Console + Sentry | Warnings |
| `logger.info()` | ✅ Console | ❌ Silent | Debug info |
| `logger.debug()` | ✅ Console | ❌ Silent | Verbose debug |

### Error Object Shape

```typescript
interface LoggedError {
  name?: string;
  message: string;
  stack?: string;
  cause?: unknown;
  raw?: Record<string, unknown>;
}

interface LogEntry {
  message: string;
  error?: LoggedError;
  context?: Record<string, unknown>;
  timestamp: string;  // ISO 8601
}
```

---

## Migration Compatibility

### Breaking Changes

| Change | Impact | Mitigation |
|--------|--------|------------|
| AI endpoint requires auth | Scripts using AI without login | Add authentication |
| Rate limiting | High-volume users | Implement client-side debouncing |
| CSP nonces | Inline scripts without nonce | Add nonce or move to external file |
| sessionStorage | Data lost on tab close | Acceptable for temporary data |

### Backward Compatibility

- Profile updates: Validated but same API shape
- Admin endpoints: Same response format
- Authentication: Same cookie format
- Cloudinary URLs: No change (just configurable cloud name)

---

## Testing Contract

### Expected Test Cases

| Endpoint | Test | Expected |
|----------|------|----------|
| `/api/ai/chat` | No auth cookie | 401 Unauthorized |
| `/api/ai/chat` | Valid auth, 11th request in 1 min | 429 Too Many Requests |
| `/api/ai/chat` | Valid auth, within limit | 200 with response |
| `/api/admin/*` | Valid user, non-admin | 403 Forbidden |
| `/api/admin/*` | No auth | 401 Unauthorized |
| `updateProfile` | `javascript:alert(1)` in avatarUrl | Validation error |
| `updateProfile` | `data:text/html,` in website | Validation error |
| `updateProfile` | Valid inputs | Success |
| `/admin/*` | No middleware | Redirect to login |
| `/admin/*` | With middleware, no auth | Redirect to login |
| `/admin/*` | With middleware, admin auth | 200 OK |

---

## Security Headers Summary

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | Nonce-based directives + `object-src 'none'` | XSS + plugin execution prevention |
| `X-Frame-Options` | `DENY` | Clickjacking prevention |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing prevention |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Privacy |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Feature policy |
