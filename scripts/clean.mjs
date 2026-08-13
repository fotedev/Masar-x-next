// Removes a build artifact directory (defaults to .next).
// Usage: node scripts/clean.mjs [target]
//
// We use Node's built-in fs.rmSync instead of rimraf to avoid pulling
// in a dependency that only has one job.

import { rmSync, existsSync } from "node:fs";
import path from "node:path";

const targetArg = process.argv[2] ?? ".next";
const targetPath = path.resolve(process.cwd(), targetArg);

if (!existsSync(targetPath)) {
  console.log(`[clean] ${targetArg} does not exist — nothing to do`);
  process.exit(0);
}

rmSync(targetPath, { recursive: true, force: true });
console.log(`[clean] ✓ ${targetArg} removed`);
