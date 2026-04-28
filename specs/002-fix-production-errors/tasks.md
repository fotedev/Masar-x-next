# Tasks: Fix Production Errors

**Input**: Design documents from `/specs/002-fix-production-errors/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Phase 1: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure and diagnostic tools

- [ ] T001 [P] Implement DB health check route in `src/app/api/health/db/route.ts` to verify `DATABASE_URL_IPV4` connectivity.
- [ ] T002 Update `src/lib/admin-db/db.ts` to include explicit production warnings for IPv6 direct connections and handle pool errors gracefully.
- [ ] T003 [P] Add detailed server-side error logging in `src/actions/auth.ts` while returning sanitized error messages.
- [ ] T004 [P] Update `src/app/api/auth/sync/route.ts` to log synchronization failures and return 500 status with error details in development.

**Checkpoint**: Foundation ready - diagnostic tools in place to verify DB connectivity.

---

## Phase 2: User Story 1 - Stable Authentication Sync (Priority: P1) 🎯 MVP

**Goal**: Prevent concurrent sync calls and implement robust sync retry logic.

**Independent Test**: Monitor network logs during sign-in to ensure exactly one `/api/auth/sync` call occurs.

### Implementation for User Story 1

- [ ] T005 [US1] Add `syncInProgress` `useRef` guard to `AuthProvider` in `src/contexts/AuthContext.tsx`.
- [ ] T006 [US1] Implement `triggerSync` function with in-flight check in `AuthContext.tsx`.
- [ ] T007 [US1] Update `onAuthStateChange` to only trigger sync on `SIGNED_IN` event.
- [ ] T008 [US1] Update `initializeAuth` to use `triggerSync` on initial session mount.

**Checkpoint**: User Story 1 functional - Auth sync loop prevented.

---

## Phase 3: User Story 2 - Secure and Functional JavaScript (Priority: P1)

**Goal**: Fix CSP evaluation errors in production while maintaining security.

**Independent Test**: Verify zero CSP errors in the production browser console.

### Implementation for User Story 2

- [ ] T009 [US2] Update `getCspHeader` in `src/middleware.ts` to use a more robust `isDev` check compatible with Edge Runtime.
- [ ] T010 [US2] Audit production bundle for `eval()` usage and update `script-src` in `middleware.ts` to conditionally allow `unsafe-eval` if required by trusted dependencies.

**Checkpoint**: User Story 2 functional - CSP blocking resolved.

---

## Phase 4: User Story 4 - Resilient Service Worker (Priority: P3)

**Goal**: Silence routine fetch failures in the Service Worker console.

**Independent Test**: Verify console remains clean during navigation fetch failures in the SW.

### Implementation for User Story 4

- [ ] T011 [US4] Update navigation fetch handler in `public/sw.js` to catch errors and return fallback silently.
- [ ] T012 [US4] Refine `stale-while-revalidate` logic in `sw.js` to suppress `console.warn` for routine network failures or aborted requests.

**Checkpoint**: User Story 4 functional - SW console noise reduced.

---

## Phase 5: User Story 3 - Accessible Forms (Priority: P2)

**Goal**: Fix Lighthouse accessibility warnings for form labels and identifiers.

**Independent Test**: Run Lighthouse accessibility audit on pages with forms.

### Implementation for User Story 3

- [ ] T013 [P] [US3] Audit and update input components in `src/components/ui/` to ensure they accept and correctly apply `id` and `name` attributes.
- [ ] T014 [US3] Update all form fields across the app (e.g., login, profile, settings) to have matching `htmlFor` and `id` attributes for labels and inputs.

**Checkpoint**: All user stories complete - accessibility scores improved.

---

## Phase 6: Polish & Verification

**Purpose**: Final verification and documentation

- [ ] T015 Verify all success criteria defined in `spec.md` are met.
- [ ] T016 [P] Update `README.md` or `SETUP.md` with notes about `DATABASE_URL_IPV4` requirement.
- [ ] T017 Final check of production logs in Vercel after deployment.
