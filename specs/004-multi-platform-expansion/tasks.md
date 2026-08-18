---
description: "Task list for the multi-platform expansion (Spec 004)"
---

# Tasks: 004 — Multi-Platform Expansion (Desktop + Mobile)

**Input**: Design documents from `/specs/004-multi-platform-expansion/`
- [plan.md](./plan.md) (required)
- [spec.md](./spec.md) (required for user stories)
- [research.md](./research.md) (decisions)
- [data-model.md](./data-model.md) (entities)
- [contracts/](./contracts/) (interface contracts)
- [quickstart.md](./quickstart.md) (developer walkthrough)

**Organization**: Tasks are grouped by user story. Each user story is independently implementable and testable. The cross-cutting concerns from `plan.md` (AI boundary enforcement, web non-regression, server-side-only enforcement) are split into Phase 2 (Foundational) so they block every story, and into their own phase for the security work that lands in US5.

**MVP scope**: User Story 1 (Desktop App) alone is the smallest end-to-end demo — web + desktop + shared package working, with security guards in place. Phases 1, 2, and 3 deliver the MVP. Subsequent phases add mobile, i18n, auth-continuity, and performance work in priority order.

**Note on tests**: The user's workflow preference is TDD discipline, so test tasks are included where they are the natural first step (contract tests, build-time checks, smoke tests). End-to-end Playwright/Jest suites are out of scope for this task list and are tracked in the team's separate test plan.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo skeleton; web app moved into `apps/web/`; CI in place.

- [ ] T001 Initialize pnpm workspaces at the repo root by creating `pnpm-workspace.yaml` and `package.json` (workspaces: `apps/*`, `packages/*`)
- [ ] T002 Create `apps/desktop/` directory structure per `plan.md` §Project Structure, with `package.json` declaring Electron, electron-builder, electron-updater as devDependencies
- [ ] T003 [P] Create `apps/mobile/` directory structure with `package.json` declaring Expo SDK 51+, expo-constants, expo-secure-store, expo-document-picker as dependencies
- [ ] T004 [P] Create `packages/shared/` directory with `package.json` (name: `masarx-shared`) and `tsconfig.json` extending `tsconfig.base.json`
- [ ] T005 Move the existing `src/` directory to `apps/web/src/`, update `tsconfig.json`, `next.config.ts`, and any absolute imports in the moved files
- [ ] T006 [P] Update `package.json` scripts to expose `dev:web`, `dev:desktop`, `dev:mobile`, `build:web`, `build:desktop`, `build:mobile`, `lint`, `typecheck`, `test` at the root
- [ ] T007 [P] Add GitHub Actions workflow `.github/workflows/ci.yml` running `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, and per-app `build:*` in parallel
- [ ] T008 [P] Add `.gitleaks.toml` at the repo root with rules for Supabase service-role JWTs, OpenAI/Anthropic API key patterns, and a `allowlist` for the test fixture directory `packages/shared/**/__fixtures__/**`

**Checkpoint**: `pnpm install` succeeds, `pnpm dev:web` runs the existing web app from the new path, and the GitHub Actions workflow is green on the migration branch.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared package, the cross-platform security guards, and the cross-platform contracts land here. **No user story can begin until this phase is complete.**

- [ ] T009 Create the Supabase client factory in `packages/shared/src/supabase/index.ts` per [contracts/supabase-client.md](./contracts/supabase-client.md): `createSupabaseClient({ runtime, url, anonKey, storage? })`, with the `service_role`-shaped key guard, the runtime-parameterized env-var source, and the `client-info` header injection
- [ ] T010 [P] Move `src/messages/*.json` (Arabic and English) into `packages/shared/src/messages/`, generate `types.ts` from the union of keys, and update the web app's imports to consume from `masarx-shared/messages`
- [ ] T011 [P] Move the existing Supabase-typed database types into `packages/shared/src/types/`, plus Zod schemas in `packages/shared/src/types/schemas/` (auto-generated; committed)
- [ ] T012 [P] Create the AI client in `packages/shared/src/ai/index.ts` per [contracts/ai-boundary.md](./contracts/ai-boundary.md): `sendAiMessage` and `streamAiMessage` that call the Edge Function, never the AI provider directly
- [ ] T013 [P] Add ESLint `no-restricted-imports` rule in `apps/web/.eslintrc.json`, `apps/desktop/.eslintrc.json`, and `apps/mobile/.eslintrc.json` blocking `openai` and `@anthropic-ai/sdk` from any path outside `supabase/functions/**` and `packages/shared/**`. The rule MUST be set to `"error"` severity (not `"warn"`), and the `pnpm lint` step in CI (T007) MUST be configured to treat lint errors as build failures — a `warn`-level rule that doesn't fail the build is not enforcement.
- [ ] T014 [P] Add CI grep check `.github/scripts/check-ai-provider-endpoints.sh` (invoked from `.github/workflows/ci.yml`) that fails if `api.openai.com`, `api.anthropic.com`, or any equivalent known AI provider API host string appears in any file outside `supabase/functions/**` and `packages/shared/ai/__fixtures__/**`. The CI job that runs this script MUST be registered as a **required status check** on the protected branch — a CI job that runs but isn't required is observability, not enforcement. **Note:** the registration of the check as "required" is a one-time GitHub repository setting (Branch protection rules → Require status checks to pass before merging), performed manually via the GitHub UI or via a repo-config-as-code tool (e.g., Terraform, `gh api`). The CI YAML alone does not make the check required; the branch-protection setting does. This task's deliverable is BOTH the CI step AND the branch-protection registration, not just one or the other.
- [ ] T015 [P] Add CI step that runs `gitleaks detect --no-git --source <each-built-artifact>` against every built app bundle (Electron asar, Expo bundle, Next.js static export); build fails on any match
- [ ] T016 Document the new monorepo in the root `README.md` (replacing the current single-app instructions): workspace layout, how to run each app, how to add a new shared package, how the contracts are enforced

**Checkpoint**: The shared package is consumable from the web app (existing functionality preserved). The three CI security guards (ESLint rule, AI-endpoint grep, gitleaks-on-artifacts) all pass green on the web app's existing build. The web app's existing Playwright smoke test still passes (proves non-regression per plan.md §Cross-cutting concerns).

---

## Phase 3: User Story 1 - Desktop App (Priority: P1) 🎯 MVP

**Goal**: A user can install and use Masar X as a native desktop application on Windows, macOS, and Linux, with feature parity to the web app's main journeys.

**Independent Test**: Build and install the desktop app on at least one of the three target platforms. Sign in, navigate to all main pages, upload a PDF, send a message to the AI assistant, switch language, and verify the experience is visually and functionally equivalent to the web app.

### Tests for User Story 1 (write FIRST, verify they FAIL)

- [ ] T017 [P] [US1] Contract test for the Electron main process in `apps/desktop/src/main/__tests__/main.test.ts` — assert that the main process starts a local Next.js server on a random free port and opens a BrowserWindow pointing at it
- [ ] T018 [P] [US1] Smoke test for the desktop app in `apps/desktop/__tests__/smoke.test.ts` — build the app, launch it headlessly, assert that the home page renders and the AI assistant endpoint is reachable

### Implementation for User Story 1

- [ ] T019 [P] [US1] Create `apps/desktop/electron-builder.yml` per research.md §7: Windows (Authenticode, EV cert preferred), macOS (Developer ID + notarization), Linux (AppImage/.deb/.rpm, GPG-signed)
- [ ] T020 [US1] Create the Electron main process in `apps/desktop/src/main/index.ts`: detect dev vs. production, in dev point at `http://localhost:3000`, in production spawn a local Next.js server and open a window pointing at it
- [ ] T021 [US1] Implement `LocalAuthSession` for desktop in `apps/desktop/src/main/auth-storage.ts` per data-model.md: encrypted JSON file in the Electron userData dir, key derived from machine ID + per-install secret
- [ ] T022 [US1] Implement `LocalReadCache` for desktop in `apps/desktop/src/main/read-cache.ts` per data-model.md: SQLite via `better-sqlite3`, read-through from Supabase, exposed to the renderer as an IPC handler
- [ ] T023 [US1] Configure auto-update in `apps/desktop/src/main/updater.ts` per research.md §6: `electron-updater` reading from a documented release channel (stable / beta), with automatic rollback if a new version fails to start (the previous version's asar is loaded)
- [ ] T024 [US1] Wire the desktop app's window controls (minimize, maximize, close) and the native menu bar (File / Edit / View / Window / Help) with platform-correct keyboard shortcuts per spec FR-002
- [ ] T025 [US1] Smoke-test on at least one target platform; verify the installer does not trigger OS security warnings (spec FR-001 / SC-001)

**Checkpoint**: User Story 1 is fully functional and testable independently. The MVP can be demonstrated: web + desktop, shared package, all security guards in place.

---

## Phase 4: User Story 2 - Mobile App (Priority: P1)

**Goal**: A user can install and use Masar X as a native mobile app on iOS and Android, with the main user journeys working touch-optimized and in both Arabic (RTL) and English (LTR).

**Independent Test**: Build and install the mobile app on a real iOS device and a real Android device (or iOS Simulator + Android Emulator). Sign in, complete a quiz, send a message to the AI assistant, upload a PDF, switch language, and verify the experience is native-feeling.

### Tests for User Story 2 (write FIRST, verify they FAIL)

- [ ] T026 [P] [US2] Contract test for the `expo-localization` integration in `apps/mobile/__tests__/i18n.test.ts` — assert that the device language (Arabic or English) drives the app's `dir` attribute
- [ ] T027 [P] [US2] Smoke test for the AI math rendering in `apps/mobile/__tests__/math-rendering.test.ts` — render a known math expression, assert it appears as formatted math, not raw LaTeX

### Implementation for User Story 2

- [ ] T028 [P] [US2] Initialize the Expo project in `apps/mobile/` with `npx create-expo-app mobile --template tabs` (or current Expo template), then strip the template-specific content
- [ ] T029 [P] [US2] Configure `apps/mobile/app.json`: `extra.supabaseUrl` and `extra.supabaseAnonKey` (read by `expo-constants` in the shared factory), `supportsRTL: true`, `orientation: "portrait"`
- [ ] T030 [P] [US2] Configure `apps/mobile/eas.json` with `development`, `preview`, and `production` build profiles per spec FR-M06
- [ ] T031 [US2] Implement navigation in `apps/mobile/app/` using React Navigation, with a tab bar mirroring the web app's primary sections (subjects, summaries, quizzes, AI assistant, profile)
- [ ] T032 [US2] Implement `LocalAuthSession` for mobile in `apps/mobile/src/auth-storage.ts` per data-model.md: `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android)
- [ ] T033 [US2] Implement `LocalReadCache` for mobile in `apps/mobile/src/read-cache.ts` per data-model.md: AsyncStorage with a JSON envelope
- [ ] T034 [US2] Integrate `expo-document-picker` for PDF upload per spec FR-009: pick a PDF, upload through the same Edge Function used by the web app, with the same size and auth limits
- [ ] T035 [US2] Integrate the native share sheet in `apps/mobile/src/share.ts` per spec FR-012: invoke `Share.share` for shareable study content
- [ ] T036 [US2] Implement math rendering in the AI chat per spec FR-010: render LaTeX/TeX as formatted math (use a WebView with a math-rendering library, since native `<Text>` cannot render LaTeX)
- [ ] T037 [US2] Smoke-test on a real iOS device (or Simulator) and a real Android device (or Emulator); verify the install succeeds (spec SC-002) and the app store submission is configured (spec SC-011)

**Checkpoint**: User Stories 1 AND 2 are both fully functional and testable independently. Web + desktop + mobile + shared package, all security guards in place.

---

## Phase 5: User Story 3 - Translations Stay in Sync (Priority: P2)

**Goal**: Adding or editing a translation key in `packages/shared/src/messages/` is reflected on all three apps after a rebuild. No copy-paste between apps. CI fails if any app declares a local translation file.

**Independent Test**: Add a new translation key to both `ar.json` and `en.json` in the shared package. Rebuild all three apps. Verify the new key appears with the correct value in the right language on each platform.

- [ ] T038 [P] [US3] Add CI check `.github/scripts/check-translations.sh` per contracts/i18n-messages.md: fails if any file under `apps/` contains a `messages/` or `locales/` directory; the only translation source is `packages/shared/src/messages/`
- [ ] T039 [P] [US3] Verify the web app's `next-intl` config reads from `masarx-shared/messages` (already done in T010; this task is a regression check)
- [ ] T040 [P] [US3] Wire `expo-localization` on mobile to read from the shared package, with the `t(key, locale?)` helper from `packages/shared/src/i18n/index.ts`
- [ ] T041 [P] [US3] Wire the desktop app's local Next.js server to read from the shared package (no separate config; it shares the web app's i18n pipeline)
- [ ] T042 [US3] Verify the key-rename protocol from contracts/i18n-messages.md works end-to-end: add a new key, update one call site to use it, run typecheck, verify the old key is still in the file but the build is clean

**Checkpoint**: A single edit to `packages/shared/src/messages/{ar,en}.json` is reflected on all three apps after rebuild. CI fails the build if any app declares a local translation file.

---

## Phase 6: User Story 4 - One Supabase Account (Priority: P2)

**Goal**: A user can sign in on any platform with the same credentials, see the same profile, access the same uploaded files, and reset their password once and have the new password work everywhere.

**Independent Test**: Create an account on the web. Sign in on desktop and mobile with the same credentials. Upload a file on mobile. Verify it appears on web and desktop. Reset the password; verify the new password works on all three.

- [ ] T043 [US4] Verify Supabase Auth email/password sign-in works on the desktop app (the local Next.js server preserves the same auth flow as the web; this is a smoke test, not new code)
- [ ] T044 [P] [US4] Verify Supabase Auth email/password sign-in works on the mobile app via `expo-secure-store` session storage (smoke test)
- [ ] T045 [P] [US4] Verify Google sign-in works on the desktop app (OAuth flow opens in the system browser, returns to the app via deep link, session is stored locally)
- [ ] T046 [P] [US4] Verify Google sign-in works on the mobile app (OAuth flow opens in the system browser / `WebBrowser.openAuthSessionAsync`, returns to the app)
- [ ] T047 [US4] Verify password reset works on all three platforms (the existing Edge Function handles the reset email; the only per-platform concern is that the reset link opens in the right context — for v1, the reset link opens the web app, and the desktop/mobile apps are signed out until the user signs in again with the new password)
- [ ] T048 [US4] Verify the cross-provider same-email account linking behavior from the spec's edge cases works: a user who created their account with email/password and later signs in with Google (or vice versa) is matched by email, not treated as a new account

**Checkpoint**: A single Supabase account is usable on all three platforms, with the same data visible everywhere.

---

## Phase 7: User Story 5 - Sensitive Backend Keys Never Leak (Priority: P1)

**Goal**: A static security scan of every shipped artifact finds zero matches for the service-role key, the AI provider key, or any other server-only secret. The AI provider key is mechanically prevented from being reachable from any client context. RLS is verified on every user-data table.

**Independent Test**: Build all three apps. Run gitleaks on each artifact. Run the AI-endpoint grep on every source file outside the Edge Function directory. Run the ESLint no-restricted-imports rule. All three checks must be green. Attempt to sign in to the database as a different user and read the first user's data — must be denied by RLS.

- [ ] T049 [US5] Verify gitleaks on the production Electron asar returns zero matches (the asar is built by electron-builder, located in `apps/desktop/dist/`); CI fails the build on any match
- [ ] T050 [P] [US5] Verify gitleaks on the production Expo bundle returns zero matches (the bundle is built by EAS Build, downloaded for verification); CI fails the build on any match
- [ ] T051 [P] [US5] Verify gitleaks on the production Next.js static export returns zero matches; CI fails the build on any match
- [ ] T052 [US5] Verify the ESLint `no-restricted-imports` rule (T013) fails the build if a developer adds `import { OpenAI } from 'openai'` to a file outside `supabase/functions/**` and `packages/shared/**`
- [ ] T053 [US5] Verify the CI grep (T014) fails the build if a developer adds `fetch('https://api.openai.com/...')` to a file outside `supabase/functions/**` and `packages/shared/ai/__fixtures__/**`
- [ ] T054 [US5] Implement the AI Edge Function in `supabase/functions/ai-chat/index.ts` per research.md §9: receives the `AiRequest` from the shared package, reads the AI provider key from its own environment, calls the provider, streams the response back, applies the existing rate limits
- [ ] T055 [US5] Verify the existing RLS test suite (per the team's separate test plan) covers every client-accessible table: at least one positive test (user can read their own row) and one negative test (user cannot read another user's row) per table
- [ ] T056 [US5] Document the "what to do if a key leaks" runbook in `docs/security/secret-leak-runbook.md`: rotation procedure, gitleaks re-scan, rate-limit review for the window between creation and detection

**Checkpoint**: Every shipped artifact passes gitleaks. The ESLint rule and the CI grep catch the raw-HTTP bypass before merge. RLS is verified. The runbook is in place for incident response.

---

## Phase 8: User Story 6 - Performance Meets the Multi-Platform Promise (Priority: P3)

**Goal**: Real-world performance matches the expectations set during planning: desktop cold-launch is fast, mobile scrolling is smooth, mobile data usage is lower than the equivalent mobile-browser session, the web app's Lighthouse score does not regress.

**Independent Test**: Measure desktop cold-start, mobile list scroll, and mobile data usage on representative devices. Compare to the same flows in a browser. Compare the web app's Lighthouse score before and after the monorepo move.

- [ ] T057 [P] [US6] Set up Lighthouse CI in `.github/workflows/lighthouse.yml` for the web build; capture the pre-monorepo baseline and fail the build on a regression of more than 5 points (per spec SC-009)
- [ ] T058 [P] [US6] Profile desktop cold start on a documented reference machine; capture the baseline; add a CI perf check that fails on a regression of more than 20% (per spec SC-007 / SC-009)
- [ ] T059 [P] [US6] Profile mobile list scroll on a documented mid-range Android device (or a recorded CI run with React DevTools profiler); capture the baseline; document the FPS floor
- [ ] T060 [P] [US6] Profile mobile data usage for a typical 10-minute study session; capture the baseline; document the comparison to the mobile-browser equivalent
- [ ] T061 [US6] Document the reference environments (machine specs, network conditions, app versions) in `docs/perf/baselines.md` so the baselines can be reproduced and re-measured over time

**Checkpoint**: The web app's Lighthouse score is at or above the pre-monorepo baseline. Desktop cold-start, mobile scroll, and mobile data usage are documented with reference environments. The CI perf checks are in place to catch future regressions.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final touches that affect every user story.

- [ ] T062 [P] Update `CONTRIBUTING.md` (or create it if missing) with: monorepo layout, how to add a new shared package, how to add a new user story, the security guards and why they exist
- [ ] T063 [P] Add a release notes template in `docs/releases/TEMPLATE.md` covering: which user stories shipped, which platforms are affected, known issues, and the next planned user story
- [ ] T064 [P] Add a `docs/perf/baselines.md` (referenced from T061) with the reference environments and the current measurements
- [ ] T065 [P] Run `quickstart.md` end-to-end on a fresh clone (CI smoke job); verify a new contributor can set up and run all three apps in under 30 minutes (per spec SC-012)
- [ ] T066 [P] Triage the existing Dependabot advisories on `main` (123 vulnerabilities, 53 high as of the last push) — separate work item, not in this feature's scope, but worth flagging in the release notes
- [ ] T067 Replace `dangerouslyAllowAllBuilds: true` in `pnpm-workspace.yaml` with an explicit `onlyBuiltDependencies` list (sharp, @parcel/watcher, @swc/core, esbuild, unrs-resolver) before PR #12 is marked ready for review. The current setting globally disables pnpm's build-script sandbox; it's a temporary unblock for the monorepo migration, not a permanent posture.
- [ ] T068 Fix `pnpm build` for `apps/web` — the build was already broken on `main` (different error, same outcome) before the T001+T005 monorepo move, so the structural change is neutral on the build question. Two known errors to investigate: (1) `JSX element class does not support attributes because it does not have a 'props' property` in `apps/web/src/app/global-error.tsx:18` — pre-existing React 19 type-compatibility issue with `next/error` class components; (2) `Cannot find module '../../../src/app/auth/callback/route.js'` in `.next/dev/types/validator.ts:512` — likely stale `.next/` build cache, reproducible on main with a fresh build. Land the build fix as its own commit, separate from the T001+T005 structural commit.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion. **Blocks all user stories.** The shared package and the security guards land here.
- **User Stories (Phase 3+)**: All depend on Foundational phase completion.
  - User Story 1 (Desktop, P1): no dependencies on other stories — can start as soon as Phase 2 is done.
  - User Story 2 (Mobile, P1): no dependencies on other stories — can run in parallel with US1 if the team is staffed.
  - User Story 3 (i18n, P2): depends on the shared package from Phase 2; can run in parallel with US1/US2.
  - User Story 4 (Auth continuity, P2): depends on the shared package from Phase 2; can run in parallel with US1/US2.
  - User Story 5 (Secrets, P1): depends on the security guards from Phase 2; can run in parallel with US1/US2 (its work is mostly verification + Edge Function, not per-story UI work).
  - User Story 6 (Performance, P3): depends on US1 and US2 being at least smoke-functional; runs after the desktop and mobile apps are in a measurable state.
- **Polish (Phase 9)**: Depends on all desired user stories being complete.

### User Story Dependencies

- **US1 (Desktop, P1)**: No dependencies on other stories. Independently testable.
- **US2 (Mobile, P1)**: No dependencies on other stories. Independently testable.
- **US3 (i18n, P2)**: Independently testable. Verifies the contract; doesn't change US1/US2's code.
- **US4 (Auth continuity, P2)**: Independently testable. Smoke tests; doesn't change US1/US2's code.
- **US5 (Secrets, P1)**: Independently testable. CI guards + Edge Function + RLS tests.
- **US6 (Performance, P3)**: Depends on US1 and US2 reaching a measurable state.

### Within Each User Story

- Tests (where included) MUST be written and FAIL before implementation.
- The cross-cutting security concerns (ESLint rule, AI-endpoint grep, gitleaks-on-artifacts) MUST be in place from Phase 2 — not deferred to US5. US5 verifies and tightens, but the guards are not invented at US5.
- The web app non-regression smoke test MUST pass after every PR that touches the monorepo's structure.

### Parallel Opportunities

- Phase 1 setup tasks marked [P] can run in parallel.
- Phase 2 foundational tasks marked [P] can run in parallel.
- Once Phase 2 completes, US1, US2, US3, US4, and US5 can start in parallel (if team capacity allows). US6 starts after US1 and US2 reach a measurable state.
- All tests for a user story marked [P] can run in parallel.
- Different user stories can be worked on by different developers in parallel.

---

## Parallel Example: User Story 1 (Desktop, MVP)

```bash
# Launch the two test tasks for US1 together (after Phase 2 is done):
Task: "Contract test for the Electron main process in apps/desktop/src/main/__tests__/main.test.ts"
Task: "Smoke test for the desktop app in apps/desktop/__tests__/smoke.test.ts"

# Then launch the implementation tasks:
Task: "Create apps/desktop/electron-builder.yml per research.md §7"
Task: "Create the Electron main process in apps/desktop/src/main/index.ts"
Task: "Implement LocalAuthSession for desktop in apps/desktop/src/main/auth-storage.ts"
Task: "Implement LocalReadCache for desktop in apps/desktop/src/main/read-cache.ts"
Task: "Configure auto-update in apps/desktop/src/main/updater.ts"
```

The contract test and the smoke test are independent of each other and can be written in either order. The implementation tasks depend on the contract test being in place (so they can make it pass), but most of the implementation tasks are themselves parallelizable (different files, no shared state).

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational.
3. Complete Phase 3: User Story 1 (Desktop).
4. **STOP and VALIDATE**: Test US1 independently on at least one target platform.
5. Deploy / demo the web + desktop experience.

This is the smallest end-to-end demonstration of the multi-platform strategy.

### Incremental Delivery

1. Setup + Foundational → Foundation ready (web app preserved, security guards in place).
2. + US1 → Desktop app demo.
3. + US2 → Mobile app demo.
4. + US3 → Translations verified.
5. + US4 → Auth continuity verified.
6. + US5 → Security story fully verified.
7. + US6 → Performance baselines documented.
8. Polish → Release notes, contributing guide, perf baselines.

### Parallel Team Strategy

With multiple developers:
1. Team completes Phase 1 + Phase 2 together.
2. Once Foundational is done:
   - Developer A: US1 (Desktop).
   - Developer B: US2 (Mobile).
   - Developer C: US5 (Security verification + Edge Function).
   - Developer D: US3 + US4 (i18n and auth smoke tests — small stories, can be combined).
3. US6 starts after US1 and US2 are smoke-functional.

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps task to the user story.
- Each user story should be independently completable and testable.
- Verify tests fail before implementing.
- Commit after each task or logical group; the same review protocol used in the spec and plan phases applies to each PR.
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence.
- **The three security guards from Phase 2 (ESLint `no-restricted-imports`, AI-endpoint CI grep, gitleaks-on-artifacts) are non-negotiable.** A PR that disables any of them to land faster is a release-blocker until the guard is restored. There is no "temporary disable" path.
