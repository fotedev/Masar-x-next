# Spec 020 — Tasks

Execution ledger. Tier 2 (owner-approved 2026-09-25: news, dark mode,
summary reviews). Verify the spec §4 gates before ticking. T100 continues
the repo-wide task counter (spec 019 ended at T099).

## B1 — Spec landing
- [x] T100 `specs/020_mobile_polish/{spec.md,tasks.md}` committed (d2d2e06); pause honored — owner approved C2–C5 execution 2026-09-26.

## C2 — News tab (G1)
- [x] T101 `NewsScreen`: web `useNews` query verbatim (`news`, `is_active = true`, created_at desc, limit 30) via `useSupabaseQuery` (cache `news:active`); category chips (all/announcement/update/important + custom_category labels); card = title/date/content-preview/first `image_urls` image/`file_url` Linking row; expandable full content; `news` namespace imported (11th) + `tabs.news` MOBILE_STRINGS key; 6th tab in `MainTabsParamList` (between Quizzes and AI).
- [x] T102 `news-filter.test.ts` (6 tests: all-passes-everything, strict trimmed type equality, null/custom excluded from fixed tabs, custom-category label extraction) + gates: typecheck ✅ · lint ✅ · vitest 68/68 ✅ · export ✅.

## C3 — Dark mode (G2)
- [x] T103 `theme.ts` rebuilt: `lightColors`/`darkColors` with 17 ROLE tokens (the union of every former hardcoded value incl. Login's `#CBD5E1` input border → `inputBorder`); `resolveTheme` (system → useColorScheme, null = light) + `paletteFor`; override persistence (`masarx_theme_override`, locale-override pattern); `ThemeContext` (mode/resolved/colors/setMode) mounted in App; status bar scheme-aware via a new AppShell.
- [x] T104 all **12** COLORS consts migrated (11 pre-existing + NewsScreen from C2) to `createStyles(colors)` factories + `useThemedColors` via `useTheme()`; zero `COLORS.` or stray hex left (grep-verified); App.tsx uses module-level light/dark style pairs (multi-component file). Light palette **pixel-equivalent**: locked hex-by-hex by `theme.test.ts`.
- [x] T105 Profile theme toggle card (system/light/dark chips, live re-render — no restart) + 4 `profile.theme*` MOBILE_STRINGS keys (ar/en).
- [x] T106 `theme.test.ts` (9 tests: **light-invariance hex lock**, light/dark key-set parity, real-palette difference, resolution matrix incl. null scheme, persistence round-trip + corrupted-value ignore) + gates: typecheck ✅ · lint ✅ · vitest 77/77 ✅ · export ✅. Known limitation (ledgered, not fixed): MathText's KaTeX WebView HTML keeps its own light background.

## C4 — Summary detail + reviews (G3)
- [x] T107 latent-bug fix: `SummariesScreen` `ratings_count` → `reviews_count` (view column); rating badge renders (★ avg (count)); rows become Pressable → `SummaryDetail` (RootStack param `{ summaryId }`).
- [x] T108 `SummaryDetailScreen`: detail row by id (maybeSingle → explicit not-found state), meta (subject/year/department/contributor, shared `formatDate`, ★ avg_rating (reviews_count)) + PDF/YouTube via Linking (SubjectDetail `openLink` pattern) + content via MathText; reviews fetch from `review_details` by `summary_id` (desc; reviewer_name/avatar with `reviews.anonymous` fallback — data-layer in new `lib/reviews.ts` typed off the shared `SummaryWithRatings` Row).
- [x] T109 review post (star 1–5 + optional comment → `reviews.insert(...)`; `buildReviewInsert` maps the web payload's `comment` onto the real `content` column — the shared type is stale, web `useReviews` maps identically) + delete-own with `Alert.alert` destructive confirm; aggregates refetched via the detail row after post/delete; `reviews` namespace imported (12th) + `summaryDetail.*` MOBILE_STRINGS (ar/en); guests: read-only list + guest chip → defensive login `Alert` (no route to the signed-out stack from the authed stack).
- [x] T110 `review-validation.test.ts` (12 tests: content-column payload mapping, comment trim, empty + null comment allowed, rating bounds 0/6/4.5 rejected + full 1–5 accepted, delete-own guard matrix) + gates: typecheck ✅ · lint ✅ · vitest 89/89 ✅ · export ✅ · shared typecheck ✅ · desktop typecheck ✅.

## C5 — Release
- [x] T111 version 0.6.1 → 0.7.0 (package.json + app.json); full gate suite rerun on the release tree; ledger close: **spec 020 complete — C1–C5 all landed on `feat/020-mobile-polish`** (C1 spec d2d2e06, C2 news 7c493d7, C3 dark mode 7beeca8, C4 summary detail + reviews d0799e6). Full gate suite on this commit: mobile typecheck ✅ · lint ✅ · vitest 89/89 ✅ · export ✅; shared typecheck ✅ · desktop typecheck ✅.

## Owner actions (post-C5)
- [x] Review this spec → approve C2–C5 execution (owner signed off 2026-09-26).
- [ ] Push the fast-forwarded `main` (local ref already at 720b79a; origin still behind — push is owner-held).
- [ ] EAS/store checklist (spec 018) + device smoke of v0.6.1 remain pending.
