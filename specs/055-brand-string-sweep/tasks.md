# Spec 055 — Tasks

Execution order = commit order (spec.md §5). Each task ends with its gate run; a red gate blocks the next task.

## T1 — Spec (commit 1)

- [x] Write `spec.md` + `tasks.md` in `specs/055-brand-string-sweep/` (this commit).

## T2 — Shared contract + prompt key (commit 2)

- [ ] `packages/shared/src/messages/{ar,en}/faculty.json`: add `promptPlatformName` to every preset.
- [ ] `packages/shared/src/ai/types.ts`: `AiRequest.context.facultyId?: string` + doc comment.
- [ ] Extend `packages/shared/src/branding/__tests__/faculties.test.ts`: shape test for `promptPlatformName` (ar/en, non-empty, per preset).
- [ ] Gates: shared vitest, shared tsc.

## T3 — Web prompt builders (commit 3)

- [ ] New `apps/web/src/lib/ai/prompt-brand.ts` (`getFacultyPromptBrand`, canned-messages pattern).
- [ ] `assistant.ts`: extract + export `buildStudentAgentSystemPrompt(platformBrand)`; call site uses `getFacultyPromptBrand(options.locale) ?? "مسار X"`.
- [ ] `app/api/ai/chat/route.ts`: `buildSystemPrompt(mode, platformBrand?)`; POST passes `getFacultyPromptBrand()`.
- [ ] Tests: prompt-brand, prompt builder byte-equality (core default), substitution case, buildSystemPrompt modes.
- [ ] Gates: web vitest, tsc, eslint.

## T4 — Edge allowlist + proxy injection (commit 4)

- [ ] `supabase/functions/ai-chat/pure.ts`: `AI_CHAT_CORE_PLATFORM`, `AI_CHAT_FACULTY_PLATFORMS`, `resolveAiChatPlatformName`, `buildSystemInstruction(languageInstruction, platformName?)`.
- [ ] `supabase/functions/ai-chat/index.ts`: thread `resolveAiChatPlatformName(body.context?.facultyId)` into `buildSystemInstruction`.
- [ ] `apps/web/src/app/api/ai-chat/route.ts`: overwrite `context.facultyId` from `resolveFacultyPresetIdFromEnv()`.
- [ ] Deno harness tests (helpers + drift guard) + proxy injection test.
- [ ] Gates: deno test (ai-chat helpers), web vitest, tsc.

## T5 — Service-worker sweep (commit 5)

- [ ] `apps/web/public/sw.template.js`: genericize the two notification fallbacks (`إشعار جديد` / empty title); no cache-key changes.
- [ ] Gates: web vitest, tsc, eslint.

## T6 — Full gates + regression + PR (commit 6)

- [ ] Full vitest suites (web + shared), tsc, eslint across the touched workspaces.
- [ ] Relevant e2e regression (chat/streaming specs) in the worktree.
- [ ] Ledger row for spec 055.
- [ ] PR body: spec link, disposition summary, owner step (redeploy `ai-chat` edge function after merge).
