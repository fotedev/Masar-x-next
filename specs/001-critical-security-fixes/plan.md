# Implementation Plan: Critical Security & Stability Audit Remediation

**Branch**: `001-critical-security-fixes` | **Date**: April 25, 2026 | **Spec**: [/specs/001-critical-security-fixes/spec.md](/specs/001-critical-security-fixes/spec.md)

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

This implementation remediates critical security vulnerabilities and stability issues identified in a comprehensive forensic audit. The fixes address: inactive middleware allowing unauthorized route access, production error logging blackout, authentication bypass via `getSession()`, unprotected AI endpoints, unvalidated profile inputs, CSP misconfiguration, hardcoded Cloudinary credentials, PII in localStorage, quiz timer issues, and brute-force lockout in localStorage. The approach follows defense-in-depth principles with minimal upstream fixes rather than downstream workarounds.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.5.3, React 19.2.4, Next.js 16.2.1  
**Primary Dependencies**: Supabase Auth SSR, Drizzle ORM, Zod, next-intl, sonner, framer-motion  
**Storage**: PostgreSQL (via Supabase), Supabase Edge Functions (Deno)  
**Testing**: Next.js built-in testing (Vitest via Vite for some components)  
**Target Platform**: Vercel Edge/Node.js runtime, modern browsers
**Project Type**: Web application (Next.js App Router with i18n)  
**Performance Goals**: <200ms TTFB, <100KB JS bundles per route, 60fps animations  
**Constraints**: Middleware must run on Edge runtime, Supabase RLS policies as secondary protection, CSP nonce-based for XSS prevention  
**Scale/Scope**: Multi-tenant academic platform, ~1000 active users, bilingual (AR/EN)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**⚠️ CONSTITUTION NOT RATIFIED**: The `.specify/memory/constitution.md` file contains only template placeholders. Proceeding with standard security best practices as governing principles:

1. **Security First**: All authentication must use verified tokens (`getUser()` not `getSession()`)
2. **Fail Secure**: Errors must never be silently discarded in production
3. **Defense in Depth**: Multiple protection layers (middleware + RLS + input validation)
4. **Least Privilege**: Route access strictly gated by role
5. **No Hardcoded Secrets**: All credentials via environment variables
6. **Client-Side Safety**: No PII in client storage (localStorage/sessionStorage)

**Gate Status**: PROCEED WITH CAUTION - Constitution needs ratification for future features.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/[locale]/                    # Next.js App Router with i18n
│   ├── admin-dashboard/             # Admin routes (unprotected - NEEDS FIX)
│   ├── api/                         # API routes (auth issues - NEEDS FIX)
│   ├── login/, signup/              # Auth pages (brute force in localStorage - NEEDS FIX)
│   └── ...
├── components/                      # React components
│   ├── QuizPlayer.tsx               # Quiz timer issue - NEEDS FIX
│   └── ...
├── contexts/AuthContext.tsx         # Auth state (noOpLock bypass - NEEDS FIX)
├── hooks/
│   ├── useToast.ts                  # Manual DOM manipulation - NEEDS FIX
│   ├── useQuizAttempt.ts            # PII in localStorage - NEEDS FIX
│   └── useQuizPlayerRuntime.ts      # Timer reset bug - NEEDS FIX
├── lib/
│   ├── logger.ts                    # isDev gate silencing production - NEEDS FIX
│   ├── supabase.ts                  # noOpLock auth bypass - NEEDS FIX
│   ├── supabase/middleware.ts       # Route protection logic (not activated)
│   ├── cloudinary.ts                # Hardcoded cloudName - NEEDS FIX
│   └── ai-assistant.ts              # Unprotected AI fallback
├── actions/profile.ts               # No input validation - NEEDS FIX
└── proxy.ts                         # Middleware function (needs middleware.ts wrapper)

supabase/functions/                  # Supabase Edge Functions (Deno)
├── _shared/cors.ts
├── upload-avatar/                   # Uses env vars correctly
└── cloudinary-webhook/              # Uses env vars correctly
```

**Structure Decision**: Single Next.js project with Supabase backend. Security fixes span frontend (React hooks/components), middleware (Next.js), API routes (Route Handlers), and Edge Functions.

## Phases

### Phase 0: Research ✅ COMPLETE

**Output**: `research.md` with 12 security vulnerabilities analyzed

| Issue | Location | Severity | Fix Strategy |
|-------|----------|----------|--------------|
| Inactive middleware | Missing `src/middleware.ts` | P0 | Create middleware entry point |
| Production error blackout | `src/lib/logger.ts` | P0 | Remove `isDev` gate |
| Auth bypass via getSession() | API routes (server-side only) | P0 | Replace with `getUser()` |
| Unprotected AI endpoint | `/api/ai/chat` | P1 | Add auth + rate limiting (Vercel KV required) |
| Unvalidated profile input | `src/actions/profile.ts` | P1 | Add Zod validation |
| CSP misconfiguration | Missing headers | P1 | Add nonce-based CSP + `object-src 'none'` |
| Hardcoded Cloudinary creds | `src/lib/cloudinary.ts` | P1 | Move to env var |
| PII in localStorage | Multiple hooks | P1 | Migrate to sessionStorage |
| Quiz timer reset bug | `useQuizPlayerRuntime.ts` | P2 | Fix dependencies |
| noOpLock auth bypass | `src/lib/supabase.ts` | P1 | Remove bypass + verify multi-tab refresh |
| Brute-force in localStorage | Login/signup pages | P1 | Use sessionStorage |
| Academic onboarding in JWT | `OnboardingModal.tsx` | P1 | Migrate to `setUserAcademic()` + profiles table |
| Manual DOM in useToast | `src/hooks/useToast.ts` | P2 | Migrate to sonner |

### Phase 1: Design & Contracts ✅ COMPLETE

**Output**:
- `data-model.md` - ProfileSchema, rate limiting model, storage migration plan
- `contracts/api.md` - AI endpoint contract, admin API, CSP headers, rate limits
- `quickstart.md` - Environment setup, testing checklist, deployment guide
- `.windsurf/rules/specify-rules.md` - Agent context updated with tech stack

**No database schema changes required** - all fixes are behavioral or client-side.

### Cross-Artifact Review Findings (Applied)

| Finding | Status | Fix Applied |
|---------|--------|-------------|
| FR-008 absent from all artifacts | ✅ Fixed | Added Issue 12 to research.md with migration plan |
| FR-003 scope incomplete (cloudinary.ts) | ✅ Fixed | Documented client-side `getSession()` as acceptable |
| In-memory rate limit non-functional on Vercel | ✅ Fixed | Removed fallback; Vercel KV required |
| noOpLock removal may reintroduce SSR bug | ✅ Fixed | Added verification step for multi-tab token refresh |
| CSP missing `object-src 'none'` | ✅ Fixed | Added to both data-model.md and contracts/api.md |
| Academic cache storage inconsistency | ✅ Fixed | Unified: sessionStorage + remove PII fields |
| Redundant `javascript:` check in ProfileSchema | ✅ Fixed | Removed; URL protocol check already covers it |
| 10 missing edge cases | ✅ Fixed | Added EC-1 through EC-10 to research.md |
| FR-009 spec says "component state" but code uses localStorage | ⚠️ Noted | Spec inaccuracy documented; code is the source of truth |

### Phase 2: Task Generation (NOT STARTED)

**Next Step**: Run `/speckit.tasks` to generate `tasks.md`

---

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | Project constitution is template only | Ratification required for governance |

**Note**: Proceeding with security fixes as emergency remediation. Constitution should be ratified post-fix to establish ongoing governance.

## Extension Hooks

No extension hooks registered (`.specify/extensions.yml` not found).
