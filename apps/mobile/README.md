# Masar X mobile (Expo)

Expo SDK 51 / React Native 0.74 / React 18 client for Masar X, sharing its backend and message catalog with `apps/web` through the `masarx-shared` workspace package.

## Setup

1. Requirements: Node 18+, pnpm 9+.
2. Install workspace deps at the repo root: `pnpm install` (links `masarx-shared` into the app).
3. Environment: create `apps/mobile/.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<public anon key>
   ```

   `app.config.js` injects both into `expoConfig.extra`; `src/lib/supabase.ts` reads them at runtime via `expo-constants`. Missing vars produce a clear "cannot reach Masar X" state instead of a crash. Only the public anon key is ever referenced - never the service-role key (spec FR-017).
4. Run in dev: `pnpm --filter mobile start` (or `cd apps/mobile && npx expo start`), then press `i` (iOS simulator) / `a` (Android emulator). For dev-client builds use the EAS `development` profile below.

## EAS profiles (`eas.json`)

- `development` - dev client, internal distribution (iOS simulator + Android APK).
- `preview` - internal distribution, Android APK.
- `production` - store build (Android AAB, auto-increment).

For cloud builds, expose the two `EXPO_PUBLIC_*` vars as EAS environment variables/secrets so `app.config.js` resolves them at build time.

## Structure

- `index.js` - Expo entry (`"main"`), mounts `./app/App`.
- `app/App.tsx` - `NavigationContainer` + auth gate (Login vs 5 bottom tabs) + RTL handling + QuizPlay root screen.
- `src/screens/` - `LoginScreen`, `SubjectsScreen`, `SummariesScreen`, `QuizzesScreen`, `QuizPlayScreen`, `AIAssistantScreen`, `ProfileScreen`.
- `src/components/MathText.tsx` - KaTeX auto-render WebView with a raw-text fallback.
- `src/lib/` `src/context/` `src/hooks/` (earlier milestone) - supabase/ai/upload/quiz clients, auth + i18n providers, `useSupabaseQuery`, `useNetworkStatus`, `read-cache`, `share`, `i18n`, `theme`.

## Implemented (v1)

- Email/password auth with SecureStore-persisted sessions (same Supabase account as web).
- Subjects list from Supabase `subjects`, Arabic names primary, offline banner + cached reads (`LocalReadCache`).
- Summaries from the `summaries_with_ratings` view, native share sheet, open PDF link.
- Quizzes: approved list + player writing `quiz_attempts` / `quiz_answers` exactly like the web; guest results stay on-device.
- AI Tutor chat through the `ai-chat` Edge Function (no provider keys in the app), KaTeX math rendering.
- Profile: sign out, language override (ar/en, restart prompt when the layout direction flips), PDF upload to the `summaries-pdfs` bucket.
- Offline handling via NetInfo + cached reads.

## Launch readiness (spec 018 — 2026-09-24)

Spec: `specs/018_mobile_launch_readiness/`. Fixed in this pass:

- **Dependency repair** — `@react-navigation/native-stack` reverted 7.19.2 → 6.11.0 (dependabot PR #32 had introduced a v7/v6 peer-dep skew that broke the runtime); `"type": "module"` removed from `package.json` (it broke the Expo toolchain — `metro.config.js` / `babel.config.js` / the entry are CJS; `expo export` failed on it, dev `expo start` had tolerated it).
- **Scripts wired** — `lint` (eslint + typescript-eslint parser), `export` (`expo export --platform android`, the headless bundle proof), root `build:mobile` now points at it; `expo-dev-client ~4.0.29` added so the `development` EAS profile is real.
- **AI chat 401 fixed** — the `ai-chat` Edge Function authenticates via `Authorization: Bearer`; the shared AI client grew an additive `authToken` option and mobile now passes the Supabase session token per call (web behavior unchanged — its proxy injects auth server-side). Locked by `src/lib/__tests__/ai.test.ts`.
- **Store assets** — `assets/icon.png` (1024), `assets/adaptive-icon.png` (safe-zone foreground), `assets/splash.png` generated from the brand knot mark by the deterministic `scripts/generate-assets.mjs` (same master + scale conventions as the web icon ladder); wired into `app.json`, white backgrounds. Version `0.6.0` (aligned with the desktop 0.6.0 release train).
- **Tests + CI** — vitest suite (18 tests: chunking, cache TTL, AI bearer contract); CI `mobile` job (lint + bundle proof; typecheck/test ride the existing cross-workspace jobs).

Verification gates (all green on the spec branch): mobile `typecheck` / `lint` / `test` (18/18) / `export` (2.73 MB android hbc) · shared + desktop typecheck · actionlint.

### Owner checklist to reach the stores

1. `cd apps/mobile && npx eas init` — creates the Expo project; put the returned `projectId` into `eas.json` (all profiles or top level).
2. EAS secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public-by-design client values, never the service-role key).
3. Cloud builds: `npx eas build --profile production -p android` (AAB) and `-p ios` (IPA; Apple Developer account required). If CI builds are wanted, add repo secret `EXPO_TOKEN`.
4. Store listings: Google Play Console + App Store Connect accounts, screenshots, descriptions (ar + en), privacy policy URL.
5. Submit: `npx eas submit -p android --latest` / `npx eas submit -p ios --latest` (eas.json already has the `submit.production` profile).
6. Device smoke before submission: login → subjects → summaries (share + PDF) → quiz attempt → AI chat (bearer fix) → language switch (RTL restart prompt).

## Deferred / follow-ups

- Google OAuth on mobile (spec US4 / T046).
- AI streaming UI (`streamAiMessageMobile` is ready in `src/lib/ai.ts`).
- Quiz question images, summary authoring/moderation UI (upload only stores the PDF).
- Push notifications, deep links, OTA update channels.

## i18n note

Screen strings come from the shared registry (`masarx-shared/messages/{ar,en}/...`) plus the mobile-only supplement `MOBILE_STRINGS` in `src/i18n.ts` (tab labels, offline banner, upload toasts), pending promotion into the shared package.