# Data Model: Critical Security & Stability Fixes

**Feature**: Critical Security & Stability Audit Remediation  
**Date**: April 25, 2026  
**Branch**: `001-critical-security-fixes`

---

## Overview

This document describes the data models and validation schemas required for the security fixes. Most changes are behavioral rather than schema changes, but we introduce new validation schemas and rate limiting data structures.

---

## Validation Schemas

### ProfileSchema (Zod)

**Location**: `src/lib/validation/profile.ts` (to be created)

**Purpose**: Validate profile update inputs to prevent XSS and invalid data

```typescript
import { z } from 'zod';

export const ProfileSchema = z.object({
  fullName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be less than 100 characters')
    .regex(/^[\p{L}\s'-]+$/u, 'Name contains invalid characters'),
  
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  
  website: z.string()
    .max(200, 'Website URL too long')
    .refine((val) => {
      if (!val) return true; // Optional field
      try {
        const url = new URL(val);
        // Block javascript: and data: schemes
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Website must be a valid HTTP/HTTPS URL'),
  
  avatarUrl: z.string()
    .max(500, 'Avatar URL too long')
    .refine((val) => {
      if (!val) return true; // Optional field
      // Must be a valid URL with http/https scheme
      // This also blocks javascript:, data:, vbscript: etc.
      try {
        const url = new URL(val);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Avatar URL must be a valid HTTP/HTTPS URL'),
});

export type ProfileUpdateInput = z.infer<typeof ProfileSchema>;
```

**Validation Rules**:
- **fullName**: 2-100 chars, letters/spaces/hyphens/apostrophes only (Unicode aware)
- **username**: 3-30 chars, alphanumeric + underscore only
- **website**: Valid HTTP/HTTPS URL only, no `javascript:` or `data:` schemes
- **avatarUrl**: Valid HTTP/HTTPS URL only, no `javascript:` scheme (XSS prevention)

---

## Rate Limiting Model

### AI Chat Rate Limit

**Storage**: Vercel KV (required — in-memory fallback non-functional on Vercel's stateless runtime). Alternative: Supabase `rate_limits` table.

**Key Pattern**: `rate_limit:ai_chat:${userId}`

**Structure**:
```typescript
interface RateLimitEntry {
  count: number;        // Requests made in current window
  windowStart: number;  // Timestamp (ms) when window started
  userId: string;       // User identifier
}
```

**Configuration**:
```typescript
const AI_CHAT_RATE_LIMIT = {
  windowMs: 60 * 1000,    // 1 minute window
  maxRequests: 10,         // 10 requests per window
  keyPrefix: 'rate_limit:ai_chat:',
};
```

**Algorithm**: Sliding window counter
1. On request: Check if current window expired
2. If expired: Reset counter, set new window start
3. If count >= maxRequests: Return 429 Too Many Requests
4. Else: Increment counter, allow request

---

## Storage Model Changes

### localStorage → sessionStorage Migration

**Affected Keys**:

| Current Key | New Storage | Data Type | PII Level |
|-------------|-------------|-----------|-----------|
| `quiz_attempt_${quizId}_${userId}` | sessionStorage | Quiz answers | Medium (user progress) |
| `quiz_history` | sessionStorage | Quiz results | Medium (user history) |
| `USER_ACADEMIC_CACHE_KEY` | sessionStorage + remove PII fields | Academic data | Low (remove userId from cache) |
| `login_attempts` | sessionStorage + server | Attempt counter | Low |
| `signup_attempts` | sessionStorage + server | Attempt counter | Low |

**Retained in localStorage** (public data only):
- Subject cache
- Lecture cache
- Platform settings
- UI preferences (theme, locale)

---

## CSP Nonce Model

### Nonce Generation

**Location**: Middleware (`src/middleware.ts`)

**Algorithm**:
```typescript
// Generate cryptographically secure nonce
const generateNonce = () => {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
};

// Store in response header for inline scripts to use
response.headers.set('x-nonce', nonce);
```

### CSP Policy

**Directives**:
```
default-src 'self';
script-src 'self' 'nonce-{GENERATED_NONCE}' https://cdn.jsdelivr.net https://www.googletagmanager.com;
style-src 'self' 'nonce-{GENERATED_NONCE}' https://fonts.googleapis.com;
img-src 'self' https://res.cloudinary.com https://*.googleusercontent.com data: blob:;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' https://*.supabase.co https://api.puter.com https://*.vercel.app;
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

**Key Changes**:
- ✅ Remove `'unsafe-inline'` (replaced with nonces)
- ✅ Remove `'unsafe-eval'` (no eval() usage found)
- ✅ Add explicit domains for all external resources
- ✅ `object-src 'none'` prevents plugin execution (Flash, Java applets)
- ✅ `frame-ancestors 'none'` prevents clickjacking
- ⚠️ `data:` in `img-src` accepted with documented risk (needed for base64 images)
- ⚠️ Verify next-intl inline scripts work with nonce CSP (EC-2)

---

## Authentication State Model

### Session Verification

**Current (Broken)**:
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) throw new Error('Unauthorized');  // ← Only checks cookie existence
```

**Fixed**:
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
if (error || !user) throw new Error('Unauthorized');  // ← Server-side JWT verification
```

### Auth Lock State

**Current (Broken)**:
```typescript
const noOpLock = async <T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> => {
  return await fn();  // No actual locking
};
```

**Fixed**: Remove `noOpLock` configuration entirely. Supabase SSR provides proper locking by default.

---

## Error Logging Model

### Logger Output

**Development**:
```typescript
logger.error('Database connection failed', error, { userId: '123' });
// Console output: [ERROR] Database connection failed { error: {...}, userId: '123', timestamp: '...' }
```

**Production** (after fix):
```typescript
logger.error('Database connection failed', error, { userId: '123' });
// Console output: [ERROR] Database connection failed { error: {...}, userId: '123', timestamp: '...' }
// Plus: Forward to Sentry/LogSnag if configured
```

**Note**: `logger.info()` and `logger.debug()` remain dev-only

---

## Quiz Timer State Model

### Timer Dependencies (Fixed)

**Current (Broken)**:
```typescript
const finishQuiz = useCallback(async (timeout = false) => {
  // ... logic
}, [
  attemptStartTime,
  onComplete,
  questions.length,
  quizId,
  saveFinishAttempt,
  score,        // ← CAUSES RECREATION
  trackEvent,
]);
```

**Fixed**:
```typescript
const scoreRef = useRef(score);
scoreRef.current = score;  // Keep current without dependency

const finishQuiz = useCallback(async (timeout = false) => {
  const currentScore = scoreRef.current;
  // ... use currentScore instead of score
}, [
  attemptStartTime,
  onComplete,
  questions.length,
  quizId,
  saveFinishAttempt,
  // score REMOVED
  trackEvent,
]);
```

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Security Model                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     │
│  │   Session    │────▶│   Middleware  │────▶│   Route      │     │
│  │   (Cookie)   │     │  (verify JWT) │     │  (protected) │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│         │                    │                                  │
│         ▼                    ▼                                  │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │  getUser()   │     │  CSP Nonce   │                         │
│  │  (verify)    │     │  (generate)  │                         │
│  └──────────────┘     └──────────────┘                         │
│         │                    │                                  │
│         ▼                    ▼                                  │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │ Rate Limit   │     │  Response    │                         │
│  │  (Vercel KV) │     │ (with CSP)   │                         │
│  └──────────────┘     └──────────────┘                         │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │ Input Data   │────▶│ ProfileSchema │────▶│ Database     │     │
│  │ (FormData)   │     │ (validate)   │     │  (safe)      │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│                                                                  │
│  ┌──────────────┐     ┌──────────────┐                         │
│  │ PII Data     │────▶│sessionStorage│────▶│ Temporary    │     │
│  │ (quiz, etc)  │     │ (not persist)│     │  only        │     │
│  └──────────────┘     └──────────────┘     └──────────────┘     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Notes

### No Database Schema Changes Required

All fixes are behavioral or client-side storage changes:
- ✅ Middleware activation (no schema change)
- ✅ Logger fix (no schema change)
- ✅ getSession() → getUser() (no schema change)
- ✅ Rate limiting (Vercel KV, no schema change)
- ✅ Input validation (runtime only)
- ✅ CSP headers (runtime only)
- ✅ Cloudinary env var (config only)
- ✅ localStorage → sessionStorage (client only)
- ✅ Quiz timer fix (client only)
- ✅ noOpLock removal (client only)
- ✅ useToast → sonner (client only)

### Optional Database Enhancements (Future)

For server-side brute-force protection:
```sql
-- Optional: Rate limiting table (if not using Vercel KV)
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Optional: Security audit log
CREATE TABLE security_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Files to Create/Modify

### New Files
- `src/lib/validation/profile.ts` - Zod validation schema
- `src/middleware.ts` - Middleware entry point
- `src/lib/rate-limit.ts` - Rate limiting utilities using Vercel KV (required) or Supabase `rate_limits` table alternative

### Modified Files
- `src/lib/logger.ts` - Remove isDev gate
- `src/lib/supabase.ts` - Remove noOpLock
- `src/lib/cloudinary.ts` - Use env var for cloud name
- `src/actions/profile.ts` - Add Zod validation
- `src/app/api/ai/chat/route.ts` - Add auth + rate limit
- `src/app/api/admin/drizzle-profiles/route.ts` - Use getUser()
- `src/hooks/useQuizAttempt.ts` - Use sessionStorage
- `src/hooks/useQuizPlayerRuntime.ts` - Fix timer dependencies
- `src/hooks/useToast.ts` - Deprecate, migrate to sonner
- `src/app/[locale]/login/page.tsx` - Use sessionStorage
- `src/app/[locale]/signup/page.tsx` - Use sessionStorage
