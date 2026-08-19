/**
 * Masar X shared package — root entry.
 *
 * Surfaces the cross-platform contracts defined in
 * `specs/004-multi-platform-expansion/contracts/`:
 *   - messages  → next-intl on web, expo-localization on mobile
 *   - supabase  → createSupabaseClient factory (single chokepoint)
 *   - types     → database types + Zod schemas
 *   - ai        → sendAiMessage / streamAiMessage (Edge-Function only)
 *
 * Apps MUST NOT import from the underlying packages directly
 * (e.g. @supabase/ssr, openai, @anthropic-ai/sdk). The ESLint
 * `no-restricted-imports` rule in apps/{web,desktop,mobile}/eslint.config.*
 * enforces this at error severity.
 */

export * from "./supabase/index";
export * from "./ai/index";
// `types` is intentionally NOT re-exported as `*` here — it has its own
// `index.ts` that consumers import via the `@masarx-shared/types` path so
// that the contract for what's exposed (Database row types vs. Zod schemas
// vs. helpers) stays explicit and reviewable.
