# Spec 019 — Mobile Parity: Functional Core (v0.6.1)

> Branch: `feat/019-mobile-parity` — **stacked on `feat/018-mobile-launch-readiness`**
> (deviation from "off main", recorded 2026-09-25: main @ `91a4b1a` does not yet
> contain spec 018's vitest/lint/export gates that this spec's execution plan
> depends on; merge 018 first, then 019 rebases trivially).
> Status: **APPROVED in principle by owner 2026-09-25** (two-tier split directive;
> Tier 1 = this spec, Tier 2 = spec 020). C2–C7 execute only after owner
> reviews this spec.
> MVP Lock category: **(2) core study-flow stability + (3) login/essential data**.
> Follows `specs/018_mobile_launch_readiness` (mobile now typechecks, lints,
> tests 18/18, and bundles via `expo export`).

## 0. Scope decision (owner, 2026-09-25)

Two-tier split so the release train keeps moving. **This spec = Tier 1
(Functional Core) only.** Tier 2 (News/Announcements tab, dark mode, summary
reviews/ratings/YouTube embeds) is **deferred to spec 020** and out of scope
here.

Owner implementation notes (binding):
1. **C4 PostgREST `.or()` safety** — subjects filtering copies web's
   `useSubjects` shape verbatim: two SEPARATE chained `.or()` calls (each an
   independent top-level condition, ANDed together), never one merged string;
   C4 includes a verification step diffing the produced query against the web
   implementation before wiring.
2. **C6 timer lifecycle** — countdown derives remaining from `endTimeRef`
   each tick (background-safe by construction), interval cleared on unmount
   and on finish, `finishingRef` blocks duplicate auto-finish, and an
   `AppState` listener re-evaluates on foreground so a backgrounded quiz
   auto-finishes/resumes with exactly one event.
3. **Git cleanliness** — `git add` explicit file paths only, every commit;
   the untracked spec-017 WIP files are never staged.

## 1. Context & problem statement

The Expo app covers five journeys (sign-in, subjects list, summaries list,
quiz play, AI chat) but the core study loop is broken and the app cannot
acquire a new user. All gaps verified on disk 2026-09-24:

| # | Gap | Web reference |
|---|---|---|
| G1 | Tapping a subject does nothing — `SubjectsScreen` renders a plain `View` card; no subject/lecture surface exists | `/subjects/[subject]`: professor info, lecture index, per-lecture explanations (summaries+videos), homework files, exams |
| G2 | No `signUp` call anywhere in `apps/mobile` — a new student cannot create an account from the app | `/signup` → `supabase.auth.signUp({ email, password })` + confirmation-email UX |
| G3 | No forgot-password affordance | Login page: `resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })` |
| G4 | Zero `profiles` access — no level/department/semester; Subjects list is an unfiltered dump | `useEffectiveSemester` + `useSubjects` filter `level.eq.X` / `semester.eq.Y` |
| G5 | AI chat is stateless — closing the app loses the conversation (`AIAssistantScreen` keeps messages in useState only) | Web persists per user+mode (`ai_chat_messages`, 100 cap); guests via localStorage, event-driven writes |
| G6 | No quiz timer (`duration_seconds` never read), no attempts history/review (`quiz_attempts` written but never read) | Countdown with auto-finish; `/quiz-attempts` merge + per-question review |

Non-goals (this spec): push notifications, deep links, OTA, Google OAuth
(T046 — owner-deferred in spec 018), AI streaming (T054a), DB-synced chat
history (local-only here), mark-complete `user_progress` writes (owner:
read-only), title-inference porting (`lecture-inference.ts` stays web-only —
unmatched content lands in an explicit "unclassified" group), StudyWorkspace
(desktop-only by design), news tab / dark mode / summary reviews (spec 020),
client-side login lockout (Supabase server-side rate limiting suffices on
mobile v1).

## 2. Architecture & design

All screens follow existing mobile conventions: local `COLORS` constants
(`theme.ts` stays unused — no refactor under MVP lock), `t(locale, ns, key)`
i18n, `MathText` for math, `Pressable` lists, `useSupabaseQuery` where
stale-while-revalidate fits.

### 2.1 Subject detail + lecture content (G1) — read-only
- **`RootStackParamList` += `SubjectDetail: { subjectName: string }`**; screen
  mounted as a `RootStack.Screen` sibling of `QuizPlay`
  (`headerShown: false, animation: "slide_from_right"`).
- `SubjectsScreen`: card becomes `Pressable` (pattern = `QuizzesScreen.tsx:68`)
  → `navigation.navigate("SubjectDetail", { subjectName: item.name })`.
- **Subject header**: `subjects.select("*").eq("name", subjectName).single()`;
  locale-aware display (ar → `professor_ar ?? professor`, `description_ar ??
  description`); show schedule + location.
- **Lecture index**: `subject_lectures.select("*").eq("subject", subjectName)
  .order("order_index", { ascending: true })` (RLS: authenticated SELECT all).
- **Lecture content** (pure matcher in `src/lib/lecture-content.ts`, unit-
  tested): four parallel queries `.eq("subject", subjectName)` —
  `summaries(id,title,pdf_url,lecture_key,lecture_id,created_at)`,
  `videos(id,title,url,language,lecture_key,lecture_id,created_at)`,
  `files(id,title,file_url,description,lecture_key,lecture_id,created_at)`,
  `quizzes(id,title,description,lecture_id,created_at)` — matched to the
  selected lecture by **`lecture_id` first, then trimmed `lecture_key`
  equality** (empty lecture_key ⇒ `"other"`); anything unmatched lands in an
  explicit "unclassified" group rendered after the matched groups.
- **Actions**: video → `Linking.openURL(url)` (native YouTube app/browser);
  file → `Linking.openURL(file_url)`; summary → `Linking.openURL(pdf_url)`
  when present; quiz → `navigation.navigate("QuizPlay", { quizId, title })`.
- **Shared types update (I2)**: add the live-drift columns `lecture_key`,
  `lecture_id` to the hand-maintained `files` Row in
  `packages/shared/src/types/database.ts` (live table has them; drift
  documented in the migration 009 header + rls-audit).

### 2.2 Auth completions (G2, G3)
- **`SignUpScreen`** (new RootStack screen, pushed from a "create account"
  link on Login): email + password + confirm-password; min-6 + mismatch
  validation mirrors web; `supabase.auth.signUp({ email, password })` — plain
  call, **no options** (web parity; confirmation-email flow, no auto-login).
  Success → confirmation-sent notice + back to Login. Error mapping:
  already-registered (message regex) → dedicated string; else generic.
- **Forgot password**: link on `LoginScreen` → inline two-phase email state
  (same screen, like web's inline form) →
  `resetPasswordForEmail(email, { redirectTo: `${WEB_ORIGIN}/reset-password` })`
  → "check your email" state. The redirect URL is already allowlisted in the
  Supabase dashboard (web uses exactly it today).
- **`WEB_ORIGIN` config**: `app.config.js` reads `EXPO_PUBLIC_WEB_ORIGIN`
  (default `https://masarx.vercel.app`) into `extra.webOrigin`; consumed via
  the existing `MasarxExtra` pattern.
- **i18n**: import the existing **`authPages`** shared namespace (9th) — all
  needed keys already exist verbatim (`signUp`, `signupConfirmationSent`,
  `signupEmailAlreadyRegistered`, `signupGenericError`, `passwordMismatch`,
  `passwordMinLength`, `confirmPasswordLabel`, `forgotPassword`,
  `forgotPasswordSubtitle`, `sendResetLink`, `sending`, `resetLinkSent`,
  `resetRequestFailed`, `emailRequiredForReset`, `noAccountPrompt`,
  `createNewAccount`, `alreadyHaveAccountPrompt`, `goToLogin`). MOBILE_STRINGS
  gains nothing unless a mobile-specific string is unavoidable.
- `AuthContext` untouched (the status machine already handles the resulting
  `SIGNED_IN` event).

### 2.3 Academic profile + subject filtering (G4)
- **ProfileScreen: "Academic path" card** (between Language and PDF upload):
  level (1–4) → department (filtered by
  `departments.academic_level_id === selectedLevel.id`) → semester (1–3).
  Options data: `academic_levels(id,name,level_number,is_active,sort_order)` +
  `departments(id,academic_level_id,name,is_active,sort_order)` (port of
  `useAcademicOptions`' queries).
- Read: `profiles.select("level, semester, department_id").eq("id", user.id)
  .maybeSingle()`. Save: `profiles.update({ level, semester, department_id })
  .eq("id", user.id)` (RLS `profiles_update_own`).
- **SubjectsScreen filtering**: extend the select with `level`, `semester`,
  `is_academic`, `show_on_home`; resolution = `profile.semester (valid 1–3)
  ?? 1`; filtering per owner note #1 — web's exact two chained `.or()` calls:
  `.or('level.eq.{L},level.is.null')` and
  `.or('semester.eq.{S},semester.is.null')`, each an independent top-level
  condition (ANDed), verified against `useSubjects` before wiring. Mobile has
  no platform-settings default and no guest semester UI (spec 020 candidate).
- Mobile guests never reach this surface (auth gate signs out first); the
  guest quiz chip stays defensive-only.

### 2.4 AI chat local history (G5) — local-only, event-driven
- **`src/lib/chat-history.ts`**: `loadChatHistory()` / `saveChatHistory(msgs)`
  / `clearChatHistory()` over AsyncStorage key **`masarx_ai_chat_cs_assistant`**
  (deliberately NOT under the `masarx_read_cache_` prefix — avoids
  `cacheClearAll` wipes and TTL semantics; chat must not expire).
- Persisted shape = the screen message minus transient `pending`:
  `{ id, role, text, failed?, retryText? }`; **cap 100** (drop oldest).
- **Event-driven writes only** (repo lesson 2026-09-16 #14): a
  `pendingPersistRef` is raised exclusively by real append/finalize/failure
  events and consumed once by the persist effect; mount, clear, and
  auth-transition commits write nothing — deletion happens only in
  `clearChat` (removes the key). Zero writes on mount by construction.
- Load-on-mount: the existing effect at `AIAssistantScreen.tsx:66` gains the
  restore (single `setMessages` once loaded). `clearChat` also clears the key.
- Sign-out keeps history on device (web-guest parity); no `ai_chat_messages`
  DB sync in this spec.

### 2.5 Quiz timer + attempts review (G6)
- **Timer** (owner note #2): `fetchQuizWithQuestions` also selects
  `quizzes.duration_seconds`. If `> 0`: `endTimeRef = start + duration*1000`;
  1s interval renders remaining mm:ss computed from `endTimeRef` each tick
  (background-safe by construction); at 0 → clear interval, auto-finish
  through the SAME finish path; `finishingRef` guard prevents double-finish;
  interval cleared on unmount; `AppState` listener re-evaluates remaining on
  foreground so a backgrounded quiz resolves with exactly one event.
  `time_taken_seconds` is computed and passed to `finishAttempt` (signature
  extended — column exists in `QuizAttemptRow`), and `finishAttempt`
  additionally writes the `answers` jsonb (web parity:
  `{question_id, selected_option, is_correct}[]`).
- **Attempts history**: `RootStackParamList += QuizAttempts: undefined`;
  entry link in the `QuizzesScreen` header ("previous attempts").
  - Signed-in: `quiz_attempts.select("*, quizzes(title)").eq("user_id",
    user.id).order("created_at", { ascending: false })` (RLS: own only).
  - Local: guest results enumerated by AsyncStorage key scan
    (`quiz_guest_result:` prefix via `getAllKeys`); `GuestResult` extended
    with `{ title, timeTakenSeconds, answers: {questionId, selected,
    isCorrect}[] }` so local attempts are reviewable too (existing 30-day
    TTL `cacheSet` envelope unchanged).
  - Merge + dedup by id (DB wins), newest first.
- **Review (basic)**: expandable attempt → `fetchQuizWithQuestions`, join
  stored answers by question_id, render per question: question text via
  `MathText`, selected option highlighted correct/incorrect, correct answer,
  explanation via `MathText` (no stats cards — web polish).
- **i18n**: import the existing **`quizAttempts`** shared namespace (10th);
  MOBILE_STRINGS for timer + history chrome only.

## 3. Behavior preservation & regression strategy

- Existing screens keep their data paths; `SubjectsScreen` changes are
  additive (extra columns + Pressable + filters). Summaries / Quizzes / AI /
  Profile tabs keep their current fetchers except Profile (one new card) and
  Subjects (filter clause).
- `finishAttempt`/`saveGuestResult` signature extensions are additive with
  defaults; existing call sites updated in the same commit.
- Shared-package changes limited to the hand-typed `files` Row (additive
  columns) — web compiles against the same types and is the guard.
- No new user-facing strings invented where shared keys exist (`authPages`,
  `quizAttempts` reused verbatim).
- i18n registry follows the three-point contract (shared JSON on disk +
  registry import + usage); no NEW namespaces created.
- AI boundary untouched (no provider imports; Edge Function path unchanged;
  `ai-endpoint-grep` + mobile ESLint rule stay green).

## 4. Test specification (mobile vitest, pure logic only)

| Suite | Scenarios |
|---|---|
| `lecture-content.test.ts` | lecture_id match wins over lecture_key; trimmed key equality; empty key ⇒ "other"; unmatched rows grouped; four content kinds mapped |
| `chat-history.test.ts` | round-trip; 100-cap drops oldest; `pending` messages excluded; clear removes key; malformed stored JSON ⇒ empty |
| `signup-validation.test.ts` | min-6 rule; mismatch rule; already-registered error mapping |
| `quiz-timer.test.ts` | remaining computation from endTime; 0 ⇒ auto-finish flag once (guard); foreground re-evaluation math |
| existing suites | secure-store-text, read-cache, ai bearer stay green |

Gates per commit: mobile `typecheck` + `lint` + `test` + `export`;
`masarx-shared` + `desktop` typecheck; web `typecheck` when shared types
change — red is acceptable ONLY in the pre-existing untracked spec-017 WIP
paths (`src/lib/ai/providers/**`), which must be verified and ledgered, never
fixed by this spec.

## 5. Atomic execution plan

| # | Commit | Contents | Extra gates |
|---|--------|----------|-------------|
| C1 | `docs(specs): add specs/019 mobile parity core` | this spec + tasks.md | docs-lint |
| C2 | `feat(mobile): subject detail with lecture content` | §2.1 + lecture-content tests + shared `files` types | web typecheck (shared types touched) |
| C3 | `feat(mobile): signup + forgot password` | §2.2 + authPages import + validation tests | — |
| C4 | `feat(mobile): academic path + filtered subjects` | §2.3 incl. owner note #1 verification step | — |
| C5 | `feat(mobile): AI chat local history` | §2.4 + chat-history tests | — |
| C6 | `feat(mobile): quiz timer + attempts review` | §2.5 + quizAttempts import + timer tests | — |
| C7 | `chore(mobile): release 0.6.1` | version bump (package.json + app.json) | full gate suite |

Staging discipline (owner note #3): only files under `apps/mobile/`,
`packages/shared/src/types/database.ts`, `specs/019_*` are ever staged —
explicit paths on every `git add`; the untracked spec-017 web files are never
touched. Re-check `git log` before each commit (parallel-session rule).

## 6. Version

`0.6.0` → **`0.6.1`** (functional-core increment; Tier 2 / spec 020 targets
`0.7.0`).
