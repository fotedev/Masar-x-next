# Smoke Test Report — `refactor/supabase-migration-and-fixes`

> **Status:** Required before merge to `main`.
> **Owner:** Reviewer / PR author.
> **Date completed:** ____________

This report tracks the manual runtime verification of the data-layer
migration in commit `ef15973` (DB migration Drizzle → Supabase JS).
The compile-time checks (`pnpm typecheck`, `next build`) pass, but
because the migration introduces `as never` casts that suppress
TypeScript checking on the payload shapes, **runtime verification is
mandatory** before this branch can be merged.

## Pre-requisites

Before running the tests, confirm the following locally:

- [ ] Supabase dev or staging project is reachable
- [ ] `.env.local` contains:
  - `NEXT_PUBLIC_SUPABASE_URL` (e.g. `https://xxx.supabase.co`)
  - `SUPABASE_SERVICE_ROLE_KEY` (service-role, not anon)
  - `DATABASE_URL_IPV4` (still required because `admin-db/db.ts` is
    kept as a safety net until the next cleanup commit)
- [ ] `pnpm dev` starts without error
- [ ] A test user account exists (or you can sign up a new one)
- [ ] An admin user account exists for tests 6 and 7

## Test 1 — Health check (probes connectivity)

**Endpoint:** `GET /api/health/db`

```bash
curl -i http://localhost:3000/api/health/db
```

**Expected:**

- HTTP 200
- JSON body contains:
  - `status: "healthy"`
  - `database: "connected"`
  - `probe: "supabase-rest"` (proves the new PostgREST probe ran,
    not the old `SELECT 1`)
  - `latency` value in milliseconds
- Response time < 500ms on a warm connection

**Failure indicates:** Service-role key missing, wrong Supabase URL,
or PostgREST layer unreachable.

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Test 2 — Profile fetch via layout

**Action:** Sign in with a regular user, then navigate to any
localized page (e.g. `/ar`).

**Expected:**

- Browser DevTools → Network tab shows a 200 from the layout's
  `getProfile` call (no 500, no console errors)
- The page renders the user-specific chrome (avatar, username, or
  at minimum the language toggle works)
- The server log shows no `[layout] RAW ERROR:` lines

**How to verify all 11 fields are mapped:** in DevTools, view
source / React DevTools and confirm the rendered `AppProviders`
`profile` prop has these 11 keys (all defined, none `undefined`):

- `id`
- `updatedAt`
- `username`
- `fullName`
- `avatarUrl`
- `website`
- `level`
- `semester`
- `departmentId`
- `showExtraAssets`
- `showExtraAssetsUpdatedAt`

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Test 3 — Profile update

**Action:** From the user profile page, change any field (e.g.
`fullName` or `website`), save, then refresh the page.

**Expected:**

- The change is persisted in the database (verify via Supabase
  Studio: `select * from profiles where id = '<user_id>'`)
- The change survives a hard refresh of the page
- The action's server log shows no `upsertError` thrown

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Test 4 — Avatar update

**Action:** From the user profile page, upload a new avatar image.

**Expected:**

- The image uploads to Cloudinary successfully
- The user's `avatar_url` column is updated in the database
- The new avatar appears in the Header immediately (no stale
  cached image — the `key={avatarUrl}` fix should guarantee this)
- The Supabase `auth.users.user_metadata.avatar_url` is also
  updated (the action syncs both for fallback rendering)

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Test 5 — New user signup triggers `syncUserProfile`

**Action:** Sign out, then sign up with a new email (or use a
pre-created test user with no existing `profiles` row).

**Expected:**

- The `syncUserProfile` server action runs automatically after
  signup (triggered from the layout or a hook)
- A new row exists in `profiles` with:
  - `id` = the new auth user's UUID
  - `full_name` from OAuth metadata (or `null` for email signup)
  - `avatar_url` from OAuth metadata (or `null`)
  - `updated_at` set to roughly the signup time
- No `selectError` or `insertError` in the server log

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Test 6 — Content add (file or video)

**Action:** As an admin user, open the admin dashboard, choose a
subject, and add a new file (or video) with a real `lectureKey`.

**Expected:**

- The `resolveSubjectAndLecture` helper returns non-null IDs
  (subject and lecture both exist in the database)
- The new row is inserted in `files` (or `videos`) with the
  resolved `subject_id` and `lecture_id` populated
- No orphaned records (no file whose `subject_id` is null while
  `subject` text is non-null — the migration should keep both
  fields consistent)
- The file appears in the subject's content list

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Test 7 — Admin route regression check

**Endpoint:** `GET /api/admin/drizzle-profiles` (authed as admin)

```bash
curl -H "Cookie: <admin-session-cookie>" \
     http://localhost:3000/api/admin/drizzle-profiles
```

**Expected:**

- HTTP 200
- JSON body:
  ```json
  {
    "count": <number>,
    "rows": [
      { "id": "...", "username": "...", "fullName": "...", "updatedAt": "..." },
      ...
    ]
  }
  ```
- The `rows` array uses **camelCase** keys (`fullName`, `updatedAt`)
  — this is the manual mapping done in the route. Compare to the
  pre-migration response to confirm parity.
- `count` matches the array length and is ≤ 5 (the route limits to
  5 rows)

| Result | Pass / Fail | Notes |
|--------|-------------|-------|
|        |             |       |

## Sign-off

Once all 7 tests pass, sign below and link this report in the PR
description.

| Reviewer | Date | Result | PR / branch |
|----------|------|--------|-------------|
|          |      |        |             |

## Rollback plan

If any test fails, **do not continue to merge**. Use one of:

1. **Fix in-place:** commit a `fix(db): ...` follow-up on top of
   `ef15973` that addresses the failing assertion. The atomic
   commits make this straightforward via `git revert` or
   `git commit --fixup`.

2. **Full revert:** if the migration is fundamentally broken in
   production, revert the entire branch with:
   ```bash
   git revert --no-commit cc473ee..HEAD
   git commit -m "revert: rollback Drizzle → Supabase JS migration"
   ```
   Note that this also reverts the CORS fix (commit 2) and the
   upload-file improvements (commit 4); if those are still wanted
   independently, cherry-pick them after the revert.

3. **Hot-fix on main:** the `admin-db/db.ts` deprecation comment
   means the old Drizzle path is still importable as a safety net.
   You can switch any of the migrated server actions back to
   `getAdminDb()` + Drizzle without a code revert, as long as the
   `DATABASE_URL_IPV4` env var is still configured.

## Known follow-ups (not blockers for this PR)

- [ ] Remove `image/svg+xml` exclusion (add server-side sanitizer)
- [ ] Consolidate the 6 `as never` casts into a `fromTyped<T>()`
      helper
- [ ] Drop the unused `serverExternalPackages: ["pg"]` from
      `next.config.mjs`
- [ ] Delete `src/lib/admin-db/` entirely and remove `drizzle-orm`,
      `drizzle-kit`, `pg` from `package.json`
- [ ] Rewrite `scripts/db-diagnose.cjs` to use Supabase JS instead
      of `pg` directly
