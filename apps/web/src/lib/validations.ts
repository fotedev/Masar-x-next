/**
 * Backward-compat re-export of the cross-platform Zod schemas.
 *
 * In Spec 004 Phase 2 (T011), the canonical home of these schemas
 * moved to `packages/shared/src/types/schemas/`. This file remains so
 * existing app imports of `@/lib/validations` keep working.
 *
 * New code SHOULD import from `@masarx-shared/types/schemas` directly.
 */
export * from "masarx-shared/types/schemas";
