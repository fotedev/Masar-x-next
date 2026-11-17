# Spec 048 — ZANE single status avatar (video, Muse-style)

| Field | Value |
|---|---|
| Status | **In progress** — approved in-session 2026-11-13 (plan ratified twice by owner with model-reviewed corrections) |
| Type | UI/UX rework of the AI-assistant avatar + dead-code removal (web, desktop via web, mobile) |
| Origin | Owner directive: "every message had her own animation" → one status-driven avatar that changes only when status changes, like muse.ai; Muse mobile screenshots as layout reference |

## Problem

The ZANE avatar is a dotLottie robot (`/animations/ai-robo.lottie`) mounted **three times**, each with its own state-machine driver:

1. **Per assistant bubble** — `ChatMessageItem.tsx:647` (every assistant message renders its own player) + per-bubble reaction driver `:266-294` and a 1500 ms `thinkClick` re-fire interval `:301-313`.
2. **Hero (empty state)** — `ChatContainer.tsx:269-283` + its own driver reacting to `isLoading`/`hasUserInput` (`:130-165`).
3. **Typing indicator** — `ChatContainer.tsx:417-446` + `handleThinkingLottieRef` (`:82-96`) + a second 1500 ms interval (`:105-117`).

Supporting machinery exists only for this animation: `lib/ai-assistant-reactions.ts` (96-line keyword→event heuristic), `lib/dotlottie-console-guard.ts`, `hooks/useInViewport.ts` (avatar-only consumer), `LottiePlayer.tsx` (165 lines of mount-race workarounds), a postinstall patch script (`scripts/apply-lottie-patch.mjs`), and a **1.69 MB WASM player** fetched by every `/ai-assistant` visitor.

Measured before-state (ffprobe 2026-11-13): static payload `dotlottie-player.wasm` 1.69 MB + `ai-robo.lottie` 68 KB + package code; mobile has **no avatar at all**.

The replacement videos (owner-provided, ffprobe-verified): `zane-idle-face.mp4` 130 KB, `zane-typing-close.mp4` 184 KB — **H.264 / yuv420p / 480×480 / no audio / 5 s @ 24 fps** (no re-encode needed).

## Design (ratified)

**One** status-driven avatar; status flips only between `idle` and `working` (= `isLoading` on web / `sending` on mobile). Both videos stay mounted permanently; crossfade by opacity (~200 ms); inactive video paused; paused on hidden tab / backgrounded app; no autoplay under `prefers-reduced-motion`; PiP allowed on web (no `disablePictureInPicture`), mobile PiP explicitly out of scope (Muse's Android floating window is a voice-call Activity feature; expo-av provides none).

| Surface | Presentation | Size |
|---|---|---|
| Web narrow (`<lg`) | Floating top-center overlay over the messages + dark pill overlapping the avatar bottom edge (bold name / muted status); messages scroll underneath (scroll-content top padding) | 112px |
| Web desktop (`lg+`) | Docked top-center stack: avatar + name + status line with icon (idle = green `Zap` "Connected"/متصل; working = `Wrench` "is working"/يعمل الآن...) | 128px |
| Mobile (incl. empty state) | Floating top-center avatar + overlapping dark pill over the FlatList (clear-chat button unchanged) | ~140dp |
| Web empty-state hero | Existing title/cards kept; Lottie robot → 128px idle video circle (poster first frame) | 128px |

Per-message assistant avatars removed completely; typing indicator keeps **only** the dots bubble; user-message avatar unchanged. Labels/icons/text via new shared i18n keys (en+ar). RTL mirrored (web `isRTL` flex pattern; mobile start/end styles + Android `elevation` on the overlay).

Performance claims limited to measured facts (payload delta, line counts, timer count) — no unmeasured CPU assertions. Post-build owner-facing numbers: Network payload of prod (old) vs local (new); optional DevTools Performance recording.

## Changes

Single branch `feat/048-zane-status-avatar` (worktree `../masarx-wt/feat-048`), one PR.

- **Assets** — videos → `apps/web/public/zane/` (mp4 + ffmpeg-extracted 256px poster PNGs) and `apps/mobile/assets/zane/` (mp4 only).
- **Web NEW** `components/ai/ZaneAvatar.tsx` (~45 lines): dual mounted `<video>` (muted loop playsInline preload auto, object-cover), opacity crossfade per status, refs + `useEffect` play/pause (guarded `.catch`), `useReducedMotion` (framer-motion — existing pattern), `visibilitychange` pause/resume, poster attributes.
- **Web NEW** `components/ai/ZaneStatusAvatar.tsx`: one DOM node — floating overlay+pill on `max-lg`, docked stack on `lg+`; i18n labels + lucide icons.
- **Web EDIT** `ChatContainer.tsx` — render `ZaneStatusAvatar` when messages exist; hero → idle `ZaneAvatar`; typing indicator → dots-only; delete all lottie refs/drive effects/intervals (`:73-165`).
- **Web EDIT** `ChatMessageItem.tsx` — delete assistant avatar column + drive effects (`:266-313`), `lottiePlayerRef`/`lottieInstanceId`/`wasLoadingRef`/`useInViewport` usage; keep user avatar, `isLatestAssistant` retry gate, dots bubble location.
- **Web DELETE** (importer-verified) — `LottiePlayer.tsx`, `lib/ai-assistant-reactions.ts`, `lib/dotlottie-console-guard.ts`, `hooks/useInViewport.ts`, `public/animations/ai-robo.lottie` + `ai-robo/`, `public/dotlottie-player.wasm`, `scripts/apply-lottie-patch.mjs`; drop `@lottiefiles/dotlottie-react` dep + `lottie-patch`/`postinstall` script entries. `.trash/` per I9.
- **i18n** — `packages/shared/src/messages/{en,ar}/aiAssistant.json`: `statusConnected` ("Connected"/"متصل"), `statusWorking` ("is working"/"يعمل الآن...").
- **Mobile** — add `expo-av` (SDK 51-compatible, Expo Go included); NEW `src/components/ZaneAvatarRN.tsx` (expo-av isolated to one file: two stacked Videos, opacity crossfade, inactive paused, AppState pause, guarded play, poster frames); EDIT `AIAssistantScreen.tsx` (floating overlay + pill, list top padding ≈190, RTL start/end, elevation).
- **Tests** — update `ChatMessageItem.test.tsx` (avatar assertions gone, dots kept); delete `pickReactionEvent` block in `lib-misc.test.ts`; new `ZaneAvatar`/`ZaneStatusAvatar` tests (status↔opacity, muted/playsInline, guarded play, label flips).
- **Ledger** — AGENTS.md active-specs row.

## Out of scope

Desktop Electron code (loads the web build — inherits automatically) · mobile PiP (voice-call feature) · re-encoding the videos (already optimal: H.264/yuv420p/no audio) · desktop study-workspace `AssistantPanel` avatar (text-only surface, separate follow-up if wanted) · unmeasured performance claims in docs.

## Verification

`pnpm --filter web test` + typecheck + lint green · Playwright on dev server: empty hero, floating pill (narrow) / docked stack (lg+), no bubble avatars, dots-only indicator, idle↔working flip with no reload/flash, right-click PiP present · mobile tsc + lint (visual check owner-side on Expo Go; dev-client rebuild note for expo-av) · Electron dev launch shows the new web UI.
