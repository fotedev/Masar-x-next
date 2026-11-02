# Lighthouse Run — 2026-11-02 (local production build)

Lighthouse 13.6.0 / Chrome headless, **mobile emulation (default throttling: slow 4G + 4× CPU slowdown)**, against the local production server (`next start` on :3111, Turbopack build). Raw JSON + HTML reports: `measurement/lh/*.report.{json,html}`. Single run per route (no median of 5) — treat ±5 points as noise; the *shape* of the failures is what matters.

## Scores

| Route | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | Speed Idx | Bytes | Main-thread | Boot-up |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/ar` (landing) | **96** | 96 | 96 | 100 | 1.36s | 1.36s | 206ms | 0.002 | 2.37s | 664 KB | 2.17s | 964ms |
| `/ar/login` | **96** | 95 | 96 | 66 | 1.37s | 1.37s | 214ms | 0.005 | 1.43s | 590 KB | 1.57s | 755ms |
| `/ar/news` | **74** | 96 | 92 | 100 | 1.36s | 1.36s | 138ms | **0.917** | 2.02s | 619 KB | 1.50s | 798ms |
| `/ar/subjects` | **73** | 95 | 96 | 100 | 1.36s | 1.36s | 186ms | **0.889** | 2.57s | 613 KB | 1.73s | 845ms |
| `/ar/quizzes` | **46** | 90 | 92 | 100 | 1.37s | 1.37s | **2.08s** | **0.889** | 3.65s | 649 KB | **3.99s** | **2.89s** |
| `/ar/quiz-play/<id>` | **56** | 96 | 92 | 100 | 1.36s | **5.86s** | 225ms | **0.317** | 4.51s | 695 KB | 1.93s | 902ms |
| `/ar/ai-assistant` | **58** | 100 | 96 | 100 | 1.36s | **9.06s** | 629ms | 0.000 | 3.07s | **1390 KB** | **3.40s** | **2.28s** |

## Root causes identified from the reports

### 1. The footer shift is ONE bug hitting four routes (CLS)

The largest layout shift on `/ar/subjects` (0.874), `/ar/quizzes` (0.874), `/ar/news` (0.477+0.425), `/ar/quiz-play` (0.317+0.212) is the same element:

```
<footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 …">
```

Mechanism: the footer sits in normal document flow *below* client-rendered content that mounts empty (client components fetch Supabase data post-hydration). When data arrives, the content above grows and shoves the footer down — the biggest-scored element in the shift is the footer itself. `Loading` states don't reserve space, and there are no `loading.tsx`/skeleton boundaries. Fixing this once (reserve space / SSR skeletons / footer out of flow until mount) should recover CLS on all four routes.

### 2. `/ar/quizzes` — TBT 2.08s, main-thread 3.99s, boot-up 2.89s

Hydration cost, not network: FCP is fine (1.37s) but the page blocks for 2+ seconds parsing/executing eager client JS (hub page eagerly mounts dashboard + 4 `ssr:false` modals + quiz logic). Perf 46 despite small payload.

### 3. `/ar/ai-assistant` — LCP 9.06s, 1390 KB total

Largest page payload (1.39 MB transferred) and a 9-second LCP: the meaningful content appears only after client auth + chat bootstrap resolve (client-only page, no SSR fallback). TBT 629ms on top.

### 4. `/ar/quiz-play/<id>` — LCP 5.86s

Same client-fetch-then-render pattern as ai-assistant; LCP waits for the quiz start screen which renders only after the quiz fetch resolves.

### 5. What's already healthy

Landing and login (perf 96) prove the baseline stack (middleware, fonts, theme script, shared chunks) is fast. The failures are all **data-fetch-then-render client pages and hydration weight**, not static assets — images/fonts/icons were already audited as clean in `docs/audits/performance-audit.md`.

## Caveats

- Localhost removes real network latency for the API calls pages make at hydration (Supabase round-trips) — real-world LCP on the client-fetch pages will be **worse** than measured here.
- Anon (logged-out) state was tested; authed pages add more client work (notifications channel, profile sync).
