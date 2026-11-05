# 14 — Analytics Pipeline & Legacy Cleanup

> Subagent auditor #14, 2026-11-02. Domain: apps/web metrics/analytics libs + api routes + legacy RPC. **Briefing corrections:** migrations are squashed — the RPC lives at `20261031000000_baseline.sql:1145`; the analytics table HAS four btree indexes (baseline.sql:3716-3719).

## Findings

### [ANALYTICS-1] Dead `get_admin_analytics_summary` RPC still granted to authenticated users

- Priority P2 · Impact M — never called by app code (grep: only the migration and generated types reference it), but it remains `SECURITY DEFINER` with `GRANT EXECUTE ... TO authenticated` and does full `auth.users LEFT JOIN public.analytics` scans if anyone invokes it. Dead privilege + perf-trap surface.
- Evidence: `supabase/migrations/20261031000000_baseline.sql:1145` (CREATE … SECURITY DEFINER, scan at :1165-1172), `:4567` (`GRANT EXECUTE ... TO authenticated`), `:4507` (only PUBLIC revoked). No app-code calls: zero hits for `rpc(` + analytics in `apps/web/src`.
- Current · Fix · Effort — function exists and is executable by any signed-in user · Add one migration: `DROP FUNCTION public.get_admin_analytics_summary();` (or minimal: `REVOKE EXECUTE ... FROM authenticated`) and drop it from `packages/shared/src/types/database.generated.ts:2674` on next typegen · Effort S.

### [ANALYTICS-2] `/api/admin/metrics` ai_chat_messages read is unbounded (fine today, grows with AI usage)

- Priority P2 · Impact M — bucketing is bounded to 14 days but has no `.limit()`; route latency and payload grow linearly with assistant-message volume. Table was 22 rows as of 2026-10-21, so this is not urgent.
- Evidence: `apps/web/src/app/api/admin/metrics/route.ts:56-63` (`.select('created_at').eq('role','assistant').gte('created_at', since)` — no `.limit()`), bucketing loop `:69-75`; the "Row counts are tiny (22 assistant rows)" justification is in the comment at `:50-53`.
- Current · Fix — fetches every assistant timestamp in 14d, buckets in-process (fast for small N) · Minimal: append `.limit(2000)`; when volume justifies it, move to a `date_trunc` count RPC or a Redis counter fed by the AI route (recordAiQuestion already exists) · Effort S.

### [ANALYTICS-3] `recordFileDownload` uses two sequential Upstash round-trips per download

- Priority P2 · Impact L — cap-gate pipeline then main pipeline means 2 REST calls per download event. Fire-and-forget (`runQuietly`), so zero user-facing latency; only cost is Upstash request count and ~1 extra RTT of serverless wall time.
- Evidence: `apps/web/src/lib/metrics.ts:114-120` (pipeline 1: `incr` cap + `expire`), then `.then(...)` builds and sends pipeline 2 at `:122-136`. By contrast `recordAiQuestion` (:148-159) and `pingActiveUser` (:170-176) are one pipeline each, and `getAdminMetrics` batches all 22 read commands into one call (:221-231) — the write path is the only multi-trip one.
- Fix: accept it (200/day cap means worst case 2 trips/user/day), or move cap+increments into a single `EVAL` script for 1 trip. Effort S (accept) / M (EVAL).

### [ANALYTICS-4] 55 dead `trackEvent` references across 12 files

- Priority P2 · Impact L — zero runtime cost (the no-op is an empty async fn), so this is pure hygiene/bundle weight; already documented as deferred cleanup, which respects the MVP Lock.
- Evidence: `apps/web/src/lib/analytics.ts:31-33` (`trackEvent` "intentionally empty"); grep `trackEvent` in `apps/web/src` = 55 hits / 12 files, heaviest: `hooks/useQuizPlayerRuntime.ts` (8), `hooks/useAnalytics.ts` (9), `login/page.tsx` (7), `StudyWorkspace.tsx` (7). The `useAnalytics` helper trio `trackSummaryView/trackSummaryClick/trackClick` (`apps/web/src/hooks/useAnalytics.ts:24-34`) is likewise dead but threaded through `HomeClient.tsx:38`, `SummariesSection.tsx:17,44,138`, `summaries/[summaryId]/page.tsx:53,111`.
- Current · Fix — plumbing threaded through `useAiChat`/quiz hooks/workspace props · When MVP Lock lifts: delete `trackEvent` param from `useAiChat` signature, drop the three summary helpers, excise call sites (~10 files, mechanical) · Effort M.

### [ANALYTICS-5] `/api/metrics/event` active_ping path has no rate limit

- Priority P2 · Impact L — a malicious authenticated client can spam `{"type":"active_ping"}`; data can't inflate (PFADD idempotent) but each POST costs one serverless invocation plus one 2-command Upstash pipeline. Downloads are capped (`metrics.ts:120`); pings are not.
- Evidence: `apps/web/src/app/api/metrics/event/route.ts:28-44` — only `requireAuthenticatedUser` + zod, no rate limiting, while the repo already has the pattern (`metrics.ts:17` mentions reusing rate-limit.ts's REST pipeline).
- Fix: reuse the existing rate-limit pattern (e.g. 60/min/user) or silently drop pings from the same `m:rl:*` key. Effort S.

### [ANALYTICS-6] `activePingSent` ref never resets on sign-out — same-tab re-login is invisible to the HLL

- Priority P2 · Impact L — metrics-accuracy nuance, not perf. A user who signs out and signs back in without a reload is never PFADDed for the new identity.
- Evidence: `apps/web/src/contexts/AuthContext.tsx:139-142` and `:190-193` (gated on `activePingSent.current`, set once, never cleared); the `SIGNED_OUT` branch at `:174-180` clears query caches but not the ref.
- Fix · Minimal: `activePingSent.current = false` in the `SIGNED_OUT` branch · Effort S.

## Healthy areas (what #152 did well)

- **One pipeline per read**: the entire admin snapshot (2 mgets of 14 keys, 2 gets, 30-day PFCOUNT, ZREVRANGE top-10, HGETALL names, LRANGE recent, plus 14 per-day PFCOUNTs = 22 commands) is a single `/pipeline` REST call — `apps/web/src/lib/metrics.ts:221-231`. Correctly indexed by `results.slice(8)` (:248).
- **Idempotent active-user metric**: per-day HLL via PFADD (`metrics.ts:166-177`) means repeat pings, retries, and even the ping-spam above cannot inflate counts — no cap logic needed by design.
- **Fail-open everywhere**: unconfigured Redis returns early (:105-106, :143-144, :167-168, :212-213); write errors are swallowed by `runQuietly` (:71-80); read errors return EMPTY_SNAPSHOT (:232-238). Analytics can never break a user flow.
- **Client ping is battery/network-friendly**: exactly one `active_ping` per app load gated by a ref (`AuthContext.tsx:139-142, 190-193`), fire-and-forget `keepalive` fetch (`metrics-client.ts:15-29`). No interval timer, no background heartbeat.
- **Hardened ingestion**: zod `discriminatedUnion` with 200/500-char bounds (`event/route.ts:16-26`), re-checked at `metrics.ts:108`, auth required, `runtime = 'nodejs'` so the Upstash token never ships to the client.
- **Postgres rescued from event-log duty**: `analytics` receives only genuine `user_login` (gated by `sawInitialSessionRef`, `AuthContext.tsx:198-209`) and `user_logout` (:326-332) — human-frequency, trivial growth; `system_logs` correctly stays on Postgres as debug telemetry (`analytics.ts:36-56`).

## Notes

- Per-event pipeline cost verified: active_ping = 1 pipeline/2 commands; AI question = 1/5; download = 2 pipelines (ANALYTICS-3). All writes async and dropped on failure.
- `user_logout` writes exist beyond the briefing's `user_login` mention — both flow through `analyticsHelpers.recordAnalytics` (`analyticsHelpers.ts:11-35`), the only remaining `from('analytics')` writer in the codebase.
- The legacy `analytics` table still holds ~1,700+ page_view rows (RPC comment at baseline.sql:1195-1199); whether to purge is a retention call for the owner.
- All findings are P2 cleanup/efficiency; nothing found blocks launch or risks user-facing latency.
