// Generates public/sw.js from public/sw.template.js, injecting a unique
// build identifier into the CACHE_NAME constant. This guarantees that
// every deploy produces a different Service Worker byte sequence, so
// the browser detects the change and fires the install/activate events
// — which purge the previous cache automatically.
//
// Resolution order for the build id:
//   1. VERCEL_GIT_COMMIT_SHA  (production deploys)
//   2. GITHUB_SHA             (other CI environments)
//   3. local-<timestamp>      (local dev — every run gets a unique value
//                             so HMR restarts invalidate the SW too)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const templatePath = path.join(projectRoot, "public", "sw.template.js");
const outputPath = path.join(projectRoot, "public", "sw.js");

if (!existsSync(templatePath)) {
  console.error(
    `[inject-sw-version] template not found at ${templatePath}`
  );
  process.exit(1);
}

const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ??
  process.env.GITHUB_SHA?.slice(0, 7) ??
  `local-${Date.now()}`;

const template = readFileSync(templatePath, "utf8");
const output = template.replace(/__BUILD_ID__/g, `masarx-${buildId}`);

if (output === template) {
  console.warn(
    "[inject-sw-version] no __BUILD_ID__ placeholder found in template"
  );
  process.exit(0);
}

writeFileSync(outputPath, output, "utf8");
console.log(
  `[inject-sw-version] generated public/sw.js with CACHE_NAME=masarx-${buildId}`
);
