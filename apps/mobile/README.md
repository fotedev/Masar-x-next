# Masar X mobile (Expo)

Expo SDK 51 / React Native 0.74 / React 18 client for Masar X, sharing its backend and message catalog with `apps/web` through the `masarx-shared` workspace package.

## Setup

1. Requirements: Node 18+, pnpm 9+.
2. Install workspace deps at the repo root: `pnpm install` (links `masarx-shared` into the app).
3. Environment: create `apps/mobile/.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<public anon key>
   # optional — crash reporting (spec 023, see "Crash reporting" below)
   # EXPO_PUBLIC_SENTRY_DSN=https://<key>@o<org>.ingest.sentry.io/<project>
   ```

   `app.config.js` injects both into `expoConfig.extra`; `src/lib/supabase.ts` reads them at runtime via `expo-constants`. Missing vars produce a clear "cannot reach Masar X" state instead of a crash. Only the public anon key is ever referenced - never the service-role key (spec FR-017). `EXPO_PUBLIC_SENTRY_DSN` (optional) flows the same way into `src/lib/sentry.ts`.
4. Run in dev: `pnpm --filter mobile start` (or `cd apps/mobile && npx expo start`), then press `i` (iOS simulator) / `a` (Android emulator). For dev-client builds use the EAS `development` profile below.

## EAS profiles (`eas.json`)

- `development` - dev client, internal distribution (iOS simulator + Android APK).
- `preview` - internal distribution, Android APK.
- `production` - store build (Android AAB, auto-increment).

For cloud builds, expose the `EXPO_PUBLIC_*` vars as EAS environment variables/secrets so `app.config.js` resolves them at build time. `EXPO_PUBLIC_SENTRY_DSN` is optional — the app boots with crash reporting disabled when it is absent (see "Crash reporting" below).

## Structure

- `index.js` - Expo entry (`"main"`), mounts `./app/App`.
- `app/App.tsx` - `NavigationContainer` + auth gate (Login vs 5 bottom tabs) + RTL handling + QuizPlay root screen.
- `src/screens/` - `LoginScreen`, `SubjectsScreen`, `SummariesScreen`, `QuizzesScreen`, `QuizPlayScreen`, `AIAssistantScreen`, `ProfileScreen`.
- `src/components/` - `MathText.tsx` (KaTeX auto-render WebView with a raw-text fallback), `SentryBoundary.tsx` (root crash boundary, spec 023).
- `src/lib/` `src/context/` `src/hooks/` (earlier milestone) - supabase/ai/upload/quiz/sentry clients, auth + i18n providers, `useSupabaseQuery`, `useNetworkStatus`, `read-cache`, `share`, `i18n`, `theme`.

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
2. EAS secrets: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (public-by-design client values, never the service-role key), plus the Sentry vars in "Crash reporting" below once the DSN is provisioned.
3. Cloud builds: `npx eas build --profile production -p android` (AAB) and `-p ios` (IPA; Apple Developer account required). If CI builds are wanted, add repo secret `EXPO_TOKEN`.
4. Store listings: Google Play Console + App Store Connect accounts, screenshots, descriptions (ar + en), privacy policy URL.
5. Submit: `npx eas submit -p android --latest` / `npx eas submit -p ios --latest` (eas.json already has the `submit.production` profile).
6. Device smoke before submission: login → subjects → summaries (share + PDF) → quiz attempt → AI chat (bearer fix) → language switch (RTL restart prompt).

## Crash reporting (Sentry — spec 023)

`@sentry/react-native` v6 is wired without ejecting:

- **DSN** — `app.config.js` reads `EXPO_PUBLIC_SENTRY_DSN` at build time into `expoConfig.extra.sentryDsn`; `index.js` calls `initSentry()` (`src/lib/sentry.ts`) before mounting the app. No DSN ⇒ Sentry is inert and the app boots normally (same "unconfigured ≠ crash" contract as Supabase).
- **Symbolication** — the `@sentry/react-native/expo` config plugin (app.json) writes `sentry.properties` and injects `sentry.gradle` during prebuild; the `withSentryConfig` Metro wrapper stamps a Debug ID onto the bundle + sourcemap. During EAS builds, `sentry.gradle` forces Hermes sourcemap generation on the `createBundle*JsAndAssets` task and uploads the map (plus native symbols) via `sentry-cli`, keyed by release. The legacy `sentry-expo` postPublish hook is deliberately NOT used — it only fires for `eas update`, never `eas build`.
- **Error boundary** — `SentryBoundary` (`src/components/SentryBoundary.tsx`) wraps the app shell inside the provider stack; its fallback reuses the shared `errorBoundary` ar/en catalog with the standard retry button. Zero new i18n strings.
- **pnpm** — `@sentry/cli` is allowlisted in `pnpm-workspace.yaml` `onlyBuiltDependencies` (its postinstall downloads the CLI binary the upload needs).

### Owner setup — DONE (2026-09-26)

Provisioned by the owner session; recorded here for reference:

```bash
cd apps/mobile
# DSN for the aboalayoun/javascript-nextjs project (owner's choice — a dedicated
# react-native project later only needs a new DSN via one `eas env:set`)
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://5d2f…@o4511127807852544.ingest.de.sentry.io/4511127815192656" --type string --visibility sensitive --environment preview --environment production
# Auth token: secret visibility = write-only, readable only on EAS builders
eas env:create --name SENTRY_AUTH_TOKEN --value "<token>" --type string --visibility secret --environment preview --environment production
```

The Expo plugin is statically configured in app.json with `organization: aboalayoun`, `project: javascript-nextjs`, and **`url: https://de.sentry.io/`** — the DE-region base URL is required because the org is hosted on `ingest.de.sentry.io`; the default `sentry.io` endpoint would fail the upload auth. DSN ingest was verified end-to-end at provisioning (envelope POST → HTTP 200).

Local dev: `apps/mobile/.env.local` already carries `EXPO_PUBLIC_SENTRY_DSN` (gitignored), so `pnpm --filter mobile start` runs with Sentry debug logging. Note that adding Sentry adds native modules — rebuild dev-client installs after this change (`eas build --profile development`).

### Verify

1. Gates: `pnpm --filter mobile typecheck` / `lint` / `test` / `export` all green (export proves the Sentry-wrapped Metro bundle compiles; no upload happens locally — `sentry-cli` has no token).
2. Local runtime: with a DSN in `.env.local`, `pnpm --filter mobile start` shows Sentry debug output; without it you see the `[masarx] EXPO_PUBLIC_SENTRY_DSN is not set` warning and everything else works.
3. EAS: the preview build log shows the Sentry upload step, and the build's app version appears as a release in the Sentry dashboard.

### Reading a crash (5 lines)

1. Sentry dashboard → the Masar X mobile project → **Issues**, newest unhandled.
2. Open the event — stack frames resolve to `file:line` from the uploaded Hermes map.
3. Check the event's **release** matches the EAS build version; a mismatch means the symbols belong to another build.
4. Use the breadcrumbs + device/OS tags to see the actions that preceded the crash.
5. If frames show raw offsets like `useParentSafeAreaInsets@1:849472` instead of `file:line`, the sourcemap upload failed — check `SENTRY_AUTH_TOKEN` on EAS and the build log's Sentry step.

## Deferred / follow-ups

- Google OAuth on mobile (spec US4 / T046).
- AI streaming UI (`streamAiMessageMobile` is ready in `src/lib/ai.ts`).
- Quiz question images, summary authoring/moderation UI (upload only stores the PDF).
- Push notifications, deep links, OTA update channels.

## i18n note

Screen strings come from the shared registry (`masarx-shared/messages/{ar,en}/...`) plus the mobile-only supplement `MOBILE_STRINGS` in `src/i18n.ts` (tab labels, offline banner, upload toasts), pending promotion into the shared package.