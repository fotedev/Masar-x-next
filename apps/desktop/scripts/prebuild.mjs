#!/usr/bin/env node
// ============================================================================
// scripts/prebuild.mjs — Force-clean stale build outputs.
//
// Why this exists
// ---------------
// electron-builder does NOT safely overwrite a half-written `release/`
// from a previous interrupted build. On Windows, the leftover
// `desktop-<ver>-x64.nsis.7z` is then opened by the new build's 7z
// packager, which fails with:
//
//     Error: The archive is corrupt
//
// Two contributing factors (both fixed in this change set):
//   1. `nsis.differentialPackage: false` in electron-builder.yml —
//      stops the packager from trying to compute a partial-update
//      diff against a non-existent previous release.
//   2. THIS script — wipes `release/` and `dist/` so the packager
//      never sees stale files from a previous run. On Windows it
//      also best-effort kills any `Masar*` / `electron*` process
//      that may still hold file handles on the output dir.
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

const CLEAN_DIRS = ['release', 'dist'];

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
    // EBUSY/EPERM on Windows = a process still holds a file handle.
    // Try one round of process-kill + retry. If that still fails,
    // surface a clear actionable error to the user.
    const code = /** @type {NodeJS.ErrnoException} */ (err).code;
    if (code === 'EBUSY' || code === 'EPERM') {
      killLingeringProcesses();
      try {
        rmSync(dir, { recursive: true, force: true });
        removed.push(dir);
        continue;
      } catch (err2) {
        const code2 = /** @type {NodeJS.ErrnoException} */ (err2).code;
        console.error(
          `[prebuild] cannot remove ${dir}/ (${code2}). Close any ` +
            `running Masar or Electron process manually and retry.`,
        );
        process.exit(1);
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
