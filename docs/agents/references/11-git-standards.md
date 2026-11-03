# Git Standards & Contribution Protocol

All autonomous workflows, fixes, and contributions within this repository must strictly adhere to the following conventions:

## Conventional Commits Standard

All commit messages must follow the standard format:
`<type>(<scope>): <short summary in imperative present tense>`

- **Types allowed:**
  - `feat`: A new feature
  - `fix`: A bug fix
  - `refactor`: Code changes that neither fix a bug nor add a feature
  - `docs`: Documentation updates only
  - `test`: Adding or correcting tests
  - `chore`: Maintenance, dependency, or config updates
- **Scope:** Mandatory when targeting a specific subsystem or module (e.g., `cli`, `gateway`, `storage`, `auth`).
- **Examples:**
  - `fix(cli): honour key_env in config.yaml model.aliases entries`
  - `feat(gateway): add fallback route for session overrides`

## Issue Linking & Traceability

- Every pull request description or commit closing an issue must explicitly link the upstream reference using keywords (`Fixes #<id>`, `Closes #<id>`, or `Refs <org>/<repo>#<id>`).
- Provide clear context in PR bodies explaining the root cause and the operational impact of the change.

## PR Cleanliness & Diff Guardrails

- **Minimal Diffs:** Never pollute PRs with unrelated workspace files, unnecessary lockfile recreations, or mass formatting changes. Keep changes scoped strictly to the problem.
- **Branch Synchronization:** Before creating a PR or pushing changes, always fetch and rebase against the latest `upstream/main` (or default target branch) to avoid divergent histories and bloated diff counts.
- **Verification:** Ensure that you can trace and explain every modified line. Avoid unreviewed bulk changes.

## Agent Isolation & Worktrees (I14 — revised 2026-11-04, owner decision)

One agent session = one branch = one worktree. Git itself forbids checking
the same branch out twice — that is the real cross-session lock, so the
`.agents/<task>.md` claim-file ceremony stays RETIRED (2026-11-02).

1. **The primary checkout belongs to the owner.** Agents never write in it.
   Never `git switch`/`git reset` or run test commits there while another
   session may be active.
2. **Worktrees live OUTSIDE the repo, at the tool-neutral path**
   `../masarx-wt/<branch-slug>` (sibling of the project folder):
   ```bash
   git worktree add ../masarx-wt/feat-033 -b feat/033-materials-port origin/main
   ```
   Never inside the repo, and never in tool-specific folders (`.kilo/`,
   `.cline/`, `.cursor/`, `.zcode/`, …) — nested worktrees make agent edit
   tools (bound to the workspace root) hit the primary tree, and duplicate
   copies confuse `tsc`/`eslint`/`next` (hit 2026-11-04).
3. **Pin the path on every command** — `git -C <path>` or
   `cd <path> && …` in the same line. The shell CWD may reset to the
   primary checkout between commands; unpinned relative paths land edits
   in the wrong tree (hit 2026-11-04, self-caught and repaired).
4. **Re-assert the branch at commit time** — inside the same command as the
   add/commit — and **stage explicit paths only** (never `git add .`,
   `git commit -a`, `git checkout -- .`). Verify with `git show HEAD --stat`.
5. **Branch synchronization** (unchanged): fetch and rebase against the
   latest target branch before pushing; PR flow for everything that is not
   owner-directed maintenance (direct `main` commits allowed only for that).
6. **After merge, self-clean:** `git worktree remove <path> &&
   git worktree prune` — zero orphaned worktrees, resolved immediately.

Tool droppings (`.kilo/`, `.cline/`, `.zcode/`, `.cursor/`, …) belong in
the machine's global gitignore (`core.excludesFile`) — never committed and
never in the project's `.gitignore`. Historical incident notes (2026-09-26,
2026-10-03 collisions; 2026-11-04 wrong-tree edits) are preserved in this
file's git history.

## Git Identity Lock (I15)

Commits must carry the owner's identity, set by machine git config only. **Never** do any
of the following:

- `git -c user.name=… -c user.email=… commit` (per-command config override — it beats
  every config file and leaves no persistent trace)
- `git commit --author="…"`, or setting `GIT_AUTHOR_*` / `GIT_COMMITTER_*` env vars
- `--no-verify` (skips the identity guard hooks) or `-c core.hooksPath=` (disables them)

If `git var GIT_AUTHOR_IDENT` / `GIT_COMMITTER_IDENT` do not resolve to
`ahmedaboalayoun0016k@gmail.com` or `fotedev@users.noreply.github.com` — stop and ask the
owner instead of self-assigning an identity.

**Local guard:** `C:/Users/FOTE/.githooks/pre-commit` + `commit-msg` (identical script,
living **outside** any repository) reject any commit whose author/committer email is not
in the allowlist. They are wired via the repo-local config
`core.hooksPath=C:/Users/FOTE/.githooks` (absolute path) in this repo and in
`unban-machine-id` (ghost), so they apply regardless of `HOME` (ZCode desktop clones
override HOME, which breaks global-config resolution) and are inherited by agent
worktrees (`.kilo/worktrees/*`) — a relative `hooksPath` would resolve against each
worktree root and miss there, and files inside the repo would be removable by
`git clean`. The hook evaluates `git var GIT_AUTHOR_IDENT`/`GIT_COMMITTER_IDENT` at
commit time, so it *does* see `-c` and `--author` overrides. Editing the hook files is an
owner-level machine change, not a repo PR. Final enforcement layer is the GitHub ruleset
(signed commits, no bypass).

**Why:** 2026-09-28/29 — a Hermes session (`20260928_130552_98eb20`) committed 7 times on
a task branch using `git -c user.email=hermes@nousresearch.com -c user.name="Hermes Agent"
commit`, fast-forward-merged to `main` and pushed through the then-open admin bypass. The
commits were SSH-signed by the owner's own key (global `commit.gpgsign=true`) but carry
the agent's self-selected identity, so GitHub shows them `Unverified / unverified_email`
under the `Rafa-Ross` account that owns that email. AGENTS.md (with I14) was not read
until after the first commit — hence I15 is also mirrored into agent memory and enforced
by hooks rather than documentation alone.

See also the [pre-commit / pre-merge checklist](./08-precommit.md).

## Escalation Lock (I16)

Protected and irreversible repository state changes require the owner's **explicit written
confirmation in the same conversation message** that requests the exact action. Without it,
an agent must never:

- modify repository rulesets (create/update/delete, including temporary bypass windows)
- force-push to any protected branch
- rewrite pushed history (rebase / filter / amend of commits already on a remote)

**What does not count as confirmation:** an approved plan alone, silence in reply to a
clarification question, a timeout, or an agent-chosen "recommended default". If an action
additionally requires the owner to open a bypass window (or the agent to open one), the
agent must ask who opens it and **wait** for the answer.

**Why:** 2026-10-03 — `main` was rewritten (7 Hermes-identity commits re-authored to the
owner; 25 commit SHAs changed; verified content-identical, dates preserved). The rewrite was
owner-requested and the plan approved, but the sub-question "who opens the bypass window on
`Main Branch Protection` (ruleset 20299668)?" went unanswered and the agent proceeded with
its recommended default: it added itself as a bypass actor (`RepositoryRole` admin), force
-pushed, and restored the ruleset ~30 seconds later (ruleset History: 22:02:04 and
22:02:33 +02:00). The outcome was clean and `current_user_can_bypass` returned to `never`,
but a locked ruleset is exactly the kind of state whose unlocking must never be a default.

**Related note — identity in throwaway clones:** when re-creating that history in a temp
clone, the agent set the identity explicitly (`fotedev` / `fotedev@users.noreply.github.com`,
matching this repo's dominant convention) instead of inheriting the machine global config.
Not a command-time override (I15's letter), but an undisclosed choice of identity source —
any deliberate identity selection must be stated in the report.

**Back to:** [AGENTS.md](../../../AGENTS.md)
