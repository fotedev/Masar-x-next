# Spec 049 — Zane server-backed chat history: conversations + restore

| Field | Value |
|---|---|
| Status | Approved (owner plan approval 2026-11-14, in-session) |
| Type | feat — queue item 1 of the post-048 ZANE queue (tracking #244) |
| Origin | GitHub issue #238 (prerequisite for the #239 chat-history side menu) |
| Base | `origin/main` @ `6d3f3b2` (worktree `../masarx-wt/feat-049`, branch `feat/049-zane-chat-history`) |
| Migrations applied | `20261114132141_zane_conversations` + fix-forward `20261114132536_zane_conversations_ownership_fk` (prod ledger, repo files 1:1) |

## 1. Context & problem statement

Signed-in Zane users already have server-backed history, but only as **one undifferentiated stream per mode**: `ai_chat_messages` rows keyed by `(user_id, mode)` with a 100-row overflow prune and scroll-up pagination (`apps/web/src/hooks/useAiChat.ts`, `apps/web/src/lib/chat-pagination.ts`). There is no conversation identity anywhere — a new chat is indistinguishable from a continuation, no list exists, no per-conversation delete, and `conversationId` in the mobile/edge request contract is a per-message UUID that is logged and discarded (`supabase/functions/ai-chat/index.ts`).

Issue #238 asks for the conversation entity: `conversations` + message linkage, owner-only RLS, paged list, full restore, switch/delete semantics — as the data layer the #239 side menu will consume. The audit also surfaced that the admin dashboard's message KPIs read `ai_chat_messages` directly (`apps/web/src/app/api/admin/metrics/route.ts:57,79`), and the name `messages` is already taken by a legacy baseline chat table — both constrain the design.

## 2. Design decisions

Ratified with the owner at plan approval (2026-11-14):

1. **Evolve `ai_chat_messages`, do not fork a new message store.** New `conversations` table + nullable `conversation_id` FK on the existing table (spec-038 anchoring pattern). One live store keeps pagination/prune/RLS/indexes working, preserves the admin message KPIs untouched, and avoids a dual-write cutover. (The literal issue wording "conversations + messages tables" is realized as `conversations` + the evolved `ai_chat_messages`; a new table named `messages` is impossible — legacy `public.messages` exists since baseline.)
2. **Backfill.** The migration creates one untitled conversation per existing `(user_id, mode)` and links every row. Deploy-day behavior is unchanged; old history shows up as untitled legacy conversations in the future #239 list.
3. **Caps.** 100 messages per conversation (`CHAT_HISTORY_CAP` re-scoped from per-mode to per-conversation, guest-cache parity). No conversation-count cap this round.
4. **Titles.** Client-side: title = first user message, trimmed and truncated to ~60 chars with ellipsis, written once at conversation creation. Legacy/backfilled conversations have `title NULL`; the localized fallback label lands with #239's list UI.
5. **Mobile parity: queued.** Mobile chat is still AsyncStorage-only by design (`apps/mobile/src/lib/chat-history.ts:19` header: "DB sync to ai_chat_messages is a later spec"); consuming server conversations there is a separate later spec. The edge function `ai-chat` is untouched (owner-owned; `conversationId` in its contract remains logging-only).
6. **No edge functions.** All reads/writes are client-side Supabase queries under RLS, matching `useAiChat` conventions (plain state hooks, no TanStack).
7. **Mode-scoped list.** `conversations` carries `mode`; the list hook takes a mode filter. Whether #239's UI shows all modes or filters is its own decision.
8. **No new i18n keys in this PR** (I3): no user-facing UI ships here — zero new strings. #239 owns the list-UI keys (en+ar in the same commit per the parity test).

## 3. Architecture & design

### 3.1 Supabase — single additive migration (applied via `supabase-masarx` MCP; repo file named 1:1 with the returned ledger version, timestamp > `20261111090000`)

**New table:**
```sql
CREATE TABLE public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('cs_assistant','student_agent','group_rag')),
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_conversations_user_mode_updated
  ON public.conversations (user_id, mode, updated_at DESC);
```

**Triggers (baseline functions reused; DROP TRIGGER IF EXISTS before CREATE — house idempotency):**
- `set_conversations_updated_at` BEFORE UPDATE → baseline `set_updated_at()`.
- `tr_audit_conversations_changes` AFTER UPDATE OR DELETE → baseline `audit_table_changes()` (low-volume, owner-meaningful: conversation deletion is a destructive act worth a who/when trail).
- `ai_chat_messages` gains `updated_at` + trigger `set_ai_chat_messages_updated_at` (spec-037 pattern). **No audit trigger on `ai_chat_messages`** — delete-heavy (overflow prune ~100 rows, clearChat) would flood `audit_logs`; same rationale as spec-037's `quiz_questions` exclusion.
- New function `touch_conversation_updated_at()` (SECURITY INVOKER, fully qualified names) + trigger `tr_touch_conversation_updated_at` AFTER INSERT ON `ai_chat_messages` WHEN `NEW.conversation_id IS NOT NULL` → bumps the parent conversation's `updated_at`. Server-authoritative "last activity" drives list ordering and the current-conversation pick without extra client round-trips; the inserting user owns the row so the owner-UPDATE RLS policy passes.

**RLS (snake_case, all `TO authenticated`, DROP POLICY IF EXISTS before CREATE):**
- `conversations_select_own` USING (`user_id = auth.uid()`)
- `conversations_insert_own` WITH CHECK (`user_id = auth.uid()`)
- `conversations_update_own` USING + WITH CHECK (`user_id = auth.uid()`)
- `conversations_delete_own` USING (`user_id = auth.uid()`)
- No anon policies. `ai_chat_messages` RLS is untouched.

**Evolution of `ai_chat_messages` (additive-only):**
```sql
ALTER TABLE public.ai_chat_messages ADD COLUMN IF NOT EXISTS conversation_id uuid;
-- ownership-binding composite FK (fix-forward migration 20261114132536):
-- UNIQUE (id, user_id) on conversations + pair FK. A single-column FK would
-- let a user attach messages to ANOTHER user's conversation — messages RLS
-- checks only user_id, so the pair FK is the enforcement that keeps a
-- message structurally inside its owner's conversations.
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_id_user_key UNIQUE (id, user_id);
ALTER TABLE public.ai_chat_messages
  ADD CONSTRAINT fk_ai_chat_messages_conversation
  FOREIGN KEY (conversation_id, user_id)
  REFERENCES public.conversations (id, user_id) ON DELETE CASCADE;
CREATE INDEX idx_ai_chat_messages_conversation_created
  ON public.ai_chat_messages (conversation_id, created_at);
```
`conversation_id` stays nullable (additive-safe); all new client writes populate it. Cascade delete: deleting a conversation removes its messages — the per-conversation delete path needs no second statement. This also hardens acceptance criterion 4 beyond RLS: writing into another user's conversation is impossible even for a client that games the message `user_id`.

**Backfill (naturally idempotent via the `IS NULL` predicate):**
```sql
INSERT INTO public.conversations (user_id, mode)
SELECT DISTINCT user_id, mode FROM public.ai_chat_messages WHERE conversation_id IS NULL;

UPDATE public.ai_chat_messages m
SET conversation_id = c.id
FROM public.conversations c
WHERE m.conversation_id IS NULL
  AND c.user_id = m.user_id AND c.mode = m.mode;
```
Backfilled conversations carry `title NULL`, `created_at/updated_at = migration time`; restore-side ordering still resolves correctly via message `created_at`.

**RLS verification** — `supabase/tests/rls-verify.sql` harness section 3.12: own conversation insert/message-attach/update/delete + FK cascade (positive); cross-user SELECT returns zero, INSERT rejected, UPDATE/DELETE no-op; **cross-user message attach rejected by the ownership FK** (`foreign_key_violation`) (acceptance criterion 4, spec-040-style review).

### 3.2 Types (I2)

- Regenerate `packages/shared/src/types/database.generated.ts` (MCP `generate_typescript_types` after the prod apply — the file is a prod-schema snapshot).
- Hand-written aliases in `packages/shared/src/types/database.ts`: `Conversation`, `ConversationInsert` (regen-safe, per house rule).

### 3.3 Web client (apps/web)

**New `apps/web/src/lib/chat-conversations.ts` (pure helpers):**
- `deriveConversationTitle(firstUserMessage: string): string | null` — trim, collapse, truncate ~60 chars + ellipsis; empty/whitespace → `null`.
- `pickCurrentConversation(rows: Conversation[]): Conversation | null` — max `updated_at` (deterministic tiebreak on `id`).
- Reuses `CHAT_PAGE_SIZE` / `CHAT_HISTORY_CAP` / `nextOlderRange` from `chat-pagination.ts` (cap semantics now per-conversation).

**New `apps/web/src/hooks/useConversations.ts` (read side, consumed by #239):**
- Args: `user: User | null | undefined, mode: AiAssistantMode`.
- Returns `{ conversations, hasMore, loading, loadMore, refresh }`; paged `.eq("user_id").eq("mode").order("updated_at", desc).range(...)`; short page terminates `hasMore`; errors → `logger.error` + empty list; no writes ever.

**`apps/web/src/hooks/useAiChat.ts` (modify — conversation awareness alongside the guest cache):**
- Signed-in restore effect: pick current conversation for `(user, mode)` via `pickCurrentConversation` (none → empty messages, `conversationId = null`), then load its messages newest-page (`.eq("conversation_id", id).order("created_at", desc).range(0, CHAT_PAGE_SIZE - 1)`, `.reverse()`). `loadOlder` becomes conversation-scoped (`.eq("conversation_id", id)`), same `nextOlderRange` walk.
- `sendMessage` (signed-in): `ensureConversation()` — when no conversation, INSERT `conversations {user_id, mode, title: deriveConversationTitle(content)}` `.select("id").single()`; both this INSERT and the message inserts remain **fire-and-forget** (failure logs, never blocks the UI — same contract as today's `insertChatRow`). Message inserts carry `conversation_id`; `pruneChatOverflow` re-scoped `.eq("conversation_id", id)`.
- New API: `switchConversation(id)` — loads that conversation's transcript (newest page + existing `loadOlder`); `deleteConversation(id)` — DELETE conversation row (FK cascades messages), resets transcript if current.
- `clearChat` (signed-in) now deletes the **current conversation** (was: whole per-mode thread). UX-neutral today (no list UI exists yet; the cleared transcript empties and the next send starts a fresh conversation). Guests: unchanged `localStorage.removeItem`.
- Desktop `AssistantPanel.tsx` inherits everything via the shared hook — no changes.

### 3.4 Persistence policy (repo lesson 2026-09-16 #14 — same write policy as the guest cache)

Server writes happen **only at the existing event sites**: user-message insert (send), assistant insert (finalize); conversation creation only inside `sendMessage` (event-driven, lazy — no empty conversation rows). **Zero writes** on mount, restore, mode switch, auth transition, list loads, or stream deltas. Deletion is exclusive to explicit `clearChat` / `deleteConversation`. The `pendingPersistRef` guest path is byte-for-byte unchanged.

## 4. Behavior preservation & regression strategy

- **Guests**: untouched localStorage policy (per-mode keys `ai_assistant_chat_messages_<mode>`, event-driven writes, cap 100, deletion exclusive to clearChat). The existing `useAiChat.test.tsx` guest locks must pass **unmodified**.
- **Signed-in, no UI**: reload restores the most-recent conversation of the mode — identical transcript to today's per-mode thread for anyone who never had multiple conversations. Mode switching still swaps threads. Admin KPIs unchanged (same table, same `role='assistant'` rows).
- **Error bubbles** remain local-only (never server-persisted), as today. Mode-switch mid-stream still discards the response (existing guard).
- The `user === undefined` defensive guards stay dead code as documented (AuthContext types `user: User | null`).

## 5. Test specification

- `useAiChat.test.tsx` (extend): first signed-in send creates a conversation (INSERT with derived title) then a message insert carrying `conversation_id`; restore picks newest conversation + loads its messages; `switchConversation` swaps transcripts; `deleteConversation` removes server-side + resets client state; prune probes/deletes scoped to the conversation; event-driven locks preserved (zero writes on mount/auth-transition/mode-switch); guest suites green unmodified.
- `useConversations.test.tsx` (new): paging ranges, `loadMore` termination on short page, `refresh`, error → empty.
- `chat-conversations.test.ts` (new): title derivation (trim/truncate/ellipsis/empty), `pickCurrentConversation` ordering + tiebreak.
- `rls-verify.sql` additions (§3.1).

## 6. Atomic execution plan

See [plan.md](./plan.md). Commits:
1. `docs(specs): add spec 049 — zane server-backed chat history`
2. `feat(db): conversations table + ai_chat_messages.conversation_id (spec 049)`
3. `chore(types): regenerate database.generated.ts for conversations (spec 049)`
4. `feat(web): conversation-aware chat persistence + list/switch/delete (spec 049)`

## Aftermath (CI-surfaced interaction fix, same PR)

The CI prod-build e2e exposed a pre-existing fragility in the chat scroll hook that this PR's timing shift tipped into a deterministic failure (chat opened ~568px above the newest message, jump pill up; stable across retries, unreproducible locally on Windows — CI traces show the "Scroll to latest" pill rendered at failure). Mechanism: Chrome's scroll anchoring delivers its scroll event BEFORE the ResizeObserver callback for the same reflow; a late-arriving asset (markdown chunk, fonts, hero media metadata) reflows the transcript after the one-shot stick, the measured distance flips `isNearBottom`, and the open view strands because every later re-pin is gated on near-bottom. Fix in `useChatScroll.ts`: an open-sequence grace window — until real user intent (wheel/touch/key/pointer) or an UPWARD scroll (anchoring while pinned only adjusts downward, so upward is always navigation), any content OR scroller resize re-pins to the bottom; the scroller itself is now observed too (header media settling shifts the distance math without touching the observed content child). Unit-tested in `useChatScroll.test.tsx` (anchoring-flip simulation, grace termination, near-bottom semantics preserved). Out-of-scope items below are unchanged.

## Out of scope (queued, not dropped)

- #239 side menu + Muse-style avatar home (list UI, "new chat", localized untitled/legacy labels, i18n keys).
- #240 interim avatar shrink.
- Mobile consuming server conversations (separate later spec).
- Scheduling the unscheduled 30-day `delete_old_ai_chat_messages()` retention (owner pg_cron call) and any conversation-count cap.
- Edge-function changes of any kind (owner-owned deploys; #242 handles prompt hardening).
