# Spec 008 — Chat Persistence Hardening

> **Status: APPROVED 2026-09-18 (owner approval, I11 — incl. direct prod application of the migration).**
> Prepared 2026-09-17 after the owner asked how chat saving works and whether the free Supabase plan can take it (~5000 users).
> **Live-DB ground truth at approval (2026-09-18 introspection):** the out-of-band `ai_chat_messages` table already matches this spec's column contract exactly (id/user_id/role/content/mode/created_at, FK→auth.users cascade, role CHECK, RLS enabled; 35 rows, all `cs_assistant`). Gaps this spec closes: no `mode` CHECK, no composite `(user_id, mode, created_at)` index, policies `TO public` instead of `TO authenticated`, unbounded load, no prune, untyped rows.

## 1. Context & problem statement

Chat persistence is ALREADY hybrid and working: authenticated users get per-message rows in `ai_chat_messages` (insert on send, full reload on open, delete on clear — `useAiChat.ts`), keyed by `user_id` + `mode` (each of the three personas has its own thread; switching persona reloads). Guests get localStorage per persona (`ai_assistant_chat_messages_{mode}`). No decision between "cache vs database" is needed — the open risks are:

1. **`ai_chat_messages` has no migration in the repo** — the table was created out-of-band (only an `ENABLE ROW LEVEL SECURITY` line exists in `migrations.old/`). Columns, policies, indexes are untracked (violates I2); if RLS policies are missing/wrong, history silently loads empty.
2. **Unbounded history load** — `.select("*")` with no limit fetches every row since forever; that — not the 5000-user count — is the real free-tier (500MB) risk.
3. **No retention cap** — one chatty user can grow their footprint indefinitely.
4. **Fire-and-forget inserts** (`.then()` discarded) + no `ai_chat_messages` Row type in `packages/shared/src/types/database.ts`.

Capacity estimate (Arabic message ≈ 1–2 KB): realistic semester load (~1000 active of 5000 × ~100 msgs) ≈ 100–200 MB — comfortable, PROVIDED a cap exists.

## 2. Architecture & design

- `supabase/migrations/009_ai_chat_messages.sql`: `CREATE TABLE IF NOT EXISTS public.ai_chat_messages` (id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, role text not null check in ('user','assistant'), content text not null, mode text not null check in ('cs_assistant','student_agent','group_rag'), created_at timestamptz default now()); index `(user_id, mode, created_at)`; RLS enabled with `SELECT/INSERT/DELETE ... TO authenticated USING/WITH CHECK (auth.id() = user_id)` — no anon access. Written defensively (IF NOT EXISTS / policy drops) since the table already exists out-of-band.
- Load path (`useAiChat.ts`): `.order("created_at asc").limit(100)` — last 100 messages per user+mode.
- Retention: after each assistant insert, delete rows beyond the newest 100 for that (user_id, mode) — single supabase delete using `created_at < (select created_at ... order desc limit 1 offset 99)` pattern or an RPC; prefer the plain two-query prune for clarity.
- Guest cache: cap saved array at last 100 messages; wrap `localStorage.setItem` in try/catch (quota).
- Inserts: `.then(({error}) => { if (error) console.warn(...) })` — never throw into chat flow.
- Types: add `ai_chat_messages` Row to `packages/shared/src/types/database.ts`; replace the ad-hoc `SupabaseChatMessage` in the hook.
- `conversation_id` (multi-thread per persona): **deferred** — add a nullable column later; no UI commitment pre-MVP (YAGNI).

## 3. Behavior preservation & regression strategy

No schema change that the current code can detect: same table/columns the hook already uses (migration is additive/defensive). Load/insert/clear flows keep their signatures; only limits and error handling are added. Guest cache semantics unchanged except the 100-message cap. Manual smoke: guest chat → reload → restored; auth chat → reload → last 100 restored; clear → rows deleted.

## 4. Test specification

- Migration applies cleanly on a DB where the table already exists (defensive DDL) and on a fresh one.
- RLS: anon select/insert denied; owner select/insert/delete allowed (service-role bypasses).
- Prune: insert 105 rows → oldest 5 pruned, newest 100 readable.
- Unit: guest save caps at 100; quota throw is swallowed.

## 5. Atomic execution plan

1. `feat(db): track ai_chat_messages — table, rls, index (009)` + verify against live DB (§8 gates).
2. `feat(web): cap chat history load to last 100 + prune beyond` (hook changes) — tsc/lint/vitest + smoke.
3. `feat(web): guest cache cap + typed ai_chat_messages row` (types + localStorage cap).
