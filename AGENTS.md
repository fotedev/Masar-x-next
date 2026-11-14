# Masar X — Agent Guide

> **TL;DR.** Full-stack Next.js 16 + React 19 monorepo (`apps/web`, `apps/desktop`, `apps/mobile`, `packages/shared`). Supabase backend. Bilingual ar/en via `next-intl`. This file is the **index only** — details live in [`docs/agents/references/`](./docs/agents/references/README.md).

**Absolute paths** (verified 2026-11-07):
- Repo: `C:/programming/WEB_Development/projects/masarx_next/`
- Web app: `apps/web/`
- Shared types/i18n/AI: `packages/shared/`
- Supabase: `supabase/` (migrations, edge functions)
- Specs: `specs/` (next spec number always derived from disk — [10-spec-first.md](./docs/agents/references/10-spec-first.md))
- Agent skills: `.agents/skills/`
- References index: [`docs/agents/references/`](./docs/agents/references/README.md)

---

## Hard rules (one line each — full table in [03-invariants.md](./docs/agents/references/03-invariants.md))

- I1 Service-role/AI keys server-side only · I2 `Database` types + Zod in `packages/shared` · I3 i18n for every user-facing string · I4 OAuth callbacks under `[locale]/auth/callback/` · I5 `pnpm.neverBuiltDependencies` in root `package.json` · I6 Electron version pinned exact · I7 `ThemeScript.tsx` native `<script>` + `suppressHydrationWarning` · I8 no destructive git ops on a dirty tree without consent · I9 no direct file deletion — move to `.trash/` on approval · I10 pasted model output: Validate & Adapt · **I11 spec-first: non-trivial work needs an approved spec** ([10-spec-first.md](./docs/agents/references/10-spec-first.md)) · **I12 MVP Lock RETIRED — lifted permanently by owner decision 2026-11-02** (09-mvp-lock.md deleted per its own "delete on lift" note) · **I13 brand frozen in `docs/BRANDING.md`** — never "summaries platform" · **I14 agent isolation (revised 2026-11-04, owner decision)** — one agent session = one branch = one worktree: git itself forbids checking the same branch out twice, so the `.agents/<task>.md` claim-file ceremony stays RETIRED. The primary checkout belongs to the owner — agents never write in it. Worktrees live **outside the repo** at the tool-neutral path `../masarx-wt/<branch-slug>` (e.g. `git worktree add ../masarx-wt/feat-033 -b feat/033-materials-port origin/main`) — never inside the repo, never in tool-specific folders (`.kilo/`, `.cline/`, `.cursor/`, `.zcode/`, …). Pin the path on every interaction — shell commands via `git -C <path>` or `cd <path> && …`; file tools (Read/Edit/Write/Grep) via absolute worktree paths (`C:/…/masarx-wt/<slug>/…`), never repo-relative paths — the shell CWD may reset to the primary between commands (hit 2026-11-04). After merge: `git worktree remove <path> && git worktree prune`. Owner-directed maintenance/docs go through the normal PR flow (`main` is protected — direct pushes are rejected); never force-push or rewrite history (I16) ([11-git-standards.md](./docs/agents/references/11-git-standards.md) §Agent Isolation) · **I15 identity lock** — never set or override git identity at command time (no `git -c user.*=…`, no `--author`, no `GIT_AUTHOR_*`/`GIT_COMMITTER_*` env) and never bypass hooks (`--no-verify`, `-c core.hooksPath=`); identity comes from machine git config only — if `git var GIT_AUTHOR_IDENT` does not resolve to the owner's email, stop and ask. Enforced by `C:/Users/FOTE/.githooks/pre-commit` + `commit-msg` — hooks live **outside** the repo; repo-local `core.hooksPath` points to the absolute path (covers any checkout of this repo) ([11-git-standards.md](./docs/agents/references/11-git-standards.md) §Git Identity Lock) · **I16 escalation lock** — never modify repo rulesets, never force-push to any protected branch, and never rewrite pushed history — unless the owner's explicit written confirmation appears in the same conversation message requesting that exact action; a plan alone, silence, or a defaulted question does not count as confirmation ([11-git-standards.md](./docs/agents/references/11-git-standards.md) §Escalation Lock).

---

## References

| Doc | Covers |
|---|---|
| [README.md](./docs/agents/references/README.md) | Task → doc routing table (start here) |
| [00-setup.md](./docs/agents/references/00-setup.md) | Setup essentials + verify commands |
| [01-gotchas.md](./docs/agents/references/01-gotchas.md) | 20 gotchas (Trigger/Why/Fix/Symptom) |
| [02-release-pipeline.md](./docs/agents/references/02-release-pipeline.md) | Release pipeline, secrets model, CI summary |
| [03-invariants.md](./docs/agents/references/03-invariants.md) | Full 16-rule invariants table |
| [04-architecture.md](./docs/agents/references/04-architecture.md) | Architecture (30-second version) |
| [05-repo-layout.md](./docs/agents/references/05-repo-layout.md) | Repository layout |
| [06-mcp-cli.md](./docs/agents/references/06-mcp-cli.md) | MCP and CLI quick map |
| [07-quirks.md](./docs/agents/references/07-quirks.md) | Project-specific quirks |
| [08-precommit.md](./docs/agents/references/08-precommit.md) | Pre-commit / pre-merge checklist |
| [10-spec-first.md](./docs/agents/references/10-spec-first.md) | Spec-First standard, spec anatomy |
| [11-git-standards.md](./docs/agents/references/11-git-standards.md) | Conventional Commits, PR rules, branch isolation & multi-agent safety (I14), git identity lock (I15), escalation lock (I16) |

---

## Active specs (planning)

| Spec | Plan | Status |
|---|---|---|
| [015-consolidate-shared-abstractions](./specs/015-consolidate-shared-abstractions/spec.md) | [plan.md](./specs/015-consolidate-shared-abstractions/plan.md) | **Closed — landed on main** (TRW decoupling PR #52 `de0b7a7`; `24d773a` (pre-rewrite `7fb17f4`)/`956e366` (pre-rewrite `3578828`)/`6c6e2a1` (pre-rewrite `27efc7c`) bridge, paste-helpers, schema deletions; all 41 tasks complete `a6eb689` (pre-rewrite `c5faa3b`)) — row corrected 2026-09-30 (was stale "Ready for `/speckit.tasks`"); SHAs refreshed 2026-10-03 after the identity history rewrite |
| [026-tailwind-v4-upgrade](./specs/026-tailwind-v4-upgrade/spec.md) | [plan.md](./specs/026-tailwind-v4-upgrade/plan.md) | **Merged (squash `a949ec9`, pre-rewrite `708477f`, PR #65)** — Tailwind 4.3.3, CSS −37%, visual QA green; MVP Lock explicitly lifted for this track (owner, 2026-09-29) |
| [028-desktop-crashpad-logs](./specs/028-desktop-crashpad-logs/spec.md) | — | **Merged (squash `94faaaa`, pre-rewrite `1b45490`, PR #98)** — desktop Crashpad dumps (local-only, owner decision) + electron-log file logging; audit R7 closed locally, remote submission stays an owner decision |
| [030-quiz-server-grading](./specs/030-quiz-server-grading/spec.md) | — | **Merged (squash `ff83e66`, PR #161, 2026-10-27)** — server-authoritative quiz grading: `finish_quiz_attempt` RPC re-grades server-side + quiz_attempts score-guard trigger (audit C4); number 030 chosen deliberately (029 is claimed by open PR #153's spec/029-proof-layer) |
| [033-materials-port](./specs/033-materials-port/spec.md) | — | **Merged (squash `8ac4eb0`, pre-purge `bf009d9d`, PR #179, 2026-11-05)** — `/materials` static-manifest library + Y2-S1 subjects seed; its real-exam seed SQL was withdrawn from the repository (spec 043, 2026-11-11 — production quiz data unchanged); owner answered 4 port gates 2026-11-04; MVP Lock proceeds under owner's explicit direction (026 pattern) |
| [034-subjects-schedules](./specs/034-subjects-schedules/spec.md) | — | **Merged (squash `13a26958`, pre-purge `8188342c`, PR #180, 2026-11-05)** — demo subjects FOTE/test removed from prod (`20261104001345`), /subjects level tabs (`allLevels` opt-in in useSubjects), /schedules weekly cohort timetables (static gviz-extracted JSON, الفرقة 1–4); owner's newer "طبعة (نهائي)" الشعبة-tab sheet still owed for the data swap |
| [035-quiz-content-fixes](./specs/035-quiz-content-fixes/spec.md) | — | **Merged (squash `dbc7c84`, pre-purge `c130352b`, PR #185, 2026-11-06)** — pre-wrap for C++ shape options, pending badge, 11 OOP quizzes published via approval gate, junk quiz deleted |
| [036-wave1c-chat-interaction-perf](./specs/036-wave1c-chat-interaction-perf/spec.md) | — | **Merged (squash `8b5f6f7`, pre-purge `f6a59b3`, PR #186, 2026-11-06)** — chat interaction perf (messagesRef, streaming highlight, IO-gated avatars) + quizzes memoization; edge functions remain owner-owned |
| [037-sync-hardening](./specs/037-sync-hardening/spec.md) | — | **Merged (squash `9d63b3e`, pre-purge `aeeabb3e`, PR #187, 2026-11-07)** — audit + updated_at columns on 7 content tables (migration `20261107012337`); drift sweep proposed 13 fixes |
| [038-subject-anchoring](./specs/038-subject-anchoring/spec.md) | — | **Merged (squash `f3a8ff7`, pre-purge `d8acabf1`, PR #189, 2026-11-07)** — `subject_id uuid` + FK on subject_lectures/summaries/quizzes (sync protocol §5.4), name-normalized backfill (100%: 9/9 lectures, 18/18 non-user quizzes) + `sync_subject_id()` triggers, additive-only; database.generated.ts refresh (also absorbs 037's updated_at) |
| [040-automation-test-coverage](./specs/040-automation-test-coverage/spec.md) | — | **Merged (squash `229c14d`, pre-purge `d5f1128c`, PR #212, 2026-11-09)** — full-sweep test campaign (10-agent audit 2026-11-07): web vitest 33→77 files (985 tests; hooks/lib/server/components), shared 18 files/238 tests + MESSAGE_NAMESPACES drift fix, edge Deno 41→122 tests, 5 e2e specs + testids, SQL RPC harness (53 assertions, portable-PG verified) — **found + fixed latent trw_redeem_access_code multi-use exhaustion bug** (migration prod-applied 2026-11-09, ledger version `20261109211708`); coverage tooling wired report-only |
| [043-seed-data-purge](./specs/043-seed-data-purge/spec.md) | [plan.md](./specs/043-seed-data-purge/plan.md) | **Done (force-pushed to main under owner-approved I16 escalation, 2026-11-11)** — real-exam seed SQL withdrawn from every commit + the tree (filter-branch: 49 commits re-signed, prefix `cdb5abd` + all 10 merges untouched); prod ledger rows for the seeds deleted, withdrawal migration `20261111090000`; post-033 squash SHAs in this table refreshed to post-purge values |
| [048-zane-status-avatar](./specs/048-zane-status-avatar/spec.md) | [plan.md](./specs/048-zane-status-avatar/plan.md) | **Merged (squash `ed6889d`, PR #234, 2026-11-13)** — one status-driven ZANE avatar (Muse-style): 3 dotLottie mounts (per-bubble/hero/typing) + reaction state machine replaced by `ZaneAvatar` (dual-video opacity crossfade, ffprobe-verified H.264 idle/typing clips) + `ZaneStatusAvatar` (floating pill `<lg`, docked 128px stack `lg+`); dotLottie infra deleted (`dotlottie-player.wasm` −1.69 MB — prod fetch-verified, `ai-robo.lottie` −68 KB, dep + postinstall patch dropped); mobile gets the floating 140dp avatar + pill via expo-av (isolated in `ZaneAvatarRN.tsx`); web 990/990 tests + tsc + lint green; CI caught a TS7006 in a test + stale assertion → fixed 0c08f7f; **prod 404 on /zane/*.mp4 fixed** — proxy matcher excluded `png` but not `mp4`, so next-intl locale-redirected the videos to the HTML 404 page (posters loaded; mp4 shipped correctly in the commit) → matcher gains `mp4|webm|mp3|ogg|wav|txt` + regression test (`f3780bd`) |
