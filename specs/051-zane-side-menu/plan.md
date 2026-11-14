# Plan — Spec 051 (Zane chat-history side menu + avatar home, issue #239)

Worktree: `../masarx-wt/spec-051` · Branch: `feat/051-zane-side-menu` (off `origin/main` 6d3f3b2 — **spec-only commits until #245 merges**; implementation joins this branch after the merge + spec approval)

## Pre-flight

- [x] #239 intent read (side menu = avatar's permanent home; docked stack disappears)
- [x] #245 data layer surveyed on `feat-049` worktree: `useConversations → { conversations, loading, hasMore, loadMore, refresh }`; `useAiChat → conversationId, switchConversation, deleteConversation` (hook comment names this spec as the consumer)
- [x] Page shell mapped (`page.tsx:251-330`): flex-col [ChatHeader?] → [ChatContainer + jump pill] → ChatInput
- [x] Hero (ChatContainer:141-230) = empty-state avatar home — untouched
- [x] Drawer precedents: MobileNav overlay pattern; backdrop-filter containment lesson applies
- [x] i18n: reuse `assistantName`/`statusConnected`/`statusWorking`/`noTitle`; new keys listed in spec D7

## Tasks (execution ORDER: only after #245 merges)

### T1 — `startNewConversation()` in useAiChat (commit 1)
- [ ] Reset transcript state, zero writes, re-arm ensure chain; test the no-write invariant + fresh-conversation creation
- Gates: targeted vitest + typecheck + lint

### T2 — ConversationList + ConversationPanel (commit 2)
- [ ] `components/ai/ConversationPanel.tsx` (+ list subcomponent): header (ZaneAvatar circle h-10 + name + status), rows (noTitle fallback + updated_at), active highlight, switch/delete(new-chat actions, confirm-toast), skeleton/empty/guest states, loadMore on panel-scroller end
- [ ] New i18n keys en+ar (D7 list)
- Gates: FULL web vitest + typecheck + lint

### T3 — Page-shell wiring + docked-stack removal (commit 3)
- [ ] Page: lg+ row wrapper, panel as last flex child (end-side mirror via flex-row), chat column flex-1 min-h-0
- [ ] Remove the docked `ZaneStatusAvatar` render (ChatContainer:120-122); component becomes floating-only; its lg+ classes deleted
- [ ] Toggle button in ChatHeader (<lg) opening the drawer (T4) — hidden for guests
- Gates: FULL web vitest + typecheck + lint

### T4 — Narrow-viewport drawer (commit 4)
- [ ] Drawer hosting the same ConversationList; MobileNav-style overlay (document pointerdown + containment, Escape, focus, scroll lock), start/end RTL-aware slide
- Gates: FULL web vitest + typecheck + lint + local prod-build e2e (chat-touching)

## Post-implementation

- [ ] Aftermath section in spec.md
- [ ] PR closes #239 (references #244, #245) → CI green → stop (owner merges)

## Rules
English-only · I15 identity lock (`HOME=/c/Users/FOTE git …`) · I16 no force-push/history rewrite · conventional commits · stop at CI green
