import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = path.normalize(fileURLToPath(new URL('./src', import.meta.url)));

// Spec 022 Stage 7 — explicit config (mobile previously ran on vitest
// defaults). Pure-logic node tests; RN screens/hooks are a documented
// non-goal (would need @testing-library/react-native + react-dom).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
  },
  resolve: {
    alias: [{ find: /^@\//, replacement: `${src}/` }],
  },
});
