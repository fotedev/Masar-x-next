# Spec 051 — Zane chat-history side menu + Muse-style avatar home

**Issue:** #239 (ZANE queue item 2, Lane A — tracking #244)
**Type:** feature (spec-first)
**Status:** approved for implementation on this branch (owner, 2026-11-18 — same-branch flow: spec amendments + implementation commits join PR #254; single squash merge)
**Depends on:** #238 / spec 049 (PR #245) — the server-backed conversation data layer. **MERGED 2026-11-17 (`482beec74`)**; this branch synced with main via a regular merge commit (no history rewrite, I16).

## 1. Context & problem statement

Owner's design intent (2026-11-13): "make it just a circle and side menu for zane chat history." The docked avatar stack (avatar + name + status, ~180px, interim-shrunk by #240/PR #250) is a placeholder; the avatar's permanent home becomes the **side-menu header** (Muse/ChatGPT pattern: circle + name + status inside the panel), and conversations get a switchable list.

Spec 049 built the data layer and explicitly deferred the UI (`useAiChat.ts` on #245: "side menu consumes these in the spec-049 follow-up; no UI ships in 049 itself"):
- `useConversations(user, mode)` → `{ conversations, loading, hasMore, loadMore, refresh }` — paged list (20/page), mode-scoped.
- `useAiChat` → `conversationId` (active identity), `switchConversation(id)` (seq-guarded restore), `deleteConversation(id)` (server delete + FK cascade; resets the transcript when it is the active one).

Surfaces verified on main (2026-11-15):
- Page shell `app/[locale]/ai-assistant/page.tsx`: `AIErrorBoundary > flex h-full min-h-0 flex-col [ChatHeader?] > [relative flex-1: ChatContainer + jump pill] > ChatInput` — the panel becomes a sibling of the chat column inside a row wrapper.
- Empty-state hero (`ChatContainer.tsx:141-230`): centered 128px idle avatar + brand + suggestion cards — this is already the avatar "home" for the initial state and stays untouched.
- `ZaneStatusAvatar.tsx`: one node, two presentations — floating pill (max-lg) + docked block (lg+). The docked presentation is removed by this spec; the floating one stays.
- i18n `aiAssistant` namespace already has `assistantName`, `statusConnected`, `statusWorking`, `noTitle` (049's untitled fallback). Panel-specific keys are new (en+ar).
- Existing drawer precedents: `components/header/MobileNav.tsx`, `components/admin/FilterBottomSheet.tsx` (overlay patterns; note the backdrop-filter containment lesson — overlays must not live inside `backdrop-blur` ancestors).

## 2. Architecture & design

### Design decision D1 — Panel placement in the page shell (vetoable default)

The page's outer container becomes, at lg+, a row: chat column (existing `flex-col` content, unchanged) + `ConversationPanel` rendered **last** so a plain `flex-row` mirrors it to the end-side in RTL automatically (`flex-row` reverses child order under `dir="rtl"`; no `isRTL` branching needed). Narrow viewports keep today's single-column layout.

- `ConversationPanel`: `hidden lg:flex lg:w-72 shrink-0 flex-col border-s …` — logical `border-s` so the border faces the chat column in both directions.
- No collapse toggle in v1 (fixed panel; note if the owner wants one).

### Design decision D2 — Panel header = the avatar's permanent home (vetoable default)

Panel header: compact `ZaneAvatar` circle (h-10 w-10) + `assistantName` + status line (`statusConnected`/`statusWorking` with the existing icon pattern), driven by the page's `isLoading` (same prop the docked stack got). The **docked stack in the chat column is deleted** — `ZaneStatusAvatar`'s `lg:` presentation and its `lg:pointer-events-auto` go away; the component becomes floating-overlay-only (max-lg). Acceptance #2 satisfied: the avatar appears once per surface — floating pill on mobile, panel header on desktop, hero on the empty state.

### Design decision D3 — Conversation list + actions (vetoable default)

- Rows: `noTitle`-fallback title + short `updated_at`; active row highlighted via `conversationId` match; click → `switchConversation(id)`.
- **New chat**: `useAiChat` gains `startNewConversation()` — the same transcript-transition discipline as `clearChat` minus deletes: bump `lifecycleRef` (an in-flight streamed reply is dropped from the UI — CodeRabbit pre-approval note; it still persists server-side to its originating conversation, exactly like switch semantics), reset messages/counters, `setCurrentConversation(null)`, clear `conversationEnsureRef` + `orphanConversationRef`, `setIsReady(true)`. Zero writes (event-driven rule intact): the next `sendMessage` creates the fresh conversation via the existing ensure chain; the panel calls `refresh()` after the reset so a materialized in-flight conversation shows up. Header button (plus icon).
- **Delete**: per-row trash icon → existing confirm-toast pattern → `await deleteConversation(id)` then `refresh()` (one re-query; simplest correct list sync).
- **Pagination**: `loadMore()` on the panel scroller approaching its end (`hasMore` gate) — the panel owns its own `overflow-y-auto`; the transcript scroller and its spec-012/scrollbar logic are untouched (separate scrollers).
- Wire-through: the page (which owns `useAiChat`) passes the conversation API + `useConversations` state to the panel as props — no new context/store.

### Design decision D4 — Mobile counterpart: drawer with the same list (vetoable default)

`<lg`: a **floating history icon button at the top-start overlay** (`lg:hidden absolute top-3 start-3 z-20`, mirroring the top-center avatar pill) opens a drawer (slide-in from the panel side, RTL-aware via start/end) hosting the **same `ConversationList`** with header D2. (Owner decision 2026-11-18: `ChatHeader` renders only when `!isInitialState` and only for student_agent mode / generatedQuiz — the default `cs_assistant` mode and the empty state have no header at all, so the toggle needs a home that is always reachable.) Drawer follows the MobileNav overlay pattern with a portal to `document.body` (never a `fixed` overlay inside a `backdrop-blur` ancestor — repo lesson): backdrop click + document-level `pointerdown` containment-check dismissal, Focus/Escape handled, body scroll lock while open.

### Design decision D5 — Auth boundary (vetoable default)

Conversations are server-backed (049): guests have no conversation list. Guests see the panel with a sign-in hint (`signInToSeeHistory`) on desktop; the mobile drawer toggle renders only for signed-in users. Sign-in flows reuse the existing puter/auth surfaces — no new auth code.

### Design decision D6 — Persistence rules untouched (repo lesson 2026-09-16 #14)

Switch/delete/new are explicit user events — the only new write path is none: `deleteConversation` already exists; `startNewConversation` writes nothing. Mount/auth-transition/mode-switch still write nothing; deletion stays exclusive to the explicit delete/clear actions (049 semantics: `clearChat` deletes the active conversation — the panel reflects the resulting state via `conversationId`).

### Design decision D7 — i18n (en+ar, I3)

New keys in `packages/shared/src/messages/{en,ar}/aiAssistant.json`: `chatHistory` (panel title/aria), `newChat`, `deleteConversation`, `deleteConversationConfirm`, `noConversations`, `signInToSeeHistory`, `loadingConversations`. Header reuses `assistantName`/`statusConnected`/`statusWorking`/`noTitle`.

### Design decision D8 — States

Loading → skeleton rows; empty → `noConversations` hint + new-chat affordance; error → reuse the list's silent-empty behavior (`useConversations` already swallows errors to empty) with a retry via `refresh`.

## 3. Behavior preservation & regression strategy

- The chat column, transcript scroller, `useChatScroll`, scrollbar, jump pill, hero, and all persistence flows are untouched except the one-line removal of the docked `ZaneStatusAvatar` render at lg+ (its floating presentation stays).
- Guests see exactly today's behavior minus the docked stack (mobile) plus a sign-in hint (desktop panel).
- Full web vitest stays green; existing ChatContainer/ZaneStatusAvatar/useAiChat/useConversations suites pass with the adjustments in §4.

## 4. Test specification

1. **ConversationPanel.test.tsx**: renders rows from mocked `useConversations` (title fallback via `noTitle`), active-row highlight from `conversationId`, click → `switchConversation`, delete → confirm → `deleteConversation` + `refresh`, new-chat → `startNewConversation`, skeleton while loading, empty state, guest sign-in hint, `loadMore` near scroller end.
2. **Drawer test** (<lg): floating top-start toggle opens the drawer hosting the same list; containment-dismiss + Escape close; toggle hidden for guests; selection closes the drawer.
3. **Page-shell test / class assertions**: panel is `hidden lg:flex`, end-side via flex order, chat column keeps `flex-1 min-h-0`.
4. **useAiChat.test.tsx**: `startNewConversation` resets state, bumps the transcript lifecycle generation (an in-flight streamed reply must not paint into the emptied transcript), writes nothing (asserts the no-write invariant from the mock write-log), and the next `sendMessage` creates a new conversation (ensure chain re-arms).
5. **ZaneStatusAvatar.test.tsx**: docked-lg assertions replaced by floating-only assertions (no `lg:h-24` anymore — the component no longer renders docked).
6. **i18n drift check** (existing MESSAGE_NAMESPACES test covers key parity en↔ar automatically).

## 5. Atomic execution plan (commits — #245 merged; branch synced with main via merge `a6576e7`)

| # | Commit | Contents | Gates |
|---|---|---|---|
| T1 | `feat(zane): startNewConversation in useAiChat (spec 051)` | hook addition + tests | targeted vitest + typecheck + lint |
| T2 | `feat(zane): ConversationList + ConversationPanel (spec 051)` | panel components + header (avatar home) + i18n keys + tests | FULL web vitest + typecheck + lint |
| T3 | `feat(zane): wire panel into the page shell; drop docked stack (spec 051)` | page shell row + docked-stack removal + drawer (<lg) + tests | FULL web vitest + typecheck + lint |
| T4 | `feat(zane): conversation drawer for narrow viewports (spec 051)` | (if not folded into T3) drawer + tests | FULL web vitest + typecheck + lint |

Final gate: FULL web vitest + typecheck + lint green after the last commit (re-run after any post-verification edit); local prod-build e2e for the chat screen recommended (chat-touching change).

## 6. Out of scope

- Renaming/editing conversation titles, search, pinning, folders.
- `apps/mobile` parity (queued, 049 pattern — the web drawer is the mobile-web answer).
- Panel collapse/resize toggle (v1 fixed width; vetoable).
- Moving the empty-state hero (it stays the avatar home for the initial state).
- Any change to the persistence/event rules or the restore pick (049 semantics stand).

## Aftermath

Landed on this PR (spec + implementation, one squash merge):
- `docs(specs)` — owner-approved amendments: D3 gains the `lifecycleRef` bump (CodeRabbit pre-approval note), D4 toggle = floating top-start icon.
- `feat(zane): startNewConversation in useAiChat` — T1: clearChat minus the deletes, generation-bumped, zero writes.
- `feat(zane): ConversationList + ConversationPanel` — T2 + locale-aware relative timestamps (new `lib/conversation-time.ts`).
- `feat(zane): wire side panel into the page shell; drop docked stack` — T3: lg+ row (panel last → RTL mirror), spinner inside the chat column, floating-only avatar.
- `feat(zane): conversation drawer for narrow viewports` — T4: portaled end-side drawer on the admin-drawer pattern; selection/fresh-start close it.

Gates: web vitest 93 files / 1103 tests green (main baseline 92/1096) + shared messages parity 102 green; typecheck + lint (0 errors, baseline warnings); e2e `ai-chat-history` + `ai-chat-send` green against a fresh dev server of this branch. Page-shell class assertions live in the ConversationPanel/drawer unit tests + the e2e — the page itself has no unit test (its dynamic ssr:false modals make jsdom hosting heavy; the e2e covers the shell).
