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
    // Spec 040: coverage reporter pinned so coverage-summary.json always
    // exists for the CI artifact (report-only — no thresholds).
    coverage: { reporter: ['text', 'json-summary'] },
  },
});
