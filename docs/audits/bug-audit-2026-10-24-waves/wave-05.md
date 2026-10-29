# Wave 5 — Content & gating (agents 13–15)

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 13 — Content authoring forms

**F1. SEV: High — Stored XSS via summary attachment link (distinct path bypassing Wave-2 action validation)**
- LOC: `apps/web/src/hooks/useEditSummary.ts:100`, `:130-141`; sink `apps/web/src/app/[locale]/summaries/[summaryId]/page.tsx:262`
- MECHANISM: Modal edit validates drive link with only `new URL(driveLink.trim())`, accepting `javascript:`/`data:` schemes. Written straight to `summaries.pdf_url` via a **client-side** Supabase `.update()` (`useSummaries.ts:63-71` — never passes through actions/content.ts). Rendered verbatim as `<a href={summary.pdf_url} target="_blank">`.
- SCENARIO: Summary owner enters `javascript:alert(document.cookie)` as attachment link → saved → any viewer clicking "Download PDF" executes script.
- TRACE: AttachmentSection.tsx:126 → useEditSummary.ts:100 (new URL passes) → :131 pdfUrl = driveLink → :134 onSave → useSummaries.ts:67 supabase update → DB (no CHECK on url in 004:31-40; RLS 010:41-45 owner-or-admin) → page.tsx:262 href render.
- FIX: Enforce `url.protocol === 'https:'` in useEditSummary + DB CHECK/trigger on pdf_url. / CONF high / STATUS NEW (distinct from KNOWN Wave-2 actions/content.ts gap)

**F2. SEV: High — News flow uploads files to Cloudinary BEFORE any validation, then silently aborts**
- LOC: `hooks/useAddNewsForm.ts:54-110` (uploads at :66-92); `news/page.tsx:113-115` (silent return on empty title/content), `:143-144` (`catch { // ignore }`)
- MECHANISM: handleAddNews uploads file + images to Cloudinary first; handleAddNewsItem then drops everything with bare `return` if title/content blank, and swallows addNews errors entirely. NewsFormFields inputs have no `required`.
- SCENARIO: attachments but blank content → files uploaded, news never created, modal stays open, zero feedback; every retry orphans Cloudinary assets. Insert failure equally invisible.
- FIX: Validate title/content before any upload; propagate insert errors. / CONF high / STATUS NEW

**F3. SEV: Medium — Orphaned uploads / no cleanup on post-upload failure or replacement (3 paths)**
- (a) `useContentForm.ts:46-71` — upload then addFile fails → orphan; retry duplicates. (b) `edit-summary/page.tsx:132-156` — upload succeeds, Supabase update fails (:169) → orphan; old PDF never deleted on success. (c) `useEditSummary.ts:114-141` — same for summaries-pdfs bucket; old file never removed on replacement or link-type switch (:130-132).
- FIX: cleanup on failure + delete prior asset on replacement. / CONF high / STATUS NEW

**F4. SEV: Medium — addFile/addVideo accept empty or unresolvable subject, inserting dangling rows**
- LOC: `actions/content.ts:11` (`subject: z.string()` no min), `:59`/`:72` (subjectId resolved to null, never rejected), `:105-119`/`:158-172` (insert with `subject: ""`, `subject_id: null`)
- SCENARIO: `/add-file` without `?subject=` → hidden input submits `subject: ""` → row invisible in every subject view. Misspelled subject → null subject_id.
- FIX: `z.string().min(1)` + reject null subjectId. / CONF high / STATUS NEW

**F5. SEV: Medium — Edit summary forces semester=1 on load, hiding the current subject from its own dropdown**
- LOC: `edit-summary/page.tsx:110` (`setSemester(1)` after fetch); same in `useEditSummary.ts:64`; subject list filtered by it (`page.tsx:46-49`)
- MECHANISM: semester-2 subject loads with semester=1 → controlled select has no matching option → placeholder while formData.subject silently holds old value; submitting "as shown" saves a subject the UI never displayed.
- FIX: infer semester from loaded subject. / CONF high / STATUS NEW

**F6. SEV: Medium — News image previews: cleanup revokes ALL blob URLs on every list change, including just-created ones**
- LOC: `components/news-form/NewsMediaUploads.tsx:41-59` (cleanup :53-58 iterates live ref, revokes every URL; deps `[imageFiles]`)
- MECHANISM: per change: render (useMemo :29-39 creates URL) → previous cleanup revokes everything incl. still-listed images → new effect body no-ops. Adding/removing any image can blank other/new previews (race-dependent).
- FIX: diff-keyed revocation; revoke-all only on unmount. / CONF medium-high / STATUS NEW

**F7. SEV: Low — Concurrent-edit clobbering on summaries** (`edit-summary/page.tsx:144-154`, `useSummaries.ts:63-71` — full-row update, no updated_at guard, last-write-wins; errors only logged :75-77). CONF high / STATUS NEW

**F8. SEV: Low — Guest-upload contract mismatch + size check only server-side** (`lib/cloudinary.ts:63-64,86` claims guest path vs `upload-file/index.ts:46-54` hard 401; 50MB cap enforced after full base64 buffering → tab freeze on huge files). Secret handling clean (preset server-side, signature via edge fn). CONF high / STATUS NEW

**F9. SEV: Low — i18n violations (I3) in authoring UIs** (`EditSummaryModal.tsx:57,100,110,115`; `AcademicOptionsFields.tsx:38,84,129,154`; `BasicInfoFields.tsx:31,54`; `NewsMediaUploads.tsx:175-176` — Arabic labels for en users). CONF high / STATUS NEW

**F10. SEV: Low — Destructive `clearAllSummaries` exported with no guard and no callers** (`useSummaries.ts:110-125,150` — deletes every row via `neq` sentinel; dead code but future wiring bypasses client admin checks, relies purely on RLS). CONF high / STATUS NEW

**Clean**: FileDropzone (validation delegated by design); LectureSelect; NewsTargetFilters cascade correct; useAddSubjectForm reset/error-mapping sound; ScheduleFields; useSummaries delete-optimistic rollback correct; edge fn auth gate + unique public_id + admin-gated user_id scoping correct.

---

## Agent 14 — Courses/enrollments/reviews

**1. SEV: High — Reject action writes status `'rejected'` which violates the DB CHECK constraint**
- LOC: `apps/web/src/hooks/useEnrollments.ts:107,112` vs `migrations/004_content_management.sql:47` (`('active','pending','cancelled')`) and `migrations.old/20260111000004_create_enrollments_table.sql:33` (`('pending','active','expired')`)
- MECHANISM: handleAction('reject') sets `status:'rejected'` — neither schema permits it → Postgres check violation on every reject.
- SCENARIO: Instructor clicks reject → update fails → error toast; enrollment stuck pending. All "rejected" UI states (`[courseId]/page.tsx:64,365-378`, `CourseHero.tsx:34-40`) unreachable.
- FIX: add 'rejected' to CHECK or use schema's equivalent. / CONF high / STATUS NEW — **[FIXED in PR #155]**

**2. SEV: High — Self-enroll flow exists in code but RLS forbids student INSERT (Wave-2 gap is NOT dormant)**
- LOC: `apps/web/src/app/[locale]/courses/[courseId]/page.tsx:244-274` (handleSubscribe inserts client-side)
- MECHANISM: enrollments RLS has no self-INSERT policy (004:62,68; `supabase/tests/rls-verify.sql:370` explicitly asserts student insert is rejected) → the live student enrollment flow always fails. Secondary: UNIQUE(student_id, course_id) means "rejected → retry" re-insert also fails.
- SCENARIO: any student enrolls → payment-proof upload succeeds → enrollment insert errors → `enrollmentFailed` toast. Core enrollment funnel broken.
- TRACE: page.tsx:381 → 455-476 modal → 244 handleSubscribe → 255-263 insert → RLS reject.
- FIX: add `FOR INSERT TO authenticated WITH CHECK (auth.uid() = student_id AND status='pending')` (plus deleted-row handling for retry) or route through an edge function. / CONF high / STATUS: KNOWN-active (confirms a live flow consumes the policy gap) — **[POST-AUDIT: prod introspection showed the INSERT policy EXISTS on prod; the gap is repo-record only. Reapply UPDATE policy added in PR #155.]**

**3. SEV: Medium — No one-review-per-user enforcement** (005:31-42 — no UNIQUE(user_id, course_id), no trigger; `useReviews.ts:70` plain insert; review button always offered) → N reviews per user, skews average_rating. FIX: partial unique index + 23505 handling. CONF high / STATUS NEW

**4. SEV: Medium — Review author names never render (view column mismatch)** (`[courseId]/page.tsx:53-60,188` maps full_name/username vs `review_details` exposes `reviewer_name` (005:56) → generic fallback everywhere; ReviewItem.tsx:47 uses reviewer_name correctly). FIX: map reviewer_name. CONF high / STATUS NEW

**5. SEV: Medium — Course "student count" is viewer-dependent (RLS-scoped embed)** (`useCourses.ts:29-31,53-55,67-68`; displayed courses/page.tsx:231,276-283 — RLS-filtered embed counts only viewer's own row; anonymous 0; admin true). FIX: security-definer RPC/view for counts. CONF high / STATUS NEW

**6. SEV: Medium — Free courses require a payment screenshot to enroll** (`[courseId]/page.tsx:379-387` default branch ignores course.price; modal demands image even when price === 0). FIX: branch on price > 0. CONF high / STATUS NEW

**7. SEV: Medium — Null `description` bricks the courses listing page** (`useCoursesFilter.ts:14-17` `.description.toLowerCase()` after Wave-2 safeParse raw-row fallback; description nullable per 004:20 but schema requires string). CONF medium / STATUS NEW (distinct downstream crash)

**8. SEV: Low — AddCourseModal price parsing unvalidated** (`AddCourseModal.tsx:71` parseFloat NaN/negatives; DB decimal accepts negatives). CONF high / STATUS NEW

**9. SEV: Low — Hardcoded Arabic user-facing strings (I3)** (ReviewForm/ReviewSection/CourseHero/CourseCard/useEnrollments/ReviewItem). CONF high / STATUS NEW

**Clean — content gating (IDOR)**: client lock cosmetic, page fetches content unconditionally, BUT RLS on course_summaries/videos/files (instructor/admin/active-enrolled only, old `20260118011902:91-200`) filters server-side — non-enrolled get empty arrays, no leak. Confirms deployed DB is old-migration lineage. Review insert enforcement correct (active enrollment + self user_id, rating CHECK). Cache invalidation in scope correct. No optimistic updates in scope. AddCourseModal saving flag guards double-submit.

---

## Agent 15 — TRW access codes

**1. SEV: Critical — Paid TRW content (video/file URLs) readable by anyone; membership gate is client-side-only** / STATUS NEW
- LOC: `supabase/migrations.old/20260220190304_create_trw_tables.sql:62-64` (policy), `:47` (`url TEXT NOT NULL`); gate `components/trw/TRWAccessGate.tsx:30-63`; fetch `hooks/trw/useTRWCourseDetails.ts:12-19`
- MECHANISM: RLS `FOR SELECT USING (true)` on trw_courses, trw_modules, trw_materials. No later migration tightens them (010 remediates only system_access_codes, :73-127; grep: zero other trw_materials policy refs). TRWAccessGate gates render only; the query fetching `trw_materials(*)` runs unconditionally on mount, no auth check first.
- SCENARIO: anyone (even anon) `GET /rest/v1/trw_materials?select=url,title` → full paid video/file URLs. Membership/redeem flow monetizes nothing.
- TRACE: `[courseSlug]/page.tsx:49` → useTRWCourseDetails.ts:12-19 (REST select *, runs for logged-out visitors) → TRWAccessGate.tsx:30 (lock UI, data already in browser) → DB: public-read policy 20260220190304:61-64.
- FIX: member-gated policies (`is_trw_member()` / per-category variant, both exist at 20260222033000:115-146) on all three tables; this is the security consequence of the known "trw_* DDL missing from active migrations" gap. / CONF high — **[POST-AUDIT: prod introspection showed the three tables DON'T EXIST on prod — not live; conditional member-gate shipped in 018]**

**2. SEV: Critical — Any authenticated user can enumerate all live access codes** / STATUS NEW
- LOC: `migrations.old/20260222033000_trw_complete_architecture.sql:273-278`
- MECHANISM: policy `trw_access_codes_select_auth` grants SELECT to authenticated on active rows — RLS is row-level, not column-level, so the `code` value itself is returned. No app code needs this table (grep: zero client reads).
- SCENARIO: attacker lists all codes, redeems max_uses=1 codes first → legitimate recipients get already_redeemed/exhausted codes (paid-code DoS/resale).
- TRACE: any client `.from('trw_access_codes').select('code')` → policy 20260222033000:274-278 → redeem RPC :168-174 (code match + lock) → membership granted :199-206.
- FIX: drop the authenticated SELECT policy; admin reads via service role only. / CONF high — **[FIXED in PR #155; live-confirmed before the drop]**

**3. SEV: High — Redeeming two codes of different plans bricks the access gate (maybeSingle multi-row)** / STATUS NEW
- LOC: `hooks/trw/useTRWMembership.ts:15-22`; schema UNIQUE 20260222033000:59
- MECHANISM: trw_memberships allows multiple active rows per user (one per plan; free/full_access/money_only :17-21). Query uses `.maybeSingle()` (:22) which throws PGRST116 on >1 row → error state → gate locks.
- SCENARIO: user redeems money_only then full_access (both succeed) → second redemption kills entire TRW access; "Access Required" everywhere incl. my-access.
- FIX: `.order('granted_at').limit(1)` or aggregate multi-plan access. / CONF high

**4. SEV: Medium — Redeem upsert downgrades permanent memberships and un-revokes banned users** / STATUS NEW
- LOC: `20260222033000:199-206` — `ON CONFLICT (user_id, plan_id) DO UPDATE SET expires_at = EXCLUDED.expires_at, revoked_at = NULL`
- (a) permanent (expires_at NULL) member redeems 30-day code for same plan → reset to 30 days, paid time destroyed. (b) admin-revoked user self-restores by redeeming any valid code for that plan.
- FIX: `expires_at = GREATEST(existing, EXCLUDED.expires_at)` null-safe; don't clear revoked_at. / CONF high

**5. SEV: Medium — No rate limiting / attempt cap on code redemption RPCs (brute force)** / STATUS NEW
- LOC: `20260222033000:149-178`; legacy `010:87-127` — no attempt counter/lockout/throttle; anon rejected early (:163-165) so guessing needs an authenticated account, but unlimited tries; client uppercases input implying uppercase-alphanumeric space.
- FIX: per-user failed-attempt lockout in both RPCs. / CONF medium

**6. SEV: Medium — TRW UI hardcodes English on all pages except redeem (I3); no RTL dir** (`TRWAccessGate.tsx:24,39-43,50,56`; trw/page.tsx:24-28,73,91; my-access/page.tsx multiple; [categorySlug]/[courseSlug] pages — only redeem uses useTranslations). CONF high / STATUS NEW

**7. SEV: Medium — Locale-less internal links bounce en users to ar** (`[categorySlug]/page.tsx:26,63`; `[courseSlug]/page.tsx:62`; `trw/page.tsx:53` — config localePrefix "always", defaultLocale "ar" (i18n/routing.ts:8-9); links omit locale → redirect to /ar/...; TRWAccessGate.tsx:17 builds prefix correctly, pages don't). CONF high / STATUS NEW

**8. SEV: Low — Progress tracking is write-dead** (`[courseSlug]/page.tsx:55-56,134`; only trw_user_progress reference is the SELECT in useTRWProgress.ts:16; RLS insert policy exists but no writer → isCompleted() always false; advertised benefit non-functional). CONF high / STATUS NEW

**9. SEV: Low — Redeem sends untrimmed code** (`redeem/page.tsx:43` vs trim only for disabled check :94; no Enter submit). CONF high / STATUS NEW

**Clean**: redemption concurrency/reuse race-free (FOR UPDATE + UNIQUE(code_id, user_id)); cross-user redemption impossible (auth.uid() only); expired/revoked excluded both client and server-side is_trw_member(); system_access_codes key leak already fixed by 010.
