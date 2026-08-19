/**
 * Backward-compat re-export of the cross-platform database types.
 *
 * In Spec 004 Phase 2 (T011), the canonical home of these types
 * moved to `packages/shared/src/types/database.ts`. This file remains
 * so existing app imports of `@/types/database` keep working.
 *
 * New code SHOULD import from `@masarx-shared/types` directly.
 */
export * from "masarx-shared/types";
