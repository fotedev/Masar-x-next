# Spec 019 — Tasks

Execution ledger. Tier 1 only (owner two-tier split 2026-09-25). Every task:
verify with the gates in spec.md §5 before marking ✅. Owner binding notes:
C4 `.or()` verification (#1), C6 AppState timer lifecycle (#2), explicit-path
staging on every commit (#3).

## C1 — Spec landing
- [x] T076 `specs/019_mobile_parity/{spec.md,tasks.md}` committed.

## C2 — Subject detail + lecture content (G1, read-only)
- [ ] T077 shared types (I2): add `lecture_key`, `lecture_id` to the hand-typed `files` Row in `packages/shared/src/types/database.ts`; web typecheck verified (failures confined to pre-existing spec-017 WIP paths, ledgered).
- [ ] T078 `src/lib/lecture-content.ts` pure matcher (lecture_id → trimmed lecture_key → "other" grouping; empty key ⇒ "other") + `lecture-content.test.ts`.
- [ ] T079 `SubjectDetailScreen`: subject header (locale-aware professor/description, schedule, location) + lecture index (`subject_lectures` by order_index) + per-lecture content groups + unclassified group; video/file/summary-PDF via `Linking.openURL`, quiz → QuizPlay.
- [ ] T080 wiring: `RootStackParamList.SubjectDetail`, RootStack screen mount, `SubjectsScreen` card → Pressable navigate.
- [ ] T081 gates: mobile typecheck/lint/test/export + shared + desktop typecheck.

## C3 — Signup + forgot password (G2, G3)
- [ ] T082 `app.config.js`: `EXPO_PUBLIC_WEB_ORIGIN` → `extra.webOrigin` (default `https://masarx.vercel.app`); typed consumption.
- [ ] T083 i18n registry: import `authPages` namespace (9th; three-point contract).
- [ ] T084 `SignUpScreen` (email/password/confirm; min-6 + mismatch; plain `signUp`; confirmation-sent UX; already-registered mapping) + Login "create account" link + `RootStackParamList.SignUp`.
- [ ] T085 LoginScreen forgot-password two-phase inline state → `resetPasswordForEmail(email, { redirectTo: webOrigin + "/reset-password" })` → resetLinkSent state.
- [ ] T086 `signup-validation.test.ts` (min-6, mismatch, error mapping) + gates.

## C4 — Academic path + filtered subjects (G4)
- [ ] T087 **Owner note #1 verification**: reproduce web `useSubjects` PostgREST query shape (two separate chained `.or()` calls, each independent top-level) and diff against mobile's intended query before wiring.
- [ ] T088 ProfileScreen Academic-path card: `academic_levels` + `departments` options, `profiles` read (`level, semester, department_id`) + `profiles_update_own` save; department filtered by `academic_level_id`; semester 1–3.
- [ ] T089 SubjectsScreen: select += `level, semester, is_academic, show_on_home`; effective semester = profile (valid 1–3) ?? 1; two chained `.or()` filters; refetch after profile save.
- [ ] T090 gates.

## C5 — AI chat local history (G5, local-only)
- [ ] T091 `src/lib/chat-history.ts`: AsyncStorage key `masarx_ai_chat_cs_assistant` (outside read-cache prefix), load/save/clear, cap 100 drop-oldest, `pending` excluded, malformed JSON ⇒ empty.
- [ ] T092 `AIAssistantScreen` event-driven wiring: `pendingPersistRef` raised only by send/finalize/failure, consumed once; zero writes on mount/clear/auth transitions (repo lesson #14); load-on-mount restores once; `clearChat` deletes key.
- [ ] T093 `chat-history.test.ts` (round-trip, cap, pending exclusion, clear, corrupt JSON) + gates.

## C6 — Quiz timer + attempts review (G6)
- [ ] T094 **Owner note #2 timer lifecycle**: `endTimeRef`-derived remaining each tick, interval cleared on unmount + finish, `finishingRef` single auto-finish, `AppState` foreground re-evaluation → exactly one resolution event.
- [ ] T095 `fetchQuizWithQuestions` selects `duration_seconds`; QuizPlay countdown UI + auto-finish through the existing finish path; `finishAttempt` extended with `timeTakenSeconds` + `answers` jsonb (web parity).
- [ ] T096 `GuestResult` extended `{title, timeTakenSeconds, answers[]}`; local attempts enumerable (`quiz_guest_result:` prefix scan via `getAllKeys`).
- [ ] T097 `QuizAttemptsScreen`: DB attempts (`quiz_attempts + quizzes(title)`, own-only) merged with local, dedup by id, newest first; expandable per-question review via `MathText` (selected vs correct + explanation); Quizzes header entry link; `quizAttempts` namespace imported (10th); `RootStackParamList.QuizAttempts`.
- [ ] T098 `quiz-timer.test.ts` (remaining math, single auto-finish flag, foreground re-evaluation) + gates.

## C7 — Release
- [ ] T099 version 0.6.0 → 0.6.1 (`apps/mobile/package.json` + `app.json`); full gate suite; README/ledger notes.

## Owner actions (post-C7)
- [ ] Review spec → approve C2–C7 execution (this ledger pauses after C1).
- [ ] Store-track items from spec 018 remain pending (eas init, secrets, builds, listings, submit, device smoke).
- [ ] Spec 020 (Tier 2): News/Announcements tab, dark mode, summary reviews/ratings/YouTube embeds.
