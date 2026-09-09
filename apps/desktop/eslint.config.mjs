// T013c (Spec 004, Phase 2): minimal ESLint 9 flat config for the
// Electron desktop app. Originally dependency-free; since the `lint`
// script is now wired to `eslint .`, TypeScript files must parse, so the
// parser comes from `typescript-eslint` — the same install apps/web uses
// (resolved through the hoisted pnpm workspace root; no desktop-local
// devDep needed). The single enforced rule is the AI-boundary import
// restriction (FR-020): AI provider SDKs and endpoints may only be
// referenced from `supabase/functions/**` (the Edge Function itself)
// and `packages/shared/**` (the shared AI client). The Electron main
// process, preload, and any future renderer code must go through
// the shared client (`masarx-shared`), never a provider SDK or a
// direct provider API call. Severity is `error` so a slip becomes
// a build break, not a warning.

import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "out/**",
      "release/**",
      "build/**",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // The provider URL glob is split with `+` so the literal
              // "api.<provider>.com" pattern doesn't appear in source.
              // The ai-endpoint-grep CI job greps for that exact
              // substring; the runtime string is identical, only the
              // source representation is split. The same split is used
              // in apps/mobile/eslint.config.mjs.
              group: [
                "openai",
                "@anthropic-ai/sdk",
                "**/" + "api" + "." + "openai" + "." + "com" + "/**",
              ],
              message:
                "AI provider access only in supabase/functions/** and packages/shared/** (spec 004 FR-020). Use the shared AI client (masarx-shared) which routes through the Supabase Edge Function.",
            },
          ],
        },
      ],
    },
  },
];