/**
 * Metro config for the pnpm monorepo.
 *
 * Two adjustments over the Expo SDK 51 default:
 *
 *  1. Watch the workspace root so edits to `packages/shared` (masarx-shared)
 *     trigger reloads - the mobile app imports the shared package's TS
 *     sources directly (see packages/shared/package.json `exports`).
 *
 *  2. Resolve modules from both the app's node_modules and the workspace
 *     root's node_modules (pnpm's virtual-store layout).
 *
 *  3. Enable package `exports` resolution. Metro 0.80 (React Native 0.74 /
 *     SDK 51) ships `unstable_enablePackageExports` defaulting to false;
 *     without it, subpath imports like `masarx-shared/supabase` fail to
 *     resolve at bundle time even though tsc (moduleResolution: bundler)
 *     accepts them.
 */
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.unstable_enablePackageExports = true;

module.exports = config;