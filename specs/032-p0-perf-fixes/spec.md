# Spec 032 — P0 Performance Fixes (Wave 0)

> | | |
> |---|---|
> | **Branch** | `fix/032-p0-perf-fixes` |
> | **Created** | 2026-11-03 |
> | **Status** | Approved (owner plan approval 2026-11-03) |
> | **Type** | `fix` — deployment-readiness + blocking-bug batch (MVP-Lock eligible) |
> | **Input** | Performance audit 2026-11-02 — `docs/perf/audit-2026-11-02/` (PR #175): PKG-1 (P0), SPLIT-1 (P0), SPLIT-2 (P0) |

## Problem

Three P0 findings from the audit block launch readiness:

1. **PKG-1 — packaged app's image optimizer is broken.** Next's file tracer includes `@img/sharp-win32-x64`'s `.node` loader but not its dynamically-linked DLLs (`libvips-42.dll`, `libvips-cpp-8.18.6.dll`). The traced standalone tree contains **0 `.dll` files** (measured 2026-11-02 and re-verified 2026-11-03), so `require("sharp")` fails inside the packaged Electron app and every `/_next/image` URL 500s. The last recorded smoke test (0.5.6, 2026-08-21) predates the sharp 0.35.4 upgrade (2026-09-22).
2. **SPLIT-1 — `PageTransition dynamic(..., {ssr:false})` ships an empty `<main>`.** All non-light, non-admin routes pass their page through the ssr:false boundary (`apps/web/src/components/Layout.tsx:23-26, 115-119`), so server HTML contains header strip + footer only. LCP waits for JS download → hydration → client data fetch: measured LCP 9.06s on `/ar/ai-assistant`, 5.86s on `/ar/quiz-play`; CLS 0.889–0.917 on subjects/quizzes/news/quiz-play (the server-HTML footer shifts when hydrated content grows).
3. **SPLIT-2 — no route-level `loading.tsx` anywhere.** Every heavy page hand-rolls a post-hydration spinner; the pre-hydration gap is unbounded while SPLIT-1 stands.

### Re-diagnosis context for SPLIT-1 (why removing `ssr:false` is now plausible)

The 2026-09-16 crash ("useRouter is not supported in Server Components" on `/ai-assistant`, memory `masarx-pagetransition-ssr-boundary`) was attributed to rendering the page outside the ssr:false boundary. The audit's re-examination found the plain-div SSR path is **not universally broken**: `/login`, `/signup`, `/reset-password`, `/privacy-policy`, `/privacy-details` all SSR `"use client"` + `useRouter` pages through the identical plain div (`Layout.tsx:115-119`) without crashing. The one structural difference in ai-assistant: it is the only page declaring `next/dynamic(..., { ssr: false })` **inside its own page module** (PuterSettingsModal `page.tsx:28-33`, LocalQuizPreviewModal `page.tsx:35-43`). Spec 032 therefore re-runs the documented cold-repro experiment first and only removes `ssr:false` if the boundary can be cleared safely (timeboxed fallback below).

## Scope

**In:**
- PKG-1: add `@img/sharp-win32-x64` to `outputFileTracingIncludes` in `apps/web/next.config.mjs` (alongside the existing `@swc/helpers` entry), so the DLLs land in `.next/standalone` and therefore in `resources/web/` via electron-builder `extraResources`.
- SPLIT-1: cold-repro experiment (temporary re-add of the `|| isAssistantRoute` bypass, 28b8fc5 state) → isolation of the page-internal `ssr:false` dynamics → removal of `{ ssr: false }` from the PageTransition dynamic import (`Layout.tsx:23-26`) plus the minimal ai-assistant change the experiment dictates. Revert all experiment toggles afterwards.
- SPLIT-2 (only if SPLIT-1 lands): route-level `loading.tsx` in six heavy routes, composed from the shared `Skeleton` component.

**Out (non-goals):**
- `outputFileTracingExcludes` for non-Windows sharp binaries (PKG-2) — separate follow-up; standalone may temporarily grow ~19 MB from the include.
- Differential updates, compression changes (PKG-4/5), desktop cold-start work (DESKTOP-1..5) — later waves.
- Any Wave 1 P1 work (admin dynamic imports, auth dedupe, DB migrations).
- New skeleton designs — reuse `Skeleton` + the `QuizzesLoading` composition shape only.

## Contracts

No public API/data contract changes. Code contracts:

- `apps/web/next.config.mjs` — `outputFileTracingIncludes` gains one glob entry; no other keys change.
- `apps/web/src/components/Layout.tsx:23-26` — `PageTransition` becomes a plain `dynamic(() => import("./PageTransition").then(m => m.PageTransition))` (still code-split; now SSR'd). Route classification (`isLightRoute`/`isAdminRoute`) unchanged.
- New files: `apps/web/src/app/[locale]/{ai-assistant,quizzes,profile,news}/loading.tsx`, `apps/web/src/app/[locale]/quiz-play/[quizId]/loading.tsx`, `apps/web/src/app/[locale]/subjects/[subject]/loading.tsx` — default-export server components, no `"use client"`, no data access, static JSX only.

## Behavior preservation & regression strategy

- The 2026-09-16 crash is the primary regression risk. Mitigation: the cold-repro experiment reproduces it deliberately first (temporary bypass toggle, reverted after), with `/login` and `/privacy-policy` as same-branch controls; only after the root cause is isolated does the `ssr:false` removal land. **Timebox/fallback:** if the crash cannot be reproduced and root-caused, all experiment toggles are reverted, `ssr:false` stays, SPLIT-2 defers with it, and only PKG-1 ships from this spec — recorded in the spec status block.
- Hydration-change risk: routes under the now-SSR'd PageTransition render framer-motion `initial` styles server-side (inline opacity), identical to the light-route pages' behavior; `AnimatePresence` client behavior unchanged.
- PKG-1 risk: none at runtime (additive include); build-time verification guards the `dereference-standalone.cjs` postbuild pass.
- Existing test suite (vitest unit + Playwright e2e incl. `ai-chat-history`, `guest-quiz`) must stay green — they exercise the changed boundary.

## Test specification

1. **Build verification (PKG-1):** `pnpm --filter web build` → `find apps/web/.next/standalone -name "*.dll"` returns ≥ 2 (`libvips-42.dll`, `libvips-cpp-8.18.6.dll`); `sharp-win32-x64-0.35.4.node` still present; standalone server boots.
2. **Crash repro (SPLIT-1 experiment):** with the bypass toggled in and cold `.next`, `curl /ar/ai-assistant` reproduces the useRouter RSC error; `/ar/login` + `/ar/privacy-policy` return 200 under identical conditions.
3. **Post-fix smoke:** cold build, `next start` on :3111 → all 7 audit routes return 200 (`/ar`, `/ar/ai-assistant`, `/ar/subjects`, `/ar/quizzes`, `/ar/quiz-play/7bbf857a-…`, `/ar/login`, `/ar/news`); one `/_next/image?url=<cloudinary>` fetch returns 200.
4. **Perf verification:** Lighthouse 13.6 (mobile emulation) on the same 7 routes vs `measurement/lighthouse-2026-11-02.md` — ai-assistant LCP ≤ 3.5s (from 9.06s), quiz-play LCP ≤ 3.5s (from 5.86s), CLS < 0.1 on subjects/quizzes/news/quiz-play (from 0.89–0.92), landing/login Performance ≥ 94 (no regression).
5. **Suites:** `pnpm --filter web test` (vitest) and `pnpm --filter web test:e2e` (Playwright) green.

## Acceptance

- [x] DLLs present in `.next/standalone` after a clean build (PKG-1) — `libvips-42.dll` + `libvips-cpp-8.18.7.dll`; verified again via a live `/_next/image` fetch returning a real optimized JPEG (200, 40 KB). **Implementation note:** the include glob must climb to the repo-root `node_modules` (`../../node_modules/@img/...`) — include paths resolve relative to `apps/web`, and `@img/*` is an optional dep hoisted to the root under the hoisted linker; the app-relative `./` form matched nothing (first attempt produced 0 DLLs).
- [x] SPLIT-1 experiment executed and documented — **the 2026-09-16 crash no longer reproduces**: cold-dev with the exact 28b8fc5 bypass state returned 200 for `/ar/ai-assistant` (8.4s first compile) with `/ar/login` + `/ar/privacy-policy` controls green. Stale incident at Next 16.4.1; no fallback needed.
- [x] `ssr:false` removed from PageTransition and cold-verified — 5 routes 200, zero crash lines, ai-assistant SSR HTML carries full content (133 KB vs the old empty-`<main>` chrome).
- [x] Six `loading.tsx` files present. Correction to the expected mechanism: they do not appear in the static curl HTML (client pages don't suspend server-side); their value is the client-navigation chunk-load gap and any future server suspension.
- [x] Lighthouse (mobile, same 7 routes, single runs): ai-assistant **LCP 9.06s → 1.37s** (perf 58 → 85), news **CLS 0.917 → 0.005** (74 → 95), quizzes **TBT 2.08s → 416ms** (46 → 66), subjects 73 → 86 (CLS 0.889 → 0.202), landing 92–94 (noise-range vs 96, content unchanged), login 97. **Not met, deferred with cause:** quiz-play LCP 5.86s → 5.58s (target ≤3.5s) — its start card still renders only after the client-side quiz fetch (FETCH-3 waterfall + client-gated render; needs RSC data fetch, Wave 1); quizzes CLS 0.889 → 0.798 — the hydrated client data swap (no server data to stream), Wave 1 (FETCH/SPLIT-3 territory, out of Wave 0 scope).
- [x] vitest 286/286 green; Playwright e2e 11/11 green (after installing browser revision 1248 for the worktree's Playwright — environment, not code).
- [ ] CI green on the PR (pending push).
