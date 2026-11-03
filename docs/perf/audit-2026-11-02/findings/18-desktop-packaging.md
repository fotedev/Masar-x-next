# 18 — Desktop Packaging & Install Footprint

> Subagent auditor #18, 2026-11-02. Domain: apps/desktop electron-builder.yml + web standalone interplay. Coordinator spot-check: **PKG-1 verified by direct measurement** — 0 `.dll` files in `apps/web/.next/standalone` vs 2 present in `node_modules/@img/sharp-win32-x64/lib/`.

## Findings

### PKG-1 — Windows libvips DLLs are missing from the traced standalone: next/image optimization is broken in the packaged app

- **Priority P0 · Impact H** — The production web build uses the image optimizer (`images.unoptimized` is false in production, so every `next/image` renders through `/_next/image`), and sharp on win32 is dynamically linked: the traced `.node` loader requires `libvips-42.dll` from its own directory. The DLLs are absent from the trace, so `require("sharp")` fails inside the packaged Electron app and every optimized image (news grids, review avatars, user menu) 500s. Files dated Sep 22 (sharp 0.35.4 upgrade) postdate the last recorded smoke test (2026-08-21, app 0.5.6), so this has likely shipped unvalidated.
- Evidence:
  - Source has the DLLs: `node_modules/@img/sharp-win32-x64/lib/` → `libvips-42.dll` (18,614,784 B), `libvips-cpp-8.18.6.dll` (333,312 B), `sharp-win32-x64-0.35.4.node` (442,368 B).
  - Traced copy has only the loader: `apps/web/.next/standalone/node_modules/@img/sharp-win32-x64/lib/` → `sharp-win32-x64-0.35.4.node` only; `find apps/web/.next/standalone -name "*.dll"` returns nothing (0 DLLs in the whole 248MB tree) — re-verified by coordinator 2026-11-03.
  - Optimizer is active in prod: `apps/web/next.config.mjs:59` — `unoptimized: process.env.NODE_ENV !== "production"` (false in the packaged build), with Cloudinary whitelisted at `next.config.mjs:60-77`.
  - CI builds from this same traced tree: `.github/workflows/release.yml:111-134` (`pnpm --filter web build`) → `:153` (`electron-builder --win --x64`).
- Fix — Minimal fix in `apps/web/next.config.mjs`, extend the existing `outputFileTracingIncludes` (`next.config.mjs:50-52`): add `"/**": ["./node_modules/@img/sharp-win32-x64/**"]` (≈19MB). Verify by fetching any `/_next/image?url=…res.cloudinary.com…` URL from a packaged `win-unpacked` build. **Effort S.**

### PKG-2 — 185MB of all-platform sharp binaries traced into a win-only installer

- **Priority P1 · Impact H** — `node_modules/@img` = 185MB of the 248MB standalone, across 26 platform variants (darwin-x64/arm64, linux-x64/arm/arm64/ppc64/riscv64/s390x/musl, wasm32, win32-ia32/arm64…). Releases are Windows-x64 only (`release.yml:60-62`; `release.yml:153` `--win --x64`); only `@img/sharp-win32-x64` (~19MB with its DLLs, per PKG-1) is usable. ~165MB of native binaries ride along — they compress poorly (est. 60-100MB of installer bytes for dead weight) and are the single biggest driver of the delta vs the 184MB recorded installer (`docs/perf/baselines.md:62`).
- Evidence: `du -sm apps/web/.next/standalone/node_modules/@img/*` → `sharp-libvips-darwin-x64` 20MB, `sharp-libvips-linux-x64` 18MB, `sharp-libvips-linuxmusl-x64` 19MB, `sharp-wasm32` 9MB, `sharp-linux-x64` 1MB… vs `sharp-win32-x64` 1MB (loader only; DLLs missed per PKG-1).
- Fix — Add `outputFileTracingExcludes` in `apps/web/next.config.mjs` alongside PKG-1's include: exclude `./node_modules/@img/sharp-darwin-*`, `sharp-linux*`, `sharp-libvips-*` (keep the win32-x64 package via the include), `sharp-freebsd*`, `sharp-wasm32`, `sharp-webcontainers-*`, `sharp-win32-arm64`, `sharp-win32-ia32`. Net standalone: 248MB → ~85MB. Caveat: the yml still *declares* mac/linux targets (`electron-builder.yml:208-244`) — if those go live, this exclude list must be revisited (or made env-gated). Do **not** take the `images.unoptimized` shortcut: news cards use `fill` + `sizes="(max-width: 768px) 100vw, … 33vw"` against raw, untransformed Cloudinary URLs (`apps/web/src/app/[locale]/news/page.tsx:325-331`; no `w_`/`f_auto`/`q_auto` segments found in any URL-building code), and avatars use `sizes="48px"`/`"36px"` (`ReviewItem.tsx:28-32`, `UserMenu.tsx:72-77`) — unoptimized would ship full-resolution originals into thumbnail slots. **Effort S** (+ verification build).

### PKG-3 — Tracer pulls the whole apps/web source tree into standalone (coverage 19MB, src 3MB, configs)

- **Priority P1 · Impact M** — `apps/web` inside standalone is ~45MB, of which only ~7MB is legitimately needed (`.next` server artifacts 16MB incl. manifests/server; `public` 8MB comes free via extraResources). Junk traced in: `coverage/` 19MB, `src/` 3MB, `e2e/`, `scripts/`, `tsconfig.tsbuildinfo` (501KB), AGENTS.md, eslint/vitest/playwright/tsconfigs, vercel.json. Root cause is the unresolvable `fs` read in `readNamespaceFromDisk` (`apps/web/src/i18n/request.ts:118-140`, `path.join(process.cwd(), "packages", …)` at :122-124) — node-file-trace can't statically resolve it and falls back to including the project dir wholesale. (Same root cause as MID-3 — one fix, two wins.)
- Evidence: `du -sm apps/web/.next/standalone/apps/web/*` → coverage 19, public 8, .next 16, src 3; directory listing shows the configs/AGENTS.md/tsbuildinfo.
- Fix — Two-step. (a) S, zero-risk: `outputFileTracingExcludes` for `./coverage/**`, `./e2e/**`, `./scripts/**`, `./tsconfig.tsbuildinfo`, `./playwright.config.ts`, `./vitest.config.ts` (~23MB cut). (b) M, root-cause: keep the per-namespace dynamic imports (request.ts:12-115 — already correctly scoped) and either drop the production disk fallback (`request.ts:174-183`; loaders cover prod) or point `readNamespaceFromDisk` at one tracer-resolvable path declared via `outputFileTracingIncludes: {"/**": ["./packages/shared/src/messages/**"]}` — that removes the ambiguous fs access that drags the app dir in. Note: if (b) succeeds, `public` stops being traced and the extraResources public entry (PKG-6) becomes the sole source — keep it. **Effort S (a) / M (b).**

### PKG-4 — Differential updates disabled: every release re-downloads the full installer

- **Priority P2 · Impact M** — `differentialPackage: false` (`apps/desktop/electron-builder.yml:187-194`) means `electron-updater` has no `.blockmap` and every update pulls the entire ~200MB+ NSIS exe. With the payload at 248MB and the installer growing, that cost compounds per release; most update bytes (JS chunks) would otherwise diff to a fraction. The original failure (corrupt diff archive on fresh local builds without a previous release on disk, yml:189-193) doesn't apply to tagged CI builds where the prior release exists on GitHub.
- Evidence: `electron-builder.yml:194`; stale comment claiming blockmaps are generated at `.github/workflows/release.yml:142-144` — contradicted by the yml; no `*.blockmap` can be produced in that mode.
- Fix — Keep `false` for local/manual builds; re-enable in CI via `electron-builder --config.differentialPackage=true` in the release.yml tag path only (or flip the flag and rely on tag builds), and fix the stale release.yml comment. Validate one real tag update end-to-end (the corrupt-archive failure mode). **Effort M.**

### PKG-5 — `compression: normal` vs `maximum` at 248MB payload: keep normal

- **Priority P2 · Impact L (defer)** — At the current payload, `max` (solid LZMA) would save roughly 15-25% of installer bytes vs `normal` (zlib-5) — call it 30-50MB on an estimated ~200-240MB installer — but the recorded rationale (`electron-builder.yml:34-43`: "3-5 min to under 30 sec" install, "~5-10% larger") was measured on this codebase and the extraction cost scales with payload size. The absolute win (~0.5-1 min of download time on broadband) does not clearly outweigh a multi-minute install regression for every user. Numbers don't flip the tradeoff.
- Fix — No change. Re-evaluate only if PKG-2/PKG-3 land and the remaining payload (~85MB standalone) makes `max` extraction cheap enough to retest; document any change in `docs/perf/baselines.md` §3 per its method (baselines.md:69-70). **Effort S if revisited.**

### PKG-6 — `public/` shipped twice into the same destination (redundant today, load-bearing after PKG-3)

- **Priority P2 · Impact L** — extraResources entry 1 copies `../web/.next/standalone` → `web`, which today already contains `apps/web/public` (8MB, tracer fallback per PKG-3); entry 3 copies `../web/public` → the identical destination `web/apps/web/public` (`electron-builder.yml:119-131`). No installer-size doubling (same target path, second pass overwrites), but it is redundant work and a silent-overwrite hazard if the two diverge. Do **not** remove entry 3: once the wholesale tracing (PKG-3) is fixed, standalone stops containing `public` and entry 3 becomes the only source — the yml's own comment (yml:104-108) records that standalone does not copy `public/` on its own.
- Fix — No change now; after PKG-3(b) lands, entry 3 is correct as-is. Optionally note the dependency in the yml comment. **Effort S.**

## Healthy areas

- **No native-rebuild complexity**: `npmRebuild: false` (`electron-builder.yml:96`) is correct — better-sqlite3 was removed and every desktop runtime dep is pure JS (`electron-builder.yml:90-95`); nothing needs ABI rebuild or `asarUnpack`.
- **asar + static artifact naming**: `asar: true` (`:62`) with the documented 20K-files → single-archive install-speed rationale; static `artifactName` (`:33`) keeps `/releases/latest/download/` URLs stable for the updater and the website helper (`apps/web/src/lib/github-releases.ts`, per yml:28-32).
- **Updater channel hygiene**: single `publish` entry with `channel: latest` (`:295-305`) after the documented double-release/beta-channel failure — latest.yml naming matches what electron-updater probes by default.
- **Standalone crash-proofing**: explicit `outputFileTracingIncludes` for `@swc/helpers` (`next.config.mjs:50-52`) with the full MODULE_NOT_FOUND post-mortem; `dereference-standalone.cjs` runs as `postbuild` (`apps/web/package.json:12`) to flatten pnpm symlinks that NSIS cannot follow — both are the right defense-in-depth for packaging.
- **Uninstall hygiene**: `deleteAppDataOnUninstall: true` + OAuth protocol-handler include (`electron-builder.yml:196-202`).
- **Install-time file count is fine**: standalone is 3,099 files (measured), so install cost is byte-dominated, not inode-dominated; no pathological many-tiny-files extraction.

## Notes

- **Sizing estimates** (no builds permitted in this audit): current payload ≈ standalone 248MB + `.next/static` 7MB (extraResources entry 2; standalone's own `.next` 16MB contains only manifests/server — verified) + Electron 32 runtime ≈ ~470MB unpacked; with `compression: normal`, NSIS ≈ 200-240MB estimated vs 184MB recorded at 0.5.6 (`docs/perf/baselines.md:62`). PKG-1+2+3 together remove ~190MB of traced payload → estimated installer ~130-160MB and proportionally smaller update downloads if PKG-4 is also fixed.
- **PKG-1 should be re-validated on a packaged build** (fetch one `/_next/image` URL from `win-unpacked`) before any release; the 0.5.6 smoke test predates sharp 0.35.4 (file dates Sep 22, 2026).
- The `release.yml:142-144` blockmap comment is stale relative to `differentialPackage: false` — worth correcting whenever the workflow is next touched (covered in PKG-4).
