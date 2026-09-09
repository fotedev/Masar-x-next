---
description: "Step-by-step checklist for cutting a Masar X desktop release via the public-runner pipeline"
---

# Masar X Desktop Release Cut Checklist

**Audience**: the user (FOTE) and the agent acting on their behalf.
**Time budget**: 12-15 min total (7-8 min is the build, the rest is human/check time).
**Required access**: GitHub CLI auth with `repo` scope on `fotedev/Masar-x-next` and `fotedev/masarx-releases`.

This checklist is **pipeline-agnostic** in structure (pre-flight → trigger → watch → verify → smoke → finalize), but the concrete commands are wired for the **public-runner pipeline** at `fotedev/masarx-releases`. See AGENTS.md §"Public Runner pipeline" for the architecture and the `release.yml.disabled` file in the private source for the legacy pipeline.

---

## 0. Pre-flight — before touching the workflow (1-2 min)

- [ ] **Version-bump PR is merged on `main`** (e.g. PR #23 for v0.5.9)
- [ ] **Local working tree is on `main` and clean** of unrelated work
  - `git checkout main && git pull --ff-only`
  - `git status` should be clean apart from any pre-existing branch-protection-related untracked files
- [ ] **`apps/desktop/package.json: "version"` matches the target version** (e.g. `0.5.9`)
  - `git show main:apps/desktop/package.json | Select-String '"version"'`
- [ ] **`main` HEAD is the merge commit of the version-bump PR** — capture it
  - `git rev-parse HEAD` → record the SHA, you'll compare it against the workflow's checkout
- [ ] **No uncommitted changes to `apps/web/src/actions/auth.ts` or `apps/web/src/app/api/auth/sync/route.ts`** — those are the security-critical files
  - `git status apps/web/src/actions/auth.ts apps/web/src/app/api/auth/sync/route.ts` should be clean
- [ ] **Local build works as a sanity check** (optional but recommended for first cut after a long break)
  - `pnpm --filter web build && pnpm --filter desktop build:installer`
  - Record the resulting `apps/desktop/out/Masar X-Setup-x64.exe` size in bytes
- [ ] **`gh auth status` is good** — workflow_dispatch needs valid auth
- [ ] **You have admin bypass on `fotedev/Masar-x-next` branch protection** — needed only if you need to merge a hotfix PR during the cut; the cut itself doesn't require merge privileges

---

## 1. Trigger the build (10 sec)

```powershell
$version = "v0.5.9"  # ← change for the next release
gh workflow run build-release.yml --repo fotedev/masarx-releases -f "version_tag=$version"
```

- [ ] **Workflow dispatch accepted** — `gh` returns without error
- [ ] **Capture the run ID immediately** (they're hard to find in a long list)
  ```powershell
  $runId = (gh run list --repo fotedev/masarx-releases --workflow build-release.yml --limit 1 --json databaseId --jq '.[0].databaseId')
  Write-Output "Run ID: $runId"
  ```

---

## 2. Watch the build (7-8 min)

```powershell
gh run watch $runId --repo fotedev/masarx-releases --exit-status
```

The workflow has 4 critical steps (others are housekeeping):

- [ ] **Step 3: "Checkout private source code"** — succeeds (uses the `SOURCE_REPO_READ_TOKEN` PAT)
- [ ] **Step 8: "Build Web standalone app"** — succeeds (this is where the post-merge `pnpm --filter web build` + `dereference-standalone.cjs` runs)
- [ ] **Step 9: "Mirror release tag to this repo"** — succeeds (writes `versions/vX.Y.Z.txt` marker commit, force-pushes the tag to `masarx-releases` so electron-builder can attach a release to it)
- [ ] **Step 10: "Build & Publish Desktop installers"** — succeeds (electron-builder runs NSIS + Portable, uploads to the GitHub Release that the tag-mirror just enabled)

**Gotcha to watch for**: `pnpm/action-setup@v4` may fail with `No pnpm version is specified` if the workflow's runner CWD is not the source root. The public-runner workflow checks the source out into `source-code/`, so the workflow already pins `version: 9.15.4` explicitly. If the version pin is removed in a future workflow edit, this step will fail with the same error — see AGENTS.md gotcha #18.

If any step fails, jump to **§6. Rollback** before continuing.

---

## 3. Post-cut verification on `fotedev/masarx-releases` (1 min)

- [ ] **The release exists, is not a draft, and is not pre-release**
  ```powershell
  gh release view v0.5.9 --repo fotedev/masarx-releases --json name,tagName,draft,prerelease,publishedAt
  ```
  Expected: `draft: false, prerelease: false, publishedAt: <recent ISO timestamp>`
- [ ] **All 3 assets are present**
  ```powershell
  gh release view v0.5.9 --repo fotedev/masarx-releases --json assets --jq '.assets[].name'
  ```
  Expected: `latest.yml`, `Masar-X-Setup-x64.exe`, `Masar-X-Portable-x64.exe` (in any order)
- [ ] **The static-naming convention is intact** (no `${version}` in filenames)
  - The v0.5.8 → v0.5.9 rename was a deliberate fix in commit `e94de09` for forward compatibility with `https://github.com/fotedev/masarx-releases/releases/latest/download/<name>` URLs. New filenames should match: `Masar-X-Setup-x64.exe` and `Masar-X-Portable-x64.exe` (no `-0.5.9-` segment).
- [ ] **`latest.yml` references the new version and matches the asset's sha512**
  ```powershell
  $yml = Invoke-WebRequest -Uri "https://github.com/fotedev/masarx-releases/releases/download/v0.5.9/latest.yml" -UseBasicParsing
  (-join ($yml.Content | ForEach-Object { [char]$_ })) | Select-String -Pattern 'version|path|sha512'
  ```
  Cross-check the `sha512` against the locally-built `apps/desktop/out/Masar X-Setup-x64.exe` if you ran the local build in §0.
- [ ] **The marker file `versions/v0.5.9.txt` exists on `masarx-releases` main**
  ```powershell
  gh api repos/fotedev/masarx-releases/contents/versions/v0.5.9.txt --jq '.name, .size'
  ```
  Expected: 200-ish-byte file with the run id and ISO date in it.

---

## 4. Smoke test the v0.5.9 binary (3-5 min)

**This is the security-critical step. Do not skip it.**

Pick one of:
- (Faster) Use the locally-built `apps/desktop/out/Masar X-Setup-x64.exe` from §0 — it was built from the same commit the public-runner just shipped
- (More thorough) Download the freshly-published v0.5.9 installer from the GitHub release page and install it

- [ ] **Install the binary** on a clean Windows test machine (or a Windows VM)
- [ ] **Sign in** with a test account (one of your known dev accounts — not a real user)
- [ ] **Trigger a 500 on `/api/auth/sync`** — easiest path: clear the Supabase session cookies in DevTools, then load any auth-gated page
- [ ] **Capture the response** (DevTools → Network → the failed `/api/auth/sync` POST → Response tab)
- [ ] **Verify the response shape is a proper structured error, not a regression**
  - **PASS** criteria — ALL of:
    - HTTP status is 401 (Not authenticated) or 500 (Internal server error)
    - Content-Type is `application/json`
    - Body is valid JSON, e.g. `{"error":"Not authenticated","timestamp":"..."}` or `{"error":"Internal server error","timestamp":"..."}`
    - Body contains the `error` and `timestamp` fields
  - **FAIL** criteria — ANY of (these would mean the revert caused an unhandled-exception regression):
    - HTTP status is 0 / no response (network failure)
    - Content-Type is `text/html` (Next.js error page, not the JSON error)
    - Body is empty or `undefined`
    - Body has no `error` field (something else broke)
- [ ] **Verify the leak is closed** — the response MUST NOT contain:
  - A `detail` field
  - A `code` field
  - Any string that looks like a Supabase PostgREST error (`duplicate key value`, `violates row-level security`, `violates foreign key`, `column "..." does not exist`, etc.)
- [ ] **(Optional but recommended) Repeat in dev mode** — set `NODE_ENV=development` in the desktop's local Next.js env, trigger the same 500, and confirm the response DOES include `detail: <error.message>` in dev (the `process.env.NODE_ENV === 'development'` check from PR #22 is what controls this; verifying both branches proves the gate works as intended)

If any FAIL criterion fires, **stop and roll back** — see §6.

---

## 5. Finalize the v0.5.8 security notice (1 min)

The notice added in §0 of the v0.5.8 release page (per Option B) says "update to v0.5.9 or later." Now that v0.5.9 is live, the reference must resolve.

- [ ] **Open the v0.5.8 release page in a browser**
  `https://github.com/fotedev/masarx-releases/releases/tag/v0.5.8`
- [ ] **Verify the link target is reachable**
  - Click the "v0.5.9" reference in the notice, or manually open `https://github.com/fotedev/masarx-releases/releases/tag/v0.5.9`
  - Expected: 200 with the v0.5.9 release page (Setup + Portable + latest.yml visible)
- [ ] **If v0.5.9 is missing or the link 404s**, the v0.5.8 notice is now a forward reference that doesn't resolve. Fix it:
  ```powershell
  $notes = @"
  ⚠️ Action required: update to the latest release.

  Security notice (added 2026-08-26): v0.5.8 contains a temporary
  diagnostic code path in /api/auth/sync that returns Supabase error
  details (message, code, details, hint) on 500 responses. This is a
  bounded information-disclosure issue — no credentials are exposed,
  and it only fires on error responses. All users should update to
  the latest release, which reverts the diagnostic code to generic
  error responses. See PR #22 for the fix.
  "@
  gh release edit v0.5.8 --repo fotedev/masarx-releases --notes $notes
  ```
  The "to the latest release" wording is the safe fallback — it points at `/releases/latest` (GitHub's auto-redirect to whatever the most recent release is), so the notice stays correct even if a v0.5.10 is later cut for a different reason.

- [ ] **Verify the latest.yml is unchanged on the v0.5.8 release** (this was the critical "didn't break the auto-updater" check when Option B was applied — same check after the cut)
  ```powershell
  $prev = (Invoke-WebRequest -Uri 'https://github.com/fotedev/masarx-releases/releases/download/v0.5.8/latest.yml' -UseBasicParsing).Content
  (-join ($prev | ForEach-Object { [char]$_ })) | Select-String -Pattern 'version|sha512|releaseDate'
  ```
  Expected: `version: 0.5.8`, `releaseDate: '2026-08-25T07:06:32.523Z'` (unchanged from the original publish). v0.5.8 must remain a valid source for the v0.5.8 → v0.5.9 auto-update transition.

---

## 6. Rollback (if anything in §2-4 failed)

- [ ] **If the build failed mid-run**: the workflow's `Build & Publish Desktop installers` step may have created a partial release. Inspect:
  ```powershell
  gh release view v0.5.9 --repo fotedev/masarx-releases 2>&1
  ```
  If the release exists with partial assets, delete it:
  ```powershell
  gh release delete v0.5.9 --repo fotedev/masarx-releases --yes
  ```
  Then fix the underlying cause (check the workflow logs) and re-trigger.
- [ ] **If the build succeeded but the smoke test in §4 failed (regression)**: do NOT delete the release outright. Instead:
  1. Mark the release as a draft so new users don't download it:
     ```powershell
     gh release edit v0.5.9 --repo fotedev/masarx-releases --draft
     ```
  2. Investigate the smoke-test failure (typically a TypeScript runtime error from the revert)
  3. Cut `v0.5.9-hotfix1` with the fix
  4. Once the hotfix is published, you can leave v0.5.9 as a draft permanently (it'll be invisible in the public listing) or delete it
- [ ] **If the smoke test in §4 failed (leak still present)**: this means PR #22 was bypassed somehow. The fix is in the v0.5.9 binary only if PR #22's commit is in the source-side `version_tag` ref's ancestry. Verify with:
  ```powershell
  git fetch --tags origin
  git merge-base --is-ancestor 4267006 v0.5.9 && Write-Output 'PR #22 IS in v0.5.9' || Write-Output 'PR #22 is NOT in v0.5.9 — investigate'
  ```
  (Replace `4267006` with the actual merge commit SHA of the diagnostic-revert PR for the release in question.) If the result is "NOT in v0.5.9", the workflow checked out a different ref than the version-bump commit — re-trigger with the correct `version_tag`.

---

## Done

When all checkboxes in §0-5 are ticked, the release is complete. Total wall time is typically:
- §0: 1-2 min (mostly reading)
- §1: 10 sec
- §2: 7-8 min (the actual build)
- §3: 1 min
- §4: 3-5 min (install + manual verification)
- §5: 1 min

**Total: ~12-15 min**, of which ~10 min is waiting for the build to run.

**Send the agent a status note** so it can update any in-flight checklists (e.g. `specs/004-multi-platform-expansion/tasks.md` if T025 or T067 depend on the release number).

---

## Cross-references

- AGENTS.md §"Public Runner pipeline" — architecture of the build pipeline
- AGENTS.md §"Release distribution" — why there are two repos (private source, public releases)
- AGENTS.md gotcha #16 — GitHub Releases on a private repo are private
- AGENTS.md gotcha #17 — `artifactName` and `/releases/latest/download/<name>` literal URL matching
- AGENTS.md gotcha #18 — `pnpm/action-setup@v4` CWD pitfall
- `electron-builder.yml` — the `nsis.artifactName: "${productName}-Setup-${arch}.${ext}"` is what makes the `latest.yml` reference a static filename across releases

## Versioning

This file was created for the v0.5.9 cut (PR #23 version bump). It is version-agnostic in structure and reusable for any future desktop release (v0.5.10+, v0.6.0, etc.) — replace `v0.5.9` with the target version when reusing.
