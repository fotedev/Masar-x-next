# 09 — Admin Dashboard & Analytics UI

> Subagent auditor #9, 2026-11-02. Domain: apps/web admin-dashboard, admin-shell, AdminAnalyticsPage, /api/admin/metrics. Cross-corroborated: RENDER-6 (memo wrappers defeated) and BUNDLE-1 (eager imports) cover the same two top findings from different angles.

## Findings

### [ADMIN-1] Entire admin monolith eagerly imported — zero dynamic imports anywhere in the admin tree

- **P1** · Impact H (admin boot TBT; given the measured 2.08s TBT / 2.89s bootup on the lighter `/ar/quizzes` client-heavy pattern, this page ships strictly more eager JS: 7 tab views + 4 modals + analytics + shell + framer-motion via FilterBottomSheet, ~1,900+ lines of tab/modal code alone before dependencies)
- Evidence: `apps/web/src/app/[locale]/admin-dashboard/page.tsx:6-29` (static imports of NewsTab, AppealsTab, QuizzesTab, AddNewsModal, AdminAnalyticsPage, PageManagementTab, CoursesEnrollmentsView→CoursesTab+EnrollmentsTab, AddCourseModal, SubjectsTab, AddSubjectModal, ManageLecturesModal); grep for `next/dynamic|React.lazy` across the whole admin tree returned **zero hits**. Confirming greps: `components/NewsTab.tsx` is imported *only* by this page — all of it is dead weight on first paint of the overview tab.
- Current: one client chunk loads all tabs before the shell can paint. · Fix: `next/dynamic` per non-default tab (page_management, courses_enrollments, quizzes, appeals, news) and per modal; default tabs (overview, subjects) can stay static. · Effort M
- Note: this is route-scoped — verified NO leak into non-admin bundles (see Healthy areas), so this costs only admins.

### [ADMIN-2] All five dataset hooks fire on mount and the shell render is gated on the slowest

- **P1** · Impact H (admin first-paint: sidebar/topbar don't render until every dataset resolves)
- Evidence: `page.tsx:126-133` — `useNews({includeInactive:true})`, `useSummaries()`, `useSubjects()`, `useAppeals()`, `useQuizzes()` all instantiated unconditionally in `AdminDashboardContent` (no `enabled` flag keyed on activeTab); `page.tsx:163-177` — `isLoading` is the OR of all five; `page.tsx:315-321` — `if (isLoading || !isMounted) return <spinner/>` replaces the whole `AdminLayout`. Mount cost = up to 7 requests (news, summaries, subjects, appeals list, appeals exact pending-count at `hooks/useAppeals.ts:33-46`, quizzes, plus `/api/admin/metrics` on overview) before anything paints.
- Current: all-tabs-on-mount + full-gate render. · Fix: render `AdminLayout` immediately with a skeleton in `<main>`; pass an `enabled: activeTab===…` (or move hooks into tab components) so only the active tab's data is fetched. · Effort M

### [ADMIN-3] Unbounded `quizzes_with_ratings` select with no LIMIT

- **P1** · Impact M today / H as quiz count grows (it's a ratings-joined view, so row width is fat)
- Evidence: `apps/web/src/hooks/useQuizzes.ts:43-45` — `.from("quizzes_with_ratings").select("*").order("created_at", { ascending: false })` — no `.limit()`, unlike `useNews` (`.limit(30)`, `hooks/useNews.ts:27`) and `useAppeals` (`.limit(30)`). Runs on every admin mount when the 1h module cache is cold.
- Current: full table every cold load. · Fix: `.limit(50)` (+ optional exact count) to match the other admin lists. · Effort S

### [ADMIN-4] Overview analytics refetched with `no-store` on every return to the overview tab

- **P2** · Impact M (every tab round-trip back to overview re-fires a 4-DB/Redis-roundtrip endpoint: admins role check, 14-day message select, exact count, Redis snapshot — `app/api/admin/metrics/route.ts:26-90`)
- Evidence: `AdminAnalyticsPage.tsx:206` — `fetch("/api/admin/metrics", { cache: "no-store" })`; `:233-235` — plain `useEffect` on mount, not TanStack. `page.tsx:233-254` — `renderTabContent()` is a plain switch, so the component unmounts on any tab change and remounts+refetches on return. There is no keep-alive.
- Current: no-store per mount. · Fix: wrap in `useQuery` with `staleTime: 60_000–120_000` (data is counters; 1–2 min staleness is fine for an internal dashboard). · Effort S

### [ADMIN-5] `useQuizzes` is a hand-rolled hook outside TanStack — full-table refetch on every moderation action

- **P2** · Impact M (admin operations latency grows with table size; also inconsistent cache semantics vs the rest of admin)
- Evidence: `hooks/useQuizzes.ts:16-19` (module-level `inflightRequest` + custom `queryCache`, not `useQuery`), `:44` uses `cacheTTL.summaries` (1h, `lib/queryCache.ts:180`) for quiz data, `:97-98` — `updateStatus` does `fetchQuizzes(true)` (skipCache) = full unbounded view refetch per approve/reject click, whereas the other admin hooks use targeted TanStack `invalidateQueries`.
- Current: parallel caching system with per-mutation full refetch. · Fix: port to `useQuery` (key `["admin-quizzes"]`, staleTime 5m) + invalidation like the sibling hooks; then ADMIN-3's limit applies to the single remaining path. · Effort M

### [ADMIN-6] Client-side auth double-gate adds a spinner phase before any admin paint

- **P2** · Impact M (server layout already hard-gates: `admin-dashboard/layout.tsx:23-35` redirects on missing user/admins-row; the client then still shows "checking" until `isMounted` + AuthContext resolves, then redirects non-admins again at `page.tsx:76-81`)
- Evidence: `page.tsx:66-94` — `if (!isMounted || isAuthChecking) return <spinner>`; waterfall = RSC guard → JS boot → mount → AuthContext session resolve → hooks fire (ADMIN-2). The `router.replace` redirect effect is dead weight for the happy path and only fires after AuthContext resolves.
- Current: two sequential gates. · Fix: since the server layout guarantees admin, render `AdminDashboardContent` immediately; keep `useAuth()` only for `adminRole` (used at `page.tsx:117, 256, 303`). · Effort S

### [ADMIN-7] `memo()` wrappers defeated by fresh inline props

- **P2** · Impact L (each admin re-render — e.g., every keystroke in filter state via `useAdminFilters` — re-renders the rendered tab anyway)
- Evidence: `page.tsx:55-60` memoizes six tabs, but `page.tsx:270` passes `onRefresh={() => subjectsHook.fetchSubjects()}` (new identity every render) and `page.tsx:247-249` passes `onNavigate={(tab) => setActiveTab(tab)}` / `onAddNew={() => newsHook.setShowAddNews(true)}` inline. Memo comparisons fail on every parent render.
- Current: memo is decorative. · Fix: `useCallback` those handlers (or drop the memo wrappers). · Effort S

## Healthy areas

- **No admin code leaks into non-admin bundles** (the biggest shared-bundle concern, verified both directions): `components/Layout.tsx:46-54` renders a bare full-viewport div for `/admin*` routes and imports no admin components; `NewsTab.tsx` importers = admin-dashboard page only; `useAdminFilters` and `FilterBottomSheet` are used only by admin files; `[locale]/layout.tsx` only touches `lib/supabase/admin` (server-side). All admin cost is route-scoped to admins.
- **Overview KPIs are 100% derived props** — `AdminOverviewTab.tsx:124-172` computes counts/trends from already-fetched arrays in `useMemo`; no per-table count fan-out queries; the one exception (pending appeals) is a single cheap `head:true` exact count (`hooks/useAppeals.ts:33-46`).
- **Metrics route is lean and correctly gated**: `app/api/admin/metrics/route.ts:27-39` admins-table gate; service-role client used for exactly two count-only reads (`:56-81`) with the tiny-table justification documented (`:50-53`); in-process bucketing of a 22-row table is the right call over RPC.
- **TanStack Query discipline on 4/5 hooks**: staleTime 5m (`useNews`, `useSummaries`, `useSubjects:65`) and 2m (`useAppeals`) — soft navigations back to the admin page reuse cache.
- **Shell chrome is cheap and well-gated**: `AdminShellProvider.tsx` uses a reducer with memoized context value and one-shot hydration; `AdminCommandPalette.tsx:105` and modals (`AddNewsModal.tsx:64`, `AddCourseModal.tsx:93`, `ManageLecturesModal.tsx:52`, `AddSubjectModal.tsx:36`) all return/render nothing when closed; `MobileNav.tsx:68` returns null until ever opened; `NavTooltip` uses a 300ms intent delay; Sidebar is static markup, no framer-motion in the persistent chrome (framer-motion only loads via the gated FilterBottomSheet).
- **Tab switch itself is free of extra data work**: because everything is already in the parent (ADMIN-2's flip side), switching tabs issues no new requests except the ADMIN-4 metrics refetch on overview return.

## Notes

- Answers to the scoped questions: (1) tab *switch* is JS-cheap — the cost is the upfront eager chunk (ADMIN-1), not per-switch loading; (2) all tab data is fetched on mount, not per-tab (ADMIN-2); (3) overview does no client-side count fan-out — it derives from arrays plus one exact-count query; (4) caching is split across two systems: TanStack (5m/2m staleTime) for news/summaries/subjects/appeals, and a 1h module-level `queryCache` for quizzes, while `/api/admin/metrics` has no cache at all (ADMIN-4).
- Data-correctness quirk spotted while verifying (not perf): overview "totalNews" KPI caps at 30 because `useNews` limits to 30 (`hooks/useNews.ts:27`, displayed at `AdminOverviewTab.tsx:225` as `news.length`) — flagging for the owner; no fix applied (read-only audit).
- All priorities weighted per instructions: admin is internal, so none of these are user-facing P0s; the ordering reflects admin UX latency (ADMIN-2 first-paint gate is the most felt) and the fact that non-admin users pay nothing for admin code today.
