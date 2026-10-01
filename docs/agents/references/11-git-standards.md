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

## Branch Isolation & Multi-Agent Safety Protocol (I14)

Multiple agents/sessions work in this repository concurrently — often in the
same working copy. The currently checked-out branch is therefore **never** a
task assignment.

1. **Never assume the current branch matches the task scope.** The user may
   start a session on any branch out of convenience. Do not commit web fixes
   to a mobile branch or vice-versa, and do **not** adopt the branch's
   pending specs/tasks (`tasks.md` checkboxes, deferred checkpoints) as your
   own work unless the owner explicitly approves continuing that exact
   milestone — and record the approval in the spec ledger when they do.
2. **Create a dedicated branch before writing code or committing — never
   work or commit on `main` directly.** Check `git branch --show-current`
   first; if the branch's scope does not match the task, create one:
   ```bash
   git checkout -b <type>/<short-task-name> origin/main
   ```
   Base new work on `main` — or on the integration branch the work stacks on
   (feature branches that depend on unmerged earlier milestones). The only
   direct-`main` exception is owner-directed repo maintenance (docs,
   invariants, governance) that the owner explicitly orders onto main.
   Record the branch you created in your `.agents/` claim (rule 4) — never
   assume the branch that happens to be checked out is yours.
3. **Re-assert the branch at commit time, not just at task start.** A
   parallel session can switch branches mid-task (hit 2026-09-26: a commit
   landed on a freshly created sibling branch seconds after a branch check).
   Assert inside the same command as the add/commit, and verify the pushed
   ref afterwards:
   ```bash
   git branch --show-current | grep -qx <expected-branch> \
     && git add <explicit-paths> && git commit -F <msg-file>
   git push origin <branch> && git log --oneline -1 origin/<branch>
   ```
   An "Everything up-to-date" push for a commit you just made means the
   commit went somewhere else — stop and repair via a temporary worktree
   cherry-pick (repair mechanics, not a working convention); never
   force-reset an actively committing branch.
4. **Claim the task in `.agents/` before your first edit (file locking).**
   Read every existing claim file first (`ls .agents/`) so you know which
   paths and branches other agents have locked. If your required paths are
   free, create `.agents/<task-name>.md` — gitignored, machine-local,
   never committed:
   ```markdown
   # <task-name>
   - branch: <type>/<short-task-name>
   - status: in-progress
   - locked paths:
     - apps/web/src/hooks/useChatScroll.ts
   ```
   You may touch only your locked paths; conversely, never stash, overwrite,
   commit, or discard files locked by another agent, and never switch
   branches in the shared tree while another session is committing. Claims
   coordinate agents sharing this clone only — they are invisible to git
   and to other checkouts, so if you work from a secondary worktree/clone,
   also read the primary clone's `.agents/`. When the task is committed and
   pushed, delete your claim file immediately (self-cleanup) so the paths
   unlock.
5. **Stage explicit paths only.** Never `git add .`, `git commit -a`, or
   `git checkout -- .` — blanket commands sweep other agents' uncommitted
   work into your commit. Stage exactly the paths listed in your claim
   file. Verify every commit with `git show HEAD --stat`
   (the file count must match what you staged). When a shared *dirty file*
   must carry both your hunk and another agent's, stage only your hunk via a
   filtered patch (`git diff` → extract → `git apply --cached`) and commit
   the index without a pathspec.

**Why:** 2026-09-26 — a web fix was committed to `feat/020-mobile-polish`
(the session's starting branch), a CI fix landed on a freshly created
`feat/023-mobile-sentry` via a mid-task branch switch, and shared-file
commits twice absorbed parallel hunks. This section makes the defenses
mandatory: dedicated branches, commit-time assertions, explicit-path
staging, and (since 2026-09-26, replacing the brief mandatory-worktree
rule) `.agents/` claim files that cost zero disk and stay in the tree the
agent actually works in.

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

**Back to:** [AGENTS.md](../../../AGENTS.md)
