# 07 — Landing Page & Hero First Paint

> Subagent auditor #7, 2026-11-02. Domain: apps/web [locale]/page.tsx, HomeClient, home sections. This page is the measured reference (perf 96); report documents what makes it fast plus the cheap wins. Cross-corroborated: LANDING-4's redundant `getUser()` calls independently found by auditor #16 (AUTH-1).

## Findings

### [LANDING-1] Quiz fetch is serialized behind subjects, though it doesn't depend on subjects

- **P2 · Impact M** — the quizzes network call starts only after the subjects query resolves, adding one full round-trip of serialization to the below-fold section. The query itself (`quizzes ... limit(30)`) has no subjects dependency; only the client-side filter does.
- Evidence: `apps/web/src/components/HomeClient.tsx:102-104` — `if (subjectsLoading) return;` before `loadQuizzes()`; dep array at :161 `useEffect(..., [subjectsLoading, visibleSubjectSet, ...])`; the actual filter happens after fetch at :130-142.
- Current: fetch gated on subjects → quizzes land ~1 RTT after subjects. **Fix**: start the fetch on mount, apply the `visibleSubjectSet` filter when subjects arrive (the filter logic already re-runs via the effect). **Effort S**.

### [LANDING-2] Two of the four home fetches bypass TanStack — no cache survives a reload, and videos refetch on every mount

- **P2 · Impact L** — within a SPA session TanStack caches `summaries`/`subjects` (staleTime 5 min), but (a) `useTopVideos` is a raw `useEffect` + supabase with zero cache, refiring on *every* HomeClient mount including client-side re-navigation, and (b) the quiz cache `home_quizzes_approved` matches none of `PERSISTABLE_PREFIXES`, so its 1 h TTL lives only in the in-memory `Map` and is lost on every full page load. Net: all four fetches re-run on every hard visit.
- Evidence: `apps/web/src/hooks/useVideoRatings.ts:9-32` (uncached useEffect); `apps/web/src/lib/queryCache.ts:18-28` (`PERSISTABLE_PREFIXES = ["subjects","settings","platform","academic_options","levels"]` — `home_quizzes_approved` matches none); `apps/web/src/components/HomeClient.tsx:109,127`.
- Current: videos refetch per mount; quiz cache session-only. **Fix**: port both to `useQuery` with the standardized `staleTime: 5 * 60 * 1000` (pattern already in `useSummaries.ts:13-15`). **Effort S**.

### [LANDING-3] `force-dynamic` is redundant — the route is dynamic from layout auth + UA header, not the page

- **P2 · Impact L (documentation, not perf)** — nothing on this page renders personalized server-side data. The route can't be static/ISR anyway because `[locale]/layout.tsx` calls `supabase.auth.getUser()` (reads cookies) and `DesktopAppBanner` reads `headers()` for UA platform detection. The `force-dynamic` flag misdirects future auditors to the page itself.
- Evidence: `apps/web/src/app/[locale]/page.tsx:4`; real dynamic sources: `apps/web/src/app/[locale]/layout.tsx:93-96` and `apps/web/src/app/[locale]/_components/DesktopAppBanner.tsx:22-23`.
- Current: no fix needed (0.81 s SSR is fine; layout auth feeding `AppProviders` server-side avoids a client auth flash — deliberate). **Fix**: at most a one-line comment on page.tsx pointing to the real dynamic sources. **Effort S**.

### [LANDING-4] Authed users pay hidden costs Lighthouse can't see

- **P2 · Impact M** — the measured 96 is an unauthenticated run. When logged in, the landing page additionally does (a) a redundant `supabase.auth.getUser()` network round-trip in `fetchNotifications()` even though the SSR layout already resolved the user into `AuthProvider`; (b) the same `getUser()` again in the realtime setup; (c) a notifications fetch (50 rows, 1-min TTL) plus a realtime websocket; (d) the subjects query gated on the academic-profile fetch (`enabled: !academicLoading`), extending the auth→academic→subjects→quizzes client waterfall.
- Evidence: `apps/web/src/hooks/useNotifications.ts:29-31` (`await supabase.auth.getUser()` inside `fetchNotifications`), :84-89 (fetch on mount via effect at :257-259), :279-283 (channel `notifications:${user.id}`), second `getUser()` in realtime setup; `apps/web/src/hooks/useSubjects.ts:62-64` (gated `enabled`); `apps/web/src/components/AppProviders.tsx:27-31` (SSR user already provided).
- Current: 2+ redundant auth round-trips on every authed view. **Fix**: use the user from `useAuth()` instead of re-calling `getUser()` in both spots. **Effort S**. No evidence these threaten the 96 — they are background/below-fold — but this is the gap between the Lighthouse number and the authed experience.

## Healthy areas (what makes this page fast)

- **Hero is data-free and interactive immediately**: the quick-actions grid (AI card + 4 links) renders from static markup with no fetch dependency — all four queries feed only the below-fold sections (`HomeClient.tsx:177-299`), and sections render skeletons while loading (`SummariesSection.tsx:71-80`), which is why CLS is 0.002.
- **Animations are CLS-safe**: all three sections use opacity-only variants, `whileInView` with `once: true` + a `-64px` viewport margin, and a `useReducedMotion` fallback (`SummariesSection.tsx:113-121`); no layout-shifting transforms.
- **Server-side banner cost is bounded**: GitHub release fetch is cached 1 h via `next: { revalidate: 3600 }` with a YAML fallback and renders `null` on failure (`github-releases.ts:67-70,95`, `DesktopAppBanner.tsx:24,27`).
- **Static-metadata caching is done right**: platform settings 24 h TTL and persisted to localStorage (`queryCache.ts:191` + `PERSISTABLE_PREFIXES` includes `"platform"`); academic profile cached in sessionStorage (`academic-utils.ts:37-42`); subjects query selects a narrow column list (`useSubjects.ts:70-72`); quizzes capped at 30 with a documented rationale (`HomeClient.tsx:120-123`).
- **Sane TanStack defaults**: staleTime 5 min, gcTime 30 min, `retry: 1` to avoid Supabase retry storms (`QueryProvider.tsx:14-31`).

## Notes

- **Repeat-visit bandwidth**: within a session, `summaries`/`subjects` are TanStack-cached and quizzes are memory-cached; on every full page load all four refetch since nothing persists. Payloads are small (50 summaries incl. `content` — which the cards *do* render, `SummariesSection.tsx:203` — 30 quizzes, 10 videos, narrow subject select), consistent with the measured 664 KB total and score 96. LANDING-2 is the cheap trim; do not pursue a query persister under MVP Lock.
- **Keep the page dynamic**; the only "fix" is documentation. Moving UA detection client-side to unlock static rendering would trade a 1.36 s LCP today for a platform-detection flash — not worth it.
- **No hidden authed risk** that would tank the score; the costs are redundant auth round-trips and background subscriptions, all addressable with the LANDING-4 one-liner.
- 18 files reviewed (read-only).
