# Spec 048 — Implementation Plan

Branch: `feat/048-zane-status-avatar` · Worktree: `../masarx-wt/feat-048` · Off: `origin/main` (1a0bc9a)

## T1 — Assets (done in setup)

- [x] ffprobe both videos: H.264/yuv420p/480×480/no audio/5s@24fps — no re-encode.
- [x] `apps/web/public/zane/zane-idle-face.mp4` + `zane-typing-close.mp4` (+ 256px poster PNGs).
- [x] `apps/mobile/assets/zane/zane-idle-face.mp4` + `zane-typing-close.mp4`.

## T2 — Web: new components

- [ ] `apps/web/src/components/ai/ZaneAvatar.tsx` — dual mounted videos, opacity crossfade, refs+useEffect play/pause (guarded `.catch`), `useReducedMotion`, visibilitychange handler, poster attrs, no `disablePictureInPicture`.
- [ ] `apps/web/src/components/ai/ZaneStatusAvatar.tsx` — floating overlay+pill (`max-lg`) / docked stack (`lg+`), i18n labels, lucide `Zap`/`Wrench`.

## T3 — Web: integrate

- [ ] `ChatContainer.tsx` — mount `ZaneStatusAvatar` (non-initial state) with `status={isLoading ? "working" : "idle"}`; hero → `ZaneAvatar status="idle"` w-32 h-32; typing indicator → dots-only; delete drive block `:73-165` + lottie imports; scroller content `max-lg:pt-36`.
- [ ] `ChatMessageItem.tsx` — remove assistant avatar column + drive effects `:266-313` + related refs/imports/hook usage.

## T4 — Web: cleanup

- [ ] Delete `LottiePlayer.tsx`, `lib/ai-assistant-reactions.ts`, `lib/dotlottie-console-guard.ts`, `hooks/useInViewport.ts`, `public/animations/ai-robo.lottie` + `ai-robo/`, `public/dotlottie-player.wasm`, `scripts/apply-lottie-patch.mjs` (`.trash/`).
- [ ] `apps/web/package.json` — remove `@lottiefiles/dotlottie-react` + `lottie-patch`/`postinstall` entries; `pnpm install`.

## T5 — i18n

- [ ] `packages/shared/src/messages/en/aiAssistant.json` + `ar/`: `statusConnected`, `statusWorking`.

## T6 — Mobile

- [ ] `pnpm --filter mobile exec expo install expo-av` (SDK 51).
- [ ] NEW `apps/mobile/src/components/ZaneAvatarRN.tsx` (expo-av isolated here).
- [ ] EDIT `apps/mobile/src/screens/AIAssistantScreen.tsx` — floating overlay + pill (140dp, elevation, RTL start/end), list paddingTop ≈190.

## T7 — Tests

- [ ] Update `ChatMessageItem.test.tsx` (avatar gone, dots kept, retry intact).
- [ ] Delete `pickReactionEvent` block in `lib/__tests__/lib-misc.test.ts`.
- [ ] NEW `ZaneAvatar.test.tsx` + `ZaneStatusAvatar.test.tsx`.

## T8 — Verify

- [ ] `pnpm --filter web test` / typecheck / lint · mobile tsc+lint.
- [ ] Playwright visual pass on dev server.
- [ ] Payload numbers: prod vs local (owner-facing).

## T9 — Ship

- [ ] Conventional commits (`feat(ai): …`, `chore(spec-048): …`) — hooks live at `C:/Users/FOTE/.githooks` (repo-local `core.hooksPath`), identity from machine config only (I15).
- [ ] PR from `feat/048-zane-status-avatar` (`gh pr create --head feat/048-zane-status-avatar`).
- [ ] AGENTS.md active-specs row (owner merges).
