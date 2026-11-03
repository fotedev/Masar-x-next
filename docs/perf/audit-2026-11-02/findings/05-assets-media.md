# 05 — Heavy Static Assets, Images, Fonts & Media

> Subagent auditor #5, 2026-11-02. Domain: apps/web public/ assets, lottie, fonts, video embeds. Coordinator spot-check: the `ai-robo` gitignore entry (`.gitignore:238`) verified verbatim; asset sizes re-measured 2026-11-03 and identical.

## Findings

### [ASSET-1] 5.7MB dead-weight extracted Lottie folder in `public/`

- **Priority P1 · Impact H (desktop packaging / local builds), M (web deploy)** — `apps/web/public/animations/ai-robo/` is an unzipped dotLottie bundle artifact: `a/Main Scene.json` = **5,701,614 bytes**, `s/StateMachine1.json` = 2,616 B, `manifest.json` = 158 B. It is **referenced by nothing**. It inflates `public/` from ~2.17MB of real assets to 7.87MB, gets copied into `.next/standalone` on every local build (Next copies `public/` into standalone output), and since desktop packaging ships the standalone server, it can end up in the Electron installer.
- Evidence: repo-wide grep for `Main Scene.json`, `animations/ai-robo/`, `ai-robo/a|s` matches only `.gitignore:238` and `.zcodeignore:228` (`public/animations/ai-robo/`). All code fetches the zip bundle instead: `apps/web/src/components/ai/ChatContainer.tsx:272`, `:427`, `ChatMessageItem.tsx:642`, `LottiePlayer.tsx:29` — all `"/animations/ai-robo.lottie"` (69.8KB). `animationId="Main Scene"` in code is the animation name *inside* the .lottie zip, not a path. `sw.js`/`sw.template.js` cache no animations.
- Current: gitignored junk folder still on disk; traced into standalone/server output on the dev machine. · Fix: delete `apps/web/public/animations/ai-robo/` (per I9 move to `.trash/`). Note: because it is gitignored, Vercel builds from git never had it — the exposure is local builds and desktop packaging. · **Effort S**

### [ASSET-2] Every assistant message mounts its own looping Lottie player

- **Priority P2 · Impact M (CPU/battery on ai-assistant, the measured worst page)** — Each assistant bubble renders a full `<LottiePlayer autoplay loop>` (`ChatMessageItem.tsx:640-651`). `isLatestAssistant` gates only the state-machine *events* (line 261: `if (isUser || !isLatestAssistant) return;`) — the comment at 252-254 confirms "Older bubbles stay on their default 'idle' loop". Every player instance spawns its own dotLottie WASM worker + canvas (each mount is a fresh `DotLottieReact`, key-per-instance `LottiePlayer.tsx:118`). A 20-message chat runs ~20 concurrent animation loops, plus the hero in empty state (`ChatContainer.tsx:270`) and a second player in the thinking indicator (`ChatContainer.tsx:425-432`). Network is deduped (same `/animations/ai-robo.lottie` URL, HTTP-cached); the cost is N WASM instantiations, canvases, and rAF loops — a plausible contributor to ai-assistant's 9.06s LCP jank.
- Fix: render LottiePlayer only for the latest assistant bubble; older bubbles get a static snapshot (PNG/WebP frame or SVG) — the state machine already only reacts on the latest. · **Effort M**

### [ASSET-3] Fonts never preloaded — FOUT on every hard load, ar audience hit hardest

- **Priority P2 · Impact M** — Both fonts use `preload: false, display: "swap"` (`apps/web/src/lib/fonts/almaraiFont.ts:5-7`, `interFont.ts:5-7`). The root layout picks one per request by locale and applies it to `<body>` (`apps/web/src/app/layout.tsx:94-97, 116`), but with `preload: false` the woff2 only starts downloading at first paint → visible fallback swap on ar pages, where Almarai's arabic subset has no metric-identical local fallback (CSS fallback chain in `index.css:120-121` is generic system fonts). LCP text on quiz/ai surfaces repaints on swap.
- Fix: set `preload: true` on both font configs (next/font preloads both families' subsets on every page; ~50-100KB worst-case extra on the wrong locale, cheap vs. removing FOUT). `adjustFontFallback: true` is already set, which only reduces CLS, not FOUT. · **Effort S**

### [ASSET-4] Summary detail page loads the YouTube iframe eagerly

- **Priority P2 · Impact M** — `apps/web/src/app/[locale]/summaries/[summaryId]/page.tsx:307-314` renders the YouTube embed iframe with no `loading="lazy"` and no click facade; every visit to a summary with a video pulls ~1MB of `youtube.com/embed` JS plus thumbnails, competing with the summary content (a quiz-start CTA also lives on the page). By contrast the lecture player is already click-gated (see healthy areas).
- Fix: add `loading="lazy"` to the iframe (one attribute), or a thumbnail facade (`https://i.ytimg.com/vi/<id>/hqdefault.jpg` + play button). · **Effort S**

## Healthy areas

- **No raw `<img>` tags anywhere** in `apps/web/src` (grep returned zero); all 14 image-consuming files use `next/image`. `res.cloudinary.com` (plus supabase, framerusercontent, googleusercontent) are in `remotePatterns` (`apps/web/next.config.mjs:58-78`), and `unoptimized: NODE_ENV !== "production"` (`next.config.mjs:59`) means optimization is active in production builds and disabled only in dev — correct.
- **LectureVideoPlayer is already a facade**: `LectureVideoPlayer.tsx:27` returns `null` until the user selects a video; the iframe with `autoplay=1` only mounts after explicit click intent. No eager embed cost on subject pages.
- **The shipped Lottie asset is small and correctly served**: `/animations/ai-robo.lottie` is 69.8KB; the 1.69MB WASM is self-hosted to satisfy CSP (`LottiePlayer.tsx:20-30`) with correct MIME via `proxy.ts:72, 268-269`, and `outputFileTracingIncludes` only adds `@swc/helpers` (`next.config.mjs:50-52`).
- **Hero Lottie is properly scoped**: it renders only in the empty state (`ChatContainer.tsx:240: {messages.length === 0 ? ...}`), not alongside the message list.
- **Icons/OG/favicon all small**: og-image.png 75.9KB, logo_EN.webp 72.8KB, icon-512.png 57.5KB, favicon assets ≤14KB — nothing to trim.

## Notes

- `apps/web/src/app/layout.tsx:67-90` resolves locale via `headers()`/`cookies()`/`getLocale()` in the root layout, forcing every route dynamic (no static prerender). Outside my asset domain — flagging for the rendering auditor since it amplifies every asset finding (no CDN-cached HTML).
- The ai-robo extracted folder being gitignored means teammate/CI machines are clean; the 5.7MB exists only on the owner's machine and in anything packaged from it (desktop installers, local standalone). The fix is still worth doing immediately since `.trash/`-move is trivial and it is the single largest item in the repo's web public assets.
- Per-message Lottie finding (ASSET-2) and font preload (ASSET-3) are both plausible contributors to the measured ai-assistant/quiz LCP pain; the 1.69MB WASM (immutable-cached, loaded only when a player first mounts) is acceptable as-is.
