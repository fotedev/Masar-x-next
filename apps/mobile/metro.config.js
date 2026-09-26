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
 *
 *  4. Pin single copies of `react` (18.2.0) and `react-native` (0.74.5)
 *     for the whole Metro graph. This workspace hoists React 19 (web) at
 *     the root while mobile pins React 18; without the pin, files
 *     resolved via the root fallback silently bundle React 19 alongside
 *     18. Two React copies null the hooks dispatcher and the release APK
 *     dies on first render with `TypeError: Cannot read property
 *     'useContext' of null` inside SafeAreaProvider (device dropbox
 *     2026-09-25, Honor X6c Android 15). `extraNodeModules` is consulted
 *     before `nodeModulesPaths`, so every `react` / `react-native`
 *     import (including subpaths like `react/jsx-runtime`) lands on one
 *     canonical copy.
 *
 * CJS note (spec 018): this package must NOT declare `"type": "module"` —
 * Node loads this file, `babel.config.js`, and the Metro/Babel toolchain as
 * CJS; the ESM flag broke `expo export` with "module is not defined" in
 * babel.config.js / index.js. App sources are compiled by Metro regardless.
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

// Single-copy pin for react / react-native (see docblock §4).
// realpathSync canonicalizes pnpm symlinks so Metro keys one module ID.
//
// NOTE: `extraNodeModules` alone proved insufficient (Metro 0.80's
// exports-aware resolution path still bundled the root React 19 for some
// subtrees — verified by `exports.version = "19.2.4"` surviving in the
// bundle). The `resolveRequest` override below is the enforcement that
// sticks: every `react` / `react/*` import resolves through Node against
// the mobile React 18.2.0 copy.
config.resolver.extraNodeModules = {
  react: require("fs").realpathSync(
    path.resolve(projectRoot, "node_modules/react"),
  ),
  "react-native": require("fs").realpathSync(
    path.resolve(workspaceRoot, "node_modules/react-native"),
  ),
};

const prevResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "react" || moduleName.startsWith("react/")) {
    const filePath = require.resolve(moduleName, {
      paths: [path.resolve(projectRoot, "node_modules")],
    });
    return { filePath, type: "sourceFile" };
  }
  const fallback = prevResolveRequest ?? context.resolveRequest;
  return fallback(context, moduleName, platform);
};

module.exports = config;
