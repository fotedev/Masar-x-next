import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

// ============================================================================
// Preload build-shape regression test
//
// Background: in T025 the packaged desktop app failed to load the preload
// script with `SyntaxError: Cannot use import statement outside a module`.
// The root cause was that `tsc -p tsconfig.build.json` (module: ESNext)
// emitted the preload as raw ESM, and Electron's `runPreloadScript` ran it
// as a classic script.
//
// The fix in `tsconfig.preload.json` is a separate compilation that
// targets `module: CommonJS` for `src/main/preload.ts` only. The main
// process keeps ESM; only the preload is CJS. This test pins the
// contract so a future contributor who changes the tsconfig or replaces
// the build with a bundler will see a clear failure if the preload
// regresses to raw ESM.
//
// The assertions are intentionally conservative — they accept any of the
// common CJS shapes tsc produces (with or without
// `Object.defineProperty(exports, "__esModule", …)`, with or without a
// `"use strict";` prologue). The one thing they forbid is a bare
// top-level `import` or `export` statement.
// ============================================================================

// This test file lives at apps/desktop/src/main/__tests__/preload-build.test.ts
// so __dirname is the __tests__ folder. To reach the desktop root
// (apps/desktop) we walk up three levels; to reach the monorepo root we
// walk up four.
const DESKTOP_ROOT = path.resolve(__dirname, '../../..');
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const PRELOAD_DIST = path.join(
  DESKTOP_ROOT,
  'dist',
  'apps',
  'desktop',
  'src',
  'main',
  'preload.js',
);

function buildPreload(): void {
  // Invoke the typescript compiler directly via node. This avoids the
  // Windows `.cmd` shim issue (`execFileSync` throws EINVAL on a .cmd
  // without `shell:true`, and `shell:true` then makes `cwd` resolution
  // unreliable). The tsc JS entry is at
  // <repo>/node_modules/typescript/bin/tsc, hoisted there by pnpm
  // (node-linker=hoisted in the root .npmrc).
  const tscJs = path.join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
  if (!existsSync(tscJs)) {
    throw new Error(`tsc not found at ${tscJs}`);
  }
  // Pass an absolute config path so we don't depend on the child process's
  // cwd (vitest may spawn workers from a different directory).
  const tsconfigAbs = path.join(DESKTOP_ROOT, 'tsconfig.preload.json');
  if (!existsSync(tsconfigAbs)) {
    throw new Error(`tsconfig not found at ${tsconfigAbs}`);
  }
  try {
    execFileSync(process.execPath, [tscJs, '-p', tsconfigAbs], {
      cwd: DESKTOP_ROOT,
      stdio: 'pipe',
      shell: false,
    });
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { stdout?: Buffer; stderr?: Buffer };
    const out = e.stdout?.toString('utf8') ?? '';
    const errOut = e.stderr?.toString('utf8') ?? '';
    throw new Error(
      `tsc failed (status=${(e as any).status}):\n` +
        `stdout:\n${out}\nstderr:\n${errOut}`,
    );
  }
}

describe('preload build shape', () => {
  it('emits a CommonJS preload.js (no raw ESM import/export)', () => {
    // Run the dedicated preload build. This compiles src/main/preload.ts
    // with `module: CommonJS` and writes to dist/apps/desktop/src/main/preload.js.
    buildPreload();

    expect(existsSync(PRELOAD_DIST)).toBe(true);
    const source = readFileSync(PRELOAD_DIST, 'utf8');

    // Negative assertions: the file must not look like raw ESM.
    // We anchor on the first non-comment, non-blank line so we don't false-
    // positive on the word `import` appearing inside a string literal.
    const firstRealLine = source
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*'));
    expect(firstRealLine, 'preload.js should not start with a comment').toBeTruthy();
    expect(
      firstRealLine!.startsWith('import '),
      `preload.js must not start with "import " — found: ${firstRealLine!}`,
    ).toBe(false);
    expect(
      firstRealLine!.startsWith('export '),
      `preload.js must not start with "export " — found: ${firstRealLine!}`,
    ).toBe(false);

    // Positive assertions: the file should look like CJS. tsc with
    // module: CommonJS emits at least one of these markers.
    const hasCjsMarker =
      source.includes('Object.defineProperty(exports, "__esModule"') ||
      source.includes('"use strict"') ||
      /require\(["']electron["']\)/.test(source) ||
      /\bmodule\.exports\b/.test(source) ||
      /\bexports\.[A-Za-z_$]/.test(source);
    expect(hasCjsMarker, 'preload.js should contain CommonJS markers').toBe(true);
  });
});
