# Spec 006 — Tasks

Execution batch 1 = **Phase 1** (web stability, 2026-09-10). Phases 2–3 stay here as
pending checklists. File paths are authoritative; line numbers drift.

## Phase 1 — Web Core & Backend Stability 🔨

### A. Spec & branding docs
- [x] A1 `specs/006-semester-launch/spec.md` — brainstorm transcript reconciled against repo
- [x] A2 `BRANDING.md` — actual tokens from `apps/web/src/index.css` (not the proposed hexes)
- [x] A3 `.env.example` — tenancy block under existing `NEXT_PUBLIC_COLLEGE_NAME`,
      optional `NEXT_PUBLIC_SUPPORT_CHANNEL`, `AI_DAILY_FREE_LIMIT` marked planned

### B. Code (apps/web, packages/shared, supabase) — batch 1 done 2026-09-10
- [x] B1 Hardcoded Arabic → i18n (ar **and** en keys; invariant I3):
  - [x] `apps/web/src/components/SubjectsGrid.tsx` (`optimisticSaving`, `studyWithZainCta` → subjects.json)
  - [x] `apps/web/src/hooks/useAiChat.ts` (chat error + needs-subject → aiAssistant.json)
  - [x] `apps/web/src/components/AdminProfileImage.tsx` (avatar toasts + alt → profile.json)
  - [x] `apps/web/src/components/AIErrorBoundary.tsx` (refactored to inner/outer + `t` prop, errorBoundary.json aiTitle/aiSubtitle)
  - [x] `apps/web/src/components/ErrorBoundary.tsx` (`t` prop now required; Arabic fallbacks removed)
  - [x] `apps/web/src/app/[locale]/ai-assistant/page.tsx` (summarize toast → aiAssistant.json)
  - [x] `apps/web/src/hooks/useUserAcademic.ts` (rate-limit + save-error → profile.json)
  - [x] Grep sweep done — remaining Arabic in touched files is intentional only:
        LLM prompt-context annotation (useAiChat ~172) and the locale-conditional
        assistant-name selectors (زين/ZANE, same pattern as ChatContainer).
- [x] B2 Empty-state i18n (no UX redesign):
  - [x] `apps/web/src/components/course/CourseSummariesSection.tsx` (→ courseDetail.summaries)
  - [x] `apps/web/src/components/courses/CourseContent.tsx` (13 strings → courseDetail.*, incl. new membersOnly keys)
  - [x] `apps/web/src/components/ReviewSection.tsx` + `apps/web/src/components/courses/ReviewSection.tsx` (→ reviews.json)
  - [x] `apps/web/src/components/EnrollmentsTab.tsx`, `PageManagementTab.tsx` (→ adminDashboard.enrollmentsTab / pageManagementTab)
  - [x] `apps/web/src/app/[locale]/admin-dashboard/AdminAnalyticsPage.tsx` (28 strings → adminDashboard.analyticsPage; fixed pre-existing "غير مححدد" typo)
- [x] B3 Zain retry affordance: `useAiChat.ts` extracts `runAssistantTurn`, adds
      `retryLast` (re-send last user turn without duplicating it/its DB row; error
      bubbles flagged `isError`); `ChatMessageItem.tsx` renders retry on error bubbles;
      wired through `ChatContainer` + page (`ai_retry` analytics event)
- [x] B4 `Footer.tsx`: credit reordered to read "Made with ♥ by Aboalayoun" in RTL; `bidi-ltr` kept
- [x] B5 `SubjectsGrid.tsx`: `grid-cols-1` below `sm` (both grid + skeleton instances)
- [x] B6 `supabase/seed.sql`: adds 4 sample subjects (levels 1–2) + sample lectures,
      idempotent, zero PII; root `db:seed` script → `apps/web/scripts/db-seed.mjs`
      (env resolution mirrors admin-db: `DATABASE_URL_IPV4 || DATABASE_URL`)
- [x] B7 Secret audit (heuristic; gitleaks not installed locally, CI covers it):
      only `.env.example` tracked; no real secret values in tracked files;
      `.gitignore` covers `.env*`. No history rewriting.

### Verification
- [x] `pnpm typecheck` — passes (all 4 workspace projects)
- [x] `pnpm lint` — 0 errors (388 pre-existing warnings, none in touched files)
- [ ] `pnpm test` — ⚠️ only suite is `apps/desktop` smoke; fails for an
      environmental reason: `apps/desktop/node_modules/electron/cli.js` is absent
      (Electron postinstall never ran in this workspace), so the headless spawn
      errors with MODULE_NOT_FOUND before any assertion. Pre-existing, unrelated
      to this batch (no desktop files touched). Fix locally via pnpm electron
      postinstall approval if needed.
- [x] No hardcoded Arabic left in touched files (AGENTS.md §8 check)
- [ ] Visual checks pending manual review: footer RTL order, 375px subjects
      layout, bilingual empty states, retry bubble on Puter-unavailable path

## Phase 2 — Mobile Stabilization (📋 pending)
- [ ] Expo `SubjectsScreen` cards → `Pressable` + React Navigation params typing
- [ ] Mobile loaders / contextual empty states
- [ ] Mobile Zain error-handling parity with web
- [ ] Capacitor Lite shell (`apps/lite`) + WebView runtime detection
- [ ] PWA re-verification after Lite

## Phase 3 — Release & Community (📦 pending)
- [ ] RLS re-audit before announcement
- [ ] BIS-fork DB cleanup (dummy `33222`-style lectures, tester copy)
- [ ] Seed FCAI core curricula in production dashboard
- [ ] Launch announcement (student channels: PWA link, Lite APK, desktop releases)

## Already done before this spec (✅ verified 2026-09-10)
- MIT `LICENSE`, `CONTRIBUTING.md`, public repo `fotedev/Masar-x-next`
- Electron download-banner hiding (`useIsDesktopRuntime`, commit 84ca992)
- Web loaders/skeletons (SubjectsGrid, News, SummariesSection)
- PWA `sw.js` per-deploy cache versioning + `manifest.json`
- RLS policies across migrations 002–007; `seed.sql` levels-only baseline
