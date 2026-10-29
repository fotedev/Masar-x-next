# Wave 6 — Admin (agents 16–18)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 16 — Admin shell + role gating

**1. SEV: Medium — Quiz status change unmounts the entire admin shell**
- LOC: `apps/web/src/app/[locale]/admin-dashboard/page.tsx:163-177,315-321` + `hooks/useQuizzes.ts:16-18,85-101`
- MECHANISM: `isLoading` ORs `quizzesHook.loading`; `useQuizzes` is plain useState `setLoading(true)` on every fetch; `updateStatus` calls `fetchQuizzes(true)` after every approve/reject → page returns the full-screen spinner gate, bypassing AdminLayout.
- SCENARIO: admin approves a quiz → whole shell unmounts (sidebar prefs re-hydrate from localStorage, rail-flash, scroll/focus lost), then remounts. NewsTab/appeals/summaries use TanStack isLoading (isPending-only) so don't trigger this.
- FIX: gate shell on initial-mount only (or convert useQuizzes to TanStack Query). / CONF high / STATUS NEW

**2. SEV: Medium — "Clear filters" can never clear the year**
- LOC: `hooks/useAdminFilters.ts:28-35,85` — default-year effect re-runs whenever `globalFilters.year` becomes falsy and re-applies defaultSemester's level; clearFilters sets year:"" which immediately triggers the effect.
- SCENARIO: "all years" view unreachable while default_semester is set. / FIX: userTouchedYear ref or one-shot default. / CONF high / STATUS NEW

**3. SEV: Medium — Split role sources: server layout trusts `admins` table, client shell trusts stale JWT `app_metadata.role`**
- LOC: `admin-dashboard/layout.tsx:27-35` (table) vs `page.tsx:117` + `AuthContext.tsx:164` + `Sidebar.tsx:67` + `AdminCommandPalette.tsx:45` (JWT claim)
- MECHANISM: grant/revoke synced to raw_app_meta_data by trigger (012_jwt_role_sync.sql:16-37) but client sees it only after token refresh; client redirects to "/" when isAdmin false even though server layout just admitted the user; revoked admin keeps doctor tabs until refresh (API calls 403).
- FIX: pass server-verified role down (or client fetches role). / CONF high / STATUS NEW (adjacent to known is_admin-undefined baseline — distinct site)

**4. SEV: Low — Tablet viewport default leaks into persisted prefs** (`AdminShellProvider.tsx:131-140,144-150` — hydration dispatch flips hydrated → persist effect writes collapsed:true from the 768-1023px matchMedia → same admin on desktop gets the rail). CONF high / STATUS NEW

**5. SEV: Low — Focus trap can lose focus when focus sits on the container** (`useFocusTrap.ts:54,60-78` — zero focusables → container.focus() no-op; forward-Tab branch doesn't match container-focused → Tab escapes drawer). CONF medium / STATUS NEW

**6. SEV: Low — Topbar popovers don't close on Escape; Escape with palette+drawer open closes both** (`AdminTopbar.tsx:82-106`; `MobileNav.tsx:59-66` + `AdminCommandPalette.tsx:113`). CONF high / STATUS NEW

**7. SEV: Low — Locale switch mutates `<html>` before navigation succeeds** (`Sidebar.tsx:72-76` — dir stays flipped if replace interrupted). CONF medium / STATUS NEW

**8. SEV: Low — SubjectCard actions invisible-but-focusable + hardcoded Arabic aria-labels** (`SubjectCard.tsx:46-63, 50,58` — no focus-within reveal; I3). CONF high / STATUS NEW

**9. SEV: Low — I3 violations in shell-adjacent code** (`useQuizzes.ts:66` Arabic confirm; `AdminSidebarItem.tsx:137-139` hardcoded English "more than 99 items"; `NavTooltip.tsx:58-60,145` captures rtl once). CONF high / STATUS NEW

**Clean**: useScrollLock; lib/admin-shell/storage; AdminCommandPalette; AdminOverviewTab; AdminDataTable/StatCard/PageHeader/SkipLink; admin/page redirect; SubjectsTab filters; SemesterAdminControl (optimistic write backed by in-transaction is_admin()-guarded RPC 013:70-107 + realtime listener); api/admin/metrics auth mirrors layout gate; AdminAnalyticsPage trend math + 401/403 handling.

---

## Agent 17 — Admin analytics truthfulness (post PR #146–#152)

**Baseline defect status (2026-10-21 audit):**
1. totalMessages / never-written assistant_messages — **KNOWN-fixed** on the live path (`route.ts:48-70` counts `ai_chat_messages` role='assistant'; 017 fixed the RPC too but that RPC is dead code). NEW defect introduced: F1.
2. Silent zero-fallback on error — **KNOWN-fixed** (explicit error UI 401/403/!ok at `AdminAnalyticsPage.tsx:206-214,226-228`; #150 surfaced insert errors). Residuals: F5, F9.
3. Arabic/SQL vs English/client trend mismatch — **KNOWN-fixed** (017 returns raw action_type; #152 computes trends once client-side from server daily buckets; cards relabeled both locales). Residual: F6.
4. Pending-Appeals KPI — **KNOWN-fixed** (exact head-count pending at `useAppeals.ts:34-46`). Same bug class survives for news (F2).
5. RLS role-blind on analytics — **KNOWN-fixed** (RLS enabled, INSERT-own only, no SELECT; admin reads gated procedurally; new route checks admins row server-side).
6. news/appeals policies only in migrations.old — **KNOWN-active** (zero CREATE TABLE/POLICY for news/appeals/analytics in numbered migrations; only 011 touches via DROP which errors on missing table).

**Findings:**

**1. SEV: High — Assistant-messages metric is RLS-scoped to the viewing admin**
- LOC: `apps/web/src/app/api/admin/metrics/route.ts:29,48-70` + `migrations/009_ai_chat_messages.sql:41-44` + anon-key cookie client
- MECHANISM: `ai_chat_messages` RLS is owner-only (auth.uid() = user_id); the route queries it with the admin's own JWT → totalMessages and assistantMessages daily trend count only the viewing admin's own conversations.
- SCENARIO: two admins — each sees only their own chat counts; the card understates by every other user's chats.
- TRACE: route.ts:29 createClient (anon key, user cookies) → :67 .from('ai_chat_messages').select('id',{count:'exact',head:true}) → RLS 009:41-44 filters to auth.uid()=user_id.
- FIX: read via service-role client (server-side only) or admin SELECT policy. / CONF high / STATUS: NEW (introduced by #152; masked because the sole admin is the dominant chatter) — **[FIXED in PR #155]**

**2. SEV: Medium — Overview "Total News" KPI derived from a 30-row capped list** (`useNews.ts:33-35` → `AdminOverviewTab.tsx:165-172,222-227` — admin page fetches news with `.limit(30)` (admin-dashboard/page.tsx:240); card shows list length → pegs at 30; "new this week" drops older rows). FIX: exact head-count like the fixed appeals KPI. CONF high / STATUS NEW

**3. SEV: Medium — Metric writes detached from the request lifecycle** (`api/metrics/event/route.ts:37-41` + `lib/metrics.ts:114,159,170` runQuietly fire-and-forget — route responds {ok:true} without awaiting Redis pipeline; serverless can cut in-flight pipeline → downloads/AI questions silently undercounted). FIX: await or `after()`. CONF medium / STATUS NEW

**4. SEV: Low — `active_ping` ingestion uncapped** (`route.ts:23-26,39-41`; downloads capped 200/day/user but PFADD pipelines unbounded). CONF high / STATUS NEW

**5. SEV: Low — Transient Redis outage renders as "Redis not configured" + zeros** (`lib/metrics.ts:232-237,196-204` → `AdminAnalyticsPage.tsx:315-319` — read failure indistinguishable from missing env). FIX: separate redisReadFailed flag. CONF high / STATUS NEW

**6. SEV: Low — Partial-day bias in trend badges** (`AdminAnalyticsPage.tsx:60-61` slice(-7) includes today's partial bucket; `metrics.ts:82` UTC day keys vs ar UTC+2/+3). CONF high / STATUS NEW

**7. SEV: Low — Dead write path: user_login/user_logout rows still inserted into Postgres analytics** (`AuthContext.tsx:186+`, `analyticsHelpers.ts:19-25`) — no reader remains (RPC dead; dashboard reads Redis) → unbounded growth. CONF high / STATUS NEW

**8. SEV: Low — Download cap key embeds raw userId in Redis for 40 days** (`metrics.ts:112` `m:rl:${userId}:${dk}`, contradicting "no rows, no identities" claim at :9). FIX: hash the id. CONF high / STATUS NEW

**9. SEV: Low — On count error, `totalMessages: totalMessages ?? recentMessages`** (`route.ts:83`) silently substitutes a 14-day admin-scoped count for the all-time total. FIX: return null + error badge. CONF high / STATUS NEW

**Clean**: Redis key schema (no collision with rate_limit: prefix; TTLs correct; PFADD idempotence; cap-INCR-then-drop sound); no double-fire at trackFileDownload sites; recordAiQuestion once per accepted request across both AI routes; pingActiveUser ref-guarded; auth on both routes solid.

---

## Agent 18 — Admin content tabs + moderation

**1. SEV: High — Course delete: no confirmation, cascades to enrollments + quizzes**
- LOC: `apps/web/src/components/courses/CourseCard.tsx:84`; `hooks/useCourses.ts:134-147`; cascade `migrations/004_content_management.sql:24,33`
- MECHANISM: onClick calls deleteCourseMutation directly — no confirmToast/dialog anywhere.
- SCENARIO: admin misclicks trash → course hard-deleted with all its quizzes (ON DELETE CASCADE) and every enrollment, instantly and irreversibly.
- FIX: gate behind confirmToast like useAppeals.deleteAppeal. / CONF high / STATUS NEW

**2. SEV: High — Pending appeals silently hidden by default global filters**
- LOC: `hooks/useAdminFilters.ts:28-33` (auto-sets year on mount), `:55-81` (filteredAppeals final branch :81)
- MECHANISM: appeals whose content_id can't be resolved (content deleted, or outside cap-30 news/summaries lists) hit `return !globalFilters.subject && !department && !year` — visible only when ALL filters empty. The year filter is auto-filled on mount → such appeals never visible by default.
- SCENARIO: student appeals a deleted summary → admin opens dashboard → appeal invisible, no count reflects it → never reviewed.
- FIX: keep unresolvable-content appeals visible (or "unresolved content" bucket). / CONF high / STATUS NEW (sibling of known cap-30 KPI issue, distinct surface)

**3. SEV: Medium — Admin appeals list capped at 30, mixed statuses** (`useAppeals.ts:24` .limit(30) newest across ALL statuses; pagination paginates ≤30 → pending appeals older than newest 30 unreachable forever). FIX: pending-only fetch or server pagination. CONF high / STATUS NEW (baseline covers KPI only; this is the list)

**4. SEV: Medium — Admin news list capped at 30** (`useNews.ts:35` before includeInactive branch; NewsTab.tsx:63-66 paginates the slice → older items invisible/unmanageable). CONF high / STATUS NEW

**5. SEV: Medium — Appeals status filter vocabulary mismatch (`reviewed`/`closed` never match)** (`AppealsTab.tsx:25-27,52-54`; `AppealsFilters.tsx:9,63,68-71` — filter offers pending|reviewed|closed but app writes pending|accepted|rejected (useAppeals.ts:84,135,145) → reviewed/closed always empty; moderated appeals unauditable). FIX: filter options accepted|rejected. CONF high / STATUS NEW

**6. SEV: Medium — Appeal accept/reject never restores the contested content** (`useAppeals.ts:129-147` — only updates appeal row + notifyUser; no path in web src or migrations re-publishes the summary/news on accepted). FIX: restore on accept or document irreversibility. CONF medium / STATUS NEW

**7. SEV: Medium — Image preview blob URLs revoked while still displayed** (`NewsMediaUploads.tsx:29-39,41-59` — cleanup revokes ALL on every imageFiles change; render's useMemo runs before cleanup → current URLs revoked → previews break; same site as Wave-5 F6, corroborated). CONF high / STATUS NEW

**8. SEV: Medium — Appeal `accepted` vs historical CHECK constraint (same class as enrollment bug)** (`useAppeals.ts:84` writes 'accepted'; old `20251213000000_create_appeals_table.sql:7` CHECK allows pending|approved|rejected only; live table evidently rebuilt — current Row type differs — live constraint unverifiable from repo). FIX: verify live constraint; migrate if present. CONF low / STATUS NEW — **[POST-AUDIT: prod introspection showed NO status CHECK on prod appeals — non-issue live]**

**9. SEV: Low — Stale page after list shrinks (both paginated tabs)** (`NewsTab.tsx:63-66`, `AppealsTab.tsx:67-70` — currentPage never clamped to totalPages). CONF high / STATUS NEW

**10. SEV: Low — Add-news: insert not awaited; files cleared before persistence; no required-field validation** (`useAddNewsForm.ts:102-105` fire-and-forget then clears media; :54-58 only login check; DB allows '' for title/content) → insert failure after media cleared; floating rejection. CONF high / STATUS NEW

**11. SEV: Low — Appeal notify uses `created_by || ""`; failure swallowed** (`AppealCard.tsx:73,86` → `useAppeals.ts:105-112` → `useNotifications.ts:206-207` catch-ignore — legacy null created_by → user_id "" insert fails silently → appellant never notified). CONF high / STATUS NEW

**Clean**: PageManagementTab visibility toggle (correct optimistic+rollback+invalidate); SemesterAdminControl confirm flow; NewsTargetFilters cascades; enrollment filter ids match written statuses; lib/admin-db schema.ts type-only; mutations all invalidate caches; news type values map safely into historical CHECK.
