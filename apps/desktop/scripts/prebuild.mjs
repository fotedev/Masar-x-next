#!/usr/bin/env node
// ============================================================================
// scripts/prebuild.mjs — Force-clean stale build outputs before packaging.
//
// What this script does
// ---------------------
// Clean stale build outputs (`release/`, `dist/`, `out/`, `dist-release/`)
// so the electron-builder packager never sees a half-written 7z archive
// from a previous run (which would fail with "The archive is corrupt").
// On Windows it also best-effort kills any `Masar*` / `electron*` process
// that may still hold file handles on the output dir.
//
// (Spec 014: the former masarx-shared symlink materialization step was
// removed together with the dead `masarx-shared` dependency — the desktop
// main process has no runtime or type-time reference to it, so there is
// nothing left to materialize for the asar packager.)
//
// pnpm runs `pre<target>` automatically before each `build*` script
// (see `prebuild*` entries in package.json). This file is shared by
// all four hooks.
//
// Cross-platform: uses only Node's built-in `node:fs` and
// `node:child_process.execFileSync` (no shell, no PowerShell wildcards
// via the -Name parameter which doesn't accept them).
// ============================================================================

import { existsSync, rmSync } from 'node:fs';
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
