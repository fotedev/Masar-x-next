# Branch Protection Ruleset

This document is a **human-readable snapshot** of the active branch protection
[Ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
for the `main` branch on `fotedev/Masar-x-next`. The actual source of truth
lives in the GitHub UI / API (Rulesets are not stored in the repo).

> **Ruleset ID:** `20299668` &nbsp;·&nbsp; **Name:** `Main Branch Protection` &nbsp;·&nbsp; **Enforcement:** `active` &nbsp;·&nbsp; **Target:** `refs/heads/main`

> If you change a rule in the GitHub UI, please update this file in the same
> PR that triggered the change so the docs stay in sync.

---

## Required status checks

A pull request into `main` is blocked from merging until all of the following
checks report `success` from the latest commit on the PR head:

| Check name    | Source                                | Notes |
|---------------|---------------------------------------|-------|
| `Vercel`      | Vercel GitHub App (integration `8329`) | Production build + preview deploy |
| `ESLint`      | GitHub Actions — workflow `CI` (`ESLint` job) | Lint via `pnpm lint` |
| `next build`  | GitHub Actions — workflow `CI` (`next-build` job) | Build via `pnpm build` (with placeholder env vars) |
| `ai-endpoint-grep` | GitHub Actions — workflow `CI` (`ai-endpoint-grep` job) | Spec 004 T014 — no direct AI provider endpoints |
| `gitleaks-artifacts` | GitHub Actions — workflow `CI` (`gitleaks-artifacts` job) | Secret scan on the built bundle |

> **Pending owner action (Spec 010 §2.4):** the `e2e` job (workflow `CI`, Playwright
> study-flow smoke) is wired in `ci.yml` but NOT yet in this ruleset — the API token
> used on 2026-09-17 lacked ruleset write (`404` on PATCH). Add `e2e` via
> *Settings → Rules → Rulesets → Main Branch Protection → Require status checks*
> once the job has reported once on a PR (checks must exist before they can be required).
> This table should then gain: `e2e` — workflow `CI` (`e2e` job) — Playwright public
> happy path (Spec 010 / MVP report G6.1).
>
> **Also recommended (2026-09-18):** add the `workflow-lint` check (workflow `CI`,
> actionlint over `.github/workflows/`) to required checks at the same time — it
> catches unparseable workflow YAML on the introducing PR (the failure class that
> left Lighthouse silently broken; see MVP report pass 5/6).

- `strict_required_status_checks_policy`: `false` — a missing check on a PR
  does not block the merge; the requirement is only enforced once a check
  has been reported.
- `do_not_enforce_on_create`: `false` — the rule is enforced on the initial
  push that creates a matching branch.

---

## Other active rules

| Rule                          | Setting |
|-------------------------------|---------|
| `deletion`                    | Enabled — `main` cannot be deleted. |
| `non_fast_forward`            | Enabled — force pushes to `main` are blocked. |
| `required_linear_history`     | Enabled — merges must be linear (squash or rebase). |
| `required_signatures`         | Enabled — commits must be GPG/SSH signed. |
| `required_deployments`        | Required deployment environment: `Preview`. |
| `code_scanning`               | Tool: `CodeQL`, alerts threshold: `errors`, security alerts: `high_or_higher`. |
| `copilot_code_review`         | `review_on_push: false`, `review_draft_pull_requests: false`. |
| `pull_request`                | `required_approving_review_count: 1`, `dismiss_stale_reviews_on_push: true`, `required_review_thread_resolution: true`, allowed merge methods: `merge`, `squash`, `rebase`. |

---

## Bypass actors

The following can bypass any rule:

| Actor                                              | Mode     |
|----------------------------------------------------|----------|
| RepositoryRole `5` (Admin / Maintainer)            | `always` |
| Integration `8329` (Vercel GitHub App)             | `always` |
| Integration `347564` (CodeRabbit)                  | `always` |

---

## How to update this file

1. Apply the change via the GitHub UI **or** `gh api`:
   ```bash
   # Example: get current
   gh api repos/fotedev/Masar-x-next/rulesets/20299668

   # Example: update (PUT full ruleset body)
   gh api --method PUT \
       repos/fotedev/Masar-x-next/rulesets/20299668 \
       --input ruleset.json
   ```
2. Update this file to mirror the new state.
3. Open a PR titled `chore(ruleset): <short description>` so the change has an
   audit trail.
