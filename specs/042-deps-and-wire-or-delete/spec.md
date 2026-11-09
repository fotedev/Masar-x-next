# Spec 042 — Dependency Advisory Burn-down + Wire-or-Delete

**Status:** Approved (owner, 2026-11-09 — "continue" after spec 041 close-out)
**Baseline:** origin/main `0ff93be`

## Problem

1. The CI `deps-audit` job (spec 041 #207) measured **59 production-dependency advisories** (35 high / 1 critical). Forensics (pnpm-lock.yaml v9 reverse-walk + GHSA Advisory DB, counts cross-verified) shows the dominant producer is the **expo 51 / react-native 0.74.5 prod subtree** (@expo/cli 0.18.31, RN CLI 13.6.9, metro 0.80.12, babel-preset-expo 11, expo-dev-launcher 4) plus electron-builder's build tooling. **52 of 59 are clearable now**; 7 are deferred/unpatchable (below).
2. The review's three wire-or-delete candidates (verified against the tree + RLS ground truth):
   - `trw/my-access` — real page on live tables (`trw_memberships`+`trw_plan_definitions`), zero entry points; the working `/trw/redeem` flow has no "view my plan/expiry" surface. **WIRE.**
   - mobile `SummaryDetail` — 489-LOC finished spec-020 screen, mounted in App.tsx but **zero `navigate()` calls**; SubjectDetailScreen opens raw PDFs instead. `lib/reviews.ts` serves only it. **WIRE.**
   - `instructor-dashboard` — fully implemented (334 LOC, i18n-complete) but zero nav references anywhere, no instructor role concept exists (pure `courses.instructor_id` ownership), and its one real workflow (enrollment approval) already ships in the admin dashboard. **DELETE** (owner-approved via this spec).

## Delivery — 6 PRs

| PR | Branch | Scope | Advisories cleared |
|---|---|---|---|
| 1 | `fix/deps-audit-wave1` | `pnpm update node-forge joi` + overrides: send@0.19.2, postcss@8.5.32, ajv@8.20.0, decode-uri-component@0.5.1, @xmldom/xmldom@0.8.15 | 36 (59→23) |
| 2 | `fix/deps-audit-wave2` | overrides: tar@7.5.21 (**the critical**; desktop packaging smoke required), uuid@11.1.1 (NOT 14 — CJS line), fast-xml-parser@5.7.0, postal-mime@4.0.8, glob@14.0.2+minimatch@11.0.1 (gated on a CJS require probe) | up to 16 (23→7) |
| 3 | `ci/audit-gating-critical` | deps-audit: remove `continue-on-error`, `--audit-level=critical` (0 criticals expected → gate goes green) | — |
| 4 | `feat/wire-trw-access` | `trwAccess` namespace (ar/en + MESSAGE_NAMESPACES + request.ts + i18n.d.ts), my-access page i18n, entry link from TRWAccessGate authenticated branch | — |
| 5 | `feat/mobile-summary-detail-wire` | SubjectDetailScreen summary-row handlers → `navigation.navigate("SummaryDetail", { summaryId })` (~2 lines) | — |
| 6 | `chore/delete-instructor-dashboard` | delete page + orphan `instructorDashboard` from its 6 artifacts (messages ar/en, MESSAGE_NAMESPACES, request.ts ×2, i18n.d.ts) | — |

PRs 1→2→3 strictly sequential (root lockfile); 4/5/6 independent (disjoint files).

## Deferred / owner-gated (documented, not executed)

- **image-size ×2** (metro requires its default export; v2 removes it), **zod ×1** (babel-preset-expo's experimental react-compiler snapshot is ^3-only) — resolved by the queued Expo SDK 51→53 upgrade.
- **katex ×1** — dependabot hold (react-katex peer ^0.16); deliberate change = replace react-katex → bump 0.18.2 → lift hold. Owner call.
- **No upstream patch**: deepmerge GHSA-gcqx (low), node-forge GHSA-86w9 (high) — recheck periodically.
- Overrides are interim: most exist only because of the expo 51/RN 0.74.5 pins — prune them at the SDK upgrade.

## Acceptance

- `pnpm audit --prod` 59 → ≤7 (critical 0; high floor = image-size 2 + zod 1 + node-forge unpatched 1).
- Desktop packaging smoke (`electron-builder --dir`) passes on the tar override.
- `/trw/my-access` reachable from the gate; page fully i18n'd.
- Mobile summary rows open the detail screen (reviews reachable).
- instructor-dashboard route gone; no dangling imports; typecheck/tests green.
