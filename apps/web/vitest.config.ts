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
    include: ['src/**/__tests__/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // masarx-shared is a workspace symlink exporting raw .ts — inline it
    // so vite transforms the source instead of handing it to node (which
    // cannot load .ts from a package "exports" entry). String form:
    // regex here matched nothing under vitest 2.1.8.
    server: { deps: { inline: ['masarx-shared'] } },
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
