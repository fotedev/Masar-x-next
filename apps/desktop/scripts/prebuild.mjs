#!/usr/bin/env node
// ============================================================================
// scripts/prebuild.mjs — Force-clean stale build outputs and prepare the
// masarx-shared package for the asar packager.
//
// What this script does
// ---------------------
// 1. Clean stale build outputs (`release/`, `dist/`) so the electron-builder
//    packager never sees a half-written 7z archive from a previous run
//    (which would fail with "The archive is corrupt"). On Windows it also
//    best-effort kills any `Masar*` / `electron*` process that may still
//    hold file handles on the output dir.
//
// 2. Materialize the `node_modules/masarx-shared` workspace symlink as a
//    real directory copy of `packages/shared/`. Reason: electron-builder's
//    asar packager follows symlinks during its `asarUnpack` pattern walk,
//    and rejects any path that resolves outside `apps/desktop/`. Replacing
//    the symlink with a real directory inside the app tree lets `asar:
//    true` work without the "packages/shared/package.json must be under
//    apps/desktop/" error. `node-linker=hoisted` in the root .npmrc does
//    NOT fix this on its own (pnpm 8+ still creates real symlinks for
//    workspace packages, only flattens non-workspace deps).
//
//    The desktop main process only has a `import type` reference to
//    masarx-shared (erased at compile time), so this copy exists purely
//    to satisfy the asar packager's path-resolution check. We exclude
//    `node_modules/` and `dist/` from the copy to keep it small (the
//    shared package's runtime deps are already inside the web standalone
//    bundle, and the desktop main process doesn't load masarx-shared at
//    runtime).
//
//    `pnpm dev` ergonomics: the symlink is gone during the build, so
//    edits to `packages/shared/src/` won't be picked up by a running
//    `pnpm dev` instance. To restore the symlink after the build (e.g.
//    when switching back to dev), re-run `pnpm install` — pnpm recreates
//    workspace symlinks on every install.
//
// pnpm runs `pre<target>` automatically before each `build*` script
// (see `prebuild*` entries in package.json). This file is shared by
// all four hooks.
//
// Cross-platform: uses only Node's built-in `node:fs` and
// `node:child_process.execFileSync` (no shell, no PowerShell wildcards
// via the -Name parameter which doesn't accept them).
// ============================================================================

import { cpSync, existsSync, lstatSync, rmSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { platform } from 'node:process';

const CLEAN_DIRS = ['out', 'dist-release', 'release', 'dist'];

// Windows-only: best-effort kill of lingering Masar/Electron processes
// that may hold file handles on release/. We use PowerShell's
// `Get-Process` with a `-like` filter because `Stop-Process -Name`
// does NOT accept wildcards on the Name parameter. The call is
// wrapped in try/catch + stdio:'ignore' so a failure here never
// blocks the build.
function killLingeringProcesses() {
  if (platform !== 'win32') return;
  try {
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        "Get-Process | Where-Object { $_.Name -like 'Masar*' -or $_.Name -like 'electron*' } | Stop-Process -Force -ErrorAction SilentlyContinue; exit 0",
      ],
      { stdio: 'ignore' },
    );
  } catch {
    /* best-effort — never block the build on this */
  }
}

const removed = [];

for (const dir of CLEAN_DIRS) {
  if (!existsSync(dir)) continue;
  try {
    rmSync(dir, { recursive: true, force: true });
    removed.push(dir);
  } catch (err) {
    // EBUSY/EPERM on Windows = a process still holds a file handle on
    // a file inside the dir. Try one round of process-kill + retry.
    // If that still fails, log a warning and CONTINUE — we don't want
    // a stale dir from a previous run to block the current build (the
    // new build will write to a different output dir, so the stale
    // dir is just garbage that the user can clean up later).
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (code === 'EBUSY' || code === 'EPERM') {
      killLingeringProcesses();
      try {
        rmSync(dir, { recursive: true, force: true });
        removed.push(dir);
        continue;
      } catch (err2) {
        const code2 = /** @type {NodeJS.ErrnoException} */ (err2).code;
        console.warn(
          `[prebuild] cannot remove ${dir}/ (${code2}). ` +
            `A previous build's files are still locked by a process. ` +
            `Continuing — the new build will write to a separate dir. ` +
            `Clean up ${dir}/ manually when convenient.`,
        );
        continue;
      }
    }
    throw err;
  }
}

if (removed.length > 0) {
  console.log(`[prebuild] cleaned stale output: ${removed.join(', ')}/`);
} else {
  console.log('[prebuild] no stale output to clean');
}

// ----------------------------------------------------------------------------
// Materialize the masarx-shared workspace symlink as a real directory copy.
// See the file header for why this is needed (electron-builder asar + pnpm
// workspace symlink issue).
// ----------------------------------------------------------------------------
const SHARED_SYMLINK = 'node_modules/masarx-shared';
const SHARED_SOURCE = '../../packages/shared';

function shouldCopyShared() {
  if (!existsSync(SHARED_SOURCE)) {
    // Source missing (running the script from an unexpected cwd). Skip
    // silently — the asar packager will fail with a clear error if the
    // symlink is unresolved.
    return false;
  }
  if (!existsSync(SHARED_SYMLINK)) {
    return true; // first run after pnpm install + build
  }
  const lst = lstatSync(SHARED_SYMLINK);
  if (lst.isSymbolicLink()) {
    return true; // still a pnpm symlink — replace it
  }
  // Real directory from a previous prebuild run. Re-copy if the source
  // is newer than the destination, so edits to packages/shared/src/ are
  // picked up.
  const srcMtime = lstatSync(SHARED_SOURCE).mtimeMs;
  const dstMtime = lst.mtimeMs;
  return srcMtime > dstMtime;
}

if (shouldCopyShared()) {
  // Remove whatever's there now (symlink or stale directory).
  if (existsSync(SHARED_SYMLINK)) {
    const lst = lstatSync(SHARED_SYMLINK);
    if (lst.isSymbolicLink()) {
      unlinkSync(SHARED_SYMLINK);
    } else {
      rmSync(SHARED_SYMLINK, { recursive: true, force: true });
    }
  }
  cpSync(SHARED_SOURCE, SHARED_SYMLINK, {
    recursive: true,
    filter: (src) => {
      // Normalize path separators for cross-platform matching.
      const rel = src.replace(/\\/g, '/');
      // Skip the shared package's own node_modules (huge, and the desktop
      // main process doesn't load masarx-shared at runtime — the import
      // is type-only). Skip dist/ defensively (no dist currently exists
      // for shared, but if one is added in the future it shouldn't be
      // copied here either). Skip .git/ and any other VCS metadata.
      if (rel.endsWith('/node_modules') || rel.includes('/node_modules/')) return false;
      if (rel.endsWith('/dist') || rel.includes('/dist/')) return false;
      if (rel.endsWith('/.git') || rel.includes('/.git/')) return false;
      return true;
    },
  });
  console.log('[prebuild] materialized masarx-shared symlink as a real directory copy');
} else {
  console.log('[prebuild] masarx-shared is up-to-date, skipping copy');
}
