# Spec 054 — Footer powered-by org link + GitHub star badge

> Roadmap doc: `sandbox/masarx-anux-plan/04-footer-poweredby-org-star.md` (owner decisions locked 2026-11-21). Spec prepared per I11; approved by owner in plan mode before any code.

## Context

The footer should market the Masar-X GitHub org to convert student traffic on info/utility pages into GitHub stars and org visibility. PR #267 (merged as squash `5ef18ef9`) already scopes the footer to info/utility routes via `footerRoutes.ts`. Current state:

- `apps/web/src/components/footer/FooterDeveloper.tsx` opens `https://github.com/fotedev` (personal account) via a `<button onClick={() => window.open(...)}>` — not a real anchor.
- `apps/web/src/components/footer/FooterBrand.tsx` renders the faculty `poweredBy` string (spec 052 preset, `faculty.json`) as plain text in a `<p>`.
- No star count exists anywhere; the only GitHub API pattern in-repo is `apps/web/src/lib/github-releases.ts` (`Accept: application/vnd.github+json` + `next: { revalidate: 3600 }`, stubbed-fetch tests).

Owner decisions recorded in doc 04 (2026-11-21): org link + star badge appear on **all** deployments (core and faculty); the powered-by line stays faculty-scoped per BRANDING.md §9 / spec 052 (core keeps no powered-by line).

## Requirements

- **FR-1 Developer link** — `FooterDeveloper.tsx` targets `https://github.com/Masar-X` (org) instead of `github.com/fotedev`, rendered as a real `<a target="_blank" rel="noopener noreferrer">` replacing the `window.open` button; visible label stays the existing i18n key `footer.followOnGithub`.
- **FR-2 Star badge** — new client component `footer/FooterStarBadge.tsx` rendered inside the `FooterDeveloper` block: `<a href="https://github.com/Masar-X/Masar-x" target="_blank" rel="noopener noreferrer">` = Star icon + compact star count (when available) + `footer.starOnGithub` label. The **same anchor** renders in both states — when the count is unavailable the count is simply omitted (plain star link). Never an error state.
- **FR-3 Star data (server-side only)** — new `apps/web/src/lib/github-stars.ts` exporting `getRepoStars(): Promise<number | null>`:
  - `GET https://api.github.com/repos/Masar-X/Masar-x` with headers `{ Accept: "application/vnd.github+json" }` and `next: { revalidate: 3600 }` (github-releases.ts pattern);
  - plus `signal: AbortSignal.timeout(2500)` — deliberate addition beyond the releases pattern, because this call sits in global chrome and must never stall page render (releases is only used on the downloads surface);
  - parses `stargazers_count` (must be a finite number); returns `null` on **any** failure (non-OK status, malformed body, fetch throw, abort); **never throws**.
- **FR-4 Threading** — `apps/web/src/app/[locale]/layout.tsx` (server) awaits `getRepoStars()` and threads the plain serializable `repoStars: number | null` through `AppProviders` → `Layout` → `Footer` → `FooterDeveloper` as optional props (same pattern as the existing `user`/`profile` props; mirrors the `DesktopAppBanner` server-data→client-component precedent). No new route handler, no client-side fetch. Next's Data Cache makes the upstream cost ~1 call/hour server-wide.
- **FR-5 Powered-by link** — `FooterBrand.tsx` wraps the faculty `poweredBy` text in `<a href="https://github.com/Masar-X" target="_blank" rel="noopener noreferrer" aria-label={t("githubOrgAria")}>`. The visible text is unchanged and preset-sourced; the line still renders only when a faculty preset is active.
- **FR-6 Strings** — all visible text via i18n. `packages/shared/src/messages/{en,ar}/footer.json` gains `starOnGithub` (en `"Star on GitHub"` / ar `"أضف نجمة على GitHub"`) and `githubOrgAria` (en `"Visit the Masar-X organization on GitHub"` / ar `"زيارة منظمة Masar-X على GitHub"`). No registry changes needed (the `footer` namespace is already registered in `packages/shared/src/i18n/index.ts`, `packages/shared/src/messages/types.ts` MESSAGE_NAMESPACES, and `apps/web/src/i18n/request.ts` loaders). `faculty.json` untouched. GitHub URLs live as constants (mirroring `RELEASES_REPO`), not scattered literals.
- **FR-7 Footer scope unchanged** — the footer still renders only via `isFooterRoute()` (PR #267 contract). All changes live inside the footer tree and its prop threading; zero gating edits.
- **FR-8 Count format** — `new Intl.NumberFormat(locale, { notation: "compact" }).format(stars)` with the active next-intl locale (`ar` → Arabic-Indic compact digits, `en` → `1.2K`).
- **FR-9 Accessibility** — every new link's accessible name states its real destination (org profile on GitHub / stargaze the Masar-X repo).

## Architecture

| File | Change |
|---|---|
| `apps/web/src/lib/github-stars.ts` | **new** — `getRepoStars()` + URL constants |
| `apps/web/src/components/footer/FooterStarBadge.tsx` | **new** — client badge, props `{ stars: number \| null, t }` |
| `apps/web/src/components/footer/FooterDeveloper.tsx` | org anchor (FR-1) + badge slot (FR-2) |
| `apps/web/src/components/footer/FooterBrand.tsx` | powered-by link (FR-5) |
| `apps/web/src/components/Footer.tsx` | accept + forward `repoStars` |
| `apps/web/src/components/AppProviders.tsx` | accept + forward optional `repoStars` |
| `apps/web/src/components/Layout.tsx` | accept + forward optional `repoStars` |
| `apps/web/src/app/[locale]/layout.tsx` | `await getRepoStars()` (FR-4) |
| `packages/shared/src/messages/{en,ar}/footer.json` | 2 new keys (FR-6) |

## Behavior preservation / regression strategy

- Footer route gating and desktop/admin/assistant suppression are untouched — the #267 e2e contract (`footer.spec.ts`) must stay green.
- Core deployment: powered-by line still absent; org link + star badge visible (intended).
- Faculty deployments: powered-by text identical, now linked.
- Performance: one upstream GitHub call per revalidate window per server instance (Data Cache); 2.5 s abort cap; CI / air-gapped environments degrade to the plain star link — page render never blocks beyond the abort window.
- Out of scope (pre-existing, untouched): hardcoded `"Aboalayoun"` / `"AI student"` literals in `FooterDeveloper.tsx` and the literal `fotedev` span in `Footer.tsx`'s bottom bar (existing i18n debt; this spec adds no new debt).

## Test spec

- **Unit** `apps/web/src/lib/__tests__/github-stars.test.ts` (mirror the stubbed-fetch style of `github-releases.test.ts` — `vi.stubGlobal("fetch", …)` + minimal `{ ok, status, json }` helpers):
  - asserts exact call args (URL, `Accept` header, `next: { revalidate: 3600 }`);
  - `200` + numeric `stargazers_count` → the number; non-200 → `null`; missing/non-numeric field → `null`; fetch throw → `null`; aborted fetch → `null`;
  - asserts the function never rejects.
- **Component** `FooterStarBadge.test.tsx`: `stars=null` → anchor renders without count text; `stars=1234` → compact count text rendered; href constant correct; label via stub `t` (FooterBrand.test.tsx pattern).
- **Component** `FooterDeveloper.test.tsx` (new): org href on the anchor; badge rendered when `repoStars` passed; stub-`t` pattern.
- **Component** `FooterBrand.test.tsx` (extend): powered-by renders as a link with the org href + aria-label; still absent for core.
- **E2E** `footer.spec.ts` (extend, API-outcome-agnostic so CI rate-limits/unreachability can't fail it): on `/en`, `footer a[href="https://github.com/Masar-X"]` and `footer a[href="https://github.com/Masar-X/Masar-x"]` are visible; existing info/studying footer visibility assertions untouched.

## Execution plan (atomic commits)

Worktree `../masarx-wt/spec-054-footer-org-star`, branch `feat/054-footer-org-star` from `origin/main` (`5ef18ef9`).

1. `docs(specs): add spec 054 footer org link + star badge` — this file.
2. `feat(web): github-stars lib with cached repo star fetch` — FR-3 + unit tests.
3. `feat(web): footer org links + star badge from faculty preset strings` — FR-1/2/4/5/6/8/9 + i18n keys.
4. `test(web): footer org/star component + e2e coverage` — component tests + e2e extension.

Gates before push: `.env.local` copied into the worktree (spec 044 build guard), web vitest suite, `tsc --noEmit`, eslint, e2e `footer.spec.ts` (fresh `E2E_PORT`, explicit filenames). PR to `main` (SSH-signed local commits satisfy required_signatures); owner merges.
