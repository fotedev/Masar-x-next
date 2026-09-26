# Project invariants (the rules you cannot break)

| # | Rule | Why |
|---|---|---|
| I1 | Service-role and AI provider keys stay **server-side only** | RLS depends on it; CI runs `ai-endpoint-grep` + gitleaks on built artifacts |
| I2 | TypeScript end-to-end: `Database` types + Zod schemas in `packages/shared` | One source of truth across web/desktop/mobile |
| I3 | i18n for **every** user-facing string. No hardcoded Arabic in components | 46 namespaces in `packages/shared/src/messages/{ar,en}/` |
| I4 | All OAuth callbacks live under `[locale]/auth/callback/` | See [01-gotchas.md](./01-gotchas.md) §3 |
| I5 | `pnpm.neverBuiltDependencies` lives in root `package.json` under `"pnpm"` | See [01-gotchas.md](./01-gotchas.md) §8 |
| I6 | Electron version pinned exact (no `^`/`~`) in `apps/desktop/package.json` | See [01-gotchas.md](./01-gotchas.md) §11 |
| I7 | `ThemeScript.tsx` uses native `<script>` + `suppressHydrationWarning` | See [01-gotchas.md](./01-gotchas.md) §19 |
| I8 | Never destructive git ops (`stash drop`, `reset --hard`, `checkout --`, `clean -fd`) on a dirty tree without explicit user consent | See [01-gotchas.md](./01-gotchas.md) §20 |
| I9 | **No direct file deletion.** Agents never run `rm`/`git rm`/`del` on project files. To retire a dead or obsolete file: ask the user explicitly first, and on approval **move it to `.trash/`** (mirroring its original path; `.trash/` is gitignored) instead of deleting | Deletion from the working tree is irreversible; the user audits every removal and keeps a local archive |
| I10 | **Pasted model output is welcome — Validate & Adapt.** Raw copy-pasted text from other AI models is accepted as normal input (this is the user's primary phone-first workflow), but the agent must run full engineering validation before executing: match every snippet and claim against the actual repo state and real installed library versions, fix errors and hallucinations, adapt paths/names/APIs to project conventions — never blind application, never absolute rejection | Pasted model answers routinely reference files/APIs/states that don't exist here; validating and adapting before executing is what prevents AI-spaghetti accumulation |
| I11 | **Spec-first workflow.** No writing or modifying code for any task beyond trivial, direct fixes without a technical spec prepared and **approved by the user** first | Prevents unplanned dives into large/complex files and unreviewed architectural drift; see [10-spec-first.md](./10-spec-first.md) |
| I12 | **MVP Lock** — no trivial/cosmetic/refactor work until MVP launch | Owner directive 2026-09-14; school year starts within days; see [09-mvp-lock.md](./09-mvp-lock.md) |
| I13 | **Brand identity is frozen in `docs/BRANDING.md`.** Never describe the platform as a summaries-only platform ("منصة ملخصات" / "Study Summaries Platform"). Use the unified definition verbatim: AR "مسار إكس — منصتك الجامعية المتكاملة: مواد، شروحات، ملخصات، بنوك أسئلة، ومساعد ذكي" / EN "Masar X — Integrated University Learning Platform: study materials, lectures, summaries, quizzes & AI tutor". Feature order is always: materials → lectures → quizzes → courses → summaries (one part) → AI | Prevents identity drift back to "summaries platform" in metadata, footers, FAQ, llms.txt and AI answers |
| I14 | **Branch isolation & multi-agent safety.** Never treat the current branch's scope or its pending specs/tasks as your task — start every non-trivial task on a dedicated branch (via a git worktree when the shared tree is dirty or another session is committing), re-assert the branch inside the same command as every commit, and stage explicit paths only (never `git add .` / `git commit -a`) | Parallel sessions share this working copy and switch branches mid-task; scope adoption and blanket commands have landed commits on foreign branches and swept foreign hunks — see [11-git-standards.md](./11-git-standards.md) §Branch Isolation |

**Back to:** [AGENTS.md](../../../AGENTS.md)
