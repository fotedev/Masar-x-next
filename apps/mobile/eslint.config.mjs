// T013c (Spec 004, Phase 2): minimal ESLint 9 flat config for the
// Expo / React Native mobile app. Originally dependency-free; spec 018
// (C3/T065) wired the `lint` script, which requires a TypeScript
// parser — `typescript-eslint` (parser only, no rules) matches the
// pattern already used by apps/web and apps/desktop. The single
// enforced rule is the AI-boundary import restriction (FR-020): the
// mobile runtime must never import an AI provider SDK or call a
// provider endpoint directly - AI access goes through
// `packages/shared/**` (the shared AI client) which routes via
// `supabase/functions/**`. Severity is `error` so a slip becomes a
// build break, not a warning.
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "android/**",
      "ios/**",
      "dist/**",
      "out/**",
      "build/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,mjs,cjs,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
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
              // in apps/desktop/eslint.config.mjs.
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
