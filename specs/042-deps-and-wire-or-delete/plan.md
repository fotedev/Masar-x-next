# Spec 042 — Execution Plan

## PR-1 `fix/deps-audit-wave1` (tier 1+2, 36 advisories)

Worktree `../masarx-wt/fix-deps-wave1` from `origin/main`.

1. `pnpm update node-forge joi` (semver-clean lockfile refresh — all consumers declare `^1.x` / `^17.2.1`).
2. Root `package.json` `pnpm.overrides`: `send@0.19.2` (already hoisted via serve-static), `postcss@8.5.32` (unifies with web's direct), `ajv@8.20.0` (already hoisted via workbox; expo-dev-launcher pins 8.11.0 exactly), `decode-uri-component@0.5.1` (0.x-caret consumer), `@xmldom/xmldom@0.8.15` (16 advisories, 2026 CVE wave via @expo/plist ← expo 51 — consumers pin ~0.7.7, DOMParser API intact).
3. `pnpm install` regenerates the lockfile.

Verify: `pnpm audit --prod --json` 59→23 · `pnpm -r typecheck` · `pnpm -r test` · `pnpm --filter web build`.

## PR-2 `fix/deps-audit-wave2` (tier 3, up to 16)

Sequential on PR-1 merge (same lockfile). Overrides: `tar@7.5.21` (critical; consumers @expo/cli/cacache/app-builder-lib/@electron/rebuild — build-time only; **desktop packaging smoke**: `pnpm --filter desktop build` + `npx electron-builder --dir`), `uuid@11.1.1` (CJS line for @expo/bunyan — never 14), `fast-xml-parser@5.7.0`, `postal-mime@4.0.8` (web browser bundle via puter.js), `glob@14.0.2`+`minimatch@11.0.1` (coupled pair; **CJS probe** `node -e "require('glob')"` after install — defer pair if ESM-only).

## PR-3 `ci/audit-gating-critical`

`.github/workflows/ci.yml` deps-audit: remove `continue-on-error: true`, `--audit-level=critical`. Expect 0 criticals → gate green.

## PR-4 `feat/wire-trw-access`

- `trwAccess` namespace: `packages/shared/src/messages/{ar,en}/trwAccess.json` + `MESSAGE_NAMESPACES` (types.ts) + `apps/web/src/i18n/request.ts` ar+en loaders + `apps/web/src/i18n.d.ts`.
- `apps/web/src/app/[locale]/trw/my-access/page.tsx`: ~15 hardcoded English strings → `useTranslations("trwAccess")`.
- `apps/web/src/components/trw/TRWAccessGate.tsx` authenticated branch: link to `/trw/my-access` ("View my plan" — locale-aware using the gate's existing locale variable).
- Verify: `trw-gate.spec.ts` e2e + suite battery.

## PR-5 `feat/mobile-summary-detail-wire`

`apps/mobile/src/screens/SubjectDetailScreen.tsx`: classified-group + unclassified summary-row handlers → `navigation.navigate("SummaryDetail", { summaryId: row.id })`. Verify: mobile tests + typecheck.

## PR-6 `chore/delete-instructor-dashboard`

Delete `apps/web/src/app/[locale]/instructor-dashboard/page.tsx`; remove `instructorDashboard` from `packages/shared/src/messages/{ar,en}/instructorDashboard.json`, `MESSAGE_NAMESPACES`, `request.ts` (ar+en), `i18n.d.ts`. Verify: grep 0, typecheck, tests. Doc mentions left for PR #194 (noted in body).

## Close-out

SUMMARY.md note + memory + final report (audit 59→~7, per-PR SHAs, deferred table).
