# Wave 9 — Cross-cutting web (agents 25–27)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 25 — i18n/RTL

**1. SEV: High — Missing locale prefix in programmatic nav (NEW site)**
- LOC: `apps/web/src/app/[locale]/courses/page.tsx:208` — `router.push(\`/courses/${course.id}\`)` with next/navigation router; zero locale awareness in the file (every sibling site manually prepends /${locale}).
- SCENARIO: user on /ar/courses clicks a card → pushes /courses/:id → middleware 307-redirect via cookie/Accept-Language — first-visit ar user (no NEXT_LOCALE cookie) can be dumped on /en.
- FIX: add useLocale() and prefix. / CONF high / STATUS NEW

**2. SEV: Medium — Arabic ICU plurals missing zero/two/few/many categories** (`packages/shared/src/messages/ar/desktopStudyWorkspace.json:13-16` — `{count, plural, one{…} other{…}}` only; ar CLDR needs 6 categories; `2 ملف` instead of ملفان; ar/adminDashboard.json:142 does all six correctly — proving intent). CONF high / STATUS NEW

**3. SEV: Medium — LectureHero back arrow + divider RTL-only correct (inverted in LTR)** (`LectureHero.tsx:62` ArrowRight back button + `:127` lg:border-r — no rtl:/ltr: variants; parent LectureDetailView HAS isRTL and passes to LectureExamsSection but not here; en users: back points forward, divider hugs far edge). FIX: isRTL prop or rtl:rotate-0 ltr:rotate-180; lg:border-s. CONF high / STATUS NEW

**4. SEV: Medium — LectureCard hardcodes text-right and left-pointing chevron** (`dashboard/LectureCard.tsx:38,46,47` — physical CSS + fixed icon; internally inconsistent with text-start at :28). CONF high / STATUS NEW

**5. SEV: Medium — Hardcoded "ar-SA" locale for home video dates (Hijri calendar)** (`VideosSection.tsx:142` — ar-SA defaults to Islamic calendar + Arabic-Indic digits for BOTH locales; rest of app uses ar-EG Gregorian). FIX: locale-conditional ar-EG/en-US. CONF high / STATUS NEW

**6. SEV: Low — Chat bubble RTL "mirror" logic is a no-op** (`ChatMessageItem.tsx:602-606` — XOR of isUser/isRTL yields same physical geometry in both locales since justify-start IS right edge in RTL; only the rounded-tl/tr tail mirrors). Design intent unknowable — either drop the XOR or use logical properties. CONF medium / STATUS NEW

**7. SEV: Low — global-error.tsx: hardcoded English, no lang/dir** (`global-error.tsx:15-20`; errorBoundary namespace unused). CONF high / STATUS NEW (overlaps Agent 27 finding 1)

**8. SEV: Low — proxy.ts duplicates routing config (drift risk)** (`proxy.ts:8-13` vs `i18n/routing.ts:6-11` copy-pasted defineRouting; routing.ts is middleware-safe to import). CONF high / STATUS NEW

**9. SEV: Low — NavTooltip rtl state goes stale after soft language switch** (`NavTooltip.tsx:58-64,145` — captured once on mount; LanguageToggle flips dir without reload → tooltip translated off by its own width). CONF high / STATUS NEW (corroborates Wave-6 #9)

**10. SEV: Low — Browser-locale-dependent number formatting in admin UI** (`AdminOverviewTab.tsx:420`, `StatCard.tsx:49` — bare toLocaleString() vs deliberate ar-EG/en-US at AdminAnalyticsPage.tsx:116). CONF high / STATUS NEW

**11. SEV: Low — i18n-audit.mjs blind spots** (no placeholder/ICU-arg cross-locale diff; iterates arDir only — en-only files invisible; no plural-category lint for Arabic; no MESSAGE_LOADERS coverage assert; no JSON dup-key detection). CONF high / STATUS NEW

**Clean**: full ar/en flat-key + placeholder + ICU-arg parity 0 mismatches (scripted, 47×2); routing.ts/request.ts/layout dir logic; quiz arrows/MobileNav/DesktopNav/DashboardHero/DesktopAppBanner all correctly mirrored; both not-found pages; interpolation spot-checks pass.

---

## Agent 26 — Async/state correctness sweep

**queryCache engine (beyond the 2 known invalidation bugs):**

**1. SEV: Medium — localStorage persistence has no schema/version salt** (`lib/queryCache.ts:18-28,50-62,104` — persistable keys stored raw with only timestamp/ttl; deployed shape changes serve old-shape data for up to TTL across deploys; academic_options_v2 only escaped via manual version bump). FIX: schema-version in persistable key names. CONF high / NEW

**2. SEV: Medium — no cache purge on auth transitions (engine + wiring)** (`contexts/AuthContext.tsx:314-325` signOut, `:153-210`; `QueryProvider.tsx:10-32` no reset) — react-query cache and queryCache survive logout/login in same tab: RLS-scoped appeals list (staleTime 2m + gcTime 30m, up to 30 rows) and enrollments_all (10m) briefly render to the prior user's role after account switch. FIX: on SIGNED_OUT/SIGNED_IN queryClient.clear() + invalidatePrefix(""). CONF high / NEW — **[FIXED in PR #155]**

**useNotifications:**

**3. SEV: Medium — mark-read/delete mutations never invalidate the notifications cache** (`useNotifications.ts:90-152` — DB write + local setState but 1-min TTL cache entry resurrects unread counts on remount within 60s). FIX: queryCache.delete in each mutation. CONF high / NEW

**4. SEV: Medium — shared realtime channel torn down by any one of multiple concurrent hook instances** (`useNotifications.ts:281` channel name, `:330-344` cleanup; realtime-js dedupe verified node_modules :338-347; hook instantiated independently in useAppeals.ts:14, AppealFormModal.tsx:27, news/page.tsx:37 + bell — one unmount unsubscribes the shared channel object; surviving instance silently stops receiving INSERTs). FIX: refcount subscribers per channel name. CONF high / NEW

**5. SEV: Low — StrictMode/re-run teardown race + post-unmount retry leak in realtime setup** (`:266-268` shared setup promise; `:306-317` retry setTimeout — cleanup1 unsubscribes channel created for effect2; LockManager failure after unmount creates an unsubscribed-forever channel). CONF high / NEW

**Other hooks:**

**6. SEV: Medium — useReviews contentId race, last-resolved wins** (`useReviews.ts:21-48,151-153` — no abort/last-request guard; slow old-contentId fetch overwrites new). CONF high / NEW

**7. SEV: Low — useSummaries queryFn swallows all errors as success** (`useSummaries.ts:27-30` catch returns [] → react-query sees success: no retry, no error state, admin panels act on false empty). CONF high / NEW

**8. SEV: Low — useAcademicOptions includeInactive flip race** (`useAcademicOptions.ts:85-151` — last-RESOLVED not last-requested writes state). CONF high / NEW

**9. SEV: Low — useManageLectures invalidations target never-set key** (`:107,141,162` invalidate `lectures_<name>`; grep: no set for that key — dead no-ops). CONF high / NEW

**10. SEV: Low — LectureContentModal invalidates never-set keys videos_all/files_all** (`:77-79,97-99`; keys defined but never populated — same dead-invalidation cluster as KNOWN quizzes no-op). CONF high / NEW

**11. SEV: Low — realtime settings update bypasses queryCache** (`PlatformSettingsContext.tsx:224-227` sets state + raw localStorage only vs `:158` fetch path writes cache_platform_settings → fallback-mode mounts read old default semester up to 24h). CONF high / NEW

**12. SEV: Low — no-unmount-guard fetches (systemic, worst: useVideoRatings.ts:9-32 useTopVideos, useQuizPlayerData.ts:77-79).** CONF high / NEW

**13. SEV: Low — useAdminFilters derives default year by array index** (`useAdminFilters.ts:28-35` levels[defaultSemester-1] on sort_order-ordered active-only list — silently preselects wrong level; logic not async). FIX: match on level_number === defaultSemester. CONF high / NEW

**Clean**: useEffectiveSemester, useChatScroll (thorough cleanup incl. ResizeObserver), useCoursesFilter, useAnalytics, useNews, useEnrollments, useQuizzes (self-consistent), useQuizPlayerRuntime (timer/finishingRef), useAddSubjectForm, useEditSummary, useAddNewsForm, useContentForm, useSubjectModals, useFocusTrap, useScrollLock, QueryProvider config, trw/*, and the elsewhere-audited hooks.

---

## Agent 27 — Error handling & resilience

**1. SEV: High — No route-level error boundary anywhere; global-error.tsx is an unrecoverable dead end**
- LOC: `apps/web/src/app/global-error.tsx:10-20`; verified ZERO error.tsx files under apps/web/src/app
- MECHANISM: global-error renders hardcoded English "Something went wrong!", no reset prop, no retry, no dir/RTL, no reporting.
- SCENARIO: any render error in any segment replaces the whole app with an English LTR page; only escape is manual reload.
- FIX: localized [locale]/error.tsx (reset + useTranslations + dir-aware); global-error minimal with retry link. CONF high / STATUS NEW

**2. SEV: Medium — Client-side error monitoring is a no-op; logger imported client-side can never forward**
- LOC: `lib/logger.ts:125-126` (`process.env.SENTRY_DSN`, not NEXT_PUBLIC_); client importers Header.tsx:11, AcademicOnboardingGate.tsx:4, LectureSelect.tsx:5, useNotifications.ts:6; AIErrorBoundary.tsx:25-27 and global-error.tsx:11 use bare console.error; no @sentry in apps/web/src
- MECHANISM: client bundle SENTRY_DSN undefined → sendToMonitoring returns early → ZERO client crash/error visibility in production.
- FIX: browser reporting path (NEXT_PUBLIC DSN + client flag or beacon endpoint) or stop importing server logger into client components. CONF high / STATUS NEW

**3. SEV: Medium — Unguarded `new Notification()` throws; converts a successful summary update into a false error**
- LOC: `components/notifications/NotificationProvider.tsx:104` (no try/catch); consumer `edit-summary/page.tsx:160` inside update try whose catch sets setError(updateError); second consumer NotificationToggle.tsx:42-46
- MECHANISM: Android Chrome throws TypeError on the constructor when a SW controls the page; throw occurs AFTER setSuccess(true) and DB commit → user sees "update failed" for a successful save.
- FIX: wrap in try/catch inside sendNotification; move call out of the update try. CONF high / STATUS NEW

**4. SEV: Low — SW notification path silently drops when no controller exists** (`NotificationProvider.tsx:106` optional-chained postMessage, no fallback on first load). CONF high / STATUS NEW

**5. SEV: Medium — Unguarded JSON.parse of localStorage in NotificationSettings can crash the whole app** (`NotificationSettings.tsx:19` — throws in mount effect → global-error dead end (feeds finding 1); all other JSON.parse sites checked are guarded — this is the only unguarded one). CONF high / STATUS NEW

**6. SEV: Medium — useNotifications swallows every CRUD failure; user actions fail with zero feedback** (`useNotifications.ts:80,103,126,149,206` all `catch { // ignore }` — mark-all-read/delete fail silently; failed fetch renders empty list indistinguishable from none). CONF high / STATUS NEW

**7. SEV: Low — `void clearChat()` unhandled rejection + false success** (`ai-assistant/page.tsx:236` → `useAiChat.ts:428-439` — on network failure: unhandled rejection, local cleared, DB rows survive → chat resurrects after reload). CONF high / STATUS NEW

**8. SEV: Low — AssistantPanel clears the draft before the send completes** (`AssistantPanel.tsx:82-84` setDraft("") before await sendMessage via void submitDraft — failure loses typed text). CONF high / STATUS NEW (distinct from the page's Enter-wipe bug)

**9. SEV: Low — Puter diagnostics suppression patterns are globally over-broad** (`lib/puter.ts:223, 229-279` — console.error/warn monkey-patched + error/unhandledrejection listeners call preventDefault for /transport|polling|websocket/i matches against message OR stack → unrelated rejections silenced app-wide; distinct from the baseline null-safety fix). FIX: narrow to Puter frame origins. CONF high / STATUS NEW

**Clean/benign**: logger.ts Sentry envelope catch is by-design best-effort with console fallback; both not-found pages localized+RTL-aware; ThemeScript empty catch benign; desktop-UI/telemetry fire-and-forget benign; no loading dead ends (all resolve via finally); PlatformSettings has own error boundary + typed fallback; AIErrorBoundary functional (but fallback text hardcoded Arabic — I3, Low NEW).
