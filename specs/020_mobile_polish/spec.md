# Spec 020 — Mobile Polish: News, Dark Mode, Summary Reviews (v0.7.0)

> Branch: `feat/020-mobile-polish` — stacked on `feat/019-mobile-parity`
> (= `main` @ `720b79a` after the approved fast-forward merge; main and the
> 019 tip are identical, so the branch can cut from either).
> Status: **APPROVED — C2–C5 signed off by the owner 2026-09-26** (Tier-2 scope
> + all three items approved 2026-09-25; C4–C5 executed on this branch).
> MVP Lock note: owner explicitly queued Tier 2 as the next engineering phase.
> Base: spec 019 complete (v0.6.1 — 62 mobile vitest tests, all gates green).

## 1. Context & problem statement

v0.6.1 closed the functional core, but three presentation/content gaps keep
mobile behind the web for daily use:

| # | Gap | Web reference |
|---|---|---|
| G1 | **No announcements channel** — web `/news` (categories, images, attachments) has no mobile counterpart; app users never see platform updates | `/news` + `useNews`: `news.select("*").eq("is_active", true).order("created_at", desc).limit(30)` |
| G2 | **Light-only UI** — every screen hardcodes a local light `COLORS` const (11 files, grep-verified); web has full dark/light (`tailwind.config.js darkMode: 'class'`) | Theme classes + ThemeScript persistence |
| G3 | **No summary detail / reviews** — Summaries rows are inert; web has star+comment reviews (`ReviewSection`), rating aggregates, delete-own | `useReviews` over the `review_details` view; inserts into `reviews` |

Latent bug found while scoping (fixed in this spec): `SummariesScreen`'s row
interface reads `ratings_count`, but the `summaries_with_ratings` view column
is **`reviews_count`** — the field has silently been `undefined`.

Non-goals: news authoring/editing/appeal surfaces (admin-only, stay web),
push notifications for news (owner-deferred, spec 004/018), summary
authoring/editing on mobile, YouTube inline playback (links open externally),
tablet layouts, AI streaming (T054a), Google OAuth (T046).

## 2. Architecture & design

### 2.1 News tab (G1) — read-only, 6th tab
- **`NewsScreen`** mounted as a 6th tab (`MainTabsParamList.News`) with the
  tab label from a new MOBILE_STRINGS key (`tabs.news`).
- Data: web `useNews` shape verbatim — `news.select("*").eq("is_active", true)
  .order("created_at", { ascending: false }).limit(30)` through
  `useSupabaseQuery` (cache `news:active`, offline-readable). The `news`
  table is hand-typed in the shared Database (Row exists — use
  `masarx-shared/types` re-export where practical, local narrowing for the
  list rows).
- Category chips: `all` / `announcement` / `update` / `important` (client-side
  filter on `type`; `custom_category` shown as a chip label on cards when
  present). Priority sorting within the fetch stays as web's (created_at desc).
- Card: title, date (shared `format`), content preview, `image_urls` via
  `RN Image` (first image, full-width, aspect-fill), `file_url` row →
  `Linking.openURL`. Content full text via expandable (Pressable toggle) —
  no detail route needed for v0.7.0.
- i18n: shared **`news` namespace imported (11th)** — pageTitle,
  categoryAll/Announcement/Update/Important, noNews, publishedAt, view,
  download, attachedFile all exist verbatim.

### 2.2 Dark mode (G2) — JS token swap (web parity mechanism: class-based)
- **`src/lib/theme.ts` rebuilt** as the dual-palette token source:
  `lightColors` / `darkColors` maps with the exact token names screens use
  today (primary, ink, subtle, bg, card, border, danger, success, banner,
  bannerText, …), `spacing`, `radii`, `typography` kept.
- **`src/context/ThemeContext.tsx`**: mode = `system` | `light` | `dark`;
  override persisted in AsyncStorage (`masarx_theme_override`, same pattern
  as the locale override); resolved scheme = override !== "system" ? override
  : `useColorScheme()`. Provider mounted in `app/App.tsx` inside
  I18nProvider. `useTheme()` returns `{ mode, resolved, setMode }` and
  `useThemedColors()` returns the active palette object.
- **Migration of all 11 `COLORS` consts** (App, Subjects, SubjectDetail,
  Summaries, QuizAttempts, Quizzes, QuizPlay, Login, SignUp, Profile,
  AIAssistant): each screen calls `useThemedColors()`; StyleSheet.create
  blocks that hardcode colors move to inline style merges for themed values
  (pragmatic pattern: keep static layout styles in StyleSheet, apply colors
  via style arrays). No screen adds new UI beyond the toggle.
- **Profile toggle card**: three-way chips (system/light/dark) beside the
  language card; labels from new MOBILE_STRINGS `profile.theme*` keys (5
  keys ar/en — the only new strings in this spec).
- `app.json` `userInterfaceStyle: "automatic"` already set — no change.
- `expo-status-bar`: root `style="dark"` becomes scheme-aware
  (`resolved === "dark" ? "light" : "dark"`).

### 2.3 Summary detail + reviews (G3)
- **`SummaryDetailScreen`** (RootStack, slide_from_right; param
  `{ summaryId: string }`): Summaries rows become `Pressable` → navigate.
  Detail loads `summaries_with_ratings` row by id (`maybeSingle`) — meta
  (title, subject, year, department, contributor, date via shared `format`,
  avg_rating + reviews_count), PDF (`Linking`), YouTube (`Linking`), content
  via `MathText`.
- **Reviews section** (port of web `ReviewSection` + `useReviews`):
  - Fetch: `review_details.select("*").eq("summary_id", id)
    .order("created_at", { ascending: false })` — the view exposes
    `reviewer_name` / `reviewer_avatar`; anonymous fallback uses the shared
    `reviews.anonymous` key.
  - Post (signed-in only): star picker (1–5) + optional comment →
    `reviews.insert({ rating, comment, user_id, summary_id })` (web payload
    shape; `content` field not used on mobile). After post → refetch both
    reviews and the detail row (aggregates live in the view).
  - Delete-own: own review rows get a delete affordance →
    `reviews.delete().eq("id")` (web parity) with a confirm.
  - Guest state: read-only list + login prompt (auth gate means guests
    don't reach tabs — the guard is defensive, mirroring QuizPlay's).
  - i18n: shared **`reviews` namespace imported (12th)** — title, addReview,
    empty, anonymous, heading, confirmDelete, delete, emptyTitle, emptyHint
    all exist verbatim.
- **Latent-bug fix:** `SummariesScreen` row interface `ratings_count` →
  `reviews_count` (view column name), and the rating badge renders it.

## 3. Behavior preservation & regression strategy

- Existing journeys untouched except: Summaries rows gain navigation (same
  list data), every screen gains themed colors (light palette identical to
  today — dark is additive), one new tab.
- All shared-namespace imports are additive registry entries (three-point
  contract); zero new shared strings.
- Palette drift guard: a unit test asserts `lightColors` token keys cover
  every token name referenced by screens (import-time contract), and that
  `darkColors` has the same key set as `lightColors`.
- AI boundary untouched; no new provider surfaces.

## 4. Test specification (mobile vitest, pure logic)

| Suite | Scenarios |
|---|---|
| `theme.test.ts` | resolved scheme for each override × colorScheme; override persistence round-trip (mocked AsyncStorage); light/dark token key sets identical; light tokens match the current hardcoded values |
| `news-filter.test.ts` | category filter mapping (all → no filter; type match; custom_category passes through under "all" only) |
| `review-validation.test.ts` | rating bounds 1–5; empty comment allowed; delete-own guard logic |
| existing suites | 62 tests stay green |

Gates per commit: mobile `typecheck` + `lint` + `test` + `export`;
`masarx-shared` + desktop typecheck.

## 5. Atomic execution plan

| # | Commit | Contents | Notes |
|---|--------|----------|-------|
| B1 | `docs(specs): add specs/020 mobile polish` | this spec + tasks.md | docs-lint |
| C2 | `feat(mobile): news tab` | §2.1 + news ns + news-filter tests | — |
| C3 | `feat(mobile): dark mode theming` | §2.2 + theme tests (widest commit — 11 screens) | light palette must be pixel-equivalent |
| C4 | `feat(mobile): summary detail with reviews` | §2.3 + reviews ns + validation tests + ratings_count fix | — |
| C5 | `chore(mobile): release 0.7.0` | version bump both files + full gates | target ≥75 tests |

Staging discipline: explicit paths only, per commit; re-check `git log`
before each commit (parallel-session rule).

## 6. Version

`0.6.1` → **`0.7.0`** (Tier-2 polish increment, per the owner's two-tier
framing).
