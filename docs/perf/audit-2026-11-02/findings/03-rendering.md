# 03 — React Rendering & Re-render Coupling

> Subagent auditor #3, 2026-11-02. Domain: apps/web provider stack, context memoization, list/derived-render costs. Cross-checked: AuthContext claims corroborated by auditor #16 (AUTH), admin memo wrappers by auditor #9 (ADMIN).

## Findings

### [RENDER-1] AuthContext value is an unmemoized object literal — every auth event re-renders ~35 consumers (recurring)

- **P1 · Impact H** — The audit doc's "unmemoized context providers" flag is still true for Auth. Supabase `onAuthStateChange` fires on every `TOKEN_REFRESHED` (window focus + scheduled refresh) and at boot (`INITIAL_SESSION` + `getSession` resolution); each event calls `setSession`/`setUser` with **fresh object identities** even when nothing changed, and the context value is rebuilt as a literal on every render. All `useAuth()` consumers re-render each time — including the hot `/ar/quizzes` page (`QuizDashboardInternal` is a consumer), Header, admin-dashboard, profile, subjects page, and shared hooks (`useSubjects`, `useQuizAttempt`, `useUserAcademic`, `useAppeals`). This adds a full consumer re-render pass immediately after the quizzes page's client mount (it is `dynamic(..., { ssr: false })`), compounding the measured TBT 2.08s.
- **Evidence:** `apps/web/src/contexts/AuthContext.tsx:338-351` — `value={{ user, session, profile, isAdmin, loading, signIn, signUp, signInWithGoogle, signOut }}` (plain literal; `signIn`…`signOut` are re-created plain functions, not `useCallback`); `AuthContext.tsx:159-161` — `setSession(currentSession); const currentUser = currentSession?.user ?? null; setUser(currentUser);` runs unconditionally for **every** event; `AuthContext.tsx:125-151` — post-hydration `getSession` → `setSession/setUser/setLoading`. Consumer count: 35 files grep'd (e.g. `apps/web/src/components/Header.tsx:25` — its `memo()` wrapper is defeated by the context change; `apps/web/src/app/[locale]/quizzes/page.tsx:85`).
- **Current:** literal value, identity churn per event. **Fix:** `const value = useMemo(() => ({ user, session, profile, isAdmin, loading, signIn, signUp, signInWithGoogle, signOut }), [user, session, profile, isAdmin, loading])` + `useCallback` handlers (`signInWithGoogle` depends on `locale`); in the auth listener, skip `setUser/setSession` when `event === "TOKEN_REFRESHED"` and the user id is unchanged (or store only the id-derived fields). **Effort: S**

### [RENDER-2] Quiz grid re-renders in full on every keystroke and every auth event — no memo on list items

- **P1 · Impact M-H** (on the worst-measured page) — The search filter, any filter change, modal open/close, and any `useAuth` value change (RENDER-1) all re-render `QuizDashboardInternal`, which re-renders every `QuizGridItem` (inline handler props change identity too).
- **Evidence:** `apps/web/src/app/[locale]/quizzes/page.tsx:315-324` — inline `onPlay={(q) => router.push(...)}`, `onEdit={handleEditQuiz}` (plain fn), `onDelete`; `apps/web/src/app/[locale]/quizzes/_components/QuizzesList.tsx:54-76` — plain `quizzes.map(...)`, no `memo`; `apps/web/src/components/quizzes/QuizGridItem.tsx:22` — `export function QuizGridItem(...)`, no `memo` (125 lines/item, lucide icons each).
- **Current:** full grid reconciliation per render. **Fix:** `memo(QuizGridItem)` + `useCallback` for `onPlay/onEdit/onDelete` in the page (router is stable). **Effort: S**

### [RENDER-3] PlatformSettings `loading` flip double-renders all `useSubjects` consumers at boot

- **P2 · Impact M** — `fetchSettings` sets `loading: true` then `false`, mutating the memoized value twice per fetch (initial load + any cache-miss refetch). `useEffectiveSemester` consumes this context and is embedded in `useSubjects`, which feeds the quizzes page, subjects page, and admin dashboard — so the boot sequence costs 2+ extra render passes over those trees right after hydration.
- **Evidence:** `apps/web/src/contexts/PlatformSettingsContext.tsx:121-124` (`setLoading(true)` at top of every fetch), `:252-258` (value memo deps include `loading`), consumers: `apps/web/src/hooks/useEffectiveSemester.ts` → `apps/web/src/hooks/useSubjects.ts:5,28,31`.
- **Current:** loading participates in the shared value. **Fix:** read the cache synchronously in `useState` initializer so the first fetch is a silent background refresh (no `setLoading(true)` when a cached value exists); or split `loading` into a separate context. **Effort: S**

### [RENDER-4] ThemeContext value unmemoized (recurring) — but blast radius is small

- **P2 · Impact L** — Still unfixed from the audit doc, but verified the feared "theme flip → full tree" chain does **not** exist today: only `components/ThemeToggle.tsx` consumes `useTheme()`, and provider children props are referentially stable so no cascade runs through NotificationProvider/Layout. Cost is limited to ThemeToggle re-renders on theme flip and a double consumer render at mount (`setTheme` + `setMounted`).
- **Evidence:** `apps/web/src/contexts/ThemeContext.tsx:54` — `value={{ theme, toggleTheme }}`; `:49-51` — `toggleTheme` re-created per render; `:25-33` — mount effect fires two `setState`s. Grep confirms single consumer (`components/ThemeToggle.tsx`).
- **Current:** literal value. **Fix:** `useMemo` value + `useCallback` toggle (cheap hygiene; also future-proofs if more consumers appear). **Effort: S**

### [RENDER-5] NotificationProvider value unmemoized (recurring) — 20s prompt flip re-renders consumers

- **P2 · Impact L-M** — Value literal rebuilt every render; `setShowPrompt(true)` fires 20 s after page load, and mount effects set `isSupported`/`permission`, each producing a new value → re-renders of `NotificationPrompt`, `NotificationSettings`, `NotificationToggle`, and the edit-summary page. No cascade into the tree (stable children), so impact is bounded.
- **Evidence:** `apps/web/src/components/notifications/NotificationProvider.tsx:118-125` (literal value), `:57` (`setTimeout(() => setShowPrompt(true), 20000)`), `:44-61` (mount state flips).
- **Fix:** `useMemo` value + `useCallback` handlers. **Effort: S**

### [RENDER-6] Admin-dashboard `memo()` wrappers defeated by inline-lambda props

- **P2 · Impact M** (admin-only surface) — Tab components are correctly wrapped in `memo()`, but nearly every prop passed to them is an inline arrow or plain function, so memo never bails: any modal open/close or filter keystroke in `AdminDashboardContent` re-renders the active tab and all 4 mounted modals.
- **Evidence:** `apps/web/src/app/[locale]/admin-dashboard/page.tsx:55-60` (`const MemoizedSubjectsTab = memo(SubjectsTab)` etc.); defeated by `:270` `onRefresh={() => subjectsHook.fetchSubjects()}`, `:337` `onAddNew={() => newsHook.setShowAddNews(true)}`, `:382-385 / :392-395 / :402-405` inline `onClose={() => {...}}` on `AddCourseModal`/`AddSubjectModal`/`ManageLecturesModal`, and plain-function handlers `:200-231` (`handleCreateSubject`, `handleSaveSubject`, `handleManageLectures`).
- **Fix:** `useCallback` all handlers passed to memoized tabs/modals (deps are stable hook objects). **Effort: M**

### [RENDER-7] Profile page: 814-line monolith — typing in the display-name input re-renders everything

- **P2 · Impact M** — ~13 `useState` hooks live in one component; every keystroke in `newDisplayName` (or toggling edit/save states) re-renders the whole page including `NotificationSettings`, `AdminProfileImage`, the levels `.map()` (line 571) and the departments filter/`.map()` chain (601-610) which are unmemoized and re-execute per render. `useUserAcademic()` is also called twice, creating duplicate subscriptions.
- **Evidence:** `apps/web/src/app/[locale]/profile/page.tsx:96-111` (state cluster), `:571` and `:601-610` (inline `.map`/`.filter` in JSX, no `useMemo` — only `cooldownRemaining` at `:117` is memoized in the whole file), `:87-94` (double `useUserAcademic()` call).
- **Fix:** extract the edit form into its own component owning the input state; `useMemo` the departments filter; drop the duplicate hook call. **Effort: M**

### [RENDER-8] Subjects page: duplicate inline lecture mapping alongside a memoized one

- **P2 · Impact L** — Line 524 re-maps `subjectLectures` inline in JSX, duplicating work already memoized at lines 110-137 (`lectureIndex`), executed on every render of the 548-line page.
- **Evidence:** `apps/web/src/app/[locale]/subjects/[subject]/page.tsx:524` vs `:110-137`.
- **Fix:** reuse the memoized array. **Effort: S**

## Healthy areas

- **`PlatformSettingsContext`** value properly memoized with correct deps (`PlatformSettingsContext.tsx:252-258`) + `useCallback` `fetchSettings` + error boundary — only the `loading` flip (RENDER-3) is suboptimal.
- **`AdminShellProvider`** (`admin-shell/AdminShellProvider.tsx:152-175`) is exemplary: `useReducer`, stable `useCallback` actions, `useMemo` value — do not touch.
- **`useQuizzesFilters`** (`quizzes/_hooks/useQuizzesFilters.ts:55,103,109,121,180`): all derived state (`quizzesWithMeta`, `filterOptions`, `filteredQuizzes`) fully memoized; the per-quiz `JSON.parse` runs only on data change.
- **Admin tab composition**: `memo()` intent is right (RENDER-6 is a props problem, not a structure problem); `isLoading` memoized (`admin-dashboard/page.tsx:163-177`).
- **Layout chrome**: route-based splitting (`Layout.tsx:36-61`), Header/Footer dynamically imported with skeleton fallback; route classification is plain string ops, no state.
- **Quizzes page structure**: hook decomposition (`useQuizzesData/Filters/Modals/FormState`) with modals dynamically imported — good bones; only list-item memoization is missing.

## Notes

- Prioritization for the measured numbers: the `/ar/quizzes` TBT (2.08s) is dominated by client-mount cost (page is `dynamic ssr:false` at `quizzes/page.tsx:69-76`), then by **post-mount state resolution cascades**: RENDER-1 (auth `getSession` + `INITIAL_SESSION`) and RENDER-3 (platform-settings loading flip) each force full re-render passes over the same freshly-mounted tree within the first second. Fixing RENDER-1 + RENDER-2 is the highest-leverage pair and both are Effort S.
- "Theme flip → full tree" (the chain the audit doc feared) was **not** confirmed — ThemeContext has a single consumer today; RENDER-4 remains as hygiene only.
- Interaction-time re-render costs (unmeasured, reasoned from code): quiz-grid typing (RENDER-2), admin filter typing (RENDER-6), profile-name typing (RENDER-7).
