#!/usr/bin/env node
// ============================================================================
// scripts/force-clean.mjs — One-shot force-cleanup for stuck release/ dirs.
//
// When the regular prebuild.mjs fails with EPERM because some background
// process (antivirus, file system cache, IDE watcher) holds a handle on
// the release/ dir, this script retries with a sleep. It does NOT kill
// any processes — that's the regular prebuild's job. This is just a
// brute-force retry to clear the directory.
//
// Usage: node scripts/force-clean.mjs
// ============================================================================

import { existsSync, rmSync } from 'node:fs';

const TARGETS = ['release', 'dist'];
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function forceRemove(dir) {
  if (!existsSync(dir)) {
    console.log(`[force-clean] ${dir}/ does not exist, skipping`);
    return;
  }
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      rmSync(dir, { recursive: true, force: true });
      console.log(`[force-clean] removed ${dir}/ (attempt ${attempt})`);
      return;
    } catch (err) {
      const code = /** @type {NodeJS.ErrnoException} */ (err).code;
      console.warn(
        `[force-clean] cannot remove ${dir}/ (${code}), ` +
          `attempt ${attempt}/${MAX_RETRIES}, sleeping ${RETRY_DELAY_MS}ms...`,
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }
  console.error(
    `[force-clean] gave up on ${dir}/ after ${MAX_RETRIES} attempts. ` +
      `A process may still have a handle on it. Try closing any open ` +
      `File Explorer windows pointed at this folder, then re-run.`,
  );
  process.exit(1);
}

for (const dir of TARGETS) {
  await forceRemove(dir);
}
