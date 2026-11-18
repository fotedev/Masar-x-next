# Plan — Spec 051 (Zane chat-history side menu + avatar home, issue #239)

Worktree: `../masarx-wt/spec-051` · Branch: `feat/051-zane-side-menu` (spec + implementation on ONE branch — owner decision 2026-11-18; synced with main via regular merge `a6576e7`, no history rewrite per I16)

## Pre-flight

- [x] #239 intent read (side menu = avatar's permanent home; docked stack disappears)
- [x] #245 data layer verified on merged main (`482beec74`): `useConversations → { conversations, loading, hasMore, loadMore, refresh }`; `useAiChat → conversationId, switchConversation, deleteConversation` + shared `lifecycleRef` transcript-generation guard (CodeRabbit Major fixes)
- [x] Page shell mapped (`page.tsx`): flex-col [ChatHeader? — only `!isInitialState` AND student_agent/generatedQuiz] → [ChatContainer + jump pill] → ChatInput → modals
- [x] Hero (ChatContainer ~141-230) = empty-state avatar home — untouched
- [x] Drawer precedents: MobileNav overlay pattern; backdrop-filter containment lesson applies
- [x] i18n: reuse `assistantName`/`statusConnected`/`statusWorking`/`noTitle`; new keys listed in spec D7
- [x] Spec amendments approved by owner (2026-11-18): D3 gains the `lifecycleRef` bump (CodeRabbit pre-approval note), D4 toggle = floating top-start icon (ChatHeader absent in default mode + empty state)

## Tasks

### T1 — `startNewConversation()` in useAiChat (commit 1)
- [x] Bump `lifecycleRef`, reset transcript state + ensure/orphan refs, zero writes, re-arm ensure chain; test the no-write invariant + generation-bump stale-reply rejection + fresh-conversation creation
- Gates: targeted vitest + typecheck + lint — GREEN (f18f90f)

### T2 — ConversationList + ConversationPanel (commit 2)
- [x] `components/ai/ConversationPanel.tsx` (+ list subcomponent): header (ZaneAvatar circle h-10 + name + status), rows (noTitle fallback + updated_at), active highlight, switch/delete/new-chat actions (confirm-toast), skeleton/empty/guest states, loadMore on panel-scroller end, `refresh()` after new-chat
- [x] New i18n keys en+ar (D7 list)
- Gates: FULL web vitest + typecheck + lint — GREEN (d3e37ce; 92 files / 1097 tests)

### T3 — Page-shell wiring + docked-stack removal (commit 3)
- [x] Page: lg+ row wrapper, panel as last flex child (end-side mirror via flex-row), chat column flex-1 min-h-0; `!isReady` spinner moves inside the chat column so the panel stays mounted
- [x] `ZaneStatusAvatar` lg+ docked presentation deleted (root `lg:hidden`, floating classes unconditional); ChatContainer render site + `max-lg:pt-40` untouched
- [x] Floating top-start history toggle (<lg, signed-in only) opening the drawer (T4)
- Gates: FULL web vitest + typecheck + lint — GREEN (9c21f02; 92 files / 1096 tests)

### T4 — Narrow-viewport drawer (commit 4)
- [x] Drawer hosting the same ConversationList; MobileNav-style overlay portaled to body (document pointerdown + containment, backdrop click, Escape, focus, scroll lock), start/end RTL-aware slide from the panel side
- Gates: FULL web vitest + typecheck + lint + e2e — GREEN (c043226; 93 files / 1103 tests; e2e ai-chat-history + ai-chat-send against a fresh dev server of this branch)

## Post-implementation

- [x] Aftermath section in spec.md
- [ ] PR closes #239 (references #244, #245) → CI green → stop (owner merges)

## Rules
English-only · I15 identity lock (`HOME=/c/Users/FOTE git …`) · I16 no force-push/history rewrite · conventional commits · stop at CI green
