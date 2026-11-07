# Spec 037 — sync hardening: content-table timestamps + audit coverage

| Field | Value |
|---|---|
| Status | Approved (owner plan approval 2026-11-07, in-session) |
| Type | DB hardening (prevention layer of the materials sync protocol) |
| Origin | `docs/sync-protocol.md` §5 (sandbox) — edge cases 1 & 4 (undocumented admin add/delete) had no who/when trail on content tables |

## Problem

The sync reconcile engine detects changes on `subjects`/`quizzes`/`quiz_questions` by full-row hash only — "changed since last sync", never who or when. `subject_lectures.updated_at` existed but was never touched (no trigger). `audit_table_changes()` covered only `courses`/`profiles`/`admins`. Any dashboard or raw-SQL content edit/deletion was invisible to attribution.

## Changes (single idempotent migration, baseline functions reused)

- `ALTER TABLE subjects, quizzes ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()` — also repairs the dead `saveAiGeneratedDraft` code path that writes `quizzes.updated_at` and would have errored.
- `set_updated_at()` triggers (baseline:1427): `subjects`, `quizzes`, `subject_lectures`. (`summaries` already had one — baseline:3898.)
- `audit_table_changes()` triggers (baseline:1356, AFTER DELETE OR UPDATE, SECURITY DEFINER → `audit_logs`): `subjects`, `subject_lectures`, `summaries`, `quizzes`, `news`, `videos`, `files`.
- **`quiz_questions` deliberately excluded**: quiz edit = delete-all + re-insert → would flood `audit_logs`; the reconcile ledger already hashes each quiz's question set.

## Applied out-of-band

Applied to prod via MCP `apply_migration` (ledger version `20261107012337`, repo file named 1:1 — seeds pattern). Catalog-verified: 2 columns + 10 triggers present; `audit_logs` gained no noise (838 pre-existing rows untouched).

## Aftermath

- Sync snapshot contract gains `subjects.updated_at` + `quizzes.updated_at` → deliberate fingerprint change → reconcile `--init` re-baseline.
- Edge cases 1 & 4 now yield who/when/old/new for every content edit or deletion via `audit_logs` (admin/MCP readable; RLS-gated).

## Out of scope

`subject_id` FK migration (separate larger spec, protocol §5.4) · `quiz_questions` timestamps · repo-manifest data refresh (follow-up chore PR from the same sync sweep).
