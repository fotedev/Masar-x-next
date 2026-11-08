# Spec 041 — Execution Plan

## PR-A `refactor/dedupe-and-chat-errors` (first — web/lib file overlap with PR-B)

Worktree `../masarx-wt/refactor-dedupe` from `origin/main`.

1. **puter dedup** — canonical `isPuterTransportError` in `lib/ai/errors.ts` with the union predicate (both lists merged deliberately); `lib/puter.ts` imports it. `PUTER_UNAVAILABLE_UNTIL_KEY` exported once from `lib/ai/circuit-breaker.ts`, imported by `lib/puter.ts` + `lib/ai/puter-client.ts`. `lib/ai/assistant.ts:546` `getPuterStatus` delegates to `lib/puter.ts`'s canonical shape; `useAiChat` consumer adapted.
2. **P1.10** — `lib/ai/puter-client.ts` `extractPuterChatText` returns `null` on error-object responses (instead of the error string) so `assistant.ts` treats the exchange as failed and routes to the error path. Adjust the canned-prefix heuristic only if needed.
3. **academic dedup** — `useAcademicOptions.ts` extends `lib/academic-utils.ts` types instead of redeclaring; shared select builder.
4. **ContentItem dedup** — canonical in `hooks/useLectureContent.ts`; `components/subject/lecture-detail/types.ts` becomes a Pick/Omit projection.
5. **locale dedup** — `useSwitchLocale()` hook; consumed by `LanguageToggle.tsx` (+ MobileNav via Header) and `admin-shell/Sidebar.tsx`.
6. **shared** — `schemas.test.ts` "rejects invalid status"; fix `__tests__-guard.test.ts:48-50` nonexistent-allowlist-path.

Verify: `pnpm --filter web lint`, `pnpm -r typecheck`, `pnpm -r test`, e2e `study-flow` + `guest-quiz`.

## PR-B `fix/i18n-batch`

Inventory-driven (2026-11-08 verification, ~30 files). Reuse existing namespaces in `packages/shared/src/messages/{ar,en}/`; add keys to both locales. Mechanical files via subagents (waves of 2, disjoint). I write: `useQuizzesData.ts` `["صح","خطأ"]` (value-keyed map — strings are equality-COMPARED), `useAiChat` canned guard content, `lecture-inference.ts` (display-time translation; stored values unchanged), `useQuizzes.ts` native confirm → `confirmToast`.

Verify: lint ratchet, check-translations, parity tests, inventory grep = 0.

## PR-C `fix/db-followups`

- `20261108xxxx_anchoring_determinism.sql` — `CREATE OR REPLACE FUNCTION public.sync_subject_id()` + `ORDER BY s.created_at NULLS LAST, s.id` (verify subjects columns first).
- `20261108xxxx_audit_retention.sql` — `prune_audit_logs(p_days integer DEFAULT 90)` SECURITY DEFINER, pinned search_path, service-role-only EXECUTE; `cron.schedule('prune-audit-logs','0 3 * * *', ...)` if pg_cron enabled (probe via MCP `list_extensions`), else documented for owner.
- `REVOKE DELETE, INSERT, UPDATE ON public.audit_logs FROM anon, authenticated`.
- Conditional course-materials enrollment scoping after prod naming probe.

## PR-D `fix/desktop-conn-probe`

- `server.ts`: poll port liveness (~8s budget) + child-exit listener instead of the 500ms timeout; recovery flow in `index.ts` unchanged apart from the truthful signal.
- R18: Host check for `127.0.0.1:<port>` in web middleware (check existing middleware first).

## PR-E `ci/deps-audit-job`

`deps-audit` job: `pnpm audit --prod --audit-level=high` (+ document accepted findings if any). Pin `fallow-rs/fallow@v3` and `treosh/lighthouse-ci-action@v12` to SHAs.

## Close-out

seed.sql local fix → SUMMARY.md reconciliation → memory → final report (owner-gated list).
