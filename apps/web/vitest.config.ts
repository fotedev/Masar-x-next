import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// apps/web sits at REPO/apps/web — the shared package is two levels up.
const shared = (p: string) => path.normalize(fileURLToPath(new URL(`../../packages/shared/src/${p}`, import.meta.url)));
const webSrc = path.normalize(fileURLToPath(new URL('./src', import.meta.url)));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // NOTE: no root `include` — projects below define their own, and with
    // extends:true (default) a root include CONCATS into every project,
    // making both projects match all files (each file ran twice).
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // masarx-shared is a workspace symlink exporting raw .ts — inline it
    // so vite transforms the source instead of handing it to node (which
    // cannot load .ts from a package "exports" entry). String form:
    // regex here matched nothing under vitest 2.1.8. Under vitest 5 the
    // file-path aliases alone proved sufficient (all node suites pass).
    // next-intl is inlined for the same class of problem in reverse: its
    // createNavigation entry imports bare `next/navigation`, which node's
    // ESM resolver cannot locate from inside the hoisted package (win32).
    server: { deps: { inline: ['masarx-shared'] } },
    // Spec 022 routing, migrated for vitest 5: environmentMatchGlobs was
    // removed in vitest 4 and vitest 5 SILENTLY IGNORES the key — the
    // replacement is projects (deprecated v3, removed v4, see
    // vitest.dev/guide/migration). .test.tsx runs under jsdom (React
    // component/hook tests); .test.ts stays on node for speed.
    projects: [
      {
        test: { name: 'node', include: ['src/**/__tests__/**/*.test.ts'] },
      },
      {
        test: {
          name: 'jsdom',
          include: ['src/**/__tests__/**/*.test.tsx'],
          environment: 'jsdom',
        },
      },
    ],
  },
  resolve: {
    // Regex array form: object-form string keys silently failed to match
    // these bare specifiers under vitest 2.1.8 on win32.
    alias: [
      { find: /^masarx-shared\/types\/schemas$/, replacement: shared('types/schemas/index.ts') },
      { find: /^masarx-shared\/format$/, replacement: shared('format/index.ts') },
      { find: /^masarx-shared\/supabase$/, replacement: shared('supabase/index.ts') },
      { find: /^masarx-shared\/types$/, replacement: shared('types/index.ts') },
      { find: /^masarx-shared\/ai$/, replacement: shared('ai/index.ts') },
      { find: /^@\//, replacement: `${webSrc}/` },
    ],
  },
});
