# Implementation Plan: Fix Production Errors

**Branch**: `002-fix-production-errors` | **Date**: 2026-04-28 | **Spec**: `/specs/002-fix-production-errors/spec.md`

## Summary

This plan addresses four critical production issues identified on the Masar X platform:
1. **Auth Sync 500 Error**: Caused by database connectivity issues (IPv4 vs IPv6) and lack of retry guards.
2. **CSP eval Blocking**: Strict Content Security Policy blocking legitimate script evaluation in production.
3. **Service Worker Fetch Noise**: Excessive console logging for routine fetch failures.
4. **Form Accessibility**: Missing `id`, `name`, and label associations.

Technical approach involves switching to the Supabase Session Pooler (IPv4 compatible), implementing exponential backoff and concurrency guards in the Auth context, refining CSP in middleware, and silencing routine SW fetch failures.

## Technical Context

- **Language/Version**: TypeScript / Next.js 14+ (App Router)
- **Primary Dependencies**: `@supabase/supabase-js`, `drizzle-orm`, `pg`
- **Storage**: Supabase PostgreSQL (via Node-Postgres and Drizzle)
- **Target Platform**: Vercel (Production)
- **Performance Goals**: Stabilize authentication sync to < 1s latency, zero server errors.
- **Constraints**: Vercel environment is IPv4-only; Supabase direct connection is IPv6-only.

## Project Structure

### Documentation (this feature)

```text
specs/002-fix-production-errors/
├── plan.md              # This file
├── checklists/
│   └── requirements.md  # Quality validation checklist
└── tasks.md             # Implementation tasks (to be generated)
```

### Source Code (affected paths)

```text
src/
├── actions/
│   └── auth.ts          # Server Action for profile sync
├── app/
│   └── api/
│       └── auth/
│           └── sync/
│               └── route.ts # API Route for sync trigger
├── contexts/
│   └── AuthContext.tsx  # Client-side auth state management
├── lib/
│   └── admin-db/
│       └── db.ts        # Database connection logic
└── middleware.ts        # CSP and security headers
public/
└── sw.js                # Service Worker logic
```

## Implementation Strategy

### Phase 1: Authentication & Database Stability
- Modify `src/lib/admin-db/db.ts` to explicitly warn about IPv4/IPv6 mismatches and encourage using `DATABASE_URL_IPV4`.
- Update `src/actions/auth.ts` to provide detailed server-side error logging while returning safe messages to the client.
- Update `src/app/api/auth/sync/route.ts` to log synchronization failures in the server console.
- Enhance `src/contexts/AuthContext.tsx` with a `useRef` guard to prevent concurrent sync calls and implement a limited retry mechanism.

### Phase 2: Security & Service Worker Refinement
- Update `src/middleware.ts` to ensure `process.env.NODE_ENV` check is robust at the edge and allow `unsafe-eval` if necessary (after auditing).
- Patch `public/sw.js` to suppress `console.warn` for routine fetch failures (like `AbortError` or expected offline navigations).

### Phase 3: Accessibility Improvements
- Audit and update form components to ensure every input has an associated label via `htmlFor` and `id`, and a meaningful `name` attribute.

## Verification Plan

### Automated Checks
- Run `pnpm build` to ensure no regressions in production builds.
- Verify environment variable requirements in `.env.example`.

### Manual Verification (Local & Vercel)
- Sign in/out repeatedly to verify auth sync stability and zero console errors.
- Inspect `Content-Security-Policy` header in browser network tab.
- Use Chrome DevTools Lighthouse to audit accessibility scores.
- Simulate offline mode in DevTools to verify Service Worker behavior.
