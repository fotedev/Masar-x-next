#!/usr/bin/env node
// ============================================================================
// scripts/stale-rename.mjs — Last-resort cleanup when release/ is locked.
//
// When `rmSync` fails with EPERM (some process has a file handle on a
// file inside release/), we can't delete the dir. But Windows allows
// renaming even when files are open. We rename release/ to
// release-stale-<timestamp>/, let the next build create a fresh
// release/, and the OS will eventually release the handles (the user
// can manually delete the renamed dir later, or it can be cleaned on
// the next successful build by an automatic post-step).
//
// Usage: node scripts/stale-rename.mjs
// ============================================================================

import { existsSync, renameSync } from 'node:fs';

const STALE_BASE = 'release-stale';
const SUFFIX = new Date().toISOString().replace(/[:.]/g, '-');

if (!existsSync('release')) {
  console.log('[stale-rename] release/ does not exist, nothing to rename');
  process.exit(0);
}

const target = `${STALE_BASE}-${SUFFIX}`;
try {
  renameSync('release', target);
  console.log(`[stale-rename] renamed release/ → ${target}/`);
  console.log(`[stale-rename] the renamed dir is harmless; clean it up later via File Explorer`);
} catch (err) {
  console.error(`[stale-rename] rename also failed: ${err.message}`);
  console.error(`[stale-rename] The user must close any process holding the handle.`);
  process.exit(1);
}
