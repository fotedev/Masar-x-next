# Spec 038 — subject anchoring: `subject_id` FK layer on content tables

| Field | Value |
|---|---|
| Status | Approved (owner plan approval 2026-11-07, in-session) |
| Type | DB hardening (sync protocol §5.4 — the last open ⬜ of the prevention layer) |
| Origin | Content tables reference subjects by **name string** — `subject_lectures.subject`, `summaries.subject`, `quizzes.subject` carry no FK at all (baseline comment: "nothing FK-references subjects.id — name-based tagging convention"). This is the root of the reconcile's `orphan_subject_ref` and `near_duplicate_subject` classes. |

## Problem

A subject rename or a typo in a content row's `subject` string silently disconnects it from its subject — nothing at the DB level prevents or even records the drift. The reconcile engine can only guess by normalized name matching after the fact.

## Changes (single idempotent migration, additive — zero app changes)

- `ALTER TABLE subject_lectures, summaries, quizzes ADD COLUMN IF NOT EXISTS subject_id uuid` — nullable **by design**: the 3 manifest-only Y2 subjects (Business Management / Probability & Statistics / Project Management) have no DB rows yet and stay an owner gate; user-content rows are excluded from sync anyway.
- **Backfill**: three `UPDATE … FROM subjects` using the reconcile's normalizer (`lower(regexp_replace(btrim(x), '[\s.\-–_]+', '', 'g'))`) against `name` then `name_en`. Quiz seeds write the Arabic `subjects.name` verbatim (20261103* migrations), so the seeded 18 quizzes / 9 lectures are expected to map 100%.
- **FK constraint** `REFERENCES subjects(id) ON DELETE SET NULL`, added via a DO-block checking `pg_constraint` (Postgres has no `ADD CONSTRAINT IF NOT EXISTS`). `ON DELETE SET NULL` preserves today's behavior exactly — deleting a subject neither breaks nor removes content rows; the anchor empties and the spec 037 audit trigger records the cascade UPDATE.
- **`sync_subject_id()`** (SECURITY INVOKER, `SET search_path = public`) + `BEFORE INSERT OR UPDATE OF subject` triggers on the three tables — every new/edited row resolves its anchor automatically (NULL when the name matches nothing).

## Type refresh (I2)

`packages/shared/src/types/database.generated.ts` is regenerated against prod after the migration — it gains `subject_id` ×3 **and** the spec 037 `updated_at` columns it was missing (the generated file had drifted stale). Hand-written aliases (`Summary`/`Quiz`/`Subject`) are additive-safe.

## Sandbox tooling upgrades (same session — sandbox is outside git)

- `fetch-db-snapshot.mjs`: `subject_id` added to the three SELECT lists → deliberate fingerprint change → `--init` re-baseline (proven mechanics from spec 037).
- `sync-reconcile.mjs`: new class **`subject_name_drift`** — `subject_id` set but the string no longer norm-matches the referenced subject's `name`/`name_en` → proposal to update the string (structural rename detection). Existing name-based orphan detection stays as the fallback for un-anchored rows.
- `sync-drive.mjs`: (a) group-links **`checkUrl` canary** — the 3 gviz endpoints from `group-links.json` probed with the same redirect-manual pattern as `canaryProbe` (group-links.md §4); (b) **phantom-rename fix** — `groupNode` stores the raw `driveName: n.name` and `flattenManifest`/`diffTree` compare `g.driveName ?? g.name` (group-links.md §6: the differ compared curated display names against raw crawl names, printing 5 cosmetic renames every run).

## Out of scope

App query switch to `subject_id` (7 string-join sites enumerated: `actions/content.ts:68`, `useQuizzesData.ts:64`, `subjects/[subject]/page.tsx:143,170`, `LectureSelect.tsx:42`, `useLectureContent.ts:65,80`, `useManageLectures.ts:51` — future spec) · seeding the 3 missing Y2 subjects (owner gate) · publishing the 13 proposed Drive files / Midterm classification (owner questions open) · `quiz_questions` timestamps (delete-all + re-insert makes them noise; per-quiz question-set hash covers detection).
