// Clean reset helper: remove all node_modules + pnpm-lock.yaml.
// Tolerant of EBUSY/EPERM (residual AV filter drivers) — warns and continues
// instead of aborting. The CI/Vercel environments re-install from scratch
// anyway, so a partial local clean is harmless.

import { existsSync, rmSync, unlinkSync } from 'node:fs';

const DIRS = [
  'node_modules',
  'apps/web/node_modules',
  'apps/desktop/node_modules',
  'apps/mobile/node_modules',
  'packages/shared/masarx-shared/node_modules',
  'packages/shared/ai/node_modules',
];

const FILES = ['pnpm-lock.yaml'];

let removed = 0;
let warned = 0;
let missing = 0;
let failed = 0;

for (const d of DIRS) {
  if (!existsSync(d)) {
    missing++;
    continue;
  }
  try {
    rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    console.log('[ok]  removed', d);
    removed++;
  } catch (err) {
    if (err.code === 'EBUSY' || err.code === 'EPERM') {
      console.log('[warn]', d, 'is locked (' + err.code + '), continuing');
      warned++;
    } else {
      console.log('[err]', d, err.message);
      failed++;
    }
  }
}

for (const f of FILES) {
  if (!existsSync(f)) {
    missing++;
    continue;
  }
  try {
    unlinkSync(f);
    console.log('[ok]  removed', f);
    removed++;
  } catch (err) {
    console.log('[err]', f, err.message);
    failed++;
  }
}

console.log('---');
console.log('removed:', removed, 'warned:', warned, 'missing:', missing, 'failed:', failed);
process.exit(failed > 0 ? 1 : 0);
