# Spec 052: Faculty white-labeling — config-driven sub-brands on the Masar-X org

> Status: Approved by the owner 2026-11-18 (plan-mode plan; decisions merged from the owner's Model A/B directions).
> Numbering: derived from disk — specs/ ends at `050-zane-prompt-injection-hardening`; 051 is claimed by open PR #254 (`feat/051-zane-side-menu`).

## 1. Context & problem statement

- The platform lives at `fotedev/Masar-x-next`. The owner is moving brand governance to the **Masar-X** GitHub org and wants faculty instances (first: **FCAI ASNU X** — Faculty of Computers & AI, Assiut National University; later: BIS) deployed **without forks**: the fork-style BIS copy drifted from main and every merged spec had to be ported by hand.
- Today branding + canonical URLs are hardcoded with no per-instance config:
  - `metadata.json` (siteName/title) — core strings only, no faculty layer.
  - `https://masarx.vercel.app` in `apps/web/src/app/layout.tsx` (fallback), `apps/web/src/app/sitemap.ts` (hardcoded base), `apps/web/public/robots.txt` (sitemap line).
  - Static `apps/web/public/manifest.json` with `"name": "Masar X"`; **no `<link rel="manifest">` is injected anywhere** (Next only injects it for `app/manifest.ts`).
  - Footer `brandTitle` — Masar X only.
  - `NEXT_PUBLIC_COLLEGE_NAME` is declared in `.env.example` but referenced nowhere (stale hook).
- **Decisions (owner):** one repo + `NEXT_PUBLIC_FACULTY` presets (core fallback; `fcai-asnu` primary; `bis` secondary); SEO name **"FCAI ASNU X"** with short form **"ASNU X"**; the sidemenu keeps the Masar X logo untouched; repo moves to **Masar-X/Masar-x** via GitHub transfer (owner action; this PR is merge-gated on it); license stays AGPL-3.0-only.

## 2. Architecture & design

### 2.1 Shared: faculty presets (`packages/shared`)

- **New** `packages/shared/src/branding/faculties.ts` (dependency-free, mobile-safe):
  - `FACULTY_PRESET_IDS = ["fcai-asnu", "bis"]`, `FacultyPresetId`.
  - `FacultyStrings` (`displayName`, `shortName`, `seoTitle`, `titleSuffix`, `poweredBy`) + `FacultyMessagesTable`.
  - `resolveFacultyPresetId(raw)` — trims + lowercases; unknown → `null` with a dev-only warn; missing/empty → `null`.
  - `resolveFacultyPresetIdFromEnv()` — reads `process.env.NEXT_PUBLIC_FACULTY` with a `typeof process` guard.
  - Re-exported from `packages/shared/src/index.ts`.
- **New i18n namespace** `faculty.json` (ar/en), keyed per preset with the strings above. Bilingual SEO titles:
  - EN: `FCAI ASNU X · Masar X — Faculty of Computers & AI (Assiut National University)`
  - AR: `مسار إكس (FCAI ASNU X) — كلية الحاسبات والذكاء الاصطناعي جامعة أسيوط الأهلية`
  - Registered at the three contract points: `MESSAGE_NAMESPACES` (`messages/types.ts`), the `i18n/index.ts` registry, `apps/web/src/i18n/request.ts` loaders (alphabetical, between `faq` and `fileDropzone`); the spec-040 parity test covers it automatically.

### 2.2 Web wiring (`apps/web`)

- **New** `src/lib/site-url.ts` — `SITE_URL = NEXT_PUBLIC_SITE_URL || "https://masarx.vercel.app"`; consumed by layout, sitemap, robots.
- `src/app/layout.tsx` `generateMetadata` — when a preset resolves: `title.default` = preset `seoTitle`, `title.template` = `%s | ${titleSuffix}`, `openGraph`/`twitter` titles = `seoTitle`, `openGraph.siteName` = `displayName`. Description/keywords/slogan stay core (the instance *is* Masar X). Core path renders byte-identical metadata to today. (`applicationName` was dropped during implementation: Next 16.4.6's metadata resolver no longer renders it — verified against the dev-server HTML.)
- **New** `src/app/robots.ts` replaces `public/robots.txt` (git rm) — same rules, sitemap URL from `SITE_URL`.
- **New** `src/app/manifest.ts` replaces `public/manifest.json` (git rm) — `name`/`short_name` from the preset (`"FCAI ASNU X"` / `"ASNU X"`; core `"Masar X"`), description/icons/shortcuts verbatim from the static file. Next auto-injects `<link rel="manifest" href="/manifest.webmanifest">` (fixes the missing link).
- `src/proxy.ts` matcher gains `manifest.webmanifest` (spec 048 precedent: static routes must bypass the locale redirect); `manifest.json` stays excluded for the compat rewrite.
- `next.config.mjs` gains a rewrite `/manifest.json → /manifest.webmanifest` so stale links keep resolving.
- `src/components/Footer.tsx` passes preset `displayName` + `poweredBy` to `FooterBrand`; `FooterBrand` shows the faculty name as the brand title and a small "Powered by Masar X" line only when a preset is active. Core render unchanged.

### 2.3 Repo-slug sweep (⚠ merge-gated on the GitHub transfer)

`fotedev/Masar-x-next` → `Masar-X/Masar-x` in: `apps/desktop/electron-builder.yml` (`publish.owner/repo` + comments), `apps/web/src/lib/github-releases.ts` (`RELEASES_REPO`), `apps/web/src/app/[locale]/downloads/page.tsx` (releases URL), `apps/web/src/lib/__tests__/github-releases.test.ts` (fixtures), `README.md` (releases links), `docs/agents/references/02-release-pipeline.md`, `docs/agents/references/01-gotchas.md` (live pipeline notes), `docs/desktop-readiness.md`, `.github/RULESET.md`. Historical docs stay untouched (`docs/MVP_REPORT.md`, deprecated `docs/releases/CUT-CHECKLIST.md`).

### 2.4 Config & docs

- `.env.example`: remove stale `NEXT_PUBLIC_COLLEGE_NAME`; add documented `NEXT_PUBLIC_FACULTY`.
- `docs/BRANDING.md`: new **§9 faculty sub-brands** (master brand Masar X; instances named «Faculty» X; sidemenu untouched; strings managed only in `faculty.json`; §2/§4/§5/§8 rules carry over) + §6 manifest path updated to `app/manifest.ts`.
- **New** `specs/052-faculty-white-label/spec.md` + `tasks.md`.

**Boundary:** no changes to `apps/web/src/components/desktop/**` or `desktop-shell.css`; `SideNav.tsx` untouched (open PR #254 owns it — the optional faculty badge is deferred to a follow-up).

**Out of scope:** desktop/mobile apps (stay Masar X-only; faculty instances are web deployments); BIS migration (preset strings are placeholders until the owner provides official naming); SW notification fallback strings; AI persona faculty mention.

## 3. Behavior preservation & regression strategy

- **Core is the default path**: without `NEXT_PUBLIC_FACULTY`, `resolveFacultyPresetIdFromEnv()` returns `null` and every consumer renders today's exact strings (metadata, footer, manifest, robots rules).
- **Accepted characteristic (verified 2026-11-19):** `NextIntlClientProvider` serializes *all* namespaces into the client payload, so `faculty.json` strings appear as inert JSON data in the HTML of every deployment — same class as the admin/dashboard namespaces already shipped there. Nothing renders them unless a preset is active.
- Proxy matcher changes only widen static exclusions, pinned by the existing spec-048 test block.
- The namespace parity test enforces ar/en completeness of `faculty.json` (keys + placeholders).
- The manifest becomes generated but content-equivalent (plus the head link, which is additive).

## 4. Test specification

- `packages/shared/src/branding/__tests__/faculties.test.ts` — null for missing/empty/whitespace; case-insensitive match (`FCAI-ASNU`); unknown value → null (+ dev warn); env wiring of `resolveFacultyPresetIdFromEnv`.
- `apps/web/src/components/__tests__/FooterBrand.test.tsx` — core render = `brandTitle` only; faculty render = faculty display name + powered-by line.
- `apps/web/src/__tests__/proxy.test.ts` — `/manifest.webmanifest` + `/manifest.json` excluded from the matcher.
- `apps/web/src/lib/__tests__/github-releases.test.ts` — fixtures moved to the new slug still pass.

## 5. Atomic execution plan

| Commit | Scope | Gates |
|---|---|---|
| C1 | `docs(specs)`: spec 052 | none (docs) |
| C2 | `feat(shared)`: presets module + `faculty` namespace (ar/en) + registration + tests | shared `typecheck` + `test` |
| C3 | `feat(web)`: site-url, metadata, robots.ts, manifest.ts, proxy matcher, rewrite, footer, tests | web `tsc` + `lint` + `vitest` |
| C4 | `chore/docs`: repo-slug sweep + `.env.example` + BRANDING §9 | web `tsc`/`lint` |

**Merge gate: the PR merges only after the owner transfers `fotedev/Masar-x-next` → the Masar-X org.** The electron-builder publish block and release URLs switch at merge time; merging before the transfer would break desktop auto-update and download links until the transfer lands. *(Gate satisfied 2026-11-19 — the transfer landed with canonical name `Masar-X/Masar-x`; all slug strings in this PR were aligned to that case.)*
