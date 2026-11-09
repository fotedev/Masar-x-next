import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = path.normalize(fileURLToPath(new URL('./src', import.meta.url)));

// Spec 022 Stage 2 — shared package tests. Pure logic only (no DOM needed).
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    testTimeout: 30_000,
    // Spec 040: coverage reporter pinned so coverage-summary.json always
    // exists for the CI artifact (report-only — no thresholds).
    coverage: { reporter: ['text', 'json-summary'] },
  },
  resolve: {
    alias: [{ find: /^@\//, replacement: `${src}/` }],
  },
});
