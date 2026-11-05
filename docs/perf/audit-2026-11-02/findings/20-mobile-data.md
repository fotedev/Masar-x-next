# 20 — Mobile Data Layer & JS Bundle Weight

> Method note: analyzed by the audit coordinator (subagent quota exhausted mid-run). Same evidence standard; static analysis only.

## Findings

### [MDATA-1] The static i18n registry ships all 47 namespaces × both locales into the mobile JS bundle — ~37 of them unused on mobile

- **Priority P2 · Impact M** — `packages/shared/src/i18n/index.ts` statically imports **94 JSON files** (47 `ar` + 47 `en`, verified import block at the top of the file); measured size: **200 KB `ar` + 165 KB `en` = 365 KB raw JSON** compiled into the Hermes bundle. Actual mobile usage (grep of all `t(` call sites): ~11 namespaces (`mobile`, `authPages`, `quizzes`, `session`, `quizAttempts`, `aiAssistant`, `reviews`, `news`, `subjects`, `auth`, `common`) — `adminDashboard`, `faq`, `footer`, `downloads`, `editSummary`, etc. are web-only and dead weight on mobile. Both locales always ship; the device only ever renders one.
- **Current**: every cold start parses 365 KB of JSON modules for ~110 KB of used strings. · **Fix**: introduce a mobile entry that requires only the needed namespaces (a `mobile-messages.ts` with explicit imports of the ~11 files × active locale, chosen via a small `Platform.select`/locale switch — Metro requires static `require` maps, so two locale entry modules is the practical shape). Keep the full registry for web/desktop server paths. · **Effort M**

### [MDATA-2] `useSupabaseQuery` refetches on every mount with no in-flight dedupe — two screens with the same cacheKey fetch twice

- **Priority P2 · Impact L-M** — The stale-while-network effect runs on `[cacheKey, enabled, online, reloadToken, ttlHours]` (`apps/mobile/src/hooks/useSupabaseQuery.ts:100`) and always fires the network fetch after reading cache (`:77-84`). There is no shared in-flight promise: 5 call sites exist; if two components ever use the same `cacheKey` (e.g., SubjectsScreen + SubjectDetail fetching the subject list), both pay the full request. Each effect run also re-reads + `JSON.parse`s the full AsyncStorage envelope (`read-cache.ts:64-78`).
- **Current**: fetch-per-mount, no request coalescing. · **Fix**: module-level `Map<cacheKey, Promise>` in-flight dedupe (mirrors `useNotifications.ts:9,49-55` on web); optionally skip refetch when cache is younger than a soft staleTime. · **Effort S**

### [MDATA-3] Cache TTL is a flat 168 h with no refresh cap — 7-day-old "readable" data silently becomes the primary content

- **Priority P2 · Impact L (UX/quality, not raw perf)** — `DEFAULT_TTL_HOURS = 168` (`apps/mobile/src/read-cache.ts:25`); `cacheGet` returns `isStale` but `useSupabaseQuery` **never reads it** (`useSupabaseQuery.ts:58-65` uses only `payload`/`savedAt`). Stale entries render identically to fresh ones with no "cached 6 days ago" affordance, and the flat TTL means one constant for quizzes, news and summaries.
- **Fix**: pass per-domain TTLs at call sites (they're already supported — `ttlHours` option exists, default is just always used), and surface `isStale`/`cachedAt` in the offline banner only. · **Effort S**

### [MDATA-4] No bundle-size measurement anywhere in the mobile pipeline

- **Priority P2 · Impact M (trend risk)** — CI's `expo export` job is explicitly a "bundle proof" that the graph resolves (`.github/workflows/ci.yml:367-372`) — it throws away the artifact and asserts nothing about size. Combined with MDATA-1's dead-weight registry, mobile bundle growth is invisible until a user reports a slow download.
- **Fix**: in the same CI job, `du` the export output and print it; add a warning-level budget line (e.g. Hermes bundle > 2.5 MB fails the step) following the same pattern as `docs/perf/baselines.md` baselines. · **Effort S**

### [MDATA-5] Six `select("*")` queries on mobile — same over-fetch family as web, smaller consequence

- **Priority P2 · Impact L** — grep found 6 `select("*")` call sites across the 5 `useSupabaseQuery` consumers (SubjectDetail, SummaryDetail, Quizzes, News, QuizAttempts). Mobile payloads are capped lists (≤30), so the absolute cost is small today; it compounds with MDATA-2's no-dedupe refetching on slow networks.
- **Fix**: narrow columns at the same time as MDATA-2's dedupe work. · **Effort S**

## Healthy areas

- **read-cache envelope design is exactly right**: versioned (`CACHE_VERSION` gate, `read-cache.ts:69`), best-effort try/catch everywhere (quota errors can never break the online path, `:56-61`), TTL arithmetic pure and tested (`:70-74`), `cacheClearAll` for sign-out hygiene.
- **Offline contract is honored**: `useSupabaseQuery` keeps cached content rendered when `!online` and exposes `offline: true` (`useSupabaseQuery.ts:67-71`) — matches FR-011.
- **Fetcher identity is render-stable**: `fetcherRef.current = fetcher` keeps the effect deps minimal so screens can pass inline fetchers without re-triggering fetches (`:46-47`).
- **Supabase client is a true singleton on mobile**: `getSupabaseClient()` lazy-imports once (`useSupabaseQuery.ts:78`); no per-call client factory like web's TRW hooks (FETCH-5 has no mobile equivalent).
- **JSON imports are Metro-native** — no runtime fetch/parse of message files, no network for i18n (unlike the MathText CDN issue in 19-mobile-startup MOBILE-1).
