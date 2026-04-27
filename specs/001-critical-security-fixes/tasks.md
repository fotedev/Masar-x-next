# Tasks: Critical Security & Stability Audit Remediation

**Input**: Design documents from `/specs/001-critical-security-fixes/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Not explicitly requested — test tasks omitted. Manual verification per quickstart.md.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Environment configuration and branch setup

- [ ] T001 Create feature branch `001-critical-security-fixes` from main
- [ ] T002 Add `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` to `.env.local` and verify Vercel env vars per quickstart.md
- [ ] T003 [P] Verify Vercel KV is provisioned for rate limiting (or confirm Supabase `rate_limits` table alternative)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T004 Create `src/middleware.ts` that re-exports `proxy` from `src/proxy.ts` as default export per plan.md Issue 1
- [ ] T005 [P] Create `src/lib/validation/profile.ts` with Zod `ProfileSchema` per data-model.md (fullName, username, website, avatarUrl validation rules)
- [ ] T006 [P] Create `src/lib/rate-limit.ts` with sliding window rate limiting utility using Vercel KV (or Supabase fallback) per data-model.md Rate Limiting Model

**Checkpoint**: Foundation ready — middleware active, validation schema available, rate limit utility available

---

## Phase 3: User Story 1 - Secure Route Protection (Priority: P1) 🎯 MVP

**Goal**: Admin dashboard routes are properly protected; only authorized users can access administrative functions

**Independent Test**: Navigate directly to `/admin-dashboard` without authentication → redirected to login. After authenticating as admin → access granted.

### Implementation for User Story 1

- [ ] T007 [US1] Verify middleware route protection logic in `src/lib/supabase/middleware.ts` covers admin/non-academic/protected route patterns per contracts/api.md Route Protection table
- [ ] T008 [US1] Add nonce-based CSP header generation to `src/middleware.ts` per data-model.md CSP Nonce Model (generate nonce, set `Content-Security-Policy` and `x-nonce` headers)
- [ ] T009 [US1] Add security headers to `src/middleware.ts` per contracts/api.md Security Headers Summary (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`)
- [ ] T010 [US1] Add middleware error handling per research.md EC-8: on middleware error, pass through to page and log the error (don't block request)
- [ ] T011 [US1] Verify `next-intl` inline scripts work with CSP nonces per research.md EC-2 (test locale switching after CSP enabled)
- [ ] T011a [US1] Add CSP nonce propagation to React components — read `x-nonce` from `headers()` in server components and pass to inline `<script>` tags; audit all components for inline scripts that need nonce attribute per FR-006
- [ ] T012 [US1] Test all locale routes manually after middleware activation per research.md Risk "Middleware changes break i18n"

**Checkpoint**: Admin routes protected, CSP headers active, i18n still works

---

## Phase 4: User Story 2 - Production Error Observability (Priority: P1)

**Goal**: Production errors are logged and reported so administrators can detect and respond to issues promptly

**Independent Test**: Trigger an error in production environment → error appears in monitoring dashboard within seconds, not silently discarded.

### Implementation for User Story 2

- [ ] T013 [US2] Remove `isDev` gate from `logger.error()` in `src/lib/logger.ts` — errors must always be captured per research.md Issue 2
- [ ] T014 [US2] Remove `isDev` gate from `logger.warn()` in `src/lib/logger.ts` — warnings must always be captured per research.md Issue 2
- [ ] T015 [US2] Keep `isDev` gate on `logger.info()` and `logger.debug()` in `src/lib/logger.ts` — these remain dev-only per data-model.md Logger Output
- [ ] T016 [US2] Add Sentry/monitoring integration to `logger.error()` for production forwarding per contracts/api.md Logger Methods table

**Checkpoint**: Production errors and warnings are visible; info/debug remain dev-only

---

## Phase 5: User Story 3 - Secure Authentication Flow (Priority: P1)

**Goal**: Authentication is secure; accounts cannot be accessed using forged credentials

**Independent Test**: Attempt to access protected API endpoints with a forged/malformed JWT token → system rejects with 401.

### Implementation for User Story 3

- [ ] T017 [US3] Replace `getSession()` with `getUser()` in `src/app/api/admin/drizzle-profiles/route.ts` per research.md Issue 3 and data-model.md Session Verification
- [ ] T018 [US3] Audit all API routes under `src/app/api/` for server-side `getSession()` usage and replace with `getUser()` per research.md "Full audit recommended"
- [ ] T019 [US3] Remove `noOpLock` configuration from `src/lib/supabase.ts` per research.md Issue 10 — delete the `noOpLock` function and remove it from from `createBrowserClient` auth config
- [ ] T020 [US3] Verify multi-tab token refresh works after noOpLock removal per research.md EC-4 and Decision Log "Verify multi-tab token refresh"

**Checkpoint**: All API routes use verified auth; noOpLock removed; multi-tab refresh confirmed

---

## Phase 6: User Story 4 - Protected AI Endpoint (Priority: P2)

**Goal**: AI chat endpoint is rate-limited and authenticated so costs are controlled and abuse is prevented

**Independent Test**: Call `/api/ai/chat` without auth → 401. Exceed 10 req/min → 429. Within limit → 200.

### Implementation for User Story 4

- [ ] T021 [US4] Add `getUser()` authentication check to `src/app/api/ai/chat/route.ts` — return 401 if unauthenticated per contracts/api.md AI Chat Endpoint
- [ ] T022 [US4] Add rate limiting to `src/app/api/ai/chat/route.ts` using `src/lib/rate-limit.ts` utility (10 req/min per user, sliding window) per data-model.md AI Chat Rate Limit
- [ ] T023 [US4] Add prompt validation to `src/app/api/ai/chat/route.ts` — max 10000 chars, required field per contracts/api.md AIChatRequest
- [ ] T024 [US4] Return proper error responses (401, 429 with `retryAfter`, 400) per contracts/api.md AI Chat Endpoint error contracts

**Checkpoint**: AI endpoint requires auth, enforces rate limits, validates input

---

## Phase 7: User Story 5 - Safe Input Validation (Priority: P2)

**Goal**: Profile data is validated so malicious input cannot compromise accounts or the platform

**Independent Test**: Submit profile update with `javascript:alert(1)` in avatarUrl → rejected. Valid data → success.

### Implementation for User Story 5

- [ ] T025 [US5] Integrate `ProfileSchema` validation into `src/actions/profile.ts` — validate FormData fields before database write per data-model.md ProfileSchema
- [ ] T026 [US5] Return structured validation errors from `src/actions/profile.ts` per contracts/api.md Profile Update Action error response format
- [ ] T027 [US5] Audit all profile form fields (check for `bio` and other fields not in initial schema) per research.md EC-10 — add to ProfileSchema if present
- [ ] T028 [US5] Move hardcoded `cloudName` from `src/lib/cloudinary.ts` to `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` env var per research.md Issue 7

**Checkpoint**: Profile updates validated; XSS payloads rejected; Cloudinary env-var configured

---

## Phase 8: Client-Side Security & Data Privacy (Priority: P2)

**Goal**: PII is removed from persistent client storage; brute-force lockout is not client-bypassable; onboarding data is in profiles table not JWT

**Independent Test**: Inspect localStorage after quiz attempt — no PII keys present. Clear sessionStorage → lockout counter resets. OnboardingModal writes to profiles table, not JWT metadata.

### Implementation

- [ ] T029 [P] Migrate `quiz_attempt_*` and `quiz_history` keys from localStorage to sessionStorage in `src/hooks/useQuizAttempt.ts` per data-model.md Storage Model Changes
- [ ] T030 [P] Migrate `USER_ACADEMIC_CACHE_KEY` from localStorage to sessionStorage + remove PII fields (userId) in `src/lib/academic-utils.ts` per data-model.md Storage Model Changes
- [ ] T031 [P] Migrate `login_attempts` from localStorage to sessionStorage in `src/app/[locale]/login/page.tsx` per data-model.md Storage Model Changes and research.md Issue 11
- [ ] T032 [P] Migrate `signup_attempts` from localStorage to sessionStorage in `src/app/[locale]/signup/page.tsx` per data-model.md Storage Model Changes
- [ ] T033 Migrate `useUserAcademic` rate limiting from localStorage to sessionStorage in `src/lib/academic-utils.ts` per research.md EC-4
- [ ] T034 Add localStorage cleanup on app load for old keys (`quiz_attempt_*`, `quiz_history`, `USER_ACADEMIC_CACHE_KEY`, `login_attempts`, `signup_attempts`) per research.md EC-9
- [ ] T035 Update `src/components/OnboardingModal.tsx` to use `useUserAcademic().setUserAcademic()` instead of `supabase.auth.updateUser()` for academic data writes per research.md Issue 12
- [ ] T036 Update `src/components/OnboardingModal.tsx` read path to use `useUserAcademic()` instead of `user.user_metadata?.academic_level` per research.md Issue 12
- [ ] T037 Create one-time migration script to copy `user_metadata.academic_level` and `user_metadata.department` to `profiles` table for existing users per research.md Issue 12 Migration Steps

**Checkpoint**: No PII in localStorage; brute-force uses sessionStorage; onboarding writes to profiles table

---

## Phase 9: Stability & Maintenance Fixes (Priority: P2-P3)

**Goal**: Quiz timer works correctly; toast system uses proper React patterns

**Independent Test**: Complete a quiz — timer does not reset when answering questions. Trigger toast notification — rendered via sonner, not manual DOM.

### Implementation

- [ ] T038 Fix quiz timer reset bug in `src/hooks/useQuizPlayerRuntime.ts` — remove `score` from `finishQuiz` dependency array, use `useRef(score)` pattern per data-model.md Quiz Timer State Model
- [ ] T039a Add sonner `<Toaster />` component to `src/app/[locale]/layout.tsx` (required for `toast()` to render) per FR-010
- [ ] T039 Migrate `src/hooks/useToast.ts` to sonner library per research.md Issue 13 — replace manual DOM manipulation with `toast()` from sonner
- [ ] T040 Update all `useToast` consumers to use sonner's `toast()` API instead of custom hook

**Checkpoint**: Quiz timer stable; toast system uses sonner

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final verification, documentation, and deployment readiness

- [ ] T041 Run `pnpm run typecheck` and fix any type errors introduced by security fixes
- [ ] T042 Run `pnpm run build` and verify production build succeeds
- [ ] T043 Execute manual test checklist from quickstart.md Testing Security Fixes section (middleware, logger, AI endpoint, profile validation)
- [ ] T044 Verify CSP headers in production build response using `curl -I` per quickstart.md Post-deploy Verification
- [ ] T045 [P] Update `.env.example` or environment documentation with new required variables (`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, KV vars)
- [ ] T046 Run `src/scripts/auth-route-check.mjs` to verify all API routes use `getUser()` not `getSession()`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 (middleware entry point)
- **US2 (Phase 4)**: Depends on Phase 2 (independent of US1)
- **US3 (Phase 5)**: Depends on Phase 2 (independent of US1, US2)
- **US4 (Phase 6)**: Depends on Phase 2 + Phase 5 (rate limit uses `getUser()` pattern from US3)
- **US5 (Phase 7)**: Depends on Phase 2 (ProfileSchema from T005)
- **Client-Side (Phase 8)**: Depends on Phase 2 (independent of US1-US5)
- **Stability (Phase 9)**: Depends on Phase 2 (independent of US1-US5)
- **Polish (Phase 10)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US3 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **US4 (P2)**: Depends on US3 (needs `getUser()` auth pattern established)
- **US5 (P2)**: Can start after Phase 2 — No dependencies on other stories

### Within Each User Story

- Core implementation before integration
- Story complete before moving to next priority
- Commit after each task or logical group

### Parallel Opportunities

- T005 and T006 can run in parallel (different files)
- T013, T014, T015 can be done together (same file, sequential edits)
- T029, T030, T031, T032 can run in parallel (different files)
- US1, US2, US3 can be worked on in parallel after Phase 2
- Phase 8 and Phase 9 can run in parallel after Phase 2

---

## Parallel Example: Phase 2 (Foundational)

```bash
# Launch these together (different files):
Task T004: "Create src/middleware.ts"
Task T005: "Create src/lib/validation/profile.ts"
Task T006: "Create src/lib/rate-limit.ts"
```

## Parallel Example: Phase 8 (Client-Side Security)

```bash
# Launch these together (different files):
Task T029: "Migrate useQuizAttempt.ts to sessionStorage"
Task T030: "Migrate academic-utils.ts to sessionStorage"
Task T031: "Migrate login/page.tsx to sessionStorage"
Task T032: "Migrate signup/page.tsx to sessionStorage"
```

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — Secure Route Protection
4. Complete Phase 4: US2 — Production Error Observability
5. Complete Phase 5: US3 — Secure Authentication Flow
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy if ready — P0 vulnerabilities are remediated

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. Add US1 + US2 + US3 → Test independently → Deploy (MVP — P0 fixes live!)
3. Add US4 + US5 → Test independently → Deploy (P2 endpoint/input protection)
4. Add Phase 8 + Phase 9 → Test independently → Deploy (client-side + stability)
5. Polish → Final deployment

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: US1 (middleware + CSP)
   - Developer B: US2 (logger) + US3 (auth)
   - Developer C: Phase 8 (sessionStorage migration)
3. After US3 complete:
   - Developer B: US4 (AI endpoint protection)
   - Developer A: US5 (input validation)
4. Phase 9 + Polish as final pass

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Client-side `getSession()` in `cloudinary.ts` is ACCEPTABLE — do not change per research.md EC-5
- CSP `data:` in `img-src` is accepted with documented risk per data-model.md
- sessionStorage is per-tab: independent quiz sessions across tabs is intentional per research.md EC-3
