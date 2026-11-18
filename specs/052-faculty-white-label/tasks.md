# Spec 052 — Tasks

## C1 — Spec
- [x] T01 `specs/052-faculty-white-label/spec.md` + `tasks.md` (disk-derived number: 052).

## C2 — Shared presets + faculty namespace (`feat(shared)`)
- [x] T02 `packages/shared/src/branding/faculties.ts` — `FACULTY_PRESET_IDS`, `FacultyPresetId`, `FacultyStrings`, `FacultyMessagesTable`, `resolveFacultyPresetId`, `resolveFacultyPresetIdFromEnv` (env-safe, dev warn on unknown).
- [x] T03 Export the module from `packages/shared/src/index.ts` (doc comment updated).
- [x] T04 `packages/shared/src/messages/{ar,en}/faculty.json` — `fcai-asnu` + `bis` presets (displayName / shortName / seoTitle / titleSuffix / poweredBy).
- [x] T05 Three-point registration: `messages/types.ts` `MESSAGE_NAMESPACES`, `i18n/index.ts` registry, `apps/web/src/i18n/request.ts` loaders.
- [x] T06 `packages/shared/src/branding/__tests__/faculties.test.ts`.
- Gates: `pnpm --filter masarx-shared typecheck && pnpm --filter masarx-shared test`.

## C3 — Web wiring (`feat(web)`)
- [x] T07 `apps/web/src/lib/site-url.ts` (SITE_URL) + layout/sitemap consume it.
- [x] T08 `apps/web/src/app/layout.tsx` — faculty-aware title/template/og/twitter; core path identical. (`applicationName` dropped — Next 16.4.6 no longer renders it.)
- [x] T09 `apps/web/src/app/sitemap.ts` — baseUrl → `SITE_URL`.
- [x] T10 `apps/web/src/app/robots.ts` (replaces `public/robots.txt`) — same rules, sitemap from `SITE_URL`.
- [x] T11 `apps/web/src/app/manifest.ts` (replaces `public/manifest.json`) — preset name/short_name; icons/shortcuts verbatim.
- [x] T12 `apps/web/src/proxy.ts` matcher += `manifest.webmanifest`; `apps/web/next.config.mjs` rewrite `/manifest.json → /manifest.webmanifest`.
- [x] T13 Footer: `Footer.tsx` passes preset strings; `FooterBrand.tsx` renders faculty name + powered-by (core unchanged).
- [x] T14 Tests: `FooterBrand.test.tsx`, `proxy.test.ts` matcher cases, `github-releases.test.ts` fixtures.
- Gates: web `tsc` + `lint` + `vitest`.

## C4 — Repo slug + config + docs (`chore/docs`)
- [x] T15 `apps/desktop/electron-builder.yml` publish `owner: Masar-X / repo: masar-x` + comments. ⚠ merge-gated on the transfer.
- [x] T16 `apps/web/src/lib/github-releases.ts` `RELEASES_REPO` + `downloads/page.tsx` releases URL.
- [x] T17 Docs sweep: `README.md`, `docs/agents/references/02-release-pipeline.md`, `docs/agents/references/01-gotchas.md` (live notes), `docs/desktop-readiness.md`, `.github/RULESET.md` (historical docs untouched).
- [x] T18 `.env.example`: drop `NEXT_PUBLIC_COLLEGE_NAME`, add `NEXT_PUBLIC_FACULTY`.
- [x] T19 `docs/BRANDING.md` §9 (faculty sub-brands) + §6 manifest path update.
- Gates: web `tsc`/`lint`.

## Post-merge (owner)
- [ ] T20 GitHub transfer `fotedev/Masar-x-next` → `Masar-X/masar-x` (must land BEFORE this PR merges — see spec §5 gate).
- [ ] T21 Vercel: verify prod deploy after transfer; create the faculty Vercel project (`NEXT_PUBLIC_FACULTY=fcai-asnu` + its own Supabase project + `NEXT_PUBLIC_SITE_URL`).
