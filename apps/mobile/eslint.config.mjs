// T013c (Spec 004, Phase 2): minimal ESLint 9 flat config for the
// Expo / React Native mobile app. Deliberately dependency-free - no
// parsers, no plugins, nothing to install (apps/mobile has no
// devDependencies yet; add `eslint` only when the mobile `lint`
// script is wired to run eslint). The single enforced rule is the
// AI-boundary import restriction (FR-020): the mobile runtime must
// never import an AI provider SDK or call a provider endpoint
// directly - AI access goes through `packages/shared/**` (the shared
// AI client) which routes via `supabase/functions/**`. Severity is
// `error` so a slip becomes a build break, not a warning.

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
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["openai", "@anthropic-ai/sdk", "**/api.openai.com/**"],
              message:
                "AI provider access only in supabase/functions/** and packages/shared/** (spec 004 FR-020). Use the shared AI client (masarx-shared) which routes through the Supabase Edge Function.",
            },
          ],
        },
      ],
    },
  },
];