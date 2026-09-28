# Implementation Plan: Consolidate Cross-Surface Abstractions (Spec 015)

**Branch**: `015-consolidate-shared-abstractions` | **Date**: 2026-09-28 | **Spec**: [./spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-consolidate-shared-abstractions/spec.md`

## Summary

Promote three classes of duplicated TypeScript code into `packages/shared` so the web, desktop, and mobile apps share a single source of truth:

1. The `MasarxDesktopBridge` IPC type (currently declared twice — once as `export type MasarxDesktopApi = typeof api` in `apps/desktop/src/main/preload.ts:94` that's never imported, and once redeclared as `MasarxDesktopBridge` in `apps/web/src/lib/desktop/runtime.ts:23-94`). After: the `api` literal lives in `packages/shared/src/types/desktop-bridge.ts` and both preload and the web runtime import it.

2. The Smart Paste Canvas helper (duplicated between `apps/web/src/lib/ai/pasted-attachments.ts` and `apps/mobile/src/lib/paste-attachments.ts`, ~186 LOC combined). After: one merged module in `packages/shared/src/ai/paste-attachments.ts` (~110 LOC) with the byte-vs-char size formatting reconciled via runtime `TextEncoder` detection.

3. The 20 unused `Validated*` and `Waitlist*` exports in `packages/shared/src/types/schemas/` (generated for spec 018 and never wired). After: deleted.

Strictly internal refactor — no behaviour change, no user-visible change, no IPC wire-format change, no storage change.

## Technical Context

**Language/Version**: TypeScript 5.9.x (already current across web/shared; will be normalised across desktop/mobile as part of the broader audit follow-up, but **not** in scope of this spec — see `research.md` Decision 1).

**Primary Dependencies**: No new dependencies. Existing toolchain only:
- `vitest` (already in `apps/web/`, will be added to `packages/shared/` via the existing config style — `research.md` Decision 3)
- `crypto.randomUUID()` on web; RN-compatible UUID fallback on mobile (already used in both source files today)

**Storage**: N/A — this refactor does not touch persistent storage.

**Target Platform**: Three targets simultaneously:
- Web: Next.js 16.3.6 / React 19.2.4 (existing — no change)
- Desktop: Electron (existing — no change)
- Mobile: Expo 51 / React Native 0.74.5 (existing — no change)

The single shared module must be bundler-portable across all three (Turbopack for web, Metro for mobile, ESBuild for desktop). No platform-specific imports inside `packages/shared/src/ai/paste-attachments.ts`.

**Project Type**: Monorepo refactor. This is **not** a new feature; it's a code-organisation improvement to an existing monorepo.

**Performance Goals**: No performance target — refactor is byte-equivalent at the wire. Indirect benefits:
- Slightly faster dev rebuilds in `apps/web` and `apps/mobile` (~5%) because the duplicated files are gone (one less module per HMR pass)
- Slightly smaller web bundle if `extractInserted` is correctly tree-shaken (negligible, single function ~30 LOC)

**Constraints**:
- **MVP Lock active (I12)** — refactor work is normally blocked under the lock; this spec is being planned so it can execute the moment the lock lifts. No implementation will proceed without an explicit owner decision.
- **Branch isolation (I14)** — implementation must happen on the existing `015-consolidate-shared-abstractions` branch, never on `main`.
- **No destructive git ops (I8/I9)** — no `git reset --hard`, no `rm` of files; use `.trash/` if deletion is needed.
- **Web/desktop ownership boundary** — web owns `apps/web/**` + `packages/shared/**`, desktop owns `apps/desktop/**`. The single desktop-side change requires desktop-agent review per the IPC-contract handshake rule.

**Scale/Scope**: 
- ~165 LOC removed from web/mobile consumers
- ~195 LOC added to `packages/shared/` (consolidated, with JSDoc)
- ~120 LOC removed from `packages/shared/src/types/schemas/` (dead exports)
- Net repo growth: +~75 LOC of *better-organised* code
- One new file: `packages/shared/vitest.config.ts` (~10 LOC)
- Two new test files: `packages/shared/src/types/desktop-bridge.test.ts` + `packages/shared/src/ai/paste-attachments.test.ts` (~80 LOC combined)
- 6 commits (one per Quickstart step) over an estimated 1-hour dev session

## Constitution Check

*This project's `.specify/memory/constitution.md` is currently the **template** (50 lines, no ratified principles). The plan therefore derives gates from the documented invariants in `AGENTS.md` ("Hard rules" section) and the project references (`docs/agents/references/03-invariants.md`, `09-mvp-lock.md`, `11-git-standards.md`).*

| Invariant | Status | Justification |
|---|---|---|
| **I1** — Service-role/AI keys server-side only | ✅ No change | Refactor does not touch env vars, secrets, or server routes |
| **I2** — DB types + Zod in `packages/shared` | ✅ **Strengthens** | This spec moves MORE types to `packages/shared`; consolidation *into* the I2-protected zone |
| **I3** — i18n for every user-facing string | ✅ No change | No user-facing strings touched (constants are numeric thresholds) |
| **I4** — OAuth callbacks under `[locale]/auth/callback/` | ✅ No change | Auth surface untouched (only the bridge *type* moves) |
| **I5** — `pnpm.neverBuiltDependencies` in root `package.json` | ✅ No change | No native deps added |
| **I6** — Electron version pinned exact | ✅ No change | Electron version unchanged |
| **I7** — `ThemeScript.tsx` native `<script>` + `suppressHydrationWarning` | ✅ No change | No theme/hydration work |
| **I8** — No destructive git ops on dirty tree | ✅ Compliant | This plan creates new files + reimports; no destructive ops on existing files. No `git reset --hard`, no `rm`. |
| **I9** — No direct file deletion | ⚠️ **Needs care** | The 20 dead-export deletions touch files that already exist. Per I9, the implementation must use `move-to-.trash/` for any file deletions. The deletion of unused *exports* (not whole files) is acceptable — they're inside existing files. |
| **I10** — Pasted model output: Validate & Adapt | ✅ Applied | All AI-generated code in this plan is constrained to existing audit evidence; no fabricated outputs |
| **I11** — Spec-first: non-trivial work needs an approved spec | ✅ **This spec is the proof** | The spec exists, validated, on its own branch |
| **I12** — MVP Lock active | 🚧 **Blocks implementation, not planning** | This refactor is normally blocked under MVP Lock (cosmetic/internal work). Planning is permitted. Implementation requires owner sign-off via the MVP Lock lift process before merging to `main`. The spec and plan are landed on the feature branch but the PR is held. |
| **I13** — Brand frozen | ✅ No change | No brand work |
| **I14** — Branch isolation & file locking | ✅ Compliant | Implementation on `015-consolidate-shared-abstractions` only; web agent claims the task in `.agents/015.md` before editing; stages explicit paths only (no `git add .`) |

**Gate result**: All 14 invariants satisfied or documented as blocked-on-decision. **No violations require justification**. The MVP Lock (I12) is the only gating issue and is documented in `research.md` Decision 5 plus the AGENTS.md "Active specs" table.

## Project Structure

### Documentation (this feature)

```text
specs/015-consolidate-shared-abstractions/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── desktop-bridge.md
│   └── paste-attachments.md
├── checklists/
│   └── requirements.md  # Quality validation (from /speckit.specify)
├── spec.md              # Original spec (from /speckit.specify)
└── tasks.md             # NOT created by /speckit.plan — created by /speckit.tasks
```

### Source Code (repository root) — diff view, not new structure

```text
# No new top-level directories. The change is internal reorganisation:
packages/shared/
├── src/
│   ├── ai/
│   │   └── paste-attachments.ts       # NEW — merged from web/mobile
│   ├── types/
│   │   ├── desktop-bridge.ts          # NEW — promoted from preload
│   │   ├── schemas/                   # EXISTING — 20 unused exports removed
│   │   └── database.ts                # EXISTING — no change
│   └── ...                            # EXISTING — untouched
├── vitest.config.ts                   # NEW (mirrors apps/web/vitest.config.ts)
└── package.json                       # EXISTING — exports map may need 2 new entries

apps/web/src/
├── components/ai/ChatInput.tsx        # EXISTING — import path updated
├── components/ai/ChatMessageItem.tsx  # EXISTING — import path updated
└── lib/
    ├── ai/pasted-attachments.ts       # TRIMMED to re-export or deleted
    └── desktop/runtime.ts             # TRIMMED to ≤10 LOC

apps/mobile/src/
├── screens/AIAssistantScreen.tsx      # EXISTING — import path updated
└── lib/paste-attachments.ts           # TRIMMED to re-export or deleted

apps/desktop/src/main/
└── preload.ts                         # EXISTING — inline api literal replaced with import
```

**Structure Decision**: **No structure change**. The repo layout stays the same; this is purely a file-content refactor that promotes duplicated code into existing shared directories.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. The MVP Lock (I12) is documented in the Constitution Check table but is not a "violation that must be justified" — it's an existing project constraint that this plan respects by holding implementation until lift.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| (none) | — | — |

---

## Re-evaluation: Constitution Check post-Phase-1

After designing the data model and contracts, the invariant check still passes:

- **I2 (DB types + Zod in `packages/shared`)** — **strengthened** by this plan. The new `desktop-bridge.ts` lives in `packages/shared/src/types/` (the exact I2 directory). The new `paste-attachments.ts` lives in `packages/shared/src/ai/` and uses Zod-style discriminated unions internally. ✅
- **I14 (branch isolation)** — confirmed. All edits happen on `015-consolidate-shared-abstractions`. The web agent files the `.agents/015.md` claim file before starting; the desktop agent files its own claim when picking up the IPC handshake change. ✅
- **I9 (no direct file deletion)** — confirmed approach: dead *exports* removed via `patch`, dead *files* (the now-empty web/mobile paste-attachments files) moved to `.trash/` rather than `rm`. ✅

No new gate failures introduced by the design.

---

## What this plan produces

After execution (post MVP Lock lift):

| Artifact | Status |
|---|---|
| `packages/shared/src/types/desktop-bridge.ts` | NEW — ~85 LOC |
| `packages/shared/src/ai/paste-attachments.ts` | NEW — ~110 LOC |
| `packages/shared/src/types/desktop-bridge.test.ts` | NEW — ~25 LOC, 1 snapshot test |
| `packages/shared/src/ai/paste-attachments.test.ts` | NEW — ~55 LOC, 6 helper test suites (~25 tests) |
| `packages/shared/vitest.config.ts` | NEW — ~10 LOC |
| `apps/desktop/src/main/preload.ts` | MODIFIED — `api` literal replaced with import |
| `apps/web/src/lib/desktop/runtime.ts` | MODIFIED — bridge redeclaration replaced with re-export |
| `apps/web/src/lib/ai/pasted-attachments.ts` | TRIMMED or DELETED |
| `apps/mobile/src/lib/paste-attachments.ts` | TRIMMED or DELETED |
| `packages/shared/src/types/schemas/index.ts` | MODIFIED — 20 dead exports removed |
| `packages/shared/src/types/database.ts` | MODIFIED — if any dead exports live here |
| `packages/shared/package.json` | MODIFIED — `exports` map gets `./ai/paste-attachments` and `./types/desktop-bridge` if not already wildcarded |

6 commits. 1 PR. 2 review agents (web primary, desktop IPC handshake review).

---

## What this plan does NOT do

- No dependency upgrades (Tailwind 4, Vitest 2→4, Expo 51→53, etc. are in the audit but **out of scope** for this spec)
- No `--webpack` removal from web dev script (out of scope)
- No Zod-consolidation of hand-written `isFoo` guards (a separate spec)
- No TypeScript normalisation across desktop/mobile (a separate spec)
- No new test infrastructure beyond `packages/shared/vitest.config.ts`
- No production deployment changes — branch stays local until MVP Lock lifts and PR is merged