# Spec 034 — Subjects Cleanup + All-Levels Browsing + Materials & Sections Schedules

> | | |
> |---|---|
> | Branch | `feat/034-subjects-schedules` |
> | Created | 2026-11-04 |
> | Status | Approved (owner-directed with screenshots 2026-11-04; plan approved; unanswered gates carried per recommended defaults) |
> | Type | Data cleanup + UI feature (level tabs) + new schedules surface |
> | Input | Owner screenshots (FOTE/test on /subjects; missing cohorts; "جدول الطلاب (ثان 25-26)" timetable tabs) |

## Problem

1. Demo subjects "FOTE" and "test" (prod `subjects` rows) render on the Academic Subjects
   grid. Zero code references; nothing FK-references `subjects.id`.
2. `/subjects` shows only the viewer's own level/semester (`useSubjects` scoping, anonymous
   defaults to level 1) — the owner cannot see the other cohorts' subjects (incl. the 4
   seeded Y2-S1 subjects from spec 033) without editing their profile.
3. The weekly timetable ("جدول الطلاب (ثان 25-26)" — tabs `الشعبة الأولى…الرابعة`,
   `دوامي تخزين`, `الفرقة الرابعة`; cells "subject – doctor – room") exists only as Google
   Sheets screenshots; the app has no schedule surface. Exam schedules are deferred by the
   owner ("انتهت المهمة" — exam period over).

## Scope

**In:**
1. **Subjects cleanup migration** — delete `subjects` rows `name IN ('FOTE','test')`;
   delete content rows tagged `subject IN ('FOTE','test')` (counted before, counts
   documented in the PR). Idempotent (`WHERE`-guarded deletes).
2. **Level tabs on `/subjects`** — `useSubjects` gains an opt-in `allLevels` mode (skips
   the level/semester `.or()` filters; keeps anonymous `show_on_home`; admin path
   unchanged). `/subjects` page renders a level tab bar (academic_levels names), default =
   viewer's level, client-side filter. Home page scoping untouched.
3. **Schedules extraction (sandbox)** — extend `tools/fetch-schedules.mjs`: discover the
   timetable doc's tab gids from htmlview source, add the matching tabs to `SHEETS`, fetch
   each via gviz CSV. **Hard gate:** tab names must match the owner's screenshots
   (`الشعبة الأولى/الثانية/الثالثة/الرابعة`, `دوامي تخزين`, `الفرقة الرابعة`) — otherwise
   STOP and ask the owner for the exact link. Output: raw-grid JSON per tab (same faithful
   shape as the existing 3 schedules).
4. **`/schedules` page (app)** — static JSON (`apps/web/src/lib/schedules/`) validated by
   `ScheduleSetSchema` (Zod, packages/shared); per-tab scrollable weekly grid (sticky
   header, x/y scroll — port of the proven sandbox `links.html` `.sched-table` rendering);
   nav item "الجداول" (Header + FooterLinks); `schedules` i18n namespace (ar/en).
5. **E2E** — `subjects-levels.spec.ts` (level tabs switch reveals Y2 subjects incl. the 4
   seeded) + `schedules.spec.ts` (all tabs render, grid populated).

**Out (non-goals):**
- Exam schedules (owner deferred); Y1-S1 Drive folder link; 28 OOP pending answers;
  PR #179 (spec 033) review.
- Per-subject schedule cards (`subjects.schedule` free text) — dedicated page only.
- Any schema change (deletes + UI only; no DDL).
- Parsing timetable cells into structured fields — the raw grid is rendered faithfully
  (100% accuracy; cell parsing is a post-MVP nicety).

## Contracts

- `useSubjects({ allLevels: true })` returns every subject the caller may otherwise see
  (minus anonymous `show_on_home` filtering), without level/semester server filters.
- `ScheduleSetSchema`: `{ generated: string, source: {docId, title}, sheets: [{ id, tab,
  gid, fetchedAt, rowCount, colCount, rows: string[][] }] }`.
- Migration ledger ↔ repo files 1:1 (same doctrine as spec 033).

## Behavior preservation & regression strategy

- Home page + all other `useSubjects` consumers keep their existing scoping (opt-in flag).
- Admin subjects management unaffected (admins already bypass scoping).
- Deletions are name-guarded and idempotent; rerun = no-op.
- Gates: typecheck/lint/build; new e2e ×2; existing suite rerun (pre-existing flakes
  rerun-verified per spec 033 practice); prod SQL counts.

## Tasks

1. Spec + worktree + claim.
2. Tagged-content counts → `subjects_cleanup` migration + ledger-named repo file.
3. `useSubjects` allLevels + `/subjects` level tabs + i18n keys.
4. Sandbox gviz extraction (tab-name gate) → `data/schedules/*.json`.
5. `/schedules` page + static data + Zod + nav + i18n.
6. Gates (typecheck/lint/build/e2e/prod SQL) → PR → ledger row → claim cleanup.
