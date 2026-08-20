import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/__tests__/**/*.test.ts',
      '__tests__/**/*.test.ts',
    ],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      'masarx-shared/supabase': new URL('../../../packages/shared/src/supabase/index.ts', import.meta.url).pathname,
      'masarx-shared/types': new URL('../../../packages/shared/src/types/index.ts', import.meta.url).pathname,
      'masarx-shared/ai': new URL('../../../packages/shared/src/ai/index.ts', import.meta.url).pathname,
    },
  },
});
