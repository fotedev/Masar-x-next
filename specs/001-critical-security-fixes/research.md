# Research: Critical Security & Stability Fixes

**Feature**: Critical Security & Stability Audit Remediation  
**Date**: April 25, 2026  
**Branch**: `001-critical-security-fixes`

---

## Security Vulnerability Analysis

### Issue 1: Inactive Middleware (Route Protection Bypass)

**Location**: `src/proxy.ts` exists but no `src/middleware.ts`  
**Severity**: P0 - Deploy Blocking  
**Risk**: Admin routes accessible without authentication

**Current State**:
- `src/proxy.ts` exports a `proxy()` function combining `updateSession()` + `next-intl` middleware
- `src/lib/supabase/middleware.ts` has route protection logic for admin/non-academic/protected routes
- No `src/middleware.ts` file means Next.js doesn't execute any middleware

**Root Cause**: Missing middleware entry point

**Decision**: Create `src/middleware.ts` that re-exports `proxy` as default export

**Rationale**: Next.js 16 requires `src/middleware.ts` (or `middleware.ts` in root) with default export

---

### Issue 2: Production Error Logging Blackout

**Location**: `src/lib/logger.ts` lines 31-47  
**Severity**: P0 - Operational Blindness  
**Risk**: Production errors silently discarded

**Current State**:
```typescript
export const logger = {
  error: (message: string, error?: unknown, context?: Record<string, unknown>) => {
    if (isDev) {  // ← BUG: Only logs in development
      console.error(`[ERROR] ${message}`, ...);
    }
    // Production: errors are silently lost!
  },
  // Same pattern for warn, info, debug
};
```

**Root Cause**: `if (isDev)` gate prevents all production logging

**Decision**: Remove `isDev` gate from `error()` and `warn()`, keep for `info()` and `debug()`

**Rationale**:
- Errors and warnings must always be captured (operational requirement)
- Info/debug can remain dev-only to reduce noise
- Add Sentry/LogSnag integration for production monitoring

---

### Issue 3: Authentication Bypass via `getSession()`

**Location**: `src/app/api/admin/drizzle-profiles/route.ts` line 15  
**Severity**: P0 - Security Vulnerability  
**Risk**: Unverified JWT tokens allow unauthorized API access

**Current State**:
```typescript
const { data: { session } } = await supabase.auth.getSession();  // ← UNSAFE
if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**Root Cause**: `getSession()` reads cookies without server-side verification

**Decision**: Replace all `getSession()` with `getUser()` in API routes

**Rationale**:
- `getUser()` verifies the JWT with Supabase Auth server
- `getSession()` only decodes the cookie (client-side equivalent)
- See Supabase SSR docs: "Always use getUser() in server contexts"

**Files to Fix**:
- `src/app/api/admin/drizzle-profiles/route.ts` — Server-side, must use `getUser()`

**Client-side `getSession()` usage (ACCEPTABLE)**:
- `src/lib/cloudinary.ts:61` — Client-side, reads session for access token; supports optional guest uploads. `getSession()` is correct here because:
  1. It runs in the browser (not server context)
  2. Guest uploads need to work without authentication
  3. The token is used as-is for Edge Function authorization
- `src/lib/cloudinary.ts:192` — Client-side `getSession()` for delete operation; same rationale
- `src/contexts/AuthContext.tsx:54` — Client-side auth initialization; `getSession()` is correct for client-side state hydration

**Server-side `getSession()` (MUST FIX)**:
- Only `src/app/api/admin/drizzle-profiles/route.ts` found so far
- Full audit of all API routes under `src/app/api/` recommended during implementation

---

### Issue 4: Unprotected AI Endpoint

**Location**: `src/app/api/ai/chat/route.ts`  
**Severity**: P1 - Cost/Abuse Risk  
**Risk**: Unlimited AI calls by unauthenticated users

**Current State**:
- `/api/ai/chat` accepts requests without authentication
- No rate limiting implemented
- Used as fallback when Puter.js is unavailable

**Root Cause**: Missing auth + rate limit middleware

**Decision**: Add authentication check + rate limiting (10 req/min per user)

**Rationale**:
- AI calls have cost implications
- Abuse could exhaust API quotas
- Use Vercel KV or Upstash for rate limiting

---

### Issue 5: Unvalidated Profile Input

**Location**: `src/actions/profile.ts` lines 20-23  
**Severity**: P1 - XSS/Data Integrity Risk  
**Risk**: XSS payloads, `javascript:` URIs stored in database

**Current State**:
```typescript
const fullName = formData.get('fullName') as string;  // ← Raw input
const username = formData.get('username') as string;
const website = formData.get('website') as string;  // ← No URL validation
const avatarUrl = formData.get('avatarUrl') as string;  // ← No scheme validation
```

**Root Cause**: No input validation before database write

**Decision**: Implement Zod `ProfileSchema` validation

**Rationale**:
- Zod already in dependencies
- Prevent XSS via `javascript:` URIs in avatarUrl
- Validate website is valid URL
- Sanitize string lengths

---

### Issue 6: CSP Misconfiguration

**Location**: Not explicitly found (may need to add)  
**Severity**: P1 - XSS Risk  
**Risk**: `'unsafe-inline'` and `'unsafe-eval'` allow script injection

**Current State**: No CSP headers found in codebase (search returned no results)

**Root Cause**: CSP headers not implemented

**Decision**: Add nonce-based CSP headers via middleware

**Rationale**:
- Nonce-based CSP allows inline scripts with cryptographic verification
- Remove `'unsafe-inline'` and `'unsafe-eval'` directives
- Required for PCI compliance and security best practices

---

### Issue 7: Hardcoded Cloudinary Credentials

**Location**: `src/lib/cloudinary.ts` line 219  
**Severity**: P1 - Secret Exposure  
**Risk**: Cloud name `de3emq8l3` hardcoded in source

**Current State**:
```typescript
const cloudName = 'de3emq8l3';  // ← HARDCODED
const baseUrl = `https://res.cloudinary.com/${cloudName}/image/upload`;
```

**Root Cause**: Convenience coding vs. security practice

**Decision**: Move to `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` env var

**Rationale**:
- Cloud name isn't highly sensitive but should be configurable
- Edge functions already use env vars correctly
- Consistency with security best practices

---

### Issue 8: PII in localStorage

**Location**: `src/hooks/useQuizAttempt.ts`, `src/lib/academic-utils.ts`  
**Severity**: P1 - Privacy Risk  
**Risk**: User quiz data, academic info persisted in client storage

**Current State**:
```typescript
// useQuizAttempt.ts
localStorage.setItem(`quiz_attempt_${quizId}_${userId}`, JSON.stringify(next));
localStorage.setItem('quiz_history', JSON.stringify([historyEntry, ...]));

// academic-utils.ts
localStorage.getItem(USER_ACADEMIC_CACHE_KEY);  // Contains userId
```

**Root Cause**: Using localStorage for user-specific data persistence

**Decision**: Move PII to sessionStorage (cleared on tab close), keep only public data in localStorage

**Rationale**:
- localStorage persists indefinitely (privacy risk)
- sessionStorage is cleared when tab closes
- Quiz attempt data is temporary by nature
- Public data (subjects, lectures) can remain in localStorage

---

### Issue 9: Quiz Timer Reset on Score Change

**Location**: `src/hooks/useQuizPlayerRuntime.ts` line 99  
**Severity**: P2 - UX Bug  
**Risk**: Timer resets when user answers questions

**Current State**:
```typescript
const finishQuiz = useCallback(async (timeout = false) => {
  // ...
}, [
  attemptStartTime,
  onComplete,
  questions.length,
  quizId,
  saveFinishAttempt,
  score,        // ← Causes re-creation when score changes
  trackEvent,
]);
```

**Root Cause**: `score` in dependency array causes `finishQuiz` to recreate, triggering effects

**Decision**: Remove `score` from dependency array, use functional updates

**Rationale**:
- `score` is only used at completion time
- Use ref or callback pattern to avoid dependency

---

### Issue 10: noOpLock Auth Bypass

**Location**: `src/lib/supabase.ts` lines 10-26  
**Severity**: P1 - Security Risk  
**Risk**: Token refresh race conditions, stale sessions

**Current State**:
```typescript
const noOpLock = async <T>(_name: string, _acquireTimeout: number, fn: () => Promise<T>): Promise<T> => {
  return await fn();  // ← No actual locking
};

export const supabase = createBrowserClient(..., {
  auth: {
    lock: typeof window === 'undefined' ? undefined : noOpLock,  // ← Disables protection
  },
});
```

**Root Cause**: `noOpLock` bypasses auth lock mechanism

**Decision**: Remove `noOpLock` configuration, let Supabase use default locking

**Rationale**:
- Auth locks prevent concurrent token refresh
- `noOpLock` was likely workaround for SSR issues
- Supabase SSR package has better handling now

---

### Issue 11: Brute-Force Lockout in localStorage

**Location**: `src/app/[locale]/login/page.tsx`, `src/app/[locale]/signup/page.tsx`  
**Severity**: P1 - Security Risk  
**Risk**: Client-side lockout easily bypassed by clearing localStorage

**Current State**:
```typescript
const stored = localStorage.getItem("login_attempts");  // ← Client-controlled
localStorage.setItem("login_attempts", JSON.stringify({ count, timestamp }));
```

**Root Cause**: Security logic on client side

**Decision**: Move lockout counter to sessionStorage (ephemeral) + server-side tracking

**Rationale**:
- localStorage is persistent and user-controlled
- sessionStorage is cleared on tab close (better UX for legitimate users)
- Server-side tracking prevents bypass entirely

---

### Issue 12: Academic Onboarding Data in JWT Metadata (FR-008)

**Location**: `src/components/OnboardingModal.tsx` lines 70-75  
**Severity**: P1 - Data Integrity / Token Bloat  
**Risk**: Academic data stored in JWT `user_metadata`, bloating tokens and creating stale-data problem

**Current State**:
```typescript
// OnboardingModal.tsx - writes to JWT metadata
const { error } = await supabase.auth.updateUser({
  data: {
    academic_level: formData.academic_level,  // ← JWT payload
    department: formData.department,            // ← JWT payload
  },
});

// OnboardingModal.tsx line 32 - reads from JWT metadata
const academicLevel = user.user_metadata?.academic_level;  // ← Stale source
const department = user.user_metadata?.department;          // ← Stale source
```

**Contrast with newer code**:
```typescript
// useUserAcademic.ts line 177 - writes to profiles table (correct)
const { error } = await supabase.from('profiles').upsert(
  { id: user.id, level: next.level, semester: next.semester, department_id: next.department_id },
  { onConflict: 'id' }
);

// onboarding/academic/page.tsx - uses setUserAcademic() (correct)
const result = await setUserAcademic({ level, semester, department_id });
```

**Root Cause**: Old `OnboardingModal.tsx` uses deprecated JWT write path; newer `onboarding/academic/page.tsx` already uses profiles table

**Decision**: Migrate `OnboardingModal.tsx` to use `setUserAcademic()` hook, deprecate JWT metadata writes

**Rationale**:
- JWT metadata bloats the auth token (sent with every request)
- Data in JWT can become stale (not refreshed until token renewal)
- Profiles table is the authoritative source (already used by `useUserAcademic`)
- Need migration strategy for existing users with data only in JWT

**Migration Steps**:
1. Update `OnboardingModal.tsx` to use `useUserAcademic().setUserAcademic()` instead of `supabase.auth.updateUser()`
2. Update read path: read from `useUserAcademic()` instead of `user.user_metadata`
3. Create one-time migration: copy `user_metadata.academic_level` and `user_metadata.department` to `profiles` table for existing users
4. After migration, remove academic fields from `user_metadata` via Supabase admin API

---

### Issue 13: Manual DOM Manipulation in useToast

**Location**: `src/hooks/useToast.ts`  
**Severity**: P2 - Maintenance/React Anti-pattern  
**Risk**: Hydration mismatches, memory leaks

**Current State**: Direct `document.createElement`, `document.body.appendChild`

**Decision**: Migrate to `sonner` library (already in dependencies)

**Rationale**:
- `sonner` already in package.json
- Proper React integration
- No manual DOM manipulation

---

## Technology Choices

| Decision | Selected | Rationale |
|----------|----------|-----------|
| Rate Limiting | Vercel KV (required) | In-memory fallback non-functional on Vercel (stateless/ephemeral). Use Vercel KV exclusively, or Supabase `rate_limits` table as alternative |
| Input Validation | Zod | Already in project, type-safe |
| Toast Library | sonner | Already in dependencies |
| CSP Strategy | Nonce-based | Next.js 16 built-in support |
| Middleware | Edge Runtime | Next.js default, fast cold start |

---

## Research Tasks Completed

1. ✅ Middleware activation path analyzed
2. ✅ Logger implementation reviewed
3. ✅ API route auth patterns identified (client vs server getSession() clarified)
4. ✅ AI endpoint exposure confirmed
5. ✅ Profile action validation gap found
6. ✅ CSP headers not currently set
7. ✅ Hardcoded credentials located
8. ✅ localStorage PII usage mapped
9. ✅ Quiz timer dependency issue identified
10. ✅ noOpLock bypass confirmed (verification step added for multi-tab token refresh)
11. ✅ Brute-force client-side logic located
12. ✅ OnboardingModal JWT metadata writes (FR-008) documented with migration plan
13. ✅ useToast anti-pattern documented

---

## Unknowns Resolved

- **Rate limiting**: Use Vercel KV exclusively (in-memory fallback removed — non-functional on Vercel's stateless runtime). Supabase `rate_limits` table as alternative if KV unavailable
- **CSP headers**: Will add via Next.js middleware with nonce generation
- **Profile schema**: Create new Zod schema for validation
- **AI endpoint protection**: Vercel KV rate limiting required (no in-memory fallback)
- **noOpLock removal**: Must verify multi-tab token refresh works after removal — add explicit test step
- **FR-008 migration**: OnboardingModal.tsx must use setUserAcademic() + one-time JWT→profiles data migration

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Middleware changes break i18n | High | Test all locale routes manually |
| getUser() adds latency vs getSession() | Low | Accept for security; consider caching |
| Rate limiting false positives | Medium | 10 req/min generous; IP-based fallback |
| CSP breaks inline scripts | High | Audit all inline scripts, add nonces |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-25 | Create middleware.ts | Required for Next.js to execute middleware |
| 2026-04-25 | Remove isDev from error/warn | Production errors must be visible |
| 2026-04-25 | Use getUser() not getSession() | Server-side JWT verification required |
| 2026-04-25 | Add Zod validation | Type-safe input validation |
| 2026-04-25 | Migrate to sonner | Proper React patterns, already in deps |
| 2026-04-25 | sessionStorage for PII | Privacy improvement, cleared on close |
| 2026-04-25 | Remove noOpLock | Restore auth token refresh protection |
| 2026-04-25 | Verify multi-tab token refresh | Must test noOpLock removal doesn't reintroduce SSR race condition |
| 2026-04-25 | Migrate OnboardingModal to setUserAcademic() | FR-008: Move academic data from JWT to profiles table |

---

## Edge Cases Discovered During Review

### EC-1: OnboardingModal Read/Write Migration Path
After moving onboarding writes from JWT to profiles table, `OnboardingModal.tsx:32` still reads from `user.user_metadata?.academic_level`. Both read AND write paths need updating. Existing users with data only in JWT need a one-time migration to copy `user_metadata.academic_level` and `user_metadata.department` to the `profiles` table.

### EC-2: CSP + next-intl Inline Scripts
`next-intl` may inject inline `<script>` tags for locale configuration. The CSP policy must account for this — nonce must be available to next-intl's script injection, or it could break i18n on first load. Verify during implementation that locale switching works with CSP enabled.

### EC-3: Multi-Tab Quiz Attempts with sessionStorage
sessionStorage is per-tab. If a user opens the same quiz in two tabs, they'll have independent attempt states. This changes existing behavior (localStorage was shared across tabs). **Intentional change** — document as design decision. Each tab = independent quiz session.

### EC-4: useUserAcademic Rate Limiting in localStorage
`useUserAcademic.ts:159-168` uses localStorage for rate limiting profile updates — same client-side bypass pattern as FR-009 but not mentioned in spec. Should be migrated to sessionStorage alongside FR-009.

### EC-5: Cloudinary Guest Uploads + getSession()
`cloudinary.ts:61` uses `getSession()` with explicit comment "make it optional for guest uploads." If `getSession()` → `getUser()` is applied here, guest uploads break. **Decision**: Keep `getSession()` on client-side (acceptable per Issue 3 analysis).

### EC-6: CSP Missing `object-src 'none'`
Both data-model.md and contracts/api.md omit `object-src 'none'`, which is recommended to prevent plugin execution (Flash, Java applets). Must add.

### EC-7: `data:` in `img-src` CSP
Both artifacts allow `data:` URIs in `img-src`. While common for base64 images, `data:` URIs can be used for phishing. Consider restricting to `blob:` only, or keep `data:` with documented risk acceptance.

### EC-8: Middleware Error Handling
Spec edge cases mention "middleware throws an error during session update" but no artifact defines the error handling strategy. **Decision**: On middleware error, pass through to the page (don't block the request) and log the error. Better to show the page than to lock users out due to a transient auth service error.

### EC-9: Existing localStorage Data Migration
When moving from localStorage to sessionStorage, existing data in localStorage isn't cleaned up. Users will have stale data in localStorage that's never read again but persists indefinitely. **Decision**: Add cleanup step on app load — check for old localStorage keys and remove them.

### EC-10: ProfileSchema Missing Fields
The schema only validates `fullName, username, website, avatarUrl`. The actual profile form may have additional fields (e.g., `bio`) that remain unvalidated. **Decision**: Add `bio` field to schema if present in the form. Audit all profile form fields during implementation.
