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
- EAS env vars (owner-run, documented in `apps/mobile/README.md`): `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` for `preview` and `production` environments; org/project slugs via `SENTRY_ORG`/`SENTRY_PROJECT` if the installed plugin requires them statically. Only public-by-design client values client-side; no service-role keys anywhere.

## Non-goals

- No APM/tracing, session replay, or PII scrubbing config.
- No in-app "report feedback" UI; no new i18n keys or namespaces.
- No web/desktop Sentry wiring (`logger.ts` envelope poster stays untouched).
- AGENTS.md I5 wording drift (says root `package.json`; on-disk reality is `pnpm-workspace.yaml`) is NOT fixed here.

## Acceptance

- [ ] Gates: `pnpm --filter mobile typecheck` / `lint` / `test` / `export` all green (export proves the Sentry-wrapped Metro bundle compiles; no upload happens locally without a token).
- [ ] No DSN in source or app.json; app boots with Sentry inert when `EXPO_PUBLIC_SENTRY_DSN` is unset.
- [ ] Error boundary shows ar/en title + retry from `masarx-shared` `errorBoundary` catalog; retry re-renders the app shell.
- [ ] README documents the `eas env:create` commands + verify steps + the 5-line "reading a crash" guide.
- [ ] Owner (post-merge): run the env var commands; first EAS preview build shows the Sentry upload step and the app version appears as a release in Sentry with symbolicated frames.

## Deployment note

Adding `@sentry/react-native` adds native modules ⇒ existing dev-client builds must be rebuilt (`eas build --profile development`) before local dev reflects the change. `expo export` / EAS builds are unaffected.
