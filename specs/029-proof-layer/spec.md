# Spec 029 — Proof Layer (public transcript, paid verification, assessment integrity)

**Status:** Planning — awaiting owner approval
**Type:** Feature (phased — Phase 1 implementation-ready on existing primitives; Phases 2–3 documented design)
**Branch:** `spec/029-proof-layer`
**Origin:** owner vision notes (2026-10-24): "learn for free, pay to verify" — a Proof-of-Competency engine layered on top of the existing content platform, differentiated from static roadmaps by *provable* outcomes.

## Problem

The platform teaches but cannot *prove*. A student completes lectures, takes quizzes and builds a record — yet there is no shareable, verifiable artifact of that competence for an employer or third party, no gate that separates "casual practice" from "official assessment", and no protection against unlimited identical retakes. The owner's vision splits the product into **free learning** (already built) and a **paid verification layer** (missing). Codebase inventory (2026-10-24) shows the foundations exist — this spec defines the missing proof layer in three phases, sized so Phase 1 reuses existing primitives without new infrastructure.

### Existing foundations (verified on disk, no new work needed)

| Foundation | Where |
|---|---|
| Assessment primitive: `duration_minutes`, `max_attempts`, `passing_score` columns on `quizzes` | `supabase/migrations/004_content_management.sql:23-25` |
| Attempt records with score, answers, correctness, timing | `quiz_attempts` / `quiz_answers` (migrations.old), `apps/web/src/lib/quiz.ts` |
| Progress tracking per content item | `user_progress` (`supabase/migrations.old/20260217000000_create_user_progress.sql`) |
| Paid-access pattern A: price + payment screenshot + manual admin approval | `courses.price`, `enrollments`, private `payment-proofs` bucket |
| Paid-access pattern B: access codes with `max_uses`/`used_count`/expiry + memberships + audit log | TRW subsystem (`migrations.old/2026022*`), `trw_redeem_access_code` RPC |
| AI chassis ready to host a defense agent: edge function with SSE, server-held keys, rate limiting, extensible mode union | `supabase/functions/ai-chat/`, `packages/shared/src/ai/types.ts` (spec 004 ai-boundary contract) |
| Academic hierarchy reusable as track structure | `academic_levels`, `departments`, `subjects` (migration 003) |
| Notification delivery (in-app realtime + notifyAdmins/notifyUser helpers) | `apps/web/src/hooks/useNotifications.ts` |
| Security posture: RLS everywhere, `audit_logs`, rate limiting, `is_admin()` helper | migrations 006/010/011, migrations.old RLS audit |

## Scope

### Phase 1 — built on existing primitives (implementation-ready after approval)

**F1 — Public Dynamic Transcript (`/[locale]/verify/[username]`)**
- `profiles.transcript_public boolean NOT NULL DEFAULT false` — opt-in toggle on the profile page (default off: today's behavior).
- RPC `get_public_transcript(p_username text)` (SECURITY DEFINER, hardened `search_path` per 010/011 pattern): returns data **only** when `profiles.transcript_public = true`, and only non-PII fields — display name, avatar, join year, completed quiz attempts (quiz title, score, total, passed, finished_at), per-subject progress coverage counts, count of authored approved summaries. No emails, no user ids, no attempt answer payloads, no in-progress attempts.
- Read-only public page; 404 when profile missing or private; share/copy-link button; document metadata follows brand rules (`docs/BRANDING.md` naming).

**F2 — Test-Out + assessment fee gate**
- New tables: `assessment_grants` (id, user_id, grantable_type `['quiz','track']`, grantable_id, source `['payment_proof','access_code']`, reference_url nullable, status `['pending','granted','rejected']`, requested_at, decided_at, reviewed_by) and `assessment_access_codes` (code hash, max_uses/used_count, expires_at, granted_by) — modeled on the TRW access-code + enrollment-approval patterns respectively.
- New `quizzes.is_official boolean NOT NULL DEFAULT false` — admins flag a quiz as an official assessment.
- Flow: on an official quiz, `startAttempt` requires an active grant; without one the player shows a CTA (request with transfer screenshot → admin approves in a new grants queue tab, reusing `AdminDataTable`/`AppealsTab` interaction patterns and `notifyAdmins`) or redeem an access code instantly.

**F3 — Retake cooldown + question variants**
- `quizzes.retake_cooldown_hours int NOT NULL DEFAULT 0` (default = today's behavior).
- `startAttempt` gains an early gate: a completed attempt within the cooldown window returns a structured `cooldown_until` result; `QuizPlayer` renders a countdown instead of the start button.
- `quizzes.question_pool_size int NULL` + `quiz_attempts.drawn_question_ids jsonb NOT NULL DEFAULT '[]'`: when pool size is set (and questions ≥ pool size), each attempt draws that many questions randomly from the quiz's set and shuffles option order; the drawn ids are persisted on the attempt so review pages render the exact variant taken. Deterministic per attempt — no AI generation required; pools are fed by the existing question builder / JSON import.

**F4 — Ordered Track (linear, pre-DAG)**
- New tables: `tracks` (id, slug unique, name, description, is_published, order_index) and `track_items` (id, track_id, item_type `['subject','quiz']`, item_id, order_index, requires_previous boolean default true).
- Completion rules: quiz item = a passed attempt exists; subject item = helper RPC `is_subject_complete(user, subject)` (all active lecture content of the subject present in `user_progress`). Item N is visible but locked until item N−1 is complete when `requires_previous`.
- Page `/[locale]/tracks/[slug]` with locked/unlocked states; admin authoring (create track, order items) added as an admin-dashboard tab.
- Deliberately **not** a prerequisite DAG — a flat ordered sequence is sufficient for a single-track MVP and avoids graph-model scope.

### Phase 2 — designed now, specced in detail before build

**F5 — AI Code Defense (text-first)**: `defense_sessions` (user, subject/quiz refs, code submission as pasted/uploaded files, status `['in_progress','passed','failed','expired']`, transcript jsonb, verdict, verdict_score, model_used); new edge function `ai-defense` mirroring `ai-chat` (auth → server-held key → SSE, `check_rate_limit`); new `'code_defense'` mode added to the AI contract in `packages/shared/src/ai/types.ts`. The agent interrogates the student about their own submitted code (pattern choices, edge cases, complexity); a passed verdict becomes a transcript entry (F1). Voice input is explicitly out of scope for v1.

**F6 — Certificate on pass**: server-rendered PDF issued when an official assessment (and optionally a defense) is passed; stored in a private bucket; linked from the transcript page.

**F7 — Link health-check**: Vercel cron (weekly) → API route checking `videos.url` (YouTube oEmbed) and `files.file_url` reachability; results in a small `link_health_checks` table (url, status, checked_at) with an admin badge + `notifyAdmins` on new failures. Serves the "content drift" mitigation from the vision notes.

### Phase 3 — architectural decisions documented, **not** designed for execution yet

- **Automated code challenges**: run the student's code via GitHub Actions on the student's own forked challenge repo (zero server-side compute — the vision notes' own cost mitigation), results reported to the platform via a signature-verified `/api/webhooks/github`. Requires GitHub OAuth (does not exist today — auth is email + Google only).
- **Git forensics**: commit-cadence analysis via GitHub API (reject single mega-commit submissions) recorded as challenge metadata.
- **Employer portal**: new employer-facing role + search UI over opted-in public transcripts only (F1's opt-in is the privacy boundary).
- **Real payment gateway**: Paymob vs Stripe comparison — owner decision; until then F2's screenshot-approval flow is the payment path.

## Contracts

- **Migrations**: new numbered migrations following the existing `NNN_` convention; every new table gets RLS with `is_admin()`-based admin policies (no new SECURITY DEFINER functions without hardened `search_path`, per migrations 010/011 discipline).
- **Types (I2)**: Zod schemas for `Transcript`, `AssessmentGrant`, `Track`, `TrackItem`, `DefenseSession` added in `packages/shared/src/types/schemas/`; `packages/shared/src/types/database.ts` extended with all new tables/columns.
- **AI boundary**: `'code_defense'` appended to the mode union in `packages/shared/src/ai/types.ts` (spec 004 contract file); consumers must treat unknown modes as non-fatal (existing pattern).
- **i18n (I3)**: new namespaces `verify`, `assessmentGrants`, `tracks` (ar + en) in `packages/shared/src/messages/`; key parity enforced by the existing test pattern.
- **Routes**: `/[locale]/verify/[username]`, `/[locale]/tracks/[slug]`, admin tab `assessment_grants` registered in `apps/web/src/lib/admin-shell/navigation.ts`.

## Behavior preservation & regression strategy

- Every new column defaults to today's behavior: `retake_cooldown_hours = 0`, `question_pool_size = NULL`, `transcript_public = false`, `is_official = false`. With defaults, `startAttempt` behaves exactly as today (the two new gates are flag-guarded no-ops).
- Existing quiz attempts/review pages continue to render identically when `drawn_question_ids = '[]'` (legacy attempts fall back to the full question list).
- No changes to TRW, enrollments, or the AI chat transport; the new admin tab is purely additive to `navigation.ts`.
- RLS changes are additive only; no policy on an existing table is altered or dropped (Q2 remediation WP3 remains pending and must not be complicated further by this work).
- Proof: the full existing web test suite stays green; new gates get their own unit tests including the default pass-through case.

## Test specification

- **Unit** (`apps/web`): cooldown gate (blocked within window / allowed after / zero-cooldown unchanged), pool draw (correct count, no duplicates, persisted ids, deterministic per attempt, falls back to full list when pool unset), grant state machine (pending→granted/rejected; grant required only for official quizzes), `is_subject_complete` helper, transcript RPC response shape (asserts absence of PII fields).
- **RLS/integration**: anon `get_public_transcript` returns rows only for `transcript_public = true` profiles; grant rows readable/writable only by owner and admin; access codes decrement `used_count` atomically.
- **E2E** (Playwright, route-mocked per the `guest-quiz.spec.ts` pattern): `/verify/[username]` renders attempts for an opted-in profile and 404s otherwise; locked track item shows lock state; official quiz without grant shows the CTA.
- **i18n**: ar/en key parity for the three new namespaces.

## Atomic execution plan (Phase 1 only — each commit independent, gated per 08-precommit.md)

1. **Migration + types**: `quizzes.retake_cooldown_hours`, `question_pool_size`, `is_official`, `profiles.transcript_public` + `drawn_question_ids`; Zod + `Database` types; i18n skeletons. Gates: shared + web typecheck/lint/test.
2. **F3 logic**: `startAttempt` gates + countdown UI + variant draw + unit tests.
3. **F1**: transcript RPC + `/verify/[username]` page + profile opt-in toggle + tests + e2e.
4. **F2**: `assessment_grants`/codes migration + request/redeem flows + admin grants queue + tests.
5. **F4**: `tracks`/`track_items` migration + track page + admin authoring tab + tests.

Phase 2 (F5–F7) and Phase 3 each require their own detailed spec/tasks after Phase 1 lands.

## Non-goals

- No prerequisite DAG/graph engine (linear track only in Phase 1).
- No voice-based defense; no GitHub OAuth/integration in Phases 1–2.
- No payment gateway, no employer portal (Phase 3, owner decisions).
- No transcript for guest/local attempts (DB-backed attempts only — guest attempts live in sessionStorage by design).
- No change to grading semantics (`passing_score` untouched).

## MVP Lock (I12) gating

This spec is a **planning artifact only**. Phase 1 execution requires the owner's explicit MVP Lock lift; Phases 2–3 require it again at their own spec approval. Nothing in this spec authorizes code changes by itself.

## Acceptance (Phase 1 — checked only with dated evidence)

- [ ] Gates green: `pnpm --filter web typecheck` / `lint` / `test`, shared typecheck.
- [ ] RLS test evidence: anon transcript RPC returns only opted-in profiles' payloads, no PII fields (asserted).
- [ ] Cooldown blocks an in-window retake and the zero-default path is unchanged (unit-tested).
- [ ] Official quiz without a grant is blocked with CTA; request → approve → attempt flow completes (e2e).
- [ ] Track item locked until previous item complete (e2e).
- [ ] `/verify/[username]` renders DB attempts; shareable link works logged-out.
- [ ] i18n ar/en key parity for `verify`, `assessmentGrants`, `tracks`.
- [ ] `AGENTS.md` ledger row updated to Merged on landing.
