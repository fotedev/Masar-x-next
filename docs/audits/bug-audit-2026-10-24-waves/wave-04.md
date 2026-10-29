# Wave 4 — Quiz & subjects (agents 10–12)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 10 — Quiz player

**Baseline verification (guest):** HOLDS. `QuizPlayer.tsx:67` passes `userId: forceLocalAttempt ? undefined : user?.id`; `useQuizAttempt.ts:61-64` early-returns without any request when `!userId`; DB sync gated at `:137`/`:195`. Guests fire zero attempt requests.

**1. SEV: Medium — Timer/timeTaken anchored to mount time; resume re-arms full duration**
- LOC: `hooks/useQuizAttempt.ts:72` + `hooks/useQuizPlayerRuntime.ts:77-82, 123-137`
- MECHANISM: `startAttempt` runs on mount (before Start click); `finishQuiz` computes `takenSeconds = Date.now() - attemptStartTime` (:79-82) — includes start-screen dwell and server-vs-client clock skew. On revisiting an unfinished attempt, `startQuiz` resets `endTimeMsRef = now + full duration` (:129) — a timed quiz grants a full fresh timer on every resume.
- SCENARIO: user idles 10 min on Start screen, plays a 10-min timed quiz → `time_taken_seconds` ≈ 20 min stored; or abandons mid-quiz, returns next day, resumes with full time each time.
- FIX: record startedAtMs at startQuiz click; persist remaining time server-side for resume. / CONF high / STATUS NEW

**2. SEV: Medium — Local progress wiped before DB finish; failed finish discards the real score**
- LOC: `hooks/useQuizAttempt.ts:188-203` + `lib/quiz.ts:231-241` + `quiz-attempts/page.tsx:113-120`
- MECHANISM: `finishAttempt` removes sessionStorage progress (:188-192) BEFORE `quizService.finishAttempt` (:203). If the DB update fails, the attempt row stays unfinished with initial `score: 0, total_questions: 0` from startAttempt; history dedup by id keeps the DB row (`:116-119`), dropping the local entry with the real score.
- TRACE: finish → removeItem → DB update throws → revisit → startAttempt returns unfinished row (score 0) → history merge keeps DB row.
- FIX: write history after DB success; retry/mark DB finish. / CONF high / STATUS NEW

**3. SEV: Medium — startAttempt failure silently disables all persistence**
- LOC: `hooks/useQuizAttempt.ts:107-108` (bare `catch { // ignore }`), `:195`
- MECHANISM: if startAttempt throws (RLS/network), error swallowed; `attemptId` null → finishAttempt skips DB write entirely, quiz plays normally, `quiz_completed` analytics fire. Logged-in users get zero quiz_attempts records with no signal.
- FIX: surface error banner + retry. / CONF high / STATUS NEW

**4. SEV: Low — Auth transition mid-quiz resets progress** (`QuizPlayer.tsx:67`, `useQuizAttempt.ts:55-115` — effect re-runs when userId flips; guest answers replaced by empty/DB map). FIX: seed runtime from pre-login map. CONF high / STATUS NEW

**5. SEV: Low — startAttempt check-then-insert race** (`lib/quiz.ts:209-241` — two tabs both insert; resume picks arbitrary via `.limit(1).maybeSingle()`; no unique partial index). FIX: unique partial index on (quiz_id,user_id) where finished_at is null. CONF medium / STATUS NEW (cross-refs known DDL gap)

**6. SEV: Low — Unhandled promise rejection on answer-save failure** (`useQuizPlayerRuntime.ts:203` fire-and-forget + `useQuizAttempt.ts:148` throw). CONF high / STATUS NEW

**7. SEV: Low — correct_answer shipped to client; grading client-side** (`lib/quiz.ts:191-195` select `*`; `useQuizPlayerRuntime.ts:200`). Design note: trivially cheatable if ever assessment-bearing. CONF medium / STATUS NEW — **[superseded by audit C4, fixed via spec 030]**

**8. SEV: Low — QuizPlayer with neither quizData nor quizId spins forever** (`useQuizPlayerData.ts:62` leaves loading:true; no current caller). CONF high / STATUS NEW

**Clean**: scoring can't go negative, consistent everywhere; `finishingRef` blocks double-finish; per-answer upsert prevents duplicate rows; no shuffle exists (order_index both sides); retry via reload = correct accounting; deadline-based timer arithmetic robust; duration type fine; legacy submitAttempt dead in prod.

---

## Agent 11 — Quiz management

**1. SEV: High — Form-captured semester is never persisted (silent data loss on every save)**
- LOC: `apps/web/src/app/[locale]/quizzes/_hooks/useQuizzesData.ts:101-107` (saveQuiz), `:210` (loadQuizForEdit)
- MECHANISM: `descriptionData = { description, department, year, subject }` — `formData.semester` is collected (required field, `quiz-form/QuizMetaFields.tsx:137-160`) but never written into the JSON description, the only place quiz metadata lives. Edit reloads semester from JSON → always `""`.
- SCENARIO: Admin sets semester=2, saves → DB has no semester → semester filter (`useQuizzesFilters.ts:158-162,201`) hides every form-authored quiz; edit form shows semester empty.
- FIX: add `semester: formData.semester` to descriptionData (+ one-time backfill). / CONF high / STATUS NEW

**2. SEV: High — Edit path is non-transactional delete-then-insert → quiz left with zero questions**
- LOC: `useQuizzesData.ts:122-143`
- MECHANISM: UPDATE quiz → DELETE all quiz_questions → INSERT new rows. If insert fails, delete already committed; no rollback. Also regenerates all question IDs (orphaning attempt rows).
- SCENARIO: admin edits a 20-question exam; insert fails → approved quiz permanently 0 questions.
- FIX: upsert with onConflict or insert-first-then-delete-diff in an RPC. / CONF high / STATUS NEW

**3. SEV: High — Failed edit-load leaves `editingQuiz` set; subsequent "New Exam" save overwrites an unrelated quiz**
- LOC: `apps/web/src/app/[locale]/quizzes/page.tsx:199-209` (sets editingQuiz at :201 before load; catch swallows), `:246` (onNewExam never resets editingQuiz/formData), `useQuizzesData.ts:109` (edit branch keyed on editingQuiz != null)
- TRACE: onEdit(A) → setEditingQuiz(A) → loadQuizForEdit throws → catch {} → admin clicks "New Exam" → modal with empty formData + editingQuiz=A → save takes edit branch → UPDATEs A's title/meta, DELETEs A's questions, INSERTs new ones. Quiz A destroyed; no new quiz created.
- FIX: onNewExam must setEditingQuiz(null)+resetForm; set editingQuiz only after load succeeds. / CONF high / STATUS NEW

**4. SEV: High — Quiz authoring/publish is client-gated only; any authenticated user can self-approve**
- LOC: `useQuizzesData.ts:161` (`status: "approved"` unconditionally); policy documented in `docs/audits/rls-audit-2026-09-18.md:324-326`: quizzes INSERT = `WITH CHECK (auth.uid() = user_id)` — no admin check, no status constraint.
- MECHANISM: UI hides New/Edit/Delete for non-admins, but RLS permits any authenticated user to insert own quiz with `status='approved'` (public SELECT shows approved to everyone) via direct supabase-js call.
- FIX: INSERT policy `WITH CHECK (is_admin() OR status='pending')`; force status server-side for non-admins. / CONF high (policy text verbatim in repo audit doc) / STATUS NEW

**5. SEV: Medium — Save validation allows empty/duplicate options and an empty correct answer** (`QuizFormModal.tsx:93-99` only checks title/dept/year/subject/question text; grading index-based → empty string grades correct; zero-question quiz publishable). CONF high / STATUS NEW

**6. SEV: Medium — No double-submit guard on Save → duplicate quizzes** (`page.tsx:171-197` no in-flight flag; modal reflects validation only). FIX: isSaving state. CONF high / STATUS NEW

**7. SEV: Medium — True-false type detection is locale-dependent; create vs edit paths disagree** (`useQuizFormState.ts:63-78` writes localized options; `useQuizzesData.ts:171` saves as-is vs `:132` force-normalizes to `["صح","خطأ"]`; `:237-241` detects via literal Arabic) — en-locale true-false question re-edits as multiple-choice. FIX: store `type` in DB. CONF high / STATUS NEW

**8. SEV: Medium — Orphaned approved quiz when question insert fails on create** (`useQuizzesData.ts:148-182` — quiz inserted `status:'approved'` before questions; on failure quiz persists with 0 questions, visible to all). FIX: questions first or cleanup. CONF high / STATUS NEW

**9. SEV: Low — Duration drifts on every edit (seconds rounded away)** (`useQuizzesData.ts:221-224` Math.round(s/60) → 90s shows "2", re-save stores 120s). CONF high / STATUS NEW

**10. SEV: Low — Admin-dashboard tab: page not clamped after delete → empty page shows "noResults"** (`QuizzesTab.tsx:68-76`). CONF high / STATUS NEW

**11. SEV: Low — Hardcoded Arabic confirm() in legacy delete path (I3 violation)** (`hooks/useQuizzes.ts:66`). CONF high / STATUS NEW

**12. SEV: Low — Two admin quiz caches never co-invalidate** (`useQuizzes.ts:20` admin_quizzes_v2 vs `useQuizzesData.ts:20` quizzes_all_admin_*; mutations on /quizzes leave dashboard tab stale until TTL). STATUS NEW (cross-ref Wave-2)

**13. SEV: Low — quizzes schema drift: columns written by saveQuiz exist in no migration** (`useQuizzesData.ts:115-116,153-161` writes summary_id, duration_seconds, user_id, source_type, status; only 004 (duration_minutes) + 010 (created_by) touch the table). STATUS NEW (cross-ref baseline)

**Clean**: option/correct-answer index handling consistent end-to-end; key={questionIndex} safe (fully controlled inputs); DEFAULT_QUESTION options shared by shallow copy but copy-on-write everywhere.

---

## Agent 12 — Subjects/lectures/study flow

**1. SEV: High — Admin "Add lecture" from subject page silently never saves**
- LOC: `apps/web/src/app/[locale]/subjects/[subject]/page.tsx:533-541` + `apps/web/src/hooks/useManageLectures.ts:71-72`
- MECHANISM: `onSaveLecture` calls `setNewLecture({...})` then immediately `await handleAddLecture()` in the same tick. `handleAddLecture` reads `newLecture` from its render closure — always the previous value `{title:""}` → `if (!newLecture.title.trim()) return;` exits silently, then the page closes the modal anyway.
- TRACE: modal Save → setNewLecture (queued) → handleAddLecture closure sees stale "" → early return → modal closes → fetchSubjectData → nothing inserted.
- FIX: pass the payload as an argument or derive from lectureFormData inside the hook. / CONF high / STATUS NEW

**2. SEV: High — "View content" / "Start challenge" buttons are silent no-ops for summaries and quizzes**
- LOC: `apps/web/src/app/[locale]/subjects/[subject]/page.tsx:310-320`; consumers `LectureExplanationSection.tsx:207-212`, `LectureExamsSection.tsx:107-113`
- MECHANISM: `handleViewContent` has only two branches: `type === "video"` and `item.file_url`. Summary rows fetched without url field; quizzes select no url → both fall through → click does nothing. No navigation, no toast.
- FIX: add quiz/summary branches (navigate) or disable with tooltip. / CONF high / STATUS NEW

**3. SEV: Medium — lectureMatch inference can attach content explicitly owned by another lecture** (`useLectureContent.ts:84-116` — OR-chain: explicit id match OR key match OR title inference; explicit id mismatch never excludes). FIX: id-set-and-differs → return false before inference. CONF high / STATUS NEW

**4. SEV: Medium — stale-response race in useLectureContent** (`useLectureContent.ts:42-136` — no cancellation/stale flag; slow older fetch can overwrite newer lecture's content). CONF high / STATUS NEW

**5. SEV: Medium — optimistic-update rollback is a no-op in useSubjects** (`useSubjects.ts:119,162,199,256` — `getQueryData(["subjects"])` exact-key lookup but queries use `["subjects", {level, semester, isAnonymous, isAdmin}]` → snapshot always undefined → onError rollback never restores; only the optimistic write lands via setQueriesData). FIX: getQueriesData prefix snapshot. CONF high / STATUS NEW

**6. SEV: Medium — `enabled` conflates level:null with "don't load" → empty subject dropdowns** (`useSubjects.ts:62-64`; caller `edit-summary/page.tsx:40-49` — null when no year picked OR lookup misses → query permanently disabled, no recovery). CONF high / STATUS NEW

**7. SEV: Medium — account switch leaves academic profile stale/default** (`useUserAcademic.ts:134-149` — `hasInitialized` ref never reset per user; logout sets DEFAULT; different user logging in on same tab never triggers fetchProfileData). FIX: reset ref on user falsy or key on user.id. CONF medium / STATUS NEW

**8. SEV: Low — subject-name decode/filter hazards in manage-lectures** (`useManageLectures.ts:44-52`; `ManageLecturesModal.tsx:34` double-decode throws URIError on literal %; `.or(ilike)` breaks on commas/parens). CONF high / STATUS NEW

**9. SEV: Low — AddLectureModal closes unconditionally even on failed save** (`page.tsx:533-541`; typed input lost). CONF high / STATUS NEW

**10. SEV: Low — LectureContentModal "view content" loses locale and lecture param** (`LectureContentModal.tsx:62-65` — no locale prefix; redirect drops ?lecture= → lands on catalog). CONF high / STATUS NEW

**11. SEV: Low — non-academic/[subject] hardcodes Arabic + RTL for all locales (I3)** (`non-academic/[subject]/page.tsx:73,78,81-114`; router.push skips locale prefix). CONF high / STATUS NEW

**12. SEV: Low — back-button arrow direction ignores LTR** (`LectureHero.tsx:62` — ArrowRight hardcoded). CONF high / STATUS NEW

**13. SEV: Low — rate-limit `JSON.parse` unguarded** (`useUserAcademic.ts:199` — corrupted sessionStorage throws uncaught before its try block). CONF high / STATUS NEW

**Clean**: LectureVideoPlayer (beyond known CSP), LectureDetailView, dashboard components, LectureContentTabs lists, AddLectureModal + LectureItem edit binding, subjects/[subject]/layout metadata, lectures/[lectureId] wrapper, useCoursesFilter, useAcademicOptions, useSubjectModals, semester precedence chain (guest writer is dead code — inert, not buggy). Perf note: useLectureContent instantiated twice per subject page (8 fetches).
