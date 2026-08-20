import nextPlugin from "@next/eslint-plugin-next";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".next/**",
      "dist/**",
      "build/**",
      "out/**",
      "node_modules/**",
      "supabase/**",
      "sandbox/**",
      "backup/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "@next/next": nextPlugin,
      "react-hooks": reactHooksPlugin,
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      ...(nextPlugin.configs["core-web-vitals"]?.rules ?? {}),
      ...(reactHooksPlugin.configs?.recommended?.rules ?? {}),
      ...(tseslint.configs?.recommended?.rules ?? {}),

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "warn",
      "prefer-const": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": "warn",

      // T013 (Spec 004, Phase 2). The AI provider key MUST stay
      // server-side (contracts/ai-boundary.md). Direct SDK imports of
      // `openai` or `@anthropic-ai/sdk` are forbidden in any client
      // context — web, desktop renderer, mobile runtime. The AI client
      // in `packages/shared/src/ai/index.ts` is the only consumer; it
      // routes through the Supabase Edge Function, never the provider
      // directly. `supabase/functions/**` (the Edge Function itself) is
      // exempted via the top-level `ignores` block above. Severity is
      // `error` so a slip becomes a build break, not a warning.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "openai",
              message:
                "Direct import of `openai` is forbidden in client contexts. " +
                "Use the shared AI client (`packages/shared/src/ai/`) which " +
                "routes through the Supabase Edge Function. See " +
                "specs/004-multi-platform-expansion/contracts/ai-boundary.md.",
            },
            {
              name: "@anthropic-ai/sdk",
              message:
                "Direct import of `@anthropic-ai/sdk` is forbidden in client " +
                "contexts. Use the shared AI client (`packages/shared/src/ai/`) " +
                "which routes through the Supabase Edge Function. See " +
                "specs/004-multi-platform-expansion/contracts/ai-boundary.md.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/lib/logger.ts"],
    rules: {
      "no-console": "off",
    },
  },
];
