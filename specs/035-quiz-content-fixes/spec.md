# Spec 035 — quiz content fixes (multi-line rendering + pending visibility)

| Field | Value |
|---|---|
| Status | Approved (owner plan approval 2026-11-06, in-session) |
| Type | Bug-fix batch (study-flow stability + admin clarity) |
| Origin | Owner bug report: "questions look weird", `*` stars on edit, pending junk quiz visible without label |

## Problem

1. ~13 seeded OOP questions legitimately contain multi-line content (C++ output-shape options like `********` / `* ** *** *****`, exponent operators `num ** pow`). The quiz player renders option text inside flex rows without `whitespace-pre-wrap`, so embedded `\n` collapse — shape questions render as one unreadable line. The edit-form previews have the same flaw under single-line inputs, so `********` reads like a masked field.
2. Admins see `pending` quizzes on /quizzes with no status chip (`QuizGridItem` renders all statuses identically) — the legacy junk quiz «[Partial fractions] sd» looked like a normal broken exam.

## Changes

- `QuizPlayerQuestion.tsx`: `whitespace-pre-wrap` on question `<h3>`, option `<span>`, explanation wrapper.
- `QuizQuestionEditor.tsx`: `whitespace-pre-wrap` on the three LatexRenderer previews (question/options/explanation).
- `QuizGridItem.tsx`: amber `t("pending")` chip when `quiz.status !== "approved"`.
- Data (owner-approved in-session): delete junk pending quiz + its question from prod; publish the 11 proposed OOP files (sandbox manifest `proposed→published`, repo manifest 84→95).
- Out of scope: editor inputs → textarea (previews suffice), seeding the 3 contentless Y2 subjects, exam schedules, OOP pending answers.
- Note: the `quizzes.semester` i18n key landed separately via PR #182.

## Gates

tsc clean · e2e green · Playwright check that a shape option renders multi-line (computed `white-space: pre-wrap`, element height > one line) · post-merge live smoke.
