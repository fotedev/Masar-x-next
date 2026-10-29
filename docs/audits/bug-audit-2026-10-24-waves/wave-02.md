# Wave 2 — Database & contracts (agents 4–6) — findings marked PROVISIONAL per plan; severity finalized at consolidation

> Regenerated 2026-10-28 from the orchestrator's session record (original destroyed with masarx-plan). Content-faithful.

## Agent 4 — Migrations & RLS

**F1. SEV: Critical (PROVISIONAL — prod live-state not verifiable read-only) — Self-service admin escalation policies never dropped**
- LOC: `supabase/migrations.old/20251217000000_add_user_roles.sql:63-69` ("Admins can manage admins" FOR ALL TO authenticated USING raw_user_meta_data->>'role'='admin'); `:16-25` (`set_user_role` SECURITY DEFINER, sets any user's metadata role, no REVOKE anywhere); "fix" at `migrations.old/20260219000000_rls_best_practices_audit.sql:41` drops a policy name ("Allow all authenticated users to access admins") that is never created in any file — the real FOR ALL policy survives the entire chain.
- MECHANISM: updateUser({data:{role:'admin'}}) (or call `set_user_role`) → INSERT self into admins → 012 trigger (`on_admin_upsert`) syncs app_metadata.role (prod admins table has a `role` column — proven by 012:50-53 backfill reading `a.role`, added out-of-band; no migration creates it).
- SCENARIO: any authenticated user becomes full admin (JWT claim + admins row satisfies every `EXISTS(admins)` policy).
- FIX: drop "Admins can manage admins" + revoke `set_user_role` from PUBLIC/anon on live prod; verify via `pg_policies`/`pg_proc` introspection.
- CONF: high (migration record; prod persistence unconfirmed) / STATUS: NEW (Wave-1 flagged only the SELECT variant)
- **[POST-AUDIT RESOLUTION 2026-10-24: prod introspection showed NOT live — prod `is_admin()` is table-membership-based (`EXISTS (SELECT 1 FROM public.admins WHERE admins.user_id = auth.uid())`), and `set_user_role` proacl = `{postgres, service_role}` only. Repo-record divergence → consolidation track.]**

**F2. SEV: High (PROVISIONAL) — Active migration chain cannot build a database from scratch (multiple hard breaks)**
- Breaks in order: (a) `010:68-69` `CREATE TRIGGER ... BEFORE UPDATE OF status ON summaries` — summaries (004) has no `status` column (exists only in `migrations.old/20251215214515:45`); (b) `012:50,53` backfill reads `admins.role` — active `002:11-16` admins table has no role column; (c) `013:31,99` insert into `platform_settings(key, value)` vs `003:30-31` schema `setting_key/setting_value`; (d) `011:97-98` writes notifications `related_id, related_type, read` vs `006` shape (`is_read`, `link`) — app also assumes related_id (`apps/web/src/hooks/useNotifications.ts:201`); (e) `is_admin()` defined only in `migrations.old/20260219000000:22-32`; tables `news/appeals/analytics/link_logs/system_access_codes/trw_*/assistant_messages` created only in migrations.old yet referenced by 010/011/015-017.
- FIX: add consolidation migration creating missing tables/columns + is_admin().
- CONF: high / STATUS: NEW (010 header admits "NOT supported" but chain still breaks silently at 010)

**F3. SEV: High (PROVISIONAL) — check_rate_limit RPC exists only in migrations.old; prod edge functions fail open without it**
- LOC: `migrations.old/20251231200000_add_rate_limiting.sql:16-63` (only definition); callers: request-password-reset/index.ts:175,253, cloudinary-webhook/index.ts:75, process-pdf/handler.ts:118, _shared/net.ts:63.
- MECHANISM: fresh provision lacks the RPC (and 006's table shape can't serve it); `net.ts:56-57` documents fail-open on RPC error → password-reset and upload rate limiting silently disabled.
- CONF: high / STATUS: KNOWN-active (both Wave-1 claims VERIFIED: RPC+old table shape old-only; 006:24-30 shape is key/hits/last_hit vs old identifier/endpoint/request_count/window_start + unique index `20260121054000`)

**F4. SEV: Medium — 002 admins SELECT policy matches user-writable metadata (Wave-1 claim CONFIRMED)**
- LOC: `002_core_identity.sql:43-49`, exact match text at `:47` `AND (raw_user_meta_data->>'role' = 'admin' OR id IN ...)`. updateUser can set it → attacker reads entire admins table. App blast radius limited: all 4 app sites filter `.eq('user_id', user.id)` (`proxy.ts:100`, `admin-dashboard/layout.tsx:28`, `api/admin/metrics/route.ts:31`, `useManageLectures.ts:80`), so no route escalation — info disclosure only.
- FIX: replace with `is_admin()` or own-row policy. / CONF: high / STATUS: KNOWN-active

**F5. SEV: Medium (PROVISIONAL) — news FOR ALL USING(true) never remediated**
- `migrations.old/20251215214536:47-49` "Authenticated users can manage news" FOR ALL TO authenticated USING(true) WITH CHECK(true); no later old migration touches news policies (grepped all 103). Admin mock audit claim VERIFIED: news/appeals tables+policies exist only in migrations.old; active chain references them only inside 011's function body. If live on prod, any authenticated user can write/delete announcements. Appeals final policies (old-only, `20260219000000:141-172`) are sound.
- CONF: high on record, prod live-state unverified / STATUS: KNOWN-active

**F6. SEV: Low (PROVISIONAL) — subject_lectures readable by authenticated only**
- `007:16-19` (identical in old chain) — public subject page queries it with the cookie client (`apps/web/src/app/[locale]/subjects/[subject]/page.tsx:168`) → guests get empty lectures. Pre-existing.

**F7. SEV: Low — unpinned search_path definer functions in active chain**
- Unpinned: 001 set_updated_at, 002:53/013:77 handle_new_user, 006:83-101 audit_trigger_func (never attached — dead code), 008/012 sync/remove role triggers, 010:54 summaries_status_guard. Properly pinned + anon-revoked: 010/011/013(partially)/015/016/017. `admin_migrate_student_semesters` (013) granted to authenticated but not revoked from anon (gate is is_admin() — itself old-only, see F2).
- STATUS: KNOWN-active (Q2 baseline counts were prod; fresh-provision: ~6 unpinned)

**F8. SEV: Low — dual 014 files verified benign on db push**
- Apply in lexicographic order; no interdependency; hardening sound. Only risk: tooling keying on numeric prefix.

**F9. SEV: Low — user_roles view + stale helper (old-only)**
- `migrations.old/20251217000000:29-40` view exposing auth.users emails; mitigated by `20260206093600_secure_views.sql:3` (security_invoker). `set_user_role` covered under F1.

**Clean**: 009 ai_chat_messages; 015/016/017 (note: no live callers found — only stale `.next/standalone` artifact references get_admin_analytics_summary); reviews/enrollments policies (note: enrollments has no self-INSERT policy — flag only if a self-enroll flow exists); 011 notify_admins_of_content provenance check; 014_waitlist insert-only design.

---

## Agent 5 — Shared contracts

**1. SEV: High (PROVISIONAL) — Shared `Database` type describes a schema the active migrations cannot build; 13+ actively-queried tables have no DDL in migrations/**
- LOC: `packages/shared/src/types/database.ts:20-679`; `supabase/migrations/010:4-7`, `011:4`
- MECHANISM: Migrations 001–017 never create `news`, `appeals`, `messages`, `ai_summaries`, `quiz_questions`, `quiz_attempts`, `quiz_answers`, `trw_*`, `course_videos/summaries/files`, `user_progress`, `analytics`, `chats`/`chat_participants` — all queried by apps. Migration shapes contradict the type: `admins` (002 vs type), `notifications` (006 `is_read`/`link` vs type `read`/`related_id`), `subjects`, `courses` (004 has `subject_id`/`thumbnail_url`/`updated_at`, absent from type), `profiles`.
- SCENARIO: Fresh env yields a DB without news/appeals/quiz_questions → every quiz submit, news fetch, appeal fails at runtime.
- TRACE: `apps/web/src/lib/quiz.ts:50` `.from('quiz_questions')` → no CREATE TABLE outside `migrations.old/20260221223500:45` → table-not-found on insert. Same: `apps/mobile/src/lib/quiz.ts:94-100`, `useNews.ts:65`, `AppealFormModal.tsx:60`.
- FIX: Regenerate types from live DB and add a reconciling migration set. / CONF: high / STATUS: KNOWN-active (enumeration of missing tables is new)

**2. SEV: High (PROVISIONAL) — Migration 013 writes columns 003 never created (platform_settings `key`/`value` vs `setting_key`/`setting_value`)**
- LOC: `supabase/migrations/013_semester_management.sql:31,99` vs `003_academic_structure.sql:37-42`
- MECHANISM: 003 creates `platform_settings(setting_key text UNIQUE, setting_value jsonb)`. 013 does `INSERT INTO public.platform_settings (key, value, updated_at)` and `ON CONFLICT (key)` — no such columns/index on a 003-schema DB.
- SCENARIO: Fresh build: 013 fails with 42703 → migration chain aborts before 014–017; no env can be bootstrapped from migrations at all.
- FIX: Align 013 on one column pair; add matching unique index. / CONF: high / STATUS: NEW

**3. SEV: Medium (PROVISIONAL) — Shared `reviews` row type says `comment`; migrations and both apps write `content`**
- LOC: `database.ts:436,447,458,707` vs `005_interactions_and_media.sql:34` (`content text`)
- MECHANISM: `ReviewInsert` exposes `comment`; migration and all real writers use `content`. `comment` is only the review_details VIEW alias (005:49). Any consumer trusting the typed ReviewInsert sends `{comment}` → PGRST204. Today masked by a defensive remap (`useReviews.ts:50,64-68`; mobile writes `content` directly `reviews.ts:89-93`).
- FIX: Rename the type field to `content`. / CONF: high / STATUS: NEW

**4. SEV: Low (PROVISIONAL) — Three-way contradiction on `quizzes.created_by`**
- `010:136-137` adds it; type omits it (`database.ts:172-221`); app asserts absence (`useQuizzesData.ts:154-155`). Latent only.

**5. SEV: Medium (PROVISIONAL) — Zod schemas stricter than DB reality; failures degrade silently to unvalidated rows**
- LOC: `packages/shared/src/types/schemas/index.ts:42,63` vs `useCourses.ts:72-79`, `news/page.tsx:82-86`
- MECHANISM: (a) `CourseSchema.price: z.number().int()` but DB price is `decimal(10,2)` — fractional price fails parse. (b) `NewsSchema.image_urls` `.default([])` doesn't fill for `null` rows. On every such row the `safeParse` failure path logs and returns the raw row cast to the typed shape — validation permanently dead for those rows.
- FIX: `price: z.number()`; `image_urls: .nullable().default([])`. / CONF: high / STATUS: NEW

**6. SEV: Low — Unreachable dev-warn branch in client factory** (`supabase/index.ts:74-82` dead re-check; "warn on non-anon JWT" contract not implemented). STATUS: NEW. (Cleared: service-role-guard base64 padding math verified correct.)

**7. SEV: Low — `client-info` header never sent; only attached as client property** (`supabase/index.ts:151-168`). STATUS: KNOWN-active.

**8. SEV: Low — `MESSAGE_NAMESPACES` stale and unenforced** (`messages/types.ts` lists "trw"; missing downloads/desktopStudyWorkspace/desktopUpdates/titlebar; no consumers; i18n/index.ts registry is the accurate one). STATUS: NEW.

**9. SEV: Low (adjacent, web) — `notifyAdmins` latent RPC-argument mismatch** (`useNotifications.ts:220,229` vs `011:59-62`): union allows `relatedType:"appeal"` and `""` fallback, both rejected by RPC; current callers fine, future callers fail silently. STATUS: NEW.

**Clean**: ar/en parity 47/47 namespaces, 0 flat-key mismatches (scripted); ai/ types match ai-chat edge validation; i18n runtime sound; desktop-bridge fine; waitlist type/enum/Zod consistent; no singleton races, no re-export cycles.

---

## Agent 6 — Server actions + misc API

**1. SEV: Medium — Quiz cache deletions target a key that no reader uses**
- LOC: `apps/web/src/components/subject/LectureContentModal.tsx:118` (+ `hooks/useQuizzes.ts:79,95`)
- MECHANISM: Deleting a quiz invalidates literal `"quizzes"`, but real keys are `admin_quizzes_v2`, `quizzes_all_admin_${isAdmin}`, `home_quizzes_approved`. `useQuizzesData`/`HomeClient` are never invalidated by anyone.
- SCENARIO: Doctor deletes a quiz → home/quizzes pages serve the deleted quiz from cache up to 1h; students can still open it.
- TRACE: LectureContentModal.handleDeleteQuiz → `queryCache.invalidate("quizzes")` (no-op) → stale keys hot (1h TTL) → users read deleted rows.
- FIX: Invalidate the three real keys (or `invalidatePrefix("quizzes")`/`("home_quizzes")`). / CONF: high / STATUS: NEW

**2. SEV: Medium — `subject_details_*` cache family (24h TTL, TRW publish gate) never invalidated; prefix mismatch makes bulk invalidation a no-op**
- LOC: `lib/queryCache.ts:27,131,171` vs `useUserAcademic.ts:216`; consumer `non-academic/[subject]/page.tsx:39,58`
- MECHANISM: `subjectDetails()` yields `subject_details_${slug}`, but `invalidatePrefix("subjects")` matches `startsWith("subjects")` — `"subject_details_x"` does NOT match. No other invalidation touches the family.
- SCENARIO: Admin unpublishes a TRW category → cached visitors keep seeing it 24h (cached row bypasses the `is_published` check); newly published stay invisible 24h.
- FIX: Rename prefix or add `subject_details` to invalidation paths. / CONF: high / STATUS: NEW

**3. SEV: Medium — `z.string().url()` allows `javascript:`/`data:` schemes on content URLs → stored XSS via href**
- LOC: `actions/content.ts:12,20` (schemas); sinks `LectureContentTabs.tsx:42,137`, `news/page.tsx:357`, `subjects/[subject]/page.tsx:318`
- MECHANISM: Zod `.url()` accepts `javascript:alert(1)`. `file_url`/`url` rendered directly in `href`/`window.open`. Contrast `validation/profile.ts:20-23` which restricts to http/https. Role check `content.ts:28-38` is the only gate; admin client bypasses RLS.
- SCENARIO: Compromised/malicious admin inserts file with `javascript:` URL → every student clicking the file link executes script.
- TRACE: addFile → schema passes `javascript:` URI → admin insert into `files.file_url` → `<a href={f.file_url}>` (LectureContentTabs.tsx:137).
- FIX: `.refine(u => /^https?:$/.test(new URL(u).protocol))` on both schemas. / CONF: high / STATUS: NEW

**4. SEV: Medium — syncUserProfile writes user-controlled metadata into `profiles` with zero validation**
- LOC: `actions/auth.ts:66-68` (insert), `:73-79` (update)
- MECHANISM: Users can edit own `user_metadata` via `auth.updateUser`; syncUserProfile copies `full_name`/`avatar_url` straight into `profiles` with service role — no ProfileFormSchema checks applied to the same columns.
- SCENARIO: User sets `avatar_url` to 1MB string or non-http scheme → stored unvalidated; full_name unconstrained (bypasses `validation/profile.ts:4-7`).
- FIX: Validate both fields through ProfileFormSchema shapes before writing. / CONF: high (mechanism; render context is `<img src>`) / STATUS: NEW

**5. SEV: Low — rate-limit local projection can hold out-of-order timestamps, breaking sliding-window pruning**
- LOC: `lib/rate-limit.ts:159-161` vs `:118-123`; synthetic `last_hit` appended to array END (313-316) → stale tail survives; over-strict limits + wrong Retry-After.
- FIX: Insert sorted or clamp to now. / CONF: high / STATUS: NEW

**6. SEV: Low — non-constant-time bearer-secret comparison** (`api/health/db/route.ts:26`, `api/mcp/route.ts:48` — plain string equality; hardening only). STATUS: NEW.

**Clean**: `lib/api-auth.ts` (JWT-verified session gate); `lib/logger.ts` (no secret logging in scope); `lib/cloudinary.ts` (client-side only); content.ts authz (ensureAdmin gates both actions, service-role scoped); profile.ts updateAvatar (no IDOR; minor: unchecked `auth.updateUser` result at :44); useEnrollments consistent; health/mcp fail-closed in prod; MCP OPTIONS ungated is correct preflight behavior.
