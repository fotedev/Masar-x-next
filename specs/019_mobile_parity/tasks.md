# Spec 019 — Tasks

Execution ledger. Tier 1 only (owner two-tier split 2026-09-25). Every task:
verify with the gates in spec.md §5 before marking ✅. Owner binding notes:
C4 `.or()` verification (#1), C6 AppState timer lifecycle (#2), explicit-path
staging on every commit (#3).

## C1 — Spec landing
- [x] T076 `specs/019_mobile_parity/{spec.md,tasks.md}` committed.

## C2 — Subject detail + lecture content (G1, read-only)
- [x] T077 **CORRECTED during execution:** the hand-typed `packages/shared` Database has NO `files`/`videos` tables at all, and the shared client is schema-loose (no Database generic) — mobile already uses local row interfaces for such tables (`src/types/quiz.ts` precedent). C2 therefore defines local interfaces in `lib/lecture-content.ts` + the screen; **no shared edit, no web-typecheck dependency**. Spec §2.1's premise amended here rather than silently.
- [x] T078 `src/lib/lecture-content.ts` pure matcher (lecture_id → trimmed lecture_key → "other"; keyless rows never key-match — web line-90 guard preserved) + global grouping with id-priority + `lecture-content.test.ts` (10 tests; the grouping test caught a list-order bug in the first draft — id must win globally, not by find-order).
- [x] T079 `SubjectDetailScreen`: locale-aware subject header (professor/schedule/location/description) + lecture chips (`subject_lectures` by order_index) + per-lecture groups (summaries w/ PDF open, videos, files via `Linking.openURL`; quizzes → QuizPlay) + always-visible "unclassified" section when non-empty; single fetch-per-subject grouped client-side (instant lecture switching).
- [x] T080 wiring: `RootStackParamList.SubjectDetail`, RootStack mount (slide_from_right, headerShown false), `SubjectsScreen` card → Pressable navigate with pressed state.
- [x] T081 gates: mobile typecheck ✅ · lint ✅ · vitest 28/28 ✅ · `expo export` ✅ · shared exit=0 · desktop exit=0.

## C3 — Signup + forgot password (G2, G3)
- [x] T082 `app.config.js`: `EXPO_PUBLIC_WEB_ORIGIN` → `extra.webOrigin` (default `https://masarx.vercel.app`); typed consumption via `MasarxExtra` + exported `WEB_ORIGIN` in `src/lib/supabase.ts`.
- [x] T083 i18n registry: `authPages` imported as the 9th namespace (three-point contract; zero new translations — all keys existed verbatim).
- [x] T084 `SignUpScreen` (email/password/confirm; `validateSignup` gate; plain `signUp` via `AuthContext.signUp` — no options, confirmation-email flow, no auto-login; confirmation-sent view + goBack to Login; `mapSignupError` for already-registered) + Login "create account" link + `RootStackParamList.SignUp` mounted in the signed-out stack fragment (slide_from_right).
- [x] T085 LoginScreen two-phase inline reset: `validateResetEmail` → `AuthContext.requestPasswordReset` → `resetPasswordForEmail(email, { redirectTo: WEB_ORIGIN + "/reset-password" })` → resetLinkSent state + backToLogin; resetRequestFailed on error.
- [x] T086 `signup-validation.test.ts` (7 tests: min-6, mismatch, empty-email, duplicate-email mapping, generic collapse, reset-email requirement) + gates: typecheck ✅ · lint ✅ · vitest 35/35 ✅ · export ✅ (validates the authPages JSON resolves through Metro).

## C4 — Academic path + filtered subjects (G4)
- [x] T087 **Owner note #1 VERIFIED**: web `useSubjects` read directly (apps/web/src/hooks/useSubjects.ts) — two SEPARATE chained `.or()` calls, each `field.eq.X,field.is.null`, plus the `is_academic.eq.true,is_academic.is.null` branch. Mobile builds the identical strings via pure builders (`levelOrNullFilter`/`semesterOrNullFilter`/`isAcademicFilter` in lib/academic.ts) locked verbatim by `academic.test.ts`; each call is chained independently, never merged into one `.or()` argument.
- [x] T088 ProfileScreen Academic-path card: `academic_levels` + `departments` option fetches (web useAcademicOptions selects/orders verbatim); `profiles` read via `useAcademicProfile` (`level, semester, department_id`, maybeSingle) and save via `saveAcademicProfile` (profiles_update_own); department filtered by `academic_level_id` with reset-on-level-change (web parity); "no department" allowed (web onboarding saves null); save button + inline saved/failed notes.
- [x] T089 SubjectsScreen: select unchanged columns + filter `.or(isAcademicFilter())`/`.or(levelOrNullFilter(level))`/`.or(semesterOrNullFilter(semester))`; effective semester = profile (valid 1–3) ?? 1, effective level = profile ?? 1 (web formula); subjects fetch gated on profile load (`enabled: !academic.loading`); cache key `subjects:all:{level}:{semester}` + live subscriber sync (useAcademicProfile reloads on save) so a Profile edit refilters the Subjects tab without a restart.
- [x] T090 gates: mobile typecheck ✅ · lint ✅ · vitest 44/44 ✅ (9 new academic tests) · export ✅.

## C5 — AI chat local history (G5, local-only)
- [x] T091 `src/lib/chat-history.ts`: AsyncStorage key `masarx_ai_chat_cs_assistant` (outside read-cache prefix — no TTL envelope, survives cacheClearAll), load/save/clear, cap 100 drop-oldest, `pending` excluded, corrupt/non-array/malformed JSON ⇒ empty (per-entry shape guard).
- [x] T092 `AIAssistantScreen` event-driven wiring (lesson #14): `pendingPersistRef` raised at exactly the four real events (send append, unconfigured-failure append, success finalize, failure finalize) and consumed once by the persist effect; mount, history-restore, clear, and auth transitions write nothing; `clearChat` empties state WITHOUT raising AND deletes the stored key (deletion exclusive); load-on-mount restores once (pure read, no write-back). Stale "known 401 gap" header comment replaced (bearer fix landed in spec 018).
- [x] T093 `chat-history.test.ts` (9 tests: pending exclusion, 100-cap drop-oldest, failed/retryText round-trip, missing key, corrupt JSON, non-array payload, malformed-entry filtering, clear semantics) + gates: typecheck ✅ · lint ✅ · vitest 53/53 ✅ · export ✅.

## C6 — Quiz timer + attempts review (G6)
- [x] T094 **Owner note #2 timer lifecycle**: `lib/quiz-timer.ts` pure wall-clock math (remaining = ceil((endTime−now)/1000) clamped 0; expired at boundary; timeTaken rounded) locked by `quiz-timer.test.ts` (9 tests); screen keeps `endTimeRef` + 1s interval + `finishingRef` single-finish guard, interval cleared on finish/unmount/phase change, and an `AppState` "active" listener re-evaluates so a deadline passed while backgrounded auto-finishes exactly once on foreground (the handler reuses the same tested pure functions).
- [x] T095 `fetchQuizWithQuestions` selects `duration_seconds`; countdown chip in the player (danger styling ≤30s, minutesShort/secondsShort from quizAttempts); auto-finish routes through the manual finish path via a `finishRef` (no stale closures); `finishAttempt` extended with `timeTakenSeconds` + `answers` jsonb (`{question_id, selected_option, is_correct}`, unanswered = −1) — exact web-schema parity.
- [x] T096 `GuestResult` extended `{title, timeTakenSeconds, answers[]}` (all optional — legacy stored results tolerated); `listGuestResults()` enumerates `quiz_guest_result:` keys via `getAllKeys` (one entry per quiz, malformed skipped).
- [x] T097 `QuizAttemptsScreen`: DB attempts (`quiz_attempts` incl. answers jsonb + `quizzes(title)`, own-rows, created_at desc, limit 100) merged with local entries, dedup by id (DB wins), newest first; expandable per-question review via `MathText` (selected-correct green / selected-wrong red / correct-key blue, unsolved marker, explanation); entry link in the Quizzes tab header; `quizAttempts` namespace imported (10th, shared JSON reused verbatim); `RootStackParamList.QuizAttempts` mounted slide_from_right.
- [x] T098 gates: mobile typecheck ✅ · lint ✅ · vitest 62/62 ✅ · export ✅.

## C7 — Release
- [ ] T099 version 0.6.0 → 0.6.1 (`apps/mobile/package.json` + `app.json`); full gate suite; README/ledger notes.

## Owner actions (post-C7)
- [ ] Review spec → approve C2–C7 execution (this ledger pauses after C1).
- [ ] Store-track items from spec 018 remain pending (eas init, secrets, builds, listings, submit, device smoke).
- [ ] Spec 020 (Tier 2): News/Announcements tab, dark mode, summary reviews/ratings/YouTube embeds.
