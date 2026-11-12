# Spec 047 — Schedules UX: Section-Matrix View (Web/Desktop) + Mobile Schedules Tab

> | | |
> |---|---|
> | Branch | `feat/047-schedules-enhancement` |
> | Created | 2026-11-13 |
> | Status | Approved (plan approved by owner 2026-11-13; option-round unanswered — recommended defaults carried: section-matrix default + raw toggle, 6th mobile tab, Electron dev-window desktop verification) |
> | Type | UI enhancement (web, inherited by desktop) + new mobile screen |
> | Input | Owner: "the schedule is very bad — enhance it in web and desktop and mobile" (mobile verification explicitly skipped: edit only, no screenshots/adb) |

## Problem

1. `/schedules` (spec 034) renders the extracted spreadsheet as a raw dump: 73 rows ×
   23–29 columns, the university banner text sits as a sticky `thead` cell, ~80% of cells
   are empty, body text is `text-xs`, and the only scroll is horizontal — on a 390px phone
   the viewport shows 3 of 23 columns. Owner verdict: "very bad".
2. Tab labels are raw sheet data (`الفرقة الأولى`) even on `/en`; `fetchedAt` is formatted
   `ar-EG` in both locales; no today awareness; no subject color coding.
3. The desktop shell renders `<main>` as `overflow-hidden flex-1` (spec 005 FR-017); a
   page without height-aware layout clips instead of scrolling — needs verification/fix.
4. Mobile (Expo) has no schedules surface at all; the shared `schedules` i18n namespace is
   not registered there.

Verified data structure (live DOM extraction of prod f1 + f4 JSON, 2026-11-13): each
sheet is `string[][]` — row 0 = banner/labels, row 1 = section numbers, data rows carry
`[اليوم, الوقت, …section cells]` per **department block**. Blocks are detectable purely
structurally: **time columns** (cells matching `HH - HH`) anchor each block; day column =
time column − 1; section columns run to the next block's day column. No cell-text
splitting is required — 100% cell fidelity is preservable (spec 034's doctrine).

## Scope

**In:**
1. **Shared parser (`packages/shared`)** — move the 4 `timetable-2025-26-f*.json` from
   `apps/web/src/lib/schedules/` to `packages/shared/src/data/schedules/` (single source
   of truth; the Zod schema already lives in shared). New `masarx-shared/schedules`
   module: import + `ScheduleSetSchema` validation (moved from web), plus pure utilities:
   `detectBlocks` (time-column anchors), block label extraction (header cells in span,
   excluding اليوم/الوقت and the university banner; tail after "أرقام الفصول" when
   embedded; generic fallback), `splitDays` (day forward-fill), `cellParts`
   (newline/whitespace normalization → primary + secondary lines), `subjectColorIndex`
   (stable hash → fixed palette), `timeSlotHour`, `todayDayName` (hamza-normalized
   Arabic weekday match). Unit tests assert **cell coverage**: every non-empty body cell
   of all 4 real sheets is reachable via (block, section column, row).
2. **Web default "section matrix" view** — new `_components/SectionTimetable.tsx`:
   department-block chips + day chips (today preselected) + a time×sections matrix
   (≤8 columns per block vs 23 today), subject color coding, today/current-slot
   highlight, sticky time column, contained horizontal scroll, `h-full min-h-0` layout so
   the desktop overflow-hidden workspace scrolls internally. Raw `ScheduleGrid.tsx` stays
   **byte-identical** behind a "Raw grid" toggle (e2e contract preserved).
3. **i18n** — extend the shared `schedules` namespace (ar/en): view toggle, weekday
   names, localized cohort labels (by sheet id, not raw data), sections/time/free/today;
   locale-aware `fetchedAt` date.
4. **Mobile** — new `SchedulesScreen` as a 6th bottom tab (Ionicons calendar): batch
   chips → day chips (today default) → vertical time-slot list; each non-empty cell is a
   color-coded card (primary + secondary lines); Palette tokens + `createStyles` +
   ProfileScreen chip idiom; static data = fully offline. Register the shared `schedules`
   namespace in `src/i18n.ts`.
5. **Gates** — shared+web unit tests; web e2e (existing `schedules.spec.ts` stays green;
   new cases for timetable view + raw toggle); browser screenshots (ar/en × light/dark ×
   1440/390) against the worktree dev server; desktop via **Electron dev window** from
   the worktree (installed app untouched); mobile `tsc --noEmit` only.

**Out (non-goals):**
- Exam schedules (owner-deferred since spec 033); data re-pull (the "طبعة (نهائي)"
  swap remains owner-owed).
- Parsing cell text into subject/staff/room **fields** — presentation-level line split
  only (`cellParts`), same fidelity doctrine as spec 034.
- Wiring the dead shadcn tokens (`bg-card`, `text-muted-foreground`, …) into `@theme` —
  known follow-up (spec 046 note); this spec uses the working slate/brand idiom.
- Any DB/DDL change; edge functions; installed-desktop reinstall (owner's call).

## Contracts

- `masarx-shared/schedules` exports `scheduleSheets`, `detectBlocks`, `splitDays`,
  `cellParts`, `subjectColorIndex`, `timeSlotHour`, `todayDayName` and the
  `ScheduleBlock` type; web's `apps/web/src/lib/schedules/index.ts` becomes a thin
  re-export (existing imports keep working).
- Cell-coverage invariant (unit-tested): the union of (block, section column, row)
  lookups equals the set of non-empty body cells in every sheet.
- Testids: `schedules-page`, `schedules-tabs`, `schedules-tab`, `schedules-grid` (raw
  view, unchanged) and new `schedules-timetable`; `schedules.spec.ts` keeps asserting a
  real `<table>` with `thead/tbody` and "هياكل البيانات" on tab 2.
- Schedule JSON path moves to `packages/shared/src/data/schedules/`; the sandbox
  `fetch-schedules.mjs` output path is updated to match (no re-pull in this spec).

## Behavior preservation & regression strategy

- Raw grid rendering is untouched (zero-risk toggle path); data accessor API unchanged
  for all consumers (re-export).
- No `useSubjects`/Supabase behavior touched; mobile nav gains one tab (existing five
  keep their routes); tab labels drop to fontSize 10 to fit six Arabic labels.
- Gates: shared/web typecheck+tests, web build, e2e suite, browser visual pass, Electron
  dev-window pass, mobile tsc. Pre-existing e2e flakes rerun-verified per house practice.

## Tasks

1. Spec + worktree (`../masarx-wt/feat-047-schedules`, I14) + env copy + install.
2. Shared parser: JSON move, `masarx-shared/schedules` module, unit tests (coverage).
3. Web UI: `SectionTimetable` + page rewrite + i18n extension.
4. Web gates: unit, e2e (old + new), browser screenshots.
5. Mobile: screen + 6th tab + i18n registration + `tsc --noEmit`.
6. Desktop: Electron dev-window verification via computer-use screenshots.
7. PR (`gh pr create --head …`) + AGENTS.md ledger row; worktree removal after merge.
