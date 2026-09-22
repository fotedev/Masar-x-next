# Spec-First development standard

Invariant I11 in practice: no agent starts writing or modifying code for any task beyond trivial, direct fixes without a **technical spec prepared and approved by the user first**.

## When a formal spec is required (triggers)

- Refactoring or splitting any file over ~300 lines (current examples: `apps/web/src/app/[locale]/add-summary/page.tsx` at 945 lines, `apps/web/src/app/[locale]/profile/page.tsx` at 813).
- Any change to API contracts, database schemas/migrations, or auth flows.
- Cross-cutting architectural changes: caching, state management, runtime/environment upgrades (e.g. a major Electron version bump).
- New features spanning more than one component or route.

## Spec anatomy

Specs live in `specs/NNN_name/`. Numbering is **dynamic auto-increment, derived from disk only**: inspect the `specs/` directory, take the highest existing `NNN` prefix, and generate the next number as `max + 1`, zero-padded to three digits (`String(max + 1).padStart(3, "0")`). Never assume, pin, or recall a spec number from memory or prior instructions — the disk is the single source of truth (same convention as `NNN_` migrations, see [07-quirks.md](./07-quirks.md)). Follow the established SpecKit layout of the existing spec directories (`spec.md`, `tasks.md`, `checklists/`). A spec must cover:

1. **Context & problem statement** — what is wrong today and why change it.
2. **Architecture & design** — components created/modified, each with a single responsibility; data flow; contracts (types / interfaces / Zod schemas).
3. **Behavior preservation & regression strategy** — how existing behavior stays intact, and how that is proven.
4. **Test specification** — unit/integration scenarios to be written to verify the change.
5. **Atomic execution plan** — sequence of independent commits, with the [08-precommit.md](./08-precommit.md) verification gates for each.

The user approves the spec before implementation begins.

## Lightweight path (no separate spec)

- Routine i18n extraction batches, typo fixes, and simple lint fixes do **not** need a separate spec.
- They still require a short **inline plan** (e.g. a plan-mode plan) presented to and approved by the user immediately before execution.

**Back to:** [AGENTS.md](../../../AGENTS.md)
