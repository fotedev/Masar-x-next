# Lighthouse Run — 2026-11-02 (local production build)

> **Evidence note:** raw JSON/HTML reports were lost in the workspace cleanup described in `build-2026-11-02.md`; the full table below was extracted from the reports inside the audit session (including the element-level shift attribution) and is reproduced here verbatim from that extraction.

Lighthouse 13.6.0 / Chrome headless, **mobile emulation (default throttling: slow 4G + 4× CPU slowdown)**, against the local production server (`next start` on :3111, Turbopack build). Single run per route (no median of 5) — treat ±5 points as noise; the *shape* of the failures is what matters.

## Scores

| Route | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Idx | Bytes | Main-thread | Boot-up |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/ar` (landing) | **96** | 96 | 96 | 100 | 1.36s | 1.36s | 206ms | 0.002 | 2.37s | 664 KB | 2.17s | 964ms |
| `/ar/login` | **96** | 95 | 96 | 66 | 1.37s | 1.37s | 214ms | 0.005 | 1.43s | 590 KB | 1.57s | 755ms |
| `/ar/news` | **74** | 96 | 92 | 100 | 1.36s | 1.36s | 138ms | **0.917** | 2.02s | 619 KB | 1.50s | 798ms |
| `/ar/subjects` | **73** | 95 | 96 | 100 | 1.36s | 1.36s | 186ms | **0.889** | 2.57s | 613 KB | 1.73s | 845ms |
| `/ar/quizzes` | **46** | 90 | 92 | 100 | 1.37s | 1.37s | **2.08s** | **0.889** | 3.65s | 649 KB | **3.99s** | **2.89s** |
| `/ar/quiz-play/<id>` | **56** | 96 | 92 | 100 | 1.36s | **5.86s** | 225ms | **0.317** | 4.51s | 695 KB | 1.93s | 902ms |
| `/ar/ai-assistant` | **58** | 100 | 96 | 100 | 1.36s | **9.06s** | 629ms | 0.000 | 3.07s | **1390 KB** | **3.40s** | **2.28s** |

(quiz id used: `7bbf857a-5c74-4f9e-8327-894651ae7152` — "اختبار تجريبي — أساسيات البرمجة", fetched read-only via anon REST.)

## Root causes identified from the reports

### 1. The footer shift is ONE bug hitting four routes (CLS)

The largest layout shift on `/ar/subjects` (0.874), `/ar/quizzes` (0.874), `/ar/news` (0.477+0.425), `/ar/quiz-play` (0.317+0.212) is the same element:

```text
<footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 …">
```

Mechanism (confirmed by SPLIT-1/2): the footer renders server-side inside `Layout.tsx` while `<main>`'s content passes through the `ssr:false` PageTransition — so server HTML ships an empty main + painted footer near the top; when hydrated client content grows, the footer shoves down. Fixing SPLIT-1 (render pages server-side) plus skeletons recovers CLS on all four routes at once.

### 2. `/ar/quizzes` — TBT 2.08s, main-thread 3.99s, boot-up 2.89s

Hydration cost, not network: FCP is fine (1.37s) but the page blocks 2+ seconds parsing/executing eager client JS, then re-renders twice more within the first second (AuthContext unmemoized-value churn RENDER-1 + PlatformSettings loading flip RENDER-3). Perf 46 despite small payload.

### 3. `/ar/ai-assistant` — LCP 9.06s, 1390 KB total

Largest page payload (1.39 MB transferred) and a 9-second LCP: the LCP element (hero lottie canvas / staggered welcome text) paints only after 1390 KB of JS hydrates, one rAF defers the LottiePlayer mount, then the dynamic dotlottie chunk loads and fetches the 1.69 MB wasm before the first canvas frame (CHAT-4). TBT 629ms on top; CHAT-1/2 add N per-message lottie players after load.

### 4. `/ar/quiz-play/<id>` — LCP 5.86s

Same client-fetch-then-render pattern: whole page is `"use client"`, quiz fetch is a 2-request serial waterfall (FETCH-3), nothing server-rendered under the ssr:false PageTransition.

### 5. What's already healthy

Landing and login (perf 96) prove the baseline stack (middleware, fonts, theme script, shared chunks) is fast. The failures are all **data-fetch-then-render client pages and hydration weight**, not static assets — images/fonts/icons were already audited as clean in `docs/audits/performance-audit.md`.

## Caveats

- Localhost removes real network latency for the API calls pages make at hydration (Supabase round-trips) — real-world LCP on the client-fetch pages will be **worse** than measured here.
- Anon (logged-out) state was tested; authed pages add more client work (notifications channel, profile sync) — see LANDING-4 / AUTH-3 for the authed-only costs Lighthouse cannot see.
