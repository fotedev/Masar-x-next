# Specification Quality Checklist: 026-tailwind-v4-upgrade

**Validation pass**: 2026-09-29 — 1 pass, all items pass (≤3 iterations rule satisfied)

## Content completeness

- [x] All mandatory template sections present (User Scenarios & Testing, Requirements, Success Criteria, Assumptions)
- [x] Every user story is independently testable with explicit gate commands (`pnpm --filter web …`)
- [x] Breaking-change inventory includes measured baseline counts from `apps/web/src` (not estimates)
- [x] Token inventory enumerated from the actual `tailwind.config.js`, not from memory
- [x] Edge cases cover cascade precedence, pre-paint dark mode (I7), webpack mode, standalone output, RTL/bidi, codemod clean-tree constraint, and the ratified hover-device limitation
- [x] Governance recorded: MVP Lock lift (owner decision 2026-09-29) in the Type line; I9/I10/I11/I13/I14 handling explicit
- [x] Numbering derivation documented (026 from disk per 10-spec-first; script under-derivation trap noted in Assumptions)

## Requirement quality

- [x] All FRs are MUST-statements, individually verifiable, and scope-isolated to apps/web
- [x] Zero `[NEEDS CLARIFICATION]` markers (0 ≤ max 3); open strategy decisions (bare-border strategy, codemod-vs-manual) are explicitly deferred to the plan phase with a documented decision gate — they do not block spec approval
- [x] Success criteria are measurable via commands or observable checks (SC-001…SC-006)

## Consistency

- [x] Story priorities form viable incremental slices: engine swap with `@config` bridge + compat layer → theme port to `@theme` → rename sweep (removes compat layer) → regression gates
- [x] No conflict with invariants I1–I14 (checked: I3, I7, I9, I10, I11, I12, I13, I14)
- [x] Out-of-scope items stated: sandbox/fcai-anu-guide, other workspaces, unrelated dirty working-tree files
