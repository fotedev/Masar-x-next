# Tasks: 008_chat-persistence-hardening

> Gates for every code task: `pnpm typecheck` · `pnpm lint` (ratchet 52) · `pnpm -r --if-present test` · `bash .github/scripts/check-translations.sh` · `node .agents/agents/verify_i18n.mjs` (no NEW hardcoded-Arabic hits). Migration tasks additionally re-run `node scripts/audit-rls.mjs` (G3.1 protocol: re-audit after any RLS change). Hard boundary: never stage the owner's uncommitted files (`Footer.tsx`, `LanguageToggle.tsx`, `admin-shell/Sidebar.tsx`, `FooterDeveloper.tsx`, `en/aiAssistant.json`, build artifacts) — explicit-path `git add` only.
>
> **Approved 2026-09-18** (owner: approve + apply migration to prod directly).

## 1. Migration (defensive — table already exists out-of-band in prod)

- [x] 1.1 Introspect prod `ai_chat_messages` before writing the migration (2026-09-18): columns match the spec contract exactly; RLS enabled; 3 policies (SELECT/INSERT/DELETE, `auth.uid() = user_id`, but `TO public`); indexes = pkey + `user_id` + `created_at` singles (no composite); NO `mode` CHECK. Data: 35 rows, all `mode='cs_assistant'`, no `(user_id, mode)` group over 100 rows → CHECK is safe to add without backfill.
- [ ] 1.2 `supabase/migrations/009_ai_chat_messages.sql` (number derived from disk: last was `008_jwt_role_sync.sql`): `create table if not exists` (full contract for fresh DBs), `enable row level security`, drop-and-recreate SELECT/INSERT/DELETE policies `to authenticated using/with check (auth.uid() = user_id)` (dynamic drop loop — handles the live `TO public` set), idempotent `mode` CHECK via `pg_constraint` probe, composite index `idx_ai_chat_user_mode_created (user_id, mode, created_at)`. Existing single-column indexes left in place (non-destructive; leading-column redundancy noted in the 009 checklist).
- [ ] 1.3 Apply to prod via direct SQL (approved); verify with re-introspection (policies now `TO authenticated`, CHECK present, composite index present, rows intact).
- [ ] 1.4 Re-run `scripts/audit-rls.mjs` against prod → record PASS/FAIL (addendum in `specs/009_mvp-launch-ops-hardening/checklists/rls-audit.md`); commit: `feat(db): track ai_chat_messages — defensive table/RLS/index migration (008)`

## 2. Authenticated load cap + prune + insert error handling

- [ ] 2.1 `apps/web/src/hooks/useAiChat.ts` load path: cap at 100 — `order created_at desc → limit(100) → reverse`, so the NEWEST 100 load (spec §2's literal `asc + limit` would return the OLDEST 100; §4's prune contract "oldest pruned, newest 100 readable" fixes the intent — correction recorded here per the spec's own test spec).
- [ ] 2.2 Prune after each assistant insert (two-query form per spec §2): select ids of rows beyond the newest 100 for `(user_id, mode)` (`.order desc .range(100, 199)`), delete them when present. Fire-and-forget with logged errors — never throws into the chat flow.
- [ ] 2.3 Inserts (`user` + `assistant`): `.then(({ error }) => { if (error) logger.warn(...) })` — replaces the discarded `.then()`.
- [ ] 2.4 Gates green: typecheck, lint 52/52 ratchet, web vitest, translations, verify_i18n no-new-hits → `feat(web): cap chat history load at 100 + prune overflow + surface insert errors (008)`

## 3. Types + guest cache cap

- [ ] 3.1 `packages/shared/src/types/database.ts`: add `ai_chat_messages` to `Database["public"]["Tables"]` (Row/Insert/Update, house style); `useAiChat.ts` replaces the ad-hoc `SupabaseChatMessage` with the shared Row type.
- [ ] 3.2 Guest cache helpers extracted to `apps/web/src/lib/ai/chatCache.ts` (pure, storage injected): save caps at the last 100 messages and swallows quota throws; load validates the parsed array. The event-driven `pendingPersistRef` write policy is untouched (no writes on mount/mode-switch — round-13 lesson).
- [ ] 3.3 Unit tests `apps/web/src/lib/__tests__/chatCache.test.ts`: 120→100 cap keeps the newest; quota throw swallowed; malformed JSON / non-array → null; round-trip preserved.
- [ ] 3.4 Gates green (same set as 2.4) → `feat(web): guest cache 100-cap + shared ai_chat_messages types (008)`

## 4. Regression smoke (spec §3)

- [ ] 4.1 Guest: chat → reload → restored from capped cache (manual, local dev).
- [ ] 4.2 Auth: chat → reload → history restores (now capped at newest 100); clear → rows deleted; prune deletes overflow after assistant replies (verified against prod data via introspection counts, not by writing test rows).
