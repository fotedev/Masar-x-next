<!--
  Masar X — Release Pipeline Reference
  Full architecture for desktop / mobile / web release distribution.
  Pulled out of AGENTS.md on 2026-09-05 to slim the orchestrator index.
-->

# Release Pipeline — full reference

> **When to read:** the AGENTS.md index points here when you bump a version,
> release a desktop build, or troubleshoot CI release workflows.

---

## Release distribution (why two repos)

The project ships desktop installers and mobile builds from a **separate public releases repo** so the main source repo can stay private while still enabling anonymous auto-updates and direct downloads from the website.

| Repo | Visibility | Contents |
|---|---|---|
| `fotedev/Masar-x-next` | **Private** | All source code, GitHub Actions workflows, secrets (`GH_RELEASES_TOKEN`, `NEXT_PUBLIC_*`, etc.) |
| `fotedev/masarx-releases` | **Public** | NSIS `.exe`, portable `.exe`, mobile `.apk` (when ready), `latest.yml`, `*.blockmap` |

**Why this works:**

- `electron-builder`'s `provider: github` accepts a `repo` that differs from the source repo — override in the `publish:` block.
- `electron-updater` reads the latest release from the public repo — no GitHub auth needed for end users.
- The website can link directly to `https://github.com/fotedev/masarx-releases/releases/latest`.

**How the upload happens:** the `release.yml` workflow in the **private** source repo clones, builds, then pushes the artifacts to the **public** releases repo using a Personal Access Token (`GH_RELEASES_TOKEN`) stored as a secret in the private repo. The PAT needs `repo` scope on the **public** releases repo (Fine-grained token scoped to that one repo is preferred for least-privilege).

**Adding a new platform:** the public releases repo can host additional artifacts (e.g. `.apk` for Android, `.dmg` for macOS, `.AppImage` for Linux) under the same release tag. `electron-updater` is platform-aware and ignores foreign-platform assets. Use tag prefixes like `desktop-v1.0.0` and `mobile-v1.0.0` if release cadences diverge.

---

## Public Runner pipeline (since v0.5.8)

The build itself has been moved out of the private source repo into a public-runner workflow in `fotedev/masarx-releases`. The private source repo still owns the **trigger decision** (which version gets released) but the **build minutes** are now unlimited (public GitHub Actions repos get free unlimited minutes vs. the 3,000 min/month Pro quota on the private source).

### Architecture

| Repo | Workflow | Purpose | Minutes |
|---|---|---|---|
| `fotedev/Masar-x-next` (private) | `.github/workflows/release.yml.disabled` | **Dormant** — kept for history; rename back if rollback needed | 0 |
| `fotedev/masarx-releases` (public) | `.github/workflows/build-release.yml` | **Active** — `workflow_dispatch` only; checks out private source via read-only PAT, builds, publishes release | unlimited (free) |

### How to release a new version

```powershell
# 1. Bump the version in the private source repo
Set-Location C:\programming\WEB_Development\projects\masarx_next
# Edit apps/desktop/package.json: "version": "0.5.9"
# Edit root package.json: "version": "0.5.9"
# Commit + push
git add apps/desktop/package.json package.json
git -c user.email='fotedev@users.noreply.github.com' -c user.name='fotedev' commit -m 'chore: bump version to 0.5.9'
git push origin main

# 2. Trigger the public-runner workflow (NO tag push needed!)
gh workflow run build-release.yml --repo fotedev/masarx-releases -f version_tag=v0.5.9
# Output: https://github.com/fotedev/masarx-releases/actions/runs/<id>

# 3. Watch the run (~7-8 min)
gh run watch <run-id> --repo fotedev/masarx-releases
```

**Note:** no `git tag` is required. The public-runner workflow takes the source-side tag as a `workflow_dispatch` input and checks out that ref from the private source. A botched run never pollutes the git history with a tag you'd then have to delete.

### Required secrets on `fotedev/masarx-releases`

| Secret | Purpose | Where to set |
|---|---|---|
| `SOURCE_REPO_READ_TOKEN` | Fine-grained PAT, Contents: Read-only, scoped to `fotedev/Masar-x-next` only | https://github.com/fotedev/masarx-releases/settings/secrets/actions |
| `NEXT_PUBLIC_SUPABASE_URL` | Inlined into the web bundle at build time | same |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same | same |
| `NEXT_PUBLIC_SITE_URL` | same | same |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | optional, falls back to `ci-placeholder` | same |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | optional, falls back to `ci-placeholder` | same |

The old `GH_RELEASES_TOKEN` is no longer needed in the **private** source repo (since the build no longer runs there). The new public-runner workflow uses the **built-in `GITHUB_TOKEN`** of `masarx-releases` to publish — no PAT needed for the publish step itself.

### Security model

| Defense | Why |
|---|---|
| Fine-grained PAT scoped to one repo, read-only | A leaked token can only read Masar-x-next, not write anywhere |
| `if: github.repository == 'fotedev/masarx-releases'` on the job | Fork PRs cannot run the workflow even with approval |
| Actions settings: "Require approval for all external contributors" | Defense in depth — outside contributors' PRs require manual approval before their workflows can run |
| `::add-mask::` on the first secret-touching step | Prevents accidental secret leak in logs |
| Final `Clean up source checkout` step | Removes private source from runner disk so re-runs or follow-up steps cannot echo it |
| `$RUNNER_TEMP` for the mirror-tag scratch clone | Auto-cleaned by the runner; no manual delete needed |

### What it does

1. `workflow_dispatch` with `version_tag` (e.g. `v0.5.9`)
2. Mask the read token
3. `actions/checkout@v4` private source into `source-code/` (depth 1)
4. Setup pnpm 9.15.4 + Node 24 (see gotcha #18 — both pinned explicitly because the source is in a subdir)
5. `pnpm install --frozen-lockfile` in `source-code/`
6. `pnpm --filter desktop exec electron-builder install-app-deps` (fetches better-sqlite3's Electron 32 ABI prebuild)
7. `pnpm --filter web build` (builds the Next.js standalone bundle that the desktop app ships as an `extraResource`)
8. **Mirror the release tag** to `masarx-releases` (clones this repo, writes a `versions/v0.5.9.txt` marker commit, force-pushes the `v0.5.9` tag). Required because GitHub's releases API only creates a release against a tag that already exists in the same repo.
9. `pnpm --filter desktop run build:all` (electron-builder builds NSIS + Portable and publishes to `masarx-releases` using the built-in `GITHUB_TOKEN`)
10. List build artifacts
11. `Remove-Item -Recurse -Force source-code` to scrub the runner

### Why the tag-mirror step

GitHub's releases API requires "valid tag in same repo" — a 422 if you try to create a release against a tag that lives in a different repo. By pushing a marker commit + tag to `masarx-releases` first, we give electron-builder a valid tag to attach the release to. The marker commit has no real content (just `versions/v0.5.9.txt` with the run id and date); the actual release artifacts are the `.exe` and `latest.yml` files that electron-builder uploads as release assets.

---

## CI workflows (recap)

CI and release are fully automated via GitHub Actions. Do NOT build installers or Vercel deploys locally unless asked.

### `ci.yml` — runs on every push to `main` and every PR

5 jobs: ESLint, next build, gitleaks-artifacts, workspaces, ai-endpoint-grep. `pnpm install` uses `pnpm.neverBuiltDependencies: ["better-sqlite3"]` from root `package.json` (gotcha #8). No `--ignore-scripts` — all other postinstalls (electron, esbuild, sharp, @swc/core) still run.

### `release.yml.disabled` — DORMANT, kept for history

> Renamed from `release.yml` to `release.yml.disabled` in commit `ab17ec0` (2026-08-25). GitHub Actions only auto-runs files ending in `.yml` / `.yaml`. It still contains the **previous** build pipeline (the private-runner one that used `GH_RELEASES_TOKEN` to push to `masarx-releases`).

**Do not rename back to `release.yml`** unless rolling back the public-runner migration. If the public runner is unavailable:

1. Rename `release.yml.disabled` → `release.yml`
2. Ensure `GH_RELEASES_TOKEN` is still a valid secret on the private repo
3. Push a tag: `git tag vX.Y.Z && git push origin vX.Y.Z`

Trigger (when active): push a tag matching `v*`. Steps: `pnpm install --frozen-lockfile` → `electron-builder install-app-deps` → `pnpm --filter web build` → `pnpm --filter desktop run build:all` → `softprops/action-gh-release@v2` publishes the `.exe` and `latest.yml`.

To release the old way: bump `package.json` + `apps/desktop/package.json`, commit, then:

```bash
git tag v0.5.7
git push origin main --follow-tags
```

Vercel deploys on every push to `main` automatically — no manual deploy needed.
