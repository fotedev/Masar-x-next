# Spec 043 — Seed-Data Purge (copyright withdrawal)

> | | |
> |---|---|
> | Branch | direct to `main` (owner-approved I16 escalation window) |
> | Created | 2026-11-11 |
> | Status | Approved (owner, 2026-11-11 — handoff decisions 1–3 with I16 escalation confirmed in writing) |
> | Type | Repo remediation (history rewrite + prod ledger reconciliation) — no app code changes |
> | Baseline | `main` `8835d321` (pre-purge) |

## Problem

PR #179 (spec 033) committed four seed SQL files containing verbatim copyrighted
content taken from publisher solutions manuals and instructor sheets. The repository
is public, so the content has been exposed in every commit since 2026-11-05 (squash
`bf009d9d`) and in the pre-squash branch history (`0f29adf3`, PR #179). Software
Heritage archives the repo; GitHub retains `refs/pull/*` for every PR.

## Scope

**In:**

1. **History rewrite** (filter-branch, index-filter) removing exactly four files from
   every commit on `main`, `docs/e2e-agent-runbook`, `dependabot/npm_and_yarn/uuid-14.0.3`
   and retargeting lightweight tag `v0.6.0-test.1`:
   - `supabase/migrations/20261103222513_seed_real_exams.sql`
   - `supabase/migrations/20261103223120_seed_real_exams_part2a.sql`
   - `supabase/migrations/20261103223457_seed_real_exams_part2b.sql`
   - `supabase/migrations/20261103223556_seed_real_exams_part2c.sql`
   Rewritten commits re-signed with the owner's SSH key; author/committer identity and
   both dates preserved; prefix `cdb5abd` and all 10 merge commits byte-identical.
2. **Fix-forward commit**: withdrawal migration `20261111090000_withdraw_real_exam_seed.sql`,
   `supabase/migrations/README.md` divergence note, and doc reconciliation
   (`NOTICE.md` §2, `AGENTS.md` spec rows + SHA refresh, `README.md`, `CHANGELOG.md`,
   `docs/FEATURES.md`, `docs/agents/references/04-architecture.md`,
   `specs/033-materials-port/spec.md` annotation).
3. **Ruleset relax window** (I16 escalation, approved): remove `non_fast_forward`,
   `pull_request`, `required_status_checks`, `required_deployments`, `required_signatures`
   from ruleset `20299668` for the single force-push; restore byte-for-byte after.
4. **Force-push** the 3 rewritten branches + tag with explicit refspecs (never `--all`).
5. **Prod reconciliation**: insert the withdrawal migration's ledger row; delete the
   4 orphan seed ledger rows (their `supabase_migrations.schema_migrations.statements`
   hold the verbatim SQL); verify content counts unchanged (18 quizzes / 245 questions /
   24 subjects).
6. **Local hygiene**: purge local copies of the seed content — primary checkout residue
   refs + `.tmp/`, mirror `refs/original/*` + `refs/pull/*` + gc, rollback bundle +
   roundtrip clone after remote verification, temp scratch (117 MB SQL dump + scratch repos).
7. **Tickets (owner files)**: GitHub Support (PR-ref purge — `refs/pull/*` are
   read-only server-side) + Software Heritage takedown.

**Out (owner decisions):**

- Production quiz/question data stays (decision 1 — "Delete from history + tree"
  explicitly rejected dropping prod quizzes).
- Drive files + `apps/web/src/lib/materials/manifest.json` untouched (decision 2) —
  Drive filenames remain exposed in the manifest and the Drive files themselves are
  publicly downloadable.
- `20261103225128_seed_y2s1_subjects.sql` kept (4 subject names only, no copyrighted
  text — owner confirmed 2026-11-11).

## Execution record (pre-push verification, 2026-11-11)

- Rewrite executed in mirror `../masarx-wt/sdr-043` over `bf009d9d^..<ref>` per branch:
  49 main commits re-signed (`%G? = G` × 49), identity + dates preserved,
  prefix `cdb5abd` identical (`main~49 == cdb5abd`, counts 49 = 49),
  merge sets old-vs-new diffed: identical (10 merges, all pre-`bf009d9d`).
- Tree delta old→new main = exactly the 4 deletions; 4 seed blobs unreachable from all
  4 rewritten refs; all 11 kept heads/tags clean of seed ancestry; no verbatim seed
  text in any reachable blob (sole V4 hits = `manifest.json` Drive-filename matches,
  out of scope by decision 2).
- Affected `refs/pull/*` computed for the Support ticket: 58 heads
  (157, 158, 159, 160, 165, 171, 172, 174, 178, 179–227) + `refs/pull/227/merge`;
  `0f29adf3` reachable only from `refs/pull/179/head`. Forks: 0.
- Post-push verification recorded in the session final report and the prod ledger row.

## Acceptance

- [ ] Remote `main`/`docs/e2e-agent-runbook`/`dependabot/…`/`v0.6.0-test.1` = rewritten
      SHAs; throwaway-clone sweep: zero seed-text hits in reachable blobs
- [ ] Prod ledger: withdrawal row present, 4 seed rows gone, counts 18 / 245 / 24 unchanged
- [ ] Ruleset restored byte-for-byte (verified via GET)
- [ ] Local: seed blobs unresolvable in primary + mirror after gc
- [ ] Ticket drafts delivered (GitHub Support + Software Heritage) — owner files them
