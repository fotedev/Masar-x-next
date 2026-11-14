# Plan — Spec 050 (Zane prompt-injection hardening, issue #242)

Worktree: `../masarx-wt/spec-050` · Branch: `feat/050-zane-prompt-hardening` (off `origin/main` 6d3f3b2)

## Pre-flight

- [x] All issue-#242 anchors re-verified on main (assistant.ts, prompts.ts, paste-attachments.ts, route.ts, ChatMessageItem.tsx, ai-chat, summarize-chat, contextBuilder.ts)
- [x] Edge fn surfaces confirmed: `ai-chat` has no `systemInstruction` (:130/:376); `summarize-chat` embeds 50 messages + raw sender names uncapped (:103-142)
- [x] Test conventions: web vitest projects (.ts=node, .tsx=jsdom); edge = plain `Deno.test` offline with pure helpers in `pure.ts`

## Tasks

### T1 — Delimited channels + marker escaping (commit 1)
- [ ] `apps/web/src/lib/ai/prompt-channels.ts` — `wrapDataChannel(tag, content)`, `escapeMarkerLookalikes(text, tags)` (case-insensitive, attribute'd variants, bracketed placeholder)
- [ ] `apps/web/src/lib/__tests__/prompt-channels.test.ts` (§4.1 scenarios)
- [ ] `assistant.ts` — restructure both mode prompts: framing line → delimited `<platform_context>`/`<conversation_history>`/`<user_message>` (content escaped) → tail reinforcement block (D3); `buildChatHistoryContext` 2000-char/turn trim
- [ ] Prompt-shape tests in `assistant.test.tsx` (§4.3)
- Gates: targeted vitest + typecheck + lint

### T2 — Input caps (commit 2) — REVISED: UI surfaces already refuse over-cap (page.tsx:170 / AssistantPanel.tsx:78), so the refusal UX is kept and the helper cap param is dropped; what ships is the choke-point backstop
- [x] `useAiChat.sendMessage` backstop slice to `AI_PROMPT_MAX_CHARS` + `PROMPT_TRUNCATION_MARKER` (prompts.ts) before the AI call; transcript keeps full text
- [x] Tests: over-cap sliced + under-cap passthrough (useAiChat.test.tsx)
- Gates: FULL web vitest + typecheck + lint

### T3 — zane-ui output validation (commit 3)
- [ ] `apps/web/src/lib/ai/zane-ui.ts` — `validateZaneUiPayload` (D5 rules) + `apps/web/src/lib/__tests__/zane-ui.test.ts`
- [ ] `ChatMessageItem.extractZaneUiBlocks` routes through the validator (invalid block → stripped, no buttons)
- Gates: FULL web vitest + typecheck + lint

### T4 — Edge hardening (commit 4, owner-deploy)
- [ ] `ai-chat`: `systemInstruction` on both Gemini sites; `<user_message>` framing via pure helper in `pure.ts`; keep 50k cap + Deno tests
- [ ] `summarize-chat`: per-message 1000 / sender-name sanitize 60 / total 20 000 caps via pure helper + `<conversation>` framing + Deno tests
- Gates: `deno check` (CI job) + edge Deno tests + full web vitest

### T5 — Fallback personas (commit 5)
- [ ] `route.ts` `buildSystemPrompt` extensions (D7) + route test updates
- Gates: FULL web vitest + typecheck + lint + deno-check

## Post-implementation

- [ ] Aftermath section in spec.md (deviations/surprises)
- [ ] PR closes #242; PR body carries the **owner-deploy handover** for `ai-chat` + `summarize-chat`
- [ ] CI green → stop (owner merges)

## Rules
English-only · I15 identity lock (`HOME=/c/Users/FOTE git …`) · I16 no force-push/history rewrite · conventional commits · stop at CI green
