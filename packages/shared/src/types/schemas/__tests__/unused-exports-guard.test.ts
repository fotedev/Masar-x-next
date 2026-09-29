/**
 * Lightweight guard against re-introducing dead exports.
 *
 * Asserts that every `export const` / `export type` / `export interface`
 * declared in `schemas/index.ts` is referenced at least once across the
 * monorepo. Catches the kind of drift that spec 015 US3 fixed (5
 * `Validated*` types + 3 `Waitlist*` row types declared but never
 * imported) before it can land again.
 *
 * This is a coarse lexical check — it grep-matches identifier names
 * rather than building a real import graph. False positives are
 * possible if an identifier name happens to match a comment or a
 * string literal elsewhere; that's acceptable for the cost.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const SCHEMAS_FILE = path.resolve(
  __dirname,
  '..',
  'index.ts',
);

describe('schemas/index.ts — no dead exports', () => {
  it('every exported symbol is referenced somewhere in the monorepo', () => {
    const src = readFileSync(SCHEMAS_FILE, 'utf8');
    // Match "export const|let|var|function|class|type|interface NAME"
    const exports = [
      ...src.matchAll(/^export\s+(?:const|let|var|function|class|type|interface)\s+(\w+)/gm),
    ].map((m) => m[1]);
    expect(exports.length).toBeGreaterThan(0);

    // Run a grep across apps/ and packages/. Exclude the schemas file
    // itself (where each symbol is declared) and the test file.
    // __dirname = packages/shared/src/types/schemas/__tests__
    // To reach repo root we climb: __tests__ → schemas → types → shared → packages → repo root = 6 levels.
    const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
    const grep = execSync(
      `grep -rln --include="*.ts" --include="*.tsx" -E "${exports.join('|')}" apps packages`,
      { cwd: repoRoot, encoding: 'utf8' },
    );
    const referencingFiles = grep.split('\n').filter(Boolean);

    // The schemas file itself is always a reference, plus the test file.
    const schemasRel = path.relative(repoRoot, SCHEMAS_FILE).replace(/\\/g, '/');
    const testRel = path
      .relative(repoRoot, __dirname + '/__tests__-guard.test.ts')
      .replace(/\\/g, '/');
    const allowedNonConsuming = new Set([schemasRel, testRel]);

    for (const symbol of exports) {
      // Find at least one referencing file outside the allowed set.
      const hasExternalConsumer = referencingFiles.some((f) => {
        const norm = f.replace(/\\/g, '/');
        return !allowedNonConsuming.has(norm);
      });
      if (!hasExternalConsumer) {
        throw new Error(
          `schemas/index.ts exports \`${symbol}\` but no file outside the schema module references it. Delete it or add a consumer.`,
        );
      }
    }
  }, 30_000);
});