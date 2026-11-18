# Spec 049 — Plan

## Phase 1 — Worktree + spec (done at spec approval)

1. `git worktree add ../masarx-wt/feat-049 -b feat/049-zane-chat-history origin/main` (fresh fetch; origin/main `6d3f3b2`). All file/shell work pinned to the worktree path (I14).
2. Write `specs/049-zane-chat-history/{spec.md,plan.md}` → commit `docs(specs): add spec 049 — zane server-backed chat history` (machine identity only — I15; hooks live outside the repo via `core.hooksPath`).

## Phase 2 — Migration (prod apply first, repo file 1:1)

1. Confirm the `supabase-masarx` MCP is on the Masar-x project (`jcufigozkhxazjbwhjjm`) before any write (credential-handling rule).
2. Draft the additive SQL per spec §3.1 (conversations table + RLS + triggers incl. `touch_conversation_updated_at`, `ai_chat_messages.conversation_id` FK + index + `updated_at`, backfill).
3. Apply via MCP `apply_migration` → take the returned ledger **version** → write the repo file `supabase/migrations/<version>_zane_conversations.sql` with identical content.
4. Catalog verification via MCP SQL: table/columns/indexes/triggers/policies present; backfill counts match `SELECT count(*) FROM (SELECT DISTINCT user_id, mode FROM ai_chat_messages)`; pre-existing row count unchanged.
5. Extend `supabase/tests/rls-verify.sql` (spec §3.1 assertions).
6. Commit `feat(db): conversations table + ai_chat_messages.conversation_id (spec 049)`.

## Phase 3 — Types

1. Regenerate `packages/shared/src/types/database.generated.ts` via MCP `generate_typescript_types`; confirm `conversations` + `ai_chat_messages.conversation_id/updated_at` appear.
2. Add `Conversation`/`ConversationInsert` aliases to `packages/shared/src/types/database.ts`.
3. Commit `chore(types): regenerate database.generated.ts for conversations (spec 049)`.

## Phase 4 — Web client implementation

1. `apps/web/src/lib/chat-conversations.ts` (pure helpers) + `apps/web/src/lib/__tests__/chat-conversations.test.ts`.
2. `apps/web/src/hooks/useConversations.ts` + `__tests__/useConversations.test.tsx`.
3. `apps/web/src/hooks/useAiChat.ts`: conversation-aware restore/send/prune/switch/delete/clear per spec §3.3; extend `__tests__/useAiChat.test.tsx` (guest locks stay unmodified).
4. Gates (08-precommit): `pnpm install` in the worktree (fresh tree), then web `typecheck` + `lint` + **full** vitest suite; shared tests if types/aliases touched. Any post-verification edit ⇒ re-run the FULL suite.
5. Commit `feat(web): conversation-aware chat persistence + list/switch/delete (spec 049)`.

## Phase 5 — PR

1. Push branch; `gh pr create` (title `feat(zane): server-backed chat history — conversations + restore (spec 049)`, body: closes #238, references #244 item 1, design-decision summary, migration ledger version, RLS notes).
2. Wait for CI green (no bypass — I16). Check the ruleset's update-branch requirement if conflicts appear (spec-033 lesson).
3. **Stop and show the PR.** Owner merges (queue rule: owner approves merges unless told otherwise); tracking-issue checkbox updated by owner directive when the item lands.

## Verification

- Migration: catalog checks + `rls-verify.sql` additions + backfill count equality.
- Web: full vitest green (guest locks unmodified = behavior preservation proof), typecheck, lint.
- Acceptance criteria #238 1–4 cross-checked against hook tests + RLS SQL before the PR body is finalized.
