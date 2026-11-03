# Spec 033 — Drive Materials Port (`/materials` + seeded real exams)

> | | |
> |---|---|
> | Branch | `feat/033-materials-port` |
> | Created | 2026-11-04 |
> | Status | Approved (owner plan approval + 4 gate answers, 2026-11-04) |
> | Type | Feature port (new route + static data + seed migration) |
> | Input | `sandbox/drive-materials/` reference implementation (gate-green: validate 17/242, verify-preview OK, SMOKE PASS); `docs/port-decisions.md` gate answers |

## Problem

The Drive materials corpus (20 subjects / 84 files, term-tagged level+semester) and the
extracted real-exam bank (17 exams / 242 verified questions, provenance-locked) live only
in the gitignored sandbox preview. Students cannot reach any of it from the real app.

## Scope

**In (this spec):**

1. **`/materials` route** (`apps/web/src/app/[locale]/materials/`, `"use client"` page under
   the shared `Layout`/`PageTransition`): term-filtered subject grid (level/semester badges,
   ar/en), group chips (nested), in-page Drive viewer
   (`https://drive.google.com/file/d/{id}/preview`) with open-in-Drive, coming-soon state for
   the 13 Y1-S1 stub subjects. Port of the proven sandbox `library.html` logic rebuilt with
   app idioms (`useTranslations`, no `data-ar`, flex `min-w-0`/truncate patterns from the
   hard-bugs list, no `backdrop-filter` overlay traps). Exams stay on `/quizzes` — a link,
   not an embedded player.
2. **Static data (owner gate 4):** sandbox `data/manifest.json` →
   `apps/web/src/lib/materials/manifest.json` + typed accessor; `DriveManifestSchema` (Zod)
   in `packages/shared/src/types/schemas/index.ts` (I2). No new DB tables; no RLS changes.
3. **Nav + i18n (I3):** `materials` entry in `Header.tsx` `primaryNavItems` + `FooterLinks`;
   `packages/shared/src/messages/{ar,en}/materials.json` new namespace registered in
   `apps/web/src/i18n/request.ts` `MESSAGE_LOADERS`. Every user-facing string both locales.
4. **Seed migration** `20261104000000_seed_real_exams.sql` (owner gates 2+3: visibility same
   as existing approved quizzes; status `approved` immediately):
   - 17 quizzes + 242 questions from the sandbox JSONs, one idempotent guarded CTE per quiz
     (`WHERE NOT EXISTS (SELECT 1 FROM quizzes WHERE title = $title) RETURNING id` →
     `INSERT INTO quiz_questions ... SELECT ... FROM (VALUES ...) , q`).
   - Row mapping: `title`; `description = JSON.stringify({description, department, year,
     subject})` in the exact shape `useQuizzesFilters` reads; `subject` = exact
     `subjects.name` string (prod names SELECTed and mapped first); `source_type='manual'`;
     `status='approved'`; `duration_seconds`; questions: `options` jsonb array,
     `correct_answer` 0-based, `order_index` 1-based.
   - Provenance visible to students: each question's `explanation` gains the suffix
     ` — المصدر: {file}، ص{page}`.
   - Zero schema change. Applied via `supabase-masarx` MCP `apply_migration` (verify linked
     project = Masar-x first).
5. **E2E:** `apps/web/e2e/materials.spec.ts` — subjects render (20), a Drive iframe builds,
   a seeded exam appears in `/quizzes` and plays to results.

**Out (non-goals):**
- The 13 Y1-S1 stub subjects await the owner's Drive folder link (coming-soon until then).
- The 28 OOP pending-answer tasks stay unseeded (no printed solutions; `pending-answers.json`).
- No `drive_files` table / admin CRUD / sync-UI (static manifest chosen; revisit post-MVP).
- Tighter logged-in-only RLS (owner chose parity with existing approved-quiz visibility).
- Quiz provenance DB columns (suffix-in-explanation is the MVP carrier).

## Contracts

- **Zod:** `DriveManifestSchema` validates `{excludedFolders?, subjects: [{slug, name,
  nameAr, icon, level: positive int, semester: positive int, folderId: string|null,
  stub?: boolean, groups: [...nested children...]}]}`; accessor throws on invalid manifest.
- **DB:** no DDL; seed idempotent by title; rerun inserts 0 rows.
- **i18n:** `materials` namespace resolves in both locales (missing key = build failure at
  request-config level, matching existing namespaces).

## Behavior preservation & regression strategy

- No existing route/table/policy is modified; the only edits to existing files are additive
  (nav item, loader entry, schema append). Header/Footer render unchanged for other tabs.
- Seed touches only new rows (title-guarded); existing quizzes/attempts untouched.
- Regression gates: `pnpm -F web typecheck && lint && build`; existing e2e suite; new
  `materials.spec.ts`; prod count queries after apply (17 quizzes, +242 questions).

## Tasks

1. Spec + worktree + claim (this file's branch/worktree; I14).
2. Manifest copy + `DriveManifestSchema` + accessor.
3. `materials.json` (ar/en) + `request.ts` loader + nav items.
4. `/materials` page + `_hooks/useMaterialsData.ts` + `_components/{SubjectGrid,GroupChips,DriveViewer}.tsx`.
5. Seed-migration generator (`.tmp/`, uncommitted) → `20261104000000_seed_real_exams.sql`.
6. E2E spec; typecheck/lint/build; MCP apply; count verification.
7. PR + AGENTS.md ledger row + claim cleanup.
