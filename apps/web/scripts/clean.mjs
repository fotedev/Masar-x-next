// Removes cached build output. With no argument it clears the full stale-cache
// set (.next, out, node_modules/.cache — spec 005 US4 / FR-025); with an
// argument it removes just that one target.
// Usage: node scripts/clean.mjs [target]
//
// We use Node's built-in fs.rmSync instead of rimraf to avoid pulling
// in a dependency that only has one job.

import { rmSync, existsSync } from "node:fs";
import path from "node:path";

const DEFAULT_TARGETS = [".next", "out", "node_modules/.cache"];

const targets = process.argv[2] ? [process.argv[2]] : DEFAULT_TARGETS;

for (const target of targets) {
  const targetPath = path.resolve(process.cwd(), target);

  if (!existsSync(targetPath)) {
    console.log(`[clean] ${target} does not exist — nothing to do`);
    continue;
  }

  rmSync(targetPath, { recursive: true, force: true });
  console.log(`[clean] ✓ ${target} removed`);
}
