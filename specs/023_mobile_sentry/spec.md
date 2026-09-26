# Spec 023 — Sentry crash reporting (apps/mobile)

**Status:** Approved (owner, 2026-09-26 — plan approval)
**Type:** Feature (owner-directed under MVP Lock — deployment readiness)
**Branch:** feat/023-mobile-sentry

## Problem

The dual-React startup crash (fixed in `fcf9dfd`) reached the device dropbox with no telemetry — diagnosis required USB logcat. The mobile app has no crash/error reporting at all. Sentry is wanted so the next such crash arrives with a symbolicated stack (Hermes bytecode offsets like `useParentSafeAreaInsets@1:849472` must resolve to file:line) instead of needing a cable.

## Scope

`@sentry/react-native` v6 (Expo-compatible, no eject) wired through the app's existing config conventions:

1. **DSN plumbing** — mirrors the Supabase pattern exactly: `app.config.js` reads `EXPO_PUBLIC_SENTRY_DSN` at build time → `expoConfig.extra.sentryDsn` → `Constants.expoConfig?.extra` at runtime (`src/lib/sentry.ts`). Never hardcoded; the app boots normally (Sentry inert, `__DEV__` warn) when the var is absent — the "unconfigured ≠ crash" contract from `supabase.ts`.
2. **Expo config plugin** (`"@sentry/react-native/expo"` in app.json `plugins`) + **Metro wrapper** (`withSentryConfig` from `@sentry/react-native/metro`) so EAS builds upload the Hermes bundle sourcemap + native symbols; auth via the `SENTRY_AUTH_TOKEN` EAS env var. This is the EAS-build path — the legacy `sentry-expo` postPublish hook only fires for `eas update`, not `eas build`.
3. **Root error boundary** — `Sentry.ErrorBoundary` wraps `AppShell` inside the provider stack; fallback mirrors `UnconfiguredScreen`'s themed retry UI (`Palette`-based light/dark `StyleSheet`, brand + message + retry button). Strings come from the **existing** shared `errorBoundary` namespace (ar/en) imported into `src/i18n.ts` REGISTRY — zero new strings.
4. **pnpm allowlist** — `@sentry/cli` added to `onlyBuiltDependencies` in `pnpm-workspace.yaml` (pnpm 9 array syntax), else its postinstall binary download is silently skipped and the build-time upload fails.

## Contracts

- `extra.sentryDsn: string` (empty string = disabled); `initSentry()` called from `index.js` before `registerRootComponent(App)`; minimal init — `Sentry.init({ dsn, debug: __DEV__ })`, no tracing/PII options.
- EAS env vars (provisioned 2026-09-26 by the owner session): `EXPO_PUBLIC_SENTRY_DSN` (sensitive) + `SENTRY_AUTH_TOKEN` (secret) for `preview` and `production`. Only public-by-design client values client-side; the token is write-only on EAS (`secret` visibility).
- Plugin is statically configured (owner-provided creds): `organization: aboalayoun`, `project: javascript-nextjs`, `url: https://de.sentry.io/` — the DE-region base URL is required because the org is hosted on `ingest.de.sentry.io`; the default `sentry.io` URL would break the upload auth. Note: mobile events land in the `javascript-nextjs` project (owner's explicit choice; a dedicated react-native project would only need a new DSN + one `eas env:set`).

## Non-goals

- No APM/tracing, session replay, or PII scrubbing config.
- No in-app "report feedback" UI; no new i18n keys or namespaces.
- No web/desktop Sentry wiring (`logger.ts` envelope poster stays untouched).
- AGENTS.md I5 wording drift (says root `package.json`; on-disk reality is `pnpm-workspace.yaml`) is NOT fixed here.

## Acceptance

- [x] Gates: `pnpm --filter mobile typecheck` / `lint` / `test` (89/89) / `export` all green (export proves the Sentry-wrapped Metro bundle compiles; no upload happens locally — `sentry-cli` has no local token).
- [x] No DSN in source or app.json; app boots with Sentry inert when `EXPO_PUBLIC_SENTRY_DSN` is unset.
- [x] Error boundary shows ar/en title + retry from `masarx-shared` `errorBoundary` catalog; retry re-renders the app shell.
- [x] README documents the EAS env setup + verify steps + the 5-line "reading a crash" guide.
- [x] EAS env vars created (`eas env:create`, 2026-09-26) for preview + production; DSN ingest verified end-to-end (envelope POST → HTTP 200, event `3e66419794644e669d46bf67712dc657` in `aboalayoun/javascript-nextjs`); token validated against `de.sentry.io` API (`project:releases` scope present).
- [ ] First EAS preview build shows the Sentry upload step and the app version appears as a release in Sentry with symbolicated frames.

## Deployment note

Adding `@sentry/react-native` adds native modules ⇒ existing dev-client builds must be rebuilt (`eas build --profile development`) before local dev reflects the change. `expo export` / EAS builds are unaffected.
