# Masar X — Web ↔ Mobile Feature-Parity Matrix

Source of truth: the web app inventory at `.cluster/masarx-native/web-inventory.md`
(every web route under `apps/web/src/app/[locale]/` was read and mapped on 2026-08-30).

Legend: ✅ ported & functional · 🔶 partial (core flow ported, secondary features deferred) · ⏳ deferred (documented gap) · ➖ web-only by design

| Web route | Mobile counterpart | Status | Notes |
| --- | --- | --- | --- |
| `/` `/home` (feed + quick actions) | `(app)/index.tsx` home dashboard | ✅ | Quick-action cards incl. المساعد زين; feed top-10 lists deferred ⏳ |
| `/login` (email+password) | `(auth)/sign-in.tsx` | ✅ | Same `signInWithPassword`; Arabic error mapping; forgot-password inline. Google OAuth: web has it, mobile uses email+password only ⏳ (Google blocks embedded-webview OAuth; needs native SDK module) |
| `/signup` | `(auth)/signup.tsx` | ✅ | `signUp` + full_name metadata, validation, "check email" flow, auto-continue when confirmations disabled |
| `/reset-password` | Forgot-password via web | 🔶 | `resetPasswordForEmail` from mobile links to the web reset page (code exchange happens there); completing reset inside the app deferred ⏳ |
| Session persistence | Chunked SecureStore adapter (`src/lib/supabase.ts`) | ✅ | Token chunks ≤ 2048 B; survives force-close |
| `/api/auth/sync` profile bootstrap | `signup.tsx` upsert + profile read fallback | 🔶 | Web syncs profiles server-side; mobile inserts `{id, full_name}` client-side on signup, falls back to email display |
| `/subjects` (grid, level+active-semester filter) | `(app)/subjects.tsx` | ✅ | Same columns/order + `is_academic` + `show_on_home` + `semester=active_semester` from `platform_settings` |
| `/subjects/[subject]` (lectures, content tabs, progress) | `(app)/subjects/[name].tsx` | 🔶 | Lectures list + per-lecture summaries/files/videos/quizzes + `user_progress` toggle ✅; YouTube theatre mode + admin add-lecture ⏳ |
| `/summaries/[summaryId]` | `(app)/summaries/[id].tsx` | ✅ | Content text, PDF download (system opener), YouTube link, author profile; inline `[IMAGES]` parser + reviews/appeals deferred ⏳ |
| `/summaries` list | `(app)/summaries.tsx` | ✅ | Same `summaries_with_ratings` ranked query (web has no dedicated list page; the ranked feed is on home) |
| `/news` | `(app)/news.tsx` | 🔶 | Feed with type badges ✅; add/delete news (admin authoring) ⏳ |
| `/courses` (catalog) | `(app)/quizzes.tsx` sibling — courses list | ⏳ deferred | Catalog query is trivial but detail/enrollment (payment-proof upload) is heavy — deferred with backend untouched |
| `/quizzes` (dashboard) | `(app)/quizzes.tsx` | ✅ | `status=approved` feed, subject/year chips from the description JSON |
| `/quiz-play/[quizId]` (player) | `(app)/quiz-play/[quizId].tsx` | ✅ | startAttempt/resume (`quiz_attempts`), per-answer upsert (`quiz_answers` onConflict), client scoring, timer, finish + review; guests play locally (same as web) |
| `/quiz-attempts` history | Deferred | ⏳ | Attempt rows are persisted; history screen is a next step |
| `/profile` (name, level/semester pickers, TRW switch) | `(app)/profile.tsx` | 🔶 | Academic level/semester pickers (same `profiles` upsert) ✅; display-name editing + TRW switch ⏳ |
| `/notifications` (realtime) | `(app)/notifications.tsx` | ✅ | Same query (eq user, limit 50) + mark-all-read; realtime invalidation via the shared live channel |
| `/ai-assistant` (Zane) | `(app)/zane.tsx` | 🔶 | Chat against the SAME Edge Function `ai-chat` contract (`AiRequest`/`AiResponse` types from `@masarx-shared/ai`), user-JWT auth — contract-compliant path for mobile; conversation persistence (`ai_chat_messages`) + mode picker deferred ⏳ |
| `/trw/*` (redeem, categories, courses, my-access) | — | ⏳ deferred | Whole TRW section is gated by memberships; port after core polish |
| `/non-academic`, `/downloads`, `/faq`, `/privacy*` | — | ⏳ deferred | Static/secondary pages |
| `/admin*`, `/instructor-dashboard`, `/add-*`, `/edit-summary` | — | ➖ deferred | Moderation/authoring surfaces are desktop-first; mobile stays read+play in v1.2 |
| `/onboarding/academic` | `(app)/profile.tsx` academic pickers | 🔶 | Same `profiles` upsert; dedicated first-login onboarding flow ⏳ |
| Realtime live updates | `src/lib/realtime.ts` | ✅ | Same mechanism as web (`postgres_changes` channels); invalidates subjects/summaries/news/platform-settings queries — no manual refresh |
| Offline resilience | Persisted query cache (`src/lib/cache.ts` + `PersistQueryClientProvider`) | ✅ | Cache persisted to AsyncStorage (7-day maxAge) → previously loaded content renders offline; offline banner + retry/backoff |

## packages/shared integration

- `@masarx-shared/ai` — `AiRequest`/`AiResponse` contract types used by the mobile Zane client (`src/lib/zane.ts`). The shared `sendAiMessage` targets the web cookie-proxy path; mobile calls the same Edge Function with the user JWT, which is the contract's own mobile pattern — no business logic duplicated.
- `@masarx-shared/types` — database row types (`Subject`, `Summary`, `Quiz`, `News`, `Profile`, `SubjectLecture`) used by `src/lib/api.ts`.
- `@masarx-shared/*` resolves via tsconfig paths to `../../packages/shared/src/*` (the shared package's documented convention); Metro re-writes nothing at runtime because all shared imports are `import type` — zero bundle-weight, zero duplicated type drift.
- Shared messages (ar/en JSON) and the Supabase client factory remain available for the next milestone; the mobile app ships Arabic strings natively today (documented deviation for build simplicity).
