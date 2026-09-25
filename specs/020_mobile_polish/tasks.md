# Spec 020 — Tasks

Execution ledger. Tier 2 (owner-approved 2026-09-25: news, dark mode,
summary reviews). Verify the spec §4 gates before ticking. T100 continues
the repo-wide task counter (spec 019 ended at T099).

## B1 — Spec landing
- [ ] T100 `specs/020_mobile_polish/{spec.md,tasks.md}` committed; pause for owner approval before C2.

## C2 — News tab (G1)
- [ ] T101 `NewsScreen`: web `useNews` query verbatim (`news`, `is_active = true`, created_at desc, limit 30) via `useSupabaseQuery` (cache `news:active`); category chips (all/announcement/update/important + custom_category labels); card = title/date/content-preview/first `image_urls` image/`file_url` Linking row; expandable full content; `news` namespace imported (11th) + `tabs.news` MOBILE_STRINGS key; 6th tab in `MainTabsParamList`.
- [ ] T102 `news-filter.test.ts` (category mapping incl. custom-category passthrough) + gates.

## C3 — Dark mode (G2)
- [ ] T103 `theme.ts` rebuilt: `lightColors`/`darkColors` (token names = today's hardcoded set), `ThemeContext` (system/light/dark override in AsyncStorage `masarx_theme_override`, resolved via `useColorScheme`), `useThemedColors()`; provider mounted in App; status bar scheme-aware.
- [ ] T104 migrate all 11 `COLORS` consts (App, Subjects, SubjectDetail, Summaries, QuizAttempts, Quizzes, QuizPlay, Login, SignUp, Profile, AIAssistant) to themed tokens — light palette pixel-equivalent to today.
- [ ] T105 Profile theme toggle card (system/light/dark chips) + 5 `profile.theme*` MOBILE_STRINGS keys (ar/en).
- [ ] T106 `theme.test.ts` (resolution matrix, persistence round-trip, light/dark key-set parity, light values match today's) + gates.

## C4 — Summary detail + reviews (G3)
- [ ] T107 latent-bug fix: `SummariesScreen` `ratings_count` → `reviews_count` (view column); rating badge renders; rows become Pressable → `SummaryDetail` (RootStack param `{ summaryId }`).
- [ ] T108 `SummaryDetailScreen`: detail row by id (maybeSingle), meta + PDF/YouTube via Linking + content via MathText; reviews fetch from `review_details` by `summary_id` (desc; reviewer_name/avatar, anonymous fallback).
- [ ] T109 review post (star 1–5 + optional comment → `reviews.insert({rating, comment, user_id, summary_id})`, web payload shape) + delete-own with confirm; aggregates refetched via the detail row; `reviews` namespace imported (12th); guests: read-only + defensive login prompt.
- [ ] T110 `review-validation.test.ts` (rating bounds, empty comment allowed, delete-own guard) + gates.

## C5 — Release
- [ ] T111 version 0.6.1 → 0.7.0 (package.json + app.json); full gate suite; ledger close.

## Owner actions (post-C5)
- [ ] Review this spec → approve C2–C5 execution.
- [ ] Push the fast-forwarded `main` (local ref already at 720b79a; origin still behind — push is owner-held).
- [ ] EAS/store checklist (spec 018) + device smoke of v0.6.1 remain pending.
