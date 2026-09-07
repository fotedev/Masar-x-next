<!--
  Masar X — Release Pipeline Reference
  Full architecture for desktop / mobile / web release distribution.
  Pulled out of AGENTS.md on 2026-09-05 to slim the orchestrator index.
  Consolidated 2026-09-07: source repo is now public, two-repo split retired.
-->

# Release Pipeline — full reference

> **When to read:** the AGENTS.md index points here when you bump a version,
> release a desktop build, or troubleshoot CI release workflows.

---

## Release distribution (current)

The project is **public** (`fotedev/Masar-x-next`), so desktop installers
and mobile builds publish directly as GitHub Releases on this same repo —
anonymous downloads and `electron-updater` work with no auth, no PAT, and
no second repo.

| Repo | Visibility | Contents |
|---|---|---|
| `fotedev/Masar-x-next` | **Public** | All source code, GitHub Actions workflows (CI + release), releases (NSIS `.exe`, portable `.exe`, mobile `.apk` when ready, `latest.yml`, `*.blockmap`) |
| `fotedev/masarx-releases` | **Public, archived read-only** | Old artifacts from the private-repo era (≤ v0.5.x); no new releases |

**Why this works:**

- `electron-builder`'s `publish:` block targets `fotedev/Masar-x-next` directly.
- `electron-updater` reads the latest release from the public repo — no GitHub auth needed for end users.
- The website links directly to `https://github.com/fotedev/Masar-x-next/releases/latest` (resolved dynamically via `apps/web/src/lib/github-releases.ts`).

**History (pre-2026-09):** the source repo was PRIVATE, so releases went to
the separate public `fotedev/masarx-releases` repo via a `GH_RELEASES_TOKEN`
PAT plus a tag-mirror step (GitHub's releases API requires the tag to exist
in the same repo as the release). Later the build moved to a
`workflow_dispatch` runner inside `masarx-releases` (`.github/workflows/build-release.yml`,
checking out the private source via `SOURCE_REPO_READ_TOKEN`) to get
unlimited public-runner minutes. All of that is retired now that the source
is public: public repos get free unlimited Actions minutes, the tag already
lives in this repo, and the built-in `GITHUB_TOKEN` (`permissions:
contents: write`) can publish.

**Adding a new platform:** additional artifacts (e.g. `.apk` for Android,
`.dmg` for macOS, `.AppImage` for Linux) go under the same release tag.
`electron-updater` is platform-aware and ignores foreign-platform assets.
Use tag prefixes like `desktop-v1.0.0` and `mobile-v1.0.0` if release
cadences diverge.

---

## How to release a new version

```powershell
# 1. Bump the version
Set-Location C:\programming\WEB_Development\projects\masarx_next
# Edit apps/desktop/package.json: "version": "0.6.0"
# Edit root package.json: "version": "0.6.0"
# Commit + push
git add apps/desktop/package.json package.json
git -c user.email='fotedev@users.noreply.github.com' -c user.name='fotedev' commit -m 'chore: bump version to 0.6.0'
git push origin main

# 2. Tag and push — the release workflow runs on the tag
git tag v0.6.0
git push origin v0.6.0

# 3. Watch the run (~7-8 min)
gh run watch --repo fotedev/Masar-x-next
# Output: https://github.com/fotedev/Masar-x-next/releases/tag/v0.6.0
```

To smoke-test without publishing: run the workflow manually from the
Actions UI ("Run workflow") — `onTagOrDraft` mode builds the `.exe` files
but skips publish on non-tag runs.

### Secrets

Only the build-time `NEXT_PUBLIC_*` values live as repo secrets (same names
as CI); no PAT is involved. `GITHUB_TOKEN` is provided automatically.

| Secret | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Inlined into the web bundle at build time |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `NEXT_PUBLIC_SITE_URL` | same |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | optional, falls back to `ci-placeholder` |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | optional, falls back to `ci-placeholder` |

Retired: `GH_RELEASES_TOKEN` (source repo) and `SOURCE_REPO_READ_TOKEN`
(`masarx-releases`) — delete both if still present.

### What the workflow does (`.github/workflows/release.yml`)

1. Trigger: push a tag matching `v*` (or manual `workflow_dispatch`)
2. `actions/checkout@v4` (this repo, root — no subdir, so gotcha #18's pinning workaround is not needed; pnpm/Node versions still pinned explicitly)
3. Setup pnpm 9.15.4 + Node 24
4. `pnpm install --frozen-lockfile`
5. `pnpm --filter desktop exec electron-builder install-app-deps` (fetches better-sqlite3's Electron 32 ABI prebuild)
6. `pnpm --filter web build` (builds the Next.js standalone bundle that the desktop app ships as an `extraResource`)
7. `pnpm --filter desktop run build:all` (electron-builder builds NSIS + Portable and publishes the GitHub Release using the built-in `GITHUB_TOKEN`)
8. List build artifacts

No tag-mirror step: the tag already exists in this repo, which is exactly
what GitHub's releases API requires.

---

## CI workflows (recap)

CI and release are fully automated via GitHub Actions. Do NOT build installers or Vercel deploys locally unless asked.

### `ci.yml` — runs on every push to `main` and every PR

5 jobs: ESLint, next build, gitleaks-artifacts, workspaces, ai-endpoint-grep. `pnpm install` uses `pnpm.neverBuiltDependencies: ["better-sqlite3"]` from root `package.json` (gotcha #8). No `--ignore-scripts` — all other postinstalls (electron, esbuild, sharp, @swc/core) still run.

### `release.yml` — tag-triggered desktop release (ACTIVE)

Trigger: push a tag matching `v*`. Steps: `pnpm install --frozen-lockfile` → `electron-builder install-app-deps` → `pnpm --filter web build` → `pnpm --filter desktop run build:all` (electron-builder creates the release and uploads `.exe` + `latest.yml` in one step).

To release: bump `package.json` + `apps/desktop/package.json`, commit, then:

```bash
git tag v0.6.0
git push origin main --follow-tags
```

Vercel deploys on every push to `main` automatically — no manual deploy needed.
