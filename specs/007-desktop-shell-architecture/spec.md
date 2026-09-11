# Spec 007 — Desktop Shell Architecture: Reconciliation & Remaining Work

**Status:** Approved (2026-09-10)
**Source:** `sandbox/brainstorm-chat-v1.txt` — the 2026-09-10 orchestration session in which the
Hermes agent completed spec 005 US3 (T040–T046), survived a layout collapse, and the session
converged on the Dual-Shell Separation architecture. This spec reconciles that transcript
against the repository and records what is still open.
**Related:** `specs/005-desktop-study-workspace/` (the feature this session executed),
`docs/audits/desktop-app-report-2026-09-08/` (gitignored pre-US3 desktop audit)

> Status markers: ✅ DONE (verified in repo) · 🔨 open task (see tasks.md) ·
> ⚠️ CORRECTED (transcript claim vs. reality) · ❌ REJECTED (decision record)

---

## 1. What the session accomplished — ✅ verified in repo

| Transcript claim | Repo evidence (verified 2026-09-10) |
|---|---|
| US3 T040–T043: frameless shell, window IPC, preload `window:` namespace, 9 tests | Commits `04053f1`, tests in `apps/desktop/src/main/__tests__/main.test.ts`; tasks.md T040–T043 all `[x]` |
| US3 T044–T046: CustomTitlebar mount + visual gate (CDP DOM + pixel scan + win32 screenshot, 6 criteria) | `apps/web/src/components/desktop/CustomTitlebar.tsx`; T044–T046 `[x]` |
| Column contrast bump (`bg-muted/50`, `border-border/80`) after the "flat navy" caveat | Commit `9722e42`; `StudyWorkspace.tsx` lines 137/174 carry exactly those classes |
| **Dual-Shell Conditional Rendering** (the session's final architectural directive: branch in `Layout.tsx`, never morph web chrome with global CSS) | **Implemented** — `apps/web/src/components/Layout.tsx:60-112`: `isDesktop ? (flex h-screen w-screen overflow-hidden shell) : (Header + max-w container + Footer + PWA prompt)`. Evolved beyond the transcript's reference snippet: shell composition lives in `DesktopShell.tsx` (CustomTitlebar + RTL-aware `DesktopSidebar.tsx`, commit `84ca992`) |
| US2 shell CSS scoped under `[data-masarx-desktop="true"]` | `apps/web/src/styles/desktop-shell.css`, imported from root `app/layout.tsx:4`; marker set by `DesktopShellGate.tsx` (also suppresses platform context menu) |
| US1 workspace components | All six exist in `apps/web/src/components/desktop/workspace/` (commit `2152fbc`); T046's CDP evidence measured the 3 columns live (288/575/384 px at y=32) |

## 2. Corrected records ⚠️

- **"US4 (Assistant & Document Sync)"** — the transcript's final elicitation invents this label.
  Spec 005's US4 is **dev-environment & cache safeguards** (T030–T034). The assistant panel is
  part of US1 (T014). Do not create an "Assistant & Document Sync" story from that text.
- **Agent's "US1 (i18n)" numbering drift** — during the session the agent referred to its i18n
  migration as "US1", which is spec 005's *workspace* story. Story IDs in commit chatter are
  unreliable; the tasks.md ledger is authoritative.
- **`specs/005/handoff.md` is stale** — it still lists US3 T040–T043 as "Not Started" (it is the
  handoff *into* that session, never updated after). Banner added 2026-09-10; treat tasks.md as truth.
- **Spec 005 ledger drift** — US1/US2 build tasks were committed (2152fbc/84ca992) but their
  checkboxes were never flipped (the agent deliberately deferred "Commit 2" and the marking
  died there). Backfilled 2026-09-10 with evidence notes; the *verification-gate* tasks
  (T016/T025) remain open — see §4.
- **`.z-header { display: none !important }` in desktop-shell.css** — not the "CSS hack" the
  directive banned: `Layout.tsx` never renders `<Header>` in the desktop branch, but during the
  hydration window the *browser* branch (with Header) paints first inside Electron. The rule +
  marker attribute suppress that one-frame flash after mount. Keep unless a flash-free
  replacement is proven (task T-07).

## 3. Architecture Decision Records

**ADR-1 — Dual-Shell Conditional Rendering (accepted).** Next.js renders both shells; the root
`Layout.tsx` branches on `useIsDesktopRuntime()`. Desktop shell = `CustomTitlebar (32px) +
flex-1 workspace`, zero marketing chrome. Browser shell = existing Header/Footer layout,
byte-for-byte unchanged (FR-011). **Ban:** mutating root-element layout via global CSS
(`body > *`, `#__next`, root `!important` height rules) — that class of override caused both
the 800px titlebar stretch and the black-screen collapse.

**ADR-2 — Monorepo stays intact (❌ REJECTED: splitting).** Asked outright in the session:
"Do you mean to separate every app in a separate folder?" Answer: no. pnpm monorepo with
`apps/web + apps/desktop + packages/shared` is the standard (Slack/Linear/Notion-class);
separation means *layout-level* separation inside `apps/web`, not repo or package splitting.
Electron stays a thin OS shell; all React code stays in `apps/web`.

**ADR-3 — Feedback loop (process).** Desktop UI iteration must not go through
`electron-builder --dir` per change (45–90 s + Windows file locks). Fast loop: dev server +
HMR with the desktop marker forced, full packaging only for gates. Recorded for agents in §5.

## 4. Post-mortem: the two failure modes (reference — do not re-derive)

1. **800px titlebar.** A `html[data-masarx-desktop] body > * { height: 100% }` rule
   (specificity 0,1,2) beat the Tailwind `h-[var(--masarx-titlebar-h,32px)]` class (0,1,0);
   App Router renders React directly into `<body>` (no `#__next`), so the fixed `<header>`
   *was* a direct child and got stretched. Guard now lives in desktop-shell.css
   (`.masarx-titlebar { height: 32px !important; flex: 0 0 32px }`) with a comment.
2. **Black-screen collapse + nav-rail collision.** Attempting to morph the responsive web
   layout (marketing header → collapsed vertical rail) inside the window via CSS overrides
   collapsed the flex chain (`h-0` ancestors, centered titlebar). Root cause: wrong
   architecture (ADR-1 is the fix), compounded by testing on `/ar` (home) instead of the
   target workspace route. Verification scripts (CDP DOM probes, win32 HWND enumeration,
   pixel scans) from the session remain the pattern for GATE-VISUAL evidence.

## 5. Agent-orchestration playbook (distilled from the session)

For any future agent-driven desktop work in this repo:

- **Lock the route**: verification happens on `/[locale]/subjects/[subject]`, never the home page.
- **Constraint-driven prompting**: ban global root-CSS mutations up front; give selectors and
  components, max ~3 lines per feedback item; no architecture essays mid-loop.
- **Windows hygiene**: kill `Masar X.exe` / `electron.exe` zombie processes before builds
  (locked binaries → silent stale-pack failures that corrupt the agent's feedback loop).
- **Recognize the goal-loop**: repetitive reports with accurate diffs are context compaction +
  goal-seeking, not hallucination. Exit command: "stage X, commit with message Y, `git status`,
  report done and stop."
- **Evidence over claims**: GATE-VISUAL (FR-027) — a passing typecheck is not evidence; demand
  DOM/screenshot proof of the changed surface.

## 6. Open work → [tasks.md](./tasks.md)

Consolidated verification pass (T016/T025/T052/T053 of spec 005), spec 005 Phase 4
(dev-env safeguards T030–T034) and Phase 6 polish, headless visual-regression coverage,
the HMR-first dev loop documentation, and the pre-existing desktop debt from the 2026-09-08
audit (Electron 32 EOL, dead auth/cache subsystems) to be re-audited after Phase 6.
